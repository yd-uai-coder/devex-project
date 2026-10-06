# Phase-20-6: 1処理の手順の表(FE)

## この章の目的

1つの処理の手順を編集する表を作る。列は Phase 14 で確定した7列(呼び出し元 → 呼び出し先 / 渡すデータ / 処理内容 / 結果 / DB 操作 / 分岐・例外)に、番号と「関数」を足したもの。選定理由と注記もここで編集する。編集した内容は `onChange` で呼び出し元(20-7 の `ProcedurePanel`)へ返し、保存は呼び出し元が行う。

自動実装モード: on([introduction](./Phase-20-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-ui/src/features/detailed-design/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`components/ProcedureStepTable.tsx`](../samples/frontend/src/features/detailed-design/components/ProcedureStepTable.tsx) | 新規 | **コア** | 番号付きの手順の表・分岐の行の見せ方・一覧に無い呼び出し先の印・行の追加と削除・選定理由と注記 |
| ── ここからテスト ── | | | |
| [`components/__tests__/ProcedureStepTable.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/ProcedureStepTable.test.tsx) | 新規 | 定型 | 番号と欄の編集、印の出し分け、行の追加・削除で番号が振り直されること、選定理由と注記 |

## 要点の抜粋

```tsx
// components/ProcedureStepTable.tsx(抜粋)
export function ProcedureStepTable({ model, functionId, modulePaths, disabled, onChange }) {
  const numbers = numberSteps(procedure.steps);
  ...
  // 入力欄の名前は手順ID(「F-01#1a の条件」)。番号が振り直されると名前も変わる
  // 呼び出し元・呼び出し先は <datalist> でモジュールのパスと外部の役者を候補に出す(自由に書いてもよい)
  const unknown = !step.is_branch &&
    (callee === "" || (!isExternalActor(callee) && !known.has(callee)));   // 検証のエラーと同じ条件
}
```

## 設計判断

### 呼び出し先は候補つきの自由入力

呼び出し先をセレクト(モジュールのパスだけ)にすると、外部の役者(利用者・スケジューラ・メール API など)を書けない。そこで、`<datalist>` でモジュールのパスと代表的な外部の役者を候補に出し、入力は自由にした。かわりに、一覧に無いパスと空の呼び出し先には、その場で印(「モジュール一覧に無いパスです」「呼び出し先が空です」)を出す。条件はバックエンドの検証(`UNKNOWN_CALLEE`・`EMPTY_CALLEE`)と同じなので、保存してから検証の結果を見るまで待たずに直せる。

空の呼び出し先は「/」を含まないので、`isExternalActor` だけで判定すると外部の役者として通ってしまう。空を先に判定する。

### 分岐の行は書く欄を絞る

分岐の行が持つのは「条件」(処理内容の欄)と「結果」(分岐・例外の欄)だけである(20-1)。呼び出し元・呼び出し先・関数・渡すデータ・結果・DB 操作の欄は出さず、「分岐(1 の手順から)」と添える。欄を出すと、書いた値が関与表に入らない(分岐の行は列に数えない)のに入るように見えるためである。

### 行の鍵

番号は並び順から導くので、行に固有の鍵が無い。モジュール一覧の表(Phase 19)と同じく、行は位置で扱う(`key={index}`)。入力欄の名前(`aria-label`)は手順ID にした。テストも画面の読み上げも、文書と同じ ID で行を指せる。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `ProcedureStepTable` | render と操作(Testing Library) | `onChange`(呼び出し元への通知を受け取る)。編集操作(`procedureOps`)は本物を使う | 番号と分岐の欄、欄の編集が `onChange` に渡ること、印の出し分け(空・一覧に無いパス・外部の役者)、手順・分岐を足すと番号が振り直され、手順を消すと分岐も消えること、選定理由と注記、選ばれていない処理なら何も出さないこと |

`onChange` の値を手元の状態に戻す小さな包み(`Harness`)を使い、呼び出し元と同じく「編集 → 再描画」の流れで確かめる。

## 動作確認(実施済み)

```bash
cd devex-ui
npx vitest run src/features/detailed-design/components/__tests__/ProcedureStepTable.test.tsx
# 5 passed
```
