# Phase 3 導入: フロントエンド開発(devex-ui)

## 目的

[`docs/implementation_plan.md`](../../docs/implementation_plan.md) 4.2節 WBS区分3(フロントエンド開発タスク)を実装する: 認証画面・ダッシュボード、チャットヒアリングUI、ドキュメントプレビューUIの6章構成で、Stage1 MVPのフロントエンド一式(`devex-ui`)を完成させ、Phase 2で完成した`/api/v1/projects/...`系APIを実際にブラウザから消費できるようにする。Phase 2(バックエンド)の上に構築し、Phase 4(統合テスト・QA)がこの画面一式を対象にする。

直前のセッションで、[`Phase-2-2.md`](../Phase-2/Phase-2-2.md)を「JWTリフレッシュトークンのhttpOnly Secure Cookie化」を含む内容にやり直した([`decision-digest.md`](../decision-digest.md)「Phase 3着手前」節参照)。本Phaseはこのやり直し後のバックエンドを前提にしている ── フロントエンドが対応すべきCookie化は既にバックエンド側で完了しているため、3-1は`auth-store.ts`(フロントエンド側)の刷新のみを扱う。

## 前提

- [`Phase-1/`](../Phase-1/Phase-1-introduction.md)・[`Phase-2/`](../Phase-2/Phase-2-introduction.md)の写経・動作確認が完了していること(Docker Compose環境、`.env`、バックエンドAPI一式)。とくに[`Phase-2-2.md`](../Phase-2/Phase-2-2.md)のCookie化改訂分(`app/api/deps.py`・`app/schemas/auth.py`・`app/api/routes/auth.py`・`tests/integration/test_auth_flow.py`)の写経が完了していること。
- `docs/external_design.md` 2.2節(画面一覧)・2.3節(SCR-001/SCR-002/SCR-004/SCR-005)・2.5節(データ入出力仕様)、`docs/internal_design.md` 3.1節(JWT仕様)・3.3節(API一覧)を一読していること。
- `devex-ui/CLAUDE.md`(Tamaguiの注意点、Zustandのコロケーション方針、`src/features/<name>/`の推奨配置、TTLキャッシュ+invalidate-on-writeパターン)・`devex-ui/AGENTS.md`(Next.js 16の破壊的変更注意、`node_modules/next/dist/docs/`の確認要請)を把握していること。
- 本Phase開始時点の`devex-ui`は認証・ダッシュボード・チャット・ドキュメント画面が一切無いデモギャラリー状態であること(`src/app/(pages)/(sample)/`配下のみ)。

## 本Phase共通の設計方針

以下は各章で個別に説明を繰り返さない、Phase 3全体で共有する既定方針(#20により実装前チェックリストのブロッカーにはしない。異論があれば各章着手前に申し出ること)。

- **TS/TSXサンプルのヘッダー・変更タグ**: `textbook/samples/backend/`(Python, `#`コメント)と同じ形式を`//`コメントで踏襲する(`// 作成：Phase-3-n`、`// 更新：Phase-M-m,...`)。3-1がこのプロジェクト最初のTSサンプルファイル。
- **`POST /generate`完了のポーリング**: 既存の`useInterval`フックで`GET /projects/{id}`を5秒間隔、3分でタイムアウトメッセージを表示する(3-5で使用)。
- **SSE切断時のUI方針**: `role="alert"`バナーで警告表示し、自動再送はしない(冪等性キーが無く二重送信リスクがあるため)。再接続時は`GET .../chat`で履歴を再取得して整合させる(3-5)。
- **レイアウト**: 既存の`AppShell`(デモギャラリーのヘッダー/メニュー/フッター)をそのまま流用し、Devex画面専用の`layout.tsx`は追加しない。
- **Markdownレンダリング**: `react-markdown` + `remark-gfm`を採用する(生成AI文書のGFMテーブル対応、かつ`rehype-raw`を使わない限りHTMLを素通ししない安全性のため)。3-5着手前にNext 16.2.12/React 19.2.4に対するpeer-deps互換性を確認する。
- **fetchモック**: MSWは導入せず、3-1で作る`fetch-stub.ts`(単純なfetchスタブ)+ SSE用の疑似`ReadableStream`で対応する(既存のReact Query不採用方針と整合)。
- **テストファイルの配置**: `*.test.ts(x)`はソースの隣に直接colocateせず、テスト対象と同じディレクトリ直下の`__tests__/`サブフォルダに置く(Jest由来でJS界隈での認知度が高い規約)。Phase 3完了後の相談で、devex-ui全体(既存デモギャラリを含む)をこの構成へ移行した。相対importはテスト対象より1階層深くなる分だけ深さが1つ増える(`./Foo`→`../Foo`、`../../tamagui.config`→`../../../tamagui.config`)。本Phaseの各章の表・サンプルパスはすべてこの構成を反映済み。`devex-ui/CLAUDE.md`のTesting節も更新済み。

## 章一覧

| 章 | トピック | モード | 依存 |
|---|---|---|---|
| [`Phase-3-1.md`](./Phase-3-1.md) | `auth-store.ts`書き換え(Cookie方式対応)+起動時サイレントリフレッシュ | 納期 | Phase 2-2(バックエンドCookie化) |
| [`Phase-3-2.md`](./Phase-3-2.md) | ログイン/登録画面(SCR-001) | 納期 | 3-1 |
| [`Phase-3-3.md`](./Phase-3-3.md) | ダッシュボード画面(SCR-002) | 納期 | 3-1, 3-2 |
| [`Phase-3-4.md`](./Phase-3-4.md) | 初期ヒアリング入力フォーム(SCR-004前段) | 納期 | 3-1, 3-3 |
| [`Phase-3-5.md`](./Phase-3-5.md) | チャット+SSEストリーミング+完了承認+自己診断表示(SCR-004後段) | **学習**(MVPコア) | 3-1, 3-4 |
| [`Phase-3-6.md`](./Phase-3-6.md) | ドキュメントプレビューUI(SCR-005) | 納期 | 3-1, 3-5 |

学習モード(3-5)はCLAUDE.md #21により、MVPコアループ(チャット↔4文書生成)に関わる章として常に学習モード固定。3-4はコアループの「入口」ではあるがループ本体(対話往復)ではなく、内容もフォームバリデーション+アップロードのクライアント側ミラーリングが主体のため納期モードとした(境界線上の判断であることをここに明記する)。

## サンプルコード一覧

[`textbook/samples/frontend/`](../samples/frontend/)(構成は`devex-ui/`を鏡写し)に、本Phaseで作成・更新した全ファイルを置く。各章の「この章で作成・更新したファイル」表を参照。主な新規ファイル:

- `src/components/auth/{auth-store,AuthBootstrap}.ts(x)`(書き換え・新規)
- `src/lib/api/test-utils/fetch-stub.ts`
- `src/features/auth/{schemas,components/LoginForm,components/RegisterForm}.ts(x)`
- `src/features/dashboard/{dashboard-store,api/projects,components/ProjectList,components/ProjectListItem}.ts(x)`
- `src/components/ui/form/{FieldsetGroup,CollapsibleSection}.tsx`
- `src/features/hearing/{schemas,api/createProject,api/streamChat,api/hearingApi,hearing-store,components/FileUploadField,components/IntakeForm,components/MessageBubble,components/HearingCompletionBanner,components/ChatPanel,components/ChatPageContent}.ts(x)`
- `src/hooks/useGenerationPolling.ts`(3-5の`ChatPageContent.tsx`から3-6で切り出した共通フック)
- `src/features/documents/{documents-store,api/documentsApi,components/DocumentMarkdownView,components/DocumentTabs,components/DocumentsPageContent}.ts(x)`
- `src/app/{login,register,dashboard,projects/new,projects/[id]/chat,projects/[id]/documents}/page.tsx`
- `vitest.setup.ts`(3-6で`ResizeObserver`ポリフィルを追記)

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | ファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| 3-1 | `components/auth/{auth-store,AuthBootstrap}`、`lib/api/test-utils/fetch-stub` | Cookie方式対応の認証状態管理+起動時サイレントリフレッシュ | `vitest run src/components/auth` |
| 3-2 | `features/auth/{schemas,components/LoginForm,components/RegisterForm}`、`app/{login,register}/page` | ログイン/登録フォーム(既存フィールドコンポーネント+zod) | `vitest run src/features/auth` |
| 3-3 | `features/dashboard/*`、`app/dashboard/page` | プロジェクト一覧+新規プロジェクト導線 | `vitest run src/features/dashboard` |
| 3-4 | `components/ui/form/{FieldsetGroup,CollapsibleSection}`、`features/hearing/{schemas,api/createProject,components/FileUploadField,components/IntakeForm}`、`app/projects/new/page` | 初期ヒアリング入力(intake+添付ファイル)フォーム | `vitest run src/features/hearing/components/__tests__/{FileUploadField,IntakeForm}.test.tsx` |
| 3-5 | `features/hearing/{api/streamChat,api/hearingApi,hearing-store,components/MessageBubble,components/HearingCompletionBanner,components/ChatPanel}`、`app/projects/[id]/chat/page` | SSEチャット+完了承認+自己診断表示+生成トリガー | `vitest run src/features/hearing`(各`__tests__/`配下) |
| 3-6 | `features/documents/*`、`app/projects/[id]/documents/page` | 4文書タブ切替プレビュー+コピー/DL/再生成 | `vitest run src/features/documents` |

## Phase完了チェック(#22)

1. `auth-store.ts`が`refreshToken`をstateから完全に排除した理由と、それでもなお`bootstrap()`がページロード時に必要な理由を説明できるか。
2. `POST /api/v1/projects/{id}/chat`のSSEストリーミングになぜ`EventSource`ではなく`fetch`+`ReadableStream`を使うのか説明できるか。
3. `streamChat()`が`apiFetch`の401リトライロジックを流用せず独自に実装している理由(あるいは共通化した場合はその設計)を説明できるか。
4. `POST /generate`が202を返した後、フロントエンドがどうやって生成完了を検知するか、その設計の限界(プッシュ通知が無いこと)を踏まえて説明できるか。
5. SSE切断時に自動再送をしない設計判断の理由を、バックエンドのエラーハンドリング設計([`Phase-2-5.md`](../Phase-2/Phase-2-5.md)の残課題)と結びつけて説明できるか。
6. `useGenerationPolling`を3-6で共通フックへ切り出した判断を、CLAUDE.md #17の判定基準(「今この共通化を駆動している実在の消費者は何か」)に沿って説明できるか。
7. 「クリップボードにコピー」がダウンロード専用のAPI(`GET .../download`)を呼ばずに完結する理由を、`GET /documents`のレスポンス形状と結びつけて説明できるか。

## 写経順序(#23)

章番号順(3-1 → 3-2 → 3-3 → 3-4 → 3-5 → 3-6)。3-2は3-1の`auth-store`に、3-3は3-1・3-2(ログイン後の遷移先)に、3-4は3-1・3-3(ダッシュボードからの導線)に、3-5は3-1・3-4(intakeフォームからのハンドオフ)に、3-6は3-1・3-5(生成完了後の遷移先)に依存する。写経後は各章末尾の「動作確認」節のコマンド(`npm run typecheck`・`npm run test`)で都度確認しながら進めること。3-5着手前には、react-markdownのpeer-deps確認結果を本Phase-3-introduction.mdまたは3-5章内に追記してから進める。

## Phase 3全体としての既知の残課題

[`Phase-3-6.md`](./Phase-3-6.md)末尾「Phase 3全体としての既知の残課題」参照(SCR-005の一部Should要件未実装、SSE再接続時の履歴再取得未実装、実Gemini API未検証)。

## 次のフェーズ

**Phase 4**: 統合テスト・QA。詳細は[`Phase-0-2.md`](../Phase-0/Phase-0-2.md)のロードマップを参照。ユーザーが「Phase 4を開始する」と発話するまでは着手しない(#5)。
