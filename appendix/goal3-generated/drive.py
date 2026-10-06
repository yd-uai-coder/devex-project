"""ローカルの devex-api を叩いてヒアリング・生成を進める使い捨てスクリプト。

usage:
  drive.py setup <mode> <overview_file> <goals_file>
  drive.py say <mode> <message_file>
  drive.py history <mode>
  drive.py check <mode>
  drive.py generate <mode>
  drive.py docs <mode> <out_dir>
  drive.py stages <mode>
  drive.py stage_gen <mode> <n>
  drive.py stage_approve <mode> <n>
  drive.py bundle <mode> <out_file>
"""

import json
import pathlib
import sys
import uuid

import httpx

BASE = "http://localhost:8000/api/v1"
HERE = pathlib.Path(__file__).parent
STATE = HERE / "state.json"


def load() -> dict:
    return json.loads(STATE.read_text()) if STATE.exists() else {}


def save(state: dict) -> None:
    STATE.write_text(json.dumps(state, ensure_ascii=False, indent=2))


def client(state: dict) -> httpx.Client:
    return httpx.Client(
        base_url=BASE,
        headers={"Authorization": f"Bearer {state['token']}"},
        timeout=600,
    )


def login(state: dict) -> None:
    if "token" in state:
        r = httpx.get(f"{BASE}/projects", headers={"Authorization": f"Bearer {state['token']}"})
        if r.status_code == 200:
            return
    if "email" not in state:
        state["email"] = f"goal3-{uuid.uuid4().hex[:8]}@example.com"
        state["password"] = "Goal3-" + uuid.uuid4().hex
        r = httpx.post(
            f"{BASE}/auth/register",
            json={"email": state["email"], "password": state["password"], "full_name": "goal3"},
        )
        print("register", r.status_code, r.text[:200])
    r = httpx.post(f"{BASE}/auth/login", json={"email": state["email"], "password": state["password"]})
    r.raise_for_status()
    state["token"] = r.json()["access_token"]


def main() -> None:
    cmd, mode, *rest = sys.argv[1:]
    state = load()
    login(state)
    save(state)
    c = client(state)
    pid = state.get(f"project_{mode}")
    if cmd == "setup":
        overview = pathlib.Path(rest[0]).read_text()
        goals = pathlib.Path(rest[1]).read_text()
        name = rest[2] if len(rest) > 2 else "Devex"
        r = c.post(
            "/projects",
            data={"name": name, "system_overview": overview, "goals_raw": goals, "mode": mode},
        )
        print(r.status_code, r.text[:300])
        r.raise_for_status()
        state[f"project_{mode}"] = r.json()["id"]
        save(state)
        hist = c.get(f"/projects/{r.json()['id']}/chat").json()
        for h in hist:
            print(f"--- {h.get('sender')}\n{h.get('message')}")
    elif cmd == "say":
        msg = pathlib.Path(rest[0]).read_text()
        out = []
        with c.stream("POST", f"/projects/{pid}/chat", json={"message": msg}) as r:
            for line in r.iter_lines():
                if line.startswith("event: error"):
                    out.append("\n[ERROR EVENT]")
                if line.startswith("data: ") and line != "data: [DONE]":
                    d = json.loads(line[6:])
                    out.append(d.get("delta") or json.dumps(d, ensure_ascii=False))
        print("".join(out))
        check = c.get(f"/projects/{pid}/hearing-completion").json()
        print("\n=== hearing-completion:", json.dumps(check, ensure_ascii=False))
    elif cmd == "history":
        for h in c.get(f"/projects/{pid}/chat").json():
            print(f"--- {h.get('sender')}\n{h.get('message')}")
    elif cmd == "check":
        print(json.dumps(c.get(f"/projects/{pid}/hearing-completion").json(), ensure_ascii=False, indent=2))
    elif cmd == "generate":
        r = c.post(f"/projects/{pid}/generate")
        print(r.status_code, r.text[:300])
    elif cmd == "docs":
        out = pathlib.Path(rest[0])
        out.mkdir(parents=True, exist_ok=True)
        proj = c.get(f"/projects/{pid}").json()
        print("status", proj.get("status"))
        for d in c.get(f"/projects/{pid}/documents").json():
            r = c.get(f"/projects/{pid}/documents/{d['id']}/download")
            (out / f"{d['doc_type']}.md").write_bytes(r.content)
            print(d["doc_type"], d.get("version"), len(r.content))
    elif cmd == "stages":
        for s in c.get(f"/projects/{pid}/design-stages").json():
            print(
                s.get("stage"), s.get("state"), s.get("version"), s.get("generation_status"),
                s.get("generation_error"), s.get("missing_inputs"),
                [i.get("code") for i in (s.get("issues") or [])],
            )
    elif cmd == "stage_gen":
        body = json.loads(rest[1]) if len(rest) > 1 and rest[1] else None
        r = c.post(f"/projects/{pid}/design-stages/{rest[0]}/generate", json=body)
        print(r.status_code, r.text[:300])
    elif cmd == "stage_approve":
        stages = {s["stage"]: s for s in c.get(f"/projects/{pid}/design-stages").json()}
        r = c.post(
            f"/projects/{pid}/design-stages/{rest[0]}/approve",
            json={"version": stages[int(rest[0])]["version"]},
        )
        print(r.status_code, r.text[:300])
    elif cmd == "dump":
        out = pathlib.Path(rest[0]); out.mkdir(parents=True, exist_ok=True)
        for s in c.get(f"/projects/{pid}/design-stages").json():
            (out / f"stage{s['stage']}.json").write_text(json.dumps(s, ensure_ascii=False, indent=2))
    elif cmd == "diagrams":
        for d in c.get(f"/projects/{pid}/uml/diagrams").json():
            print(d["id"], d.get("diagram_type"), d.get("status"), d.get("version"), d.get("name") or d.get("title"), d.get("generation_status"))
            if len(rest) and rest[0] == "approve" and d.get("status") not in ("approved", "exported"):
                r = c.post(f"/projects/{pid}/uml/diagrams/{d['id']}/layout")
                print("  layout", r.status_code, r.text[:200] if r.status_code != 200 else "")
                if r.status_code == 200:
                    r = c.post(f"/projects/{pid}/uml/diagrams/{d['id']}/approve", json={"version": r.json()["version"]})
                    print("  approve", r.status_code, r.text[:200] if r.status_code != 200 else "")
    elif cmd == "bundle":
        r = c.get(f"/projects/{pid}/design-stages/document")
        print(r.status_code, len(r.content))
        pathlib.Path(rest[0]).write_bytes(r.content)


if __name__ == "__main__":
    main()
