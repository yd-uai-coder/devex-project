# Phase-17-1: 段階2の意味モデルと検証(BE)

## この章の目的

段階2(データフロー)の正本の形を決め、AI の下書きから処理概要表を組み立てる純粋関数と、段階2の検証を作る。

- 段階2の `model` に持つのは「DFD を描く機能グループ」と「全処理の処理概要表」だけにする。DFD 本体とデータ辞書は持たない。
- 検証は、入力の段階1の内容と、機能グループの DFD の要約を `StageSources` で受け取る。
- 段階2の検証を `STAGE_VALIDATORS` に登録する。

学習モード([introduction](./Phase-17-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/detailed_design/data_flow.py`](../samples/backend/app/detailed_design/data_flow.py) | 新規 | **コア** | `DataFlowModel`・`ProcessSummaryRow`・`ProcessSummaryDraft`、`DATA_FLOW_STAGE`・`MAX_DFD_GROUPS`、`dfd_subject`・`group_functions`・`merge_summaries`(純粋) |
| [`app/detailed_design/validation.py`](../samples/backend/app/detailed_design/validation.py) | 更新 | **コア** | `DfdDiagramSummary`、`StageSources` に `stages`・`dfd_diagrams`、`validate_data_flow` を `STAGE_VALIDATORS[2]` に登録 |
| [`app/detailed_design/__init__.py`](../samples/backend/app/detailed_design/__init__.py) | 更新 | 定型 | 上の公開名の re-export |
| ── ここからテスト ── | | | |
| [`tests/fixtures/detailed_design.py`](../samples/backend/tests/fixtures/detailed_design.py) | 更新 | 定型 | `data_flow_model()`(`function_list_model()` の処理1件に対応する、検証を通る処理概要表) |
| [`tests/unit/test_data_flow.py`](../samples/backend/tests/unit/test_data_flow.py) | 新規 | **コア** | 処理概要表の組み立て、検証のエラーと警告、DFD の状態 |
| [`tests/unit/test_function_list.py`](../samples/backend/tests/unit/test_function_list.py) | 更新 | 定型 | 「登録の無い段階」の例を段階3にした |

## 要点の抜粋

```python
# app/detailed_design/data_flow.py
DATA_FLOW_STAGE = 2
MAX_DFD_GROUPS = 5                                   # 1回の生成で DFD を描けるグループの数

class DataFlowModel(BaseModel):                      # design_stages.model(段階2)の形
    dfd_groups: list[str]                            # DFD を描く機能グループ(人が選ぶ)
    summaries: list[ProcessSummaryRow]               # function_id / input / process / output

def dfd_subject(group: str) -> str:                  # uml_diagrams.subject = 機能グループ名
    return group.strip()

def merge_summaries(drafts, function_list, previous=None) -> DataFlowModel:
    # 行は機能一覧の並びで、処理ごとに1行。下書きに無い処理は前の版の行(人の内容)を残す。
    # dfd_groups は人の選択なので前の版から引き継ぐ(機能一覧から消えたグループは落とす)。
```

```python
# app/detailed_design/validation.py
@dataclass(frozen=True)
class DfdDiagramSummary:                             # uml_diagrams の行の要約(サービス層が作る)
    status: str
    generation_status: str
    process_ids: tuple[str, ...] = ()

@dataclass(frozen=True)
class StageSources:
    documents: Mapping[str, str] = ...               # 入力の文書の本文
    stages: Mapping[int, Mapping[str, Any]] = ...    # 承認済みの入力の段階の model
    dfd_diagrams: Mapping[str, DfdDiagramSummary] = ...  # subject → DFD の要約

STAGE_VALIDATORS = {1: validate_function_list, 2: validate_data_flow}
```

`__init__.py` は `DATA_FLOW_STAGE`・`MAX_DFD_GROUPS`・`DataFlowModel`・`ProcessSummaryDraft`・`ProcessSummaryRow`・`dfd_subject`・`group_functions`・`merge_summaries`・`DfdDiagramSummary` を足して re-export する。依存の向きは `validation → data_flow → function_list` で、どれも DB と LLM を知らない。

## 設計判断

### 段階2の model には、DFD とデータ辞書を持たない

段階2の成果物は「DFD・データ辞書・処理概要表」の3つだが、正本は分ける。

| 成果物 | 正本 | 理由 |
|---|---|---|
| DFD | `uml_diagrams`(notation=dfd、subject=機能グループ名) | ステージ3の DFD のエディタ・自動レイアウト・承認・出力をそのまま使う(着手時の決定1) |
| データ辞書 | `data_items`(プロジェクト共通) | DFD の線が `data_item_id` で参照している。model に複製すると、エディタで直した内容と食い違う(着手時の決定3) |
| DFD を描くグループ・処理概要表 | `design_stages.model` | 段階2にしか無い情報 |

そのため段階2の検証は、DFD の状態を DB から読むのではなく、`StageSources.dfd_diagrams` の要約で受け取る。検証は純粋関数のままにでき、テストもスタブ無しで書ける(読み取りは 17-3 のサービス層が担う)。

### DFD の識別キーは機能グループ名そのもの

詳細設計モードのプロジェクトには内部設計書が無いので、簡易ドキュメントモードの DFD(subject は処理名)と同じプロジェクトに並ぶことは無い。接頭辞を付けずに機能グループ名をそのまま使う。

機能グループを段階1で改名すると、古い名前の DFD は残ったまま使われなくなる(新しい名前の DFD は無い状態になり、検証の `DFD_MISSING` で気づける)。改名で図を引き継ぐ仕組みは、駆動する消費者がまだ無いので作らない(#17)。

### 処理概要表は「機能一覧の処理ごとに1行」

DFD を描かない単純な処理も、処理概要表の1行で済ませる(docs/external_design.md 2.7節)。そのため全処理に行があることを検証のエラー(`MISSING_SUMMARY`)にした。行の並びは機能一覧の並びに固定し、画面でも並び替えない。

再生成で AI が書き漏らした処理は、前の版の行(人が書いた内容)を残す。全部を AI の結果で置き換えると、書き漏らしのたびに人の内容が消えるためである。

### エラーと警告

| 区分 | 内容 | 理由 |
|---|---|---|
| エラー | 形が不正、DFD を描くグループが上限を超える・重複・機能一覧に無い、処理概要表の処理IDが機能一覧に無い・重複、処理概要表に無い処理、選んだグループの DFD が無い・生成中・未承認 | 段階3(CRUD 図)は DFD の線の向きから R/W を作る。未承認の DFD や欠けた行のまま承認すると、後ろが組み立てられない |
| 警告 | 処理概要表の空欄、DFD に別のグループの処理がある、DFD に描かれていないグループの処理がある | 人の判断で正しいことがある(1つの DFD に関連する別グループの処理を描く、単純な処理を図から省く など) |

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `merge_summaries`・`dfd_subject`・`group_functions` | pytest | スタブ不要。純粋関数(副作用なし)で、外部依存を呼ばないため | 第一テストの統合スモーク(組み立てた結果と fixture が段階2の検証をエラーなしで通る)。並び・前の版の行の保持・グループの引き継ぎ |
| `validate_data_flow`・`validate_stage`・`STAGE_VALIDATORS` | pytest | スタブ不要。同上。DFD の状態は `DfdDiagramSummary` の値で渡す | 処理概要表のエラー・警告、グループの上限・重複・不明、DFD の生成中・未承認・処理の過不足 |

DFD の状態を「要約の値」で渡せるので、DB の行もテストダブルも要らない。検証と読み取りを分けた設計が、そのままテストの書きやすさに出ている。

## 動作確認(実施済み)

```bash
cd devex-api/backend
uv run pytest tests/unit/test_data_flow.py tests/unit/test_function_list.py
# 17 passed
```
