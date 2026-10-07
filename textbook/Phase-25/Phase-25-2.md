# Phase-25-2: 実装手順書の見本(md)と画面のデモ

## この章の目的

[25-1](./Phase-25-1.md) で決めた形(段階7の縦割りの単位・段階8・2層のチェック・AI 向けの展開)で、実装手順書の見本を作り、生成機能を作る前に形を確かめる。題材は、ゴール3で Devex 自身を題材に生成した段階1〜7([`appendix/goal3-generated/detailed/`](../../appendix/goal3-generated/README.md))である。md の見本と、同じ中身を画面で操作できるデモの2つを作る(ユーザー決定)。

自動実装モード: on([introduction](./Phase-25-introduction.md) 参照)。

## この章で作成・更新するファイル

| ファイル | 種類 |
|---|---|
| [`appendix/implementation-procedure-sample/`](../../appendix/implementation-procedure-sample/README.md) 一式 | md の見本(文書のため #13/#15/#30 の対象外) |
| [`features/implementation-procedure/demo/procedureDocModel.ts`](../samples/frontend/src/features/implementation-procedure/demo/procedureDocModel.ts) | 新規 |
| [`features/implementation-procedure/demo/demoData.ts`](../samples/frontend/src/features/implementation-procedure/demo/demoData.ts) | 新規 |
| [`features/implementation-procedure/demo/ImplementationProcedureDemoPageContent.tsx`](../samples/frontend/src/features/implementation-procedure/demo/ImplementationProcedureDemoPageContent.tsx) | 新規 |
| [`app/implementation-procedure-demo/page.tsx`](../samples/frontend/src/app/implementation-procedure-demo/page.tsx) | 新規 |
| [`lib/menu-tree.ts`](../samples/frontend/src/lib/menu-tree.ts) | 更新 |
| [`features/implementation-procedure/demo/__tests__/procedureDocModel.test.ts`](../samples/frontend/src/features/implementation-procedure/demo/__tests__/procedureDocModel.test.ts) | 新規 |
| [`features/implementation-procedure/demo/__tests__/ImplementationProcedureDemoPageContent.test.tsx`](../samples/frontend/src/features/implementation-procedure/demo/__tests__/ImplementationProcedureDemoPageContent.test.tsx) | 新規 |
| [`app/implementation-procedure-demo/__tests__/page.test.tsx`](../samples/frontend/src/app/implementation-procedure-demo/__tests__/page.test.tsx) | 新規 |

コードは devex-ui の本体(`src/` 配下。ページは `src/app/(pages)/implementation-procedure-demo/`)と samples の両方に置いた(#21 on)。[Phase 14](../Phase-14/Phase-14-introduction.md) のデモは本体だけに置いたが、ステージ4完了後のルール改訂で、on でも samples を作ることになったため。

## md の見本

[`appendix/implementation-procedure-sample/`](../../appendix/implementation-procedure-sample/README.md) に置いた。Claude が手で書いた(LLM の出力ではない)。

- [`stage7-recut.md`](../../appendix/implementation-procedure-sample/stage7-recut.md): 決定1で改修した後の段階7。M-01〜M-04 を、機能の単位11・基盤の単位2(全13単位、ID `M-01-T01`…、単位の間の依存つき)に組み替えた。ファイルの欄は「モジュール(段階4のパス)」と「環境・設定のファイル(例)」に分けた。
- [`implementation_procedure/index.md`](../../appendix/implementation-procedure-sample/implementation_procedure/index.md): 実装概要・実装前提(実装ルールは段階4・07章から引く)・単位の一覧(依存順)・未定義の一覧・完了条件。本実装では決定論的に組み立てる。
- 単位の md を3つ: 基盤の単位(M-01-T01)、段階5・6の無い処理の単位(M-01-T02。参照が薄く、未定義が多い)、段階5・6のある処理の単位(M-03-T01。参照が厚い)。
- [`implementation_procedure/ai/M-03-T01.md`](../../appendix/implementation-procedure-sample/implementation_procedure/ai/M-03-T01.md): AI 向けの版。人向けの md と同じ中身に、参照する設計(段階5 F-07・段階6 L-01・段階4・07章)を展開して添えた(決定6)。

**見本を書いて見つかったこと**: 題材の設計に、手順書を作ろうとして初めて表に出る穴が6つあった(段階3のテーブル0件、チャット履歴の保存が手順に無い、LangGraph をどこが持つかの食い違い、L-01 に F-08 の責務が混ざる、フロントエンドのファイルが決まらない、認可が無い)。加えて、段階5の F-07#1 の分岐「3a へ」の行が無いことも見つかった。作成方針4章の「手順書の生成は、設計の実装可能性の検証でもある」を、実例で確かめられた。詳しくは見本の [README](../../appendix/implementation-procedure-sample/README.md)。

## 各ファイルの解説

### `procedureDocModel.ts` ── 意味モデルと純粋関数

- 責務: 手順書の単位・指摘・参照の型と、並べ替え・集計・参照の解決と展開・md の組み立てを行う純粋関数。
- 型: `Unit`(`id`・`kind`(機能/基盤)・`functionIds`・`dependsOn`・`detail`)。`detail` が `null` の単位は未生成。`UnitDetail` は手順書の中身(目的・参照・ファイル・要点・テスト観点・確認方法)。`Finding` は指摘1件(`severity`・`source`(検証/AI)・`unitId`(null は全体)・`target`・`message`・`stage`(直す先の段階))。
- **参照は `DesignRef`(`kind` と `key`)だけを持つ**。中身は `DesignSources` から引く。手順書が設計を書き写さない(原則7)ことを、型で表した。
- `sortUnitsByDependency`: 元の並び(段階7の並び順)を前から見て、依存先がそろった単位から取ることを繰り返す。一覧に無い依存先と循環を `issues` に出す(段階7の決定論的な検証の候補)。
- `unresolvedRefs`: 設計に無い参照(例: 段階5で選んでいない F-01)を返す。決定論的なチェックの一部。
- `expandRef`: 参照1つを md に展開する。画面の展開と AI 向けの出力で共有する(決定10の「単位が参照する箇所だけを LLM に渡す」も、本実装ではこの部品を使う)。
- `toUnitMarkdown`(人向け。参照は ID だけ)と `toAiMarkdown`(参照を展開し、未定義が残っていれば先頭で警告)。中身は同じで、違うのは参照を展開するかだけ(実装者で中身を変えない)。

### `demoData.ts` ── 仮データ

- 責務: md の見本と同じ中身の単位・指摘と、ゴール3の生成物から書き写した設計(`DEMO_SOURCES`: F-07・L-01・段階4の12モジュール・07章の6項目・開発環境)。
- 単位の詳細は3つだけ持ち、他の10単位は未生成(`detail: null`)にした。

### `ImplementationProcedureDemoPageContent.tsx` ── デモ画面

- 責務: 段階8の画面の見せ方の提案。上から、単位の一覧(依存順)・全体の未定義の一覧・選んだ単位の詳細。
- 単位の一覧: 未生成の単位にチェックを付け、「選んだ単位を生成する(N/5)」で生成する(決定4。デモでは案内を出すだけ)。5件を超えるチェックは付かない。生成済みの単位には、未定義の数を重要度ごとに出す。
- 未定義の一覧: 重要度で絞り込める。行ごとに「段階Nで直す」「AI に提案を求める」を置く(決定3。デモでは案内を出すだけ)。
- 単位の詳細: 参照のバッジを押すと設計の中身を展開する。設計に無い参照は赤字で押せない。「AI 向けにコピー」は `toAiMarkdown` をクリップボードに書き、残っている未定義の数を出す。「md をダウンロード」は人向けの md。
- 表の見た目は段階の作業領域と同じ `tableStyles`(`CELL`・`HEAD`・`TABLE`・`MONO`・`BADGE`)を使う。

### `page.tsx`・`menu-tree.ts`

- `page.tsx`: ログイン不要のルート。Tamagui を使う本体は Client Component に委ねる(Server Component から tamagui を import できないため)。
- `menu-tree.ts`: 「開発用」グループに「実装手順書デモ」を足した(Phase 24 の後に消したグループを、このデモのために戻した)。

## テスト観点

用語: SUT = テスト対象、ドライバ = SUT を呼び出すもの、スタブ = SUT が依存する相手の代役。

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `procedureDocModel.test.ts` | 並べ替え・集計・参照の解決と展開・md の組み立て | vitest | スタブ不要 ── 対象が純粋関数で、外部依存を呼ばないため。デモのデータそのものも入力に使い、循環が無いこと・展開の中身を確かめる |
| `ImplementationProcedureDemoPageContent.test.tsx` | デモ画面 | vitest + Testing Library(操作は user-event) | `navigator.clipboard.writeText` を spy で差し替え(ブラウザのクリップボードに依存しないため)。データは本物の `demoData` |
| `page.test.tsx` | ルート | vitest + Testing Library | デモ本体をモック(ルートが本体を描くことだけを見るため) |

- 依存順: 依存先がそろったものから元の順で取ること、一覧に無い依存先・循環の指摘、デモのデータで全単位が依存先より後ろに来ること。
- 参照: F-01 が設計に無いと分かり、展開が `null` になること。F-07 の手順(分岐の行を含む)と L-01 の項目・疑似コードが md に展開されること。
- md: 人向けは参照を展開しないこと。AI 向けは展開し、未定義が残っていれば先頭で警告すること(0件なら警告なし)。未生成の単位は、人向けは見出しだけ、AI 向けは空。
- 画面: 依存順の並び・初期表示の単位、参照の展開と押せない参照、5件までの選択、重要度での絞り込みと「段階Nで直す」の案内、AI 向けのコピーと残りの未定義の表示。

全ファイルの import: 3つのテストで、この章で作成・更新した全ファイルを import している(`menu-tree.ts` は既存の `components/layout` のテストが import する)。
