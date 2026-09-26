# Phase-3-3: ダッシュボード画面(SCR-002)

## この章の目的

`docs/external_design.md` SCR-002(ダッシュボード画面)を実装する。ログイン後の最初の画面として、認証ユーザーのプロジェクト一覧(`GET /api/v1/projects`)を表示し、新規プロジェクト作成(初期ヒアリング入力フォーム、[`Phase-3-4.md`](./Phase-3-4.md))への導線を提供する。

納期モード([`Phase-3-introduction.md`](./Phase-3-introduction.md)参照)。#14のSUT/ドライバ/スタブの言語化は省略する。

サンプルは [`textbook/samples/frontend/`](../samples/frontend/) に追加した。写経前提として[`Phase-3-1.md`](./Phase-3-1.md)(`auth-store.ts`)・[`Phase-3-2.md`](./Phase-3-2.md)(`FormGeneral.tsx`等の改修)の写経が完了していること。

## この章で作成・更新したファイル

写経順序は依存順(CLAUDE.md #30): `features/dashboard/api/projects.ts`(APIコール)→`dashboard-store.ts`(それを使うストア)→`ProjectListItem.tsx`(1件の表示)→`ProjectList.tsx`(一覧+状態分岐)→`app/dashboard/page.tsx`(ページ)。テストは末尾。

| ファイル(`devex-ui/`基準) | 新規/更新 | 写経レベル | 責務 |
|---|---|---|---|
| [`src/features/dashboard/api/projects.ts`](../samples/frontend/src/features/dashboard/api/projects.ts) | 新規 | 定型 | `GET /api/v1/projects`のfetchラッパー+`ProjectRead`型 |
| [`src/features/dashboard/dashboard-store.ts`](../samples/frontend/src/features/dashboard/dashboard-store.ts) | 新規 | **コア** | プロジェクト一覧の状態管理。`isCacheFresh`(TTLキャッシュ)+`invalidate()`パターンの本プロジェクト初適用 |
| [`src/features/dashboard/components/ProjectListItem.tsx`](../samples/frontend/src/features/dashboard/components/ProjectListItem.tsx) | 新規 | **コア** | 1プロジェクトの表示+状態に応じた遷移先(`projectHref`) |
| [`src/features/dashboard/components/ProjectList.tsx`](../samples/frontend/src/features/dashboard/components/ProjectList.tsx) | 新規 | 定型 | 読み込み中/エラー/空/一覧の状態分岐 |
| [`src/app/dashboard/page.tsx`](../samples/frontend/src/app/dashboard/page.tsx) | 新規 | 定型 | `RequireAuth`でガードし、新規プロジェクト導線+`ProjectList`を配置 |
| ── ここからテスト(まとめて末尾) ── | | | |
| [`src/features/dashboard/__tests__/dashboard-store.test.ts`](../samples/frontend/src/features/dashboard/__tests__/dashboard-store.test.ts) | 新規 | 定型 | 成功/TTLスキップ/force/invalidate/失敗の各ケース |
| [`src/features/dashboard/components/__tests__/ProjectList.test.tsx`](../samples/frontend/src/features/dashboard/components/__tests__/ProjectList.test.tsx) | 新規 | 定型 | 空状態/一覧表示/遷移先/エラー表示の確認 |
| [`src/app/dashboard/__tests__/page.test.tsx`](../samples/frontend/src/app/dashboard/__tests__/page.test.tsx) | 新規 | 定型 | ページの構成要素のスモークテスト |

## 主要な設計判断

### `isCacheFresh` + `invalidate()`パターンの初適用

`devex-ui/CLAUDE.md`が定めるTTLキャッシュ方針(`src/lib/api/cache.ts`)は、これまでどのストアも実際には使っていなかった(既存のZustandストアはUIのローカル状態のみでAPIを呼ばないもの)。`dashboard-store.ts`がこのプロジェクト最初の実消費者となる。`fetchProjects({force})`は`isCacheFresh(fetchedAt)`がtrueならAPI呼び出し自体をスキップし、`invalidate()`は`fetchedAt`を`null`に戻すことで次回呼び出しを強制的に再取得させる(3-4でプロジェクト作成後にダッシュボードへ戻った際、一覧を最新化するために使う想定)。

### プロジェクトの状態(`status`)で遷移先を分岐する理由

`interviewing`/`generating`はまだヒアリング対話が終わっていない(または生成中で、チャット画面側でポーリングして完了を検知する、[`Phase-3-5.md`](./Phase-3-5.md)参照)ため、チャット画面(`/projects/{id}/chat`)に戻す。`completed`は既に4文書が揃っているため、ドキュメントプレビュー(`/projects/{id}/documents`)に直接遷移させる。この分岐ロジックは`ProjectListItem.tsx`の`projectHref()`という純粋関数に切り出し、単体テストで直接検証できるようにした。

> **後続の改訂**: 新しいステータス`revising`(修正中。`completed`後に新規チャットメッセージを送ると遷移する)を追加した。`projectHref()`自体は`=== "completed"`以外を`/chat`に振り分ける既存ロジックのままで`revising`も正しく扱えるため変更不要だったが、`STATUS_LABEL`に`revising: "修正中"`を追加した。詳細は[`decision-digest.md`](../decision-digest.md)「プロジェクトステータス「修正中(revising)」の導入 + ドキュメントへの常設リンク + ドキュメントプレビュー画面の2件の修正」節参照。

### 「新規プロジェクトを作成」をボタン風の`<a>`にした理由

Tamaguiの`Button`はWeb上で`<button>`要素として描画される。`next/link`の`<a>`直下に`<button>`を置くと対話要素の入れ子になりHTML的に不正(一部ブラウザ・スクリーンリーダーで挙動が不安定になりうる)なため、`XStack`+`Text`でボタン風に見せかけた`<a>`一枚にしている。

> **後続の改訂**: `app/dashboard/page.tsx`は元々`"use client"`が無く、実機検証で`TypeError: createReactContext is not a function`が発生した(Server Componentから`tamagui`を直接importできないため)。先頭に`"use client";`を追加して解決した。詳細は[`decision-digest.md`](../decision-digest.md)「Phase 3完了後 ── Server ComponentからTamaguiを直接importできない問題」節参照。

## テスト観点

| ケース | 期待結果 | SUT / ドライバ / スタブ |
|---|---|---|
| `fetchProjects()`成功 | `projects`/`status`/`fetchedAt`が更新される | SUT: `dashboard-store.ts` / ドライバ: 直接呼び出し / スタブ: `fetch-stub.ts` |
| TTL以内の再呼び出し | 追加のfetchが発生しない | 同上 |
| `force: true` | TTL以内でも再fetchする | 同上 |
| `invalidate()`後 | 次回呼び出しがTTLを無視して再取得する | 同上 |
| `fetchProjects()`失敗 | `status: "error"`+メッセージ保持 | 同上 |
| `ProjectList`: 空一覧 | 空状態メッセージを表示 | SUT: `ProjectList.tsx` / ドライバ: `render` / スタブ: `fetch-stub.ts` |
| `ProjectList`: 一覧表示 | 各行が`projectHref()`通りの`href`を持つ | 同上 |
| `ProjectList`: 取得失敗 | エラーメッセージを表示(`role="alert"`) | 同上 |
| `DashboardPage` | 新規プロジェクト作成リンク+`ProjectList`を表示 | SUT: `page.tsx` / ドライバ: `render`(`next/navigation`は`vi.mock`) / スタブ: `fetch-stub.ts` |

`npx vitest run src/features/dashboard src/app/dashboard`で9件green、`npx tsc --noEmit`で0エラー、既存テスト全体は133件中132件green(残る1件`Menu.test.tsx`は[`Phase-3-1.md`](./Phase-3-1.md)で確認済みの本Phaseと無関係な既存不具合)を確認した(このセッション内で一時的に`devex-ui`へ反映して検証し、検証後は元の状態に戻した。写経後は各自の環境で再確認すること)。
