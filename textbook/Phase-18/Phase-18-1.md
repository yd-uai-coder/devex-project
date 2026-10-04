# Phase-18-1: 段階3の意味モデル・CRUD 図の組み立て・検証(BE)

## この章の目的

段階3(データモデル)の正本の形を決め、段階2の DFD の線から CRUD 図の R/W を読み取り、AI の下書きと合わせて CRUD 図を組み立てる純粋関数と、段階3の検証を作る。テーブル定義の正本にするため、ER の列とテーブルに制約・説明を足す。

- 段階3の `model` に持つのは CRUD 図のセルだけにする。ER とテーブル定義は持たない。
- DFD の「データストア → 処理」は R、「処理 → データストア」は W。
- 検証は、ER の要約と DFD の R/W を `StageSources` で受け取る。段階3の検証を `STAGE_VALIDATORS` に登録する。

学習モード([introduction](./Phase-18-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/uml/domain/er.py`](../samples/backend/app/uml/domain/er.py) | 更新 | **コア** | `ErColumn` に `constraints`・`description`、`ErElement` に `description`(すべて既定 `""`) |
| [`app/detailed_design/data_model.py`](../samples/backend/app/detailed_design/data_model.py) | 新規 | **コア** | `CrudCell`・`CrudModel`・`CrudDraft`・`DfdAccess`、`DATA_MODEL_STAGE`・`ER_SUBJECT`・`CRUD_OPS`、`dfd_accesses`・`merge_crud`・`confirm_drafts` ほか(純粋) |
| [`app/detailed_design/validation.py`](../samples/backend/app/detailed_design/validation.py) | 更新 | **コア** | `ErDiagramSummary`、`DfdDiagramSummary.accesses`、`StageSources.er_diagram`、`selected_dfd_accesses`、`validate_data_model` を `STAGE_VALIDATORS[3]` に登録 |
| [`app/detailed_design/__init__.py`](../samples/backend/app/detailed_design/__init__.py) | 更新 | 定型 | 上の公開名の re-export |
| ── ここからテスト ── | | | |
| [`tests/fixtures/detailed_design.py`](../samples/backend/tests/fixtures/detailed_design.py) | 更新 | 定型 | `er_model()`(主キーだけのテーブル)・`crud_model()`(F-01 が reservations に書くセル1つ) |
| [`tests/unit/test_data_model.py`](../samples/backend/tests/unit/test_data_model.py) | 新規 | **コア** | R/W の導出、CRUD 図の組み立てと下書きの印、確定、検証のエラーと警告、ER の列の既定値 |
| [`tests/unit/test_function_list.py`](../samples/backend/tests/unit/test_function_list.py) | 更新 | 定型 | 「登録の無い段階」の例を段階4にした |

## 要点の抜粋

```python
# app/uml/domain/er.py
class ErColumn(BaseModel):
    name: str
    type: str
    is_primary_key: bool = False
    is_foreign_key: bool = False
    nullable: bool = True
    constraints: str = ""        # テーブル定義の制約(UNIQUE・既定値・FK の削除時の動きなど)
    description: str = ""        # テーブル定義の説明

class ErElement(UmlElement):
    kind: Literal["table"] = "table"
    columns: list[ErColumn] = []
    description: str = ""        # テーブル単位の注記(複合一意制約・役割)
```

```python
# app/detailed_design/data_model.py
DATA_MODEL_STAGE = 3
ER_SUBJECT = ""                              # 段階3の ER は全体1枚

@dataclass(frozen=True, order=True)
class DfdAccess:                             # DFD の線1本から読める関わり
    function_id: str                         # 処理の箱の id = 段階1の処理ID
    table: str                               # table_key で正規化したデータストア名
    kind: Literal["read", "write"]

class CrudCell(BaseModel):                   # design_stages.model(段階3)の1セル
    function_id: str
    table: str
    ops: str = ""                            # "CR" など。C→R→U→D の順
    draft: bool = False                      # AI の下書きのまま(人が確定していない)

def dfd_accesses(semantic_models) -> list[DfdAccess]: ...
    # data_store → process = read、process → data_store = write(他の線は見ない)

def merge_crud(drafts, accesses, function_list, tables) -> CrudModel: ...
    # 読みの線のセルには R を足す。書き込みの線のセルは C/U/D が無くても(空で)残す。
    # draft = 「DFD の読みで決まる R」以外の操作がある or 書き込みの線がある

def confirm_drafts(model) -> dict: ...       # 承認で全セルの draft を外す
```

```python
# app/detailed_design/validation.py
@dataclass(frozen=True)
class ErDiagramSummary:                      # uml_diagrams の ER の行の要約(サービス層が作る)
    status: str
    generation_status: str
    tables: tuple[str, ...] = ()
    tables_without_pk: tuple[str, ...] = ()

# DfdDiagramSummary に accesses、StageSources に er_diagram を足した
STAGE_VALIDATORS = {1: validate_function_list, 2: validate_data_flow, 3: validate_data_model}
```

`__init__.py` は `data_model` の公開名(`CRUD_OPS`・`DATA_MODEL_STAGE`・`ER_SUBJECT`・`CrudCell`・`CrudDraft`・`CrudModel`・`DfdAccess`・`confirm_drafts`・`dfd_accesses`・`er_table_names`・`merge_crud`・`normalize_ops`・`table_key`・`tables_without_primary_key`)と、`validation` の `ErDiagramSummary`・`selected_dfd_accesses` を足して re-export する。依存の向きは `validation → data_model → function_list・uml.domain.er` で、どれも DB と LLM を知らない。

## 設計判断

### 段階3の model は CRUD 図のセルだけ。テーブル定義の正本は ER

段階3の成果物は「ER・テーブル定義・CRUD 図」の3つだが、正本は分ける(段階2と同じ考え方)。

| 成果物 | 正本 | 理由 |
|---|---|---|
| ER | `uml_diagrams`(notation=er、subject='') | ステージ3の ER のエディタ・自動レイアウト・承認をそのまま使う(着手時の決定1) |
| テーブル定義 | ER の列・テーブルの `constraints`・`description` | テーブル名・列名・型・PK・FK は ER にすでにある。制約・説明だけを別の表に持つと、ER で列を改名したときに食い違う(着手時の決定2) |
| CRUD 図 | `design_stages.model`(段階3) | 段階3にしか無い情報 |

ER の列に足した3つの属性は既定値 `""` を持つので、既存の ER(簡易ドキュメントモード・ステージ3)はそのまま読める。

### R/W は DFD の線の向きから決める

DFD の処理の箱は段階1の処理ID(Phase 17)、データストアはテーブル名(英小文字の複数形)なので、線を見れば「どの処理がどのテーブルを読む・書く」が決まる。ここを AI に決めさせると、DFD と CRUD 図が食い違う。

- データストアと ER のテーブルは名前で突き合わせる(`table_key`: 前後の空白を除いて小文字)。
- 書き込みの線から決まるのは「C/U/D のどれか」まで。C(作成)・U(更新)・D(削除)の区別は DFD に表れないので、AI と人が決める。
- 使うのは、段階2で DFD を描くと選んだグループの DFD だけ(`selected_dfd_accesses`)。選択を外したグループの DFD は消さずに残っているため。

### 下書きの印(`draft`)の付け方

着手時の決定3(承認で一括確定)のため、セルに「AI の下書きのまま」の印を持たせる。

| セル | `draft` | 理由 |
|---|---|---|
| DFD の読みの線だけで決まる(`R` だけ) | False | AI も人も判断していない。DFD の承認で確定済み |
| AI が C/U/D を書いた、または DFD に無い処理の分 | True | AI の判断。人の確認が要る |
| DFD に書き込みの線がある | True | C/U/D の区別は AI か人が決める。AI が書き漏らしたら空のまま残し、検証のエラーで決めさせる |

印は、人がセルを書き換えると外れ(18-8)、段階3の承認で残りもまとめて外れる(`confirm_drafts`、18-3)。

### エラーと警告

| 区分 | 内容 | 理由 |
|---|---|---|
| エラー | 形が不正、ER が無い・生成中・未承認、ER のテーブル名の重複(`DUPLICATE_TABLE`。画面確認後に追加。[18-9](./Phase-18-9.md) 参照)、セルの処理ID・テーブルが不明、セルの重複、操作が空・C/R/U/D の順の形でない、DFD に読みがあるのに R が無い、DFD に書き込みがあるのに C/U/D が無い | 段階4(モジュール一覧)は CRUD 図と ER を入力にする。DFD と食い違ったまま承認すると、後ろの段階が DFD と別のことを前提にしてしまう |
| 警告 | 下書きのセルが残っている(件数)、DFD のデータストアが ER に無い、どの処理も触れないテーブル、主キーの無いテーブル | 人の判断で正しいことがある(承認で確定する・共通のマスタテーブル など) |

書き込みの線のセルが空のときは、`EMPTY_OPS` を重ねずに `DFD_WRITE_MISSING` だけを出す(同じ原因の指摘を2つ出さない)。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `dfd_accesses`・`merge_crud`・`confirm_drafts`・`normalize_ops`・`table_key`・`er_table_names`・`tables_without_primary_key` | pytest | スタブ不要。純粋関数(副作用なし)で、外部依存を呼ばないため | 第一テストの統合スモーク(DFD の R/W と AI の下書きから組み立てた CRUD 図が、段階3の検証をエラーなしで通る)。読み・書き込みの線の判別、下書きの印、名前の大小 |
| `validate_data_model`・`selected_dfd_accesses`・`STAGE_VALIDATORS` | pytest | スタブ不要。同上。ER と DFD は `ErDiagramSummary`・`DfdDiagramSummary` の値で渡す | ER の状態、セルのエラー、DFD との食い違い、選んでいないグループの DFD を見ないこと、警告 |
| `ErColumn`・`ErElement` | pytest | スタブ不要。同上 | 制約・説明の既定値(既存の ER が読めること) |

ER と DFD を「要約の値」で渡すので、DB の行もテストダブルも要らない(17-1 と同じ)。

## 動作確認(実施済み)

```bash
cd devex-api/backend
uv run pytest tests/unit/test_data_model.py tests/unit/test_function_list.py
# 20 passed
```
