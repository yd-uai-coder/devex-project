"""ステージ7のベースライン: 変更シナリオで、今の陳腐化(段階単位)と ID のグラフを比べる。

材料は appendix/stage6-effect/ の1回目(detailed/・simple/)の生成物。外部の API は呼ばない。

    uv run --project devex-api/backend python appendix/stage7-baseline/measure.py

シナリオごとに次の3つを数え、results.md・results.json に書く。

1. 今の仕組み: 本体の `derive_states`(段階単位・版数の比較)で「古い」になる段階と、その中の要素の数
2. ID のグラフ: 段階の JSON と文書の表の ID から作った辺を逆にたどった範囲(直接 = 1段、全部 = 推移閉包)
3. 正解: 変更の中身を読んで、人(Claude)が「見直しが要る」と判断した要素(scenarios.py。理由つき)

1・2 を 3 と比べ、過剰(示したが見直し不要)と見落とし(見直しが要るのに示さない)を数える。
"""

import json
import re
import sys
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path

from app.detailed_design.api_list import endpoint_key, parse_trigger
from app.detailed_design.stages import (
    SIMPLE_STAGE_INPUTS,
    STAGE_INPUTS,
    StageRecord,
    current_inputs,
    derive_states,
)

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from scenarios import SCENARIOS, Scenario

SRC = HERE.parent / "stage6-effect"
REQ_ID = re.compile(r"\b(?:FR|NFR|CON)-\d{3}\b")
SCR_ID = re.compile(r"\bSCR-\d{3}\b")


# ---------------------------------------------------------------- グラフ


@dataclass
class Graph:
    """要素(節)と「AがBに依存する」辺。`stage_of`は要素の置き場(文書は doc:<type>)。"""

    stage_of: dict[str, str] = field(default_factory=dict)
    depends: dict[str, set[str]] = field(default_factory=lambda: defaultdict(set))

    def node(self, key: str, where: str) -> str:
        self.stage_of.setdefault(key, where)
        return key

    def edge(self, src: str, dst: str) -> None:
        if src != dst and dst in self.stage_of:
            self.depends[src].add(dst)

    def dependents(self) -> dict[str, set[str]]:
        rev: dict[str, set[str]] = defaultdict(set)
        for src, dsts in self.depends.items():
            for dst in dsts:
                rev[dst].add(src)
        return rev

    def impact(self, changed: list[str]) -> tuple[set[str], set[str]]:
        """変わった要素に依存する要素(直接・推移閉包)。変わった要素そのものは含めない。"""
        rev = self.dependents()
        direct = {d for c in changed for d in rev.get(c, ())} - set(changed)
        seen: set[str] = set()
        stack = list(changed)
        while stack:
            for d in rev.get(stack.pop(), ()):
                if d not in seen:
                    seen.add(d)
                    stack.append(d)
        return direct, seen - set(changed)

    def function_scoped(self, changed: list[str]) -> set[str]:
        """試案「処理を軸にたどる」: 変更が届く処理(F-xx)を決め、その処理に属する要素だけを示す。

        - 届く処理: 変わった要素が処理ならそれ自身、文書の要素なら辺をたどって届く処理、
          テーブル・モジュールならそれを使う CRUD・手順の処理。
        - 処理に属する要素: 処理に直接依存する要素(モジュールを除く。共有されるため)、
          その手順を呼ぶ処理ロジック、その作業単位の手順書。
        - これに、変わった要素の直接の依存元(1段)を足す。
        """
        rev = self.dependents()
        direct, closure = self.impact(changed)
        is_fn = {k for k, where in self.stage_of.items() if where == "stage:1"}
        fns = (closure | set(changed)) & is_fn
        for d in direct:
            if d.startswith(("CRUD ", "PROC ")):
                fns |= self.depends[d] & is_fn
        scoped: set[str] = set()
        for f in fns:
            own = {d for d in rev.get(f, ()) if not d.startswith("MOD ")}
            scoped |= own
            for d in own:
                scoped |= {
                    x for x in rev.get(d, ()) if x.startswith(("LOGIC ", "UNIT "))
                }
        return (scoped | direct) - set(changed)


def table_rows(md: str, first: re.Pattern[str]) -> list[list[str]]:
    rows = []
    for line in md.splitlines():
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if line.startswith("|") and cells and first.fullmatch(cells[0]):
            rows.append(cells)
    return rows


def unit_ids(milestones: list[dict]) -> list[tuple[str, dict]]:
    """段階7の単位 ID は位置で決まる(M-<マイルストーンの順>-T<タスクの順>)。"""
    return [
        (f"M-{mi:02d}-T{ti:02d}", task)
        for mi, ms in enumerate(milestones, start=1)
        for ti, task in enumerate(ms.get("tasks", []), start=1)
    ]


def build_detailed() -> tuple[Graph, dict]:
    run = SRC / "detailed"
    g = Graph()
    stages = {
        n: json.loads((run / "stages" / f"stage{n}.json").read_text())["model"] for n in range(1, 9)
    }
    req_md = (run / "requirements.md").read_text()
    ext_md = (run / "external_design.md").read_text()

    # 文書: 要件・画面・API(要件定義書・外部設計書の表)
    for cells in table_rows(req_md, re.compile(r"(?:FR|NFR|CON)-\d{3}")):
        g.node(cells[0], "doc:requirements")
    for cells in table_rows(ext_md, re.compile(r"SCR-\d{3}")):
        scr = g.node(cells[0], "doc:external_design")
        for req in REQ_ID.findall(" ".join(cells[1:])):
            g.edge(scr, req)
    for cells in table_rows(ext_md, re.compile(r"GET|POST|PUT|PATCH|DELETE")):
        api = g.node(f"API {endpoint_key(cells[0], cells[1])}", "doc:external_design")
        for scr in SCR_ID.findall(cells[3]):
            g.edge(api, scr)
        for req in REQ_ID.findall(cells[4]):
            g.edge(api, req)

    # 段階1: 処理
    for f in stages[1]["functions"]:
        fid = g.node(f["id"], "stage:1")
        for ref in f.get("req_ids", []) + f.get("screens", []):
            g.edge(fid, ref)
        trig = parse_trigger(f.get("trigger", ""))
        if trig:
            g.edge(fid, f"API {endpoint_key(*trig)}")
    # 段階2: 処理の要約(DFD のグループごとの図は JSON の外にあるので、要約の行で代表させる)
    for s in stages[2]["summaries"]:
        g.edge(g.node(f"DFD {s['function_id']}", "stage:2"), s["function_id"])
    # 段階3: テーブル(ER の図は JSON の外。CRUD に出るテーブル名で代表させる)と CRUD
    for c in stages[3]["cells"]:
        table = g.node(f"TABLE {c['table']}", "stage:3")
        cell = g.node(f"CRUD {c['function_id']}×{c['table']}", "stage:3")
        g.edge(cell, c["function_id"])
        g.edge(cell, table)
    # 段階4: モジュール
    for m in stages[4]["modules"]:
        g.node(f"MOD {m['path']}", "stage:4")
    for m in stages[4]["modules"]:
        mod = f"MOD {m['path']}"
        for fid in m["functions"]:
            g.edge(mod, fid)
        for dep in m["depends_on"]:
            g.edge(mod, f"MOD {dep}")
    # 段階5: 手順(処理ごと。手順の行の ID F-03#2 は位置で決まる)
    step_count = 0
    for p in stages[5]["procedures"]:
        proc = g.node(f"PROC {p['function_id']}", "stage:5")
        g.edge(proc, p["function_id"])
        for s in p["steps"]:
            step_count += 1
            if s.get("callee"):
                g.edge(proc, f"MOD {s['callee']}")
            for token in re.findall(r"(\w+) [CRUD]+", s.get("db", "")):
                g.edge(proc, f"TABLE {token}")
    # 段階6: 関数の処理ロジック(モジュール + 関数。呼ぶ手順の処理にも依存する)
    for lg in stages[6]["logics"]:
        logic = g.node(f"LOGIC {lg['module']}:{lg['function']}", "stage:6")
        g.edge(logic, f"MOD {lg['module']}")
        for p in stages[5]["procedures"]:
            if any(s.get("call") == lg["function"] for s in p["steps"]):
                g.edge(logic, f"PROC {p['function_id']}")
    # 段階7: 作業単位・横断事項(横断事項は要件ID を持たない)
    units = unit_ids(stages[7]["milestones"])
    for uid, _ in units:
        g.node(f"TASK {uid}", "stage:7")
    for uid, t in units:
        task = f"TASK {uid}"
        for fid in t["function_ids"]:
            g.edge(task, fid)
        for path in t["modules"]:
            g.edge(task, f"MOD {path}")
        for dep in t["depends_on"]:
            g.edge(task, f"TASK {dep}")
    for cc in stages[7]["crosscutting"]:
        topic = g.node(f"CC {cc['topic']}", "stage:7")
        for path in cc["modules"]:
            g.edge(topic, f"MOD {path}")
    for i, _ in enumerate(stages[7]["risks"], start=1):
        g.node(f"RISK {i}", "stage:7")
    # 段階8: 単位の手順書(単位・ファイル・そのモジュールの処理ロジック)
    for u in stages[8]["units"]:
        unit = g.node(f"UNIT {u['unit_id']}", "stage:8")
        g.edge(unit, f"TASK {u['unit_id']}")
        paths = {f["path"] for f in u["files"] if f["kind"] == "module"}
        for path in paths:
            g.edge(unit, f"MOD {path}")
        for lg in stages[6]["logics"]:
            if lg["module"] in paths:
                g.edge(unit, f"LOGIC {lg['module']}:{lg['function']}")

    positional = {
        "手順の行(F-xx#n)": step_count,
        "処理ロジックの表示 ID(L-NN)": len(stages[6]["logics"]),
        "作業単位(M-xx-Tyy)": len(units),
    }
    return g, positional


def build_simple() -> Graph:
    """簡易モード: 段階8の単位と、実装計画書の WBS の依存・要件。"""
    run = SRC / "simple"
    g = Graph()
    req_md = (run / "requirements.md").read_text()
    for cells in table_rows(req_md, re.compile(r"(?:FR|NFR|CON)-\d{3}")):
        g.node(cells[0], "doc:requirements")
    wbs = (run / "implementation_plan.md").read_text()
    tasks = re.findall(
        r"- \[ \] (M-\d{2}-T\d{2}) .*?\n((?:  - .*\n)+)", wbs
    )
    for uid, body in tasks:
        g.node(f"TASK {uid}", "doc:implementation_plan")
    for uid, body in tasks:
        task = f"TASK {uid}"
        fields = dict(re.findall(r"  - ([^:]+): (.*)", body))
        for dep in re.findall(r"M-\d{2}-T\d{2}", fields.get("依存", "")):
            g.edge(task, f"TASK {dep}")
        for req in REQ_ID.findall(fields.get("要件", "")):
            g.edge(task, req)
    stage8 = json.loads((run / "stages" / "stage8.json").read_text())["model"]
    for u in stage8["units"]:
        g.edge(g.node(f"UNIT {u['unit_id']}", "stage:8"), f"TASK {u['unit_id']}")
    return g


# ---------------------------------------------------------------- 今の仕組み


def current_outdated(scenario: Scenario) -> list[int]:
    """全段階が承認済みの状態から、シナリオの変更を当てたときに「古い」になる段階。"""
    inputs = STAGE_INPUTS if scenario.mode == "detailed" else SIMPLE_STAGE_INPUTS
    docs = {d: 1 for d in ("requirements", "external_design", "internal_design", "implementation_plan")}
    approved = {s: 2 for s in inputs}
    records = {
        s: StageRecord(
            status="approved",
            version=2,
            approved_version=2,
            input_fingerprint=current_inputs(
                s, approved_stage_versions=approved, doc_versions=docs, inputs=inputs
            ),
        )
        for s in inputs
    }
    for d in scenario.bump_documents:
        docs[d] += 1
    for s in scenario.edit_stages:
        # 段階を編集して承認し直した後(版が上がる。入力は変わらないので指紋はそのまま)
        old = records[s]
        records[s] = StageRecord("approved", 3, 3, old.input_fingerprint)
    views = derive_states(records, docs, inputs)
    return [s for s, v in views.items() if v.state == "outdated"]


# ---------------------------------------------------------------- 集計


def evaluate(scenario: Scenario, g: Graph) -> dict:
    for key in scenario.changed + sorted(scenario.truth):
        if key not in g.stage_of:
            raise SystemExit(f"{scenario.id}: 要素 {key} がグラフに無い")
    outdated = current_outdated(scenario)
    current = {
        k for k, where in g.stage_of.items() if where in {f"stage:{s}" for s in outdated}
    } - set(scenario.changed)
    direct, closure = g.impact(scenario.changed)
    scoped = g.function_scoped(scenario.changed)
    truth = set(scenario.truth)

    def compare(shown: set[str]) -> dict:
        return {
            "shown": len(shown),
            "hit": len(shown & truth),
            "over": len(shown - truth),
            "miss": sorted(truth - shown),
        }

    return {
        "id": scenario.id,
        "title": scenario.title,
        "mode": scenario.mode,
        "group": scenario.group,
        "changed": scenario.changed,
        "outdated_stages": outdated,
        "truth": len(truth),
        "current": compare(current),
        "graph_direct": compare(direct),
        "graph_closure": compare(closure),
        "function_scoped": compare(scoped),
        "closure_over": sorted(closure - truth),
    }


def to_markdown(results: list[dict], sizes: dict, positional: dict) -> str:
    lines = [
        "# ステージ7のベースラインの結果",
        "",
        "`measure.py` の出力(手で書き換えない)。読み方は [README](./README.md)。",
        "",
        "## 要素の数",
        "",
        "| 置き場 | 要素の数 |",
        "|---|---|",
    ]
    lines += [f"| {k} | {v} |" for k, v in sorted(sizes.items())]
    lines += ["", "位置で決まる ID(並べ替え・挿入でずれる):", ""]
    lines += [f"- {k}: {v}" for k, v in positional.items()]
    lines += [
        "",
        "## シナリオごとの比較",
        "",
        "「示した / 当たり / 過剰 / 見落とし」。正解は人の判断(scenarios.py)。",
        "",
        "| シナリオ | 正解 | 古い段階 | 今の仕組み | グラフ(直接) | グラフ(全部) | 処理を軸(試案) |",
        "|---|---|---|---|---|---|---|",
    ]

    def cell(c: dict) -> str:
        return f"{c['shown']} / {c['hit']} / {c['over']} / {len(c['miss'])}"

    for r in results:
        stages = "・".join(map(str, r["outdated_stages"])) or "なし"
        lines.append(
            f"| {r['id']} {r['title']} | {r['truth']} | {stages} | {cell(r['current'])} "
            f"| {cell(r['graph_direct'])} | {cell(r['graph_closure'])} "
            f"| {cell(r['function_scoped'])} |"
        )
    names = {
        "current": "今の仕組み",
        "graph_direct": "グラフ(直接)",
        "graph_closure": "グラフ(全部)",
        "function_scoped": "処理を軸(試案)",
    }
    for group, heading in (("base", "合計(S1〜S8)"), ("holdout", "合計(N1〜N4。試案の後に決めたシナリオ)")):
        rows = [r for r in results if r["group"] == group]
        truth = sum(r["truth"] for r in rows)
        lines += [
            "",
            f"## {heading}",
            "",
            f"正解の合計: {truth}",
            "",
            "| 方式 | 示した | 当たり | 過剰の割合 | 見落とし |",
            "|---|---|---|---|---|",
        ]
        for k, name in names.items():
            shown = sum(r[k]["shown"] for r in rows)
            hit = sum(r[k]["hit"] for r in rows)
            miss = sum(len(r[k]["miss"]) for r in rows)
            rate = (shown - hit) / shown if shown else 0
            lines.append(f"| {name} | {shown} | {hit} | {rate:.0%} | {miss} |")
    lines += ["", "## 見落とし・過剰の中身", ""]
    for r in results:
        lines.append(f"### {r['id']} {r['title']}")
        lines.append("")
        for k in ("current", "graph_direct", "graph_closure", "function_scoped"):
            if r[k]["miss"]:
                lines.append(f"- {names[k]}の見落とし: {', '.join(r[k]['miss'])}")
        if r["closure_over"]:
            lines.append(f"- グラフ(全部)の過剰: {', '.join(r['closure_over'])}")
        lines.append("")
    return "\n".join(lines)


def main() -> None:
    detailed, positional = build_detailed()
    simple = build_simple()
    graphs = {"detailed": detailed, "simple": simple}
    results = [evaluate(s, graphs[s.mode]) for s in SCENARIOS]
    sizes: dict[str, int] = defaultdict(int)
    for where in detailed.stage_of.values():
        sizes[f"詳細 {where}"] += 1
    for where in simple.stage_of.values():
        sizes[f"簡易 {where}"] += 1
    (HERE / "results.json").write_text(
        json.dumps({"results": results, "positional_ids": positional}, ensure_ascii=False, indent=1)
        + "\n"
    )
    (HERE / "results.md").write_text(to_markdown(results, dict(sizes), positional) + "\n")
    print((HERE / "results.md").read_text())


if __name__ == "__main__":
    main()
