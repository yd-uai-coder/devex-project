# Phase-6-4: プロンプトテンプレート選択UI

## この章の目的

[`Phase-6-3.md`](./Phase-6-3.md)で実装したプロンプトテンプレートAPI(`GET /api/v1/prompt-templates`、`POST /projects`の`template_id`)を使い、SCR-003(プロンプト設定・テンプレート選択画面、Should have)のUIを実装する。ヒアリング開始フォーム(`IntakeForm.tsx`)にテンプレート選択欄を追加し、選択したテンプレートの`default_environment`を環境設定欄へプリフィルし、`template_id`をプロジェクト作成時に送信する。

自動実装モード: off([introduction](./Phase-6-introduction.md) 参照)。

サンプルは [`textbook/samples/frontend/`](../samples/frontend/) に追加した。写経前提として[`Phase-3-4.md`](../Phase-3/Phase-3-4.md)(`IntakeForm.tsx`・`schemas.ts`・`createProject.ts`の既存設計)と[`Phase-6-3.md`](./Phase-6-3.md)(本章が呼ぶAPI)の写経が完了していること。

## この章で作成・更新したファイル

写経順序は依存順(CLAUDE.md #30): テストはまとめて表の末尾に置いている。

| ファイル(`devex-ui/`基準) | 新規/更新 | 写経レベル | 責務 |
|---|---|---|---|
| [`src/features/hearing/api/templatesApi.ts`](../samples/frontend/src/features/hearing/api/templatesApi.ts) | 新規 | 定型 | `listPromptTemplates`(`GET /api/v1/prompt-templates`への薄いラッパー) |
| [`src/features/hearing/schemas.ts`](../samples/frontend/src/features/hearing/schemas.ts) | 更新 | 定型 | `intakeSchema`に`templateId`(nullable)を追加 |
| [`src/features/hearing/api/createProject.ts`](../samples/frontend/src/features/hearing/api/createProject.ts) | 更新 | 定型 | `CreateProjectInput`に`templateId`を追加、指定時のみ`template_id`フォームフィールドを送信 |
| [`src/features/hearing/components/TemplateSelectField.tsx`](../samples/frontend/src/features/hearing/components/TemplateSelectField.tsx) | 新規 | **コア** | テンプレート一覧の遅延取得+ラジオボタン選択+`default_environment`のプリフィル値への変換 |
| [`src/features/hearing/components/IntakeForm.tsx`](../samples/frontend/src/features/hearing/components/IntakeForm.tsx) | 更新 | **コア** | `TemplateSelectField`の配線、選択時の環境設定欄への`setValue`反映+自動展開 |
| ── ここからテスト(まとめて末尾) ── | | | |
| [`src/features/hearing/api/__tests__/templatesApi.test.ts`](../samples/frontend/src/features/hearing/api/__tests__/templatesApi.test.ts) | 新規 | 定型 | `listPromptTemplates`のURL確認 |
| [`src/features/hearing/api/__tests__/createProject.test.ts`](../samples/frontend/src/features/hearing/api/__tests__/createProject.test.ts) | 更新 | 定型 | `templateId`指定時/未指定時の送信内容を確認するテストを追加 |
| [`src/features/hearing/components/__tests__/TemplateSelectField.test.tsx`](../samples/frontend/src/features/hearing/components/__tests__/TemplateSelectField.test.tsx) | 新規 | 定型 | 下記テスト観点参照 |
| [`src/features/hearing/components/__tests__/IntakeForm.test.tsx`](../samples/frontend/src/features/hearing/components/__tests__/IntakeForm.test.tsx) | 更新 | 定型 | テンプレート選択→環境設定プリフィル→送信までの統合確認を追加 |

## 設計判断

### なぜテンプレート一覧をZustandストアではなくコンポーネントローカルの状態に置いたか

テンプレート一覧は「ヒアリング開始フォームを開いた瞬間にだけ必要」な表示専用の状態であり、`TemplateSelectField`以外にこの一覧を必要とする消費者は現時点で存在しない。CLAUDE.md #17の判定基準(「この共通化を今駆動している実在の消費者は何か」)に照らし、[`Phase-6-2.md`](./Phase-6-2.md)の`VersionHistoryPanel`と同じ理由でZustandストアへの格上げは見送り、`TemplateSelectField`内の`useState`(`status`/`templates`)に閉じた。

### なぜ「テンプレートを使わない」を選択肢の1つとして扱うか(nullを直接選べるUIにしない理由)

`RadioGroup`は「複数の選択肢から1つを選ぶ」UIであり、「未選択」状態を`RadioGroup`の外に持つ(たとえば選択解除ボタンを別途置く)よりも、「テンプレートを使わない」自体を選択肢の1つとして選べる方がユーザーの操作が単純になる(常にどれか1つが選ばれている状態を保てる)。UUIDと衝突しない固定値`"none"`をこの選択肢の値として使い、`onChange`では`null`に変換して呼び出し側へ伝える。

### なぜテンプレート切替時にenvironmentを「上書き」し、「テンプレートを使わない」への切替時は「そのまま」にするか

[外部設計書](../../docs/external_design.md) 2.3節は「選択したテンプレートの`default_environment`はSCR-004の環境設定にプリフィルされ...ユーザーは編集可能」と定めるのみで、テンプレートを選び直した場合・選択解除した場合の挙動までは規定していない(仕様診断#28で「中程度」に分類した未確定事項)。本章では以下の非対称な方針を採った。

- **テンプレートを選ぶ(切り替えも含む)**: 選択の都度、そのテンプレートの`default_environment`で環境設定欄を**上書き**する。「このテンプレートを選んだら、その用途に合った環境がプリフィルされる」という直感に合わせる。
- **「テンプレートを使わない」に切り替える**: 環境設定欄は**そのまま**にする(クリアしない)。デフォルト値が存在しない以上「何に上書きするか」が無く、ユーザーが既に手で調整した内容を勝手に消すのは驚きが大きいと判断した。

### なぜプリフィル時に環境設定セクションを自動展開するか

環境設定は`CollapsibleSection`(ネイティブ`<details>`)で初期状態は折りたたまれている。テンプレート選択でプリフィルしても、セクションが閉じたままだとユーザーがその変化に気づけず、「テンプレートを選んだのに何も起きていないように見える」という体験になる。`IntakeForm`側に`environmentSectionOpen`という状態を追加し、`TemplateSelectField`の`onChange`が非nullの`environment`を返した場合にのみ`true`にして`CollapsibleSection`の`defaultOpen`へ渡す(`CollapsibleSection`は`open={defaultOpen}`をそのままDOM属性として渡しているため、名前に反して実質的に制御可能である点を利用している)。

## テスト観点

| ケース | 期待結果 | SUT / ドライバ / スタブ |
|---|---|---|
| `listPromptTemplates` | 正しいURL(`/api/v1/prompt-templates`)で呼ぶ | SUT: `templatesApi.ts` / ドライバ: 直接呼び出し / スタブ: `stubFetch` |
| `createProject`: `templateId`指定時/未指定時 | 指定時のみ`template_id`フィールドを送る | SUT: `createProject.ts` / ドライバ: 直接呼び出し / スタブ: `stubFetch` |
| `TemplateSelectField`: 一覧表示 | 取得したテンプレート+「テンプレートを使わない」がラジオボタンとして表示される | SUT: コンポーネント / ドライバ: `render`+`userEvent` / スタブ: `stubFetch` |
| `TemplateSelectField`: 選択 | `templateId`+`default_environment`をキャメルケースへ変換した`EnvironmentValues`を`onChange`へ渡す | 同上 |
| `TemplateSelectField`: 「テンプレートを使わない」への切替 | `onChange(null, null)`を呼ぶ | 同上(テストコンポーネント側は`value`をステートで管理し`onChange`をフィードバックする制御コンポーネントとしてラップしている。下記「写経時の注意点」参照) |
| `TemplateSelectField`: `default_environment`が`null`のテンプレート | `environment`に`null`を渡す | 同上 |
| `TemplateSelectField`: 0件/取得失敗 | 0件なら何も表示しない、失敗時は`role="alert"` | 同上 |
| `IntakeForm`: テンプレート選択→送信 | 環境設定欄がプリフィルされ自動展開され、送信時に`template_id`+プリフィル済み`environment`が送られる | SUT: `IntakeForm` / ドライバ: `render`+`userEvent` / スタブ: `stubFetch`(テンプレート一覧+プロジェクト作成の2レスポンスを順に積む) |

## 動作確認(実施済み)

samples反映後、devex-uiの実環境へ一時的に適用して以下を確認した(検証後は元の状態に復元済み、実プロジェクトへの反映は各自の写経による)。

```bash
npx vitest run src/features/hearing
# 52 passed
npx vitest run
# 39 files / 199 tests passed
npm run lint
# エラーなし
npx tsc --noEmit
# エラーなし
npm run build
# 成功(既存の全ルートが問題なくコンパイル)
```

ブラウザでの実動作確認は今回のセッションでは行っていない(devex-apiのテンプレートseedデータ投入・ログイン済みセッションを要するE2E相当の検証となるため)。ユニットテスト(react-testing-library経由でのDOM操作・アクセシビリティロール確認)と型チェック・ビルド成功までを確認範囲としている。

### 写経時の注意点(このセッションで踏んだハマりどころ)

`TemplateSelectField`は`value`propで選択状態を描画する制御コンポーネント([`Phase-6-2.md`](./Phase-6-2.md)の`VersionHistoryPanel`とは異なり、react-hook-formの`Controller`から直接使われる想定のため)。テストで`value={null}`を固定で渡し続けると、1回目のクリックで内部の`RadioGroup`が視覚的に選択を変えても、再レンダリング時に`value`propが`null`に戻ることで表示上も選択が巻き戻り、2回目のクリック(「テンプレートを使わない」への切替)が「既に選択済みの項目を再度選ぶ」扱いになり`onValueChange`が発火しない、という不具合を踏んだ。テスト側に`useState`で`value`を保持し`onChange`をフィードバックする小さなラッパーコンポーネントを挟むことで解消した(`IntakeForm`本体が`Controller`経由で行っているのと同じ制御パターンをテストでも再現する必要がある)。

## 既知の残課題

- プリフィル後にユーザーが環境設定を手動編集した状態で別のテンプレートへ切り替えた場合、その編集内容は(方針どおり)上書きされる。「一度手で編集したら以後は上書きしない」のような差分保持は仕様診断#28で「軽微」寄りの論点として保留しており、本章では実装していない。
- テンプレートの`system_prompt`本文はSCR-003の画面上には表示していない(選択肢のラベルは`name`+`target_type`のみ)。表示の要否は外部設計書のUI/UX詳細節が未整備なため次回以降の検討事項とする。
