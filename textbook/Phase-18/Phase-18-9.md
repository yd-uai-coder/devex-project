# Phase-18-9: 段階3の作業領域(FE)

## この章の目的

18-6〜18-8 の部品を組み合わせて、段階3の作業領域を作る。上から、下書きの生成・ER(SCR-007 のエディタ)・テーブル定義の表・CRUD 図・保存・検証の結果の順に並べ、段階 → パネルの対応表に登録する。

自動実装モード: on([introduction](./Phase-18-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-ui/src/features/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`detailed-design/components/ErEditorSection.tsx`](../samples/frontend/src/features/detailed-design/components/ErEditorSection.tsx) | 新規 | **コア** | 全体の ER(subject='')を `UmlDiagramEditor` で開く。未保存の編集を伝え、図の状態・版が変わったら段階の一覧を取り直す |
| [`detailed-design/components/DataModelPanel.tsx`](../samples/frontend/src/features/detailed-design/components/DataModelPanel.tsx) | 新規 | **コア** | 生成・作り直しの確認・ER・テーブル定義・CRUD 図の編集と保存・検証の結果。段階の dirty に ER の未保存の編集も含める |
| [`detailed-design/components/StageWorkArea.tsx`](../samples/frontend/src/features/detailed-design/components/StageWorkArea.tsx) | 更新 | 定型 | `STAGE_PANELS[3] = DataModelPanel` |
| ── ここからテスト ── | | | |
| [`detailed-design/components/__tests__/ErEditorSection.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/ErEditorSection.test.tsx) | 新規 | **コア** | 全体の ER だけを開く、無いとき・生成中、未保存の編集と段階の取り直し |
| [`detailed-design/components/__tests__/DataModelPanel.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/DataModelPanel.test.tsx) | 新規 | **コア** | 生成、CRUD 図の保存と「保存するまで生成できない」、作り直しの確認、生成中、失敗・検証の結果 |
| [`detailed-design/components/__tests__/StageWorkArea.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/StageWorkArea.test.tsx) | 更新 | 定型 | 開いた段階3にはデータモデルのパネルを出す |

## 要点の抜粋

```tsx
// detailed-design/components/DataModelPanel.tsx(抜粋)
const erModel = useUmlEditorStore((s) =>
  s.diagram?.notation === "er" && s.model?.notation === "er" ? (s.model as ErSemanticModel) : null);
const saved = toCrud(stage.model);
const [draft, setDraft] = useState<CrudModel>(saved);
const [erDirty, setErDirty] = useState(false);
useEffect(() => onDirtyChange(dirty || erDirty), …);          // ER の未保存の編集でも承認させない
const tables = crudTables(erModel?.elements.map((t) => t.name) ?? [], draft);

<ErEditorSection projectId={projectId} generating={generating} onDirtyChange={setErDirty} />
{generating ? null : <TableDefinitionTable model={erModel} />}
{generating ? <Text>CRUD 図: 生成中</Text>
            : <CrudMatrix functions={…} tables={tables} model={draft} accesses={stage.dfd_accesses} … />}
<StyledButton onPress={() => void save(projectId, stage.stage, draft)}>CRUD 図を保存する</StyledButton>
```

```tsx
// detailed-design/components/StageWorkArea.tsx
const STAGE_PANELS = { 1: FunctionListPanel, 2: DataFlowPanel, 3: DataModelPanel };
```

## 設計判断

### 段階2のパネルと同じ骨格にする

| 段階2(Phase 17) | 段階3(この章) |
|---|---|
| `DataFlowPanel`(グループの選択と処理概要表を保存) | `DataModelPanel`(CRUD 図を保存) |
| `DfdEditorTabs`(グループごとの DFD を1枚ずつ) | `ErEditorSection`(全体の ER 1枚) |
| `DataDictionaryTable`(データ辞書の CRUD) | `TableDefinitionTable`(ER から表示だけ) |
| 処理概要表 | `CrudMatrix` |

保存・生成のたびに `StageWorkArea` が key を変えてパネルを作り直し、編集中の内容をサーバーの内容に戻す(段階1・2と同じ)。「保存する」のボタンは CRUD 図だけを保存するので、文言を「CRUD 図を保存する」にした(ER はエディタのツールバーで保存する)。

### テーブル定義と CRUD 図の列は、エディタで編集中の ER から作る

ER のエディタのストアは1つだけで、段階3の画面では ER だけを開く。そのストアの意味モデル(保存前の手直しを含む)から、テーブル定義の表と CRUD 図の列を作る。ストアに別の記法の図が残っているとき(段階2の DFD から切り替えた直後など)は使わない(`notation === "er"` を確かめる)。ER が読めなくても、セルのあるテーブルは CRUD 図の列に出す(`crudTables`)。

### 生成を止める条件と、作り直しの確認

- CRUD 図に保存していない編集がある間は、生成ボタンを押せない(生成で置き換わり、編集が消えるため)。
- 内容がある段階を作り直すときは、確認ダイアログで「ER の手直しと CRUD 図で確定したセルは失われ、ER の承認もやり直しになる」ことを示す(18-3 の「再生成は置き換え」)。
- 生成中は ER の一覧を読まず、テーブル定義の表を隠し、CRUD 図の場所に「生成中」と出す(Phase 17 の生成中の表示と同じ考え方)。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `ErEditorSection` | render とエディタのストアの書き換え | `listDiagrams`(図の一覧の API)・`UmlDiagramEditor`(エディタ本体は既存のテストで検証済み)・`fetchStages` | 全体の ER だけを開く、無いとき・生成中、未保存の編集の伝達、図の状態の変化で段階を取り直す |
| `DataModelPanel` | render と操作 | 段階のストアの `save`・`generate`・`fetchStages`、`ErEditorSection`(props を記録する偽物) | テーブル定義の表と CRUD 図は本物を使い、エディタのストアに置いた ER から列が作られること。保存の内容、生成を止める条件、確認ダイアログ、生成中、失敗・検証の結果 |
| `StageWorkArea` | render | 段階のストアの値 | 開いた段階3にデータモデルのパネルが出ること |

## 動作確認(実施済み)

```bash
cd devex-ui
npx vitest run src/features/detailed-design/components
# 段階3の3ファイルで 14 passed(ErEditorSection・DataModelPanel・StageWorkArea)
```

## 画面確認後の修正

Phase 18 の実装後、ユーザーが画面で確かめて見つかった4点を直し、承認の後の流れを1つ足した(経緯は [`q_a.md`](../q_a.md) の「Phase 18 作業後」)。

### この節で更新したファイル

| ファイル(`devex-ui/src/features/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`detailed-design/labels.ts`](../samples/frontend/src/features/detailed-design/labels.ts) | 更新 | **コア** | `APPROVAL_TIME_CODES`・`visibleIssues`・`approvalBlockers`。`hasErrors` は図の未承認を数えない |
| [`detailed-design/components/StageIssueList.tsx`](../samples/frontend/src/features/detailed-design/components/StageIssueList.tsx) | 更新 | 定型 | 一覧に出す前に `visibleIssues` で図の未承認を除く |
| [`detailed-design/detailed-design-store.ts`](../samples/frontend/src/features/detailed-design/detailed-design-store.ts) | 更新 | **コア** | `approve` は図の未承認があれば API を呼ばず、理由を `actionError` に出す |
| [`uml/components/UmlCanvas.tsx`](../samples/frontend/src/features/uml/components/UmlCanvas.tsx) | 更新 | **コア** | `onSelectionChange` を `useCallback` で固定する。操作ボタンの配色 `CONTROLS_STYLE` |
| ── ここからテスト ── | | | |
| [`detailed-design/__tests__/labels.test.ts`](../samples/frontend/src/features/detailed-design/__tests__/labels.test.ts) | 更新 | 定型 | 図の未承認だけなら承認ボタンは押せ、一覧から除き、承認を止める理由として返す |
| [`detailed-design/__tests__/detailed-design-store.test.ts`](../samples/frontend/src/features/detailed-design/__tests__/detailed-design-store.test.ts) | 更新 | 定型 | 図が未承認なら API を呼ばずに理由を出す |
| [`detailed-design/components/__tests__/StageIssueList.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/StageIssueList.test.tsx) | 更新 | 定型 | 図の未承認のエラーは一覧に出さない |
| [`detailed-design/components/__tests__/DataFlowPanel.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/DataFlowPanel.test.tsx)・[`DataModelPanel.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/DataModelPanel.test.tsx) | 更新 | 定型 | DFD・ER の未承認が一覧に出ないこと |
| [`uml/components/__tests__/UmlCanvas.test.tsx`](../samples/frontend/src/features/uml/components/__tests__/UmlCanvas.test.tsx) | 更新 | **コア** | 要素を選んだまま要素を追加しても、選択が往復しない(再現テスト)。ダークテーマでも操作ボタンが白地に黒字 |

### 1. 図の未承認は、段階の承認を押したときに出す

段階3の「検証の結果」に「ER が承認されていません。」が最初から出ていた。ER は生成した直後は必ず下書きなので、このエラーは常に出てしまい、ほかの指摘が埋もれる。段階2の「DFD が承認されていません」も同じなので、両方を同じ扱いにした(ユーザーの選択)。

```ts
// detailed-design/labels.ts
export const APPROVAL_TIME_CODES = new Set(["DFD_NOT_APPROVED", "ER_NOT_APPROVED"]);
export function visibleIssues(issues) { /* 図の未承認のエラーを除く */ }
export function approvalBlockers(stage) { /* 図の未承認のエラーだけ */ }
export function hasErrors(stage) { return visibleIssues(stage.issues).some(...error...) }  // 承認ボタンは押せる
```

```ts
// detailed-design/detailed-design-store.ts の approve
const blockers = approvalBlockers(current);
if (blockers.length > 0) {   // API は呼ばない
  set({ actionError: [...blockers.map((i) => i.message), "図のエディタで承認してから、段階を承認してください。"].join(" ") });
  return;
}
```

バックエンドの検証は変えない。図の未承認は検証のエラーのまま残り、承認の API は 409 で断る。画面を通らない承認を止める守りはバックエンドに置き、いつ人に見せるかは画面で決める、という分け方である。

### 2. 「テーブルを追加」で Maximum update depth exceeded

**原因**: React Flow 12 は、選択の通知を `useEffect(..., [selectedNodes, selectedEdges, onSelectionChange])` で出す。`UmlCanvas` は `onSelectionChange` をレンダーのたびに作り直していたので、再レンダーのたびに通知が出直していた。要素を追加すると、ストアの選択は新しい要素になる。その再レンダーで、子(React Flow)の通知の effect は、親の `setNodes(derived)` の effect より先に走る。このとき React Flow の中はまだ古い選択なので、ハンドラが選択を古い要素に戻す。次のレンダーでは逆向きに戻り、選択が往復し続けた。

**修正**: `onSelectionChange` を `useCallback`(依存は `select`)で固定した。通知は React Flow の選択が実際に変わったときだけ出るので、`setNodes(derived)` で表示が新しい選択に追いついてから1回だけ通知される。`UmlCanvas` は SCR-007 と段階2の DFD のエディタでも使う部品なので、そちらも同時に直る。

**テスト**: 直す前に、jsdom で同じエラーを再現するテストを書いた(ER のテーブルを選んだ状態で `addElement()`)。直した後は通り、新しいテーブルが選ばれる。

### 3. 図の操作ボタン(拡大・縮小など)が、ダークモードで読めない

**原因**: React Flow 12 の既定の配色(ライト)では、操作ボタンの背景は白(`--xy-controls-button-background-color-default: #fefefe`)だが、文字色は `inherit`(親の文字色を受け継ぐ)。アイコンは `fill: currentColor` なので、ダークモードではページの白い文字色を受け継ぎ、白地に白になっていた。

**修正**: ライト・ダークとも白地に黒字に統一する(ユーザーの指定)。`UmlCanvas` のモジュール定数 `CONTROLS_STYLE` で React Flow の CSS 変数(背景・ホバー・文字色・枠)を上書きし、`<Controls style={CONTROLS_STYLE} />` に渡す。`<Controls />` を使うのは `UmlCanvas` の1か所だけで、SCR-007・段階2の DFD・段階3の ER が同じ部品を使うので、全段階でそろう(段階1と Phase 14 のデモは React Flow を使っていない)。

### 4. 「テーブルを追加」を2回押すと、CRUD 図で key が重複する

**原因**: ER のエディタの「テーブルを追加」は、名前を毎回 `new_table` にしていた(`uml/model/editOps.ts` の `addElement`)。2回押すと同じ名前のテーブルが2つでき、テーブル名を列の key にしている `CrudMatrix` で `Encountered two children with the same key` になった。テーブル名は CRUD 図のセルを引く鍵でもあるので、名前が重なると、どちらのテーブルのセルかが決まらない(人が同じ名前に改名しても同じことが起きる)。

**修正**(3か所。元の章のファイルを直し、samples には元の章のタグを付けた):

| どこで | ファイル | 修正 |
|---|---|---|
| 追加で重複を作らない | `uml/model/editOps.ts`(18-6) | `nextTableName`: 使われていない `new_table`・`new_table_2`… を付ける(SCR-007 にも効く) |
| 表が壊れない | `detailed-design/crudOps.ts`(18-8) | `crudTables`: ER のテーブル名も `tableKey` で重複を除く |
| 承認を止める | BE `app/detailed_design/validation.py`(18-1) | エラー `DUPLICATE_TABLE`「ER のテーブル名「x」が重複しています。」。一覧に常に出す |

### 5. 段階の承認の後に、完了のダイアログと「次の段階へ進む」(ユーザーの要望)

段階の承認ボタンを押して承認できたら、ダイアログで「段階N-{段階名}を承認しました。」と知らせ、「次の段階へ進む」で次の段階を選ぶ(「閉じる」はその段階に留まる)。段階7は次が無いので「閉じる」だけを出す。全段階に共通の動きなので、段階のパネルではなく `DetailedDesignPageContent` に置いた。

| ファイル | 修正 |
|---|---|
| `detailed-design/detailed-design-store.ts` | `approve` が承認できたかを `boolean` で返す(図の未承認・API の失敗は false) |
| `detailed-design/components/DetailedDesignPageContent.tsx` | 承認できたら `approvedStage` を持ち、`ConfirmDialog` を出す |
| `components/ui/layout-blocks/ConfirmDialog.tsx`(Phase 15-8 の部品) | 任意の `cancelLabel`(既定「キャンセル」、`null` なら出さない)。完了の知らせにも使えるようにした(#17: 消費者は承認の完了ダイアログ) |

### 動作確認(実施済み)

```bash
cd devex-ui
npx vitest run src/features/detailed-design src/features/uml --maxWorkers=4
# 239 passed
npx vitest run --maxWorkers=4      # FE 全体 507 passed
```
