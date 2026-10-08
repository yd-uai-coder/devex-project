# Phase-32-1: 偽 LLM の段階8と契約テスト(BE)

## この章の目的

E2E 用の偽 LLM(`E2eFakeLLM`)は、段階8の構造化出力(`ProcedureDocGenerationOutput`・`SimpleProcedureDocGenerationOutput`)を知らなかった。そのため、未対応のスキーマとして `NotImplementedError` を投げ、E2E で段階8を生成すると必ず失敗していた。この章では2つのことをする。

- 偽 LLM に、両モードの段階8の手順書を登録する。
- その出力が本物の生成・検証・承認・出力の経路を通ることを、ブラウザを使わない契約テストで固定する。

E2E は段階8の生成までにした(着手時の決定2)。段階8の承認と実装手順書の zip は、この章の契約テストだけが通す。

自動実装モード: on([introduction](./Phase-32-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/ai/llm/fake.py`](../samples/backend/app/ai/llm/fake.py) | 更新 | 段階8の手順書(詳細設計モード・簡易モード)を `_UML_OUTPUTS` に登録する |
| ── ここからテスト ── | | |
| [`tests/unit/test_fake_llm_detailed_design.py`](../samples/backend/tests/unit/test_fake_llm_detailed_design.py) | 更新 | 段階1〜7 → zip の後に、段階8の全単位の生成 → 承認 → 実装手順書の zip を足す |
| [`tests/unit/test_fake_llm_simple_procedure.py`](../samples/backend/tests/unit/test_fake_llm_simple_procedure.py) | 新規 | 偽 LLM の4文書から簡易モードの段階8を開き、全単位の生成 → 承認 → zip |

BE のパスは `devex-api/backend/` 基準。

## 要点の抜粋

```python
# app/ai/llm/fake.py
# 段階8(実装手順書)の手順書。どの単位にも同じ手順書を返す。ファイルは段階4のモジュール一覧
# (詳細設計モード)・内部設計書のモジュール一覧(簡易モード)のパスにそろえる。指摘は軽微な1件だけに
# する(最重要があると、画面で承認の前に確認が挟まるため)。
_UML_OUTPUTS[ProcedureDocGenerationOutput] = ProcedureDocGenerationOutput(
    purpose="[E2E Fake] 予約を登録して一覧で確かめられる",
    files=[GeneratedUnitFile(path="app/services/reservation.py", kind="module", ...), ...],
    ...
    findings=[GeneratedFinding(level="minor", target="07章 ログ", ..., fix_stage=7)],
)
_UML_OUTPUTS[SimpleProcedureDocGenerationOutput] = SimpleProcedureDocGenerationOutput(
    ...
    findings=[GeneratedSimpleFinding(level="minor", target="3.4", ..., fix_document="internal_design")],
)
```

```python
# tests/unit/test_fake_llm_simple_procedure.py
async def _fake_documents(llm: E2eFakeLLM) -> dict[str, str]:
    """偽LLM が、4文書それぞれのプロンプトに返す本文(文書の種類 → 本文)。"""
    ...  # _DOC_TYPE_PROMPTS の各プロンプトを SystemMessage にして ainvoke

project = await create_simple_procedure_project(db_session, **await _fake_documents(llm))
```

## 設計判断

### 承認と zip は契約テストで、E2E は生成まで

E2E は画面の操作(単位を選ぶ・生成する・「生成済」になるまで待つ)を確かめる。承認と zip の中身は、サーバーの経路の確認で足りる。ブラウザを使わないテストに置けば速く、落ちたときに画面と偽 LLM のどちらが原因かを切り分けられる([Phase 24-1](../Phase-24/Phase-24-1.md) と同じ考え方)。

### どの単位にも同じ手順書を返す

偽 LLM はステートレスで、どの単位の生成かを見分けない(段階5の手順と同じ方針)。単位の ID とタスク名は段階7(簡易モードは WBS)から写されるので、同じ出力でも単位ごとの手順書になる。ファイルは両モードの偽の設計にあるパスにそろえたので、検証の警告も出ない(詳細設計モードで確かめた)。

### 指摘は軽微な1件

最重要の指摘があると、画面は承認の前に確認ダイアログを出す([Phase 28](../Phase-28/Phase-28-introduction.md))。E2E の操作を増やさないため、軽微な指摘を1件だけにした。0件にしなかったのは、未定義の列と、簡易モードの直す先(`fix_document`)が出力を通ることを確かめるため。

### 簡易モードの4文書は既存の fixture に差し込む

`create_simple_procedure_project` は、4文書をキーワード引数で差し替えられる([Phase 31-4](../Phase-31/Phase-31-4.md))。偽 LLM の本文はプロンプトから取る(`test_fake_llm_e2e.py` と同じ方法)ので、fixture は変えていない。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `E2eFakeLLM` の段階1〜8の出力と、生成・検証・承認・出力の経路 | pytest(`test_fake_llm_detailed_design.py`) | なし ── 偽 LLM は検証される側(出力の出どころ)。DB はインメモリ SQLite、図の配置は実際に計算する | 第一テスト(統合スモーク): 段階1〜7 → zip の後に、段階8の M-01-T01〜T03 を生成し、検証のエラーが無いことを確かめて承認し、実装手順書の zip に `index.md`・`implementation_procedure.html`・`ai/M-01-T02.md` が入る |
| `E2eFakeLLM` の4文書と簡易モードの段階8の出力と、同じ経路 | pytest(`test_fake_llm_simple_procedure.py`) | なし ── 同上 | 段階8だけが開き文書の指摘が無い。M-01-T01・T02 を生成し、指摘の直す先が `internal_design`。承認して zip |
