# Phase-52-4: レビューのサービスと、生成の後の自動のレビュー

## この章の目的

レビューの受け付け(使えるか・実行中でないか・1日の上限)と実行(LLM を呼んで指摘を保存)を `ReviewService` にまとめ、文書の生成(`DocGeneratorService.generate`)の終わりに組み込む。オフのアカウントは今の自己診断のまま、オンのアカウントは生成を「完了」にした後でレビューを流し、失敗したら自己診断に切り替える([51-2](../Phase-51/Phase-51-2.md) 決定2・3・10・11)。

自動実装モード: on([introduction](./Phase-52-introduction.md) 参照)。

## この章で作成・更新したファイル

パスは `devex-api/backend/` から(#30 の依存順)。

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/repositories/generated_document.py`](../samples/backend/app/repositories/generated_document.py) | 更新 | `DOC_TYPES_BY_MODE` をここへ移す(生成とレビューの両方が使う) |
| [`app/services/review_service.py`](../samples/backend/app/services/review_service.py) | 新規 | `ReviewService`(受け付け・失敗の回・実行・最新の回・止まった回の回収) |
| [`app/services/doc_generator_service.py`](../samples/backend/app/services/doc_generator_service.py) | 更新 | 生成の後のレビュー(`_review_after_generation`)と、失敗したときの自己診断(`_fallback_self_diagnose`) |
| ── ここからテスト ── | | |
| [`tests/unit/test_review_service.py`](../samples/backend/tests/unit/test_review_service.py) | 新規 | 受け付け・実行・生成の後の自動のレビューのテスト |

## 要点の抜粋

### 1. 受け付けと実行を分ける

```python
# app/services/review_service.py
class ReviewService:
    def __init__(self, session, *, redis=None, llm=None) -> None
    async def start_documents_review(self, project, user, *, trigger) -> ReviewRun
    async def record_failed_start(self, project, *, trigger, exc) -> ReviewRun
    async def execute(self, run_id) -> ReviewRun | None
    async def latest_documents_review(self, project) -> ReviewRun | None
    async def document_targets(self, project) -> dict[str, int] | None
    async def recover_stale(self, project_id, *, now=None) -> bool
```

受け付けの順: 実効値(403)→ 生成中(手動だけ409)→ 止まった回の回収 → 実行中(409)→ 文書がそろっているか(409)→ キー(502)→ 1日の上限(429)→ 実行中の回を作って commit。上限はモデルを実際に呼ぶ回だけ数えるため、キーの確認より後に置く。

実行は回の `targets` の版の文書を読み、観点の表と既知の指摘を添えて `invoke_structured_with_usage(llm, ReviewOutput, messages, method="json_schema")` を呼ぶ。成功は指摘とトークン数を保存してチャットに md を出し、失敗は回に `error_code` を残してチャットに「失敗しました」を出す。どちらも例外にしない。

### 2. 生成への組み込み

```python
# app/services/doc_generator_service.py(generate の要所)
user = await self._session.get(User, user_id)
reviewing = user is not None and review_effective(...)
...
if not reviewing:                       # オフ: 今の自己診断(今の位置のまま)
    diagnosis = await self._self_diagnose(generated, llm=llm)
...
project.status = "completed"
await self._session.commit()
if reviewing and user is not None:      # オン: 完了にした後で流す
    await self._review_after_generation(project, user, generated, llm, review_llm)
```

- オフの流れは1行も変えていない(既存のテスト・E2E を壊さない)。
- オンでは生成の完了をレビューの 25〜40 秒で待たせない(着手時の決定「同じタスクで、生成の完了の後に」)。
- 受け付けで止まった(キー無し・上限・実行中)ときは失敗の回を残し、理由をチャットに出してから自己診断に切り替える。実行で失敗したときも自己診断に切り替える。自己診断まで失敗したら、ログだけ残す(文書は完了のまま)。
- バックグラウンドの入口 `generate_documents` は Redis のクライアントを開いて渡し、終わりに閉じる。

### 3. `DOC_TYPES_BY_MODE` の移動

レビューの区切りの文書(簡易は4文書、詳細は要件・外部)を決めるのに、生成と同じ表が要る。`review_service` が `doc_generator_service` を読むと、`doc_generator_service` が `review_service` を読むのと循環するので、表を `app/repositories/generated_document.py`(`DOC_TYPES` の隣)へ移した(#17 の共有。今の消費者は `ReviewService.document_targets`)。`doc_generator_service` からも今までどおり import できる。

## 設計判断

### rollback は DB の失敗のときだけ

LLM の失敗では書きかけが無い。`rollback` すると、呼び出し側が持っているプロジェクトなどのオブジェクトまで失効し、非同期では読み直さないと触れなくなる(テストで `MissingGreenlet` になった)。`execute` は `SQLAlchemyError` のときだけ、生成の後の受け付けはアプリの例外でないときだけ戻す。

### Redis を渡さない呼び出しでは数えない

単体テストと、Redis を使わない呼び出しのため。本番の経路(生成のバックグラウンド・「もう一度レビュー」の API)は必ず渡す。

### 止まった実行中の回は15分で失敗に戻す

生成と同じしきい値(`app/services/generation_staleness.py`)。プロセスの再起動などで「実行中」が残ると、以後のレビューが409で塞がるため。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `ReviewService.start_documents_review` | pytest(`test_review_service.py`、`db_session`) | `FakeLLM`(レビュー)・`FakeRedis`(1日の回数)。文書は偽の LLM で実際に生成しておく | 使えない(superuser でない・オフ)・文書が無い・生成中・キーが無い・詳細は要件と外部だけ・実行中は409・上限・止まった回の回収 |
| `ReviewService.execute` | 同上 | 同上 | 指摘を重要度の順に保存・方式 `json_schema`・入力に文書と観点の表・チャットに md / 失敗は回に記録してチャットに出す |
| `DocGeneratorService.generate`(生成の後) | 同上 | `FakeLLM` を2つ(生成の Gemini とレビューの Claude) | オフは自己診断だけでレビューを呼ばない・オンは完了の後にレビューの md・レビューの失敗とキー無しは自己診断に切り替わり、文書は完了のまま |

```sh
cd devex-api/backend && uv run pytest tests/unit/test_review_service.py
```
