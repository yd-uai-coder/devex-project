# Phase-14-2: 05・06章の見せ方と出力形式(デモページ)

## この章の目的

未決事項8(05「主要処理の手順」が複数あるときの見せ方)と9(06「処理ロジックの詳細」が05のどの手順に紐づくかと、その見せ方)について、Claude の提案を devex-ui のデモページ `/detailed-design-demo` で動かし、ユーザーが操作して確定した。あわせて、詳細設計書をファイルへ出力する形式を決めた。

自動実装モード: on([introduction](./Phase-14-introduction.md) 参照)。

## この章で作成・更新したファイル

devex-ui 本体に直接作成した(`/uml-demo` と同じ開発用のページ。`textbook/samples/` の対象外で、写経しない)。依存順(#30)に並べる。

| ファイル | 責務 |
|---|---|
| `src/features/detailed-design/demo/procedureModel.ts`(新規) | 05・06章の意味モデルの型(`Step`・`Procedure`・`LogicSpec`)と、そこから導く表・出力を組み立てる純粋関数 |
| `src/features/detailed-design/demo/demoData.ts`(新規) | 仮データ「備品予約システム」(処理 F-01・F-03・F-05、関数 L-01〜L-03) |
| `src/features/detailed-design/demo/DetailedDesignDemoPageContent.tsx`(新規) | デモ画面(Client Component) |
| `src/app/(pages)/detailed-design-demo/page.tsx`(新規) | ルート。画面を Client Component に委ねるだけ |
| `src/lib/menu-tree.ts`(更新) | 「開発用」グループに「詳細設計 05・06章デモ」を追加 |
| `src/features/detailed-design/demo/__tests__/procedureModel.test.ts`(新規) | 純粋関数のテスト |
| `src/features/detailed-design/demo/__tests__/DetailedDesignDemoPageContent.test.tsx`(新規) | 画面のテスト |
| `src/app/(pages)/detailed-design-demo/__tests__/page.test.tsx`(新規) | ルートのテスト |

## 決定: 05章(未決事項8)

- **索引**: 章の冒頭に、手順を書いた処理の一覧を置く(処理ID/名称/トリガー/選定理由/手順数/紐づく06の項目)。「選定理由」の列で、「重要な部分だけ書く」原則の説明を残す。
- **処理 × モジュールの関与表**: CRUD図と同じ格子で、セルにはそのモジュールが呼ばれる手順番号を入れる。複数の処理が同じモジュールを通る箇所(例: `repositories/reservation`)が一目で分かる。列は段階4のモジュール一覧のパスだけにし、利用者・スケジューラなどの外部の役者は除く。
- **タブ**: 処理ごとの手順はタブで切り替える。件数が増えても縦に長くならない。

## 決定: 06章と05の紐づけ(未決事項9)

- **手順ID**: `F-01#4`(処理ID と手順番号の組。分岐は `F-01#4a`)。文書全体で一意にする。
- **双方向のバッジ**:
  - 05の行には「処理内容」の下に「詳細 L-02 ↓」を付ける。合意済みの7列は変えない。
  - 06の見出しの下には「呼ばれる手順 ↑ F-01#4 / ↑ F-05#5」を付ける。
  - どちらも、押すと相手側のタブへ切り替えてその位置へ移り、強調する。
- **逆引き表**: 06の冒頭に、L-ID/関数/モジュール/呼ばれる手順の表を置く。L-02(`count_overlapping`)のように、1つの関数が複数の処理から呼ばれることが分かる。
- **06もタブ**: ユーザーの指摘で追加した。05と同じく、関数ごとのタブで1件だけを表示する。
- **正本は1か所**: 紐づけは、手順の行が持つ `logic`(L-ID)だけに持つ。06の「呼ばれる手順」・索引の「詳細(06)」・逆引き表・関与表は、すべて `buildReverseIndex`・`buildInvolvement` で導く。06に無い L-ID を参照していないかは `findDanglingLogicRefs` で検出する。

## 決定: 出力形式(HTML+md の zip)

最初のデモは md のみを出力し、`<a id="f-01-4"></a>` のアンカーとリンクを書いていた。ユーザーが md ビューワーに貼って試したところ、**リンクで該当箇所へ飛ばなかった**。

- **原因**:
  - `<a id>` は生の HTML で、多くの md ビューワーは生の HTML を捨てるか `id` を消す。Devex 自身のプレビュー(react-markdown。Phase 13 で XSS を避けるため `rehype-raw` を入れていない)でも同じく消える。
  - 見出しから作る自動アンカーは、日本語の見出しだとビューワーごとに ID の作り方が違う。表の行には付けられない。
- **決定**(ユーザーが「HTML+md の zip」を選択):
  - **HTML(読む用)**: 自己完結の単一ファイル。CSS とスクリプトを中に持ち、外部を読み込まない。画面と同じタブと双方向のリンクを持つ。スクリプトは `hashchange` を受けて該当するタブを開き、行を強調する。スクリプトが無効でも、全件を並べて表示しアンカーで飛べる。文字はすべて `escapeHtml` で実体参照にする。
  - **md(差分・AI への入力用)**: リンクと生の HTML を持たない。「→ 詳細: L-02」「呼ばれる手順: F-01#4, F-05#5」のように、ID を本文に書くだけにする。
  - **図ファイル**: ステージ3の SVG・drawio の出力を再利用する。
- 本実装では、HTML・md の組み立てをバックエンド(ステージ3の zip 出力と同じ層)へ移す。デモの `toHtml`・`toMarkdown` は形式の見本である。

## 各ファイルの要点(#13)

- `procedureModel.ts`(写経レベル: コア。05・06章の設計判断を体現する)
  - `stepId(ref)` → `F-01#4`、`stepAnchor(ref)` → HTML の要素 id `f-01-4`(URL の `#` と衝突しないよう `#` を `-` にする)。
  - `buildReverseIndex(procedures): Map<L-ID, StepRef[]>`、`buildInvolvement(procedures)`(`isModule` でモジュールだけを列にする)、`findDanglingLogicRefs(procedures, logics)`、`mainStepCount`(分岐を数えない)。
  - `toMarkdown(procedures, logics)`: リンク無しの md。`toHtml(procedures, logics, title?)`: 自己完結の HTML。
- `demoData.ts`(写経レベル: 定型)。分岐の行(`isBranch`)は、`action` に条件、`branch` に結果を書く。
- `DetailedDesignDemoPageContent.tsx`(写経レベル: 定型)
  - `selected`(処理のタブ)・`selectedLogic`(関数のタブ)・`focus`(強調する行か関数)を state に持つ。
  - `openStep`・`openLogic` は、タブを切り替えてから `focus` を変え、`useEffect` で `scrollIntoView` する。
  - ダウンロードは既存の `saveFile`(`src/lib/api/download.ts`)を使う。
- `page.tsx`・`menu-tree.ts`(写経レベル: 定型)。`/uml-demo` と同じ形。

## テスト観点

用語: SUT はテスト対象、ドライバはテストから SUT を呼ぶ側、スタブ(テストダブル)は SUT が依存する相手の代役。

- `procedureModel.test.ts`: SUT は純粋関数群、ドライバは Vitest。**スタブ不要 ── 対象が純粋(副作用なし)で外部依存を呼ばないため**。
  - 逆引きの並び順、分岐と外部の役者を関与表から除くこと、参照切れの検出。
  - md にリンク・生の HTML が無いこと。
  - HTML の id とリンク・エスケープ・スクリプトが1つだけで外部を読み込まないこと。
- `DetailedDesignDemoPageContent.test.tsx`: SUT は画面、ドライバは Testing Library(+user-event)。
  - `saveFile` はスパイでスタブにする(ダウンロードという副作用を持つため)。
  - 06のタブの切り替え、05のバッジ・逆引き表のバッジで06のタブが替わること、06の「呼ばれる手順」で05のタブが替わること、両方のダウンロード。
- `page.test.tsx`: SUT はルート、画面本体はモックでスタブにする(ルートが委ねるだけであることを確かめる)。
- 全ファイルをいずれかのテストが import している(#15)。`menu-tree.ts` は、既存の `Menu.test.tsx` が `Menu` 経由で import する。
