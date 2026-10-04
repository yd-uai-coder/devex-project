# Phase-18-2: 段階3の下書きのプロンプトと出力スキーマ(BE)

## この章の目的

段階3の AI の下書きの入出力を作る。1回の生成で、ER(テーブル定義を含む)と CRUD 図を順に書かせる。

- ER: 入力は DFD のデータストア名・データ辞書・処理概要表。出力は制約・説明つきのテーブルと関連。
- CRUD 図: 入力は機能一覧・処理概要表・ER のテーブル名・DFD の R/W。DFD から決まる部分は「決まったもの」として渡し、AI には C/U/D の区別と DFD に無い処理の分だけを決めさせる。
- E2E 用の偽 LLM に、段階3の決まった出力を足す。

学習モード([introduction](./Phase-18-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/detailed_design/data_model_drafting.py`](../samples/backend/app/detailed_design/data_model_drafting.py) | 新規 | **コア** | 出力スキーマ `DataModelErOutput`・`CrudGenerationOutput`、プロンプト、`build_er_messages`・`to_er_model`・`build_crud_messages`・`to_crud_drafts`・`data_store_names`(純粋) |
| [`app/ai/llm/fake.py`](../samples/backend/app/ai/llm/fake.py) | 更新 | **コア** | E2E 用の段階3の固定の出力(段階2の偽の DFD の reservations に対応) |
| ── ここからテスト ── | | | |
| [`tests/unit/test_data_model_drafting.py`](../samples/backend/tests/unit/test_data_model_drafting.py) | 新規 | **コア** | メッセージの組み立て、ER への写像(重複・参照切れの関連を捨てる)、CRUD 図の下書きへの変換 |

## 要点の抜粋

```python
# app/detailed_design/data_model_drafting.py
class DraftedColumn(GeneratedColumn):        # ステージ3の列に、テーブル定義の制約・説明を足す
    constraints: str = Field(default="", description="NOT NULL 以外の制約 ...")
    description: str = Field(default="", description="列の意味を短く")

class DataModelErOutput(BaseModel):
    tables: list[DraftedTable]               # id / name / description / columns
    relations: list[GeneratedTableRelation]  # ステージ3と同じ

class CrudGenerationOutput(BaseModel):
    cells: list[GeneratedCrudCell]           # function_id / table / ops

def build_er_messages(stores, data_items, summaries) -> list[BaseMessage]: ...
def to_er_model(output) -> ErSemanticModel: ...           # 同じ ID・名前の2つ目のテーブル、参照切れの関連を捨てる
def build_crud_messages(functions, summaries, tables, accesses) -> list[BaseMessage]: ...
    # 「## DFD から決まっている読み書き」に「F-01 × reservations: 書き込み」の形で渡す
def to_crud_drafts(output) -> list[CrudDraft]: ...
```

依存の向きは `data_model_drafting → data_model・data_flow・function_list・uml.domain.er・uml.generation(schemas・prompts)`。LLM は呼ばない(呼ぶのは 18-3 のサービス層)。

## 設計判断

### ER の出力スキーマは段階3専用にする

ステージ3の `ErGenerationOutput` に制約・説明を足すと、簡易ドキュメントモードの ER のプロンプト・出力も変わる。段階3だけが要る項目なので、`GeneratedColumn` を継承した `DraftedColumn` を段階3側に置き、ステージ3のスキーマは変えない。写像も段階3専用の `to_er_model` にした(ステージ3の `to_er` は列を `ErColumn(**c.model_dump())` で写すので、項目が増えても使えるが、テーブルの説明と重複の除去が要るため分けた)。

### AI に決めさせる範囲を絞る

CRUD 図のうち DFD から決まる部分は、プロンプトで「必ず含める」と指示したうえで、`merge_crud`(18-1)が DFD から足し直す。AI が書き漏らしても、DFD と CRUD 図は食い違わない。AI の出力に頼るのは、DFD に表れない次の2つだけである。

| AI が決めること | 理由 |
|---|---|
| 書き込みの C/U/D の区別 | DFD の線は「書く」までしか表さない |
| DFD を描いていない処理の操作 | 段階2で DFD を描くグループは人が選ぶ(5つまで)。描かなかった処理は処理概要表の1行だけ |

### ER のテーブル名はデータストア名に合わせる

CRUD 図の R/W は名前で突き合わせる(18-1)。そのため ER のプロンプトで「データストアの名前は、そのままテーブル名に使い、全てのデータストアをテーブルにする」と指示した。名前が揃わなかったときは、検証の警告(`STORE_NOT_IN_ER`)で人に知らせる。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `to_er_model`・`to_crud_drafts`(+ 18-1 の `merge_crud`) | pytest | スタブ不要。純粋関数で、LLM を呼ばないため | 第一テストの統合スモーク(E2E 用の偽の出力から ER と CRUD 図を組み立てられる) |
| `build_er_messages`・`build_crud_messages`・`data_store_names` | pytest | スタブ不要。同上 | 入力の節(データストア・データ辞書・処理概要表・決まっている読み書き)が本文に入ること |
| `to_er_model` の除去規則 | pytest | スタブ不要。同上 | 同じ名前の2つ目のテーブル・参照切れの関連を捨て、結果が構造の検証を通ること |

## 動作確認(実施済み)

```bash
cd devex-api/backend
uv run pytest tests/unit/test_data_model_drafting.py
# 5 passed
```
