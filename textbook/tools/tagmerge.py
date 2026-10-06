"""本体の変更(HEAD → 作業ツリー)を、タグ付きで samples のファイルに当てる(#29 の形式)。

使い方: python3 textbook/tools/tagmerge.py <samples のファイル> <本体の旧(HEAD)> <本体の新> <章 例 25-1> <コメント記号 # か //>

本体の旧は `git -C devex-api show HEAD:backend/app/foo.py > /tmp/old.py` のように取り出して渡す。

- 追記: 追加行の直前に `<c> Phase-N-n:追記`
- 更新: `<c> Phase-N-n：更新` + 旧行のコメントアウト + `<c> ↓↓` + 新行
- 削除: `<c> Phase-N-n：削除` + 旧行のコメントアウト
- 複数行の文字列(docstring)の中・import 文はタグを付けずにそのまま当て、標準エラーに「要手当て」と出す。
"""

import difflib
import io
import sys
import tokenize


def string_lines(lines: list[str]) -> set[int]:
    """複数行の文字列トークンが占める行(0始まり)。Python だけ。"""
    inside: set[int] = set()
    try:
        tokens = tokenize.generate_tokens(io.StringIO("".join(lines)).readline)
        for tok in tokens:
            if tok.type == tokenize.STRING and tok.start[0] != tok.end[0]:
                inside.update(range(tok.start[0] - 1, tok.end[0]))
    except (tokenize.TokenError, IndentationError, SyntaxError):
        pass
    return inside


def is_import(line: str) -> bool:
    s = line.strip()
    return s.startswith(("from ", "import ")) or (
        s.endswith(",") and s.replace(",", "").replace("_", "").replace(" ", "").isalnum()
    ) or s in (")",) or s.endswith("import (")


def indent_of(line: str) -> str:
    return line[: len(line) - len(line.lstrip())]


def main() -> None:
    sample_path, old_path, new_path, chapter, c = sys.argv[1:6]
    sample = open(sample_path).read().splitlines(keepends=True)
    old = open(old_path).read().splitlines(keepends=True)
    new = open(new_path).read().splitlines(keepends=True)
    py = c == "#"
    strings = string_lines(old) if py else set()

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

    ops = difflib.SequenceMatcher(None, old, new, autojunk=False).get_opcodes()
    edits = []
    for tag, i1, i2, j1, j2 in ops:
        if tag == "equal":
            continue
        start = sample_index(i1)
        end = sample_index(i2 - 1) + 1 if i2 > i1 else start
        if i2 > i1 and any(i not in to_sample for i in range(i1, i2)):
            print(f"!! 旧の行が samples に見つからない: {old_path}:{i1 + 1}", file=sys.stderr)
        old_lines, new_lines = old[i1:i2], new[j1:j2]
        plain = any(i in strings for i in range(max(i1 - 1, 0), i2 + 1)) or (
            py and all(is_import(l) or not l.strip() for l in old_lines + new_lines)
        )
        if plain:
            print(f"-- 要手当て(タグなし): {sample_path} 旧{i1 + 1}〜{i2} {tag}", file=sys.stderr)
            body = new_lines
        else:
            lead: list[str] = []
            if tag == "insert":
                while new_lines and not new_lines[0].strip():
                    lead.append(new_lines[0])
                    new_lines = new_lines[1:]
            ref = next((l for l in (new_lines or old_lines) if l.strip()), "\n")
            ind = indent_of(ref)

            def comment(line: str) -> str:
                text = line.rstrip("\n")
                if not text.strip():
                    return f"{ind}{c}\n"
                return f"{ind}{c} {text[len(ind):] if text.startswith(ind) else text.lstrip()}\n"

            if tag == "insert":
                body = [*lead, f"{ind}{c} Phase-{chapter}:追記\n", *new_lines]
            elif tag == "delete":
                body = [f"{ind}{c} Phase-{chapter}：削除\n", *map(comment, old_lines)]
            else:
                body = [
                    f"{ind}{c} Phase-{chapter}：更新\n",
                    *map(comment, old_lines),
                    f"{ind}{c} ↓↓\n",
                    *new_lines,
                ]
        edits.append((start, end, body))
    for start, end, body in sorted(edits, key=lambda e: e[0], reverse=True):
        sample[start:end] = body
    open(sample_path, "w").write("".join(sample))


main()
