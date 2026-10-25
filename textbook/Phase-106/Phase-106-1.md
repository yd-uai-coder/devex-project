# Phase-106-1: 段階の参照の切れ(段階7 の再生成と、言い換えでの確かめ)

## この章の目的

段階2〜7 は、段階1(機能一覧)の処理 ID を参照する。段階1 を作り直して ID が消えると、後の段階に「機能一覧に無い処理」が残る(Phase 99 の段階5 で起き、段階5 には付け替え・削除の一覧を置いた)。調べると、段階2・3・4 の再生成は機能一覧に無い ID を捨てるが、段階7 の再生成は AI が書いた ID をそのまま残していた。この章で段階7 の再生成もそろえ、Phase 105 の言い換えの規則で「段階1 を言い換えて作り直しても、段階2・3・4・7 の参照は切れない」ことをテストで固定する。段階2・3・7 の付け替え・削除の一覧は Phase 109 の画面で作る(着手時の相談 2)。

自動実装モード: on([introduction](./Phase-106-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 内容 |
| --- | --- |
| [`backend/app/detailed_design/plan.py`](../samples/backend/app/detailed_design/plan.py) | 機能一覧に無い処理 ID を外す `drop_unknown_functions` を足した |
| [`backend/app/detailed_design/__init__.py`](../samples/backend/app/detailed_design/__init__.py) | `drop_unknown_functions` を re-export |
| [`backend/app/services/design_stage_generation_service.py`](../samples/backend/app/services/design_stage_generation_service.py) | 段階7 の再生成で `drop_unknown_functions` を通す |
| [`backend/tests/unit/test_plan.py`](../samples/backend/tests/unit/test_plan.py) | `drop_unknown_functions` のテストを足した |
| [`backend/tests/unit/test_design_stage_plan_generation.py`](../samples/backend/tests/unit/test_design_stage_plan_generation.py) | 再生成の結果に機能一覧に無い ID が残らないテストを足した |
| [`backend/tests/unit/test_paraphrase.py`](../samples/backend/tests/unit/test_paraphrase.py) | 言い換えた段階1 に対する段階2・3・4・7 の参照のテストを足した |

## 1. 段階7 の再生成で機能一覧に無い ID を捨てる

```python
# app/detailed_design/plan.py(抜粋)
def drop_unknown_functions(model: PlanModel, function_ids: Iterable[str]) -> PlanModel:
    known = set(function_ids)
    return model.model_copy(update={"milestones": [...]})  # タスクの function_ids を known だけに

# app/services/design_stage_generation_service.py(generate_plan の抜粋)
model = normalize_plan(to_plan_model(crosscutting, plan_output), paths)
model = drop_unknown_functions(model, (row.id for row in function_list.functions))
```

- 段階2(`merge_summaries`)・3(`merge_crud`)・4(`merge_modules`)は、組み立てるときに機能一覧に無い ID を捨てる。段階7 だけが AI の出力を素通しにしていたので、同じ扱いにした。
- `normalize_plan` に入れず、別の関数にした。`normalize_plan` は簡易モードの作業単位(`app/detailed_design/impact/simple.py`)も使い、そちらには段階1 の機能一覧が無いからである。
- 人が保存した計画には使わない。機能一覧に無い処理は検証(`UNKNOWN_FUNCTION`)が指摘し、どの処理へ付け替えるかは人が決める(Phase 109 の一覧)。タスクとキーは残し、処理 ID だけを外す。

## 2. 段階1 の ID は言い換えても切れない

```python
# tests/unit/test_paraphrase.py(抜粋)
first, second = _paraphrase_twice()          # 段階1 と、言い換えた出力で作り直した段階1
models = {2: DataFlowModel(...), 3: CrudModel(...), 4: ModuleListModel(...), 7: PlanModel(...)}
for stage, model in models.items():          # 前の版の ID で書いた後の段階
    assert _unknown_function_targets(stage, model.model_dump(mode="json"), second) == []
```

- 段階1 の ID は再利用されない(`next_number` は増えるだけ)。言い換えた名前でも、API はトリガー、画面の処理は関連画面で前の ID を引き継ぐ(Phase 99・105)。だから、残った ID は同じ処理を指し、切れるのは消えた ID だけである。
- 調べてわかったこと: 段階2 の処理概要表と段階3 の CRUD 図は、画面が機能一覧の処理だけを行にするので、切れた ID の行は画面に出ず手で直せない(保存では残る)。段階4・7 は自由入力なので直せる。この「見えない行」は Phase 109 の一覧で扱う。

## テスト観点

用語: SUT = テストの対象、ドライバ = SUT を呼ぶもの、スタブ = SUT が呼ぶものの代わり(テストダブル)。

- `test_plan.py`(足した1件)
  - SUT: `drop_unknown_functions`。ドライバ: テスト関数。スタブ不要 ── 純粋関数で、外部依存を呼ばないため。
  - 機能一覧に無い ID だけを外し、タスクとキーは残す。渡したモデルは変えない。
- `test_design_stage_plan_generation.py`(足した1件)
  - SUT: 段階7 の生成(`generate_plan`)。ドライバ: テスト関数(サービスのメソッドを直接呼ぶ)。スタブ: FakeLLM(横断事項・実装計画の構造化出力を順に返す。実装計画に機能一覧に無い `F-99` を書く)。DB はインメモリ SQLite。
  - 再生成の結果に `F-99` が残らない。
- `test_paraphrase.py`(統合スモークを共通の組み立てに寄せ、1件足した)
  - SUT: `paraphrase_function_list` で言い換えた出力に対する `merge_draft` と、段階2・3・4・7 の検証(`validate_stage` の `UNKNOWN_FUNCTION`)。ドライバ: テスト関数。スタブ不要 ── 純粋関数で、外部依存を呼ばないため。
  - 前の版の ID で書いた後の段階は、言い換えて作り直した段階1 に対して切れない。処理を1つ消した段階1 に対しては切れる(検証が指摘する)。
