# Phase-43-3: 印の記録と確認済み

## この章の目的

43-2 の差分から [42-4](../Phase-42/Phase-42-4.md) の `impact_of` で見直しが要る要素を求め、届いた段階に**印**として記録する。記録するのは、段階を承認した時(写しと比べる)と、文書の表示中の版が切り替わった時(前に表示していた版と比べる)。印を「確認済み」にでき、他から届いた未確認の印が残る段階は承認し直せない。[41-2](../Phase-41/Phase-41-2.md) 決定3(段階の「古い」の中に要素の印、全部確認済みで承認し直し)と、着手時の決定2〜4の実装。

自動実装モード: on([introduction](./Phase-43-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/detailed_design/impact/marks.py`](../samples/backend/app/detailed_design/impact/marks.py) | 新規 | `Mark`・`RecordedChange`・`StageImpact`(保存の形)・`marks_for`・`merged_elements`・`record`・`set_reviewed`・`blocking_marks`・`group_by_stage`・`stage_source`・`doc_source` |
| [`app/detailed_design/impact/__init__.py`](../samples/backend/app/detailed_design/impact/__init__.py) | 更新 | `marks` の re-export |
| [`app/services/errors.py`](../samples/backend/app/services/errors.py) | 更新 | `DesignStageUnreviewedImpactError`(409 `DESIGN_STAGE_UNREVIEWED_IMPACT`) |
| [`app/services/design_stage_service.py`](../samples/backend/app/services/design_stage_service.py) | 更新 | 承認を止める条件・承認での記録・段階3の写しに ER・`record_document_change`・`review_marks` |
| [`app/services/doc_generator_service.py`](../samples/backend/app/services/doc_generator_service.py) | 更新 | 生成・復元で、切り替える前の版の model と比べて記録する |
| ── ここからテスト ── | | |
| [`tests/fixtures/change_impact.py`](../samples/backend/tests/fixtures/change_impact.py) | 更新 | `create_impact_project`(段階1〜8 を承認済み・写しありで DB に作る) |
| [`tests/unit/test_impact_marks.py`](../samples/backend/tests/unit/test_impact_marks.py) | 新規 | 印の求め方・記録・確認済み・承認を止める印・保存の形 |
| [`tests/unit/test_design_stage_impact.py`](../samples/backend/tests/unit/test_design_stage_impact.py) | 新規 | 承認・文書の生成と復元での記録、承認を止める条件、確認済み(API の分は 43-4) |

re-export(#7): `from app.detailed_design.impact.marks import (Mark, RecordedChange, StageImpact, blocking_marks, doc_source, group_by_stage, marks_for, merged_elements, record, set_reviewed, stage_source)`。依存の向きは `marks` → `diff`・`elements`・`trace`。サービス → `impact`。`doc_generator_service` → `design_stage_service`(逆向きの import は無い)。

## 要点の抜粋

### 1. なぜ「変わった時に記録」か

写しは直前の承認の1件だけ(決定9)。上流の段階を承認し直すと写しが置き換わるので、その場で差分を取る方式では、下流の段階を見直す前に印が消える。そこで、変わった時(承認・文書の版の切り替え)に影響を求め、届いた段階の行(`design_stages.impact`)に残す(着手時の決定2)。

```
段階1を編集 ──(承認)──▶ 写し(段階1) と 今(段階1) の差分 ─▶ impact_of ─▶ 段階2〜8 の行に印
文書を再生成・復元 ─────▶ 前に表示していた版 と 今の版 の差分 ─▶ impact_of ─▶ 段階1〜8 の行に印
```

### 2. 印の形と求め方

```python
# app/detailed_design/impact/marks.py
@dataclass(frozen=True)
class Mark:
    key: str
    label: str
    stage: int
    path: tuple[str, ...]   # 変わった要素からこの要素までの道
    reason: str             # 最後の辺の種類から決まる文(EDGE_REASON)
    sources: tuple[str, ...]  # 出どころ: "stage:<N>" / "doc:<文書の種類>"
    reviewed: bool = False

def marks_for(before, after, changes, source) -> list[Mark]:
```

- 前と後の要素を合わせたグラフ(`merged_elements`)でたどる。消えた要素・改名の前のキーは後の要素に無いが、まだそれを参照している要素(別の段階の、まだ直していない行)から見つけるため。
- 文書の要素(置き場 0)と、変わった要素そのものには印を付けない(変えた人が見ているため)。

### 3. 記録と確認済み

```python
def record(existing: StageImpact, source, changes, marks) -> StageImpact:
def set_reviewed(impact, keys, reviewed) -> StageImpact:
def blocking_marks(impact, stage) -> list[Mark]:
```

- 同じ要素に新しい変更が届いたら、出どころを足して未確認に戻す(確認したのは前の変更だけのため)。
- 変わったもの(`changes`)は、その段階に印を付けたもの(印の道の先頭)だけを残す。
- 承認を止めるのは、他の段階・文書から届いた未確認の印だけ。自分の承認で付いた印(段階4のモジュールの依存のような、同じ段階の中の依存)は止めず、次の承認で置き換える。

### 4. サービスでの記録

```python
# app/services/design_stage_service.py(approve の抜粋)
if blocking_marks(StageImpact.from_dict(row.impact), stage):
    raise DesignStageUnreviewedImpactError(...)
...
row.impact = None  # 承認でこの段階の印は消える
er = await self._er_tables(project.id) if project.mode == "detailed" else {}
if row.approved_model and project.mode == "detailed":
    _record_stage_change(rows, documents, stage, row.approved_model, er)
row.approved_model = (
    {**row.model, ER_SNAPSHOT_KEY: er} if stage == DATA_MODEL_STAGE else row.model
)
```

- 印を記録するのは、一度でも承認した段階(`approved_version` あり)だけ。承認していない段階は、見直す前の内容が無い。
- 段階3の写しには、承認したときの ER のテーブル定義を `er_snapshot` で添える(43-2「ER のテーブル定義を内容に入れる」)。写しの無い段階・`er_snapshot` の無い写し(移行前)は、今の ER と比べる。
- `record_document_change(project, doc_type, before_model, after_model)` は、詳細設計モードで model を持つ文書(要件定義書・外部設計書)だけ。どちらかの版に model が無ければ比べない(全部が「消えた」になり、印が付きすぎるため)。commit は呼び出し元の版の切り替えと同じ。
- `review_marks(project, stage=..., keys=[...], reviewed=True)` は知らないキーを無視する。

### 5. 文書の生成・復元から呼ぶ

```python
# app/services/doc_generator_service.py(generate の抜粋)
previous_models[doc_type] = current.model if current is not None else None  # 生成の前
...
for doc_type in doc_types:
    await self._stages.record_document_change(
        project, doc_type, previous_models[doc_type], new_models[doc_type]
    )
```

文書ごとに、その文書だけを前の版にした model と比べる(他の文書は今の版)。出どころは文書の種類ごとに分かれる。

## 設計判断

### 承認を止める印から自分の印を外す

自分の承認で付いた印まで止めると、段階4のモジュールを1つ改名した後、同じ段階を直して承認し直すたびに、前の改名の印を確認済みにする手間が要る。自分の段階を承認する人は、その段階の中を見ているので、止める理由が無い。他から同じ要素に届いていれば止める。

### テーブルの変更は処理(段階1)にも印を付ける

`impact_of` はテーブルを使う処理(段階1)も示す(42-4 の規則3)。段階1は上流だが、処理の説明を見直すかを確かめる対象として残した。止めるのは段階1を承認し直すときだけ。過剰かどうかは Phase 49 で数える。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `marks_for`・`merged_elements`・`record`・`set_reviewed`・`blocking_marks`・`group_by_stage`・`StageImpact` | pytest(`test_impact_marks.py`) | スタブ不要 ── どれも純粋関数(副作用なし)で、DB や LLM を呼ばないため。前後の要素は fixture の model を書き換えて作る | 処理の変更(スモーク: 段階ごと・道・理由・出どころ・件数)、文書の要素と変えた要素には付けない、改名の前のキーを参照する要素に付く・直接だけ、前にだけ在る要素、新しい変更で未確認に戻る、自分の印・確認済みは止めない、保存の形の往復と壊れた項目 |
| `approve`(記録と止める条件)・`record_document_change`・`review_marks`・`generate`・`restore_version` の記録 | pytest(`test_design_stage_impact.py`) | インメモリ SQLite(`db_session`)を本物のリポジトリで使う。文書の生成の LLM は FakeLLM。段階1〜8 は `create_impact_project` が承認済みで直接作る(承認の検証は既存のテストが確かめる) | 段階1を直して承認 → 段階5に印(スモーク)、写しが無ければ記録しない、承認したことの無い段階には記録しない、段階3の写しの ER と比べる、復元・生成で記録、簡易モードと model の無い版は無視、未確認で 409 → 確認済みで承認・印が消える、自分の印は止めない、未確認に戻す・知らないキー |

```sh
cd devex-api/backend && uv run pytest tests/unit/test_impact_marks.py tests/unit/test_design_stage_impact.py
```
