# Phase-17-2: 段階2の下書きのプロンプトと出力スキーマ(BE)

## この章の目的

段階2の AI の下書きの入出力を、純粋関数として作る。1回の生成で、全処理の処理概要表(LLM 1回)と、人が選んだ機能グループごとの DFD(1グループで LLM 1回)を呼ぶ。

- DFD の処理の箱は、段階1の処理ID(`F-06` など)にする。
- AI の出力を、ステージ3の DFD の出力スキーマ `DfdGenerationOutput` に組み替え、データ項目の名前の解決と意味モデルへの写像をそのまま再利用する。

自動実装モード: on([introduction](./Phase-17-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/detailed_design/data_flow_drafting.py`](../samples/backend/app/detailed_design/data_flow_drafting.py) | 新規 | **コア** | 出力スキーマ(`ProcessSummaryGenerationOutput`・`GroupDfdGenerationOutput`)、プロンプト(`build_summary_messages`・`build_group_dfd_messages`)、組み替え(`to_summary_drafts`・`to_dfd_output`) |
| [`app/ai/llm/fake.py`](../samples/backend/app/ai/llm/fake.py) | 更新 | 定型 | E2E 用の偽 LLM に、段階2の2つの出力を足す |
| ── ここからテスト ── | | | |
| [`tests/unit/test_data_flow_drafting.py`](../samples/backend/tests/unit/test_data_flow_drafting.py) | 新規 | **コア** | 偽 LLM の出力が DFD 規則を通ること、グループ外の処理の除外、プロンプトの中身 |

## 要点の抜粋

```python
# app/detailed_design/data_flow_drafting.py
class GeneratedGroupProcess(BaseModel):
    function_id: str        # 【このグループの処理】の処理ID(名前は書かせない)
    description: str        # 入力をどう加工して出力にするか
    layer: str              # 図のレーン(受け付け・対話・生成など)

class GroupDfdGenerationOutput(BaseModel):
    data_items: list[GeneratedDataItem]          # ↓ ステージ3のスキーマの部品を再利用
    processes: list[GeneratedGroupProcess]
    external_entities: list[GeneratedNode]
    data_stores: list[GeneratedNode]
    flows: list[GeneratedFlow]                   # source_id / target_id は、処理なら処理ID

def to_dfd_output(output, functions) -> DfdGenerationOutput:
    # 処理の箱: id = 処理ID、name = 「F-01 名称」(名前は機能一覧から取る)
    # グループに無い処理ID・2つ目の同じ処理IDは捨て、それを端に持つフローも捨てる
```

```python
def build_group_dfd_messages(group, functions, summaries, requirements, data_items=()):
    # 機能グループ / このグループの処理 / 処理概要表(このグループの行だけ) /
    # 既存のデータ辞書 / 要件定義書 を渡す
```

`fake.py` は、段階1の偽の下書き(`F-01`・`F-02`、機能グループ `reservations`)に対応する処理概要表と DFD を返す。依存の向きは `data_flow_drafting → data_flow・function_list(17-1・16)、app/uml/generation(ステージ3)` で、DB を知らない。

## 設計判断

### DFD の処理の箱を処理IDにする

詳細設計書の02章で、図の箱と01章の行を同じIDで対応させるため(出力見本 [`content.py`](../../appendix/detailed-design-devex/content.py) の `DFDS` と同じ形)。段階3の CRUD 図は「処理 × テーブル」の格子で、R/W を DFD の線の向きから作る。箱が処理IDなら、線の端からそのまま格子の行が決まる。

AI に箱の名前まで書かせると、機能一覧の名称と食い違う。そこで `function_id` だけを書かせ、名前は機能一覧から決める(段階1で処理IDを AI に書かせなかったのと同じ考え方。[Phase-16-2](../Phase-16/Phase-16-2.md))。

### ステージ3の出力スキーマに組み替えて、写像を再利用する

`to_dfd_output` の戻り値は、ステージ3の `DfdGenerationOutput` である。組み替えた後は、[`mapper.py`](../samples/backend/app/uml/generation/mapper.py) の `required_data_items`(必要なデータ項目の列挙)と `to_dfd`(名前 → UUID の解決と意味モデル化)を、変えずにそのまま使える。DFD の意味モデル・検証・レイアウトは、図が処理別でもグループ別でも同じだからである(#17: 同じドメインの事実は共有する)。

### 参照切れのフローは捨てる

グループ外の処理IDを AI が書くと、その箱は捨てる。箱を指すフローを残すと、構造の検証(参照切れ)で保存も表示もできなくなるので、フローも一緒に捨てる。捨てた結果、入力や出力の無い処理が残れば、DFD の規則の検証(ステージ3)が指摘し、人がエディタで直す。

### プロンプトに処理概要表と既存のデータ辞書を渡す

- 処理概要表(先に作った同じ生成の結果)を渡すと、DFD の線と表の「入力・出力」の言葉がそろう。
- 既存のデータ辞書を渡し、同じ名前を再利用させる。グループをまたいで同じデータに同じ名前が付き、段階3でデータストアとデータ項目からテーブルを組み立てやすくなる。
- データストアの名前は「英小文字の複数形」(テーブル名の候補)にさせる。段階3の ER の下書きの手がかりになる。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `to_dfd_output`(+ステージ3の `required_data_items`・`to_dfd`・`validate_dfd_rules`) | pytest | スタブ不要。純粋関数(副作用なし)で、LLM を呼ばないため | 第一テストの統合スモーク(偽 LLM の出力を組み替え → 写像 → DFD 規則でエラーなし)。処理IDでの箱、グループ外の除外、参照切れのフローの除外 |
| `build_summary_messages`・`build_group_dfd_messages`・`to_summary_drafts` | pytest | スタブ不要。同上 | 機能一覧・要件定義書・このグループの処理概要表の行だけ・データ辞書が入ること |
| `E2eFakeLLM`(段階2の出力) | pytest | ── (偽 LLM 自体が SUT) | 固定の出力が、段階1の偽の下書きと噛み合うこと |

## 動作確認(実施済み)

```bash
cd devex-api/backend
uv run pytest tests/unit/test_data_flow_drafting.py
# 4 passed
```
