"""ステージ7の効果測定(Phase 49-1): ベースラインと同じシナリオを、実装した仕組みで測る。

    PYTHONPATH=devex-api/backend uv run --project devex-api/backend \
        python appendix/stage7-effect/impact/measure.py

ベースライン(../../stage7-baseline/measure.py)のグラフ・シナリオ・正解・4つの方式をそのまま使い、
方式を2つ足す。正解は付け直さない。

1. 実装(たどり方): 本体の要素(`build_elements`・`build_simple_elements`)に、シナリオの変わった
   要素を`Change`として渡し、`impact_of`の結果をベースラインのキーに戻して比べる。ベースラインの
   方式と同じく、文書の要素(要件・画面・API)も数える。
2. 実装(印): シナリオの変更を model に当て(文書の行・段階の行・ER の列を書き換える)、本体と同じ
   「前後の要素の差分 → `marks_for`」で印を求める。画面に出る形。文書の要素には印を付けない
   (変えた人が見ているため)ので、正解のうち文書の要素は別に数える。

材料は stage6-effect の1回目の段階の JSON と、export_models.py が DB から書き出した文書の model。

Phase 49-4 で本体のたどり方を直した(B・C・D・G)ので、「実装」の2つの方式は直した後の本体の数字に
なる。49-1 の時点の出力(直す前の本体と、候補 A〜D の試算)は results-49-1.md に残した。比較の方式は
「実装 + A」(stage6-effect の段階7は Phase 42 より前の生成物で、横断事項が req_ids を持たないため、
今の生成で LLM が付ける req_ids を補ったもの)だけを残した。
"""

import copy
import importlib.util
import json
import sys
from collections.abc import Callable
from pathlib import Path
from typing import Any

from app.detailed_design.api_list import endpoint_key
from app.detailed_design.data_model import er_table_definitions, table_key
from app.detailed_design.impact import (
    DOCUMENT_STAGE,
    Change,
    DesignModels,
    Element,
    SimpleModels,
    build_elements,
    build_simple_elements,
    diff_elements,
    impact_of,
    marks_for,
)
from app.detailed_design.logic import logic_key
from app.detailed_design.plan import PlanModel
from app.detailed_design.procedure_doc import plan_units
from app.detailed_design.simple_procedure.internal_design import parse_internal_design
from app.detailed_design.simple_procedure.wbs import parse_wbs
from app.documents.implementation_plan.model import ImplementationPlanModel
from app.documents.internal_design.model import (
    DataFlowRow,
    FlowRow,
    InternalDesignModel,
    TableDef,
)

HERE = Path(__file__).resolve().parent
APPENDIX = HERE.parent.parent
BASE_DIR = APPENDIX / "stage7-baseline"
SRC = APPENDIX / "stage6-effect"


def _load_baseline():
    """ベースラインの measure.py を別名で読む(同じファイル名のため)。"""
    spec = importlib.util.spec_from_file_location("baseline_measure", BASE_DIR / "measure.py")
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules["baseline_measure"] = module
    spec.loader.exec_module(module)
    return module


base = _load_baseline()
from scenarios import SCENARIOS, Scenario  # noqa: E402  (base が sys.path に足す)

# ---------------------------------------------------------------- 材料


def load_data(mode: str) -> dict[str, Any]:
    return json.loads((HERE / "data" / f"{mode}.json").read_text())


def check_same_as_stage6(data: dict[str, Any]) -> list[str]:
    """DB から書き出した段階の model が、stage6-effect の JSON と同じか(単位のキーを除く)。"""

    def strip(value: Any) -> Any:
        if isinstance(value, dict):
            return {
                k: strip(v)
                for k, v in value.items()
                if k not in ("key", "unit_key", "next_unit_seq")
            }
        if isinstance(value, list):
            return [strip(v) for v in value]
        return value

    diffs = []
    for n, model in data["stages"].items():
        path = SRC / "detailed" / "stages" / f"stage{n}.json"
        if path.exists() and strip(json.loads(path.read_text())["model"]) != strip(model):
            diffs.append(f"段階{n}")
    return diffs


def simple_documents(data: dict[str, Any]) -> dict[str, Any]:
    """簡易モードの4文書の model。内部設計書・実装計画書は model の無い版なので、md の解析
    (段階8が model の無い版で使うもの)から、要素に要る欄だけの model を作る。"""
    internal_md = (SRC / "simple" / "internal_design.md").read_text()
    external_md = (SRC / "simple" / "external_design.md").read_text()
    book = parse_internal_design(internal_md, external_md)
    internal = InternalDesignModel(
        tables=[TableDef(name=name) for name in book.tables],
        modules=list(book.modules.values()),
        # DF の本文は md のまま1行に入れる(本文に名前の出るテーブルを参照にするため)
        dataflows=[
            DataFlowRow(id=df.id, trigger=df.title, flows=[FlowRow(source=df.markdown)])
            for df in book.dataflows.values()
        ],
    )
    wbs = parse_wbs((SRC / "simple" / "implementation_plan.md").read_text())
    plan = ImplementationPlanModel(milestones=wbs.plan.milestones, environment=wbs.plan.environment)
    return {
        **data["documents"],
        "internal_design": internal.model_dump(mode="json"),
        "implementation_plan": plan.model_dump(mode="json"),
    }


# ---------------------------------------------------------------- キーの対応


def key_map(g: Any, plan: PlanModel | None) -> dict[str, str]:
    """ベースラインのグラフのキー → 本体の要素のキー。対応の無いもの(リスク)は含めない。"""
    unit_key = {u.unit_id: u.key for u in plan_units(plan)} if plan is not None else {}
    out: dict[str, str] = {}
    for k in g.stage_of:
        head, _, rest = k.partition(" ")
        if k.startswith(("FR-", "NFR-", "CON-")):
            out[k] = f"req:{k}"
        elif k.startswith("SCR-"):
            out[k] = f"screen:{k}"
        elif k.startswith("F-"):
            out[k] = f"fn:{k}"
        elif head == "API":
            out[k] = f"api:{rest}"
        elif head == "DFD":
            out[k] = f"summary:{rest}"
        elif head == "TABLE":
            out[k] = f"table:{table_key(rest)}"
        elif head == "CRUD":
            fid, _, table = rest.partition("×")
            out[k] = f"crud:{fid}×{table_key(table)}"
        elif head == "MOD":
            out[k] = f"module:{rest}"
        elif head == "PROC":
            out[k] = f"proc:{rest}"
        elif head == "LOGIC":
            module, _, function = rest.partition(":")
            out[k] = f"logic:{logic_key(module, function)}"
        elif head == "CC":
            out[k] = f"cc:{rest}"
        elif head in ("TASK", "UNIT"):
            out[k] = f"{head.lower()}:{unit_key.get(rest, rest)}"
    return out


# ---------------------------------------------------------------- シナリオの変更を model に当てる

Models = dict[str, Any]  # {"stages": {n: model}, "documents": {...}, "er": {...}}
Edit = Callable[[Models], tuple[str, int]]  # 書き換えて (出どころ, 差分を取る置き場) を返す


def _req(models: Models, req_id: str, text: str) -> None:
    for row in models["documents"]["requirements"]["rows"]:
        if row["id"] == req_id:
            row["text"] = text
            return
    raise KeyError(req_id)


def _api(models: Models, method: str, path: str, field: str, extra: str) -> None:
    for api in models["documents"]["external_design"]["apis"]:
        if endpoint_key(api["method"], api["path"]) == endpoint_key(method, path):
            api[field] = f"{api[field]}, {extra}"
            return
    raise KeyError(path)


def _er_column(models: Models, table: str, column: str) -> None:
    for element in models["er"]["elements"]:
        if element["name"] == table:
            element["columns"].append({"name": column, "type": "VARCHAR(32)", "nullable": False})
            return
    raise KeyError(table)


def _function(models: Models, fid: str, summary: str) -> None:
    for row in models["stages"]["1"]["functions"]:
        if row["id"] == fid:
            row["summary"] = summary
            return
    raise KeyError(fid)


def _rename_module(models: Models, old: str, new: str) -> None:
    for row in models["stages"]["4"]["modules"]:
        if row["path"] == old:
            row["path"] = new
            return
    raise KeyError(old)


def _task_module(models: Models, unit_id: str, module: str) -> None:
    plan = models["documents"]["implementation_plan"]
    for m, milestone in enumerate(plan["milestones"], start=1):
        for t, task in enumerate(milestone["tasks"], start=1):
            if f"M-{m:02d}-T{t:02d}" == unit_id:
                task["modules"].append(module)
                return
    raise KeyError(unit_id)


EDITS: dict[str, Edit] = {
    "S1": lambda m: (
        _req(m, "FR-011", "AI 応答の失敗時は自動で3回まで再試行し、だめなら再送を促す。"),
        ("doc:requirements", DOCUMENT_STAGE),
    )[1],
    "S2": lambda m: (
        _req(m, "NFR-007", "ログインを必須とし、他人のプロジェクトへのアクセスは 404 を返す。"),
        ("doc:requirements", DOCUMENT_STAGE),
    )[1],
    # S3 は「採用にする」。版を上げず、変更を記録しない(adopt_requirement)
    "S4": lambda m: (
        _api(m, "POST", "/api/v1/chats", "body", "model"),
        ("doc:external_design", DOCUMENT_STAGE),
    )[1],
    "S5": lambda m: (
        _function(m, "F-03", "指定した1種類の設計書を生成し、自己診断を実行する。"),
        ("stage:1", 1),
    )[1],
    "S6": lambda m: (_er_column(m, "documents", "doc_type"), ("stage:3", 3))[1],
    "S7": lambda m: (
        _rename_module(m, "services/chat.py", "services/chat_service.py"),
        ("stage:4", 4),
    )[1],
    "S8": lambda m: (
        _task_module(m, "M-04-T01", "app/services/export.py"),
        ("doc:implementation_plan", DOCUMENT_STAGE),
    )[1],
    "N1": lambda m: (_er_column(m, "references", "file_type"), ("stage:3", 3))[1],
    "N2": lambda m: (
        _req(m, "FR-005", "参考資料のファイルを最大5件までアップロードできる。"),
        ("doc:requirements", DOCUMENT_STAGE),
    )[1],
    "N3": lambda m: (
        _api(m, "GET", "/api/v1/documents/{id}", "response", "version"),
        ("doc:external_design", DOCUMENT_STAGE),
    )[1],
    "N4": lambda m: (
        _req(m, "FR-005", "参考資料のファイルを最大5件までアップロードできる。"),
        ("doc:requirements", DOCUMENT_STAGE),
    )[1],
}


def elements_of(mode: str, models: Models) -> list[Element]:
    stages = {int(n): v for n, v in models["stages"].items()}
    if mode == "simple":
        return build_simple_elements(SimpleModels.from_dicts(stages.get(8), models["documents"]))
    er = er_table_definitions(models["er"])
    return build_elements(DesignModels.from_dicts(stages, models["documents"], er))


def marks_of(scenario: Scenario, models: Models) -> tuple[set[str], list[str]]:
    """シナリオの変更を当てた後の印(本体のキー)と、差分で見つかった変わったもの。"""
    edit = EDITS.get(scenario.id)
    if edit is None:
        return set(), []
    before = elements_of(scenario.mode, models)
    after_models = copy.deepcopy(models)
    source, stage = edit(after_models)
    after = elements_of(scenario.mode, after_models)
    changes = diff_elements(before, after, stages=(stage,))
    marks = marks_for(before, after, changes, source)
    return {m.key for m in marks}, [f"{c.change} {c.key}" for c in changes]


def rename_followup(models: Models) -> list[str]:
    """S7 の続き(Phase 43 の申し送り): 改名を承認した後、段階5の手順の呼び出し先を新しいパスに
    直して段階5を承認したときに付く印。改名で付いた印を見直した後なので、どれも過剰にあたる。"""
    renamed = copy.deepcopy(models)
    _rename_module(renamed, "services/chat.py", "services/chat_service.py")
    before = elements_of("detailed", renamed)
    after_models = copy.deepcopy(renamed)
    for procedure in after_models["stages"]["5"]["procedures"]:
        for step in procedure["steps"]:
            if step.get("callee") == "services/chat.py":
                step["callee"] = "services/chat_service.py"
    after = elements_of("detailed", after_models)
    changes = diff_elements(before, after, stages=(5,))
    marks = marks_for(before, after, changes, "stage:5")
    return [f"{c.change} {c.key}" for c in changes] + [f"印 {m.key}" for m in marks]


# ---------------------------------------------------------------- 集計


def compare(shown: set[str], truth: set[str]) -> dict[str, Any]:
    return {
        "shown": len(shown),
        "hit": len(shown & truth),
        "over": len(shown - truth),
        "miss": sorted(truth - shown),
        "over_items": sorted(shown - truth),
    }


def evaluate(
    scenario: Scenario,
    g: Any,
    models: Models,
    elements: list[Element],
    to_impl: dict[str, str],
) -> dict[str, Any]:
    result = base.evaluate(scenario, g)
    to_base = {v: k for k, v in to_impl.items()}
    truth = set(scenario.truth)
    unmapped_truth = sorted(k for k in truth if k not in to_impl)

    def back(keys: set[str]) -> set[str]:
        # 本体にだけ在る要素は、キーに「実装:」を付けて過剰に数える
        return {to_base.get(k, f"実装:{k}") for k in keys}

    shown: set[str] = set()
    for key in scenario.changed:
        kind = "rename" if scenario.id == "S7" else "content"
        if scenario.id == "S3":
            break  # 「採用にする」は変更を記録しない
        shown |= {item.key for item in impact_of(elements, Change(to_impl[key], kind))}
    result["impl_trace"] = compare(back(shown) - set(scenario.changed), truth)

    marked, changes = marks_of(scenario, models)
    stage_of = {e.key: e.stage for e in elements}
    doc_truth = {k for k in truth if stage_of.get(to_impl.get(k, ""), -1) == DOCUMENT_STAGE}
    result["impl_marks"] = compare(back(marked), truth - doc_truth)
    result["impl_marks"]["doc_truth"] = sorted(doc_truth)
    result["impl_marks"]["changes"] = changes
    result["unmapped_truth"] = unmapped_truth
    for name, rule in VARIANTS.items():
        variant = rule(scenario, models, to_impl)
        result[name] = compare(back(variant) - set(scenario.changed), truth)
    return result


# ---------------------------------------------------------------- 直しの候補(比較用。本体は変えない)

# 横断事項の方針の文が、要件の文をそのまま写しているもの(段階7の下書きが req_ids を付ける対象)
CROSSCUTTING_REQS = {"認証": ["NFR-007"], "ログ": ["NFR-005"]}


def with_crosscutting_reqs(models: Models) -> Models:
    """候補A: 段階7の横断事項に req_ids を補う(stage6-effect は Phase 42 より前の生成物で持たない)。"""
    out = copy.deepcopy(models)
    if "7" in out["stages"]:
        for row in out["stages"]["7"]["crosscutting"]:
            row["req_ids"] = CROSSCUTTING_REQS.get(row["topic"], [])
    return out


def _trace(scenario: Scenario, elements: list[Element], to_impl: dict[str, str]) -> list:
    if scenario.id == "S3":
        return []
    kind = "rename" if scenario.id == "S7" else "content"
    return [i for key in scenario.changed for i in impact_of(elements, Change(to_impl[key], kind))]


def variant_a(scenario: Scenario, models: Models, to_impl: dict[str, str]) -> set[str]:
    elements = elements_of(scenario.mode, with_crosscutting_reqs(models))
    return {i.key for i in _trace(scenario, elements, to_impl)}


VARIANTS = {"cand_a": variant_a}


NAMES = {
    "current": "今の仕組み",
    "graph_direct": "グラフ(直接)",
    "graph_closure": "グラフ(全部)",
    "function_scoped": "処理を軸(試案)",
    "impl_trace": "実装(たどり方)",
    "impl_marks": "実装(印)",
    "cand_a": "実装 + A(横断事項に req_ids)",
}


def totals(rows: list[dict[str, Any]], key: str) -> dict[str, Any]:
    shown = sum(r[key]["shown"] for r in rows)
    hit = sum(r[key]["hit"] for r in rows)
    miss = sum(len(r[key]["miss"]) for r in rows)
    return {"shown": shown, "hit": hit, "rate": (shown - hit) / shown if shown else 0, "miss": miss}


def to_markdown(results: list[dict[str, Any]], notes: list[str], followup: list[str]) -> str:
    lines = [
        "# ステージ7の効果測定の結果(シナリオ)",
        "",
        "`measure.py` の出力(手で書き換えない)。読み方は [README](./README.md)。",
        "",
        "## 材料の確認",
        "",
        *[f"- {n}" for n in notes],
        "",
        "## シナリオごとの比較",
        "",
        "「示した / 当たり / 過剰 / 見落とし」。正解はベースラインのまま(付け直さない)。"
        "実装(印)の正解は、文書の要素を除いた数。",
        "",
        "| シナリオ | 正解 | 今の仕組み | 処理を軸(試案) | 実装(たどり方) | 実装(印) | 実装 + A |",
        "|---|---|---|---|---|---|---|",
    ]

    def cell(c: dict[str, Any]) -> str:
        return f"{c['shown']} / {c['hit']} / {c['shown'] - c['hit']} / {len(c['miss'])}"

    for r in results:
        marks_truth = r["truth"] - len(r["impl_marks"]["doc_truth"])
        lines.append(
            f"| {r['id']} {r['title']} | {r['truth']}(印 {marks_truth}) | {cell(r['current'])} "
            f"| {cell(r['function_scoped'])} | {cell(r['impl_trace'])} | {cell(r['impl_marks'])} "
            f"| {cell(r['cand_a'])} |"
        )
    for group, heading in (("base", "合計(S1〜S8)"), ("holdout", "合計(N1〜N4)")):
        rows = [r for r in results if r["group"] == group]
        lines += [
            "",
            f"## {heading}",
            "",
            f"正解の合計: {sum(r['truth'] for r in rows)}"
            f"(うち文書の要素 {sum(len(r['impl_marks']['doc_truth']) for r in rows)})",
            "",
            "| 方式 | 示した | 当たり | 過剰の割合 | 見落とし |",
            "|---|---|---|---|---|",
        ]
        for key, name in NAMES.items():
            t = totals(rows, key)
            lines.append(f"| {name} | {t['shown']} | {t['hit']} | {t['rate']:.0%} | {t['miss']} |")
        if group == "base":
            # S2 は範囲の外とした(Phase 49-4 の決定)。判定は S2 を除いて数える
            rest = [r for r in rows if r["id"] != "S2"]
            lines += [
                "",
                "S2 を除く(判定に使う):",
                "",
                "| 方式 | 示した | 当たり | 過剰の割合 | 見落とし |",
                "|---|---|---|---|---|",
            ]
            for key in ("impl_trace", "impl_marks", "cand_a"):
                t = totals(rest, key)
                lines.append(
                    f"| {NAMES[key]} | {t['shown']} | {t['hit']} | {t['rate']:.0%} | {t['miss']} |"
                )
    lines += ["", "## 見落とし・過剰の中身(実装)", ""]
    for r in results:
        lines += [f"### {r['id']} {r['title']}", ""]
        for key in ("impl_trace", "impl_marks", "cand_a"):
            c = r[key]
            if c["miss"]:
                lines.append(f"- {NAMES[key]}の見落とし: {', '.join(c['miss'])}")
            if c["over_items"]:
                lines.append(f"- {NAMES[key]}の過剰: {', '.join(c['over_items'])}")
        m = r["impl_marks"]
        if m["doc_truth"]:
            lines.append(f"- 文書の要素の正解(印の対象外): {', '.join(m['doc_truth'])}")
        if m["changes"]:
            lines.append(f"- 差分で見つかった変わったもの: {', '.join(m['changes'])}")
        if r["unmapped_truth"]:
            lines.append(f"- 本体に対応の無い正解: {', '.join(r['unmapped_truth'])}")
        lines.append("")
    lines += [
        "## 追加の確認: 改名の後に下流の参照を直して承認する(S7 の続き)",
        "",
        "段階4の改名を承認した後、段階5の手順の呼び出し先を新しいパスに直して段階5を承認したとき。",
        "",
        *[f"- {item}" for item in followup],
    ]
    return "\n".join(lines)


def main() -> None:
    detailed_g, _ = base.build_detailed()
    simple_g = base.build_simple()
    detailed = load_data("detailed")
    simple = load_data("simple")
    simple = {**simple, "documents": simple_documents(simple)}
    notes = []
    diffs = check_same_as_stage6(detailed)
    notes.append(
        "詳細: DB の段階1〜8 は stage6-effect の JSON と同じ(単位のキーを除く)"
        if not diffs
        else f"詳細: stage6-effect の JSON と違う段階: {', '.join(diffs)}"
    )
    notes.append(
        "簡易: 内部設計書・実装計画書は model の無い版。md の解析から要素に要る欄だけの model を作った"
    )
    contexts = {
        "detailed": (
            detailed_g,
            detailed,
            PlanModel.model_validate(detailed["stages"]["7"]),
        ),
        "simple": (
            simple_g,
            simple,
            ImplementationPlanModel.model_validate(
                simple["documents"]["implementation_plan"]
            ).to_plan(),
        ),
    }
    results = []
    for scenario in SCENARIOS:
        g, models, plan = contexts[scenario.mode]
        elements = elements_of(scenario.mode, models)
        to_impl = key_map(g, plan)
        missing = [
            to_impl[k] for k in scenario.changed if to_impl[k] not in {e.key for e in elements}
        ]
        if missing:
            raise SystemExit(f"{scenario.id}: 本体の要素に無い: {missing}")
        results.append(evaluate(scenario, g, models, elements, to_impl))
    followup = rename_followup(detailed)
    (HERE / "results.json").write_text(
        json.dumps(
            {"results": results, "notes": notes, "rename_followup": followup},
            ensure_ascii=False,
            indent=1,
        )
        + "\n"
    )
    (HERE / "results.md").write_text(to_markdown(results, notes, followup) + "\n")
    print((HERE / "results.md").read_text())


if __name__ == "__main__":
    main()
