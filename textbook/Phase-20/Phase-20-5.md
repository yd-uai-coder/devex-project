# Phase-20-5: 手順の編集操作と、索引・関与表の導き方(FE)

## この章の目的

段階5の画面が使う純粋関数を作る。保存された `model` を編集できる形にそろえ、手順番号を並び順から導き、行の追加・分岐の追加・削除・処理の選択を行う。05 章の冒頭に置く索引と、「処理 × モジュール」の関与表もここで導く。

自動実装モード: on([introduction](./Phase-20-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-ui/src/features/detailed-design/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`procedureOps.ts`](../samples/frontend/src/features/detailed-design/procedureOps.ts) | 新規 | **コア** | `toProcedures`・`numberSteps`・`stepId`・`isExternalActor`・`mainStepCount`・`pendingFunctionIds`・`toggleProcedure`・`updateProcedure`・`addStep`・`addBranch`・`updateStep`・`removeStep`・`buildIndex`・`buildInvolvement`(純粋) |
| ── ここからテスト ── | | | |
| [`__tests__/procedureOps.test.ts`](../samples/frontend/src/features/detailed-design/__tests__/procedureOps.test.ts) | 新規 | **コア** | 番号、行の操作、選択の並び、索引、関与表の列の決め方 |

## 要点の抜粋

```ts
// procedureOps.ts
export function numberSteps(steps: ProcedureStep[]): string[]       // バックエンドの number_steps と同じ規則
export function toggleProcedure(model, functionList, functionId, checked): ProcedureModel
    // 選ぶと機能一覧の順に並べる。外すとその処理の行ごと消える
export function addBranch(model, functionId, index): ProcedureModel
    // index の手順に付いている分岐の後ろに、分岐の行を足す
export function removeStep(model, functionId, index): ProcedureModel
    // 手順の行を消すと、付いている分岐の行も消す
export function buildIndex(model, functionList): IndexRow[]          // 処理ID/名称/トリガー/選定理由/手順数
export function buildInvolvement(model, modulePaths): Involvement
    // 列: 呼び出し先として現れるモジュール(段階4の一覧の並び)。セル: 手順番号の並び
```

## 設計判断

### 分岐の行は手順に付いているものとして扱う

分岐の行は、直前の手順の番号に `a, b…` を付けて番号が決まる。行の並びがそのまま「どの手順の分岐か」を表すので、操作でその関係を崩さないようにした。

| 操作 | 振る舞い | 崩さないもの |
|---|---|---|
| 分岐を足す(`addBranch`) | その手順の既存の分岐の後ろに足す | `1a, 1b` の順(新しい分岐は `1c`) |
| 手順を消す(`removeStep`) | 付いている分岐の行も一緒に消す | 分岐が前の手順に付け替わらない(`2a` が `1b` になるのを防ぐ) |
| 分岐を消す | その行だけ消す | 後ろの分岐の添え字は詰まる(`1b` → `1a`) |

番号はどれも `numberSteps` で導き直すので、操作の関数は番号を扱わない。

### 関与表の列

関与表の列は、段階4のモジュール一覧のパスのうち、どこかの手順の呼び出し先に現れるものだけにした。並びはモジュール一覧の並び(層の上流から下流)で、手順に現れた順ではない。処理が増えても列の並びが入れ替わらず、CRUD 図(列はテーブル)と同じ読み方ができる。

- 呼び出し先は前後の空白を除いて、パスと完全一致で引く(バックエンドの検証 `UNKNOWN_CALLEE` と同じ条件)。
- 外部の役者・一覧に無いパス・分岐の行は列に入れない。一覧に無いパスは検証のエラーなので、直せば列に現れる。

索引と関与表は、編集中の内容(保存前)から導く。手順を足すと、保存しなくても関与表のセルにすぐ番号が出る。

### バックエンドと同じ規則を2か所に持つ

`numberSteps`・`isExternalActor`・`pendingFunctionIds` は、バックエンド(20-1)の関数と同じ規則である。画面は保存前の内容に番号を出す必要があり、サーバーへの往復では編集のたびに番号が遅れる。規則が1行で済む小さな関数なので、両方に持つことにした(テストを両方に置いて規則を固定する)。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `procedureOps` の各関数 | vitest | スタブ不要。純粋関数(副作用なし)で、外部依存を呼ばないため | 統合スモーク(保存された model → 番号・関与表・索引)。欠けた欄の補い、`z` の次の `aa`、選択の並び、分岐の位置と手順ごとの削除、引数を変えないこと、関与表の列の並びと除外、機能一覧に無い処理の索引 |

## 動作確認(実施済み)

```bash
cd devex-ui
npx vitest run src/features/detailed-design/__tests__/procedureOps.test.ts
# 8 passed
```
