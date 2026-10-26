# Phase-112-1: 反映の前 → 後(API)

## この章の目的

CR を文書へ反映(要件定義書からの再生成)しても、影響のタブに出るのは規模の予測と実際・印の比較(数と要素の名前)までで、要素の文がどう変わったかは見られなかった([111-3](../Phase-111/Phase-111-3.md) の指摘 #7・#8)。この章で、反映の直前の版と反映で作った版の合意の対象の要素を、要素のキーでシステムが比べ(LLM は使わない)、欄ごとの前 → 後を反映の記録に残して、比較の API で返す。

自動実装モード: on([introduction](./Phase-112-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/agreements/reflection_diff.py`](../samples/backend/app/agreements/reflection_diff.py) | 新規 | 前 → 後の純粋関数(`reflection_changes`・`changes_to_json`・`changes_from_json`・`applied_reflections`) |
| [`app/agreements/__init__.py`](../samples/backend/app/agreements/__init__.py) | 更新 | `reflection_diff` の re-export |
| [`app/schemas/change_request.py`](../samples/backend/app/schemas/change_request.py) | 更新 | `FieldChangeRead`・`ReflectionChangeRead`・`AppliedReflectionRead`・比較の応答の `reflections` |
| [`app/services/change_request_service.py`](../samples/backend/app/services/change_request_service.py) | 更新 | `record_document_apply` が前 → 後を残す(`document_changes`)・`comparison` が `reflections` を返す |
| [`app/services/doc_generator_service.py`](../samples/backend/app/services/doc_generator_service.py) | 更新 | 作った版の `protection` を集め、前後の model と一緒に渡す |
| [`app/api/routes/change_requests.py`](../samples/backend/app/api/routes/change_requests.py) | 更新 | `GET .../comparison` が `reflections` を詰める |
| [`tests/unit/test_reflection_diff.py`](../samples/backend/tests/unit/test_reflection_diff.py) | 新規 | 純粋関数 |
| [`tests/unit/test_change_request_reflection.py`](../samples/backend/tests/unit/test_change_request_reflection.py) | 更新 | 反映の記録と比較の応答 |
| [`tests/integration/test_change_requests_flow.py`](../samples/backend/tests/integration/test_change_requests_flow.py) | 更新 | 比較の API の `reflections` |

## 1. 比べ方(純粋関数)

```python
# app/agreements/reflection_diff.py(抜粋)
ReflectionChangeKind = Literal["changed", "added", "removed", "restored"]
ReflectionScope = Literal["target", "predicted", "outside"]

@dataclass(frozen=True)
class FieldChange:
    name: str; label: str; before: str; after: str

@dataclass(frozen=True)
class ReflectionChange:
    key: str; kind: AgreedKind; label: str
    change: ReflectionChangeKind; scope: ReflectionScope
    fields: tuple[FieldChange, ...] = (); restore_reason: str | None = None

def reflection_changes(before, after, *, target_keys, rewritable, adds_requirement,
                       protection=()) -> list[ReflectionChange]
```

- **要素は合意の要素と同じもの**: `agreement_items`(要件・利用者と使う場面・画面・API・外部連携)で前後の要素を作り、キーで突き合わせ、比べる値 `body_of` が違えば変更にする(#17。合意の保護・状態と同じ物差し)。違いは欄ごと(`_FIELD_LABELS`。要件なら内容・種別・優先度・分類・出どころ・根拠の観点)に表示の文で持つ。並び(要件 ID など)は「、」、利用者は1行1人。
- **区分**: 対象の要件(と、CR が新しい要件を足すときの追加の要件)は `target`、書き換えてよい要素(`rewritable_keys`。保存した予測の画面・API)の残りは `predicted`、それ以外は `outside`(上流の書き換えで連れて変わった要素など。予測の外)。
- **戻した**: 作った版の `protection`(範囲の外で LLM が書き換え・落とした合意済みの要素を、合意の形へ戻した記録)のキーは `restored`。戻したので前後の文は同じで、欄は持たない。理由(`changed` / `dropped`)だけを持つ。
- 並びは、後の版の順 → 削除(前の版の順)→ 戻した。

## 2. 記録と読み出し

```python
# app/services/change_request_service.py(抜粋)
async def record_document_apply(self, change_request, *, documents, model, marks, actor_id,
                                before_models=None, after_models=None, protection=()) -> None:
    ...
    refs={"documents": [...], "model": model,
          "changes": changes_to_json(document_changes(change_request, before_models or {},
                                                      after_models or {}, protection))}

def document_changes(change_request, before_models, after_models, protection) -> list[ReflectionChange]
```

- **反映のときに求めて、時系列の `apply` の行に残す**(着手時の決定2): 版は巡回で消えるので、後で求め直せない。`DocGeneratorService.generate` は、生成の前に読んだ表示中の版(`previous_models`)・作った版(`new_models`)・作った版ごとの `protection` を渡す。作り直さなかった文書(起点より上流)は、前の版のまま比べる(変わらない)。DB の変更は無い。
- **読み出し**: `applied_reflections` が `documents` を持つ `apply` の行を新しい順に取り出す(段階への反映は `documents` を持たないので入れない)。`changes` の無い行(この Phase より前の反映)は `changes=None`(記録なし)。既に反映済みの CR の前 → 後は後から作らない(着手時の決定2)。
- **応答**: `ComparisonView.reflections` を `ChangeRequestComparisonRead.reflections`(`AppliedReflectionRead`。作った版は「要件定義書 v3」の表示名、`recorded`、種類と区分の表示名つき)で返す。新しい API は作らず、反映の後だけ読む比較の API に足した(画面の影響のタブが既に読んでいるため)。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_reflection_diff.py`(新規) | `reflection_changes`・`changes_to_json`・`changes_from_json`・`applied_reflections` | pytest のテスト関数 | スタブ不要 ── 対象が純粋(副作用なし)で、要素は本物の model から `agreement_items` で作るため |
| `test_change_request_reflection.py` に1本 | `ChangeRequestService.record_document_apply`・`comparison`(と `DocGeneratorService.generate`) | pytest のテスト関数 | DB はインメモリ SQLite、生成の LLM は FakeLLM(FR-001 の文を変えた要件定義書を返す) |
| `test_change_requests_flow.py`(統合) | `GET .../comparison` | httpx の AsyncClient | 実 PostgreSQL・Redis。生成の LLM は FakeLLM(`stub_llm_resolver`) |

- 統合スモーク: 既存の `test_generate_with_cr_puts_instruction_and_records_apply`(反映の記録の形が変わっても、版・印・状態は今までどおり)。
- 純粋関数: 対象の文の変更が欄の前 → 後になる・変わらない要素は出ない・区分(対象 / 予測 / 範囲の外)・追加と削除は空でない欄・CR が足さない追加は範囲の外・戻したは最後で欄なし(知らないキーは飛ばす)・利用者は1つの要素・保存の形の往復(壊れた項目は捨てる)・反映の取り出しは新しい順で段階の反映を除き、記録の無い反映は None。
- サービス: 反映の行の `refs.changes` に FR-001 の内容の変更(対象)が残り、比較の応答で `recorded`・作った版の表示名・種類と区分の表示名が読める。
