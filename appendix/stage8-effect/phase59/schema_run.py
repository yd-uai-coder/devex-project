"""59-6 のスキーマの確認: 複製の段階4 を作り直して承認し、段階5〜8 を drive.py の規則で進める。"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
import drive  # noqa: E402

state = drive.load()
drive.login(state)
drive.save(state)
d = drive.Driver(drive.client(state), state[f"project_{sys.argv[1]}"])
_approve = d.approve


def approve(n: int) -> dict:
    """段階4 を作り直したので、下流に届いた変更の影響の印を確認済みにしてから承認する。"""
    impact = d.c.get(f"/projects/{d.pid}/design-stages/impact").json()
    for st in impact.get("stages", []):
        keys = [m["key"] for m in st.get("marks") or [] if not m.get("reviewed") and not m.get("pending")]
        if st["stage"] == n and keys:
            r = d.c.post(f"/projects/{d.pid}/design-stages/{n}/impact/review", json={"keys": keys})
            d.note(f"  段階{n} の印 {len(keys)} 件を確認済みに: {r.status_code}")
    return _approve(n)


d.approve = approve  # type: ignore[method-assign]
out = pathlib.Path(sys.argv[2])
d.generate(4)
d.approve_diagrams("component")
d.approve(4)
drive.run_design(d, out, 5)
drive.run_procedure(d, out)
