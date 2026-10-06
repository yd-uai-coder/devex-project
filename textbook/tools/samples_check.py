"""既存の samples と本体(devex-api / devex-ui)のコードが一致しているかを検査する(CLAUDE.md #21)。

使い方(Python 3.12 以降の構文を読むため、devex-api の venv で動かす):
    devex-api/backend/.venv/bin/python textbook/tools/samples_check.py [--api-ref REF] [--ui-ref REF] [-v]

- 対応: textbook/samples/backend/* ↔ devex-api/backend/*、textbook/samples/frontend/* ↔ devex-ui/*。
  frontend は Next.js の route group(`(xxx)/`)の有無の違いを吸収する。
- 本体は作業ツリーを読む。`--api-ref stage4` のように ref を渡すと `git show <ref>:<path>` で読む。
- 比べるのはコードだけ。#29 のタグ・コメントアウトした旧コード・コメント・docstring は無視する。
  Python は AST(docstring を除く)、TS/TSX はコメントを除いた行、toml・css はコメントと空行を除いた行、その他は空行を除いた行で比べる。
- 例外は samples_check_allow.txt に書く(1 行 = `samples のパス<TAB>本体のパス または -<TAB>理由`)。
- 行の集まりが同じで並び順だけが違うものは「並び順のみ差」として数え、失敗にしない。
- `--api-since REF` / `--ui-since REF` を渡すと、REF 以降に本体で追加・変更したソース(backend/app・backend/tests・
  backend/alembic・src・e2e)のうち、samples に無いものを「本体のみ」として数える(samples への作り忘れの検出。#21)。
- 不一致・samples のみ・本体のみが1件でもあれば終了コード 1。
"""

import argparse
import ast
import difflib
import re
import subprocess
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SAMPLES = ROOT / "textbook" / "samples"
API = ROOT / "devex-api"
UI = ROOT / "devex-ui"
ALLOW = Path(__file__).with_name("samples_check_allow.txt")


def git(*args: str, cwd: Path) -> str:
    return subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True, check=True).stdout


class Body:
    """本体の1リポジトリ。ref が None なら作業ツリーを読む。"""

    def __init__(self, repo: Path, ref: str | None) -> None:
        self.repo, self.ref = repo, ref
        listing = (
            git("ls-tree", "-r", "--name-only", ref, cwd=repo)
            if ref
            else git("ls-files", "--cached", "--others", "--exclude-standard", cwd=repo)
        )
        self.paths = {p for p in listing.splitlines() if p and (ref or (repo / p).exists())}
        self.ungrouped: dict[str, list[str]] = defaultdict(list)
        for p in self.paths:
            self.ungrouped[ungroup(p)].append(p)

    def find(self, path: str) -> str | None:
        if path in self.paths:
            return path
        candidates = self.ungrouped.get(ungroup(path), [])
        return candidates[0] if len(candidates) == 1 else None

    def read(self, path: str) -> str:
        if self.ref:
            return git("show", f"{self.ref}:{path}", cwd=self.repo)
        return (self.repo / path).read_text()


def ungroup(path: str) -> str:
    return re.sub(r"\([^/]*\)/", "", path)


def python_code(text: str) -> list[str]:
    tree = ast.parse(text)
    for node in ast.walk(tree):
        body = getattr(node, "body", None)
        if (
            isinstance(body, list)
            and body
            and isinstance(body[0], ast.Expr)
            and isinstance(body[0].value, ast.Constant)
            and isinstance(body[0].value.value, str)
        ):
            node.body = body[1:] or [ast.Pass()]
        # samples の __all__ は Phase ごとのタグでまとめ、本体は ruff で名前順にしている
        if (
            isinstance(node, ast.Assign)
            and [getattr(t, "id", None) for t in node.targets] == ["__all__"]
            and isinstance(node.value, ast.List)
        ):
            node.value.elts.sort(key=ast.unparse)
    lines = ast.unparse(tree).splitlines()
    # alembic のリビジョン ID は手で生成した samples と本体で異なる
    return [line for line in lines if not re.match(r"(revision|down_revision)(: .*)? = ", line)]


def ts_code(text: str) -> list[str]:
    text = re.sub(r"\{/\*.*?\*/\}", "", text, flags=re.S)
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    text = re.sub(r"(?m)(^|[ \t])//.*$", "", text)
    return [re.sub(r"\s+", " ", line.strip()) for line in text.splitlines() if line.strip()]


def code(path: str, text: str) -> list[str]:
    if path.endswith(".py"):
        return python_code(text)
    if path.endswith((".ts", ".tsx", ".mts")):
        return ts_code(text)
    if path.endswith(".toml"):
        text = re.sub(r"(?m)(^|[ \t])#.*$", "", text)
    if path.endswith(".css"):
        text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    return [line.rstrip() for line in text.splitlines() if line.strip()]


def load_allow() -> dict[str, tuple[str | None, str]]:
    allow: dict[str, tuple[str | None, str]] = {}
    for line in ALLOW.read_text().splitlines():
        if not line.strip() or line.startswith("#"):
            continue
        sample, body, reason = line.split("\t")
        allow[sample] = (None if body == "-" else body, reason)
    return allow


# 作り忘れを調べる本体のソースの範囲。インフラ・設定ファイルは samples に写さない(#21)
API_SOURCES = ("backend/app/", "backend/tests/", "backend/alembic/versions/")
UI_SOURCES = ("src/", "e2e/")


def changed_since(body: Body, since: str) -> list[str]:
    """since から本体(ref または作業ツリー)までに追加・変更されたファイルのパス。"""
    target = [body.ref] if body.ref else []
    names = git("diff", "--name-only", "--diff-filter=AMR", since, *target, cwd=body.repo).splitlines()
    if not body.ref:
        names += git("ls-files", "--others", "--exclude-standard", cwd=body.repo).splitlines()
    return sorted(set(names))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--api-ref", help="devex-api の ref(省略時は作業ツリー)")
    parser.add_argument("--ui-ref", help="devex-ui の ref(省略時は作業ツリー)")
    parser.add_argument("--api-since", help="この ref 以降に devex-api で変わったファイルの作り忘れを調べる")
    parser.add_argument("--ui-since", help="この ref 以降に devex-ui で変わったファイルの作り忘れを調べる")
    parser.add_argument("-v", "--verbose", action="store_true", help="不一致の差分を表示する")
    args = parser.parse_args()

    api, ui = Body(API, args.api_ref), Body(UI, args.ui_ref)
    allow = load_allow()
    listing = git("ls-files", "--cached", "--others", "--exclude-standard", "textbook/samples", cwd=ROOT)
    tracked = [p for p in listing.splitlines() if (ROOT / p).is_file()]

    result: Counter[str] = Counter()
    problems: list[tuple[str, str, list[str]]] = []
    for sample in tracked:
        rel = sample.removeprefix("textbook/samples/")
        side, sub = rel.split("/", 1)
        body, path = (api, "backend/" + sub) if side == "backend" else (ui, sub)
        if rel in allow:
            target, reason = allow[rel]
            result["例外"] += 1
            if target is None:
                continue
            path = target
        found = body.find(path)
        if found is None:
            result["samples のみ"] += 1
            problems.append(("samples のみ", sample, []))
            continue
        a = code(sample, (ROOT / sample).read_text())
        b = code(found, body.read(found))
        if a == b:
            result["一致"] += 1
        elif Counter(a) == Counter(b):
            # off の Phase で手で写経したときの並べ替え。意味の差ではないので失敗にしない
            result["並び順のみ差"] += 1
            if args.verbose:
                print(f"並び順のみ差: {sample}")
        else:
            result["不一致"] += 1
            diff = [d for d in difflib.unified_diff(a, b, "samples", "本体", lineterm="", n=1)]
            problems.append(("不一致", sample, diff))

    samples_api = {p.removeprefix("textbook/samples/") for p in tracked if p.startswith("textbook/samples/backend/")}
    samples_ui = {ungroup(p.removeprefix("textbook/samples/frontend/")) for p in tracked if p.startswith("textbook/samples/frontend/")}
    for since, body, prefixes, has_sample in (
        (args.api_since, api, API_SOURCES, lambda p: p in samples_api),
        (args.ui_since, ui, UI_SOURCES, lambda p: ungroup(p) in samples_ui),
    ):
        if not since:
            continue
        for path in changed_since(body, since):
            if path.startswith(prefixes) and path in body.paths and not has_sample(path):
                result["本体のみ"] += 1
                problems.append(("本体のみ", f"{body.repo.name}/{path}", []))

    for kind, sample, diff in problems:
        print(f"{kind}: {sample}")
        if args.verbose:
            for line in diff:
                print("    " + line)
    print(" / ".join(f"{k} {v}" for k, v in sorted(result.items())))
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
