"""tagmerge.merge のテスト。merge は純粋関数なのでスタブは使わない(文字列を渡して結果を見る)。

実行: devex-api/backend/.venv/bin/python -m pytest textbook/tools/test_tagmerge.py
"""

import ast
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from tagmerge import merge


def lines(*xs: str) -> str:
    return "".join(f"{x}\n" for x in xs)


# ── 既存の追記・更新・削除 ──


def test_insert_update_delete_keep_tags():
    old = lines("def f():", "    a = 1", "    b = 2", "    return a")
    new = lines("def f():", "    a = 10", "    return a", "", "def g():", "    pass")
    sample = lines("# 作成：Phase-1-1", *old.splitlines())
    result, reports = merge(sample, old, new, "2-1", "#")
    assert "    # Phase-2-1：更新\n    # a = 1\n    # b = 2\n    # ↓↓\n    a = 10\n" in result
    assert "# Phase-2-1:追記\ndef g():" in result
    assert reports == []
    ast.parse(result)


def test_no_change_leaves_sample_untouched():
    sample = lines("# 作成：Phase-1-1", "x = 1")
    assert merge(sample, "x = 1\n", "x = 1\n", "2-1", "#") == (sample, [])


# ── ① ヘッダー ──


def run_header(header: str | None) -> str:
    old, new = lines("x = 1"), lines("x = 1", "y = 2")
    sample = (lines(header) if header else "") + old
    return merge(sample, old, new, "3-2", "#")[0].splitlines()[0]


def test_header_created_only_gets_update():
    assert run_header("# 作成：Phase-1-1") == "# 作成：Phase-1-1｜更新：Phase-3-2"


def test_header_update_list_is_appended():
    assert run_header("# 作成：Phase-1-1｜更新：Phase-2-1,88(完了後の調整)") == (
        "# 作成：Phase-1-1｜更新：Phase-2-1,88(完了後の調整),3-2"
    )


def test_header_already_has_chapter():
    assert run_header("# 更新：Phase-3-2") == "# 更新：Phase-3-2"


def test_header_missing_is_inserted():
    assert run_header(None) == "# 更新：Phase-3-2"


def test_header_ts():
    old, new = lines("const a = 1;"), lines("const a = 1;", "const b = 2;")
    result, _ = merge(lines("// 作成：Phase-5-1", "const a = 1;"), old, new, "6-1", "//")
    assert result.startswith("// 作成：Phase-5-1｜更新：Phase-6-1\n")


# ── ② import の集約 ──

PY_OLD = lines(
    '"""モジュールの説明。"""',
    "",
    "import uuid",
    "from collections.abc import Sequence",
    "",
    "from app.a import A",
    "",
    "",
    "def f():",
    "    return A",
)


def test_python_import_added_and_removed_go_to_one_line_before_block():
    new = PY_OLD.replace("from collections.abc import Sequence", "from collections.abc import Mapping").replace(
        "from app.a import A\n", "from app.a import A, B\nfrom app.c import C as D\n"
    )
    sample = "# 作成：Phase-1-1\n" + PY_OLD.replace("import uuid", "# Phase-1-2:追記 ── app.a.A\nimport uuid")
    result, reports = merge(sample, PY_OLD, new, "4-1", "#")
    out = result.splitlines()
    i = out.index("import uuid")
    assert out[i - 3 : i] == [
        "# Phase-1-2:追記 ── app.a.A",
        "# Phase-4-1:追記 ── collections.abc.Mapping, app.a.B, app.c.C",
        "# Phase-4-1：削除 ── collections.abc.Sequence",
    ]
    assert "from app.c import C as D" in out
    assert not any("要手当て" in r for r in reports)
    assert "：更新" not in result
    ast.parse(result)


def test_python_import_reorder_only_has_no_tag_but_header():
    new = PY_OLD.replace("import uuid\nfrom collections.abc import Sequence\n", "from collections.abc import Sequence\nimport uuid\n")
    result, _ = merge("# 作成：Phase-1-1\n" + PY_OLD, PY_OLD, new, "4-1", "#")
    assert "Phase-4-1:" not in result and "Phase-4-1：" not in result
    assert result.startswith("# 作成：Phase-1-1｜更新：Phase-4-1\n")
    assert "from collections.abc import Sequence\nimport uuid\n" in result


def test_python_type_checking_block_counts_as_imports():
    old = lines("from typing import TYPE_CHECKING", "", "if TYPE_CHECKING:", "    from app.p import P", "", "x = 1")
    new = old.replace("    from app.p import P\n", "    from app.p import P\n    from app.q import Q\n")
    result, _ = merge("# 作成：Phase-1-1\n" + old, old, new, "4-2", "#")
    assert "# Phase-4-2:追記 ── app.q.Q\nfrom typing import TYPE_CHECKING" in result


def test_python_old_commented_imports_in_sample_block_are_moved_above():
    old = lines("from app.a import A", "from app.b import B", "", "x = 1")
    sample = lines("# 作成：Phase-1-1", "from app.a import A", "# Phase-2-1：削除", "# from app.z import Z", "from app.b import B", "", "x = 1")
    new = lines("from app.a import A", "from app.b import B", "from app.c import C", "", "x = 1")
    result, _ = merge(sample, old, new, "4-3", "#")
    assert result == lines(
        "# 作成：Phase-1-1｜更新：Phase-4-3",
        "# Phase-2-1：削除",
        "# from app.z import Z",
        "# Phase-4-3:追記 ── app.c.C",
        "from app.a import A",
        "from app.b import B",
        "from app.c import C",
        "",
        "x = 1",
    )


def test_local_import_is_reported():
    old = lines("def f():", "    import os", "    return os")
    new = lines("def f():", "    import os", "    import re", "    return os")
    _, reports = merge(old, old, new, "4-4", "#")
    assert any("関数の中の import" in r for r in reports)


def test_ts_imports():
    old = lines('"use client";', "", 'import { a } from "@/x";', 'import type { T } from "@/t";', "", "export const z = a;")
    new = lines(
        '"use client";',
        "",
        "import {",
        "  a,",
        "  b as bb,",
        '} from "@/x";',
        'import Y from "@/y";',
        "",
        "export const z = a;",
    )
    result, _ = merge("// 作成：Phase-5-1\n" + old, old, new, "6-2", "//")
    assert "// Phase-6-2:追記 ── @/x.b, @/y.Y\n// Phase-6-2：削除 ── @/t.T\nimport {\n" in result
    assert result.endswith("export const z = a;\n")


# ── ③ docstring ──

DOC_OLD = lines(
    "def f():",
    '    """一行目。',
    "",
    "    二行目。",
    '    """',
    "    return 1",
)


def test_change_inside_docstring_is_not_tagged():
    new = DOC_OLD.replace("    二行目。", "    二行目を直した。")
    result, reports = merge("# 作成：Phase-1-1\n" + DOC_OLD, DOC_OLD, new, "7-1", "#")
    assert "Phase-7-1：更新\n" not in result and "    二行目を直した。\n" in result
    assert any("docstring: f" in r for r in reports)
    ast.parse(result)


def test_change_after_docstring_is_tagged_outside():
    new = DOC_OLD.replace("    return 1", "    return 2")
    result, reports = merge("# 作成：Phase-1-1\n" + DOC_OLD, DOC_OLD, new, "7-2", "#")
    assert '    """\n    # Phase-7-2：更新\n    # return 1\n    # ↓↓\n    return 2\n' in result
    assert reports == []
    ast.parse(result)


def test_sample_docstring_drift_does_not_get_tags_inside():
    # samples の docstring が本体と違う(本体だけ直された)と、対応がずれて docstring の中に当たりうる
    sample = "# 作成：Phase-1-1\n" + DOC_OLD.replace("    二行目。", "    samples だけの行。\n    二行目。")
    new = DOC_OLD.replace('    """一行目。', '    """一行目を直した。')
    result, reports = merge(sample, DOC_OLD, new, "7-3", "#")
    assert "Phase-7-3：更新" not in result
    assert any("要手当て(docstring)" in r for r in reports)
    ast.parse(result)
