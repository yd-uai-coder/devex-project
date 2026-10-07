# Phase-28-2: 手順書の下書き(BE)

## この章の目的

段階8に生成器を登録し、人が選んだ作業単位の手順書を、1単位につき LLM を1回、1回に5つまで下書きする。入力は 28-1 の展開(単位が参照する設計の該当箇所と、07章・開発環境)だけで、設計の全文は渡さない。AI には設計を書き写させず、設計に無いために決められないことを「AI の指摘」(重要度・対象・内容・直す先の段階)として挙げさせる。下書きは対象の単位だけを置き換え、他の単位の手順書(人の手直し)はそのまま残す。

自動実装モード: on([introduction](./Phase-28-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/` 基準) | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/detailed_design/procedure_doc.py`](../samples/backend/app/detailed_design/procedure_doc.py) | 更新 | `MAX_PROCEDURE_DOC_TARGETS`・`documented_unit_ids`・`generation_targets`・`merge_unit_procedure`(純粋) |
| [`app/detailed_design/procedure_doc_drafting.py`](../samples/backend/app/detailed_design/procedure_doc_drafting.py) | 新規 | 出力スキーマ(`ProcedureDocGenerationOutput` ほか)、`PROCEDURE_DOC_SYSTEM_PROMPT`、`build_procedure_doc_messages`・`to_unit_procedure`(純粋) |
| [`app/detailed_design/__init__.py`](../samples/backend/app/detailed_design/__init__.py) | 更新 | `MAX_PROCEDURE_DOC_TARGETS`・`documented_unit_ids`・`merge_unit_procedure` の re-export |
| [`app/schemas/design_stage.py`](../samples/backend/app/schemas/design_stage.py) | 更新 | `DesignStageGenerate.unit_ids` |
| [`app/services/design_stage_generation_service.py`](../samples/backend/app/services/design_stage_generation_service.py) | 更新 | `generate_procedure_docs`・`STAGE_GENERATORS[8]`、`unit_ids` を受け付け・確認・対象・実行に通す |
| [`app/api/routes/design_stages.py`](../samples/backend/app/api/routes/design_stages.py) | 更新 | 生成のルートで `unit_ids` を受け渡す |
| ── ここからテスト ── | | |
| [`tests/fixtures/detailed_design.py`](../samples/backend/tests/fixtures/detailed_design.py) | 更新 | `procedure_doc_output`(FakeLLM が返す手順書1つ分の出力) |
| [`tests/unit/test_procedure_doc.py`](../samples/backend/tests/unit/test_procedure_doc.py) | 更新 | 手順書の有無・生成の対象・merge |
| [`tests/unit/test_procedure_doc_drafting.py`](../samples/backend/tests/unit/test_procedure_doc_drafting.py) | 新規 | プロンプトの節・出力の変換・`fix_stage` の正規化 |
| [`tests/unit/test_design_stage_procedure_doc.py`](../samples/backend/tests/unit/test_design_stage_procedure_doc.py) | 更新 | 生成(ルート・既定の対象・作り直し・受け付けの断り)。Phase 27 の「生成は未対応」のテストを削除 |
| [`tests/unit/test_design_stage_generation.py`](../samples/backend/tests/unit/test_design_stage_generation.py) | 更新 | background task の引数(`unit_ids` が増えた)を位置で確かめる |

## 要点の抜粋

```python
# app/detailed_design/procedure_doc.py(28-2 の分)
MAX_PROCEDURE_DOC_TARGETS = 5

def documented_unit_ids(plan, model) -> set[str]       # ID とタスク名の両方が段階7と合う単位だけ
def generation_targets(plan, model, requested: Sequence[str] | None) -> list[str]
    # None → 段階7の単位のうち手順書の無いもの(計画の並び順)/ 指定 → 空白・重複を除いてその順
def merge_unit_procedure(model, plan, procedure: UnitProcedure) -> ProcedureDocModel
    # 同じ unit_id を置き換え、段階7の並び順に。段階7に無い単位の手順書は消さずに後ろへ
```

```python
# app/detailed_design/procedure_doc_drafting.py
class ProcedureDocGenerationOutput(BaseModel):
    purpose: str
    files: list[GeneratedUnitFile]        # path・kind(module/test/config)・responsibility・basis
    notes: list[str]                      # 自明な作業と、単位の中の順序の理由だけ
    tests: list[GeneratedTestPoint]       # viewpoint・sut・driver・stub
    gwt: list[str]; verify: list[str]
    findings: list[GeneratedFinding]      # level・target・message・fix_stage(1〜7)

def build_procedure_doc_messages(context: UnitContext) -> list[BaseMessage]
    # ## 対象の単位(種別・処理・依存・モジュール・環境・設定のファイル)
    # ## 参照する設計(展開した md。設計に無い参照は「- 見出し: 設計にありません」)
    # ## 共通の方針(段階7)(07章・開発環境)
def to_unit_procedure(unit: PlanUnit, output) -> UnitProcedure
    # unit_id・title は段階7から写す。空の行を捨てる。fix_stage は 1〜7 以外を 8 に
```

```python
# app/services/design_stage_generation_service.py
async def generate_procedure_docs(context) -> dict:
    plan = PlanModel.model_validate(context.sources.stages.get(PLAN_STAGE) or {})
    model = ProcedureDocModel.model_validate(context.previous or {})
    for unit_id in context.targets:
        unit = find_unit(plan, unit_id)                       # 無ければ飛ばす
        output = await _invoke_structured(context.llm, ProcedureDocGenerationOutput,
                                          build_procedure_doc_messages(unit_context(unit, context.sources.stages)))
        model = merge_unit_procedure(model, plan, to_unit_procedure(unit, output))
    return model.model_dump(mode="json")

STAGE_GENERATORS[8] = generate_procedure_docs
# _targets(stage, model, function_ids, logics, unit_ids, sources)   段階8は sources の段階7から
# _check_request(...): 段階8以外の unit_ids / 対象が空 / 段階7に無い単位 / 5件超 → DESIGN_STAGE_INVALID
# _has_draft: 段階8は対象の単位にもともと手順書があったか(→ regenerated)
```

## 設計判断

### 対象は段階7の単位から決める(Claude の判断)

段階5・6の対象は「保存した model の中で選んだ行」だった(人が先に選んで保存する)。段階8の単位の正本は段階7で、手順書の無い単位は model に行が無い。そこで対象は承認済みの段階7(`StageSources.stages[7]`)から決め、受け付け(`request_generation`)は `stage_view` の入力を `_check_request` に渡す。指定を省いたときは手順書の無い単位を対象にする(段階5の「手順の無い処理」と同じ)。

手順書の有無は、単位の ID とタスク名の両方が段階7と合うかで決める(`documented_unit_ids`)。段階7を改名した後の手順書は Phase 27 の `UNIT_MISMATCH` で、作り直しの対象だからである。画面の「生成済/未生成」(`procedureUnits` の `hasProcedure`)と同じ判定にそろえた。

### merge は対象の単位だけ・段階7に無い単位は消さない

`merge_unit_procedure` は同じ `unit_id` の手順書を置き換え、単位を段階7の並び順に並べる。段階7から消えた単位の手順書は、消さずに後ろへ置く。Phase 27 で「段階7と合わなくなった手順書は自動で付け替えない(検証のエラーで人に知らせる)」と決めており、生成のついでに消すと、人が手直しした手順書が黙って失われるためである。消すのは画面の「この単位の手順書を削除」(28-4)。

### プロンプト: 書き写さない・推測で埋めない

[25-1](../Phase-25/Phase-25-1.md) の決定を、システムプロンプトの規則にした。

- 設計にある振る舞い(条件・ステータス・並び順・例外の応答)は手順書に書かず、参照に任せる(作成方針の原則7)。
- 設計に無いために決められないことは、推測で埋めずに `findings` に挙げる(決定3)。
- 「設計にありません」とある参照は検証が別に指摘するので、参照が無いこと自体は挙げず、そのために決められない具体的な内容を挙げる(検証と AI の指摘を重ねない)。
- 実装の要点は、自明な作業と単位の中の順序の理由だけ(決定5)。テストは観点(SUT・ドライバ・スタブ、Given/When/Then)まで(決定7)。
- 単位の ID とタスク名は書かせない(段階7から写す。手順書と段階7を突き合わせる鍵のため)。

### `fix_stage` を 1〜7 に限る(Claude の判断)

AI の指摘の「直す先の段階」は、画面の「段階Nで直す」の行き先になる。手順書の上では決めない原則なので、AI には 1〜7 から選ばせ、範囲の外の値は 8(ボタンを出さない)にする。外部設計・要件定義の不足は、それを写した段階1(機能一覧)へ向ける(段階の外の文書は SCR-008 から直せないため)。

### 偽 LLM への登録は Phase 32

E2E 用の偽 LLM(`app/ai/llm/fake.py`)は、未登録のスキーマで `NotImplementedError` を出す。段階8を E2E で通すのは Phase 32 なので、登録と段階1〜8の契約テストはそこで行う([25-4](../Phase-25/Phase-25-4.md))。この章のサービスのテストは、テスト内の `FakeLLM`(`tests/fixtures/fake_llm.py`)に `procedure_doc_output()` を返させる。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `documented_unit_ids`・`generation_targets`・`merge_unit_procedure` | pytest(`test_procedure_doc.py`) | スタブ不要 ── 純粋で、model と段階7の内容だけから決まるため | 手順書の有無は ID とタスク名の両方で決まる。既定の対象は手順書の無い単位。指定は空白・重複を除いた順。merge は対象だけを置き換えて段階7の順に並べ、段階7に無い単位は後ろに残す |
| `build_procedure_doc_messages`・`to_unit_procedure` | pytest(`test_procedure_doc_drafting.py`) | スタブ不要 ── 純粋で、LLM を呼ばないため(メッセージを組み立て、構造化出力を変換するだけ) | 第一テストの統合スモーク: 単位の材料からメッセージを作り、出力を手順書にする(ID・タスク名は段階7から)。システムプロンプトの末尾は `NAMING_RULES`。対象の単位・展開した参照・共通の節が入る。設計に無い参照は「設計にありません」。基盤の単位は参照なし。空の行を捨て、`fix_stage` の範囲の外は 8 |
| `DesignStageGenerationService`(段階8)・`generate_procedure_docs`・ルート | pytest(`test_design_stage_procedure_doc.py`) | `FakeLLM` ── 構造化出力(Gemini)の代わり。対象の単位ごとに1回呼ぶ。DB はインメモリ SQLite でスタブにしない(段階の行の状態の移り変わりそのものが検証対象のため) | 第一テスト: ルートで `unit_ids` を受け付け → 下書き(`draft`)→ そのまま承認できる。既定の対象で2単位を順に下書き。作り直しは対象だけを置き換えて `regenerated`。受け付けの断り(対象が空・段階7に無い単位・上限超え(上限を `monkeypatch` で1に)・段階8以外への `unit_ids`) |
| background task の引数 | pytest(`test_design_stage_generation.py`) | `FakeLLM`(既存) | 引数に `unit_ids` が増えたので、段階5・6の対象を末尾からでなく位置(`args[3]`・`args[4]`)で確かめる |

## 動作確認(実施済み)

```bash
cd devex-api/backend
uv run pytest tests/unit/test_procedure_doc.py tests/unit/test_procedure_doc_drafting.py tests/unit/test_design_stage_procedure_doc.py tests/unit/test_design_stage_generation.py
```
