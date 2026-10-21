"""本体の変更(HEAD → 作業ツリー)を、タグ付きで samples のファイルに当てる(#29 の形式)。

使い方: python3 textbook/tools/tagmerge.py <samples のファイル> <本体の旧(HEAD)> <本体の新> <章 例 25-1> <コメント記号 # か //>

本体の旧は `git -C devex-api show HEAD:backend/app/foo.py > /tmp/old.py` のように取り出して渡す。

- 追記: 追加行の直前に `<c> Phase-N-n:追記`
- 更新: `<c> Phase-N-n：更新` + 旧行のコメントアウト + `<c> ↓↓` + 新行
- 削除: `<c> Phase-N-n：削除` + 旧行のコメントアウト
- ファイル冒頭のヘッダー(`<c> 作成：…｜更新：…`)の「更新」に章を足す。ヘッダーが無ければ `<c> 更新：Phase-N-n` を入れる。
- ファイル先頭の import 区間は、samples を新の区間で置き換え、増えた・減った名前を区間の直前の1行
  (`<c> Phase-N-n:追記 ── m.a, m.b` / `<c> Phase-N-n：削除 ── m.c`)にまとめる(#29 の特則)。並べ替えだけならタグなし。
- 複数行の文字列(docstring)を途中で切る変更・関数の中の import はタグを付けずにそのまま当て、
  標準エラーに「要手当て」と出す。docstring は記録の行の案も出す。
- TSX の JSX の子の位置(開きタグと閉じタグの間)では、タグ・コメントアウトを `{/* … */}` で入れる
  (位置は tsx_context.cjs が devex-ui の typescript の構文木で調べる)。
- 同じ行が続くときの挿入・削除の区切りは下へずらし、挿入は samples の次の行の履歴タグより前に入れる。
- 当てた後の Python・TS/TSX が構文として読めなければ、標準エラーに出して終了コード 1 にする(ファイルは書く)。
"""

import ast
import difflib
import io
import json
import re
import subprocess
import sys
import tokenize
from collections.abc import Callable
from pathlib import Path

Span = tuple[int, int]  # 行の範囲(0始まり、両端を含む)


def string_spans(lines: list[str]) -> list[Span]:
    """複数行の文字列トークンが占める行の範囲。Python だけ。"""
    spans: list[Span] = []
    try:
        tokens = tokenize.generate_tokens(io.StringIO("".join(lines)).readline)
        for tok in tokens:
            if tok.type == tokenize.STRING and tok.start[0] != tok.end[0]:
                spans.append((tok.start[0] - 1, tok.end[0] - 1))
    except (tokenize.TokenError, IndentationError, SyntaxError):
        pass
    return spans


def cuts(spans: list[Span], start: int, end: int) -> bool:
    """行 start〜end-1 を置き換える(start == end なら start の前に入れる)と、どれかの文字列を途中で切るか。"""
    for s, e in spans:
        if start == end:
            if s < start <= e:
                return True
        elif not (e < start or s >= end or (start <= s and e < end)):
            return True
    return False


def is_import(line: str) -> bool:
    s = line.strip()
    return s.startswith(("from ", "import ")) or (
        s.endswith(",") and s.replace(",", "").replace("_", "").replace(" ", "").isalnum()
    ) or s in (")",) or s.endswith("import (")


def indent_of(line: str) -> str:
    return line[: len(line) - len(line.lstrip())]


# ── import 区間 ──────────────────────────────────────────────


def _is_type_checking_block(node: ast.stmt) -> bool:
    if not isinstance(node, ast.If) or node.orelse:
        return False
    test = node.test
    name = test.id if isinstance(test, ast.Name) else test.attr if isinstance(test, ast.Attribute) else ""
    return name == "TYPE_CHECKING" and all(isinstance(n, (ast.Import, ast.ImportFrom)) for n in node.body)


def _py_names(nodes: list[ast.stmt]) -> list[str]:
    names: list[str] = []
    for node in nodes:
        if isinstance(node, ast.If):
            names += _py_names(node.body)
        elif isinstance(node, ast.Import):
            names += [a.name for a in node.names]
        elif isinstance(node, ast.ImportFrom):
            module = "." * node.level + (node.module or "")
            names += [f"{module}.{a.name}" for a in node.names]
    return names


def py_imports(lines: list[str]) -> tuple[Span, list[str]] | None:
    """先頭の import 区間(docstring の後、import 以外の最初の文の前まで)と、import する名前。"""
    try:
        body = ast.parse("".join(lines)).body
    except SyntaxError:
        return None
    if body and isinstance(body[0], ast.Expr) and isinstance(body[0].value, ast.Constant):
        body = body[1:]
    nodes: list[ast.stmt] = []
    for node in body:
        if not (isinstance(node, (ast.Import, ast.ImportFrom)) or _is_type_checking_block(node)):
            break
        nodes.append(node)
    if not nodes:
        return None
    return (nodes[0].lineno - 1, (nodes[-1].end_lineno or nodes[-1].lineno) - 1), _py_names(nodes)


TS_FROM = re.compile(r"""\bfrom\s*["']([^"']+)["']\s*;?\s*$""")
TS_SIDE = re.compile(r"""^import\s*["']([^"']+)["']\s*;?\s*$""")


def _ts_names(statement: str) -> list[str]:
    text = " ".join(statement.split())
    if m := TS_SIDE.match(text):
        return [m.group(1)]
    m = TS_FROM.search(text)
    if not m:
        return []
    module = m.group(1)
    clause = text[len("import") : m.start()].strip()
    clause = clause.removeprefix("type ")
    names: list[str] = []
    braces = re.search(r"\{(.*)\}", clause)
    head = clause[: braces.start()] if braces else clause
    for part in (p.strip() for p in head.split(",")):
        if part.startswith("* as "):
            names.append(f"{module}.*")
        elif part:
            names.append(f"{module}.{part}")
    if braces:
        for part in (p.strip() for p in braces.group(1).split(",")):
            part = part.removeprefix("type ").split(" as ")[0].strip()
            if part:
                names.append(f"{module}.{part}")
    return names


def ts_imports(lines: list[str]) -> tuple[Span, list[str]] | None:
    """先頭の import 文の連なり(間の空行・コメントを含む)と、import する名前。"""
    i, first, last = 0, -1, -1
    names: list[str] = []
    while i < len(lines):
        s = lines[i].strip()
        if not s or s.startswith(("//", "/*", "*")) or (first < 0 and s.strip("'\";") == "use client"):
            i += 1
            continue
        if not s.startswith("import ") and not s.startswith("import{"):
            break
        start = i
        while not (TS_FROM.search(lines[i]) or TS_SIDE.match(lines[i].strip())) and i + 1 < len(lines):
            i += 1
        names += _ts_names("".join(lines[start : i + 1]))
        first = start if first < 0 else first
        last = i
        i += 1
    return ((first, last), names) if first >= 0 else None


def import_region(lines: list[str], py: bool) -> tuple[Span, list[str]] | None:
    return py_imports(lines) if py else ts_imports(lines)


def is_tag_or_history(line: str, c: str) -> bool:
    return line.strip().startswith(c)


def merge_imports(
    sample: list[str], old: list[str], new: list[str], chapter: str, c: str, py: bool, reports: list[str]
) -> tuple[list[str], list[str], bool]:
    """先頭の import 区間を新にそろえる。(samples, 旧, 変えたか) を返す。旧も新の区間に置き換え、後の差分に出なくする。"""
    o, n, s = import_region(old, py), import_region(new, py), import_region(sample, py)
    if o is None or n is None:
        if (o is None) != (n is None):
            reports.append("-- 要手当て(import): 旧か新の片方にしか先頭の import 区間が無い")
        return sample, old, False
    (o1, o2), o_names = o
    (n1, n2), n_names = n
    if old[o1 : o2 + 1] == new[n1 : n2 + 1]:
        return sample, old, False
    if s is None:
        reports.append("-- 要手当て(import): samples の先頭の import 区間が読めない")
        return sample, old, False
    (s1, s2), _ = s
    region = new[n1 : n2 + 1]
    # samples の区間の中の、本体に無いコメント(過去のタグ・コメントアウトした旧行)は区間の直前へ移す
    kept = {line.strip() for line in region}
    moved = [line for line in sample[s1 : s2 + 1] if is_tag_or_history(line, c) and line.strip() not in kept]
    added = [x for x in dict.fromkeys(n_names) if x not in set(o_names)]
    removed = [x for x in dict.fromkeys(o_names) if x not in set(n_names)]
    tags = []
    if added:
        tags.append(f"{c} Phase-{chapter}:追記 ── {', '.join(added)}\n")
    if removed:
        tags.append(f"{c} Phase-{chapter}：削除 ── {', '.join(removed)}\n")
    sample = sample[:s1] + moved + tags + region + sample[s2 + 1 :]
    old = old[:o1] + region + old[o2 + 1 :]
    return sample, old, True


# ── ヘッダー ────────────────────────────────────────────────


def update_header(sample: list[str], chapter: str, c: str) -> list[str]:
    at = 0
    while at < len(sample) and sample[at].startswith(("#!", "# -*-")):
        at += 1
    line = sample[at] if at < len(sample) else ""
    if line.startswith((f"{c} 作成：", f"{c} 更新：")):
        text = line.rstrip("\n")
        if "更新：Phase-" in text:
            head, _, chapters = text.partition("更新：Phase-")
            if chapter in [x.strip() for x in chapters.split(",")]:
                return sample
            text = f"{head}更新：Phase-{chapters},{chapter}"
        else:
            text = f"{text}｜更新：Phase-{chapter}"
        return sample[:at] + [text + "\n"] + sample[at + 1 :]
    return sample[:at] + [f"{c} 更新：Phase-{chapter}\n"] + sample[at:]


# ── TS/TSX(tsx_context.cjs) ────────────────────────────────


TSX_HELPER = Path(__file__).with_name("tsx_context.cjs")


class TsUnavailable(Exception):
    """node か devex-ui の typescript が無く、構文木を読めない。"""


def ts_info(text: str, file_name: str, lines: list[int]) -> tuple[set[int], list[tuple[int, str]]]:
    """lines(0始まり)のうち JSX の子の位置にある行と、構文エラー(1始まりの行, 文)。"""
    try:
        result = subprocess.run(
            ["node", str(TSX_HELPER)],
            input=json.dumps({"text": text, "fileName": file_name, "lines": lines}),
            capture_output=True,
            text=True,
            check=True,
        )
    except (OSError, subprocess.CalledProcessError) as e:
        raise TsUnavailable(str(e)) from e
    data = json.loads(result.stdout)
    return set(data["jsx"]), [(x["line"], x["msg"]) for x in data["errors"]]


def jsx_comment(text: str) -> str:
    """JSX の子の位置のコメント。中の `*/` はコメントを閉じないように崩す。"""
    text = text.replace("*/", "*\\/")
    return f"{{/* {text} */}}" if text else "{/* */}"


# ── 本体 ────────────────────────────────────────────────────


def enclosing_name(text: str, line: int) -> str:
    """行(0始まり)を囲む一番内側の def/class の名前。無ければ「モジュール」。"""
    try:
        tree = ast.parse(text)
    except SyntaxError:
        return "?"
    best, size = "モジュール", None
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            lo, hi = node.lineno - 1, (node.end_lineno or node.lineno) - 1
            if lo <= line <= hi and (size is None or hi - lo < size):
                best, size = node.name, hi - lo
    return best


Op = tuple[str, int, int, int, int]


def slide(old: list[str], new: list[str], opcodes: list[Op]) -> list[Op]:
    """equal 以外の op。挿入・削除の区切りは、後ろの一致する行の範囲で下へずらす(git と同じ)。

    `) : null}` のような同じ行が続くと、difflib は既存の行から挿入を始めることがあり、タグが既存の行の前に付く。
    """
    result: list[Op] = []
    for k, (tag, i1, i2, j1, j2) in enumerate(opcodes):
        if tag == "equal":
            continue
        limit = next((op[1] for op in opcodes[k + 1 :] if op[0] != "equal"), len(old))
        if tag == "insert":
            while i1 < limit and j2 < len(new) and new[j1] == new[j2] == old[i1]:
                i1, i2, j1, j2 = i1 + 1, i2 + 1, j1 + 1, j2 + 1
        elif tag == "delete":
            while i2 < limit and j1 < len(new) and old[i1] == old[i2] == new[j1]:
                i1, i2, j1, j2 = i1 + 1, i2 + 1, j1 + 1, j2 + 1
        result.append((tag, i1, i2, j1, j2))
    return result


def merge(
    sample_text: str, old_text: str, new_text: str, chapter: str, c: str, tsx: bool = False
) -> tuple[str, list[str]]:
    """samples に本体の 旧→新 の差分をタグ付きで当てた結果と、標準エラーに出す報告。tsx なら JSX の位置を調べる。"""
    reports: list[str] = []
    if old_text == new_text:
        return sample_text, reports
    sample = sample_text.splitlines(keepends=True)
    old = old_text.splitlines(keepends=True)
    new = new_text.splitlines(keepends=True)
    py = c == "#"

    sample, old, _ = merge_imports(sample, old, new, chapter, c, py, reports)

    old_strings = string_spans(old) if py else []
    new_strings = string_spans(new) if py else []
    sample_strings = string_spans(sample) if py else []

    # 本体の旧 → samples の行の対応(一致するブロックだけ)
    to_sample: dict[int, int] = {}
    for a, b, size in difflib.SequenceMatcher(None, old, sample, autojunk=False).get_matching_blocks():
        for k in range(size):
            to_sample[a + k] = b + k

    def sample_index(i: int) -> int:
        """本体の旧の行 i の位置に当たる samples の位置(i が末尾なら末尾)。"""
        if i in to_sample:
            return to_sample[i]
        # 前の対応のある行の次
        j = i - 1
        while j >= 0 and j not in to_sample:
            j -= 1
        return to_sample[j] + 1 if j >= 0 else 0

    def op_start(tag: str, i1: int) -> int:
        """op を当てる samples の位置。挿入は直前の行のすぐ後(samples だけにある次の行の履歴タグより前)。"""
        if tag == "insert" and i1 - 1 in to_sample:
            return to_sample[i1 - 1] + 1
        return sample_index(i1)

    ops = slide(old, new, difflib.SequenceMatcher(None, old, new, autojunk=False).get_opcodes())
    jsx: set[int] = set()
    if tsx:
        try:
            jsx, _ = ts_info("".join(sample), "sample.tsx", sorted({op_start(op[0], op[1]) for op in ops}))
        except TsUnavailable as e:
            reports.append(f"-- 要手当て(JSX): 構文木を読めないので JSX の子の位置も `{c}` で入れた({e})")
    edits = []
    for tag, i1, i2, j1, j2 in ops:
        start = op_start(tag, i1)
        end = sample_index(i2 - 1) + 1 if i2 > i1 else start
        missing = i2 > i1 and any(i not in to_sample for i in range(i1, i2))
        old_lines, new_lines = old[i1:i2], new[j1:j2]
        in_string = py and (
            cuts(old_strings, i1, i2) or cuts(new_strings, j1, j2) or cuts(sample_strings, start, end)
        )
        local_import = py and all(is_import(x) or not x.strip() for x in old_lines + new_lines)
        if in_string:
            name = enclosing_name(new_text, j1 if j2 > j1 else max(j1 - 1, 0))
            note = f"記録の行の案(ヘッダーの後へ): {c} Phase-{chapter}：更新(docstring: {name} …)"
            if missing:
                # samples の文字列が本体とずれている。当てると文字列の閉じがずれて構文を壊しうるので当てない
                text = "".join(new_lines).rstrip("\n")
                reports.append(f"-- 要手当て(docstring。samples とずれているので当てていない): 旧{i1 + 1}〜{i2}。"
                               f"{note}。新の行:\n{text}")
                continue
            reports.append(f"-- 要手当て(docstring): 旧{i1 + 1}〜{i2} {tag}。{note}")
            body = new_lines
        elif local_import:
            if missing:
                reports.append(f"!! 旧の行が samples に見つからない: 旧{i1 + 1}〜{i2}")
            reports.append(f"-- 要手当て(関数の中の import。タグなし): 旧{i1 + 1}〜{i2} {tag}")
            body = new_lines
        else:
            if missing:
                reports.append(f"!! 旧の行が samples に見つからない: 旧{i1 + 1}〜{i2}")
            lead: list[str] = []
            if tag == "insert":
                while new_lines and not new_lines[0].strip():
                    lead.append(new_lines[0])
                    new_lines = new_lines[1:]
            ref = next((x for x in (new_lines or old_lines) if x.strip()), "\n")
            ind = indent_of(ref)

            def note(text: str, ind: str = ind, in_jsx: bool = start in jsx) -> str:
                if in_jsx:
                    return f"{ind}{jsx_comment(text)}\n"
                return f"{ind}{c} {text}\n" if text else f"{ind}{c}\n"

            def comment(line: str, ind: str = ind, note: Callable[[str], str] = note) -> str:
                text = line.rstrip("\n")
                return note(text[len(ind) :] if text.startswith(ind) else text.strip())

            if tag == "insert":
                body = [*lead, note(f"Phase-{chapter}:追記"), *new_lines]
            elif tag == "delete":
                body = [note(f"Phase-{chapter}：削除"), *map(comment, old_lines)]
            else:
                body = [note(f"Phase-{chapter}：更新"), *map(comment, old_lines), note("↓↓"), *new_lines]
        edits.append((start, end, body))
    for start, end, body in sorted(edits, key=lambda e: e[0], reverse=True):
        sample[start:end] = body
    sample = update_header(sample, chapter, c)
    return "".join(sample), reports


def main() -> int:
    sample_path, old_path, new_path, chapter, c = sys.argv[1:6]
    with open(sample_path) as f:
        sample = f.read()
    with open(old_path) as f:
        old = f.read()
    with open(new_path) as f:
        new = f.read()
    suffix = Path(sample_path).suffix
    result, reports = merge(sample, old, new, chapter, c, tsx=suffix == ".tsx")
    for line in reports:
        print(f"{line} ({sample_path})", file=sys.stderr)
    with open(sample_path, "w") as f:
        f.write(result)
    errors: list[tuple[int | None, str]] = []
    if c == "#":
        try:
            ast.parse(result)
        except SyntaxError as e:
            errors.append((e.lineno, e.msg))
    elif suffix in (".ts", ".tsx"):
        try:
            errors += ts_info(result, f"sample{suffix}", [])[1]
        except TsUnavailable as e:
            print(f"-- 要手当て(構文): 構文木を読めないので確かめていない({e}) ({sample_path})", file=sys.stderr)
    for lineno, msg in errors:
        print(f"!! 構文エラー: {sample_path}:{lineno} {msg}", file=sys.stderr)
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
