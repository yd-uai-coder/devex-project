# Phase-68-4: レビューと判定の呼び出し・レビューを使える人

## この章の目的

設計レビューと「直ったか」の判定を、持ち主のレビュー・判定の用途の LLM で呼ぶようにする。レビューの実効値を「superuser かつ設定」から「(superuser、またはレビューの用途の AI の自分のキーがある)かつ設定」に改め、画面がそれで出し分けられるよう `GET /users/me` に `review_allowed` を足す。自分のキーで流すレビュー・判定は、1日の回数の上限で数えない。

自動実装モード: on([introduction](./Phase-68-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/review/policy.py`](../samples/backend/app/review/policy.py) | 更新 | `review_effective(*, review_allowed, review_enabled)` |
| [`app/services/llm_resolver.py`](../samples/backend/app/services/llm_resolver.py) | 更新 | `review_effective`・`model_for`・`injected_llm` |
| [`app/schemas/user.py`](../samples/backend/app/schemas/user.py) | 更新 | `UserRead.review_allowed`・`review_effective` を値に(計算プロパティを外す) |
| [`app/api/user_read.py`](../samples/backend/app/api/user_read.py) | 新規 | `user_read(session, user)`(2つの値を埋めて返す) |
| [`app/services/user.py`](../samples/backend/app/services/user.py) | 更新 | レビューの設定の変更は `review_allowed` でなければ 403 |
| [`app/services/review_service.py`](../samples/backend/app/services/review_service.py) | 更新 | `_review_llm`・受け付けの条件・キーの確かめ・上限・記録するモデル |
| [`app/services/fix_check_service.py`](../samples/backend/app/services/fix_check_service.py) | 更新 | `_judge_llm`・上限・記録するモデル |
| [`app/services/doc_generator_service.py`](../samples/backend/app/services/doc_generator_service.py) | 更新 | 生成の後にレビューするかを `review_effective` で |
| [`app/api/routes/design_stages.py`](../samples/backend/app/api/routes/design_stages.py) | 更新 | 承認の後に判定を積むかを `review_effective` で |
| [`app/api/routes/users.py`](../samples/backend/app/api/routes/users.py)・[`app/api/routes/auth.py`](../samples/backend/app/api/routes/auth.py) | 更新 | ユーザーを返す5つのルートを `user_read` に |
| `app/ai/llm/claude.py` | 削除 | 呼び出しが無くなった |
| [`tests/fixtures/llm_resolver.py`](../samples/backend/tests/fixtures/llm_resolver.py) | 更新 | `models`(用途ごとの provider とモデル) |
| [`tests/unit/test_review_routes.py`](../samples/backend/tests/unit/test_review_routes.py) | 更新 | 自分のキーで使える・上限を数えない・記録するモデル |
| [`tests/unit/test_review_fix_check.py`](../samples/backend/tests/unit/test_review_fix_check.py) | 更新 | 自分のキーの判定と上限・記録するモデル。取得関数のテストを削除 |
| [`tests/unit/test_review_prompt.py`](../samples/backend/tests/unit/test_review_prompt.py)・[`tests/unit/test_review_llm.py`](../samples/backend/tests/unit/test_review_llm.py) | 更新 | 実効値の引数 / 取得関数のテストを削除 |
| [`src/features/design-review/api/reviewApi.ts`](../samples/frontend/src/features/design-review/api/reviewApi.ts) | 更新 | `CurrentUserRead.review_allowed` |
| [`src/features/design-review/review-store.ts`](../samples/frontend/src/features/design-review/review-store.ts) | 更新 | コメントだけ |
| [`src/features/design-review/components/ReviewPanel.tsx`](../samples/frontend/src/features/design-review/components/ReviewPanel.tsx) | 更新 | 出す条件を `is_superuser` → `review_allowed` |
| [`src/features/design-review/test-utils/reviewFixtures.ts`](../samples/frontend/src/features/design-review/test-utils/reviewFixtures.ts) | 更新 | `review_allowed: true` |
| [`src/features/design-review/components/__tests__/ReviewPanel.test.tsx`](../samples/frontend/src/features/design-review/components/__tests__/ReviewPanel.test.tsx) | 更新 | superuser でなくても使えるなら出す |

## 1. 実効値の判定を1か所に(`policy.py`・`llm_resolver.py`)

```python
# app/review/policy.py(要点)
def review_effective(*, review_allowed: bool, review_enabled: bool) -> bool:
    return review_allowed and review_enabled

# app/services/llm_resolver.py(要点)
async def review_effective(self, user: User) -> bool:
    return review_policy.review_effective(
        review_allowed=await self.review_allowed(user), review_enabled=user.review_enabled
    )
```

使えるかはキーの登録(DB)を読むので、今までの `review_effective(is_superuser=..., review_enabled=...)` のように User の列だけでは決まらない。呼び出し元5か所(レビューの受け付け・判定・生成の後・段階の承認・ユーザーの応答)は `LlmResolver(session).review_effective(user)` を呼ぶ。

`UserRead` は計算プロパティをやめ、`review_allowed`・`review_effective` を値で持つ。埋めるのは `app/api/user_read.py` の `user_read(session, user)` で、ユーザーを返すルート(登録・自分の情報・ユーザーネーム・メール・レビューの設定)が共通で使う。スキーマ(`schemas/`)はサービスを呼ばない層なので、ルートの側に置いた。

使えないユーザーがレビューの設定を変えようとしたら 403 `REVIEW_NOT_ALLOWED` のまま、文言を「設計レビューは、マイページでレビューの AI の API キーを登録すると使えます。」にした(今までは「管理者だけが変えられます」)。

## 2. レビュー(`review_service.py`)

```python
# app/services/review_service.py(要点)
async def start_review(self, project, user, *, gate, trigger) -> ReviewRun:
    if not await LlmResolver(self._session).review_effective(user):
        raise ReviewNotAllowedError(...)
    ...
    resolved = await self._review_llm(project.user_id)   # キーが無ければ ReviewUnavailableError(502)
    if not resolved.own_key:
        await self._enforce_limit(user)                   # 既定のキーの回だけ数える
    run = await self._runs.create_run(..., model=resolved.model)

async def _review_llm(self, user_id) -> ResolvedLlm:
    if self._llm is not None:
        return injected_llm(self._llm, Purpose.REVIEW)    # テストの差し替え(.env の既定のモデルとして記録)
    return await LlmResolver(self._session).resolve(user_id, Purpose.REVIEW)
```

- 今までは受け付けで `settings.ANTHROPIC_API_KEY` を直接見ていた。自分のキー・Gemini を選んだ場合に合わないので、解決そのもので確かめる(キーが無ければ解決が `ReviewUnavailableError` を投げる。自動のレビューは今までどおり失敗の回を残して自己診断に切り替える)。
- **1日の上限**(着手時の相談。推奨どおり): 上限はサーバーの既定のキーの費用を守るためのもの。自分のキーの費用は本人が払うので数えない。
- 回の `model` は `settings.REVIEW_MODEL` から解決したモデルに。受け付けで止まった回(`record_failed_start`)は、キーの無いときにも呼ばれるので、キーを見ない `LlmResolver.model_for` でモデル名だけを取る。
- 実行(`execute`)はジョブで回の id しか持たないので、回のプロジェクトの持ち主で解決する(失敗の記録の `try` の中)。

## 3. 判定(`fix_check_service.py`)

```python
# app/services/fix_check_service.py(要点)
async def run_for(self, project, user) -> list[ReviewFixCheck]:
    if not await LlmResolver(self._session).review_effective(user):
        return []
    judge = await self._judge_llm(user)          # キーが無ければ None(判定しない)
    if judge is None:
        return []
    for candidate in candidates[: settings.JUDGE_MAX_PER_RUN]:   # 1回の件数の上限は残す(待ち時間のため)
        ...
        if not judge.own_key and not await self._within_limit(user):
            ...
        check = await self._check(project, candidate, judge)     # 記録の model は judge.model
```

判定は1回の承認・生成で最大10件を順に呼ぶので、解決は `run_for` の初めに1回だけ行い、各件に渡す。

**判定のキー**: 判定の用途は既定で Claude(Haiku)。Claude のキーを自分で持つ一般ユーザーは、判定も自分のキーで呼ぶ(解決が provider の自分のキーを優先するため)。判定に Gemini を選んだ場合は、自分の Gemini キーか既定の Gemini キーで呼ぶ(Phase 67 の「既定値と同じ provider は既定のキーで選べる」の規則のまま。既定のキーの回は1日の上限で数える)。

## 4. 画面(`ReviewPanel.tsx`)

レビューのパネルを出す条件を `me.is_superuser` から `me.review_allowed` に替えた。自分の Claude キーを登録した一般ユーザーにも、オン・オフの切り替えが出る。実効値(`review_effective`)で出し分けていたほかの画面(文書のプレビュー・詳細設計の作業領域・実装手順書)は、サーバーの値の意味が広がっただけで、変えていない。

## テスト観点

| テスト | SUT | ドライバ | スタブ | 観点 |
|---|---|---|---|---|
| `test_review_routes.py`(追加分) | `read_current_user`・`update_review_settings`・`ReviewService.start_review` | pytest の関数(ルートの関数を直接呼ぶ) | 暗号の鍵は monkeypatch、キーは DB に直接登録。上限の回は `stub_llm_resolver`(`own_key` と `models` を決めて返す)と FakeRedis | superuser でなくても自分の Claude キーで `review_allowed`、設定をオンにでき実効値も真 / 上限0でも自分のキーの回は受け付け、既定のキーの回は 429 / 回の `model` は解決したモデル |
| `test_review_fix_check.py`(追加分) | `FixCheckService.run_for` | pytest の関数 | `stub_llm_resolver`(Gemini の判定を返す)・FakeRedis | 上限0のとき既定のキーなら判定しない、自分のキーなら判定する / 記録の `model` は解決したモデル / 解決は判定の用途で1回 |
| `test_review_prompt.py` | `review_effective` | pytest の関数 | スタブ不要 ── 純粋関数 | 使えて設定オンのときだけ真 |
| 既存のレビュー・判定・生成のテスト | (既存のまま) | (既存のまま) | `ANTHROPIC_API_KEY=None` のときは解決が `ReviewUnavailableError` を投げる(今までの取得関数の代わり) | キーが無いときの失敗の回と自己診断(`test_review_service.py`)・判定しない(`test_review_fix_check.py`)が今までどおり |
| `ReviewPanel.test.tsx` | `ReviewPanel` | Testing Library の render | ストアの状態を直接入れる(既存) | 使えないアカウントには何も出さない / superuser でなくても `review_allowed` なら切り替えを出す |

`user_read.py`・`users.py`・`user.py`(サービス)は `test_review_routes.py` が、`auth.py` は既存の `test_user_rename.py` が、`design_stages.py`・`doc_generator_service.py` は `test_review_fix_check.py` が import する。`schemas/user.py` は `test_review_routes.py`(`ReviewSettingsUpdate`)が import する。
