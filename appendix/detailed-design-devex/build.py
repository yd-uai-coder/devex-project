"""Devex 詳細設計書(見本)を生成する。

実行(devex-api の仮想環境と app パッケージを使う。DB・env は不要):
    cd devex-api/backend
    PYTHONPATH=.:../../appendix/detailed-design-devex uv run python ../../appendix/detailed-design-devex/build.py

出力(このファイルと同じフォルダ):
    detailed-design.html  読む用。自己完結(CSS・スクリプト・図の SVG を中に持つ)
    detailed-design.md    差分・AI への入力用。リンクを持たず ID を本文に書く。図は diagrams/ の相対パス
    diagrams/*.svg, *.drawio

HTML の組み立て方は devex-ui のデモ(src/features/detailed-design/demo/procedureModel.ts の toHtml)と同じ。
"""

import html
import sys
from pathlib import Path

import content as c
import diagrams as dg

OUT = Path(__file__).resolve().parent
e = html.escape


# ---------------------------------------------------------------------------
# 05・06 の紐づけ(正本は手順の行の logic。逆引き・関与表はここで導く)
# ---------------------------------------------------------------------------

def step_id(pid: str, no: str) -> str:
    return f"{pid}#{no}"


def step_anchor(pid: str, no: str) -> str:
    return f"{pid}-{no}".lower()


def reverse_index() -> dict[str, list[tuple[str, str]]]:
    idx: dict[str, list[tuple[str, str]]] = {}
    for p in c.PROCEDURES:
        for s in p["steps"]:
            if s["logic"]:
                idx.setdefault(s["logic"], []).append((p["id"], s["no"]))
    return idx


def dangling_logic_refs() -> list[str]:
    known = {lg["id"] for lg in c.LOGICS}
    return [step_id(p["id"], s["no"]) for p in c.PROCEDURES for s in p["steps"] if s["logic"] and s["logic"] not in known]


def involvement() -> tuple[list[str], dict[str, dict[str, list[str]]]]:
    modules: list[str] = []
    cells: dict[str, dict[str, list[str]]] = {}
    for p in c.PROCEDURES:
        row: dict[str, list[str]] = {}
        for s in p["steps"]:
            if s["is_branch"] or "/" not in s["to"]:
                continue
            if s["to"] not in modules:
                modules.append(s["to"])
            row.setdefault(s["to"], []).append(s["no"])
        cells[p["id"]] = row
    return modules, cells


def linked_logics(p) -> list[str]:
    seen: list[str] = []
    for s in p["steps"]:
        if s["logic"] and s["logic"] not in seen:
            seen.append(s["logic"])
    return seen


def main_steps(p) -> int:
    return sum(1 for s in p["steps"] if not s["is_branch"])


def callee(s) -> str:
    return f"{s['to']}.{s['call']}" if s["call"] else s["to"]


# ---------------------------------------------------------------------------
# CRUD 図の色分け(決定#4): DFD の線の向きから決まる部分と、人が確定する部分
# ---------------------------------------------------------------------------

def dfd_derived() -> dict[tuple[str, str], set[str]]:
    """(処理, テーブル) → {"R", "W"}。ストア → 処理は R、処理 → ストアは W(書き込み)。"""
    stores = {eid for _, _, els, _ in c.DFDS for eid, kind, *_ in els if kind == "store"}
    out: dict[tuple[str, str], set[str]] = {}
    for _, _, _, flows in c.DFDS:
        for src, dst, _ in flows:
            if src in stores and dst.startswith("F-"):
                out.setdefault((dst, src), set()).add("R")
            elif dst in stores and src.startswith("F-"):
                out.setdefault((src, dst), set()).add("W")
    return out


def crud_cells() -> tuple[dict[tuple[str, str], list[tuple[str, str]]], list[str]]:
    derived = dfd_derived()
    cells: dict[tuple[str, str], list[tuple[str, str]]] = {}
    problems: list[str] = []
    for fid, row in c.CRUD.items():
        for table, ops in row.items():
            d = derived.get((fid, table), set())
            marked = []
            for op in ops:
                if op == "R" and "R" in d:
                    marked.append((op, "dfd"))
                elif op in "CUD" and "W" in d:
                    marked.append((op, "dfdw"))
                else:
                    marked.append((op, "human"))
            cells[(fid, table)] = marked
    # DFD の線が CRUD 図に現れていなければ食い違い
    for (fid, table), kinds in derived.items():
        ops = c.CRUD.get(fid, {}).get(table, "")
        if "R" in kinds and "R" not in ops:
            problems.append(f"{fid} × {table}: DFD に読みの線があるが CRUD に R が無い")
        if "W" in kinds and not set(ops) & set("CUD"):
            problems.append(f"{fid} × {table}: DFD に書き込みの線があるが CRUD に C/U/D が無い")
    return cells, problems


def data_item_usage() -> dict[str, list[str]]:
    usage: dict[str, list[str]] = {}
    for _, _, _, flows in c.DFDS:
        for src, dst, item in flows:
            for end in (src, dst):
                if end.startswith("F-") and end not in usage.setdefault(item, []):
                    usage[item].append(end)
    return usage


# ---------------------------------------------------------------------------
# HTML
# ---------------------------------------------------------------------------

STYLE = """
:root { --paper:#f5f6f8; --sheet:#fff; --ink:#1d2433; --muted:#5b6475; --rule:#d6dbe4; --head:#eef1f6;
  --accent:#1f5fae; --accent-soft:#e4edf9; --warn:#9a5b00; --warn-soft:#fbf1e0; --branch:#f6f1e7; --hl:#fdf3c4; --figure:#ffffff; color-scheme: light; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --paper:#151a23; --sheet:#1c2230; --ink:#e3e7ee; --muted:#9aa3b4; --rule:#2e3647;
  --head:#242c3c; --accent:#7fb0f0; --accent-soft:#1f3150; --warn:#f0b45c; --warn-soft:#3a2c14; --branch:#2a2618; --hl:#4a4215; color-scheme: dark; } }
:root[data-theme="dark"] { --paper:#151a23; --sheet:#1c2230; --ink:#e3e7ee; --muted:#9aa3b4; --rule:#2e3647;
  --head:#242c3c; --accent:#7fb0f0; --accent-soft:#1f3150; --warn:#f0b45c; --warn-soft:#3a2c14; --branch:#2a2618; --hl:#4a4215; color-scheme: dark; }
* { box-sizing: border-box; }
body { margin:0; padding-block:28px 72px; padding-inline:16px; background:var(--paper); color:var(--ink);
  font:14.5px/1.75 "BIZ UDPGothic","Hiragino Kaku Gothic ProN","Yu Gothic","Meiryo",sans-serif; }
.wrap { max-width:1120px; margin:0 auto; display:grid; gap:40px; }
h1 { font-size:1.7rem; margin:0; line-height:1.35; } h2 { font-size:1.3rem; margin:0; } h3 { font-size:1.02rem; margin:10px 0 0; }
p { margin:0; max-width:78ch; } .muted { color:var(--muted); font-size:0.88em; }
code, .mono { font-family:ui-monospace,SFMono-Regular,Consolas,monospace; font-size:0.88em; }
.note { border:1px solid var(--rule); background:var(--sheet); padding:10px 14px; color:var(--muted); font-size:0.9em; max-width:84ch; }
.principle { font-size:0.86em; color:var(--warn); background:var(--warn-soft); padding:6px 12px; border-radius:4px; justify-self:start; }
nav.toc { display:flex; flex-wrap:wrap; gap:6px 14px; font-size:0.9em; }
nav.toc a { color:var(--accent); text-decoration:none; }
section.chapter { display:grid; grid-template-columns:84px minmax(0,1fr); gap:22px; scroll-margin-top:12px; }
.rail { border-right:2px solid var(--rule); padding-right:14px; text-align:right; }
.rail .no { font-family:ui-monospace,Consolas,monospace; font-size:1.55rem; color:var(--accent); line-height:1; }
.rail .step { font-size:0.74rem; color:var(--muted); margin-top:6px; }
.body { display:grid; gap:14px; min-width:0; }
.scroll { overflow-x:auto; border:1px solid var(--rule); background:var(--sheet); }
table { border-collapse:collapse; width:100%; font-size:13px; }
th, td { border-bottom:1px solid var(--rule); padding:5px 9px; text-align:left; vertical-align:top; }
th { background:var(--head); white-space:nowrap; }
td.nowrap { white-space:nowrap; } td.c { text-align:center; white-space:nowrap; }
tr.branch td { background:var(--branch); } tr.branch td:first-child { font-weight:700; }
.hl, tr.hl td { background:var(--hl) !important; }
.figure { background:var(--figure); border:1px solid var(--rule); padding:10px; overflow-x:auto; }
.figure svg { display:block; max-width:none; height:auto; }
.caption { font-size:0.82em; color:var(--muted); }
a.badge { display:inline-block; padding:0 7px; border-radius:4px; background:var(--accent-soft); color:var(--accent);
  text-decoration:none; font-family:ui-monospace,Consolas,monospace; font-size:12px; margin:2px 2px 0 0; white-space:nowrap; }
a.badge:hover { text-decoration:underline; }
.op-dfd { color:var(--accent); font-weight:700; } .op-dfdw { color:var(--warn); font-weight:700; text-decoration:underline; text-decoration-color:var(--accent); text-decoration-thickness:2px; }
.op-human { color:var(--warn); font-weight:700; }
.legend { display:flex; flex-wrap:wrap; gap:6px 18px; font-size:0.84em; color:var(--muted); }
.tabs { display:flex; flex-wrap:wrap; gap:6px; }
.tabs a { padding:3px 10px; border:1px solid var(--rule); border-radius:4px; background:var(--sheet); color:var(--ink); text-decoration:none; font-size:13px; }
.tabs a[aria-selected="true"] { background:var(--accent); border-color:var(--accent); color:#fff; }
.panel { display:grid; gap:8px; padding:12px; border:1px solid var(--rule); background:var(--sheet); scroll-margin-top:12px; min-width:0; }
.js .panel:not(.active) { display:none; }
.cols { display:flex; flex-wrap:wrap; gap:16px; } .cols > * { flex:1 1 340px; min-width:0; }
ol { margin:0; padding-left:22px; } ol ol { list-style:lower-alpha; }
@media (max-width:640px) { section.chapter { grid-template-columns:1fr; gap:8px; }
  .rail { border-right:none; border-bottom:2px solid var(--rule); text-align:left; display:flex; gap:12px; align-items:baseline; padding:0 0 6px; } }
"""

SCRIPT = """
(function () {
  document.documentElement.classList.add("js");
  function show(group, id) {
    document.querySelectorAll('.panel[data-group="' + group + '"]').forEach(function (p) { p.classList.toggle("active", p.id === id); });
    document.querySelectorAll('.tabs[data-group="' + group + '"] a').forEach(function (a) {
      a.setAttribute("aria-selected", a.getAttribute("href") === "#" + id ? "true" : "false");
    });
  }
  function go() {
    var id = decodeURIComponent(location.hash.slice(1));
    var el = id && document.getElementById(id);
    if (!el) return;
    var panel = el.closest(".panel");
    if (panel) show(panel.dataset.group, panel.id);
    document.querySelectorAll(".hl").forEach(function (x) { x.classList.remove("hl"); });
    if (el !== panel && !el.matches("section")) el.classList.add("hl");
    el.scrollIntoView({ block: el === panel || el.matches("section") ? "start" : "center" });
  }
  document.querySelectorAll(".tabs[data-group]").forEach(function (t) {
    var first = document.querySelector('.panel[data-group="' + t.dataset.group + '"]');
    if (first) show(t.dataset.group, first.id);
  });
  document.addEventListener("click", function (ev) {
    var a = ev.target.closest && ev.target.closest('a[href^="#"]');
    if (a && a.getAttribute("href") === location.hash) { ev.preventDefault(); go(); }
  });
  window.addEventListener("hashchange", go);
  go();
})();
"""


def badge(href: str, label: str) -> str:
    return f'<a class="badge" href="#{e(href)}">{e(label)}</a>'


def table(headers: list[str], rows: list[list[str]], *, raw: bool = False, label: str = "") -> str:
    """rows のセルは raw=True なら HTML のまま、False ならエスケープする。"""
    head = "".join(f"<th>{e(h)}</th>" for h in headers)
    body = "".join("<tr>" + "".join(f"<td>{cell if raw else e(cell)}</td>" for cell in r) + "</tr>" for r in rows)
    aria = f' aria-label="{e(label)}"' if label else ""
    return f'<div class="scroll"><table{aria}><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table></div>'


def chapter(anchor: str, no: str, step: str, title: str, body: str) -> str:
    return (
        f'<section class="chapter" id="{anchor}"><div class="rail"><div class="no">{e(no)}</div>'
        f'<div class="step">{e(step)}</div></div><div class="body"><h2>{e(title)}</h2>{body}</div></section>'
    )


def tabs(group: str, items: list[tuple[str, str]]) -> str:
    links = "".join(f'<a href="#{e(a)}">{e(label)}</a>' for a, label in items)
    return f'<nav class="tabs" data-group="{group}">{links}</nav>'


def figure(d: dg.Diagram, caption: str = "") -> str:
    cap = f'<p class="caption">{e(caption)}</p>' if caption else ""
    return f'<div class="figure" role="img" aria-label="{e(d.title)}">{d.svg}</div>{cap}'


def build_html(diagrams: dict[str, dg.Diagram], crud: dict, crud_problems: list[str]) -> str:
    rev = reverse_index()
    procs = {p["id"] for p in c.PROCEDURES}
    parts: list[str] = []

    # 00
    toc = "".join(f'<a href="#{a}">{e(t)}</a>' for a, t in [
        ("ch01", "01 機能一覧"), ("ch02", "02 データフロー"), ("ch03", "03 データモデル"), ("ch04", "04 ソフトウェア構造"),
        ("ch05", "05 主要処理の手順"), ("ch06", "06 処理ロジックの詳細"), ("ch07", "07 横断事項"), ("appx", "付録 気づき")])
    parts.append(
        f'<header style="display:grid;gap:12px"><div class="muted">DEVEX ／ 詳細設計モード ／ 出力見本</div><h1>{e(c.TITLE)}</h1>'
        f'<p class="muted">{e(c.BASIS)}</p>'
        '<div class="note"><b>このページの位置づけ:</b> 詳細設計モード(ステージ4)が段階1〜6を承認した後に組み立てる詳細設計書を、'
        'Devex 自身を題材に手で作った見本です。中身は実際のコードから起こし、図は devex-api のレイアウト・出力エンジンで描きました。'
        '書式(章・ID・05/06 の紐づけ・HTML と md の出力)が想定どおりかと、Devex の要件・処理ロジックを確かめるために使います。'
        'バッジ(青い ID)を押すと、該当する処理・関数・手順へ移ります。</div>'
        f'<nav class="toc">{toc}</nav></header>'
    )

    # 01
    rows = []
    for fid, name, kind, trig, scr, init, grp, summ in c.FUNCTIONS:
        idcell = badge(fid.lower(), fid) if fid in procs else e(fid)
        rows.append([idcell, e(name), e(kind), f'<span class="mono">{e(trig)}</span>', e(scr), f'<span class="mono">{e(init)}</span>', e(grp), e(summ)])
    body = (
        '<p class="muted">外部設計の API 一覧・画面から処理を洗い出し、変わらない処理ID を振る。以降の章はすべてこの ID で参照する。'
        '青い処理ID は、05 に手順がある処理。</p>'
        + table(["処理ID", "名称", "種別", "トリガー", "関連画面", "グループの初期値", "機能グループ", "概要"], rows, raw=True, label="機能一覧")
        + f'<p class="caption">{e(c.GROUP_NOTE)}</p>'
    )
    parts.append(chapter("ch01", "01", "段階1", "機能(処理)一覧", body))

    # 02
    usage = data_item_usage()
    dfd_tabs = tabs("dfd", [(f"dfd-{k}", t) for k, t, _, _ in c.DFDS])
    panels = "".join(
        f'<section class="panel" data-group="dfd" id="dfd-{k}"><h3>{e(t)}</h3>{figure(diagrams[f"dfd-{k}"])}</section>'
        for k, t, _, _ in c.DFDS
    )
    di_rows = [[e(n), f'<span class="mono">{e(f)}</span>', e(d), e(", ".join(usage.get(n, [])) or "—")] for n, (f, d) in c.DATA_ITEMS.items()]
    sum_rows = [[badge(f.lower(), f) if f in procs else e(f), e(i), e(p), e(o)] for f, i, p, o in c.SUMMARY]
    body = (
        '<p class="muted">機能グループごとに DFD を1枚描く。処理の箱は段階1の処理ID、データストアはテーブル、線のラベルはデータ辞書の名前。</p>'
        f'<div class="principle">{e(c.DFD_PRINCIPLE)}</div>'
        + dfd_tabs + panels
        + '<p class="caption">図は devex-api のレイアウトエンジン(Phase 9)と SVG 出力(Phase 12)の実際の出力。</p>'
        + "<h3>データ辞書</h3>" + table(["データ項目", "フィールド", "説明", "使う処理"], di_rows, raw=True, label="データ辞書")
        + "<h3>処理概要表(入力 / 処理 / 出力)</h3>" + table(["処理ID", "入力", "処理内容", "出力"], sum_rows, raw=True, label="処理概要表")
    )
    parts.append(chapter("ch02", "02", "段階2", "データフロー", body))

    # 03
    er_tabs = tabs("er", [(f"er-{k}", t) for k, t, _, _ in c.ER_PARTS])
    er_panels = "".join(
        f'<section class="panel" data-group="er" id="er-{k}"><h3>{e(t)}</h3><div class="cols"><div>{figure(diagrams[f"er-{k}"])}</div>'
        + table(["テーブル", "列", "型", "キー", "NULL"], [
            [e(tb) if i == 0 else "", f'<span class="mono">{e(n)}</span>', f'<span class="mono">{e(ty)}</span>', "PK" if pk else ("FK" if fk else ""), "可" if nl else ""]
            for tb in tables for i, (n, ty, pk, fk, nl) in enumerate(c.TABLES[tb])
        ], raw=True)
        + "</div></section>"
        for k, t, tables, _ in c.ER_PARTS
    )
    note_rows = [[e(t), f'<span class="mono">{e(col)}</span>', e(cons), e(d)] for t, col, cons, d in c.TABLE_NOTES]
    crud_head = "<th>処理ID</th><th>名称</th>" + "".join(f'<th class="mono">{e(t)}</th>' for t in c.CRUD_TABLES)
    names = {f[0]: f[1] for f in c.FUNCTIONS}
    crud_rows = ""
    for fid in c.CRUD:
        cells = ""
        for t in c.CRUD_TABLES:
            ops = crud.get((fid, t))
            cells += '<td class="c">' + ("".join(f'<span class="op-{k}">{e(op)}</span>' for op, k in ops) if ops else "—") + "</td>"
        crud_rows += f'<tr><td class="mono">{e(fid)}</td><td>{e(names[fid])}</td>{cells}</tr>'
    crud_check = (
        '<p class="caption">DFD と CRUD 図の突き合わせ: 食い違いなし。</p>' if not crud_problems
        else "<ul>" + "".join(f"<li>{e(p)}</li>" for p in crud_problems) + "</ul>"
    )
    body = (
        '<p class="muted">段階2のデータストアとデータ辞書から ER とテーブル定義を下書きする。ER は1枚30要素までなので、部分図に分けた。</p>'
        + er_tabs + er_panels
        + f'<p class="caption">{e(c.TABLE_COMMON_NOTE)}</p>'
        + "<h3>テーブル定義の制約・補足</h3>" + table(["テーブル", "列", "制約", "説明"], note_rows, raw=True)
        + "<h3>CRUD 図(処理 × テーブル)</h3>"
        + f'<div class="scroll"><table aria-label="CRUD 図"><thead><tr>{crud_head}</tr></thead><tbody>{crud_rows}</tbody></table></div>'
        + '<div class="legend"><span><span class="op-dfd">R</span> DFD の線(ストア → 処理)から決定的に決まる</span>'
        '<span><span class="op-dfdw">C U D</span> 書き込みがあることは DFD の線(処理 → ストア)から決まり、C/U/D の区別は人が確定</span>'
        '<span><span class="op-human">R C U D</span> DFD に描いていない処理・線。AI が処理概要表から下書きし、人が確定</span></div>'
        '<p class="caption">認証の users R と、所有者の確認の projects R は全処理に共通なので省いた(07 横断事項)。F-04・F-05・F-37 は DB に書かず、読みも共通部分だけなので行を省いた。</p>'
        + crud_check
    )
    parts.append(chapter("ch03", "03", "段階3", "データモデル", body))

    # 04
    mod_rows = [[f'<span class="mono">{e(p)}</span>', e(l), e(r), f'<span class="mono">{e(d)}</span>', e(f)] for p, l, r, d, f in c.MODULES]
    body = (
        '<p class="muted">構造は「粗い図+責務の表」。図は層とパッケージの単位にとどめ(C4 のコンポーネント図、arc42 の Level 1)、ファイル単位の責務は表で書く(arc42 の Level 2)。</p>'
        + figure(diagrams["structure"], c.COMPONENT_NOTE)
        + "<h3>モジュール一覧</h3>" + table(["パス", "層", "責務", "主な依存先", "関わる処理"], mod_rows, raw=True, label="モジュール一覧")
        + f'<p class="caption">{e(c.MODULES_NOTE)}</p>'
    )
    parts.append(chapter("ch04", "04", "段階4", "ソフトウェア構造", body))

    # 05
    modules, inv = involvement()
    idx_rows = []
    for p in c.PROCEDURES:
        det = "".join(badge(lg.lower(), lg) for lg in linked_logics(p)) or "—"
        idx_rows.append([badge(p["id"].lower(), p["id"]), e(p["name"]), f'<span class="mono">{e(p["trigger"])}</span>', e(p["reason"]), str(main_steps(p)), det])
    inv_head = "<th>処理ID</th>" + "".join(f'<th class="mono">{e(m)}</th>' for m in modules)
    inv_rows = ""
    for p in c.PROCEDURES:
        tds = ""
        for m in modules:
            nos = inv[p["id"]].get(m, [])
            tds += '<td class="c">' + ("".join(badge(step_anchor(p["id"], n), n) for n in nos) or "—") + "</td>"
        inv_rows += f'<tr><td class="mono">{e(p["id"])}</td>{tds}</tr>'
    proc_panels = ""
    for i, p in enumerate(c.PROCEDURES, start=1):
        trs = ""
        for s in p["steps"]:
            sid = e(step_anchor(p["id"], s["no"]))
            if s["is_branch"]:
                trs += f'<tr class="branch" id="{sid}"><td class="mono">{e(s["no"])}</td><td colspan="5">{e(s["action"])}</td><td>{e(s["branch"])}</td></tr>'
                continue
            det = f'<br>{badge(s["logic"].lower(), "詳細 " + s["logic"] + " ↓")}' if s["logic"] else ""
            trs += (
                f'<tr id="{sid}"><td class="mono">{e(s["no"])}</td><td>{e(s["frm"])} → <span class="mono">{e(callee(s))}</span></td>'
                f'<td>{e(s["data"])}</td><td>{e(s["action"])}{det}</td><td>{e(s["result"])}</td><td class="mono">{e(s["db"])}</td><td>{e(s["branch"])}</td></tr>'
            )
        proc_panels += (
            f'<section class="panel" data-group="proc" id="{e(p["id"].lower())}"><h3>5.{i} {e(p["id"])} {e(p["name"])} '
            f'<span class="muted mono">{e(p["trigger"])}</span></h3>'
            '<div class="scroll"><table><thead><tr><th>No</th><th>呼び出し元 → 呼び出し先</th><th>渡すデータ</th><th>処理内容</th><th>結果</th><th>DB 操作</th><th>分岐・例外</th></tr></thead>'
            f'<tbody>{trs}</tbody></table></div><p class="muted">{e(p["note"])}</p></section>'
        )
    body = (
        '<p class="muted">シーケンス図の代わりの「番号付きの手順」。手順ID は処理ID と手順番号の組(例: F-12#7)で、文書全体で一意。</p>'
        '<div class="principle">重要な部分だけ: 手順を書くのは、利用者が選んだ4処理(コアループの F-09・F-12 と、UML の F-18・F-26)。</div>'
        + "<h3>5.0 索引</h3>" + table(["処理ID", "名称", "トリガー", "選定理由", "手順数", "詳細(06)"], idx_rows, raw=True, label="主要処理の索引")
        + "<h3>5.0.1 処理 × モジュール(セルは手順番号)</h3>"
        + f'<div class="scroll"><table aria-label="処理 × モジュール"><thead><tr>{inv_head}</tr></thead><tbody>{inv_rows}</tbody></table></div>'
        + "<h3>5.1〜 処理ごとの手順</h3>"
        + tabs("proc", [(p["id"].lower(), f'{p["id"]} {p["name"]}') for p in c.PROCEDURES])
        + proc_panels
    )
    parts.append(chapter("ch05", "05", "段階5", "主要処理の手順", body))

    # 06
    rev_rows = [[badge(lg["id"].lower(), lg["id"]), f'<span class="mono">{e(lg["fn"])}</span>', f'<span class="mono">{e(lg["module"])}</span>',
                 "".join(badge(step_anchor(pid, no), step_id(pid, no)) for pid, no in rev.get(lg["id"], [])) or "—"] for lg in c.LOGICS]
    logic_panels = ""
    for i, lg in enumerate(c.LOGICS, start=1):
        refs = "".join(badge(step_anchor(pid, no), "↑ " + step_id(pid, no)) for pid, no in rev.get(lg["id"], [])) or "—"
        spec = "".join(
            f'<tr><th>{e(k)}</th><td{" class=mono" if k == "シグネチャ" else ""}>{e(v).replace(chr(10), "<br>")}</td></tr>'
            for k, v in [("シグネチャ", lg["signature"]), ("引数", lg["args"]), ("戻り値", lg["returns"]), ("例外", lg["raises"]), ("事前条件", lg["pre"]), ("事後条件", lg["post"])]
        )
        pseudo = "".join(
            f"<li>{e(t)}" + (("<ol>" + "".join(f"<li>{e(x)}</li>" for x in sub) + "</ol>") if sub else "") + "</li>"
            for t, sub in lg["pseudo"]
        )
        caution = f'<p class="muted">注意: {e(lg["caution"])}</p>' if lg["caution"] else ""
        logic_panels += (
            f'<section class="panel" data-group="logic" id="{e(lg["id"].lower())}"><h3>6.{i} {e(lg["id"])} <span class="mono">{e(lg["fn"])}</span> '
            f'<span class="muted mono">{e(lg["module"])}</span></h3><p>呼ばれる手順: {refs}</p>'
            f'<div class="cols"><div class="scroll"><table><tbody>{spec}</tbody></table></div><ol>{pseudo}</ol></div>{caution}</section>'
        )
    body = (
        '<p class="muted">複雑な関数だけ、実装者が迷わない粒度で仕様を書く。擬似フローは番号付き(フローチャートの代わり)。</p>'
        + "<h3>6.0 逆引き(関数 × 手順)</h3>" + table(["L-ID", "関数", "モジュール", "呼ばれる手順"], rev_rows, raw=True, label="関数 × 手順")
        + "<h3>6.1〜 各関数</h3>"
        + tabs("logic", [(lg["id"].lower(), f'{lg["id"]} {lg["fn"]}') for lg in c.LOGICS])
        + logic_panels
    )
    parts.append(chapter("ch06", "06", "段階6・任意", "処理ロジックの詳細", body))

    # 07
    cc_rows = [[e(a), e(b), f'<span class="mono">{e(d)}</span>'] for a, b, d in c.CROSSCUTTING]
    err_rows = [[f'<span class="mono">{e(a)}</span>', e(b), e(d)] for a, b, d in c.ERRORS]
    body = (
        table(["観点", "方針", "置き場所"], cc_rows, raw=True)
        + "<h3>例外と HTTP の対応</h3>" + table(["HTTP", "例外(code)", "意味"], err_rows, raw=True)
    )
    parts.append(chapter("ch07", "07", "横断事項", "横断事項", body))

    # 付録
    f_rows = [[str(i), e(a), e(b), e(d), e(x)] for i, (a, b, d, x) in enumerate(c.FINDINGS, start=1)]
    body = (
        '<p class="muted">この設計書をコードから起こす過程で見つかった論点。事実・影響・確認したいことと、ユーザーが決めた対応方針を並べた(修正は Phase 15 で行う)。</p>'
        + table(["#", "事実", "影響", "確認したいこと", "対応方針(Phase 15)"], f_rows, raw=True, label="気づき")
    )
    parts.append(chapter("appx", "付録", "確認用", "設計書の作成で見つかった気づき", body))

    return (
        '<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        f"<title>Devex 詳細設計書</title><style>{STYLE}</style></head><body><div class=\"wrap\">"
        + "\n".join(parts)
        + f"</div><script>{SCRIPT}</script></body></html>\n"
    )


# ---------------------------------------------------------------------------
# Markdown(リンクを持たない。図は diagrams/ の相対パス)
# ---------------------------------------------------------------------------

def md_cell(text: str) -> str:
    return str(text).replace("|", "\\|").replace("\n", " ")


def md_table(headers: list[str], rows: list[list[str]]) -> list[str]:
    out = ["| " + " | ".join(headers) + " |", "|" + "|".join("---" for _ in headers) + "|"]
    out += ["| " + " | ".join(md_cell(x) for x in r) + " |" for r in rows]
    return out


def build_md(crud: dict) -> str:
    rev = reverse_index()
    L: list[str] = [f"# {c.TITLE}", "", c.BASIS, "",
                    "> 詳細設計モード(ステージ4)が段階1〜6を承認した後に組み立てる詳細設計書の見本。Devex 自身を題材に、実際のコードから起こした。"
                    "読むための形式は detailed-design.html。この md はリンクを持たず、ID を本文に書く(差分・AI への入力用)。", ""]

    L += ["## 01 機能(処理)一覧", ""]
    L += md_table(["処理ID", "名称", "種別", "トリガー", "関連画面", "グループの初期値", "機能グループ", "概要"], [list(f) for f in c.FUNCTIONS])
    L += ["", c.GROUP_NOTE, ""]

    usage = data_item_usage()
    L += ["## 02 データフロー", "", c.DFD_PRINCIPLE, ""]
    for k, t, _, _ in c.DFDS:
        L += [f"### DFD: {t}", "", f"![DFD: {t}](diagrams/dfd-{k}.svg)", ""]
    L += ["### データ辞書", ""] + md_table(["データ項目", "フィールド", "説明", "使う処理"], [[n, f, d, ", ".join(usage.get(n, [])) or "—"] for n, (f, d) in c.DATA_ITEMS.items()])
    L += ["", "### 処理概要表", ""] + md_table(["処理ID", "入力", "処理内容", "出力"], [list(s) for s in c.SUMMARY]) + [""]

    L += ["## 03 データモデル", ""]
    for k, t, tables, _ in c.ER_PARTS:
        L += [f"### ER: {t}", "", f"![ER: {t}](diagrams/er-{k}.svg)", ""]
        L += md_table(["テーブル", "列", "型", "キー", "NULL"], [
            [tb if i == 0 else "", n, ty, "PK" if pk else ("FK" if fk else ""), "可" if nl else ""]
            for tb in tables for i, (n, ty, pk, fk, nl) in enumerate(c.TABLES[tb])]) + [""]
    L += [c.TABLE_COMMON_NOTE, "", "### テーブル定義の制約・補足", ""] + md_table(["テーブル", "列", "制約", "説明"], [list(x) for x in c.TABLE_NOTES])
    names = {f[0]: f[1] for f in c.FUNCTIONS}
    mark = {"dfd": "", "dfdw": "*", "human": "?"}
    L += ["", "### CRUD 図", "", "記号: 無印 = DFD の線から決まる読み / `*` = 書き込みは DFD から決まり C/U/D の区別は人が確定 / `?` = DFD に無い。AI が下書きし人が確定", ""]
    L += md_table(["処理ID", "名称"] + c.CRUD_TABLES, [
        [fid, names[fid]] + ["".join(op + mark[k] for op, k in crud.get((fid, t), [])) or "—" for t in c.CRUD_TABLES] for fid in c.CRUD]) + [""]

    L += ["## 04 ソフトウェア構造", "", "![構成図(層)](diagrams/structure.svg)", "", c.COMPONENT_NOTE, "", "### モジュール一覧", ""]
    L += md_table(["パス", "層", "責務", "主な依存先", "関わる処理"], [list(m) for m in c.MODULES]) + ["", c.MODULES_NOTE, ""]

    modules, inv = involvement()
    L += ["## 05 主要処理の手順", "", "### 5.0 索引", ""]
    L += md_table(["処理ID", "名称", "トリガー", "選定理由", "手順数", "詳細(06)"],
                  [[p["id"], p["name"], p["trigger"], p["reason"], str(main_steps(p)), ", ".join(linked_logics(p)) or "—"] for p in c.PROCEDURES])
    L += ["", "### 5.0.1 処理 × モジュール(セルは手順番号)", ""]
    L += md_table(["処理ID"] + modules, [[p["id"]] + [", ".join(inv[p["id"]].get(m, [])) or "—" for m in modules] for p in c.PROCEDURES])
    for i, p in enumerate(c.PROCEDURES, start=1):
        L += ["", f"### 5.{i} {p['id']} {p['name']}", "", f"トリガー: {p['trigger']}", ""]
        rows = []
        for s in p["steps"]:
            if s["is_branch"]:
                rows.append([s["no"], s["action"], "", "", "", "", s["branch"]])
            else:
                act = s["action"] + (f" → 詳細: {s['logic']}" if s["logic"] else "")
                rows.append([s["no"], f"{s['frm']} → {callee(s)}", s["data"], act, s["result"], s["db"], s["branch"]])
        L += md_table(["No", "呼び出し元 → 呼び出し先", "渡すデータ", "処理内容", "結果", "DB 操作", "分岐・例外"], rows) + ["", p["note"]]

    L += ["", "## 06 処理ロジックの詳細", "", "### 6.0 逆引き(関数 × 手順)", ""]
    L += md_table(["L-ID", "関数", "モジュール", "呼ばれる手順"],
                  [[lg["id"], lg["fn"], lg["module"], ", ".join(step_id(a, b) for a, b in rev.get(lg["id"], [])) or "—"] for lg in c.LOGICS])
    for i, lg in enumerate(c.LOGICS, start=1):
        refs = ", ".join(step_id(a, b) for a, b in rev.get(lg["id"], [])) or "—"
        L += ["", f"### 6.{i} {lg['id']} {lg['fn']}", "", f"呼ばれる手順: {refs}", "", f"モジュール: {lg['module']}", ""]
        L += md_table(["項目", "内容"], [["シグネチャ", lg["signature"]], ["引数", lg["args"]], ["戻り値", lg["returns"]], ["例外", lg["raises"]], ["事前条件", lg["pre"]], ["事後条件", lg["post"]]])
        L.append("")
        for n, (t, sub) in enumerate(lg["pseudo"], start=1):
            L.append(f"{n}. {t}")
            L += [f"   - {x}" for x in sub]
        if lg["caution"]:
            L += ["", f"注意: {lg['caution']}"]

    L += ["", "## 07 横断事項", ""] + md_table(["観点", "方針", "置き場所"], [list(x) for x in c.CROSSCUTTING])
    L += ["", "### 例外と HTTP の対応", ""] + md_table(["HTTP", "例外(code)", "意味"], [list(x) for x in c.ERRORS])
    L += ["", "## 付録 設計書の作成で見つかった気づき", ""] + md_table(["#", "事実", "影響", "確認したいこと", "対応方針(Phase 15)"], [[str(i), *x] for i, x in enumerate(c.FINDINGS, start=1)])
    return "\n".join(L) + "\n"


def main() -> None:
    dangling = dangling_logic_refs()
    if dangling:
        sys.exit(f"06 に無い L-ID を参照している手順: {dangling}")
    crud, problems = crud_cells()
    diagrams = dg.build_all()
    (OUT / "diagrams").mkdir(exist_ok=True)
    for key, d in diagrams.items():
        (OUT / "diagrams" / f"{key}.svg").write_text(d.svg, encoding="utf-8")
        (OUT / "diagrams" / f"{key}.drawio").write_text(d.drawio, encoding="utf-8")
        for w in d.warnings:
            print(f"[警告] {key}: {w}")
    (OUT / "detailed-design.html").write_text(build_html(diagrams, crud, problems), encoding="utf-8")
    (OUT / "detailed-design.md").write_text(build_md(crud), encoding="utf-8")
    for p in problems:
        print(f"[CRUD と DFD の食い違い] {p}")
    print("生成しました:", ", ".join(sorted(diagrams)))


if __name__ == "__main__":
    main()
