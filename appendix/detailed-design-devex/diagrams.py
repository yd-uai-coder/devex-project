"""content.py の図の定義を devex-api の意味モデルへ変換し、実エンジンで SVG・drawio を出力する。

devex-api/backend を PYTHONPATH に入れて実行する(build.py 参照)。
"""

import uuid
from dataclasses import dataclass

from app.uml.domain import (
    ComponentElement,
    ComponentRelation,
    ComponentSemanticModel,
    DfdDataStore,
    DfdExternalEntity,
    DfdFlow,
    DfdProcess,
    ErColumn,
    ErElement,
    ErRelation,
    ErSemanticModel,
)
from app.uml.export import build_render, to_drawio, to_svg
from app.uml.layout import compute_layout, edge_labels
from app.uml.validation import validate_diagram

import content as c

# データ項目の名前 → 決定的な UUID(再生成しても変わらない)
_NS = uuid.UUID("6f1d3c2a-9b8e-4f7a-a1b2-c3d4e5f60718")
DATA_ITEM_IDS = {name: uuid.uuid5(_NS, name) for name in c.DATA_ITEMS}


@dataclass
class Diagram:
    key: str
    title: str
    svg: str
    drawio: str
    warnings: list[str]


def _render(key: str, title: str, model, labels: dict[str, str], data_item_ids=None, referenced_elsewhere=None) -> Diagram:
    result = validate_diagram(model, data_item_ids=data_item_ids, referenced_elsewhere=referenced_elsewhere)
    if not result.is_valid:
        raise SystemExit(f"{key}: 検証エラー {[e.message for e in result.errors]}")
    layout = compute_layout(key, model, labels)
    render = build_render(model, layout, labels)
    return Diagram(
        key=key,
        title=title,
        svg=to_svg(render),
        drawio=to_drawio(render, diagram_id=key, title=title),
        warnings=[w.message for w in result.warnings],
    )


def dfd(key: str, title: str, elements, flows) -> Diagram:
    elems = []
    for eid, kind, name, desc, lane in elements:
        if kind == "process":
            elems.append(DfdProcess(id=eid, name=name, description=desc or None, layer=lane))
        elif kind == "entity":
            elems.append(DfdExternalEntity(id=eid, name=name))
        else:
            elems.append(DfdDataStore(id=eid, name=name))
    rels = [
        DfdFlow(id=f"f{i}", source_id=src, target_id=dst, data_item_id=DATA_ITEM_IDS[item])
        for i, (src, dst, item) in enumerate(flows, start=1)
    ]
    from app.uml.domain import DfdSemanticModel

    model = DfdSemanticModel(elements=elems, relations=rels)
    labels = edge_labels(model, {v: k for k, v in DATA_ITEM_IDS.items()})
    # 製品と同じく、未参照のデータ項目は全 DFD を横断して判定する(他の DFD が参照している項目を渡す)
    elsewhere = {DATA_ITEM_IDS[item] for k, _, _, fl in c.DFDS if k != key.removeprefix("dfd-") for _, _, item in fl}
    return _render(key, title, model, labels, data_item_ids=set(DATA_ITEM_IDS.values()), referenced_elsewhere=elsewhere)


def er(key: str, title: str, tables: list[str], relations) -> Diagram:
    elems = [
        ErElement(
            id=t,
            name=t,
            columns=[
                ErColumn(name=n, type=ty, is_primary_key=pk, is_foreign_key=fk, nullable=nl)
                for n, ty, pk, fk, nl in c.TABLES[t]
            ],
        )
        for t in tables
    ]
    rels = [
        ErRelation(id=f"r{i}", source_id=a, target_id=b, relation_type=m)
        for i, (a, b, m) in enumerate(relations, start=1)
    ]
    model = ErSemanticModel(elements=elems, relations=rels)
    labels = {r.id: ("1:N" if r.relation_type == "one_to_many" else "1:1") for r in rels}
    return _render(key, title, model, labels)


def component() -> Diagram:
    elems = [ComponentElement(id=i, name=n, description=d, layer=lane) for i, n, d, lane in c.COMPONENTS]
    rels = [ComponentRelation(id=f"d{i}", source_id=a, target_id=b) for i, (a, b) in enumerate(c.COMPONENT_DEPS, start=1)]
    model = ComponentSemanticModel(elements=elems, relations=rels)
    return _render("structure", "構成図(層)", model, {})


def build_all() -> dict[str, Diagram]:
    out: dict[str, Diagram] = {}
    for key, title, elements, flows in c.DFDS:
        out[f"dfd-{key}"] = dfd(f"dfd-{key}", f"DFD: {title}", elements, flows)
    for key, title, tables, rels in c.ER_PARTS:
        out[f"er-{key}"] = er(f"er-{key}", f"ER: {title}", tables, rels)
    out["structure"] = component()
    return out
