# Phase-50-1: 偽 LLM の契約テスト(変更の影響)

## この章の目的

Phase 42〜49 で作った変更の影響(承認時の写し・差分・見直しの印・確認済み・承認し直しの条件・差分の再生成と単位のキーの引き継ぎ)は、それぞれ fixture の設計で確かめてきた([`test_design_stage_impact.py`](../samples/backend/tests/unit/test_design_stage_impact.py) など)。E2E 用の偽 LLM(`E2eFakeLLM`)の出力が、この経路を**通しで**通ることは固定していなかった。ブラウザの E2E([50-2](./Phase-50-2.md))と同じ順の流れを、画面を使わずにサービスのメソッドで流す契約テストを足す([Phase 40-2](../Phase-40/Phase-40-2.md) と同じ考え方)。

自動実装モード: on([introduction](./Phase-50-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| ── ここからテスト ── | | |
| [`tests/fixtures/fake_llm_flow.py`](../samples/backend/tests/fixtures/fake_llm_flow.py) | 新規 | 偽 LLM で、詳細設計モードの段階を画面と同じ順に生成・承認する手順(既存の契約テストから移した) |
| [`tests/unit/test_fake_llm_detailed_design.py`](../samples/backend/tests/unit/test_fake_llm_detailed_design.py) | 更新 | 段階1〜7 の手順を fixture から呼ぶ(公開の挙動は変えない) |
| [`tests/unit/test_fake_llm_change_impact.py`](../samples/backend/tests/unit/test_fake_llm_change_impact.py) | 新規 | 段階1を直して承認し直す → 下流の印 → 確認済み → 承認し直す、同じ出力の再生成で印が増えない、簡易モードの単位の印 |

本体のアプリのコード(`fake.py` を含む)は変えていない。偽 LLM の出力は、そのままで経路を通った。

## 要点の抜粋

```python
# tests/fixtures/fake_llm_flow.py
async def generate_and_approve_stages_1_to_7(session, project, llm) -> None:
    """段階1〜7 を、画面と同じ順に生成・承認する(段階2・5・6 は対象を選んで保存してから生成)。"""
```

```python
# tests/unit/test_fake_llm_change_impact.py
# 段階1で直す処理(F-01 予約を登録する)の印が届く、段階ごとの要素のキー。F-02(一覧)には届かない
_F01_MARKS: dict[int, list[str]] = {
    2: ["summary:F-01"],
    3: ["crud:F-01×reservations"],
    4: ["module:app/api/routes/reservations.py", "module:app/services/reservation.py"],
    5: ["proc:F-01"],
    6: ["logic:app/services/reservation.py::ReservationService.create"],
    7: ["task:U-002"],
    8: ["unit:U-002"],
}

# 保存すると pending、承認し直すと記録。未確認の段階は承認できず、確認済みにすると承認できる
with pytest.raises(DesignStageUnreviewedImpactError):
    await approve_stage(db_session, project, 2)
await stages.review_marks(project, stage=2, keys=_F01_MARKS[2], reviewed=True)
await approve_stage(db_session, project, 2)
```

3つのテスト:

1. **詳細設計モードの通し**(統合スモーク): 段階1〜8 を承認 → 段階1の F-01 の要約を直して保存(印は `pending`)→ 承認し直す(印が記録され、変わったものは `fn:F-01`、再生成の候補は段階5・6・8)→ 段階2は未確認の印で止まり、確認済みにすると承認できる。
2. **同じ出力の再生成**: 文書(要件定義書・外部設計書)を偽 LLM で再生成しても、段階は「古い」になるが印は付かない(差分の再生成と、言い回しが変わらないこと)。
3. **簡易モード**: 初めの版の FR-001 の文を変えておき、偽 LLM で4文書を再生成する(FR-001 が偽の文に戻る = 要件が変わる)。実装計画書の単位のキー(`U-001`・`U-002`)は引き継がれ、FR-001 を担う単位(`U-002`)にだけ印が付き、確認済みにするまで段階8を承認できない。

## 設計判断

### 段階の手順を fixture に移す(#17)

既存の [`test_fake_llm_detailed_design.py`](../samples/backend/tests/unit/test_fake_llm_detailed_design.py) は、段階1〜7 を生成・承認する手順(`_generate`・`_approve_diagrams`・`_approve_stage` と段階ごとの保存)を自分の中に持っていた。新しい契約テストも同じ手順を要るので、コピーせず `tests/fixtures/fake_llm_flow.py` に移して共有した(#17 の「この Phase の実在の消費者」= `test_fake_llm_change_impact.py`)。既存のテストは段階1の検証のアサーションを段階1〜7 の後に移しただけで、確かめる内容は変えていない(#12-4 の番人は、このテスト自身の統合スモーク)。

### 直す変更は段階1の「要約」

段階1の処理の行のうち、要素の本文(`row_body`)に入る欄を変える必要がある。最初に試した `description` は機能一覧の行に無い欄で、差分にならなかった。画面でも編集できる「概要」(`summary`)を変えると、F-01 にだけ印が届き、F-02(同じ画面・同じモジュールを共有する一覧の処理)には届かない ── 「処理を軸」のたどり方([41-2](../Phase-41/Phase-41-2.md))を、偽 LLM の出力の上で固定できる。

### 簡易モードの初めの版も偽 LLM の4文書にそろえる

既存の [`test_fake_llm_simple_procedure.py`](../samples/backend/tests/unit/test_fake_llm_simple_procedure.py) は、要件定義書に fixture の model を使っている。そのまま偽 LLM で再生成すると、要件定義書が fixture から偽の出力に変わり、正当な変更として印が付く(試して確かめた)。「頼んでいない変更で印が増えない」を確かめるには、初めの4文書をすべて偽 LLM の出力にそろえる。そのうえで FR-001 の文だけを変えておき、意図した変更1つから印が付くことを確かめる。

## テスト観点

用語: SUT(テスト対象)/ ドライバ(テストを動かす側)/ スタブ(テストダブル)。

| テスト | SUT | ドライバ | スタブ |
| --- | --- | --- | --- |
| `test_smoke_editing_function_marks_downstream_until_reviewed` | E2eFakeLLM の出力と、`DesignStageService.save`・`approve`・`impact`・`review_marks` の経路 | テスト関数(画面の操作と同じ順) | なし ── 偽 LLM は検証される側(出力の出どころ)。DB はインメモリ SQLite(`db_session`)、図の配置はレイアウトエンジンで実際に計算する |
| `test_regenerating_documents_with_same_output_adds_no_marks` | `DocGeneratorService.generate` の差分の再生成と印の記録 | 同上 | 同上 |
| `test_simple_regeneration_keeps_unit_keys_and_marks_units_of_changed_requirement` | 簡易モードの4文書の再生成・単位のキーの引き継ぎ・段階8の印と承認の条件 | 同上 | 同上 |

`fake_llm_flow.py` は `test_fake_llm_detailed_design.py` と `test_fake_llm_change_impact.py` が import する(#15)。

```sh
cd devex-api/backend
uv run pytest -q tests/unit/test_fake_llm_change_impact.py tests/unit/test_fake_llm_detailed_design.py
```
