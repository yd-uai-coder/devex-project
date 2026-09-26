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

## `[テンプレート反映候補]` テストファイルを`__tests__/`サブフォルダへ配置する規約

- **発生**: Phase 3完了後のユーザー相談([`decision-digest.md`](./decision-digest.md)「Phase 3完了後」節参照)
- **概要**: `devex-ui`の`*.test.ts(x)`配置を、ソース直下へのcolocateから、テスト対象と同じディレクトリの`__tests__/`サブフォルダへ変更した。Jest由来でJS界隈での認知度が高い規約。既存デモギャラリを含むdevex-ui全体を移行し、`devex-ui/CLAUDE.md`のTesting節も更新済み。
- **判断理由**: ソース側ディレクトリの見通しを優先するか、テストとソースの物理的な近さを優先するかというトレードオフで、今回は前者を選んだ。ドメインに依存しない、フロントエンドテンプレート全般に適用できる構成方針。
- **対象外**: `devex-api`側のテストは元々`tests/unit/`・`tests/integration/`という別ディレクトリ構成であり、今回の変更はフロントエンド(`devex-ui`)のみが対象。バックエンド側の構成を変える理由・要望は無い。
