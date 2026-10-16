# Phase-67-4: マイページのモデルと API キーの節

## この章の目的

マイページ(SCR-009)の「アカウント」の後に、用途ごとのモデルを選ぶ「モデル」の節と、provider ごとの API キーを登録する「API キー」の節を足す。AI を選ぶとモデルの選択肢が変わり、選べない AI は理由を出して無効にする。判定には費用の低いモデルを推奨する注記を出す。

自動実装モード: on([introduction](./Phase-67-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`src/features/mypage/api/llmSettingsApi.ts`](../samples/frontend/src/features/mypage/api/llmSettingsApi.ts) | 新規 | 型と6つの API の呼び出し・エラーの code |
| [`src/features/mypage/model-draft.ts`](../samples/frontend/src/features/mypage/model-draft.ts) | 新規 | 編集中の値の純粋な関数(`toDraft`・`changeChoice`・`changeModel`・`modelsOf`・`toChoices`) |
| [`src/features/mypage/components/ModelSection.tsx`](../samples/frontend/src/features/mypage/components/ModelSection.tsx) | 新規 | 「モデル」の節 |
| [`src/features/mypage/components/ApiKeySection.tsx`](../samples/frontend/src/features/mypage/components/ApiKeySection.tsx) | 新規 | 「API キー」の節 |
| [`src/app/mypage/page.tsx`](../samples/frontend/src/app/mypage/page.tsx) | 更新 | 2つの節を足し、キーの変更でモデルの節を読み直す |
| [`src/features/mypage/test-utils/llmFixtures.ts`](../samples/frontend/src/features/mypage/test-utils/llmFixtures.ts) | 新規 | カタログと設定の見本(テスト用) |
| [`src/features/mypage/__tests__/model-draft.test.ts`](../samples/frontend/src/features/mypage/__tests__/model-draft.test.ts) | 新規 | 編集中の値 |
| [`src/features/mypage/api/__tests__/llmSettingsApi.test.ts`](../samples/frontend/src/features/mypage/api/__tests__/llmSettingsApi.test.ts) | 新規 | メソッド・パス・本文 |
| [`src/features/mypage/components/__tests__/ModelSection.test.tsx`](../samples/frontend/src/features/mypage/components/__tests__/ModelSection.test.tsx) | 新規 | 出し分けと保存 |
| [`src/features/mypage/components/__tests__/ApiKeySection.test.tsx`](../samples/frontend/src/features/mypage/components/__tests__/ApiKeySection.test.tsx) | 新規 | 登録・失敗・鍵なし・削除 |
| [`src/app/mypage/__tests__/page.test.tsx`](../samples/frontend/src/app/mypage/__tests__/page.test.tsx) | 更新 | 3つの節が出る |

本体のページは `src/app/(pages)/(protected)/mypage/` にある(samples は route group を省く)。

## 1. 編集中の値(`model-draft.ts`)

```ts
// src/features/mypage/model-draft.ts(要点)
export type ModelDraftEntry = { choice: "default" | Provider; model: string };
export type ModelDraft = Record<Purpose, ModelDraftEntry>;

export function changeChoice(draft, setting, choice, catalog): ModelDraft
// provider を替えたら、モデルを替えた先の provider のものに(既定値と同じ provider なら既定のモデル、
// ほかは一覧の先頭)。同じ provider ならモデルを保つ。default なら既定のモデル
export function toChoices(draft): ModelChoice[]   // 既定に従う用途は含めない
```

切り替えの規則を部品から外し、純粋な関数にしてテストする(部品のテストは表示と API の呼び出しに絞る)。

## 2. 「モデル」の節(`ModelSection.tsx`)

- 開いたときにカタログと今の設定を並行して読む。`reloadKey` が変わったら読み直す(ページが API キーの変更で増やす)。
- 用途ごとの枠に、名前・説明・(判定だけ)「呼ぶ回数が多いので、費用の低いモデル(Claude Haiku など)を推奨します。」、ラジオ「既定に従う({AI} / {モデル})」「Gemini」「Claude」。
- `selectable_providers` に無い AI のラジオは無効にし、「{AI} を選ぶには、下の「API キー」で {AI} のキーを登録してください。」(完了後の調整で「「API キー」の節で」に改めた)と出す。`key_missing` なら「{AI} のキーが無いので、使うときは既定({モデル})に従います。」。
- AI を選ぶと、その AI のモデルの選択欄(「{表示名} ── {注記}」)を出す。**ブラウザ標準の `<select>`** にした(作業中の判断。計画では `SelectGroupWithLabel` だったが、Tamagui の Select は jsdom でテストしにくく、詳細設計の表と同じく標準の選択欄で足りる)。背景はテーマの色にする(ダークモードで選択肢が読めなくなるのを避ける。詳細設計の表と同じ)。
- 4用途をまとめて「モデルを保存する」。成功はトースト「モデルを保存しました」、失敗は節の中にメッセージ。
- 幅 375px では、長い「既定に従う(…)」のラベルが折り返し、選択欄が枠に収まるよう、ラジオの各項目とラベルに `flexShrink`・`minWidth: 0` を持たせた(作業中に、ブラウザでの確認で枠からはみ出したのを直した)。

## 3. 「API キー」の節(`ApiKeySection.tsx`)

- provider ごとの枠に「登録済み(末尾 …{4文字})」か「未登録」、キーの欄(`InputPassword`。伏せ字)、「{AI} のキーを保存する」、登録済みなら「削除」(`ConfirmDialog` で確かめる)。
- 保存の失敗: `API_KEY_INVALID` は欄に「APIキーが正しくありません」。それ以外(502・429 など)はサーバーの文言を枠の中に出す。保存中のボタンは「確かめています...」(外部を呼ぶので数秒かかりうる)。
- `encryption_available` が偽なら、節の上に理由を出し、保存のボタンと欄を無効にする。`needs_reregister` なら「サーバーの暗号の鍵が替わったため、このキーを読めません。登録し直してください。」。
- 登録・削除が成功したら、一覧を読み直して `onChanged` を呼ぶ。

## 4. ページ(`page.tsx`)

```tsx
// src/app/mypage/page.tsx(要点)
const [modelReloadKey, setModelReloadKey] = useState(0);
<AccountSection />
<ModelSection reloadKey={modelReloadKey} />
<ApiKeySection onChanged={() => setModelReloadKey((key) => key + 1)} />
```

キーを登録すると選べる AI が変わるので、モデルの節を読み直す。節どうしを状態の置き場(ストア)でつながず、ページが鍵を1つ持つだけにした(マイページの外で使わないため)。

## テスト観点

| テスト | SUT | ドライバ | スタブ | 観点 |
|---|---|---|---|---|
| `model-draft.test.ts` | `model-draft` の5つの関数 | 各テスト | スタブ不要 ── 対象が純粋(副作用なし)で外部依存を呼ばないため | 既定に従う用途は保存に含めない / provider を替えるとその provider のモデルへ、同じ provider ならモデルを保つ / default で既定のモデル / provider で絞る |
| `llmSettingsApi.test.ts` | 6つの呼び出し | 各テスト | fetch(`stubFetch`) | メソッド・パス・本文 / 設定の応答から `settings` を取り出す |
| `ModelSection.test.tsx` | `ModelSection` | 各テスト(描画と操作) | fetch(`stubFetch`)・トースト(`vi.mock`) | 既定が選ばれ、キーの無い AI は無効で理由が出る / 判定に低費用の注記 / AI とモデルを選んで保存すると選んだ用途だけを送りトースト / `key_missing` の知らせ / 保存の失敗のメッセージ |
| `ApiKeySection.test.tsx` | `ApiKeySection` | 各テスト(描画と操作) | fetch(`stubFetch`)・トースト(`vi.mock`) | 末尾の4文字・未登録・登録し直しの促し / 保存で前後の空白を落として送り、トーストと `onChanged`・表示の更新 / 無効は欄、確かめられないはメッセージで `onChanged` を呼ばない / 鍵が無いと理由が出てボタンが無効 / 削除は確かめてから |
| `page.test.tsx` | マイページ | 各テスト(描画) | fetch(`stubFetch`)・`next/navigation`(`vi.mock`) | ログイン済みなら3つの節(アカウント・モデルの保存・キーの保存のボタン)/ 未ログインでは読みに行かない |

`llmFixtures.ts` は部品とページのテストが import する(テスト用の見本。この章の作成物)。

## 完了後の調整: 3つの節を排他のアコーディオンに

マイページが縦に長くなったため、ユーザーの指示で「アカウント」「モデル」「API キー」の3つの節を、1つを開くとほかが閉じるアコーディオンにした(#38)。

| ファイル | 内容 |
| --- | --- |
| [`src/components/ui/layout-blocks/AccordionInner.tsx`](../samples/frontend/src/components/ui/layout-blocks/AccordionInner.tsx) | 項目の `flex` を渡せるようにした(既定は今までの `1`。テンプレート由来で、samples に初めて載せた) |
| [`src/app/mypage/page.tsx`](../samples/frontend/src/app/mypage/page.tsx) | `Accordion type="single" collapsible` に `AccordionInner` を3つ。初めは `account` |
| [`AccountSection.tsx`](../samples/frontend/src/features/mypage/components/AccountSection.tsx)・[`ModelSection.tsx`](../samples/frontend/src/features/mypage/components/ModelSection.tsx)・[`ApiKeySection.tsx`](../samples/frontend/src/features/mypage/components/ApiKeySection.tsx) | 節の見出し `H3` を外した(アコーディオンの見出しと重なるため)。`ModelSection` の `reloadKey`、`ApiKeySection` の `onChanged` を外した。選べない AI の文言を「「API キー」の節で」に |
| [`page.test.tsx`](../samples/frontend/src/app/mypage/__tests__/page.test.tsx)・[`ApiKeySection.test.tsx`](../samples/frontend/src/features/mypage/components/__tests__/ApiKeySection.test.tsx)・[`ModelSection.test.tsx`](../samples/frontend/src/features/mypage/components/__tests__/ModelSection.test.tsx) | 開閉(`aria-expanded`)と、開いた節だけを読むこと / `onChanged` の代わりに一覧の読み直し / 文言 |

```tsx
// src/app/mypage/page.tsx(要点)
const [openSection, setOpenSection] = useState("account");
<Accordion type="single" collapsible value={openSection} onValueChange={setOpenSection} gap="$3">
  <AccordionInner value="account" title="アカウント" title_size="$6" flex="unset">
    <AccountSection />
  </AccordionInner>
  ...(models・api-keys)
</Accordion>
```

- **閉じた節の中身は外れる**: 計画では「`HeightAnimator` が中身をマウントしたままにする」と見込んだが、jsdom とブラウザの両方で、閉じた節の中身はマウントされなかった(開いた節の API だけが呼ばれた)。そのため各節は開くたびに読み直す。これで、API キーの節で登録・削除した後にモデルの節を開けば選べる AI が新しくなるので、節どうしをつないでいた `reloadKey`・`onChanged` は要らなくなり、外した。代わりに、閉じると保存していない編集は消える。
- **`AccordionInner` の `flex`**: 既定の `flex={1}` は横に並べるデモ(`AccordionExclusive`)のためのもの。縦に並べると `flex-basis: 0` で項目の高さが潰れ、3つの見出しが同じ位置に重なった(ブラウザで確かめた)。項目の `flex` を渡せるようにし、マイページは `"unset"` にした。
- 中身の余白は `Accordion.Content` の既定(`$true`)に任せた。ページ側で余白を足すと、幅 375px でアカウントのボタンの文字が切れた。

テスト観点(`page.test.tsx`。SUT はマイページ、ドライバは描画と見出しの操作、スタブは fetch(`stubFetch`)と `next/navigation`): 初めはアカウントだけが開き、ほかの節の API は呼ばない / モデルを押すとモデルが開きアカウントが閉じ、モデルの節を読む / API キーを押すとモデルが閉じる / 開いた節を押すとすべて閉じる。`AccordionInner.tsx` はページのテストが描画を通して import する。
