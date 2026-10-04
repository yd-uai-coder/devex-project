# Phase-19-7: 図の埋め込みの共通化と、段階4の作業領域(FE)

## この章の目的

段階3の ER の埋め込み(`ErEditorSection`)を、記法・対象・名前を引数にした `StageDiagramSection` に共通化し、段階4の構成図にも使う。19-6 の表と組み合わせて段階4の作業領域(`StructurePanel`)を作り、段階 → パネルの対応表に登録する。上から、下書きの生成・構成図(SCR-007 のエディタ)・モジュール一覧・保存・検証の結果の順に並べる。

学習モード([introduction](./Phase-19-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-ui/src/features/detailed-design/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`components/StageDiagramSection.tsx`](../samples/frontend/src/features/detailed-design/components/StageDiagramSection.tsx) | 新規 | **コア** | 指定した記法・対象の図(全体1枚)を `UmlDiagramEditor` で開く。未保存の編集を伝え、図の状態・版が変わったら段階の一覧を取り直す |
| [`components/ErEditorSection.tsx`](../samples/frontend/src/features/detailed-design/components/ErEditorSection.tsx) | 更新 | 定型 | `StageDiagramSection` に ER(notation=er、subject=`ER_SUBJECT`、名前「ER」)を渡して包むだけにした |
| [`components/StructurePanel.tsx`](../samples/frontend/src/features/detailed-design/components/StructurePanel.tsx) | 新規 | **コア** | 生成・作り直しの確認・構成図・モジュール一覧の編集と保存・検証の結果。段階の dirty に構成図の未保存の編集も含める |
| [`components/StageWorkArea.tsx`](../samples/frontend/src/features/detailed-design/components/StageWorkArea.tsx) | 更新 | 定型 | `STAGE_PANELS[4] = StructurePanel` |
| ── ここからテスト ── | | | |
| [`components/__tests__/StageDiagramSection.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/StageDiagramSection.test.tsx) | 新規 | 定型 | 構成図として使う形: 指定した記法・対象だけを開く、無いとき・生成中の文言、未保存の編集と段階の取り直し |
| [`components/__tests__/StructurePanel.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/StructurePanel.test.tsx) | 新規 | 定型 | 生成と構成図の埋め込み、層の選択肢とモジュール一覧の保存・「保存するまで生成できない」、作り直しの確認、生成中、失敗・検証の結果 |
| [`components/__tests__/StageWorkArea.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/StageWorkArea.test.tsx) | 更新 | 定型 | 開いた段階4にはソフトウェア構造のパネルを出す |

`ErEditorSection` を import する既存のテスト(`components/__tests__/ErEditorSection.test.tsx`、Phase 18-9)は変えずに通る。ER として使う形の確認は、このテストが受け持つ。

## 要点の抜粋

```tsx
// components/StageDiagramSection.tsx(抜粋)
export function StageDiagramSection({ projectId, notation, subject, title, generating, onDirtyChange }) {
  const name = /[A-Za-z0-9]$/.test(title) ? `${title} ` : title;   // 「ER はまだ…」「構成図はまだ…」
  useEffect(() => {
    if (generating) return;
    listDiagrams(projectId).then((items) =>
      setDiagram(items.find((d) => d.notation === notation && d.subject === subject) ?? null));
  }, [projectId, generating, notation, subject, name]);
  // 以降は Phase 18 の ErEditorSection と同じ(未保存の編集を伝える・状態が変わったら段階を取り直す)
}

// components/ErEditorSection.tsx
export function ErEditorSection({ projectId, generating, onDirtyChange }) {
  return <StageDiagramSection projectId={projectId} notation="er" subject={ER_SUBJECT} title="ER"
                              generating={generating} onDirtyChange={onDirtyChange} />;
}
```

```tsx
// components/StructurePanel.tsx(抜粋)
const componentModel = useUmlEditorStore((s) =>
  s.diagram?.notation === "component" && s.model?.notation === "component" ? (s.model as ComponentSemanticModel) : null);
const saved = toModuleList(stage.model);
const [draft, setDraft] = useState<ModuleListModel>(saved);
const [diagramDirty, setDiagramDirty] = useState(false);
useEffect(() => onDirtyChange(dirty || diagramDirty), …);   // 構成図の未保存の編集でも承認させない

<StageDiagramSection notation="component" subject={STRUCTURE_SUBJECT} title="構成図" … onDirtyChange={setDiagramDirty} />
{generating ? <Text>モジュール一覧: 生成中</Text>
            : <ModuleListTable layers={componentLayers(componentModel)} model={draft} … onChange={setDraft} />}
<StyledButton onPress={() => void save(projectId, stage.stage, draft)}>モジュール一覧を保存する</StyledButton>
```

```tsx
// components/StageWorkArea.tsx
const STAGE_PANELS = { 1: FunctionListPanel, 2: DataFlowPanel, 3: DataModelPanel, 4: StructurePanel };
```

## 設計判断

### 図の埋め込みを共通化する(#17)

段階4の構成図の埋め込みは、段階3の ER の埋め込みと「どの図を開くか(記法・対象)」と「名前」しか違わない。#17 の判定の一問「この共通化を今駆動している、この Phase の実在の消費者は何か」には「段階4の構成図(`StructurePanel`)」と答えられるので、コピーせずに共通化した。

- `StageDiagramSection` を新しく作り、ER の埋め込みの中身を移した。
- `ErEditorSection` は消さず、ER を指定して包むだけにした。`DataModelPanel` とそのテスト(`ErEditorSection` を差し替えている)を変えずに済む。
- 名前が英字で終わるとき(ER)は、後ろの文と半角の空白で区切る。Phase 18 の文言(「ER はまだありません」)を変えないためである。

### 段階3のパネルと同じ骨格にする

| 段階3(Phase 18) | 段階4(この章) |
|---|---|
| `DataModelPanel`(CRUD 図を保存) | `StructurePanel`(モジュール一覧を保存) |
| `ErEditorSection`(全体の ER 1枚) | `StageDiagramSection`(全体の構成図1枚) |
| `TableDefinitionTable`・`CrudMatrix`(列は編集中の ER から) | `ModuleListTable`(層の選択肢は編集中の構成図から) |

保存・生成のたびに `StageWorkArea` が key を変えてパネルを作り直し、編集中の内容をサーバーの内容に戻す(段階1〜3と同じ)。「保存する」のボタンはモジュール一覧だけを保存するので、文言を「モジュール一覧を保存する」にした(構成図はエディタのツールバーで保存する)。

### 層の選択肢は、エディタで編集中の構成図から作る

図のエディタのストアは1つだけで、段階4の画面では構成図だけを開く。そのストアの意味モデル(保存前の手直しを含む)から層の選択肢を作るので、構成図に層を足すとすぐ選べる。ストアに別の記法の図が残っているとき(段階3の ER から切り替えた直後など)は使わない(`notation === "component"` を確かめる)。そのときは選択肢が空になり、今の層は「(構成図に無い)」と表示される。

### 作り直しの確認

内容があるときは「下書きを作り直す」にし、確認ダイアログで「構成図とモジュール一覧の手直しが失われ、構成図の承認もやり直しになる」ことを示す(承認済み・古い段階なら、段階の承認もやり直しになることも)。19-3 の「作り直しは置き換え」に対応する。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `StageDiagramSection`(構成図として使う形) | render と、図のエディタのストアの書き換え | `listDiagrams`(図の一覧の API)・`UmlDiagramEditor`(エディタ本体は SCR-007 のテストで検証する)・`fetchStages`(段階の一覧の取り直し) | 指定した記法・対象の図だけを開くこと、図の名前で案内すること、未保存の編集と状態の変化の伝え方。ER として使う形は既存の `ErEditorSection.test.tsx` |
| `StructurePanel` | render と操作 | 段階のストアの `save`・`generate`・`fetchStages`、`StageDiagramSection`(上のテストで検証する)。モジュール一覧の表は本物を使う | 構成図(component・subject='')を埋め込むこと、エディタのストアの構成図から層の選択肢が作られること、保存する内容、作り直しの確認、生成中、構成図の未承認を一覧に出さないこと |
| `StageWorkArea` | render | スタブ不要 ── パネルは本物(段階のストアに段階を置く) | 段階4のパネルが出て「準備中」が出ないこと |

## 動作確認(実施済み)

```bash
cd devex-ui
npx vitest run src/features/detailed-design/components
# 69 passed
```

画面での確認はユーザーが行う(段階1〜3を承認したプロジェクトで、段階4の下書きの生成・構成図の承認・モジュール一覧の保存と承認)。
