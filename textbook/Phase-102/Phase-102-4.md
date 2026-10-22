# Phase-102-4: 案の LLM の下書き

## この章の目的

開発者が案を一から書く手間を減らすため、説明書から LLM に2〜3の案の下書きを作らせる。下書きは要約(Phase 84)と同じく「未確認」ででき、説明書には載らない。開発者が照合の結果を見て「取り込む」と CR の案になり、その後は開発者が書いた案と同じに直せる(決定2「LLM の下書きは任意。確かめるまで出さない」)。

自動実装モード: on([introduction](./Phase-102-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 内容 |
| --- | --- |
| [`backend/app/change_requests/option_drafting.py`](../samples/backend/app/change_requests/option_drafting.py) | 新規。LLM の入力・構造化出力の形・案への変換・照合・状態の名前 |
| [`backend/app/change_requests/__init__.py`](../samples/backend/app/change_requests/__init__.py) | 下書きの名前を re-export |
| [`backend/app/repositories/change_request_option_draft.py`](../samples/backend/app/repositories/change_request_option_draft.py) | 新規。下書き(CR ごとに1行)の読み出し・上書き |
| [`backend/app/services/errors.py`](../samples/backend/app/services/errors.py) | `ChangeRequestOptionDraftNotFoundError`(404 `CR_OPTION_DRAFT_NOT_FOUND`) |
| [`backend/app/schemas/change_request.py`](../samples/backend/app/schemas/change_request.py) | 下書きの応答 `OptionDraftRead` |
| [`backend/app/services/change_request_service.py`](../samples/backend/app/services/change_request_service.py) | `generate_option_draft`・`option_draft`・`adopt_option_draft`・`OptionDraftView` |
| [`backend/app/api/routes/change_requests.py`](../samples/backend/app/api/routes/change_requests.py) | `POST`・`GET .../options/draft`、`POST .../options/draft/adopt` |
| [`backend/app/ai/llm/fake.py`](../samples/backend/app/ai/llm/fake.py) | E2E の偽 LLM が `OptionDraftOut` を返す |
| [`backend/tests/unit/test_change_request_option_drafting.py`](../samples/backend/tests/unit/test_change_request_option_drafting.py) | 新規。下書きの純粋な部分のテスト |
| [`backend/tests/unit/test_change_request_option_service.py`](../samples/backend/tests/unit/test_change_request_option_service.py) | 下書きの作成・取り込みのテスト(102-2 のファイルに足した) |
| [`backend/tests/unit/test_change_requests_api.py`](../samples/backend/tests/unit/test_change_requests_api.py) | 下書きのルートとルーターの登録 |
| [`backend/tests/unit/test_fake_llm_e2e.py`](../samples/backend/tests/unit/test_fake_llm_e2e.py) | 偽 LLM の下書きの契約テスト |
| [`backend/tests/integration/test_change_requests_flow.py`](../samples/backend/tests/integration/test_change_requests_flow.py) | 下書き → 取り込み → 説明書 → 案を選ぶ合意 → CASCADE を PostgreSQL で |

## 1. 入力・出力・照合(純粋関数)

```python
# app/change_requests/option_drafting.py(抜粋)
class OptionDraftOut(BaseModel):          # 構造化出力
    options: list[OptionDraftItemOut]     # {name, targets: [{requirement_id, kind, proposed_text}], outcome}
    recommended: int | None = None
    reason: str = ""


def build_option_draft_messages(explanation_markdown: str) -> list[BaseMessage]: ...   # 説明書だけ
def draft_to_options(out: OptionDraftOut) -> ChangeOptions: ...   # 上限の数・文の長さで切る(規則は見ない)
def draft_to_json(options: ChangeOptions) -> dict: ...            # 案の保存の形(0件でも空の一覧)


@dataclass(frozen=True)
class OptionDraftCheck:
    problems: tuple[str, ...]                 # 案の規則・CR の対象に無い要件(取り込めない)
    unknown_requirement_ids: tuple[str, ...]  # 文に出る、説明書に無い要件 ID(知らせるだけ)
    unknown_numbers: tuple[str, ...]          # 同じく数字


def check_option_draft(options, explanation, targets, adds_requirement) -> OptionDraftCheck: ...
```

- **入力は説明書の md だけ**(要約と同じ方針)。案の対象は説明書の2節の要件 ID から選ばせ、工数・日数のような説明書に無い数字は書かせない(規模は Devex が案ごとに数える)。
- 照合は2段にした(相談の決定3)。案の規則(`normalize_options`)と CR の対象(`option_target_problems`)に合わない下書きは取り込めない(`problems`)。文(名前・結果・変更後の案・理由)に出る要件 ID・数字は、要約と同じ `check_summary` で説明書と照らし、合わなければ知らせるだけにする(人が判断する。要約の確かめと同じ)。
- `draft_to_options` は規則を見ずに切るだけにした。規則に合わない下書きも保存して見せ、何が合わないかを開発者に示すためである。

## 2. 保存と状態

- 表 `change_request_option_drafts`(102-2 で作った)。`replace` は作り直すと上書きし、取り込んだ記録を消す(要約と同じ)。
- 状態は `unconfirmed`(未確認)/ `adopted`(取り込み済み)。要約の「古い」と同じ考えで、作った時点の説明書の指紋と今の指紋が違えば、応答の `stale` が真になる(取り込むと説明書に選択肢の節が入るので、取り込んだ後は必ず `stale`)。

## 3. サービスとルート

```python
# app/services/change_request_service.py(抜粋)
async def generate_option_draft(self, project, number, *, user_id) -> OptionDraftView:
    change_request = await self._load(project, number)
    self._next(change_request, "edit")                 # 案を直せる状態(下書き・説明済み)だけ
    explanation = await self._explanation(change_request)
    resolved = await self._summary_llm(user_id)        # 要約と同じ生成の用途
    out = await invoke_structured(resolved.llm, OptionDraftOut,
                                  build_option_draft_messages(explanation.markdown))
    await self._option_drafts.replace(..., options=draft_to_json(draft_to_options(out)), status="unconfirmed")


async def adopt_option_draft(self, project, number, *, actor_id) -> ChangeRequestView:
    view = await self._option_draft_view(...)
    if not view.check.adoptable:
        raise ChangeRequestOptionInvalidError(...)
    view.draft.status = "adopted"; view.draft.adopted_by = actor_id; view.draft.adopted_at = now
    payload = ChangeRequestUpdate(options=ChangeRequestOptionsIn.model_validate(
        options_to_json(normalize_options(view.options))))
    return await self.update(project, number, payload, actor_id=actor_id)   # 案を直す更新と同じ経路
```

- 取り込みは、案を直す更新(`update`)をそのまま通す(#17)。時系列の直した行・説明済みから下書きへの戻り・CR の対象での確かめ直しが、手で案を書いたときと同じになる。下書きの状態は `update` の commit で一緒に保存される。
- 合意・却下の後は下書きを作れない(409 `CR_INVALID_TRANSITION`)。案を直せないからである。
- ルートは `POST .../options/draft`(作る)・`GET .../options/draft`(読む)・`POST .../options/draft/adopt`(取り込む。応答は CR の詳細)。要約のルートと同じく、回数の上限は付けない(要約の上限も「使われ方を見て決める」のまま)。

## 4. E2E の偽 LLM

`E2eFakeLLM` の構造化出力に `OptionDraftOut` を足した。説明書の2節の表の要件 ID を読み、先頭の要件だけを変える案と、すべてを変える案の2つを返す(文に要件 ID・数字を書かないので照合を通る)。画面の E2E は Phase 107・110 で使う。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_change_request_option_drafting.py` | `build_option_draft_messages`・`draft_to_options`・`draft_to_json`・`check_option_draft`・`OptionDraftOut`・`OptionDraftItemOut`・`OptionDraftTargetOut`・`OptionDraftCheck`・`OPTION_DRAFT_STATUS_LABEL` | pytest のテスト関数 | スタブ不要 ── 純粋。照合の説明書は fixture から組み立てる |
| `test_change_request_option_service.py`(102-4 の分) | `generate_option_draft`・`option_draft`・`adopt_option_draft`・`OptionDraftView`、`ChangeRequestOptionDraftRepository`・`ChangeRequestOptionDraft` | pytest のテスト関数 | SQLite のセッションと fixture。下書きの LLM は、決まった `OptionDraftOut` を返すフェイク(`FakeLLM`)をサービスに注入する |
| `test_change_requests_api.py`(`test_option_draft_routes`・ルーターの登録) | 3つのルートと `OptionDraftRead` | pytest のテスト関数 | LLM の解決(`LlmResolver.resolve`)をフェイクに差し替える(`stub_llm_resolver`) |
| `test_fake_llm_e2e.py`(下書き) | `E2eFakeLLM` の `OptionDraftOut` | pytest のテスト関数 | スタブ不要 ── 偽 LLM そのものが SUT。本物のプロンプトと説明書を渡す契約テスト |
| `test_change_requests_flow.py`(`test_options_draft_adopt_and_agree`) | 下書き・取り込み・説明書・合意の API と JSONB・CASCADE | httpx の AsyncClient | 実 PostgreSQL(専用のテスト DB)。LLM の解決だけフェイク |

- 純粋: 入力は説明書だけ(上限で切る)。案の数の上限・削除の案の文を捨てる・保存の形の往復。良い下書きは照合を通る。規則(1件)と CR の対象の外(NFR-001)は `problems`。説明書に無い要件 ID・数字は知らせるが取り込める。
- サービス: 下書きが無ければ404、作ると未確認で照合の結果つき、取り込むと案が CR に写り下書きに戻り、下書きは取り込み済み・`stale`。作り直すと未確認に戻り、行は1つ。対象の外の下書きは取り込めない。却下の後は作れない。
- ルート: 生成の用途で解決・状態の名前・照合・取り込みの応答。
- 統合: 404 → 作る → 取り込む → 説明書の選択肢の節と `option_scales` → 案を選ばない合意は422 → 案1で合意すると対象と予測が案1のもの → プロジェクトの削除で下書きも消える。

`__init__.py`・`errors.py` の追加は、サービスのテストが `app.change_requests`・`app.services.errors` から import して通る(#15)。
