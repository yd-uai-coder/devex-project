"""ステージ12の効果測定(Phase 99-1): 合意済みの行の保護・確認事項・CR の後の再生成を測る。

ベースライン(`measure.py`。Phase 90-2)と同じ題材「トレンド追跡アプリ」で、次の2つを出す。

A. 決定的な再現(LLM・DB を使わない): ベースラインで書き出した版(`data/v5〜v9`)に、ステージ12 の
   保護(`protect_requirements`・`protect_external_design`)を当て直し、戻す要素と、戻した後の
   「合意と違う」の数を数える。合意は2通り。
   - 記録どおり: 開発 DB の合意の記録(B-3 から。`data/agreements-b3.json`)。
   - ステージ12 の流れなら: 記録どおりの合意に、CR-3 の反映での合意の更新(対象の要件と予測の
     画面・API を v5 の中身で)と、v5 の全12行の「採用にする」(v5 の中身で)を足したもの。
B. 実 LLM の流れ(Phase 99-4): 書き出し(`data/effect/`)を名前の順に並べ、版・保護で戻した要素・
   合意の状態・確認事項・CR に結んだ印を出す。書き出しは2通り。
   - `snapshot <名前>`: 今の版と、今の合意・確認事項・段階・CR。
   - `snapshot-version <版>`: 指定した版(巡回で消えていないもの)と、その版が今の版だった間の合意
     (次の版を作るまでの記録。記録は追記だけで日時を持つので組み直せる)。確認事項・段階は、その
     時点のものが残っていないので null。

    # 再現の材料(合意の記録と CR-3)を書き出す。一度だけ(実 LLM の流れの前に)
    PYTHONPATH=devex-api/backend uv run --project devex-api/backend \
        python appendix/measurements/stage12/effect.py export
    # 実 LLM の流れの各段の後に(段の途中で取れなかった版は snapshot-version で後から)
    PYTHONPATH=devex-api/backend uv run --project devex-api/backend \
        python appendix/measurements/stage12/effect.py snapshot 01-regen
    PYTHONPATH=devex-api/backend uv run --project devex-api/backend \
        python appendix/measurements/stage12/effect.py snapshot-version 10
    # 結果(stage12-effect.md に写す)
    PYTHONPATH=devex-api/backend uv run --project devex-api/backend \
        python appendix/measurements/stage12/effect.py report
"""

import json
import sys
from pathlib import Path
from typing import Any

from measure import DATA, PROJECT_ID, compare_rows, load_snapshots, psql, req_model, states_of

from app.agreements import (
    CurrentAgreement,
    agreement_items,
    change_request_items,
    element_states,
    origin_label,
    protect_external_design,
    protect_requirements,
)
from app.change_requests.prediction import rewritable_keys
from app.change_requests.targets import Target
from app.confirmations import adoption_counts, confirmation_items
from app.documents.external_design.model import ExternalDesignModel
from app.documents.requirements.model import RequirementsModel

EFFECT = DATA / "effect"
AGREEMENTS = DATA / "agreements-b3.json"
CR3 = DATA / "cr3.json"
DOC_KINDS = ("requirement", "users", "screen", "api", "integration")

RECORDS_SQL = """
select coalesce(json_agg(json_build_object(
  'seq', r.seq, 'key', r.key, 'kind', r.kind, 'label', r.label, 'content', r.content,
  'origin', r.origin, 'baseline', b.number, 'cr', c.number) order by r.seq), '[]')
from agreement_records r
left join baselines b on b.id = r.baseline_id
left join change_requests c on c.id = r.change_request_id
where r.project_id = '{project}' {until}
"""
# 版 N が今の版だった間 = 次の版を作るまで
UNTIL_NEXT = """and r.created_at < coalesce((select min(created_at) from generated_documents
  where project_id = '{project}' and doc_type = 'requirements' and version > {version}),
  'infinity'::timestamptz)"""
CRS_SQL = f"""
select coalesce(json_agg(json_build_object(
  'number', number, 'status', status, 'targets', targets, 'adds_requirement', adds_requirement,
  'predicted_impact', predicted_impact, 'applied_impact', applied_impact,
  'mark_counts', (select coalesce(json_agg((e.refs->>'mark_count')::int order by e.position), '[]')
    from change_request_events e
    where e.change_request_id = change_requests.id and e.action = 'approve_stage'))
  order by number), '[]')
from change_requests where project_id = '{PROJECT_ID}'
"""
STAGES_SQL = f"""(select json_object_agg(s.stage, json_build_object(
      'status', s.status, 'version', s.version, 'approved_version', s.approved_version,
      'impact', s.impact, 'cr', c.number))
    from design_stages s left join change_requests c on c.id = s.generation_change_request_id
    where s.project_id = '{PROJECT_ID}')"""
CONFIRMATIONS_SQL = f"""(select coalesce(json_agg(json_build_object(
      'key', key, 'kind', kind, 'opportunity', opportunity, 'status', status)
      order by key), '[]') from confirmation_items where project_id = '{PROJECT_ID}')"""
EFFECT_SQL = f"""
select json_build_object(
  'documents', (select json_object_agg(g.doc_type, json_build_object(
      'version', g.version, 'model', g.model, 'protection', g.protection, 'cr', c.number))
    from generated_documents g left join change_requests c on c.id = g.change_request_id
    where g.project_id = '{PROJECT_ID}' and g.doc_type in ('requirements', 'external_design')
      and {{documents}}),
  'stages', {{stages}},
  'records', ({{records}}),
  'confirmations', {{confirmations}},
  'change_requests', ({CRS_SQL})
)
"""


def dump(path: Path, data: Any) -> None:
    path.parent.mkdir(exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1, sort_keys=True) + "\n")
    print(f"wrote {path.relative_to(DATA.parent)}")


def records_sql(until: str = "") -> str:
    return RECORDS_SQL.format(project=PROJECT_ID, until=until)


def export() -> None:
    dump(AGREEMENTS, json.loads(psql(records_sql())))
    crs = json.loads(psql(CRS_SQL))
    dump(CR3, next(cr for cr in crs if cr["number"] == 3))


def snapshot(name: str) -> None:
    sql = EFFECT_SQL.format(
        documents="g.is_current",
        stages=STAGES_SQL,
        records=records_sql(),
        confirmations=CONFIRMATIONS_SQL,
    )
    dump(EFFECT / f"{name}.json", json.loads(psql(sql)))


def snapshot_version(version: int) -> None:
    until = UNTIL_NEXT.format(project=PROJECT_ID, version=version)
    sql = EFFECT_SQL.format(
        documents=f"g.version = {version}",
        stages="null",
        records=records_sql(until),
        confirmations="null",
    )
    dump(EFFECT / f"v{version:02d}.json", json.loads(psql(sql)))


def current(records: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """合意の記録(seq の順)から今の合意(キー → 最後の記録。外れた要素は除く)。"""
    latest: dict[str, dict[str, Any]] = {}
    for record in records:
        latest[record["key"]] = record
    return {k: r for k, r in latest.items() if r["content"] is not None}


def agreements_of(agreed: dict[str, dict[str, Any]]) -> list[CurrentAgreement]:
    return [
        CurrentAgreement(
            key,
            r["kind"],
            r["label"],
            r["content"],
            origin_label(r["origin"], baseline_number=r.get("baseline"), cr_number=r.get("cr")),
            r.get("baseline"),
            r.get("cr"),
        )
        for key, r in agreed.items()
    ]


def models(documents: dict[str, Any]) -> tuple[RequirementsModel, ExternalDesignModel]:
    return (
        RequirementsModel.model_validate(documents["requirements"]["model"]),
        ExternalDesignModel.model_validate(documents["external_design"]["model"]),
    )


def state_counts(
    req: RequirementsModel, ext: ExternalDesignModel, agreed: dict[str, dict[str, Any]]
) -> tuple[dict[str, int], list[str]]:
    states = element_states(agreement_items(req, ext), agreements_of(agreed), DOC_KINDS)
    counts: dict[str, int] = {}
    for s in states:
        counts[s.state] = counts.get(s.state, 0) + 1
    return counts, [s.key for s in states if s.state in ("differs", "missing")]


def simulated(records: list[dict[str, Any]], cr3: dict[str, Any], v5: dict[str, Any]) -> dict:
    """ステージ12 の流れなら残っていた合意: 記録どおりの合意 → CR-3 の反映での更新 → 全行の採用。"""
    agreed = {k: {"kind": r["kind"], "label": r["label"], "content": r["content"],
                  "origin": r["origin"], "baseline": r["baseline"], "cr": None}
              for k, r in current(records).items()}
    req, ext = models(v5["documents"])
    items = agreement_items(req, ext)
    targets = [Target(t["requirement_id"], t["kind"], t["proposed_text"]) for t in cr3["targets"]]
    rewritable = rewritable_keys(targets, cr3["predicted_impact"])
    updated, removed = change_request_items(rewritable, items, agreed, DOC_KINDS)
    for item in updated:
        agreed[item.key] = {"kind": item.kind, "label": item.label, "content": dict(item.content),
                            "origin": "change_request", "baseline": None, "cr": 3}
    for key in removed:
        agreed.pop(key, None)
    for item in items:
        if item.kind == "requirement":
            agreed[item.key] = {"kind": item.kind, "label": item.label,
                                "content": dict(item.content), "origin": "adopt",
                                "baseline": None, "cr": None}
    return agreed


def replay(label: str, agreed: dict[str, dict[str, Any]], snaps: list[dict[str, Any]]) -> None:
    print(f"### 合意: {label}({len(agreed)}要素)")
    print()
    print("| 版 | 保護の前の「合意と違う・無い」 | 戻した要素(要件 / 外部設計) "
          "| 保護の後の「合意と違う・無い」 | 保護の後の「未合意」 |")
    print("|---|---|---|---|---|")
    prev_req, prev_ext = models(snaps[0]["documents"])
    for snap in snaps[1:]:
        v = snap["documents"]["requirements"]["version"]
        req, ext = models(snap["documents"])
        _, before = state_counts(req, ext, agreed)
        new_req, r_req = protect_requirements(req, prev_req, agreed_contents(agreed))
        new_ext, r_ext = protect_external_design(ext, prev_ext, agreed_contents(agreed))
        counts, after = state_counts(new_req, new_ext, agreed)
        unagreed = [i.key for i in agreement_items(new_req, new_ext) if i.key not in agreed]
        restored = [f"{r.key}({r.reason})" for r in r_req] + [
            f"{r.key}({r.reason})" for r in r_ext
        ]
        print(f"| v{v} | {fmt(before)} | {fmt(restored)} | {fmt(after)} | {fmt(unagreed)} |")
        prev_req, prev_ext = new_req, new_ext
    print()


def agreed_contents(agreed: dict[str, dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {k: r["content"] for k, r in agreed.items()}


def fmt(items: list[str]) -> str:
    return f"{len(items)}" + (f"({', '.join(items)})" if items else "")


def report_replay() -> None:
    print("## A. 決定的な再現(ベースラインの v5〜v9 に保護を当て直す)")
    print()
    snaps = load_snapshots()
    records = json.loads(AGREEMENTS.read_text())
    cr3 = json.loads(CR3.read_text())
    replay("記録どおり(B-3)", current(records), snaps)
    agreed = simulated(records, cr3, snaps[0])
    replay("ステージ12 の流れなら(B-3 → CR-3 → 全行の採用)", agreed, snaps)


def cr_marks(snap: dict[str, Any]) -> dict[str, int]:
    """段階の印の出どころごとの数(`cr:N` と、CR に結ばれないもの)。"""
    counts: dict[str, int] = {}
    for row in (snap["stages"] or {}).values():
        for mark in (row.get("impact") or {}).get("marks", []):
            crs = [s for s in mark["sources"] if s.startswith("cr:")]
            for s in crs or ["CR なし"]:
                counts[s] = counts.get(s, 0) + 1
    return counts


def flow_paths() -> list[Path]:
    """書き出しを版の順に(同じ版なら版の書き出し → 名前つきの書き出し)。"""

    def key(path: Path) -> tuple[int, bool, str]:
        version = json.loads(path.read_text())["documents"]["requirements"]["version"]
        return version, not path.stem.startswith("v"), path.stem

    return sorted(EFFECT.glob("*.json"), key=key)


def confirmation_text(snap: dict[str, Any], req: RequirementsModel) -> tuple[str, str]:
    """確認事項の件数(要件/利用者/観点)と採用率。確認事項の状態が無い書き出しは件数だけ。"""
    items = confirmation_items(req, states_of(snap["documents"]["requirements"]["model"]))
    kinds = {k: sum(1 for i in items if i.kind == k) for k in ("requirement", "user", "point")}
    counts = f"{kinds['requirement']}/{kinds['user']}/{kinds['point']}"
    if snap["confirmations"] is None:
        return counts, "─"
    present = {i.key for i in items}
    decided = {c["key"]: c for c in snap["confirmations"]}
    entries = [(i.kind, decided[i.key]["status"] if i.key in decided else "unconfirmed", True)
               for i in items]
    entries += [(c["kind"], c["status"], False) for c in snap["confirmations"]
                if c["key"] not in present]
    rate = adoption_counts(entries)
    if rate.rate is None:
        return counts, "─"
    return counts, f"{rate.rate:.0%}({rate.confirmed}/{rate.confirmed + rate.rejected})"


def report_flow() -> None:
    paths = flow_paths()
    if not paths:
        return
    print("## B. 実 LLM の流れ")
    print()
    print("| 書き出し | 版(CR) | 合意の要素 | 保護で戻した要素 | 合意の状態 | 合意と違う・無い "
          "| 未合意 | 推測の要件 | 確認事項(要件/利用者/観点) | 採用率 |")
    print("|---|---|---|---|---|---|---|---|---|---|")
    for path in paths:
        snap = json.loads(path.read_text())
        docs = snap["documents"]
        req, ext = models(docs)
        agreed = current(snap["records"])
        counts, off = state_counts(req, ext, agreed)
        unagreed = [i.key for i in agreement_items(req, ext) if i.key not in agreed]
        protection = [f"{p['key']}({p['reason']})" for d in docs.values()
                      for p in (d["protection"] or [])]
        confirmations, rate = confirmation_text(snap, req)
        version = docs["requirements"]["version"]
        cr = docs["requirements"]["cr"]
        assumed = sum(1 for r in req.rows if r.source == "assumed")
        print(f"| {path.stem} | v{version}{f'(CR-{cr})' if cr else ''} | {len(agreed)} "
              f"| {fmt(protection)} | {counts} | {fmt(off)} | {fmt(unagreed)} "
              f"| {assumed} / {len(req.rows)} | {confirmations} | {rate} |")
    end = json.loads(paths[-1].read_text())
    print()
    print("### CR と段階の印(最後の書き出し)")
    print()
    for cr in end["change_requests"]:
        print(f"- CR-{cr['number']}({cr['status']}): 段階の承認で結んだ印 {cr['mark_counts']}")
    if end["stages"] is not None:
        print(f"- 段階の印の出どころ: {cr_marks(end)}")
        for stage, row in sorted(end["stages"].items(), key=lambda kv: int(kv[0])):
            approved = row["approved_version"]
            cr = f" CR-{row['cr']}" if row["cr"] else ""
            print(f"  - 段階{stage}: {row['status']} 版{row['version']}(承認 {approved}){cr}")
    print()
    print("### 要件の行の変化(直前の版との比較。版が変わった段だけ)")
    print()
    last: dict[str, Any] | None = None
    for path in paths:
        snap = json.loads(path.read_text())
        docs = snap["documents"]
        if last is not None and last["requirements"]["version"] != docs["requirements"]["version"]:
            d = compare_rows(req_model({"documents": last}), req_model(snap))
            print(f"- {path.stem}: 文 {fmt(d['text'])} / 出どころ {fmt(d['cap'] + d['llm'])} "
                  f"/ 消えた {fmt(d['gone'])} / 増えた {fmt(d['new'])}")
        last = docs
    print()


def report() -> None:
    report_replay()
    report_flow()


if __name__ == "__main__":
    command = sys.argv[1]
    if command == "export":
        export()
    elif command == "snapshot":
        snapshot(sys.argv[2])
    elif command == "snapshot-version":
        snapshot_version(int(sys.argv[2]))
    else:
        report()
