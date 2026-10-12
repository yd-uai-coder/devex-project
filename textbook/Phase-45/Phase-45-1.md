# Phase-45-1: 内部設計書の model(組み立て・md・検証・下書き)

## この章の目的

簡易モードの内部設計書を、要件定義書([Phase 36](../Phase-36/Phase-36-introduction.md))・外部設計書([Phase 37](../Phase-37/Phase-37-introduction.md))と同じ「構造化出力 → model → md」にするための部品を作る。テーブル・API・モジュール・処理別データフローを行として持ち、処理別データフローの ID を再生成で引き継ぎ、書き落とし(外部設計書の API に処理が無いなど)を検証する。生成への組み込みは 45-3。

自動実装モード: on([introduction](./Phase-45-introduction.md) 参照)。

## この章で作成・更新したファイル

`textbook/samples/backend/` 配下(表は依存順。#30)。

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/documents/internal_design/model.py`](../samples/backend/app/documents/internal_design/model.py) | 新規 | 内部設計書1版の中身(`InternalDesignModel`)と行の型、DF の ID の形(`dataflow_id`・`dataflow_seq`) |
| [`app/documents/internal_design/assemble.py`](../samples/backend/app/documents/internal_design/assemble.py) | 新規 | AI の下書き(`InternalDesignDraft`)から model を組み立てる。DF の ID の引き継ぎ・API の正規化 |
| [`app/documents/internal_design/markdown.py`](../samples/backend/app/documents/internal_design/markdown.py) | 新規 | model から今までと同じ見出しの md を組み立てる。本文の見出しを太字にする(`body_text`) |
| [`app/documents/internal_design/validation.py`](../samples/backend/app/documents/internal_design/validation.py) | 新規 | 行数(`row_counts`)と検証(`validate_internal_design`) |
| [`app/documents/internal_design/drafting.py`](../samples/backend/app/documents/internal_design/drafting.py) | 新規 | 構造化出力のスキーマ・プロンプト・メッセージ・下書きへの変換 |
| [`app/documents/internal_design/__init__.py`](../samples/backend/app/documents/internal_design/__init__.py) | 新規 | re-export(`drafting` は出さない。外部設計書と同じ) |
| ── ここからテスト ── | | |
| [`tests/unit/test_internal_design_doc.py`](../samples/backend/tests/unit/test_internal_design_doc.py) | 新規 | 組み立て・ID の引き継ぎ・md を古い版の解析で読めること・検証・下書きの変換 |

依存の向き: `assemble`・`markdown`・`validation` → `model`。`drafting` → `assemble`(下書きの型)。どれも `app.detailed_design` の部品(`api_list`・`structure.ModuleRow`・`document.markdown.md_table`)を読むが、`app.detailed_design` からこのパッケージへは 45-4 で `model`・`markdown` のモジュールだけを読む(`__init__` を読むと循環するため。45-4)。

```python
# app/documents/internal_design/__init__.py
from app.documents.internal_design.assemble import (ColumnDraft, DataFlowDraft, ..., build_model)
from app.documents.internal_design.markdown import (body_text, data_model_body, dataflow_body,
                                                    render_internal_design, table_body)
from app.documents.internal_design.model import (DATAFLOW_PREFIX, ColumnRow, DataFlowRow, ...,
                                                 InternalDesignModel, TableDef, dataflow_id, dataflow_seq)
from app.documents.internal_design.validation import row_counts, validate_internal_design
```

## 要点の抜粋

### 1. model

```python
# app/documents/internal_design/model.py
class DataFlowRow(BaseModel):
    id: str            # DF-1(AI には書かせない)
    trigger: str       # "POST /api/v1/x" かバッチ名
    flows: list[FlowRow]          # 元 / データ / 変換 / 先
    data_items: list[DataItem]    # - データ項目: 名前(フィールド…)

    @property
    def match_key(self) -> str:   # 前の版の同じ処理を探すキー
        return trigger_key(self.trigger) or f"batch:{...}"

class InternalDesignModel(BaseModel):
    architecture: str; data_model_note: str; tables: list[TableDef]
    module_policy: str; apis: list[InternalApiRow]; modules: list[ModuleRow]
    dataflows: list[DataFlowRow]; error_policy: str
    external_apis: list[str]      # 生成した時点の外部設計書の API(検証が読む写し)
    next_dataflow_seq: int = 1    # 消えた ID を使い回さない
```

- 今の md の見出しに合わせ、表になる部分は行、説明の節(3.1・3.2 の概要・3.3 の分割方針・3.4)は本文の文字列にした(着手時の相談 3)。
- モジュール一覧は段階4と同じ `ModuleRow`(#17)。段階8の `SimpleDesignBook.modules` がそのまま使える(45-4)。
- DF の ID の形は今までどおり `DF-1`(ゼロ埋めしない)。段階8・実装計画書・既存の手順書がこの形で指しているため。

### 2. DF の ID の引き継ぎ

```python
# app/documents/internal_design/assemble.py
def build_model(draft, previous, external_apis=()) -> InternalDesignModel:
    dataflows, next_seq = _dataflows(draft.dataflows, previous)
```

前の版に同じ処理(同じ API の `endpoint_key`、バッチは名前)があればその ID、無ければ次の番号。同じ処理の2つ目は捨てる。外部設計書の画面ID(AI に仮の ID を書かせ、前の版に在る ID だけ引き継ぐ)と違い、**AI に ID を書かせない**。処理は API と1対1なので、トリガーだけで同じ処理かが決まるため。Phase 46 の差分は、この ID を要素のキーにして版を比べる。

### 3. md

```python
# app/documents/internal_design/markdown.py
def render_internal_design(model) -> str      # ## 3.1〜3.4・### テーブル:・### モジュール一覧・#### DF-n:
def body_text(text) -> str                    # コードブロックの外の見出しを太字にする
def dataflow_body(flow) / table_body(table) / data_model_body(model)   # 45-4 が使う
```

見出しと表の列は、model にする前の内部設計書のプロンプトが決めていた形のまま。model の無い古い版を読む解析(`parse_internal_design`)が、この md も同じように読める(テストで確かめる)。本文に AI が `## …` を書くと節の切り出し(`extract_section`)が途中で切れるので、本文の見出しは太字の行にする(以前は `_collapse_doubled_headings` で見出しの重なりだけを直していた)。

### 4. 検証

| コード | 重要度 | 内容 |
| --- | --- | --- |
| `NO_MODULE_LIST` | 最重要 | モジュール一覧が無い(段階8の単位のファイルの層が決まらない) |
| `API_WITHOUT_DATAFLOW` | 中程度 | 外部設計書の API(写し)に処理別データフローが無い ── ベースラインの「処理(DF)の無い機能の単位」の元 |
| `DATAFLOW_API_UNLISTED` | 軽微 | API エンドポイント一覧に無い API の処理 |
| `DATAFLOW_EMPTY` | 軽微 | 流れの行が無い処理 |

指摘は警告だけで、生成も保存も止めない(外部設計書と同じ)。型は `app/documents/issues.DocumentIssue`。

## 設計判断

- **計画から変えた点**: 計画では「DF の流れに 3.2 に無いテーブル名(軽微)」を挙げたが、やめて `DATAFLOW_EMPTY` にした。流れの元・先は外部実体・モジュール名・テーブル名が自由な文字列で混ざり(「データベース (`trends` テーブル)」など)、テーブル名かどうかを決められないため。計画の「下書きに前の版の DF の一覧を渡す」もやめた(ID はトリガーで決まるので要らない)。
- **`drafting` を `__init__` から出さない**: 外部設計書と同じ。プロンプトは生成のサービスと偽 LLM だけが読む。

## テスト観点

用語(SUT / ドライバ / スタブ)は Phase 1 で定義済み。

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
| --- | --- | --- | --- |
| `build_model`・`dataflow_id`・`dataflow_seq` | pytest(`test_internal_design_doc.py`) | スタブ不要 ── 純粋関数(副作用なし)で、LLM・DB を呼ばないため | 形の違う API・重複の除去、DF の ID の採番と引き継ぎ(末尾の `/` は同じ API、消えた ID を使い回さない) |
| `render_internal_design`・`body_text` | 同上(md を `parse_internal_design` で素で読む) | スタブ不要 ── 同上 | 古い版の解析がモジュール・DF・API・テーブル・3.4 を同じく読む、本文の見出しは太字、コードブロックの中は残す |
| `validate_internal_design`・`row_counts` | 同上 | スタブ不要 ── 同上 | 4つの指摘、書き落としの無い設計は指摘0件 |
| `to_draft`・`build_internal_design_messages` | 同上 | スタブ不要 ── 同上 | 構造化出力 → 下書き、入力に要件定義書と外部設計書の md |

```sh
cd devex-api/backend && uv run pytest tests/unit/test_internal_design_doc.py -q
```
