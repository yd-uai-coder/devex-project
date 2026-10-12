"""ステージ7の効果測定(Phase 49)用に、ローカルの devex-api を叩くスクリプト。

ステージ6の効果測定(../stage6-effect/drive.py)を複製し、次を変えたもの。段階1〜8を進める規則は
ステージ6と同じ。

- 回(`<run>`。例: detailed-1・simple-2)ごとにプロジェクトを持つ。モードは回の名前の先頭。
- 再生成の印: `impact`(変更の影響を JSON に書き出す)。再生成は `generate` をもう一度。
- 段階の書き出し(`design`・`procedure` の stages/)に、図の意味モデル(diagrams.json)も足す
  (段階3・5 の件数を stage35.py で数えるため)。

ヒアリング(say)は人(利用者の役)が1回ずつ送る。生成の後の段階1〜8は、README の
「人の操作の規則」どおりに自動で進める(design・procedure)。

usage:
  drive.py setup <run> [name]            プロジェクトを作り、AI の最初の発話とカードを表示する
  drive.py say <run> <message_file|-> [card_id:option ...]
                                         発言(- は本文なし)とカードへの回答を送り、
                                         返信・カード・観点の表を表示する
  drive.py points <run> [out_file]       観点の表を表示する(out_file にも書く)
  drive.py metrics <run> <out_dir>       文書の出どころ・検証の指摘を metrics.json に書き出す
  drive.py history <run> <out_file>      チャットの全履歴を書き出す
  drive.py generate <run>                文書を生成(再生成)し、終わるまで待つ
  drive.py docs <run> <out_dir>          生成された文書を書き出す
  drive.py design <run> <out_dir> [start] 詳細設計モードの段階1〜7を規則どおりに進める
  drive.py procedure <run> <out_dir>     段階8の全単位を生成・承認し、実装手順書の zip を取る
  drive.py impact <run> <out_file>       変更の影響(段階ごとの変わったもの・印)を書き出す
  drive.py dump <run> <out_dir>          段階と図を書き出す
  drive.py stages <run>                  段階の状態を表示する
"""

import json
import pathlib
import re
import sys
import time
import uuid

import httpx

BASE = "http://localhost:8000/api/v1"
HERE = pathlib.Path(__file__).parent
STATE = HERE / "state.json"
BATCH = 5  # 段階5・6・8の、1回に生成できる上限


def load() -> dict:
    return json.loads(STATE.read_text()) if STATE.exists() else {}


def save(state: dict) -> None:
    STATE.write_text(json.dumps(state, ensure_ascii=False, indent=2))


def login(state: dict) -> None:
    if "token" in state:
        r = httpx.get(f"{BASE}/projects", headers={"Authorization": f"Bearer {state['token']}"})
        if r.status_code == 200:
            return
    if "email" not in state:
        state["email"] = f"stage7-{uuid.uuid4().hex[:8]}@example.com"
        state["password"] = "Stage7-" + uuid.uuid4().hex
        r = httpx.post(
            f"{BASE}/auth/register",
            json={"email": state["email"], "password": state["password"], "full_name": "stage7"},
        )
        print("register", r.status_code, r.text[:200])
    r = httpx.post(f"{BASE}/auth/login", json={"email": state["email"], "password": state["password"]})
    r.raise_for_status()
    state["token"] = r.json()["access_token"]


def client(state: dict) -> httpx.Client:
    return httpx.Client(
        base_url=BASE, headers={"Authorization": f"Bearer {state['token']}"}, timeout=600
    )


class Driver:
    def __init__(self, c: httpx.Client, pid: str) -> None:
        self.c = c
        self.pid = pid
        self.log: list[str] = []

    def note(self, text: str) -> None:
        print(text)
        self.log.append(text)

    # ---- 段階の共通の操作 ----

    def stage(self, n: int) -> dict:
        r = self.c.get(f"/projects/{self.pid}/design-stages")
        r.raise_for_status()
        return {s["stage"]: s for s in r.json()}[n]

    def save_model(self, n: int, model: dict) -> dict:
        row = self.stage(n)
        r = self.c.put(
            f"/projects/{self.pid}/design-stages/{n}",
            json={"version": row["version"], "model": model},
        )
        if r.status_code != 200:
            raise SystemExit(f"save {n}: {r.status_code} {r.text[:300]}")
        return r.json()

    def generate(self, n: int, body: dict | None = None) -> dict:
        r = self.c.post(f"/projects/{self.pid}/design-stages/{n}/generate", json=body)
        if r.status_code != 202:
            raise SystemExit(f"generate {n}: {r.status_code} {r.text[:300]}")
        started = time.monotonic()
        while True:
            time.sleep(5)
            row = self.stage(n)
            if row["generation_status"] != "generating":
                break
        took = round(time.monotonic() - started)
        self.note(f"段階{n} 生成 {json.dumps(body, ensure_ascii=False) if body else ''} → "
                  f"{row['generation_status']}({took}秒) {row['generation_error'] or ''}")
        if row["generation_status"] != "completed":
            raise SystemExit(f"generation failed at stage {n}")
        return row

    def approve_diagrams(self, notation: str) -> None:
        for d in self.c.get(f"/projects/{self.pid}/uml/diagrams").json():
            if d["notation"] != notation or d.get("status") in ("approved", "exported"):
                continue
            r = self.c.post(f"/projects/{self.pid}/uml/diagrams/{d['id']}/layout")
            if r.status_code != 200:
                raise SystemExit(f"layout {notation}: {r.status_code} {r.text[:300]}")
            r = self.c.post(
                f"/projects/{self.pid}/uml/diagrams/{d['id']}/approve",
                json={"version": r.json()["version"]},
            )
            if r.status_code != 200:
                raise SystemExit(f"approve {notation}: {r.status_code} {r.text[:300]}")
            self.note(f"  図 {notation} {d['subject'] or '(全体)'} を配置して承認")

    def approve(self, n: int) -> dict:
        row = self.stage(n)
        issues = row.get("issues") or []
        for i in issues:
            self.note(f"  検証 {i.get('severity')} {i.get('code')} {i.get('message', '')[:120]}")
        r = self.c.post(
            f"/projects/{self.pid}/design-stages/{n}/approve", json={"version": row["version"]}
        )
        if r.status_code != 200:
            raise SystemExit(f"approve {n}: {r.status_code} {r.text[:300]}")
        self.note(f"段階{n} 承認(v{row['version']})")
        return r.json()

    def dump(self, out: pathlib.Path) -> None:
        out.mkdir(parents=True, exist_ok=True)
        for s in self.c.get(f"/projects/{self.pid}/design-stages").json():
            (out / f"stage{s['stage']}.json").write_text(json.dumps(s, ensure_ascii=False, indent=2))
        diagrams = self.c.get(f"/projects/{self.pid}/uml/diagrams").json()
        (out / "diagrams.json").write_text(json.dumps(diagrams, ensure_ascii=False, indent=2))


# ---- 人の操作の規則(README) ----

def _calls_function(step: dict) -> bool:
    """段階6で選べる行(devex-ui の logicOps.callsFunction に合わせた近似)。"""
    return (
        not step.get("is_branch")
        and step.get("kind", "call") != "return"
        and "/" in step.get("callee", "")
        and bool(step.get("call", "").strip())
    )


def logic_targets(procedures: dict) -> list[dict]:
    """段階5の手順から、段階6で詳細を書く関数を選ぶ: 呼び出し先がサービス層のものを、
    最初に現れた順に上限まで(無ければ、関数を呼ぶ行の最初から)。"""
    found: dict[str, dict] = {}
    for p in procedures.get("procedures", []):
        for step in p.get("steps", []):
            if _calls_function(step):
                key = f"{step['callee'].strip()}::{step['call'].strip()}"
                found.setdefault(key, {"module": step["callee"].strip(), "function": step["call"].strip()})
    services = [t for t in found.values() if "service" in t["module"]]
    return (services or list(found.values()))[:BATCH]


def fix_crud(d: Driver) -> None:
    """段階3の DFD_WRITE_MISSING(DFD に書き込みの線があるのに CRUD に C/U/D が無い)を、
    画面で人が行う最小の修正で直す: そのセルに U を足す。"""
    row = d.stage(3)
    missing = {
        (m.group(1), m.group(2))
        for i in row.get("issues") or []
        if i.get("code") == "DFD_WRITE_MISSING"
        and (m := re.search(r"(F-\d+) × (\S+) の書き込み", i.get("message", "")))
    }
    if not missing:
        return
    model = row["model"]
    for cell in model["cells"]:
        if (cell["function_id"], cell["table"]) in missing:
            cell["ops"] = "".join(sorted(set(cell["ops"]) | {"U"}, key="CRUD".index))
            d.note(f"  人の修正: CRUD {cell['function_id']} × {cell['table']} を {cell['ops']} にした")
    d.save_model(3, model)


def run_design(d: Driver, out: pathlib.Path, start: int = 1) -> None:  # noqa: C901
    functions = d.stage(1)["model"]
    if start <= 1:
        d.generate(1)
        functions = d.stage(1)["model"]
        d.approve(1)

    if start <= 2:
        groups = functions.get("groups", [])[:BATCH]
        d.note(f"段階2 DFD を描くグループ: {groups}")
        d.save_model(2, {"dfd_groups": groups, "summaries": []})
        d.generate(2)
    for n, notation in ((2, "dfd"), (3, "er"), (4, "component")):
        if n < start:
            continue
        if n != 2 and not (n == start and d.stage(n)["generation_status"] == "completed"):
            d.generate(n)
        d.approve_diagrams(notation)
        if n == 3:
            fix_crud(d)
        d.approve(n)

    ids = [f["id"] for f in functions.get("functions", [])]
    d.note(f"段階5 手順を書く処理: {ids}(全件)")
    d.save_model(5, {"procedures": [{"function_id": i} for i in ids]})
    for k in range(0, len(ids), BATCH):
        d.generate(5, {"function_ids": ids[k:k + BATCH]})
    procedures = d.stage(5)["model"]
    d.approve(5)

    targets = logic_targets(procedures)
    d.note(f"段階6 詳細を書く関数: {[t['module'] + ' の ' + t['function'] for t in targets]}")
    d.save_model(6, {"logics": targets})
    d.generate(6, {"logics": targets})
    d.approve(6)

    d.generate(7)
    d.approve(7)
    r = d.c.get(f"/projects/{d.pid}/design-stages/document")
    (out / "detailed_design.zip").write_bytes(r.content)
    d.note(f"詳細設計書・実装計画の zip: {r.status_code} {len(r.content)} bytes")


def run_procedure(d: Driver, out: pathlib.Path) -> None:
    plan = d.stage(8)["plan"] or {}
    units = [
        f"M-{m + 1:02d}-T{t + 1:02d}"
        for m, milestone in enumerate(plan.get("milestones", []))
        for t in range(len(milestone.get("tasks", [])))
    ]
    d.note(f"段階8 手順書を作る単位: {units}(全件)")
    for k in range(0, len(units), BATCH):
        d.generate(8, {"unit_ids": units[k:k + BATCH]})
    d.approve(8)
    r = d.c.get(f"/projects/{d.pid}/design-stages/procedure-document")
    (out / "implementation_procedure.zip").write_bytes(r.content)
    d.note(f"実装手順書の zip: {r.status_code} {len(r.content)} bytes")


def show_cards(cards: list[dict] | None) -> None:
    for card in cards or []:
        print(f"[card {card['id']}] ({card['point_key']}) {card['label']}: {card['question']}")
        for i, o in enumerate(card["options"]):
            mark = " *おすすめ" if i == card.get("recommended") else ""
            print(f"    {i}. {o['label']} → {o['result']}{mark}")
        if card.get("reason"):
            print(f"    理由: {card['reason']}")


def show_points(c: httpx.Client, pid: str) -> dict:
    view = c.get(f"/projects/{pid}/hearing-points").json()
    print(f"=== 観点の表 scale={view['scale']} sufficient={view['is_sufficient']} "
          f"stale={view['stale']} legacy={view['legacy']}")
    for p in view["points"]:
        req = "必須" if p["required"] else "任意"
        print(f"  {p['key']:<22} {req} {p['status']:<15} {p['summary'][:90]}")
    return view


def metrics(c: httpx.Client, pid: str, out: pathlib.Path) -> None:
    """3指標と申し送りの数を数える材料(文書の要約・段階の指摘・観点の表)を1つの JSON に。"""
    result: dict = {"points": c.get(f"/projects/{pid}/hearing-points").json(), "documents": {}}
    for doc in c.get(f"/projects/{pid}/documents").json():
        result["documents"][doc["doc_type"]] = {
            "version": doc["version"],
            "requirements": doc.get("requirements"),
            "external_design": doc.get("external_design"),
        }
    stages = {}
    for s in c.get(f"/projects/{pid}/design-stages").json():
        codes: dict[str, int] = {}
        for i in s.get("issues") or []:
            key = f"{i.get('severity')}:{i.get('code')}"
            codes[key] = codes.get(key, 0) + 1
        stages[s["stage"]] = {"state": s.get("state"), "issues": codes}
    result["stages"] = stages
    out.mkdir(parents=True, exist_ok=True)
    (out / "metrics.json").write_text(json.dumps(result, ensure_ascii=False, indent=2))
    print(json.dumps({k: v for k, v in result.items() if k != "points"}, ensure_ascii=False, indent=1))


def main() -> None:
    cmd, run, *rest = sys.argv[1:]
    mode = run.split("-")[0]
    state = load()
    login(state)
    save(state)
    c = client(state)
    pid = state.get(f"project_{run}")
    if cmd == "setup":
        name = rest[0] if rest else "Devex"
        r = c.post(
            "/projects",
            data={
                "name": name,
                "system_overview": (HERE / "input/overview.txt").read_text(),
                "goals_raw": (HERE / "input/goals.txt").read_text(),
                "mode": mode,
            },
        )
        print(r.status_code, r.text[:300])
        r.raise_for_status()
        state[f"project_{run}"] = r.json()["id"]
        save(state)
        for h in c.get(f"/projects/{r.json()['id']}/chat").json():
            print(f"--- {h.get('sender')}\n{h.get('message')}")
            show_cards(h.get("cards"))
        show_points(c, r.json()["id"])
    elif cmd == "say":
        msg = "" if rest[0] == "-" else pathlib.Path(rest[0]).read_text()
        answers = [{"card_id": a.split(":")[0], "option": int(a.split(":")[1])} for a in rest[1:]]
        out, cards = [], []
        body = {"message": msg, "card_answers": answers}
        with c.stream("POST", f"/projects/{pid}/chat", json=body) as r:
            event = None
            for line in r.iter_lines():
                if line.startswith("event: "):
                    event = line[7:]
                    if event == "error":
                        out.append("\n[ERROR EVENT]")
                elif line.startswith("data: ") and line != "data: [DONE]":
                    data = json.loads(line[6:])
                    if event == "cards":
                        cards = data.get("cards", [])
                    else:
                        out.append(data.get("delta") or json.dumps(data, ensure_ascii=False))
                    event = None
        print("".join(out))
        show_cards(cards)
        show_points(c, pid)
    elif cmd == "points":
        view = show_points(c, pid)
        if rest:
            lines = [f"scale={view['scale']} sufficient={view['is_sufficient']}"]
            for p in view["points"]:
                req = "必須" if p["required"] else "任意"
                lines.append(f"{p['key']} {req} {p['status']} {p['summary']}")
            pathlib.Path(rest[0]).write_text("\n".join(lines) + "\n")
    elif cmd == "impact":
        r = c.get(f"/projects/{pid}/design-stages/impact")
        r.raise_for_status()
        pathlib.Path(rest[0]).write_text(json.dumps(r.json(), ensure_ascii=False, indent=2))
        for st in r.json().get("stages", []):
            marks = st.get("marks") or []
            print(f"段階{st.get('stage')} 変わったもの {len(st.get('changes') or [])} 印 {len(marks)}")
    elif cmd == "dump":
        Driver(c, pid).dump(pathlib.Path(rest[0]))
    elif cmd == "metrics":
        metrics(c, pid, pathlib.Path(rest[0]))
    elif cmd == "history":
        lines = []
        for h in c.get(f"/projects/{pid}/chat").json():
            lines.append(f"--- {h.get('sender')}\n{h.get('message')}")
            for card in h.get("cards") or []:
                picked = card.get("selected")
                lines.append(
                    f"  [カード {card['point_key']}] {card['question']} / 選択肢: "
                    + " | ".join(o["label"] for o in card["options"])
                    + f" / おすすめ {card.get('recommended')} / 選んだ {picked}"
                )
        pathlib.Path(rest[0]).write_text("\n".join(lines) + "\n")
    elif cmd == "generate":
        r = c.post(f"/projects/{pid}/generate")
        print(r.status_code, r.text[:300])
        while True:
            time.sleep(5)
            status = c.get(f"/projects/{pid}").json().get("status")
            if status != "generating":
                print("status", status)
                break
    elif cmd == "docs":
        out = pathlib.Path(rest[0])
        out.mkdir(parents=True, exist_ok=True)
        for doc in c.get(f"/projects/{pid}/documents").json():
            r = c.get(f"/projects/{pid}/documents/{doc['id']}/download")
            (out / f"{doc['doc_type']}.md").write_bytes(r.content)
            print(doc["doc_type"], doc.get("version"), len(r.content))
    elif cmd in ("design", "procedure"):
        out = pathlib.Path(rest[0])
        out.mkdir(parents=True, exist_ok=True)
        d = Driver(c, pid)
        try:
            if cmd == "design":
                run_design(d, out, int(rest[1]) if len(rest) > 1 else 1)
            else:
                run_procedure(d, out)
        finally:
            d.dump(out / "stages")
            with (out / "operations.log").open("a") as f:
                f.write("\n".join(d.log) + "\n")
    elif cmd == "stages":
        for s in c.get(f"/projects/{pid}/design-stages").json():
            print(
                s.get("stage"), s.get("state"), s.get("version"), s.get("generation_status"),
                s.get("generation_error"), s.get("missing_inputs"),
                [i.get("code") for i in (s.get("issues") or [])],
            )


if __name__ == "__main__":
    main()
