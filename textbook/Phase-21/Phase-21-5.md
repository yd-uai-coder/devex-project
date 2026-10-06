# Phase-21-5: 段階6の編集操作と、05↔06 の紐づけの導き方(FE)

## この章の目的

段階6の画面で使う純粋関数をまとめる。関数の候補・呼ばれる手順・逆引き・「手順 → L-ID」の引き当てを、段階5の手順と段階6の詳細から導く。編集操作(関数の選択、詳細の欄・擬似フローの段の編集)も、新しいモデルを返す純粋関数にする。

自動実装モード: on([introduction](./Phase-21-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-ui/src/features/detailed-design/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`logicOps.ts`](../samples/frontend/src/features/detailed-design/logicOps.ts) | 新規 | **コア** | `toLogics`・`logicId`・`logicKey`・`keyOf`・`isDrafted`・`pendingLogics`・`logicCandidates`・`callingSteps`・`logicIdsByKey`・`buildReverseIndex`・`toggleLogic`・`updateLogic`・擬似フローの段の追加/更新/削除・`subToText`/`textToSub`(すべて純粋) |
| ── ここからテスト ── | | | |
| [`__tests__/logicOps.test.ts`](../samples/frontend/src/features/detailed-design/__tests__/logicOps.test.ts) | 新規 | **コア** | 上の各関数 |

## 要点の抜粋

```ts
// logicOps.ts
export function logicId(index: number): string;               // 0 → "L-01"(バックエンドの logic_id と同じ)
export function logicKey(module: string, fn: string): string; // "module::function"(logic_key と同じ)
export function logicCandidates(procedures: ProcedureModel): LogicCandidate[];
  // 段階5の手順の (callee, call) ごとに、呼ぶ手順ID を集める。分岐・外部の役者・空の関数は除く
export function callingSteps(procedures, module, fn): string[];    // 06 の「呼ばれる手順」
export function logicIdsByKey(model: LogicModel): Map<string, string>;  // 鍵 → L-ID(05 の詳細バッジ。21-8)
export function buildReverseIndex(model, procedures): ReverseRow[];     // 逆引き(L-ID/関数/モジュール/呼ばれる手順)
export function toggleLogic(model, candidates, target, checked): LogicModel;  // 候補の順に並べる
export function subToText(sub: string[]): string;    // 下位の箇条は 1行1箇条で入力する
export function textToSub(text: string): string[];
```

依存の向きは `logicOps → procedureOps(numberSteps・stepId・isExternalActor) → api/types`。段階5の手順番号・手順ID の導き方を再利用し、同じ規則を2か所に書かない(#17)。

## 設計判断

### バックエンドと同じ規則を、画面でも導く

候補・呼ばれる手順・L-ID はバックエンド(21-1)でも導くが、画面は編集中の内容からすぐに表を作り直したい。段階5の索引・関与表(Phase 20)と同じく、画面側でも純粋関数で導いた。2か所の規則が食い違わないよう、テストでは同じ形の入力に同じ答えを期待している(`logicKey` の空白の除去、`L-100` の3桁など)。

### 選んだ関数の並び = 候補の並び

`toggleLogic` は、足した関数を候補の順(段階5で最初に呼ばれた順)に並べ直す。L-ID は並び順から導くので、選んだ順で L-ID が変わらないようにするためである。段階5を直して候補から消えた関数(呼ばれなくなった関数)は、末尾に残す(画面で外せるように。21-7)。

### 下位の箇条は 1行1箇条

擬似フローの段の下位の箇条(`sub`)は配列だが、入力欄は textarea 1つにして、1行を1箇条にした(`textToSub` は空の行も残す)。行ごとに入力欄と削除ボタンを並べるより、条件の分かれ目を続けて書きやすい。空の行は保存の前に残してもよく、バックエンドの取り込み(`merge_logic`)では生成の結果だけを整える。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `logicOps` の各関数 | vitest | スタブ不要。どれも純粋関数(副作用なし)で、外部依存を呼ばないため | 第一テストの統合スモーク(保存された model を読み、逆引きを導く)。欠けた欄の補い、候補のまとめ方と除外、L-ID の引き当て、候補の順の並べ替え、擬似フローの段の操作、1行1箇条 |

## 動作確認(実施済み)

```bash
cd devex-ui
npx vitest run src/features/detailed-design/__tests__/logicOps.test.ts
# 9 passed
```

## 画面確認後の修正(処理ごとのタブ)

ユーザーが画面を確認して、候補の関数が多いと「チェックの手間がかかる」「どこまで生成したかが見えない」と指摘した。21-7 の作業領域を段階5の処理ごとのタブで切り替える形にしたので、そのための純粋関数を足した。データ(`model`)・L-ID・逆引きは全体のまま変えず、見せ方だけを処理ごとに分ける。

| ファイル(`devex-ui/src/features/detailed-design/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`logicOps.ts`](../samples/frontend/src/features/detailed-design/logicOps.ts) | 更新 | **コア** | `candidatesByProcedure`・`isCalledFrom`・`logicStatus`・`selectAll`・`pendingInTab` |
| ── ここからテスト ── | | | |
| [`__tests__/logicOps.test.ts`](../samples/frontend/src/features/detailed-design/__tests__/logicOps.test.ts) | 更新 | **コア** | 処理ごとの候補と共通の印、状態、タブ単位の選択、タブの未生成 |

```ts
// logicOps.ts(画面確認後の修正)
export type TabCandidate = LogicCandidate & { shared: boolean };   // 2つ以上の処理から呼ばれる
export function candidatesByProcedure(procedures): ProcedureTab[];  // 段階5の処理の順。共通の関数は両方のタブに出す
export function logicStatus(model, key): "unselected" | "pending" | "drafted";   // 未選択 / 未生成 / 生成済
export function selectAll(model, allCandidates, tabCandidates): LogicModel;      // タブの未選択だけを足す
export function pendingInTab(model, tabCandidates): LogicTarget[];               // タブの未生成(生成の対象)
```

- **チェックの意味は変えない**(ユーザー決定): チェックは「06 に載せる関数」のまま。`selectAll` は未選択の候補だけを足すので、生成済の関数(もともと選ばれている)の詳細には触れない。再生成は関数のタブの「作り直す」で行う。チェックを「今回の生成対象」にする案は、06 に載せる選択と2種類のチェックが並んで画面が込み入るため採らなかった。
- **共通の関数は、呼ぶ処理すべてのタブに出す**(ユーザー決定): 処理から辿ったときに漏れが無いように。`shared` は手順ID の処理ID の部分(`F-01#2` の `F-01`)が2種類以上あるかで決める。どのタブで選んでも同じ1件(同じ鍵)なので、選択も詳細も1か所にしか無い。
- 並びは `toggleLogic` と同じく全体の候補の順に保つ。タブの一括選択でも L-ID の振られ方は変わらない。

テスト観点: SUT は上の各関数、ドライバは vitest。スタブ不要(純粋関数で、外部依存を呼ばないため)。`npx vitest run src/features/detailed-design/__tests__/logicOps.test.ts` → 13 passed。
