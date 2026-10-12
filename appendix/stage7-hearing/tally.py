"""ヒアリングの回ごとに、潜在の事実を聞けたか・自由回答の採用・発言の数を数える(Phase 47)。

`stage6-effect/drive.py` が書き出した実行フォルダ(`metrics.json`・`chat_history.txt`)を読む。
外部の API・LLM は呼ばない。

    python3 appendix/stage7-hearing/tally.py <run_dir> [<run_dir> ...] [--out results.md]

フォルダ名の先頭(`detailed`・`simple`)をモードとみなし、モードごとに回の幅(最小〜最大)を出す。
"""

import argparse
import json
import pathlib
import re
from dataclasses import dataclass

# ペルソナの潜在の事実(stage6-baseline/persona.md)と、それを聞く観点
LATENT_POINTS: tuple[tuple[str, str], ...] = (
    ("L1", "availability"),
    ("L2", "backup"),
    ("L3", "performance"),
    ("L4", "security"),
    ("L5", "logging"),
    ("L6", "abuse"),
    ("L7", "exceptions"),
    ("L8", "operability"),
    ("L9", "environment"),
    ("L10", "migration"),
    ("L11", "exceptions"),
    ("L12", "future"),
    ("L13", "daily_flow"),
    ("L14", "data_retention"),
)
# Phase 47 で足した観点(ステージ6の回には無い)
ASPECT_POINTS = ("backup", "logging", "abuse", "data_retention")

_BLOCK = re.compile(r"^--- (\w+)\s*$")
_USER_LABEL = re.compile(r"^発言(\d+)$")


@dataclass(frozen=True)
class Point:
    key: str
    label: str
    status: str
    user_evidence: tuple[int, ...]  # 根拠の利用者の発言の番号(初期入力・添付は除く)


@dataclass(frozen=True)
class Run:
    name: str
    mode: str
    user_turns: int  # 生成までの利用者の発言の数
    points: dict[str, Point]
    free_adopted: tuple[str, ...]  # 自由回答なのに「採用」になった観点のキー

    def asked(self, key: str) -> bool | None:
        """観点が利用者の発言で決まったか(決定・採用・対象外)。観点が無い回は None。"""
        point = self.points.get(key)
        if point is None:
            return None
        return point.status != "open" and bool(point.user_evidence)


def user_messages(history: str) -> list[str]:
    """生成の前の利用者の発言(`--- user` の本文)を順に。生成の後(`--- others` 以降)は数えない。"""
    messages: list[str] = []
    sender: str | None = None
    lines: list[str] = []

    def flush() -> None:
        if sender == "user":
            messages.append("\n".join(lines).strip())

    for line in history.splitlines():
        match = _BLOCK.match(line)
        if match is None:
            lines.append(line)
            continue
        flush()
        sender, lines = match.group(1), []
        if sender == "others":
            sender = None
            break
    else:
        flush()
    return messages


def is_card_answer(message: str, label: str) -> bool:
    """その観点のカードを選んだ発言か(`【ラベル】選んだ選択肢` の行がある)。"""
    return any(line.startswith(f"【{label}】") for line in message.splitlines())


def load_run(run_dir: pathlib.Path) -> Run:
    metrics = json.loads((run_dir / "metrics.json").read_text())
    history_path = run_dir / "chat_history_before_generation.txt"
    if not history_path.exists():
        history_path = run_dir / "chat_history.txt"
    messages = user_messages(history_path.read_text())
    points: dict[str, Point] = {}
    free: list[str] = []
    for p in metrics["points"]["points"]:
        numbers = tuple(
            int(m.group(1))
            for e in p.get("evidence") or []
            if (m := _USER_LABEL.match(e.get("label", ""))) is not None
        )
        point = Point(p["key"], p["label"], p["status"], numbers)
        points[point.key] = point
        if point.status == "adopted" and numbers and not any(
            n <= len(messages) and is_card_answer(messages[n - 1], point.label) for n in numbers
        ):
            free.append(point.key)
    mode = "simple" if run_dir.name.startswith("simple") else "detailed"
    return Run(run_dir.name, mode, len(messages), points, tuple(free))


def _mark(value: bool | None) -> str:
    return "—" if value is None else ("○" if value else "×")


def render(runs: list[Run]) -> str:
    out = ["# ヒアリングの回ごとの数え上げ", ""]
    out.append("○ = 利用者の発言で決まった(決定・採用・対象外)/ × = 未決か、根拠が初期入力だけ / — = その版に観点が無い")
    out.append("")
    header = ["回", "モード", "発言", *(f for f, _ in LATENT_POINTS), "聞けた", "自由回答の採用"]
    out.append("| " + " | ".join(header) + " |")
    out.append("|" + "---|" * len(header))
    for run in runs:
        marks = [run.asked(key) for _, key in LATENT_POINTS]
        asked = sum(1 for m in marks if m)
        known = sum(1 for m in marks if m is not None)
        free = "・".join(run.points[k].label for k in run.free_adopted) or "なし"
        row = [run.name, run.mode, str(run.user_turns), *map(_mark, marks), f"{asked}/{known}",
               f"{len(run.free_adopted)}({free})"]
        out.append("| " + " | ".join(row) + " |")
    out += ["", "## モードごとの幅(最小〜最大)", ""]
    out.append("| モード | 回数 | 発言 | 聞けた潜在の事実 | 側面4つ(L2・L5・L6・L14) | 自由回答の採用 |")
    out.append("|---|---|---|---|---|---|")
    for mode in ("detailed", "simple"):
        group = [r for r in runs if r.mode == mode]
        if not group:
            continue
        turns = [r.user_turns for r in group]
        asked = [sum(1 for _, k in LATENT_POINTS if r.asked(k)) for r in group]
        aspects = [sum(1 for k in ASPECT_POINTS if r.asked(k)) for r in group]
        free = [len(r.free_adopted) for r in group]
        out.append(
            f"| {mode} | {len(group)} | {_span(turns)} | {_span(asked)} | {_span(aspects)} "
            f"| {_span(free)} |"
        )
    return "\n".join(out) + "\n"


def _span(values: list[int]) -> str:
    low, high = min(values), max(values)
    return str(low) if low == high else f"{low}〜{high}"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("runs", nargs="+", type=pathlib.Path)
    parser.add_argument("--out", type=pathlib.Path)
    args = parser.parse_args()
    text = render([load_run(d) for d in args.runs])
    if args.out:
        args.out.write_text(text)
    print(text, end="")


if __name__ == "__main__":
    main()
