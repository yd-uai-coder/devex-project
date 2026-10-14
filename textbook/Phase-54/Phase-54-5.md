# Phase-54-5: 「直ったか」の判定(Haiku・シャドーモード)

## この章の目的

54-1 で「変更あり」になった採用した指摘だけを、狭い判定のモデル(Claude Haiku)に渡して、直ったかを記録する。記録して superuser のパネルに小さく出すだけのシャドーモードで、採否や追跡の状態は変えない(精度を Phase 58 で測ってから使い方を決める)。文書の生成の後と段階の承認の後に、レビューがオンのアカウントだけで流す。

自動実装モード: on([introduction](./Phase-54-introduction.md) 参照)。

## この章で作成・更新したファイル

パスは `devex-api/backend/`・`devex-ui/` から(#30 の依存順)。

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/core/config.py`](../samples/backend/app/core/config.py) | 更新 | `JUDGE_MODEL`(既定 `claude-haiku-5-5`)・タイムアウト・最大トークン・1回の数・1日の上限 |
| [`app/ai/llm/claude.py`](../samples/backend/app/ai/llm/claude.py) | 更新 | `get_judge_llm()` |
| [`app/review/sendback.py`](../samples/backend/app/review/sendback.py) | 更新 | `SendbackFinding.evidence` |
| [`app/review/fix_check.py`](../samples/backend/app/review/fix_check.py) | 新規 | `FixCheckOut`・`VERDICT_LABEL`・`target_rows_text`・`changed_rows_text`・`build_fix_check_messages` |
| [`app/review/__init__.py`](../samples/backend/app/review/__init__.py) | 更新 | 上の re-export |
| [`app/ai/llm/fake.py`](../samples/backend/app/ai/llm/fake.py) | 更新 | E2E の偽物に判定の応答 |
| [`app/models/review.py`](../samples/backend/app/models/review.py)・[`app/models/__init__.py`](../samples/backend/app/models/__init__.py) | 更新 | `ReviewFixCheck`(`review_fix_checks`) |
| [`alembic/versions/7c3e9ab5f4d6_add_review_fix_checks.py`](../samples/backend/alembic/versions/7c3e9ab5f4d6_add_review_fix_checks.py) | 新規 | 上の表 |
| [`app/repositories/review.py`](../samples/backend/app/repositories/review.py) | 更新 | `ReviewFixCheckRepository`(`add`・`latest_for`) |
| [`app/services/review_service.py`](../samples/backend/app/services/review_service.py) | 更新 | `current_fix_checks`(今の版についての判定)・区切りの `fix_checks` |
| [`app/services/fix_check_service.py`](../samples/backend/app/services/fix_check_service.py) | 新規 | `FixCheckService.run_for`・`run_fix_checks`(バックグラウンド) |
| [`app/services/doc_generator_service.py`](../samples/backend/app/services/doc_generator_service.py) | 更新 | 生成の後のレビューの後に判定する |
| [`app/schemas/review.py`](../samples/backend/app/schemas/review.py) | 更新 | `FixCheckRead`・`ReviewFindingRead.fix_check` |
| [`app/api/routes/reviews.py`](../samples/backend/app/api/routes/reviews.py) | 更新 | 指摘に判定を付ける |
| [`app/api/routes/design_stages.py`](../samples/backend/app/api/routes/design_stages.py) | 更新 | 承認の後に判定を予約する |
| [`src/features/design-review/api/reviewApi.ts`](../samples/frontend/src/features/design-review/api/reviewApi.ts) | 更新 | `FixCheckRead`・`fix_check` |
| [`src/features/design-review/model.ts`](../samples/frontend/src/features/design-review/model.ts) | 更新 | `VERDICT_LABEL`・`fixCheckText` |
| [`src/features/design-review/components/FindingTable.tsx`](../samples/frontend/src/features/design-review/components/FindingTable.tsx)・[`ReviewFindingBadge.tsx`](../samples/frontend/src/features/design-review/components/ReviewFindingBadge.tsx) | 更新 | 「AI: 直った / 一部 / いいえ / 自信なし」(理由は title) |
| ── ここからテスト ── | | |
| [`src/features/design-review/test-utils/reviewFixtures.ts`](../samples/frontend/src/features/design-review/test-utils/reviewFixtures.ts) | 更新 | `fix_check` の既定値 |
| [`tests/unit/test_review_fix_check.py`](../samples/backend/tests/unit/test_review_fix_check.py) | 新規 | 入力・モデル・判定の流れ・生成と承認からの起動・偽物 |
| [`tests/unit/test_design_stage_service.py`](../samples/backend/tests/unit/test_design_stage_service.py) | 更新 | 承認のルートの引数 |
| `model.test.ts`・`ReviewPanel.test.tsx` | 更新 | 文と表示 |

## 要点の抜粋

### 1. 何を渡すか

```python
# app/review/fix_check.py(人のメッセージ)
## 指摘
対象: … / 問題: … / 改善案: …
## レビューしたときの内容      ← 対象の行(結べなければレビューの引用)
## 今の内容                   ← 対象の行 + レビューの後に足した・変えた行(消えた行は名前だけ)
                                 (結べなければ今の関連文書の本文。2万字で切る)
```

**実 Haiku の確認で直したこと**: 初めは「今の内容」を対象の行だけにしていた。外部設計以降を指示つきで作り直した後、2件とも「いいえ」と判定された(理由「アカウント作成の API は追加されていない」)が、実際には `POST /api/v1/users`・`GET /api/v1/menus` が足されていた。直し方が「行を足す」とき、足した行は対象の行ではないので見えない。足した・変えた行も渡すように直し(`changed_rows_text`)、判定し直すと2件とも「直った」で、理由も足した行を挙げた。

### 2. いつ流すか・何回か

- 文書の生成の後(自動のレビューの後)と、段階の承認の後(`BackgroundTasks`)。レビューがオンのアカウントだけ。キーが無ければ何もしない。
- 対象は「変更あり」の採用した指摘(前の回の分も)で、**今の版でまだ判定していないもの**(判定の `targets` = 指摘の関連文書・段階の今の版。同じ版なら判定し直さない)。1回に `JUDGE_MAX_PER_RUN`(10)件、superuser ごとに1日 `JUDGE_RATE_LIMIT_PER_DAY`(200)回。
- 失敗は `verdict=null`・`error_code` で記録し、生成・承認は止めない。
- 画面に返すのは今の版についての最新の判定だけ(版が変わった後の古い判定は出さない)。

### 3. 判定のモデル

`get_judge_llm()`(`ChatAnthropic`、`JUDGE_MODEL`、`max_retries=0`、60秒)。Claude Haiku 5.5 は 1M トークンあたり入力 $0.10・出力 $0.50 で、1件の判定は 2.7〜5.2k トークン・約 $0.0005。構造化出力は `json_schema`(レビューと同じ)。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `build_fix_check_messages`・`target_rows_text`・`changed_rows_text` | pytest(`test_review_fix_check.py`) | スタブ不要 ── 対象が純粋で外部依存を呼ばないため | 節の形・2万字で切る・足した / 消えた行 |
| `get_judge_llm`・E2E の偽物 | 同上 | 無し(実クライアントはネットワークを呼ばないコンストラクタ) | 設定のモデル・再試行 0・偽物は「直った」 |
| `FixCheckService.run_for`・`ReviewFixCheckRepository`・`gate_summaries` | 同上 | `FakeLLM`(生成・判定。プロンプトを記録) | 未対応は判定しない・版ごとに1回・結べないときは引用と本文・オフ / キー無しは何もしない・失敗の記録・今の版の判定を返す |
| `DocGeneratorService.generate`・`approve_design_stage` | 同上 | `FakeLLM`(生成・レビュー・判定)・`BackgroundTasks` | 生成の後に判定・承認でオンなら予約 |
| 表示 | vitest | ストアの操作(`vi.fn`) | 「AI: 直った」と title・失敗の文 |

```sh
cd devex-api/backend && uv run pytest tests/unit/test_review_fix_check.py tests/unit/test_design_stage_service.py
cd devex-ui && npx vitest run src/features/design-review
```
