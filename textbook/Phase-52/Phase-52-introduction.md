# Phase 52 導入: レビューの土台

## 目的

ステージ8(AI設計レビュー + テスト設計)の最初の実装 Phase。[Phase 51](../Phase-51/Phase-51-introduction.md) で決めた設計レビューの土台を devex-api に入れる。

- レビューの入力(文書 + 観点の表 + 決定的な検証の指摘)と構造化出力(指摘)── [52-1](./Phase-52-1.md)
- レビューの LLM(Claude Sonnet)と設定 ── [52-2](./Phase-52-2.md)
- レビューの回と指摘の保存、ユーザーのレビューの設定 ── [52-3](./Phase-52-3.md)
- 受け付け・実行・1日の上限・失敗したときの自己診断、文書の生成の後の自動のレビュー ── [52-4](./Phase-52-4.md)
- 設定と結果の API ── [52-5](./Phase-52-5.md)

画面(レビューのパネル・段階6・7のボタン・未レビューの印)は Phase 53、差し戻し(再生成の指示・再ヒアリング)は Phase 54([51-5](../Phase-51/Phase-51-5.md))。

## パイプライン上の位置づけ・前提

```
[ヒアリング] → [文書の生成(Gemini)] ──完了── [設計レビュー(Claude Sonnet)] → 指摘を保存・チャットに出す
                                     │          (superuser かつ設定がオンのときだけ)
                                     │          失敗・キー無し・上限 → 失敗の回を残して自己診断
                                     └── オフ: 今の自己診断(生成と同じモデル)のまま
```

- **前提として読むもの**: [51-2](../Phase-51/Phase-51-2.md) の決定(特に1〜3・6・10・11 と、アカウントごとのオン・オフ)、[`docs/internal_design.md`](../../docs/internal_design.md) 3.3節「8. AI 設計レビュー + テスト設計」、[`docs/external_design.md`](../../docs/external_design.md) 2.11節、ベースライン [`appendix/stage8-baseline/`](../../appendix/stage8-baseline/README.md)(`review.py` の (d) の組み立てを本体へ移した)。
- **今の仕組み**: 自己診断は `DocGeneratorService._self_diagnose`(生成と同じ LLM・自由文・チャット)。生成は `BackgroundTasks` で動き、バックグラウンドの中でセッションを自前で開く。レート制限は Redis の `RateLimiter`。
- **この Phase を始めた時点の状態**: Phase 51 までコミット済み(外側のリポジトリには、ユーザーが外した `stage8-baseline` の測定ファイルの削除が未コミットで残っていた。この Phase では触っていない)。devex-api の `.env` には `ANTHROPIC_API_KEY` がある。dev の DB には seed の superuser がまだ無かった(この Phase で seed を流した)。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(AI が devex-api 本体へ実装し、`textbook/samples/` も同じ内容で作る)。devex-ui は変えていない。

E2E: この Phase では流さない。レビューはオフが既定で、オフの流れ(自己診断)は1行も変えていないため。ステージ8の E2E は Phase 59 で既存を含めて全部流す。E2E の偽 LLM にはレビューの応答を足した([52-2](./Phase-52-2.md))。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 52 開始時」を参照。すべて推奨どおり。

1. **自動実装モード**: on。
2. **1日の上限**: superuser ごとに20回/日(設定 `REVIEW_RATE_LIMIT_PER_DAY` で替えられる。数えるのはレビューのモデルを実際に呼ぶ回)。
3. **自動のレビューの流し方**: 同じバックグラウンドのタスクで、生成を「完了」にした後に流す(生成の完了を待たせない)。
4. **保存の形と設定の置き場**: `users.review_enabled` の列と、回・指摘の2表。版は外部キーでなく `{doc_type: version}` で持つ。
5. **結果の見せ方**: この Phase ではチャットに指摘の一覧(md)も出す(Phase 53 でパネルができたら一行の知らせに縮める)。
6. **プロンプトキャッシュ**: 使わず、トークン(キャッシュの読み書きを含む)を記録するだけ。
7. **D-NAT-1**: レビューの指示だけ直す(ヒアリングの判定の見直しは Phase 54 へ)。

Claude の判断(計画の承認で確定、または作業中):

- `get_judge_llm()` は消費者の居る Phase 54 で作る([52-2](./Phase-52-2.md))。
- レビューのタイムアウトは生成の30秒と分けて180秒、SDK の再試行は切る([52-2](./Phase-52-2.md))。
- `DOC_TYPES_BY_MODE` を `app/repositories/generated_document.py` へ移した(循環 import を避ける共有。[52-4](./Phase-52-4.md))。
- 実 LLM の1回目で観点のキーが落ちた回があったので、`point_key` を JSON Schema の必須(null 可)にし、知らないキーは null に直した([52-1](./Phase-52-1.md))。
- 失敗のときの rollback は DB の失敗に限った([52-4](./Phase-52-4.md))。
- 「もう一度レビュー」の API はこの Phase で作った(決定10 の「後で流し直せる仕組み」。ボタンは Phase 53)。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-52-1.md`](./Phase-52-1.md) | レビューの入力と出力(`app/review/`。純粋関数) | あり | なし |
| [`Phase-52-2.md`](./Phase-52-2.md) | レビューの LLM と設定・失敗の分類・偽 LLM | あり | 52-1 |
| [`Phase-52-3.md`](./Phase-52-3.md) | レビューの回と指摘の保存・ユーザーの設定の列 | あり | 52-1 |
| [`Phase-52-4.md`](./Phase-52-4.md) | `ReviewService` と、生成の後の自動のレビュー | あり | 52-1〜52-3 |
| [`Phase-52-5.md`](./Phase-52-5.md) | 設定と結果の API | あり | 52-1〜52-4 |

## サンプルコード一覧

`textbook/samples/backend/` 配下(各章の「この章で作成・更新したファイル」の表を参照)。

- 新規: `app/review/`(6ファイル)・`app/ai/llm/claude.py`・`app/models/review.py`・`alembic/versions/f6a7b8c9d0e1_add_design_reviews.py`・`app/repositories/review.py`・`app/services/review_service.py`・`app/schemas/review.py`・`app/api/routes/reviews.py`・`tests/fixtures/review.py`・`tests/unit/test_review_{prompt,llm,repository,service,routes}.py`
- 初めて samples に載せたテンプレート由来のファイル(全文に「更新」のタグ): `app/models/user.py`・`app/services/user.py`・`app/schemas/user.py`・`app/api/routes/users.py`
- 更新: `pyproject.toml`・`app/core/config.py`・`app/services/errors.py`・`app/uml/generation/failures.py`・`app/services/llm_retry.py`・`app/ai/llm/fake.py`・`tests/fixtures/fake_llm.py`・`app/models/project.py`・`app/models/__init__.py`・`app/repositories/generated_document.py`・`app/services/doc_generator_service.py`・`app/api/routes/__init__.py`

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| [52-1](./Phase-52-1.md) | `app/review/schemas.py`・`prompt.py`・`render.py`・`policy.py`・`known_issues.py` | 指摘のスキーマ・入力の組み立て・チャットの md・実効値・既知の指摘 | 実効値の真理値表・観点の表の列・既知の指摘・重要度の順・知らない観点のキー(`test_review_prompt.py`) |
| [52-2](./Phase-52-2.md) | `app/ai/llm/claude.py`・`llm_retry.py`・`config.py`・`errors.py`・`fake.py` | Claude の取得・方式とトークン数・429 と打ち切りの分類・偽の応答 | E2E の偽物・キー無し・設定値・方式の受け渡し・分類(`test_review_llm.py`) |
| [52-3](./Phase-52-3.md) | `app/models/review.py`・`user.py`・マイグレーション・`app/repositories/review.py` | 回と指摘を版に結んで保存・設定の列 | 初期値オフ・順序とトークン・最新と実行中・連鎖削除(`test_review_repository.py`) |
| [52-4](./Phase-52-4.md) | `app/services/review_service.py`・`doc_generator_service.py` | 受け付け・実行・失敗の記録・生成の後の自動のレビュー | 403/409/429/502・実行の成功と失敗・オフは今のまま・オンは完了の後・失敗は自己診断(`test_review_service.py`) |
| [52-5](./Phase-52-5.md) | `app/api/routes/users.py`・`reviews.py`・`app/schemas/user.py`・`review.py` | 設定の切り替え・最新の回・もう一度レビュー | 実効値・superuser 以外は403・null・受け付けと実行の積み・`is_current`(`test_review_routes.py`) |

## 写経順序(#23)

章番号順。各章の「この章で作成・更新したファイル」の表の順に写す。

実 import 監査(#15。全 import 文を読んで確かめた):

- 52-1: `app/review/schemas.py` は `app.hearing.is_point_key`、`prompt.py` は `app.detailed_design.procedure_doc`・`app.documents.issues`・`app.hearing`・同じ章の `schemas`、`known_issues.py` は `app.documents.*` の model と `validate_*` を読む(すべて以前の Phase)。`tests/fixtures/review.py` は `app.review`(同じ章)。
- 52-2: `app/ai/llm/claude.py` は `app.ai.llm.fake`・`app.core.config`・`app.services.errors.ReviewUnavailableError`(同じ章)・`langchain_anthropic`(同じ章で依存に足した)。`fake.py` は `app.review.schemas`(52-1)。`llm_retry.py` は `anthropic`(`langchain-anthropic` の依存)を関数の中で読む。
- 52-3: `app/repositories/review.py` は `app.models.review`(同じ章)・`app.review`(52-1)。`app/models/project.py` は `ReviewRun` を `TYPE_CHECKING` の中で読む。
- 52-4: `review_service.py` は `app.ai.llm.claude`(52-2)・`app.repositories.review`(52-3)・`app.review`(52-1)・`app.services.errors` のレビューの例外(52-2)・`DOC_TYPES_BY_MODE`(同じ章で移した)・`invoke_structured_with_usage`(52-2)。`doc_generator_service.py` は `review_service`(同じ章)・`app.review.review_effective`(52-1)・`app.models.user.User`(52-3 で列を足した)。
- 52-5: `app/schemas/user.py` は `app.review.review_effective`(52-1)、`app/services/user.py` は `ReviewNotAllowedError`(52-2)、`app/api/routes/reviews.py` は `app.schemas.review`・`ReviewService`(52-4)。`tests/unit/test_review_routes.py` は `ReviewSettingsUpdate`(同じ章)。
- 前方 import は無い。章が作成・更新するファイルは、その章のテストが少なくとも1度 import する(`config.py` は `test_review_llm.py`、`models/__init__.py` は各テストの DB の作成、`routes/__init__.py` は `test_review_routes.py` の `reviews` の import を通る ── `app.api.routes` パッケージの `__init__` が先に読まれる)。

## 検証結果

- 章ごとの部分テスト: 52-1 11件・52-2 7件・52-3 4件・52-4 12件・52-5 5件、すべて成功。
- Phase 完了時の全体テスト(#18): devex-api 1105 件成功(8件は既定で除外の統合テスト。Phase 51 の 1066 件 + この Phase の 39 件)。devex-ui は変えていないので流していない。
- `ruff check` 成功(`ruff format` は使わない)。新しいファイルと変えたファイルに pyright: エラー 0。
- マイグレーション: dev の DB で `upgrade head` → `downgrade -1` → `upgrade head`、`alembic check` は差分なし。
- 実 LLM(Claude Sonnet 5.5、51-1 の題材 D = 詳細設計モードの要件・外部、本体の入力の組み立て・スキーマ・`get_review_llm` で流した。スクリプトは使い捨て):
  - 1回目の3回: 指摘 11・11・10件、1回 33〜37秒、入力 約 10.5k・出力 4.3〜4.9k トークン。**D-NAT-1 は3回ともヒアリングが原因の指摘として当たった**(51-1 では API の側の穴としてしか言わず △)。ただし1回は、ヒアリングの指摘4件すべてで観点のキーが null だった。
  - `point_key` を必須(null 可)にした後の2回: 指摘 9・12件、ヒアリングの指摘はすべて観点のキー(`security`・`abuse`)付き。
  - 費用は5回で 約 $0.33(1回 約 $0.066)。
- dev のサーバー: seed を流して superuser を作り、`PUT /users/me/review-settings` でオン → オフ、一般ユーザーは403を確かめた。生成からの通しの確認(実 Gemini + 実 Claude)は、画面ができる Phase 53 でまとめて行う(下の申し送り)。
- `samples_check.py`(`--api-since HEAD --ui-since HEAD`): 不一致 0 件・作り忘れ 0 件(一致 595 / 並び順のみ差 8 / 例外 5)。「samples のみ」2件は Phase 51 から続く `change-impact-demo` のルート。`link_check.py`: 切れ 0 件。

## 未消化の申し送り(#37)

Phase 51 から引き継いだもの:

- **Phase 53〜59 の未確定事項**: [51-5](../Phase-51/Phase-51-5.md)「未確定事項」(Phase 52 の分はこの Phase で決めた)。
- **「AI に提案を求める」・判定がログインの方法だけでセキュリティを埋めた・初期入力だけで MVP の範囲が対象外になった**: Phase 54 の差し戻しと再ヒアリングで拾い、Phase 58 で確かめる。D-NAT-1 は、この Phase のレビューの指示で、ヒアリングが原因の指摘として当たるようになった(上の検証結果)。
- **Judge(狭い判定のモデル)の使い道**: Phase 54 で「直ったか」のシャドーモード。`get_judge_llm()` もそこで作る。
- **テスト仕様書の中身の正しさ**・**実装手順書に固有の欠陥**: Phase 55・56・58。
- **生成のモデルと Gemini の無料枠**(51-1 の (f)): ステージ8の範囲の外。
- **devex-ui の「開発用」メニュー**: ステージ8の完了時に、ユーザーが外すかを決める。
- 持ち越し: **DFD のデータストアの書き漏れ**(49-2 から)・**補いの文字の当たり**(Phase 48 から)・**画面の文の変更は、その画面のすべての処理へ届く**(49-4 から)・**改名の後に下流の参照を直して承認すると広がる**(Phase 43 から)。
- 持ち越し(触るときに直す): **`test_chat_service.py` の pyright の指摘4件**(Phase 40 から)・**並列のテストのタイムアウト**(Phase 44 から)・**偽 LLM の外部設計書の GET に DF が無い**(Phase 45 から)。

この Phase で生まれたもの:

- **チャットの指摘の md を縮める**: Phase 53 でパネルができたら、チャットは「レビューしました(指摘 N 件)」の一行にする(着手時の決定5)。
- **ヒアリングの判定の見直し**(公開サービスでセキュリティが浅いまま採用されたとき、アクセス制御を聞き直す): Phase 54(着手時の決定7)。
- **プロンプトキャッシュ**: 回にキャッシュのトークンを記録している。段階6・7 の区切りを作る Phase 53 か、測定の Phase 58 で入れるかを決める。
- **生成からの通しの確認(実 Gemini + 実 Claude)と画面確認**: Phase 53 の直後(パネルの操作感と一緒に)。dev の superuser は seed 済み。
- **本番の手順**: `ANTHROPIC_API_KEY` の設定と superuser の昇格、`langchain-anthropic` の追加でイメージの作り直しが要る(Phase 59 の `OPERATIONS.md`)。
- **依存の更新**: `langchain-anthropic` の追加で `langchain-core` が 1.5.4 → 1.6.10 に上がった。全体テストは通っている。
- **レビューの入力の大きさ**: 題材 D の入力は 約 10.5k トークン(51-1 の見積もりの 3.9k より大きい。観点の表のキーの列・指示の追加と、数え方の違い)。費用は 1回 約 $0.066 で、1日20回の上限なら 約 $1.3 / 日。
- **セッションの区切りの記録**: Phase 52 は1セッションで行った(計画モードで調査 → 着手時の質問2回 → 計画の承認 → 52-1〜52-5 の実装とテスト → 全体テスト → 実 LLM の確認(1回目で観点のキーの落ちを見つけて直し、2回目)→ dev の API の確認 → samples → 教材)。

この Phase で解決したもの: なし(D-NAT-1 は指示で当たるようになったが、聞き直しまでの解決は Phase 54・58)。

## Phase 完了チェック(#22)

設問は Phase の要点の要約(回答は求めない)。

1. 自動のレビューを生成の「完了」の後に流すのはなぜか。オフの流れを1行も変えなかったことと、E2E を流さなかったことの関係を説明できるか。
2. レビューの回を文書の行に外部キーで結ばず、版の番号で持つのはなぜか。`is_current` はどう決まるか。
3. 受け付けの検査の順(実効値 → 生成中 → 実行中 → 文書 → キー → 上限)で、上限をキーの後に置いたのはなぜか。
4. レビューが失敗したとき、生成を失敗にせず自己診断に切り替える経路を、受け付けで止まったときと実行で失敗したときに分けて説明できるか。
5. `point_key` を JSON Schema の必須(null 可)にしたのはなぜか。実 LLM の確認で何が起き、何で確かめたか。

## 次のフェーズ

**Phase 53**: レビューの画面(プレビュー・作業領域の「レビュー」パネル・採用 / 却下 / 保留・段階6・7 の「レビューする」ボタンと区切り・未レビューの印・superuser の設定の切り替え)。着手時に [51-5](../Phase-51/Phase-51-5.md) の Phase 53 の未確定事項と、チャットの md を縮めるか・プロンプトキャッシュを決める。
