# Phase-83-2: 予測の純粋関数

## この章の目的

合意の前に「この CR の対象の要件を変えると、どの要素の見直しが要るか」を求める純粋関数を作る。基準の合意済みの版(束)の写しから設計の要素を組み、対象の要件ごとに今の変更影響分析のたどり方(`impact_of`。処理を軸)を当てて、1つの一覧にまとめる。新しく作るのは「束の写しを要素の入力に読み替える」ことと「複数の対象の結果をまとめる」ことで、たどり方そのものはステージ7 のものをそのまま使う([80-2](../Phase-80/Phase-80-2.md) のベースラインで、この求め方の予測が N2 の正解6件と一致した)。

自動実装モード: on([introduction](./Phase-83-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/detailed_design/data_model.py`](../samples/backend/app/detailed_design/data_model.py) | 更新 | `ER_SNAPSHOT_KEY` をここへ移した |
| [`app/detailed_design/__init__.py`](../samples/backend/app/detailed_design/__init__.py) | 更新 | `ER_SNAPSHOT_KEY` の re-export |
| [`app/services/design_stage_service.py`](../samples/backend/app/services/design_stage_service.py) | 更新 | `ER_SNAPSHOT_KEY` の定義を消し、`app.detailed_design` から import(挙動は同じ) |
| [`app/change_requests/prediction.py`](../samples/backend/app/change_requests/prediction.py) | 新規 | `PredictedTarget`・`PredictedItem`・`Prediction`(保存の形)・`baseline_models`・`requirement_texts`・`predict`・`predict_from_snapshots` |
| [`app/change_requests/__init__.py`](../samples/backend/app/change_requests/__init__.py) | 更新 | `prediction` の re-export |
| [`tests/unit/test_change_request_prediction.py`](../samples/backend/tests/unit/test_change_request_prediction.py) | 新規 | `impact_of` との一致・複数の対象の統合・削除の範囲・新規だけ・ER の写し・保存の形の往復 |
| [`tests/unit/test_design_stage_impact.py`](../samples/backend/tests/unit/test_design_stage_impact.py) | 更新 | `ER_SNAPSHOT_KEY` の import 元を `app.detailed_design` に |

依存の向き: `prediction.py` → `targets.py`([83-1](./Phase-83-1.md))・`app.detailed_design`(`DATA_MODEL_STAGE`・`ER_SNAPSHOT_KEY`)・`app.detailed_design.impact`(`build_elements`・`DesignModels`・`impact_of`・`Change`)。DB にも LLM にも触らない。

```python
# app/change_requests/__init__.py(re-export の形。この章で足した分)
from app.change_requests.prediction import (
    PredictedItem, PredictedTarget, Prediction,
    baseline_models, predict, predict_from_snapshots, requirement_texts,
)
```

## 1. `ER_SNAPSHOT_KEY` を純粋層へ移す

- 段階3の承認の写し(`approved_model`)は、承認したときの ER の定義を `er_snapshot` の欄に持つ(Phase 43)。束の写しは `approved_model` をそのまま写す([81-3](../Phase-81/Phase-81-3.md))ので、束の段階3の写しにも ER の定義がある。
- 予測の純粋関数がこの欄の名前を要る。定数は `app/services/design_stage_service.py` にあったが、純粋層からサービスを import すると層の向きが逆になる。そこで `app/detailed_design/data_model.py`(`DATA_MODEL_STAGE`・`ER_SUBJECT` の隣)へ移した(#17。今の消費者 = `prediction.py`)。サービスと既存のテストは import 元を変えただけで、挙動は同じ。

## 2. 束の写しを要素の入力にする

```python
# app/change_requests/prediction.py(抜粋)
def baseline_models(snapshots: Mapping[str, Mapping | None]) -> DesignModels
    # key → model(束に入っているものだけ)。requirements・external_design は文書、stage:N は段階 N。
    # ER は段階3の写しの ER_SNAPSHOT_KEY(無ければ ER のテーブルは要素にならない)
def requirement_texts(requirements) -> dict[str, str]   # 要件 ID → 文(対象の表示用)
```

- **入れるのは束に入っているものだけ**: 未承認の段階は写しが無い(「入っていない」の行)ので、その段階の要素は予測に出ない。何が入っていないかは、API が束から別に示す([83-3](./Phase-83-3.md) の `excluded`)。
- **今の内容を読まない**: 予測は「B-1 からの変更」なので、今の文書・段階でなく束の写しから組む。束は凍結されているので、同じ CR からはいつも同じ予測になる。

## 3. 複数の対象をまとめる

```python
# app/change_requests/prediction.py(抜粋)
@dataclass(frozen=True)
class PredictedItem:
    key: str; kind: ElementKind; stage: int; label: str
    path: tuple[str, ...]; reason: str
    requirement_ids: tuple[str, ...]   # この要素に届いた対象の要件(対象の順)

@dataclass(frozen=True)
class Prediction:
    targets: tuple[PredictedTarget, ...]       # 要件 ID・種類・束の文
    items: tuple[PredictedItem, ...]           # 置き場の順・キーの順
    unpredicted_new_requirement: bool           # 新しい要件の分は予測に入らない
    def to_dict(self) -> dict / from_dict(cls, value) -> Prediction   # 保存の形

def predict(elements, targets, *, adds_requirement, texts=None) -> Prediction
def predict_from_snapshots(snapshots, targets, *, adds_requirement) -> Prediction
```

- **対象ごとに `impact_of`**: `Change(f"req:{id}")`(種類は既定の `content`)を渡す。[83-1](./Phase-83-1.md) のとおり、削除も同じ範囲になる。
- **まとめ方**: 同じ要素に複数の対象から届いたら、短い道(同じ長さなら先の対象)を残し、届いた対象をすべて `requirement_ids` に残す(例: FR-001 と FR-002 が画面 SCR-001 を共有する)。`impact_of` の「短い道を残す」と同じ考え方で、説明書(Phase 84)は要素ごとに「どの対象の変更で見直すか」を書ける。対象の要件そのもの(`req:…`)は一覧に入れない。
- **新しい要件を足す分**(ユーザー決定): 起点の要素が無いので予測に入らない。`unpredicted_new_requirement` で「予測に入っていない」と示す。既存の ID の対象があれば、その分は予測する。
- **束に無い要件 ID**: 起点の要素が無いので何も届かず、文は空になる(作成のときに束で確かめているので、ふつうは起きない)。
- **保存の形**: 判断の時点で CR に残すため([83-3](./Phase-83-3.md))、JSON にできる dict と相互に変換する。`from_dict` は知らない種類を内容の変更とみなす(`targets_from_json` と同じ)。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_change_request_prediction.py`(新規) | `baseline_models`・`requirement_texts`・`predict`・`predict_from_snapshots`・`Prediction.to_dict`/`from_dict`・`ER_SNAPSHOT_KEY`(re-export) | pytest のテスト関数 | スタブ不要 ── 対象が純粋(副作用なし)で外部依存を呼ばないため。入力は既存の fixture の model(`impact_documents`・`impact_stages`)を束の写しの形に並べたもの |
| `test_design_stage_impact.py`(更新) | 段階の承認の印(既存)。この章では `ER_SNAPSHOT_KEY` の import 元だけ | pytest のテスト関数 | 既存のまま(インメモリの SQLite) |

- 1つの対象: `impact_of` と同じ要素・道・理由 / 画面・API・作業単位も入る / 対象の文が束から引ける。
- 複数の対象: 共有の画面に両方の要件が残り、道は先の対象のもの / 置き場の順 / 要件そのものは入らない。
- 削除: 内容の変更と同じ一覧で、種類は対象に残る。
- 新規だけ: 一覧は空で、`unpredicted_new_requirement` が真。
- 写しの読み替え: 段階3の写しに ER があれば ER のテーブルが入る・無ければ入らない / 段階が無い束でも文書の要素は組める。
- 束に無い要件: 一覧は空・文は空。
- 保存の形: `to_dict` → `from_dict` で同じ予測に戻る。
