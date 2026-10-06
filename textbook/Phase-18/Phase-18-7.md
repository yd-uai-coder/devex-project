# Phase-18-7: テーブル定義の表(FE)

## この章の目的

段階3の画面に出すテーブル定義の表を作る。ER(テーブル定義の正本)から組み立てる表示だけで、ここでは編集しない。

自動実装モード: on([introduction](./Phase-18-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-ui/src/features/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`detailed-design/components/TableDefinitionTable.tsx`](../samples/frontend/src/features/detailed-design/components/TableDefinitionTable.tsx) | 新規 | **コア** | ER のテーブルごとに、列/型/PK/FK/NULL可/制約/説明を並べる。テーブルの説明は見出しの行に出す |
| ── ここからテスト ── | | | |
| [`detailed-design/components/__tests__/TableDefinitionTable.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/TableDefinitionTable.test.tsx) | 新規 | **コア** | 列の制約・説明・テーブルの説明が出ること、入力欄が無いこと、ER が無い・テーブルが無いとき |

## 要点の抜粋

```tsx
// detailed-design/components/TableDefinitionTable.tsx
export function TableDefinitionTable({ model }: { model: ErSemanticModel | null }) {
  if (model === null) return null;
  // <table aria-label="テーブル定義"> の中で、テーブルごとに <tbody> を分ける
  //   見出しの行: テーブル名 + テーブルの説明
  //   列の行: name / type / PK・FK・NULL可(○)/ constraints / description
}
```

表の見た目は Phase 17 で切り出した `tableStyles`(`CELL`・`HEAD`・`TABLE`・`MONO`)を使う。

## 設計判断

### 表示だけにして、編集は ER の属性パネルに寄せる

テーブル定義の表で制約・説明を直せるようにすると、ER のエディタ(18-6)と編集の場所が2つになる。保存も2系統(ER の保存と段階の保存)になり、片方だけ保存したときの食い違いが起きる。着手時の決定2(テーブル定義の正本は ER)に合わせ、表は表示だけにした。表の上の説明文で「ER でテーブルを選び、属性パネルで直す」と案内する。

### 渡すのは「エディタで編集中の ER」

18-9 の作業領域は、ER のエディタのストアにある意味モデル(保存前の手直しを含む)を渡す。属性パネルで制約を直すと、保存する前から表に出る。保存した版だけを出すと、直した内容が表に出るのが保存の後になり、どこを直したかを見失いやすい。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `TableDefinitionTable` | render | スタブ不要 ── 渡した ER を表にするだけで、外部依存を呼ばないため | 列の制約・説明、テーブルの説明、入力欄が無いこと、ER が無い(null)・テーブルが0件 |

## 動作確認(実施済み)

```bash
cd devex-ui
npx vitest run src/features/detailed-design/components/__tests__/TableDefinitionTable.test.tsx
# 3 passed
```
