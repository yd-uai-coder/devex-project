# Phase-52-1: レビューの入力と出力

## この章の目的

設計レビューで LLM に渡すもの(文書・観点の表・決定的な検証の指摘)と、LLM から受け取るもの(指摘の一覧)の形を、純粋関数のパッケージ `app/review/` にまとめる。[51-1](../Phase-51/Phase-51-1.md) の測定の (d) の組み立て(`appendix/stage8-baseline/review.py`)を本体へ移し、指摘に引用(evidence)と観点のキー(point_key)を足し、D-NAT-1(アクセス制御がヒアリングで落ちた「書かれていないこと」)を拾わせる指示を加える。

自動実装モード: on([introduction](./Phase-52-introduction.md) 参照)。

## この章で作成・更新したファイル

パスは `devex-api/backend/` から(#30 の依存順)。

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/review/schemas.py`](../samples/backend/app/review/schemas.py) | 新規 | 構造化出力のスキーマ `ReviewFindingOut`・`ReviewOutput` と、重要度・原因のラベル |
| [`app/review/prompt.py`](../samples/backend/app/review/prompt.py) | 新規 | 指示 `REVIEW_SYSTEM_PROMPT`・観点の表・既知の指摘の行・メッセージの組み立て |
| [`app/review/render.py`](../samples/backend/app/review/render.py) | 新規 | 指摘を重要度の順に並べ、チャットに出す md にする |
| [`app/review/policy.py`](../samples/backend/app/review/policy.py) | 新規 | レビューの実効値 `review_effective`(superuser かつ設定がオン) |
| [`app/review/known_issues.py`](../samples/backend/app/review/known_issues.py) | 新規 | 文書の model に決定的な検証を流し、既知の指摘にする |
| [`app/review/__init__.py`](../samples/backend/app/review/__init__.py) | 新規 | 上の re-export |
| ── ここからテスト ── | | |
| [`tests/fixtures/review.py`](../samples/backend/tests/fixtures/review.py) | 新規 | 指摘・レビューの結果の見本(軽微 → 最重要 → 中程度の順の3件) |
| [`tests/unit/test_review_prompt.py`](../samples/backend/tests/unit/test_review_prompt.py) | 新規 | 上の純粋関数のテスト |

## 要点の抜粋

### 1. パッケージの形

```python
# app/review/__init__.py
from app.review.known_issues import known_issues
from app.review.policy import review_effective
from app.review.prompt import REVIEW_SYSTEM_PROMPT, build_points_table, build_review_messages, format_known_issues
from app.review.render import render_findings, sort_findings
from app.review.schemas import CAUSE_LABEL, LEVEL_LABEL, REVIEW_LEVELS, ReviewCause, ReviewFindingOut, ReviewLevel, ReviewOutput
```

依存の向きは `schemas` ← `render`・`prompt`、`known_issues` と `policy` は単独。外へは `app.hearing`(観点の定義)・`app.documents`(文書の model と検証)・`app.detailed_design.procedure_doc`(文書の名前 `DESIGN_DOCUMENT_LABELS`)だけを読み、DB・LLM を呼ばない。

### 2. 指摘のスキーマ

```python
# app/review/schemas.py
class ReviewFindingOut(BaseModel):
    level: ReviewLevel            # critical / major / minor(#28 の3段階)
    cause: ReviewCause            # hearing / design / inconsistency
    targets: list[str]            # FR-001・SCR-002・『POST /api/v1/projects』など
    point_key: str | None = Field(description=...)   # 既定値を持たせない(下の判断)
    problem: str
    evidence: str                 # 文書からの抜き書き
    reason: str
    suggestion: str

    @field_validator("point_key")
    def _known_point_key(cls, value): ...   # 観点の表に無いキーは null
```

### 3. 入力の組み立て

```python
# app/review/prompt.py
def build_review_messages(documents, states, scale, issues) -> list[BaseMessage]:
    # System = REVIEW_SYSTEM_PROMPT
    # Human  = "# 設計書" + "## 要件定義書 …" … + "# ヒアリングの観点の表" + "# 決定的な検証の指摘(既知)"
```

- 観点の表は `| キー | 観点 | 必須 | 状態 | 内容 |`。51-1 の表にキーの列を足した(モデルが `point_key` に書く値を表から取れるように)。
- 指示は 51-1 の7つの観点に、「書かれていないことを見る」節を足した。浅いまま決まった観点(セキュリティが「ログインを入れる」だけ)で、その観点で普通決めること(誰が誰のデータを見られるか)が要件に無ければ、設計の指摘とは別に `cause=hearing` を1件立てさせる。

### 4. 既知の指摘

```python
# app/review/known_issues.py
def known_issues(models: Mapping[str, dict | None]) -> list[tuple[str, DocumentIssue]]:
```

プレビューと同じ `validate_*` を、保存した model に流す。model の無い版・壊れた model は飛ばす(md だけでレビューする)。

## 設計判断

### `point_key` に既定値を持たせない

実 LLM の確認([52-4](./Phase-52-4.md)・introduction「検証結果」)で、省略できる項目にしていた1回目の3回のうち1回、ヒアリングの指摘4件すべてで観点のキーを書かなかった。既定値を外すと JSON Schema の必須に入り、null を書くか値を書くかをモデルが選ぶ形になる。直した後の2回は毎回書いた。知らないキーは null に直す(聞き直す観点を作り出さない)。

### 文書の名前は既存の表を読む

`DESIGN_DOCUMENT_LABELS`(段階8の手順書が使う、4文書の名前)を読む。`doc_generator_service` の `_DOC_TYPE_LABELS` は非公開で、サービスの層を読むと純粋なパッケージがサービスに依存してしまうため。

## テスト観点

用語(SUT / ドライバ / スタブ)は [Phase 1](../Phase-01/Phase-01-introduction.md) で定義済み。

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `review_effective` | pytest(`test_review_prompt.py`) | スタブ不要 ── 純粋関数で外部依存を呼ばないため | superuser でなければ保存値がオンでもオフ |
| `build_points_table`・`format_known_issues`・`build_review_messages` | 同上 | 同上 | キー・必須・状態の列、規模が未決、既知の指摘が無いと「なし」、文書の並び |
| `known_issues` | 同上(要件定義書の model を `build_model` で作る) | 同上 | `validate_requirements` と同じ結果・model の無い版と壊れた model を飛ばす |
| `sort_findings`・`render_findings` | 同上(`tests/fixtures/review.py`) | 同上 | 重要度の順・件数の見出し・指摘が無いとき |
| `ReviewFindingOut` | 同上 | 同上 | 知らない観点のキーは null・`point_key` が JSON Schema の必須 |

```sh
cd devex-api/backend && uv run pytest tests/unit/test_review_prompt.py
```
