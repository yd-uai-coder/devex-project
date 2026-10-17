"""Phase 71 の効果の確認(実際の Gemini)。複製したプロジェクトで、直した指示の生成を流す。

    cd appendix/stage8-effect
    PYTHONPATH=. uv run --project ../../devex-api/backend python phase71/drive71.py <simple|dfd|plan> <state の名前> <出力>

- simple: 実装計画書を作り直す(`start_from=implementation_plan`)。md と文書の一覧の行を書き出す。
- dfd: 段階2(DFD)と段階3(ER・CRUD)を作り直す。DFD のデータストアと段階3の指摘を書き出す。
- plan: 段階7(実装計画)を作り直す。マイルストーンのゴールと段階7の指摘を書き出す。

レビューは流さない(レビューの設定を一時的にオフにし、終わった後に元へ戻す)。承認はしない。
"""

import json
import pathlib
import sys

import drive


def _issues(row: dict) -> list[dict]:
    return [
        {"code": i.get("code"), "target": i.get("target"), "message": i.get("message")}
        for i in row.get("issues") or []
    ]


def run_simple(c, pid: str, out: pathlib.Path) -> None:
    r = c.post(f"/projects/{pid}/generate", json={"start_from": "implementation_plan"})
    print(r.status_code, r.text[:200])
    r.raise_for_status()
    drive.wait_generation(c, pid)
    for doc in c.get(f"/projects/{pid}/documents").json():
        if doc["doc_type"] == "implementation_plan":
            md = c.get(f"/projects/{pid}/documents/{doc['id']}/download").content
            (out / "implementation_plan.md").write_bytes(md)
            (out / "document.json").write_text(json.dumps(doc, ensure_ascii=False, indent=2))
            # 一覧の応答は指摘を持たないので、ゴールの警告は count.py と同じ関数で数える
            print("version", doc.get("version"))


def run_dfd(c, pid: str, out: pathlib.Path) -> None:
    d = drive.Driver(c, pid)
    d.generate(2)
    d.approve_diagrams("dfd")
    d.approve(2)
    d.generate(3)
    d.approve_diagrams("er")
    d.dump(out / "stages")
    row = d.stage(3)
    (out / "issues3.json").write_text(json.dumps(_issues(row), ensure_ascii=False, indent=2))
    (out / "log.md").write_text("\n".join(d.log) + "\n")


def run_plan(c, pid: str, out: pathlib.Path) -> None:
    d = drive.Driver(c, pid)
    d.generate(7)
    row = d.stage(7)
    (out / "stage7.json").write_text(json.dumps(row, ensure_ascii=False, indent=2))
    goals = [m["goal"] for m in row["model"].get("milestones", [])]
    (out / "issues7.json").write_text(
        json.dumps({"goals": goals, "issues": _issues(row)}, ensure_ascii=False, indent=2)
    )
    (out / "log.md").write_text("\n".join(d.log) + "\n")


def main() -> None:
    kind, name, out_dir = sys.argv[1:4]
    state = drive.load()
    drive.login(state)
    drive.save(state)
    c = drive.client(state)
    pid = state[f"project_{name}"]
    out = pathlib.Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    before = c.get("/users/me").json()["review_enabled"]
    c.put("/users/me/review-settings", json={"review_enabled": False}).raise_for_status()
    try:
        {"simple": run_simple, "dfd": run_dfd, "plan": run_plan}[kind](c, pid, out)
    finally:
        c.put("/users/me/review-settings", json={"review_enabled": before}).raise_for_status()
        print("review_enabled restored:", before)


if __name__ == "__main__":
    main()
