# Phase-3-1: `auth-store.ts`書き換え(Cookie方式対応)+起動時サイレントリフレッシュ

## この章の目的

devex-uiの既存`auth-store.ts`はリフレッシュトークンをlocalStorageに永続化しJSONボディでやり取りする設計だったが、バックエンドは[`Phase-2-2.md`](../Phase-2/Phase-2-2.md)でhttpOnly Secure Cookie方式に更新済みである。本章ではフロントエンド側をこのCookie方式に合わせて書き換え、ページリロード後もログイン状態を復元できるようにする(アクセストークンをメモリのみに保持する設計上、リロード直後は`bootstrap()`によるCookie経由のサイレントリフレッシュが唯一の復元手段になる)。

納期モード([`Phase-3-introduction.md`](./Phase-3-introduction.md)参照)。#14のSUT/ドライバ/スタブの言語化は省略するが、Cookie送信部分はセキュリティ影響があるため下記「テスト観点」で明記する。

サンプルは [`textbook/samples/frontend/`](../samples/frontend/) に追加した。写経前提として[`Phase-2-2.md`](../Phase-2/Phase-2-2.md)のバックエンドCookie化(`app/api/deps.py`・`app/schemas/auth.py`・`app/api/routes/auth.py`)の写経が完了していること。

## この章で作成・更新したファイル

写経順序は依存順(CLAUDE.md #30): `lib/api/client.ts`(全リクエストでCookie送信を有効化)→`components/auth/auth-store.ts`(Cookie方式への書き換え、`client.ts`の`apiFetch`に依存)→`components/auth/AuthBootstrap.tsx`(`auth-store`の`bootstrap()`を呼ぶ)→`components/auth/RequireAuth.tsx`(`auth-store`の`status`を読む)→`app/layout.tsx`(`AuthBootstrap`をマウント)→`others/protected-demo/page.tsx`(`auth-store`の`login()`呼び出し箇所を新シグネチャに追従)。テストは末尾。

| ファイル(`devex-ui/`基準) | 新規/更新 | 写経レベル | 責務 |
|---|---|---|---|
| [`src/lib/api/client.ts`](../samples/frontend/src/lib/api/client.ts) | 更新 | **コア** | `apiFetch`の全リクエストに`credentials:"include"`を付与し、httpOnly Cookieが自動送信されるようにする |
| [`src/components/auth/auth-store.ts`](../samples/frontend/src/components/auth/auth-store.ts) | 更新 | **コア** | `refreshToken`をstate/永続化から排除し`login(accessToken)`単一引数化、Cookie経由の`refreshTokens()`、起動時復元用の`bootstrap()`を追加 |
| [`src/components/auth/AuthBootstrap.tsx`](../samples/frontend/src/components/auth/AuthBootstrap.tsx) | 新規 | 定型 | マウント時に`bootstrap()`を1回呼ぶだけの非表示コンポーネント |
| [`src/components/auth/RequireAuth.tsx`](../samples/frontend/src/components/auth/RequireAuth.tsx) | 更新 | **コア** | `status==="loading"`(復元中)の間はログイン必須ダイアログの表示を保留する |
| [`src/app/layout.tsx`](../samples/frontend/src/app/layout.tsx) | 更新 | 定型 | ルートレイアウトに`<AuthBootstrap/>`を1箇所マウントする |
| [`src/app/(pages)/(sample)/others/protected-demo/page.tsx`](../samples/frontend/src/app/(pages)/(sample)/others/protected-demo/page.tsx) | 更新 | 定型 | `login()`呼び出しを新シグネチャ(`accessToken`のみ)に追従させる(デモページの動作自体は変更なし) |
| ── ここからテスト(まとめて末尾) ── | | | |
| [`src/lib/api/test-utils/fetch-stub.ts`](../samples/frontend/src/lib/api/test-utils/fetch-stub.ts) | 新規(フィクスチャ) | 定型 | `global.fetch`を差し替える最小限のスタブ。以降の章でも流用する |
| [`src/components/auth/__tests__/auth-store.test.ts`](../samples/frontend/src/components/auth/__tests__/auth-store.test.ts) | 新規 | 定型 | `login`/`logout`/`refreshTokens`/多重リフレッシュ抑止の単体テスト |
| [`src/components/auth/__tests__/AuthBootstrap.test.tsx`](../samples/frontend/src/components/auth/__tests__/AuthBootstrap.test.tsx) | 新規 | 定型 | マウント時に`bootstrap()`が1回だけ呼ばれ、何もレンダリングしないことの確認 |
| [`src/components/auth/__tests__/RequireAuth.test.tsx`](../samples/frontend/src/components/auth/__tests__/RequireAuth.test.tsx) | 新規 | 定型 | `status`の3状態(loading/idle/success)ごとの表示切り替えの確認 |
| [`src/app/__tests__/layout.test.tsx`](../samples/frontend/src/app/__tests__/layout.test.tsx) | 新規 | 定型 | `RootLayout`の要素ツリーに`AuthBootstrap`が含まれることの構造的確認 |
| [`src/app/(pages)/(sample)/others/protected-demo/__tests__/page.test.tsx`](../samples/frontend/src/app/(pages)/(sample)/others/protected-demo/__tests__/page.test.tsx) | 新規 | 定型 | デモページのモックログインボタンが新シグネチャで動作することの確認 |

## 主要な設計判断

### アクセストークンをメモリのみに保持し、`status`の初期値を`loading`にした理由

[`docs/internal_design.md`](../../docs/internal_design.md) 3.1節は「アクセストークンはクライアントメモリ(Zustandストア、非persist)に保持する」と定めており、`persist`ミドルウェアを完全に削除した。この結果、ページリロード直後はメモリが空になり、`accessToken`だけを見ると「未ログイン」と区別が付かない。しかし実際にはhttpOnly Cookieにリフレッシュトークンが残っている可能性があるため、`bootstrap()`(`AuthBootstrap`がマウント時に1回呼ぶ)がCookie経由でアクセストークンの復元を試みるまでは「まだ判定できない」状態のはずである。この一時的な状態を表現するため、`status`の初期値を`"idle"`ではなく`"loading"`にした。`RequireAuth`はこれを見て、復元が終わる(`"success"`または`"idle"`に確定する)までログイン必須ダイアログの表示を保留する。仮に初期値を`"idle"`のままにすると、`AuthBootstrap`の`useEffect`が発火する前の最初の描画で一瞬ダイアログが出てしまう(フラッシュ)。

### `logout()`が`/api/v1/auth/logout`をベストエフォートで呼ぶようになった理由

書き換え前は、ログアウト時にlocalStorageからトークンを消せばクライアント側の状態としては十分だった(リフレッシュトークン自体もlocalStorageにあり、消せば読めなくなるため)。Cookie方式ではリフレッシュトークンはhttpOnly Cookieにあり**JSからは消せない**。そのため、`logout()`はサーバー側に`/api/v1/auth/logout`を呼んでCookieを失効・削除させる必要がある(呼ばないと、次回`bootstrap()`が古いCookieで再ログインしてしまう)。失敗は無視する(ベストエフォート): Cookieは14日で自然失効するため、呼び出しに失敗してもクライアント側は既にログアウト済み扱いにして構わない。

### `credentials:"include"`を`apiFetch`のデフォルトにした理由

呼び出し側ごとに`credentials:"include"`を書かせると、将来の章(3-5のチャットAPI等)で書き忘れるリスクがある。Cookie自体は`path=/api/v1/auth`にスコープされているため、`/api/v1/projects`等の他エンドポイントへは(`credentials:"include"`を付けても)ブラウザが自動的に送らない。実害が無い一方で書き忘れのリスクを消せるため、`apiFetch`内で一律に付与する設計にした。

### `others/protected-demo/page.tsx`を更新した理由

このデモページは`login(accessToken, refreshToken)`という旧シグネチャを直接呼んでいた。`login()`が単一引数になったことでTypeScriptの型エラーになるため、呼び出し側を追従させる必要がある(新しい設計判断を含まない、機械的な追従)。

## テスト観点

| ケース | 期待結果 | SUT / ドライバ / スタブ |
|---|---|---|
| `login(accessToken)` | `accessToken`が保存され`status`が`success`になる | SUT: `auth-store.ts`の`login` / ドライバ: 直接呼び出し / スタブ不要 ── 対象が純粋な状態更新のみで外部I/Oを呼ばないため |
| `logout()` | `accessToken`が同期的に破棄され、`/api/v1/auth/logout`がベストエフォートで(`credentials:"include"`付きで)呼ばれる | SUT: `logout` / ドライバ: 直接呼び出し / スタブ: `fetch-stub.ts`(`global.fetch`を差し替え、実際に送られたリクエストを記録する) |
| `refreshTokens()`成功 | レスポンスの`access_token`で状態を更新し、リクエストボディにトークンを含めない | 同上 |
| `refreshTokens()`失敗(Cookie無し等) | 例外を投げず、静かに`accessToken: null, status: "idle"`に倒す | 同上 |
| `refreshTokens()`の同時多重呼び出し | 実際のfetchは1回だけ発生する(`refreshPromise`による重複排除) | 同上 |
| `AuthBootstrap`のマウント | ストアの`bootstrap()`が1回だけ呼ばれ、何もレンダリングしない | SUT: `AuthBootstrap.tsx` / ドライバ: `render()` / スタブ: `useAuthStore.setState({bootstrap: vi.fn()})`でストアのアクションをフェイクに差し替える(実際のfetchを発生させない) |
| `RequireAuth`の`status`別表示 | `loading`時は非表示、`idle`かつ未ログインならダイアログ、ログイン済みなら`children` | SUT: `RequireAuth.tsx` / ドライバ: `render()`(`next/navigation`は`vi.mock`でフェイク) / スタブ不要 ── `useAuthStore`の状態を直接`setState`で設定するのみで外部I/Oは発生しないため |

`npx vitest run src/components/auth src/app/__tests__/layout.test.tsx "src/app/(pages)/(sample)/others/protected-demo/__tests__/page.test.tsx"`で12件green、`npx tsc --noEmit`で0エラー、既存テスト全体(`npx vitest run`)は113件中112件green(残る1件`Menu.test.tsx`は本章と無関係の既存不具合であることを、変更前のコードでも同じ失敗が再現することで確認済み)を確認した(このセッション内で一時的に`devex-ui`へ反映して検証し、検証後は元の状態に戻した。写経後は各自の環境で再確認すること)。

## Phase 3-1で判明した副次的な発見

- `RequireAuth.tsx`・`others/protected-demo/page.tsx`は本章のCookie化に伴う機械的な追従が必要だった(前者は`status`参照の追加、後者は`login()`呼び出しの引数数)。いずれも新しい設計判断を含まない。
- `Menu.test.tsx`に本章と無関係の既存の失敗(`getAllByRole("link")`の期待件数不一致)があることを確認した。原因調査・修正は本章のスコープ外(CLAUDE.md #17: このPhaseの実在の消費者が無い遡及修正にあたるため)。Phase 4(統合テスト・QA)または気づいた時点で`textbook/retrospective-memo.md`への記録を検討する。
