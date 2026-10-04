# Phase-18-8: CRUD 図の編集操作と表(FE)

## この章の目的

CRUD 図(処理 × テーブル)の編集操作を純粋関数にまとめ、それを使う CRUD 図の表を作る。DFD の線から決まる R は人の編集でも外させず、人が書き換えたセルは AI の下書きの印を外す。

学習モード([introduction](./Phase-18-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-ui/src/features/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`detailed-design/crudOps.ts`](../samples/frontend/src/features/detailed-design/crudOps.ts) | 新規 | **コア** | `toCrud`・`hasCrudDraft`・`countDrafts`・`normalizeOps`・`tableKey`・`cellOf`・`accessOf`・`setCellOps`・`crudTables`(純粋) |
| [`detailed-design/components/CrudMatrix.tsx`](../samples/frontend/src/features/detailed-design/components/CrudMatrix.tsx) | 新規 | **コア** | 行 = 機能一覧の処理、列 = テーブル。下書きのセルは黄色、DFD 由来のセルは青い枠 |
| ── ここからテスト ── | | | |
| [`detailed-design/__tests__/crudOps.test.ts`](../samples/frontend/src/features/detailed-design/__tests__/crudOps.test.ts) | 新規 | **コア** | 操作の並び、名前の突き合わせ、下書きの印の外れ方、R を外させない、空のセルの扱い、列の並び |
| [`detailed-design/components/__tests__/CrudMatrix.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/CrudMatrix.test.tsx) | 新規 | **コア** | セルの区別の表示、書き換えで印を外したモデルを渡すこと、disabled |

## 要点の抜粋

```ts
// detailed-design/crudOps.ts
export function setCellOps(model, functionId, table, text, accesses): CrudModel {
  const access = accessOf(accesses, functionId, table);
  const ops = normalizeOps(access.read ? `${text}R` : text);     // DFD の読みの R は外さない
  if (!ops && !access.write) return { cells: others };            // 空なら消す
  const next = { function_id: functionId, table, ops, draft: false };  // 書き換えたら確定
  // 既存のセルは置き換え、無ければ足す。DFD の書き込みがあるセルは空でも残す(検証で C/U/D を求める)
}

export function crudTables(erTables: string[], model: CrudModel): string[]
  // ER のテーブルの並び + ER に無いテーブルのセル(直す必要がある)を後ろに
```

```tsx
// detailed-design/components/CrudMatrix.tsx(抜粋)
<td style={{ ...CELL, ...(cell?.draft ? DRAFT_CELL : {}), ...(fixed ? FIXED_CELL : {}) }}
    data-draft={…} data-dfd={…} title="DFD: 読み・書き込み">
  <input aria-label={`${fn.id} × ${table}`} value={cell?.ops ?? ""}
         onChange={(e) => onChange(setCellOps(model, fn.id, table, e.target.value, accesses))} />
</td>
```

## 設計判断

### 規則はバックエンドの merge_crud と同じにする

| 規則 | バックエンド(18-1) | 画面(この章) |
|---|---|---|
| 操作の並び | `normalize_ops`(C→R→U→D) | `normalizeOps` |
| 名前の突き合わせ | `table_key` | `tableKey` |
| 読みの線の R | 必ず足す | 書き換えても足し直す(外せない) |
| 書き込みの線のセル | C/U/D が無くても空で残す | 空にしても残す |

画面とバックエンドで規則がずれると、画面で保存した CRUD 図が検証のエラーになる。セルの書き換えを純粋関数にまとめ、テストでバックエンドと同じ例(読みの R・書き込みの空セル)を確かめた。

### 下書きの印は「書き換えたら外れる」

着手時の決定3。セルごとに「確定」ボタンを置くと、数十のセルを1つずつ押す手間になる。人が書き換えたセルは人の判断が入ったので印を外し、書き換えなかったセルは段階3の承認でまとめて確定する(18-3)。表の上の説明文で、黄色のセルの数を示す。

### 入力は1セル1つの文字欄

セルごとに C・R・U・D の4つのチェックボックスを置くと、処理30 × テーブル10 で 1,200 個になり、表が横に広がりすぎる。文字欄に「cu」と打てば「CU」にそろえる形にした。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `crudOps` の各関数 | vitest | スタブ不要 ── 純粋関数で、外部依存を呼ばないため | バックエンドの merge_crud と同じ規則(読みの R・書き込みの空セル)、印の外れ方、列の並び |
| `CrudMatrix` | render と入力の操作 | `onChange`(vi.fn)── 編集の結果を受け取る親の代わり | 下書き・DFD 由来の区別(`data-draft`・`data-dfd`・`title`)、書き換えで印を外したモデル、disabled |

## 動作確認(実施済み)

```bash
cd devex-ui
npx vitest run src/features/detailed-design/__tests__/crudOps.test.ts src/features/detailed-design/components/__tests__/CrudMatrix.test.tsx
# 8 passed
```
