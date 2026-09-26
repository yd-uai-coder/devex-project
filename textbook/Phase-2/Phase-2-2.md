# Phase-2-2: 認証基盤・プロジェクト所有権チェック

## この章の目的

「認証済みユーザーが指定プロジェクトの所有者であること」を保証する依存関数(`get_current_project`/`CurrentProjectDep`)を追加し、以降の章(2-3〜2-5)が作る`/api/v1/projects/{project_id}/...`系ルート全てが、これを1行加えるだけで所有権チェックを済ませられるようにする。あわせて、JWTのリフレッシュトークンの受け渡し方式を、[`docs/internal_design.md`](../../docs/internal_design.md) 3.1節が定める**httpOnly Secure Cookie**方式に更新する(汎用テンプレート由来の`register`/`login`/`refresh`/`logout`がJSONボディでリフレッシュトークンをやり取りしていたため、Devexの決定済み仕様に合わせて改修する)。

納期モード([`Phase-2-introduction.md`](./Phase-2-introduction.md)参照)。#14のSUT/ドライバ/スタブの言語化は省略するが、Cookie設定部分はセキュリティ影響があるため下記「テスト観点」で明記する。

サンプルは [`textbook/samples/backend/`](../samples/backend/) に追加した。写経前提として [`Phase-2-1.md`](./Phase-2-1.md) の写経が完了していること(`Project`/`ProjectRepository`に依存する)。

## この章で作成・更新したファイル

写経順序は依存順(CLAUDE.md #30): `services/errors.py`(`ProjectNotFoundError`定義)→`api/deps.py`(所有権チェック+Cookie読み取り)→`schemas/auth.py`(レスポンス形状変更)→`api/routes/auth.py`(Cookie設定・削除)。テストは末尾。

| ファイル(`devex-api/backend/`基準) | 新規/更新 | 写経レベル | 責務 |
|---|---|---|---|
| [`app/services/errors.py`](../samples/backend/app/services/errors.py) | 更新 | 定型 | `ProjectNotFoundError(NotFoundError)`を追加(**Phase 2-3・2-5でも追記あり**。既存のtests/認証系エラーは変更なし)。**次の`api/deps.py`がこれをimportするため先に置く** |
| [`app/api/deps.py`](../samples/backend/app/api/deps.py) | 更新 | **コア** | `get_current_project`依存関数・`CurrentProjectDep`を追加。加えて`REFRESH_TOKEN_COOKIE_NAME`定数と`get_refresh_token_from_cookie`/`RefreshTokenCookieDep`を追加し、リフレッシュトークンをCookieから読み取る経路を提供する(`get_current_user`本体は無変更) |
| [`app/schemas/auth.py`](../samples/backend/app/schemas/auth.py) | 更新 | **コア** | `TokenPair`/`RefreshRequest`を廃止し、`AccessToken`のみに統一(リフレッシュトークンをレスポンスボディに含めない) |
| [`app/api/routes/auth.py`](../samples/backend/app/api/routes/auth.py) | 更新 | **コア** | `login`が`Set-Cookie`でリフレッシュトークンを発行し、`refresh`/`logout`がCookie経由でリフレッシュトークンを受け取るように変更 |
| ── ここからテスト(まとめて末尾) ── | | | |
| `tests/unit/test_deps_current_project.py` | 新規 | 定型 | `get_current_project`の単体テスト |
| [`tests/integration/test_auth_flow.py`](../samples/backend/tests/integration/test_auth_flow.py) | 更新 | 定型 | 登録→ログイン→保護ルート→リフレッシュ→ログアウトの一連の流れをCookie方式で検証。Cookie無しでの`/refresh`失敗も検証 |

ファイル先頭のコメントヘッダー(`# 更新：Phase-2-2`のように該当する全章を列挙)と、各追記・更新箇所の`# Phase-2-2:追記`/`# Phase-2-2：更新`タグで変更履歴を追跡できる。

## 主要な設計判断

### `get_current_project`を`CurrentUserDep`と別依存にした理由

`ConversationRepository.get_by_id(id_, *, user_id=...)`と同じ「所有者スコープのget_by_id」パターンを`ProjectRepository`にも適用済み([`Phase-2-1.md`](./Phase-2-1.md))。`get_current_project`はこれを FastAPI の依存関数として1箇所にまとめ、Phase 2-3〜2-5で追加する全ての`/api/v1/projects/{project_id}/...`ルートが`CurrentProjectDep`を1行加えるだけで「認証済み・かつ所有者本人」を保証できるようにする(各ルートで`current_user.id == project.user_id`を毎回書かない)。

### 存在しないプロジェクトと他人のプロジェクトを区別しない

`get_current_project`はどちらのケースも`ProjectNotFoundError`(404)に統一する。存在確認そのものを外部に漏らさないため(`app/api/deps.py`の既存の認証エラーが理由を一律401にしているのと同じ設計思想)。

### リフレッシュトークンをhttpOnly Secure Cookieに変更した理由

[`docs/internal_design.md`](../../docs/internal_design.md) 3.1節は当初(Phase 0-5時点)から「リフレッシュトークンはhttpOnly Secure Cookieに保持」と定めていたが、汎用スターターテンプレート由来の`auth.py`/`schemas/auth.py`はJSONボディでリフレッシュトークンをやり取りする実装のままだった。この章で以下のように改修する:

- **`AccessToken`のみに統一**: `login`のレスポンスは`access_token`のみを返す。`TokenPair`/`RefreshRequest`は廃止する。
- **Cookie属性**: `httponly=True`(JSからrefresh_tokenへのアクセスを一切遮断)、`secure=(ENVIRONMENT=="production")`(開発環境はHTTPのため常時強制すると送信されなくなる)、`samesite="lax"`(同一サイト内の遷移・リロードでは送信されつつ、クロスサイトの単純なPOST等では送信されない)、`path="/api/v1/auth"`(認証系エンドポイント以外への送信を防ぎ露出面を減らす)、`max_age=14日`。
- **`AuthService`は無変更**: `issue_tokens`/`refresh_access_token`/`revoke_refresh_token`はトークン文字列の受け渡しのみを行い、Cookieかボディかを意識しない設計だったため、ルート層(`routes/auth.py`)とスキーマ層(`schemas/auth.py`)・依存性(`deps.py`)の変更だけで完結する。
- **CORSは変更不要**: `app/main.py`の`CORSMiddleware`は既に`allow_credentials=True`が設定済みで、Cookie方式への変更に追加対応は不要。

> **[Phase 2-2 で確定 ── 当初「既存のJWT認証は無変更で再利用」としていた判断を撤回]** 当初は汎用テンプレートの`register`/`login`/`refresh`/`logout`をそのまま再利用する予定だった → 撤回。理由: Phase 0-5で決定済みだったCookie方式との差分点検を怠っており、実装が設計書と乖離していた。Phase 3準備中に発覚し、Phase 3の教材がまだ何にも依存していないタイミングだったため、CLAUDE.md #12(後続Phaseでの変更は前方参照で記録する)の例外として、本章を直接書き換える形で修正した(#12自体の運用方針は今後も維持する)。詳細は[`decision-digest.md`](../decision-digest.md)参照。

## テスト観点

| ケース | 期待結果 | SUT / ドライバ / スタブ |
|---|---|---|
| 呼び出しユーザーがプロジェクト所有者 | `Project`が返る | SUT: `get_current_project` / ドライバ: 直接呼び出し / スタブ不要 ── 対象がインメモリSQLiteの実`ProjectRepository`を使い、外部I/Oが無いため |
| 呼び出しユーザーが別人 | `ProjectNotFoundError` | 同上 |
| 指定IDのプロジェクトが存在しない | `ProjectNotFoundError` | 同上 |
| 登録→ログイン→保護ルート→リフレッシュ→ログアウト | 各ステップ200/204、`login`のレスポンスボディに`refresh_token`が含まれない、`AsyncClient`のCookieジャーに`refresh_token`が設定される | SUT: `routes/auth.py`一式 / ドライバ: `httpx.AsyncClient`(統合テスト、実Postgres/Redis) / スタブ不要 ── Cookie設定はHTTPレスポンスヘッダの実挙動そのものを検証する必要があるため実環境で確認する |
| Cookie無しで`/refresh`を呼ぶ | 401 | 同上 |

`uv run pytest tests/unit/test_deps_current_project.py`で3件green、`uv run pytest tests/unit`で既存分含め91件green(Phase 2-1〜2-5相当)、`uv run pytest -m integration tests/integration/test_auth_flow.py::test_register_login_and_access_protected_route`・`::test_refresh_without_cookie_is_unauthorized`をそれぞれ単独実行してgreen、`uvx pyright`で0エラーを確認済み(このセッション内で一時的に`devex-api/backend`へ反映して検証し、検証後は元の状態に戻した。写経後は各自の環境で再確認すること)。2つの統合テストを同一プロセスでまとめて実行すると[`Phase-1-1.md`](../Phase-1/Phase-1-1.md)で既知のpytest-asyncioイベントループ後片付けの問題が再現するため、統合テストは今のところ個別実行を前提とする(Phase 2から持ち越しの既知課題であり本章のCookie化とは無関係)。
