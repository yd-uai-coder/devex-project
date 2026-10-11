# Phase-36-1: 要件定義書の model と純粋関数(BE)

## この章の目的

要件定義書を「意味モデル(model)→ md」の形にするための土台を置く。要件を FR(機能)・NFR(非機能)・CON(制約)の行にし、ID・出どころ(ユーザー / 採用 / 推測)・根拠の観点を持たせる。ID の振り方(前の版の引き継ぎ)と、出どころに観点の表で上限をかける規則、md の組み立て、検証を、LLM も DB も呼ばない純粋関数で決める。model は版ごとに `generated_documents.model`(JSON)に持つ。

自動実装モード: on([introduction](./Phase-36-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/hearing/points.py`](../samples/backend/app/hearing/points.py) | 更新 | `as_scale`(`projects.hearing_scale` の値を規模にする) |
| [`app/hearing/__init__.py`](../samples/backend/app/hearing/__init__.py) | 更新 | `as_scale` の re-export |
| [`app/documents/__init__.py`](../samples/backend/app/documents/__init__.py) | 新規 | 上流の文書の意味モデルのパッケージ(Phase 37 で外部設計書を足す) |
| [`app/documents/requirements/model.py`](../samples/backend/app/documents/requirements/model.py) | 新規 | `RequirementRow`・`UserScene`・`RequirementsModel`、ID の形(`FR-001`) |
| [`app/documents/requirements/assemble.py`](../samples/backend/app/documents/requirements/assemble.py) | 新規 | 下書き → model(ID の引き継ぎ・出どころの上限・大項目の正規化)、推測 → 採用 |
| [`app/documents/requirements/markdown.py`](../samples/backend/app/documents/requirements/markdown.py) | 新規 | model → md(1.1〜1.6 と付録「観点の状態」) |
| [`app/documents/requirements/validation.py`](../samples/backend/app/documents/requirements/validation.py) | 新規 | 出どころの件数・検証の指摘(警告だけ) |
| [`app/documents/requirements/__init__.py`](../samples/backend/app/documents/requirements/__init__.py) | 新規 | 上の4つの re-export |
| [`app/models/generated_document.py`](../samples/backend/app/models/generated_document.py) | 更新 | 列 `model`(JSON、NULL 可) |
| [`app/repositories/generated_document.py`](../samples/backend/app/repositories/generated_document.py) | 更新 | `create_version(..., model=None)`・`replace_model`(同じ版を書き換える) |
| [`alembic/versions/c3d4e5f6a7b9_add_generated_document_model.py`](../samples/backend/alembic/versions/c3d4e5f6a7b9_add_generated_document_model.py) | 新規 | `generated_documents.model` を足す(既存の版は NULL のまま) |
| ── ここからテスト ── | | |
| [`tests/unit/test_requirements_doc.py`](../samples/backend/tests/unit/test_requirements_doc.py) | 新規 | `app/documents/requirements` の純粋関数 |
| [`tests/unit/test_generated_document_repository.py`](../samples/backend/tests/unit/test_generated_document_repository.py) | 更新 | 版ごとの model・同じ版の書き換え |

BE のパスは `devex-api/backend/` 基準。

## 要点の抜粋

```python
# app/documents/requirements/model.py
RequirementKind = Literal["FR", "NFR", "CON"]
RequirementSource = Literal["user", "adopted", "assumed"]

class RequirementRow(BaseModel):
    id: str                      # FR-001
    kind: RequirementKind
    priority: Priority | None    # FR だけ(MoSCoW)
    category: str                # NFR は IPA の大項目、CON は種類
    text: str
    source: RequirementSource
    points: list[str]            # 根拠の観点のキー

class RequirementsModel(BaseModel):
    purpose: str
    users: list[UserScene]
    in_scope: list[str]
    out_of_scope: list[str]
    rows: list[RequirementRow]
    next_seq: dict[str, int]          # 種別ごとの次の番号(消えた ID を使い回さない)
    point_statuses: dict[str, str]    # 生成した時点の観点の状態(付録・検証が読む)
    scale: str | None
```

```python
# app/documents/requirements/assemble.py
def assign_ids(kinds_and_prev, previous) -> tuple[list[str], dict[str, int]]:
    """prev_id が前の版に在り、種別が同じで、まだ使われていなければ引き継ぐ。それ以外は次の番号。"""

def cap_source(source, points, states) -> RequirementSource:
    """根拠の観点(規模を除く)のうち最も強い状態が上限: 決定 → ユーザー、採用 → 採用、未決・対象外 → 推測。"""

def build_model(draft: RequirementsDraft, previous, states, scale) -> RequirementsModel: ...
def mark_adopted(model, req_id) -> RequirementsModel | None: ...  # 推測の行だけ「採用」に
```

```python
# app/documents/requirements/__init__.py(re-export の形)
from app.documents.requirements.assemble import (RequirementDraft, RequirementsDraft, UserSceneDraft,
    assign_ids, build_model, cap_source, known_points, mark_adopted)
from app.documents.requirements.markdown import render_requirements, source_cell
from app.documents.requirements.model import (PRIORITIES, REQUIREMENT_KINDS, SOURCE_LABEL, ...,
    RequirementRow, RequirementsModel, UserScene, parse_requirement_id, requirement_id)
from app.documents.requirements.validation import (IssueLevel, RequirementIssue, source_counts,
    validate_requirements)
```

依存の向き: `assemble.py`・`markdown.py`・`validation.py` はどれも `model.py` を読み(互いには読まない)、`app.hearing`(観点の定義・状態・`as_scale`)を読む。`markdown.py` は表の組み立てに既存の `app/detailed_design/document/markdown.py` の `md_table`(Phase 22-3)を使う。モデル・リポジトリは `app.documents` を読まない(model は JSON の値のまま持つ)。

## 設計判断

### ID は AI に振らせず、前の版を指させる

AI に `FR-001` を書かせると、再生成のたびに番号が揺れる。後の Phase で段階1の `req_ids` やステージ7の変更追跡が ID で要件を指すので、揺れると壊れる。段階1の処理ID(`function_list.merge_draft`)と同じく、AI には「前の版の同じ要件の ID」(`prev_id`)だけを書かせ、引き継ぐかはコードが確かめる。前の版に無い ID・種別違い・同じ ID の2回目は、新しい番号にする。消えた ID は使い回さない(`next_seq`)。別の要件に同じ ID が付くと、古い参照が黙って別物を指すため。

### 出どころは観点の表で上限をかける

AI が「ユーザー」と書いても、根拠の観点が未決なら「推測」にする。観点が「AI の提案を採用」なら「採用」まで。Phase 34 の「根拠の無い決定は取り込まない」と同じ考え方で、ベースライン([33-1](../Phase-33/Phase-33-1.md))で多かった「利用者が言っていない記述」を、AI の自己申告に頼らずに「推測」として見えるようにする。上限は根拠の観点のうち最も強い状態で決める(1行が複数の観点にまたがるとき、決まった観点に基づいていれば足りる)。規模だけは上限を上げる根拠にしない。規模はほぼ必ず決まるので、どの要件にも付けて「ユーザー」にできてしまうため。

逆向き(AI が「推測」と書いたのを上げる)はしない。決まった観点の中でも、AI が補った細部は推測でありうるため。

### 生成した時点の観点の状態を model に写す

付録「観点の状態」と検証は、今の観点の表でなく、生成した時点の表(`point_statuses`・`scale`)を読む。生成の後にチャットで観点が決まっても、この版の md は「この表で書いた」ままにするため。また「採用にする」([36-2](./Phase-36-2.md))で md を組み立て直しても、付録が変わらない。

### md の見出しは以前のまま

`# 1. 要件定義書` と 1.1〜1.6 の見出しは今の要件定義書と同じにした。後続(外部設計書の生成・段階2/4/7/8・自己診断)は md を読むので、見出しが変わると読み落とす。1.4 は箇条書きから表に変わるので、表を読む側([36-2](./Phase-36-2.md) の手順書の対象外)を合わせる。推測は `**推測**` と太字にし、表の後に「利用者に確かめてください」を添える(見本 [`requirements.md`](../../appendix/structured-requirements-sample/requirements.md) と同じ形)。

### 検証は警告だけ

ID の重複・形の誤りは `assign_ids` が起こさないので、検証しない。挙げるのは利用者に確かめてほしいことだけ: Must の機能要件が無い(中程度)・必須の観点が未決のまま生成した(中程度)・対象外の観点だけを根拠にした要件(軽微)・推測の要件がある(軽微。件数)。生成も保存も止めない。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `app/documents/requirements`(`model`・`assemble`・`markdown`・`validation`)と `__init__.py` の re-export、`app.hearing.as_scale` | pytest(`test_requirements_doc.py`) | スタブ不要 ── 対象が純粋(副作用なし)で、LLM・DB を呼ばないため。観点の表は `PointState` を直接作って渡す | 第一テスト(統合スモーク): ID の往復。続けて、種別ごとの番号・引き継ぎと使い回さない番号・前の版に無い/種別違い/重複の `prev_id`、上限の4パターン・根拠の無い行・規模だけの行・最も強い観点、下書きからの model(正規化・写した状態)、`mark_adopted`、md の見出し・`**推測**`・付録、空の model、検証の各コード、指摘の無い model |
| `GeneratedDocumentRepository.create_version`・`replace_model`、`GeneratedDocument.model` | pytest(`test_generated_document_repository.py`) | スタブ不要 ── 永続化そのものが対象なので、インメモリ SQLite の `db_session` を使う | 版ごとの model(持たない版は NULL)、同じ版の書き換え(版が増えない) |

マイグレーションは、開発用 DB で `upgrade head` → `downgrade -1` → `upgrade head` の往復で確かめた(head = `c3d4e5f6a7b9`)。

```sh
cd devex-api/backend && uv run pytest tests/unit/test_requirements_doc.py tests/unit/test_generated_document_repository.py
```
