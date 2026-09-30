# 振り返り用覚書

プロジェクト完了後の振り返り(CLAUDE.md #10)で見返すための、汎用の覚書ログ。[`decision-digest.md`](./decision-digest.md)とは異なり、こちらは「Devexというこのアプリケーション自身では完結しない」情報(他のプロジェクト・リポジトリに関わる事項など)を置く。[`q_a.md`](./q_a.md)同様、保存専用に近く作業中は参照しない。

各エントリの先頭に種別タグを付ける。現時点のタグ一覧:

- `[テンプレート反映候補]`: `devex-api`/`devex-ui`はDevex専用ではなくテンプレートリポジトリでもある(`CLAUDE.md`「Repository structure」節参照)。Devexの実装中に見つかった、ドメインに依存しない汎用的な改善(バグ修正・アーキテクチャ改善等)で、テンプレート側にも反映する価値があると判断したものを記録する。

エントリは (1) 種別タグ (2) 発生したPhase・章 (3) 内容の概要 (4) 判断理由、の順で記す。

---

## `[テンプレート反映候補]` JWT仕様

- **発生**: Phase 0([`Phase-0-5.md`](./Phase-0/Phase-0-5.md)、仕様診断10番)
- **概要**: アクセストークン30分・リフレッシュトークン14日・リフレッシュトークンはhttpOnly Secure Cookie・devex-ui既存`auth-store.ts`のサイレントリフレッシュパターンを流用、というJWT運用仕様。
- **判断理由**: この仕様はDevex固有のドメインとは無関係で、他プロジェクトでも再利用する想定の認証基盤の一般的なベストプラクティスであるため。

## `[テンプレート反映候補]` AppError.code / catch-allハンドラ

- **発生**: Phase 2-5([`Phase-2-5.md`](./Phase-2/Phase-2-5.md))
- **概要**:
  - `app/core/errors.py`の`AppError.code: ClassVar[str | None] = None`(既存`status_code`と並ぶ、後方互換なオプションフィールド)。
  - `app/api/error_handlers.py`の「`code`が設定されている場合のみレスポンスに含める」分岐。
  - `app/api/error_handlers.py`に新設した`@app.exception_handler(Exception)`(未処理例外を一律`INTERNAL_SERVER_ERROR`として返すcatch-all)。
- **判断理由**: いずれもドメインに依存しない、エラーハンドリング基盤の汎用的な改善。特にcatch-allハンドラは、Devexの実装中に見つかった、テンプレート側に元々あった穴(未処理例外が素の500になる)の修正であり、ドメインを問わず有用。
- **対象外**: `app/services/errors.py`に追加した個々のドメイン例外(`ProjectNotFoundError`等)への`code`付与自体はDevexのエラーコード体系そのものであり、テンプレートには持ち込まない。

## `[テンプレート反映候補]` `auth-store.ts`のリフレッシュトークンをhttpOnly Cookie方式へ

- **発生**: Phase 3-1([`Phase-3-1.md`](./Phase-3/Phase-3-1.md))
- **概要**: `devex-ui`既存の`auth-store.ts`は、リフレッシュトークンをアクセストークンと共にlocalStorageへ永続化し、JSONボディでバックエンドとやり取りする設計だった。Devexでは、リフレッシュトークンはhttpOnly Secure Cookie・アクセストークンはメモリのみ(非persist)という設計に書き換え、`apiFetch`に`credentials:"include"`を常時付与し、ページロード時にCookie経由でセッションを復元する`bootstrap()`/`AuthBootstrap`を追加した。サイレントリフレッシュのタイマー・重複排除・401リトライという既存の*パターン*自体は変更していない。
- **判断理由**: localStorageへのリフレッシュトークン保持はXSS耐性が無く、Devex固有ではなく認証基盤一般の脆弱性。Cookie方式+メモリ方式への転換はドメインに依存しない改善であり、テンプレート側の既定にする価値がある。
- **対象外**: `bootstrap()`の呼び出しタイミング(`AuthBootstrap`をレイアウトのどこに置くか)はアプリの画面構成次第であり、テンプレート側に固定の型を持ち込む必要はない。

## `[テンプレート反映候補]` Vitestでの`next/font/google`・`next/navigation`フックのテスト時の扱い

- **発生**: Phase 3-1([`Phase-3-1.md`](./Phase-3/Phase-3-1.md))
- **概要**: `src/app/layout.tsx`を初めてテストからimportしたところ、`next/font/google`の`Geist()`がVitest(Vite)環境では実行時関数として動作せず(`Geist is not a function`)、`vi.mock("next/font/google", ...)`で差し替える必要があった。同様に、`usePathname`/`useRouter`(`next/navigation`)を使うコンポーネント(`RequireAuth`→`LoginRequiredDialog`)をApp Routerの実行コンテキスト外でレンダリングすると`invariant expected app router to be mounted`で落ちるため、`vi.mock("next/navigation", ...)`が必要だった。
- **判断理由**: どちらもNext.js App Router構成のテンプレート全般に当てはまる既知の制約で、Devexのドメインとは無関係。`devex-ui/CLAUDE.md`の「過去のセッションで見つかったハマりどころ」に加える価値がある。
- **対象外**: 具体的なモックの戻り値(パス文字列等)はテストごとに異なるため、汎用ヘルパー化は今のところ見送り(#17: 現時点でこれを駆動する複数の実消費者は3-1内の数ファイルのみ)。

## `[テンプレート反映候補]` サービスメソッド実装後のルート配線忘れ(Phase 2-3のやり直し)

- **発生**: Phase 3-5準備中に発覚、[`Phase-2-3.md`](./Phase-2/Phase-2-3.md)をrule #12の例外として直接修正(詳細は[`decision-digest.md`](./decision-digest.md)「Phase 3-5着手前」節)。
- **概要**: `ChatService.check_completion`(サービスメソッド)と対応する単体テストはPhase 2-3で実装済みだったが、これを呼び出すAPIルート(`GET /api/v1/projects/{project_id}/hearing-completion`)の配線が漏れていた。サービス層の実装+テストが揃っていたため、レビュー時に見過ごされやすかった。
- **判断理由**: `routes→services→repositories→models`のレイヤード構成(`devex-api/CLAUDE.md`)を持つテンプレート全般で起こりうる一般的な落とし穴であり、Devexのドメインとは無関係。「サービスメソッドを追加したら、それを呼ぶルートが実際に存在するか」を確認するチェック項目を、テンプレート側の開発フロー(あるいはこのCL手法の#11実装前チェックリスト・#13/#15の突き合わせ)に明示的に加える価値がある。
- **対象外**: `hearing-completion`という具体的なエンドポイント名・レスポンス形状自体はDevexのドメインそのものであり、テンプレートには持ち込まない。テンプレートに持ち込むのは「サービス⇔ルートの対応漏れを機械的に確認する」という点検の型のみ。

## `[テンプレート反映候補]` 統合テストの`client`フィクスチャがイベントループをまたいでコネクションプールを使い回してしまう不具合

- **発生**: [`Phase-1-1.md`](./Phase-1/Phase-1-1.md)で最初に発見・保留、[`Phase-2-2.md`](./Phase-2/Phase-2-2.md)で「個別実行」という回避策のまま持ち越し、[`Phase-4-1.md`](./Phase-4/Phase-4-1.md)で根本修正。
- **概要**: `tests/integration/conftest.py`の`client`フィクスチャは、モジュールレベルのシングルトンである`app/core/database.py`の`engine`・`app/infrastructure/redis.py`の`get_redis_pool()`をそのまま使う。両者の内部コネクションプールは生成時のイベントループに紐づくが、pytest-asyncioは既定でテスト関数ごとに新しいイベントループを作るため、後片付けをしないと2件目以降のテストが別のイベントループからプールを再利用しようとして`RuntimeError: Event loop is closed`/`attached to a different loop`になる。フィクスチャのteardownで`await engine.dispose()`・`await get_redis_pool().disconnect(); get_redis_pool.cache_clear()`を行うよう修正した。
- **判断理由**: `engine`・Redis接続プールをモジュールレベルの`lru_cache`シングルトンにする設計自体はテンプレート全般の既存パターン(`devex-api/CLAUDE.md`「LLM/LangGraph連携」節が同種のキャッシュ戦略を明記している)であり、この不具合もpytest-asyncio+モジュールレベルの非同期リソースという組み合わせで一般的に起こりうる。統合テストが1ファイルあたり1〜2件しか無いうちは「個別実行すれば良い」で済むが、テストが増えるほど顕在化しやすくなるため、テンプレート側のconftestに最初から後片付けを組み込んでおく価値がある。
- **対象外**: `tests/integration/conftest.py`の`client`フィクスチャがテスト用DBと開発用DBで同じ`DATABASE_URL`を共有している点(Phase 1の環境設計)自体は、この不具合とは別の論点として[`Phase-4-3.md`](./Phase-4/Phase-4-3.md)「既知の残課題」に記録済みで、今回のテンプレート反映候補には含めない。

## `[テンプレート反映候補]` テストファイルを`__tests__/`サブフォルダへ配置する規約

- **発生**: Phase 3完了後のユーザー相談([`decision-digest.md`](./decision-digest.md)「Phase 3完了後」節参照)
- **概要**: `devex-ui`の`*.test.ts(x)`配置を、ソース直下へのcolocateから、テスト対象と同じディレクトリの`__tests__/`サブフォルダへ変更した。Jest由来でJS界隈での認知度が高い規約。既存デモギャラリを含むdevex-ui全体を移行し、`devex-ui/CLAUDE.md`のTesting節も更新済み。
- **判断理由**: ソース側ディレクトリの見通しを優先するか、テストとソースの物理的な近さを優先するかというトレードオフで、今回は前者を選んだ。ドメインに依存しない、フロントエンドテンプレート全般に適用できる構成方針。
- **対象外**: `devex-api`側のテストは元々`tests/unit/`・`tests/integration/`という別ディレクトリ構成であり、今回の変更はフロントエンド(`devex-ui`)のみが対象。バックエンド側の構成を変える理由・要望は無い。

## `[運用ミス防止]` 環境変数(URL)の末尾スラッシュがCookieのパスマッチを壊す

- **発生**: Phase 6のデプロイ後の本番確認([`Phase-6-6.md`](./Phase-6/Phase-6-6.md)「API ベースURLの末尾スラッシュ除去」)。Phase 5の初回VPSデプロイ時から潜在していた。
- **概要**: Vercelの`NEXT_PUBLIC_API_URL`に末尾スラッシュがあると`${base}${path}`が`//api/...`になり、`Path=/api/v1/auth`のhttpOnly Cookie(リフレッシュトークン)が送られず、F5でログインが切れる。通常のAPI呼び出しは`//`でも成功するため気づきにくい。
- **判断理由**: 設定ミスを運用手順(「末尾スラッシュ無しで設定する」)だけに頼らず、コード側でURLを正規化して吸収した。`devex-api`/`devex-ui`は他プロジェクトのテンプレートでもあるため、`base-url.ts`はテンプレート側にも反映する価値がある。`OPERATIONS.md`「devex-ui(Vercel)デプロイ手順」にも注意書きを追記した。
- **対象外**: バックエンド側のCookie属性(`Path`/`SameSite`/`Domain`)は変更していない(正しく動作していたため)。

## `[テンプレート反映候補]` FE の `ApiError` にバックエンドの `code` を載せる

- **発生**: [`Phase-11-2.md`](./Phase-11/Phase-11-2.md)
- **概要**: `devex-ui`の`ApiError`は`status`と`message`しか持たず、`devex-api`の共通エラー形式`{detail, code}`の`code`を捨てていた。409の「競合」と「生成中」のように、同じstatusで扱いを変えたい場面があったため、`code?: string`を足した。`devex-ui/CLAUDE.md`の説明も更新済み。
- **判断理由**: `devex-api`はテンプレートの段階から`code`付きのエラー形式を持っている。FE側もテンプレートの段階で`code`を受け取れるようにしておけば、利用側のアプリで同じ改修をせずに済む。任意項目なので、既存の呼び出し側への影響は無い。
- **対象外**: `downloadDocument`など、`apiFetch`を通さない生の`fetch`の箇所は変えていない。
