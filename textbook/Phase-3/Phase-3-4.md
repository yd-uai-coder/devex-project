# Phase-3-4: 初期ヒアリング入力フォーム(SCR-004前段)

## この章の目的

`docs/external_design.md` 2.3節SCR-004の前段(初期ヒアリング入力)を実装する。システム概要・実現したいこと・補足の3項目と、折りたたみ式の環境設定(言語・フレームワーク・DB・デプロイ環境)・参考資料アップロード(最大3ファイル・txt/Markdown/PDF)を持つフォームを作り、`POST /api/v1/projects`(`multipart/form-data`)でプロジェクトを作成してチャット画面([`Phase-3-5.md`](./Phase-3-5.md))へ引き渡す。

納期モード([`Phase-3-introduction.md`](./Phase-3-introduction.md)参照)。コアループの「入口」ではあるがループ本体(対話往復)ではなく、内容もフォームバリデーション+アップロードのクライアント側ミラーリングが主体のため。#14のSUT/ドライバ/スタブの言語化は省略する。

サンプルは [`textbook/samples/frontend/`](../samples/frontend/) に追加した。写経前提として[`Phase-3-1.md`](./Phase-3-1.md)・[`Phase-3-2.md`](./Phase-3-2.md)・[`Phase-3-3.md`](./Phase-3-3.md)の写経が完了していること。

## この章で作成・更新したファイル

写経順序は依存順(CLAUDE.md #30): `lib/api/client.ts`(multipart対応の修正、`createProject.ts`より先)→`FieldsetGroup.tsx`/`CollapsibleSection.tsx`(汎用UI部品)→`FileUploadField.tsx`(単体で完結する部品)→`features/hearing/schemas.ts`→`api/createProject.ts`→`IntakeForm.tsx`(前述すべてに依存)→`app/projects/new/page.tsx`。テストは末尾。

| ファイル(`devex-ui/`基準) | 新規/更新 | 写経レベル | 責務 |
|---|---|---|---|
| [`src/lib/api/client.ts`](../samples/frontend/src/lib/api/client.ts) | 更新 | **コア** | `body`が`FormData`のときは`Content-Type`を固定しない(境界欠落によるパース失敗を防ぐ) |
| [`src/components/ui/form/FieldsetGroup.tsx`](../samples/frontend/src/components/ui/form/FieldsetGroup.tsx) | 新規 | 定型 | ネイティブ`<fieldset><legend>`によるグルーピング(フレームワークの言語別グルーピング用) |
| [`src/components/ui/form/CollapsibleSection.tsx`](../samples/frontend/src/components/ui/form/CollapsibleSection.tsx) | 新規 | 定型 | ネイティブ`<details><summary>`による折りたたみ(環境設定欄用) |
| [`src/features/hearing/components/FileUploadField.tsx`](../samples/frontend/src/features/hearing/components/FileUploadField.tsx) | 新規 | **コア** | ファイル選択+クライアント側バリデーション(`validateFiles`、件数・拡張子・サイズ)+一覧表示+削除 |
| [`src/features/hearing/schemas.ts`](../samples/frontend/src/features/hearing/schemas.ts) | 新規 | 定型 | `zod`スキーマ(3項目の文字数上限+`environment`+`files`) |
| [`src/features/hearing/api/createProject.ts`](../samples/frontend/src/features/hearing/api/createProject.ts) | 新規 | **コア** | `FormData`組み立て+`POST /api/v1/projects` |
| [`src/features/hearing/components/IntakeForm.tsx`](../samples/frontend/src/features/hearing/components/IntakeForm.tsx) | 新規 | **コア** | 上記すべてを組み合わせたフォーム本体 |
| [`src/app/projects/new/page.tsx`](../samples/frontend/src/app/projects/new/page.tsx) | 新規 | 定型 | `RequireAuth`でガードしたページラッパー |
| ── ここからテスト(まとめて末尾) ── | | | |
| [`src/features/hearing/components/__tests__/FileUploadField.test.tsx`](../samples/frontend/src/features/hearing/components/__tests__/FileUploadField.test.tsx) | 新規 | 定型 | `validateFiles`の単体テスト+コンポーネントの選択/削除挙動 |
| [`src/features/hearing/api/__tests__/createProject.test.ts`](../samples/frontend/src/features/hearing/api/__tests__/createProject.test.ts) | 新規 | 定型 | `FormData`の組み立て内容の検証 |
| [`src/features/hearing/components/__tests__/IntakeForm.test.tsx`](../samples/frontend/src/features/hearing/components/__tests__/IntakeForm.test.tsx) | 新規 | 定型 | バリデーション+環境設定+ファイル添付を含む送信フロー全体の確認 |
| [`src/app/projects/new/__tests__/page.test.tsx`](../samples/frontend/src/app/projects/new/__tests__/page.test.tsx) | 新規 | 定型 | ページの構成要素のスモークテスト |

## 主要な設計判断

### `client.ts`にFormData対応の修正が必要だった理由

`apiFetch`は`init?.body`が真であれば無条件に`Content-Type: application/json`を設定していた。`multipart/form-data`は`Content-Type`にランダムな境界文字列(`boundary=...`)を含む必要があり、ブラウザが`FormData`をbodyとして渡された際に自動生成するものである。これを`application/json`で上書きすると、バックエンド(FastAPI)がリクエストボディを正しく分割できずパースに失敗する。本章がこのプロジェクト最初の`multipart/form-data`送信(添付ファイルを伴う`POST /api/v1/projects`)であるため、`body instanceof FormData`の場合は`Content-Type`を付与しないよう修正した(rule #17: 実在の消費者による既存コードの修正)。

### `<fieldset><legend>`/`<details><summary>`をネイティブ要素で実装した理由

`docs/external_design.md` 2.3節が明示的に「動的コンボボックスは作らない」「ネイティブ`<fieldset><legend>`/`<details><summary>`を推奨」と定めている。Tamaguiの`Accordion`等を使わずネイティブ要素を選んだのは、開閉状態の管理・キーボード操作・スクリーンリーダーの読み上げをすべてブラウザの標準実装に委譲でき、実装量・a11yバグの両方を減らせるため。

### ファイルバリデーションをクライアント側の純粋関数(`validateFiles`)に切り出した理由

`docs/external_design.md` 2.5節5項のルール(3ファイルまで・5MBまで・txt/md/pdfのみ)をサーバーと同じ基準でクライアント側でも早期に弾く。DOM操作から独立した純粋関数にすることで、`FileUploadField`のレンダリングを介さずルールそのものを単体テストできる(#14: スタブ不要 ── 対象が純粋でDOM/ネットワークに依存しないため)。この検証はUXのための早期フィードバックであり、サーバー側の`TOO_MANY_FILES`/`FILE_TOO_LARGE`/`UNSUPPORTED_FILE_TYPE`判定を置き換えるものではない。

> **後続の改訂**: Phase 3完了後の相談で、`FileUploadField.tsx`を`components/ui/form/FileUpload.tsx`(汎用ベース)+薄いラッパーに分解した。`FileUploadField`/`validateFiles(files)`という公開contractは不変。詳細は[`decision-digest.md`](../decision-digest.md)「Phase 3完了後 ── ファイルアップロードの汎用コンポーネント化」節参照。

### 環境設定の選択肢(言語・フレームワーク・DB・デプロイ環境)を本章で決め打ちした理由

`docs/external_design.md`・`docs/internal_design.md`のいずれにも具体的な選択肢一覧(例のJSONにある`"TypeScript"`/`"FastAPI"`等はあくまでデータ構造の例示)は定められていなかったため、本章の実装判断として一般的な構成(Python/TypeScript/Go/Java、主要フレームワーク、主要DB、主要デプロイ先)を選定した。将来的な拡張(`prompt_templates.default_environment`によるプリフィル、SCR-003)は選択肢を差し替えるだけで対応できる構造にしてある。

### `environment.frameworks`を言語をまたいだ1つのフラット配列にした理由

`docs/external_design.md`のペイロード例(`"frameworks": ["Next.js", "FastAPI"]`)が示すとおり、バックエンドは言語ごとの入れ子構造を求めていない。UI上は言語ごとに`<fieldset>`で視覚的にグルーピングしつつ、フォーム状態としては1つの`react-hook-form`フィールド(`environment.frameworks: string[]`)を複数の`<fieldset>`内`CheckboxGroup`が共有する設計にした。

> **後続の改訂**: `app/projects/new/page.tsx`は元々`"use client"`が無く、実機検証で`TypeError: createReactContext is not a function`が発生した(Server Componentから`tamagui`を直接importできないため)。先頭に`"use client";`を追加して解決した。詳細は[`decision-digest.md`](../decision-digest.md)「Phase 3完了後 ── Server ComponentからTamaguiを直接importできない問題」節参照。

## テスト観点

| ケース | 期待結果 | SUT / ドライバ / スタブ |
|---|---|---|
| `validateFiles`: 3件以内・対応拡張子・5MB以内 | `null`(エラー無し) | SUT: `validateFiles` / ドライバ: 直接呼び出し / スタブ不要 ── 純粋関数のため |
| `validateFiles`: 4件目・非対応拡張子・5MB超過 | それぞれ対応するエラーメッセージ | 同上 |
| `FileUploadField`: ファイル選択 | `onChange`が新しい配列で呼ばれる | SUT: `FileUploadField.tsx` / ドライバ: `render`+`userEvent.upload` / スタブ不要 ── ネットワークを伴わないため |
| `FileUploadField`: 非対応拡張子選択 | エラー表示+`onChange`未呼び出し | 同上 |
| `FileUploadField`: 削除ボタン | 該当ファイルを除いた配列で`onChange` | 同上 |
| `createProject`: 通常送信 | `FormData`に各項目+`environment`(JSON文字列)+`files`が正しく詰まっている | SUT: `createProject.ts` / ドライバ: 直接呼び出し / スタブ: `fetch-stub.ts` |
| `createProject`: `environment`全項目空 | `environment`フィールド自体を送らない | 同上 |
| `IntakeForm`: 必須項目空欄 | バリデーションエラー表示+API未呼び出し | SUT: `IntakeForm.tsx` / ドライバ: `render`+`userEvent` / スタブ: `fetch-stub.ts` |
| `IntakeForm`: 環境設定+ファイル添付を含む送信 | 送信内容が期待通り+作成後`/projects/{id}/chat`へ`router.push` | 同上(`next/navigation`は`vi.mock`) |
| `NewProjectPage` | フォームを表示する | SUT: `page.tsx` / ドライバ: `render` / スタブ不要 |

`npx vitest run src/features/hearing src/app/projects`で12件green、`npx tsc --noEmit`で0エラー、既存テスト全体は145件中144件green(残る1件`Menu.test.tsx`は[`Phase-3-1.md`](./Phase-3-1.md)で確認済みの本Phaseと無関係な既存不具合)を確認した(このセッション内で一時的に`devex-ui`へ反映して検証し、検証後は元の状態に戻した。写経後は各自の環境で再確認すること)。フルスイート実行時はCPU負荷次第で無関係なテストにタイムアウトが発生することがあり(`IntakeForm`の複合操作テストにも予防的に`15000ms`のタイムアウトを設定済み)、単発の失敗は再実行して再現するかどうかで切り分けること。
