"""教材・記録の Markdown の相対リンク切れを列挙する(CLAUDE.md #26)。

使い方: python3 textbook/tools/link_check.py

- 対象: textbook/**/*.md、CLAUDE.md、README.md、docs/*.md。
- `http:` 等のスキームを持つリンクと、ページ内アンカー(`#...`)だけのリンクは見ない。
- コードブロック・インラインコードの中は見ない(書き方の例を誤検知しないため)。
- リンク切れが1件でもあれば終了コード 1。
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

# [表示名](リンク先)。表示名は角括弧を、リンク先は丸括弧を1段まで含められる
# (例: `[id]`・`(pages)` を含むパス)
LINK = re.compile(r"\[(?:[^\[\]]|\[[^\[\]]*\])*\]\(((?:[^()\s]|\([^()\s]*\))+)\)")


def targets() -> list[Path]:
    files = sorted((ROOT / "textbook").rglob("*.md"))
    files += [ROOT / "CLAUDE.md", ROOT / "README.md"]
    files += sorted((ROOT / "docs").glob("*.md"))
    return [f for f in files if f.is_file()]


def strip_code(text: str) -> str:
    text = re.sub(r"(?ms)^\s*```.*?^\s*```", "", text)
    return re.sub(r"`[^`\n]*`", "", text)


def main() -> int:
    total = 0
    broken: list[tuple[Path, str]] = []
    for md in targets():
        for url in LINK.findall(strip_code(md.read_text())):
            url = url.strip("<>")
            if re.match(r"[a-z][a-z0-9+.-]*:", url) or url.startswith("#"):
                continue
            total += 1
            path = url.split("#", 1)[0]
            if not (md.parent / path).exists():
                broken.append((md, url))
    for md, url in broken:
        print(f"{md.relative_to(ROOT)}: {url}")
    print(f"リンク {total} 件 / 切れ {len(broken)} 件")
    return 1 if broken else 0


if __name__ == "__main__":
    sys.exit(main())
