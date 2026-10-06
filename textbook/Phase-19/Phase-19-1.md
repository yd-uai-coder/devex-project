# Phase-19-1: 段階4の意味モデル・モジュール一覧の組み立て・検証(BE)

## この章の目的

段階4(ソフトウェア構造)の正本の形を決め、AI の下書きからモジュール一覧を整える純粋関数と、段階4の検証を作る。構成図は `uml_diagrams` が正本なので、検証には構成図の要約(状態と層)だけを渡す。

- 段階4の `model` に持つのはモジュール一覧だけにする。構成図は持たない。
- モジュールのパスは、段階5の関与表の列の鍵になる。そのため空・重複を検証のエラーにする。
- 検証は、構成図の要約を `StageSources.component_diagram` で受け取る。段階4の検証を `STAGE_VALIDATORS` に登録する。

自動実装モード: on([introduction](./Phase-19-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/detailed_design/structure.py`](../samples/backend/app/detailed_design/structure.py) | 新規 | **コア** | `ModuleRow`・`ModuleListModel`・`ModuleDraft`、`STRUCTURE_STAGE`・`STRUCTURE_SUBJECT`、`component_layers`・`merge_modules`、依存先の照合 `path_variants`・`module_ref_matches`(画面確認後に追加)(純粋) |
| [`app/detailed_design/validation.py`](../samples/backend/app/detailed_design/validation.py) | 更新 | **コア** | `ComponentDiagramSummary`、`StageSources.component_diagram`、`validate_structure` を `STAGE_VALIDATORS[4]` に登録 |
| [`app/detailed_design/__init__.py`](../samples/backend/app/detailed_design/__init__.py) | 更新 | 定型 | 上の公開名の re-export |
| ── ここからテスト ── | | | |
| [`tests/fixtures/detailed_design.py`](../samples/backend/tests/fixtures/detailed_design.py) | 更新 | 定型 | `component_model()`(層ごとにモジュール1つ)・`module_list_model()`(F-01 に関わる行1つ) |
| [`tests/unit/test_structure.py`](../samples/backend/tests/unit/test_structure.py) | 新規 | **コア** | 層の読み取り、モジュール一覧の整え方、検証のエラーと警告、全処理の行の扱い |
| [`tests/unit/test_function_list.py`](../samples/backend/tests/unit/test_function_list.py) | 更新 | 定型 | 「登録の無い段階」の例を段階5にした |

## 要点の抜粋

```python
# app/detailed_design/structure.py
STRUCTURE_STAGE = 4
STRUCTURE_SUBJECT = ""                       # 段階4の構成図は全体1枚

class ModuleRow(BaseModel):                  # design_stages.model(段階4)の1行
    path: str                                # 段階5の関与表の列の鍵
    layer: str = ""                          # 構成図のレーン(要素の layer)の名前にそろえる
    responsibility: str = ""
    depends_on: list[str] = Field(default_factory=list)   # 一覧のモジュールはパス、外部は名前
    functions: list[str] = Field(default_factory=list)    # 関わる処理の処理ID(機能一覧の順)
    all_functions: bool = False              # 全処理が通る横断のモジュール(文書では「全処理」)

class ModuleListModel(BaseModel):
    modules: list[ModuleRow] = Field(default_factory=list)

def component_layers(semantic_model) -> list[str]: ...
    # 構成図の要素の layer を初出順に(空・未設定は除く)

def merge_modules(drafts, function_list) -> ModuleListModel: ...
    # 空のパス・2つ目以降の同じパスを捨てる。機能一覧に無い処理IDを捨て、機能一覧の順に並べる
```

```python
# app/detailed_design/validation.py
@dataclass(frozen=True)
class ComponentDiagramSummary:               # uml_diagrams の構成図の行の要約(サービス層が作る)
    status: str
    generation_status: str
    layers: tuple[str, ...] = ()

# StageSources に component_diagram を足した
STAGE_VALIDATORS = {1: ..., 2: ..., 3: ..., 4: validate_structure}
```

`__init__.py` は `structure` の公開名(`STRUCTURE_STAGE`・`STRUCTURE_SUBJECT`・`ModuleDraft`・`ModuleListModel`・`ModuleRow`・`component_layers`・`merge_modules`)と、`validation` の `ComponentDiagramSummary` を足して re-export する。依存の向きは `validation → structure → function_list・uml.domain.component` で、どれも DB と LLM を知らない。

## 設計判断

### 段階4の model はモジュール一覧だけ。構成図の正本は uml_diagrams

段階3と同じ考え方で、正本を分ける。

| 成果物 | 正本 | 理由 |
|---|---|---|
| 構成図(層) | `uml_diagrams`(notation=component、subject='') | ステージ3の component 図のエディタ・自動レイアウト(層のレーン)・承認をそのまま使う(着手時の決定1) |
| モジュール一覧 | `design_stages.model`(段階4) | 段階4にしか無い情報(ファイル単位の責務表) |

構成図(パッケージ単位)とモジュール一覧(ファイル単位)は粒度が違う。両者をつなぐのは「層」の名前だけにした。モジュールごとに「構成図のどの箱に属するか」を持たせる案もあるが、構成図で箱を改名・削除すると行が壊れる。層の名前なら、食い違いを警告(`UNKNOWN_LAYER`)で知らせ、人が選び直せば済む。

### パスは後の段階の鍵なので、空・重複はエラー

段階5の手順は「呼び出し元 → 呼び出し先」をモジュール一覧のパスで書き、関与表(処理 × モジュール)の列もパスで引く。同じパスが2行あると、どちらの行のモジュールかが決まらない。段階3のテーブル名の重複(`DUPLICATE_TABLE`)と同じ理由である。`merge_modules` は AI の下書きの重複を捨て、人の編集で生じた重複は検証のエラーで止める。

### 関わる処理と「全処理」

- 処理IDは機能一覧に無いものを捨て、機能一覧の順に並べる(AI の並びに左右されない)。人が書いた不明な処理IDは、検証のエラー(`UNKNOWN_FUNCTION`)にする。
- `all_functions` の行(アプリの組み立て・DI・例外の変換)は、どの処理が通るかを個別に書かない。そのため、処理のカバー(`UNCOVERED_FUNCTION`)の判定には数えない。数えると、`app/main.py` が全処理を「担当」したことになり、実際にその処理を担うモジュールが一覧に無いことを見落とす。

### エラーと警告

| 区分 | 内容 | 理由 |
|---|---|---|
| エラー | 形が不正、モジュールが0件、構成図が無い・生成中・未承認、パスが空・重複、関わる処理の処理IDが機能一覧に無い | 段階5はパスと処理IDで段階4を参照する。参照先が決まらないまま承認すると、後ろの段階が壊れる |
| 警告 | 責務が空、層が構成図のレーンに無い、どのモジュールにも現れない処理、依存先がパスの形(`/` を含む)なのに一覧に無い | 人の判断で正しいことがある(省いた定型のファイルへの依存・外部ライブラリ など) |

依存先は、一覧のモジュールをパスで、外部のライブラリを名前(`sqlalchemy`)で書く。`/` を含むものだけをパスとみなして突き合わせ、外部のライブラリには警告を出さない。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `component_layers`・`merge_modules` | pytest | スタブ不要。純粋関数(副作用なし)で、外部依存を呼ばないため | 層の初出順と空の除外、パスの重複・空の除外、処理IDの並びと不明な処理IDの除外、依存先の整え方 |
| `validate_structure`・`STAGE_VALIDATORS` | pytest | スタブ不要。同上。構成図は `ComponentDiagramSummary` の値で渡す | 第一テストの統合スモーク(`validate_stage(4, …)` がエラーなしで通る)。構成図の状態(`exported` も承認済み)、パスの重複・空、不明な処理ID、警告が承認を止めないこと、全処理の行がカバーに数えられないこと |

構成図を「要約の値」で渡すので、DB の行もテストダブルも要らない(18-1 と同じ)。

## 動作確認(実施済み)

```bash
cd devex-api/backend
uv run pytest tests/unit/test_structure.py tests/unit/test_function_list.py
# 32 passed(画面確認後の修正を含む)
```

## 画面確認後の修正: 依存先の照合を「区切り単位の部分一致」にした

**報告**: AI が依存先に `app/services`・`app/routers`・`app/models` のようなディレクトリを書いた。一覧に `app/services/x_client.py` などがあっても、警告「依存先「app/services」が、モジュール一覧にありません」が出た。当初の照合は、パスとの完全一致だけだったためである。

**ユーザーの提案と検討**: 「対象の文字列が含まれていれば合致」(部分文字列の一致)を検討した。結果はどの方法でも決定的(同じ入力なら毎回同じ)だが、部分文字列の一致は、区切りの途中でも一致してしまう。

| 依存先 | パス | 部分文字列の一致 | 区切り単位の一致(採用) |
|---|---|---|---|
| `app/services` | `app/services/x_client.py` | 一致 | 一致 |
| `services/auth` | `app/services/auth.py` | 一致 | 一致 |
| `app/ser`(打ち間違い) | `app/services/x_client.py` | **一致(見落とす)** | 不一致 |
| `app/models` | `app/models_old.py` | **一致(見落とす)** | 不一致 |
| `app/repositories/user` | `app/repositories/{project,user}.py` | 不一致 | 一致 |
| `app/models` | `app/models/*.py` | 不一致 | 一致 |

ユーザーの決定で「区切り単位の部分一致」にした。

```python
# app/detailed_design/structure.py
def path_variants(path: str) -> list[tuple[str, ...]]: ...
    # 「/」で区切った単位の列。末尾の拡張子を除き、{a,b} は展開する
def module_ref_matches(ref: str, path: str) -> bool: ...
    # ref の単位の列が path の単位の列のどこかに連続して現れれば一致。path 側の * はどの単位とも一致
```

```python
# app/detailed_design/validation.py(validate_structure の抜粋)
if "/" in dependency and not any(module_ref_matches(dependency, p) for p in paths):
    ...  # UNKNOWN_DEPENDENCY(警告)「…に当たるモジュールが、モジュール一覧にありません」
```

- 単位(「/」の間)ごとに比べるので、文字列の途中では一致しない。ディレクトリ(`app/services`)と、先頭を省いた短い書き方(出力見本の `services/auth`)は一致する。
- 依存先の側の `{a,b}` や `*` は特別に扱わない(依存先は1つのモジュールかディレクトリを指す書き方なので)。
- 段階5(Phase 20)で、手順の「呼び出し先」をモジュール一覧のパスと照らすときも、同じ関数を使える。

テスト(`tests/unit/test_structure.py`): 上の表を `pytest.mark.parametrize` で確かめ、報告の再現(ディレクトリの依存先で警告が出ず、該当の無い `app/models` だけが警告になる)を足した。SUT は `path_variants`・`module_ref_matches`・`validate_structure`、スタブ不要(純粋関数)。
