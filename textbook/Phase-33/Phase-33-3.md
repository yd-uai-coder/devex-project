# Phase-33-3: 見本 ── 構造化した要件定義(md)と画面のデモ

## この章の目的

[33-2](./Phase-33-2.md) で決めた形(観点の表・選択肢カード・要件ID と出どころ・外部設計書の一覧・要件から作業単位までの追跡)を、実装の前に見本で確かめる。md の見本は文書の形を、画面のデモは観点の表とカードの操作と完了の判定を示す。題材は [33-1](./Phase-33-1.md) と同じ Devex 自身で、同じペルソナが改良後のヒアリングに答えたら、という想定で書いた。

自動実装モード: on([introduction](./Phase-33-introduction.md) 参照)。

## この章で作成・更新したファイル

md の見本(samples の対象外):

| パス | 中身 |
|---|---|
| [`appendix/structured-requirements-sample/README.md`](../../appendix/structured-requirements-sample/README.md) | 見本の読み方と、CL 教材との対応 |
| [`appendix/structured-requirements-sample/hearing-points.md`](../../appendix/structured-requirements-sample/hearing-points.md) | 観点の定義(規模ごとの必須)・状態・題材の観点の表・選択肢カードの例 |
| [`appendix/structured-requirements-sample/requirements.md`](../../appendix/structured-requirements-sample/requirements.md) | FR/NFR/CON の ID・出どころ・観点の付いた要件定義書 |
| [`appendix/structured-requirements-sample/external_design.md`](../../appendix/structured-requirements-sample/external_design.md) | 画面・API・外部連携の一覧に要件ID を付けたもの |
| [`appendix/structured-requirements-sample/traceability.md`](../../appendix/structured-requirements-sample/traceability.md) | 要件 → 処理 → 作業単位と、WBS の「要件」欄 |

画面のデモ(devex-ui 本体と samples に同じ内容。#30 の依存順):

| ファイル | 責務 |
|---|---|
| [`src/features/hearing-points/demo/hearingPointsModel.ts`](../samples/frontend/src/features/hearing-points/demo/hearingPointsModel.ts) | 観点の定義と、完了の判定・カードの答え・要件の数え方・追跡の純粋関数 |
| [`src/features/hearing-points/demo/demoData.ts`](../samples/frontend/src/features/hearing-points/demo/demoData.ts) | 仮データ(途中の観点の表・カード・要件・段階1の機能・段階7の単位) |
| [`src/features/hearing-points/demo/HearingPointsDemoPageContent.tsx`](../samples/frontend/src/features/hearing-points/demo/HearingPointsDemoPageContent.tsx) | デモ画面(規模・完了の表示・カード・観点の表・要件の一覧・追跡) |
| `src/app/hearing-points-demo/page.tsx`(ステージ6の完了時に削除) | ルート `/hearing-points-demo`(本体は `src/app/(pages)/` 配下) |
| [`src/lib/menu-tree.ts`](../samples/frontend/src/lib/menu-tree.ts) | メニューの「開発用」にデモを足す |
| [`src/features/hearing-points/demo/__tests__/hearingPointsModel.test.ts`](../samples/frontend/src/features/hearing-points/demo/__tests__/hearingPointsModel.test.ts) | 純粋関数のテスト |
| [`src/features/hearing-points/demo/__tests__/HearingPointsDemoPageContent.test.tsx`](../samples/frontend/src/features/hearing-points/demo/__tests__/HearingPointsDemoPageContent.test.tsx) | 画面の操作のテスト |
| `src/app/hearing-points-demo/__tests__/page.test.tsx`(ステージ6の完了時に削除) | ルートのテスト |

## md の見本の要点

- **観点の定義**: 機能面10(規模・目的・利用者・1日の流れ・コア機能・MVP の範囲・例外の場面・将来の拡張・技術スタック・体制)+ 非機能6(IPA の大項目)。列に「個人・小規模 / 社内 / 公開サービス」の必須を持つ。題材(個人)の必須は10観点。
- **題材の観点の表**: ベースラインでは非機能6観点がすべて未決のまま完了したが、見本では可用性・セキュリティ・システム環境が「AI の提案を採用」(カード)、移行性が「対象外」になる。
- **要件定義書**: 見出しは今の 1.1〜1.6 のまま、要件を表の行にした。`NFR-007`(HTTPS)を「推測」の例にした。利用者が言っていないので、検証が確かめるよう促す。
- **外部設計書**: 一覧の部分だけ。API の行に本文・応答・エラーの欄を持たせ、FR-008(再生成)を担う API が無い例を、検証の指摘の例にした。
- **追跡**: ベースラインの段階1(F-01〜F-14)と段階7(M-01-T02〜M-04-T03)に要件ID を手で当てた。FR-009(途中の失敗)を担う処理が無いことが、段階1の検証の指摘として出る。

## デモの要点

### `hearingPointsModel.ts`(意味モデルと純粋関数)

- 型: `Scale`(`personal`・`internal`・`public`)、`PointKey`(16観点)、`PointStatus`(`decided`・`adopted`・`open`・`not_applicable`)、`PointDef`(`required: Record<Scale, boolean>`)、`PointState`(`summary`・`evidence`)。
- `POINT_DEFS`: 観点の定義の表。技術スタックは全規模で必須、体制・期間は全規模で任意。本実装でも、観点の定義はコードに持つ(33-2 決定1の補足)。
- `openRequired(states, scale)`・`isSufficient(states, scale)`: 必須で未決の観点と、完了の判定。**対象外も未決以外として数える**ので、必須を広く取っても利用者が「要らない」と決めれば済む。
- `answerByCard`(→ `adopted`)・`answerByText`(→ `decided`。空なら変えない)・`nextCard`(未決の観点のカードのうち、必須を先に)。
- `Requirement`(`id`・`kind`・`priority`・`source`・`point`)、`countBySource`、`trace`(機能要件 → 段階1の `reqIds` → 段階7の `functionIds` から単位を導く)、`traceIssues`(処理の無い Must = 中程度、要件の無い処理・要件定義書に無い要件ID = 軽微)。

### `demoData.ts`

- 観点の表はヒアリングの途中から始める(例外の場面・可用性・セキュリティ・運用・保守性・システム環境が未決)。カードは5枚(可用性・セキュリティ・例外の場面・システム環境・運用・保守性)。
- 段階1の機能に、要件の無い `F-15 管理者の利用統計` を置き、追跡の軽微な指摘が出るようにした。

### `HearingPointsDemoPageContent.tsx`

- 上から: 規模の切り替え(`aria-pressed`)・完了の表示(`role="status"`。未決の必須の観点を並べる)・カード(選択肢のボタン、結果、おすすめのバッジ、自分の言葉で答える欄)・観点の表・要件の一覧(出どころの件数)・要件からの追跡と指摘。
- 答えるたびに発言の番号を進め、根拠の欄に「カード(発言5)」「発言6」と残す。
- デモはカードを1枚ずつ順に出す。サーバーと通信しないので、LLM の回し方は示さない。本実装はカードを数枚まとめて出し、全部答えたら判定と返信を1回だけ回す([33-2](./Phase-33-2.md) 決定5の補足)。まとめて出す UI は Phase 35 で作る。

## テスト観点

用語: SUT = テストの対象、ドライバ = SUT を呼ぶ側(テスト関数)、スタブ = SUT が呼ぶ相手の代わり(テストダブル)。

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `hearingPointsModel.test.ts` | `hearingPointsModel.ts` の純粋関数(定義と規模、完了の判定、カードの答え、次のカード、出どころの数え方、追跡と指摘) | テスト関数(仮データ `demoData.ts` を入力に呼ぶ) | 不要 ── 対象が純粋(副作用なし)で外部依存を呼ばないため |
| `HearingPointsDemoPageContent.test.tsx` | デモ画面(カードを選ぶ・自分の言葉で答える → 観点の表と完了の表示が変わる。規模を変えると必須が増える。出どころの件数と追跡の指摘) | Testing Library の `render` と `userEvent` | 不要 ── 画面は仮データだけを使い、サーバーと通信しないため |
| `page.test.tsx` | ルートがデモの本体を描くこと | Testing Library の `render` | 本体の部品をモック(ルートの責務は本体を置くことだけなので、本体の中身から切り離す) |

確かめること:

- 個人・小規模では、任意の観点(運用・保守性・システム環境)が未決のままでも完了する。社内に変えると、その2つが必須になって未完了に戻る。
- 対象外は未決以外として数える(必須でも「対象外」と決めれば完了できる)。
- カードの選択肢 → 「AI の提案を採用」、自分の言葉 → 「ユーザーが決定」。空の答えでは状態を変えない。
- 処理の無い Must の機能要件(FR-009)を中程度で、要件の無い処理(F-15)と要件定義書に無い要件ID を軽微で指摘する。

この章が作成・更新したファイルは、すべてテストが import する(`hearingPointsModel.ts`・`demoData.ts` はモデルのテスト、`HearingPointsDemoPageContent.tsx` は画面のテスト、`page.tsx` はルートのテスト)。`menu-tree.ts` は、既存のレイアウトのテスト(`src/components/layout/__tests__/`)が `HierarchicalMenu.tsx` を通して読む(Phase 25-2 と同じ)。
