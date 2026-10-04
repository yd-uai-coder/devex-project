# Phase-17-7: 機能グループの DFD のタブ(SCR-007 のエディタの埋め込み)(FE)

## この章の目的

段階2の作業領域に、機能グループごとの DFD のタブを足す。DFD は `uml_diagrams` の行なので、SCR-007 の図のエディタ(ツールバー・キャンバス・検証・要素の編集・承認)をそのまま埋め込んで使う。

- SCR-007 のレビュー画面から、見出しと一覧へ戻るリンクを除いた部分を `UmlDiagramEditor` として切り出す。
- DFD の保存・承認で段階2の検証の結果や状態が変わるので、図の状態・版が変わるたびに段階の一覧を取り直す。
- DFD のエディタに保存していない編集があるうちは、段階の承認ボタンを止める。

学習モード([introduction](./Phase-17-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-ui/src/features/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`uml/components/UmlDiagramEditor.tsx`](../samples/frontend/src/features/uml/components/UmlDiagramEditor.tsx) | 新規 | 定型 | 図1枚のエディタ(`UmlDiagramPageContent` から見出しとリンクを除いて切り出した) |
| [`uml/components/UmlDiagramPageContent.tsx`](../samples/frontend/src/features/uml/components/UmlDiagramPageContent.tsx) | 更新 | 定型 | 見出しとリンクの下に `UmlDiagramEditor` を置くだけにした |
| [`detailed-design/components/DfdEditorTabs.tsx`](../samples/frontend/src/features/detailed-design/components/DfdEditorTabs.tsx) | 新規 | **コア** | 機能グループごとの DFD のタブ。選んだ1枚だけエディタで開く |
| [`detailed-design/components/DataFlowPanel.tsx`](../samples/frontend/src/features/detailed-design/components/DataFlowPanel.tsx) | 更新 | **コア** | `DfdEditorTabs` を置き、DFD の未保存の編集も段階の dirty に含める |
| ── ここからテスト ── | | | |
| [`detailed-design/components/__tests__/DfdEditorTabs.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/DfdEditorTabs.test.tsx) | 新規 | **コア** | 開く図、タブの切り替え、未生成のグループ、生成中、dirty と段階の取り直し |
| [`uml/components/__tests__/UmlDiagramPageContent.test.tsx`](../samples/frontend/src/features/uml/components/__tests__/UmlDiagramPageContent.test.tsx) | 更新 | 定型 | エディタだけなら見出しとリンクを持たないこと |
| [`detailed-design/components/__tests__/DataFlowPanel.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/DataFlowPanel.test.tsx) | 更新 | **コア** | タブを差し替え、渡す値と dirty の合成を確かめる |

## 要点の抜粋

```tsx
// detailed-design/components/DfdEditorTabs.tsx
export function DfdEditorTabs({ projectId, groups, generating, onDirtyChange }) {
  // groups は「保存済みの」DFD を描くグループ(未保存の選択の図はまだ無い)
  const editing = useUmlEditorStore((s) => s.diagram);       // エディタのストアは1つだけ
  const editorDirty = useUmlEditorStore((s) => s.dirty);
  ...listDiagrams(projectId) → notation === "dfd" の図を subject(機能グループ名)で引く
  const dirty = editingThis && editorDirty;                  // 開いている図の未保存の編集
  useEffect(() => { if (editingStatus !== null) void fetchStages(projectId); },
            [editingStatus, editingVersion, fetchStages, projectId]);   // 保存・配置・承認で取り直す
  ...
  {generating ? "生成中は編集できません"
   : diagram ? <UmlDiagramEditor key={diagram.id} projectId={projectId} diagramId={diagram.id} />
   : "まだありません。下書きを生成すると作られます"}
}
```

```tsx
// detailed-design/components/DataFlowPanel.tsx(17-7 の追記分)
const [dfdDirty, setDfdDirty] = useState(false);
useEffect(() => { onDirtyChange(dirty || dfdDirty); }, [dirty, dfdDirty, onDirtyChange]);
<DfdEditorTabs projectId={projectId} groups={saved.dfd_groups} generating={generating}
               onDirtyChange={setDfdDirty} />
```

## 設計判断

### エディタを切り出して共有する

SCR-007 のレビュー画面(`UmlDiagramPageContent`)は、見出しと「設計図の一覧に戻る」リンクを持つ。SCR-008 に埋め込むとき、この2つは要らない(詳細設計モードには SCR-007 の一覧が無い)。ツールバーとキャンバスの部分を `UmlDiagramEditor` に切り出し、SCR-007 と段階2の両方から使う(#17。駆動する消費者は `DfdEditorTabs`)。コードの移動だけで挙動は変えないので、`UmlDiagramPageContent` の既存のテストが番人になる。

### 開くのは選んだタブの1枚だけ

エディタのストア(`useUmlEditorStore`)は単一で、`load(projectId, diagramId)` で1枚を読み込む。複数の DFD を同時に開くには、ストアを図ごとに作れるように作り直す必要がある。タブで1枚ずつ開けば足りるので、ストアは変えない。タブを切り替えるとき、保存していない編集があれば確認する(切り替えると失われるため)。

### DFD の状態が変わったら段階の一覧を取り直す

DFD を保存・自動レイアウト・承認すると、

- 段階2の検証の結果が変わる(`DFD_NOT_APPROVED` が消える・出る)。
- 承認済みの段階2が差し戻される(17-4)。

段階の一覧(ストア)は古いままなので、開いている図の状態か版が変わるたびに `fetchStages` を呼ぶ。段階2の版が変わるとパネルが作り直され(`key`)、タブは最初のグループに戻る。差し戻しは承認済みのときだけなので、作業中にタブが戻るのは承認し直しのときに限られる。

### 段階の承認は、DFD の未保存の編集でも止める

段階の承認は、保存済みの内容で検証する。DFD に保存していない編集があるまま段階を承認すると、画面で見ている DFD と承認された DFD が食い違う。`DataFlowPanel` が、処理概要表の dirty と DFD の dirty を合わせて作業領域へ伝え、承認ボタンを止める(Phase 16 の「保存してから承認」と同じ考え方)。

### 生成中は DFD を開かない

生成は、選んだグループの DFD を上書きする(17-3)。生成中に編集できると、編集が生成の結果で消える。生成中は一覧も読まず、エディタも出さない。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `DfdEditorTabs` | Vitest + Testing Library(userEvent) | `listDiagrams` を `vi.mock`(API の代わり)、`UmlDiagramEditor` を `vi.mock`(重いキャンバスの代わり。開いた図の id だけ描く)。ストアの `fetchStages` を `vi.fn` | 第一テストの統合スモーク(最初のグループの DFD を開き、タブで切り替える)。未生成のグループ、生成中は読まない、未保存の編集の通知と段階の取り直し、グループ無し |
| `UmlDiagramEditor` | Vitest + Testing Library | キャンバス・パネルを `vi.mock`(既存のテストと同じ) | 見出しとリンクを持たないこと、マウント時の `load` |
| `DataFlowPanel`(17-7 の追記分) | Vitest + Testing Library | `DfdEditorTabs` を `vi.mock`(渡された props を記録する) | 保存済みのグループを渡すこと、タブの dirty が段階の dirty になること |

エディタと API を差し替えるのは、ここで確かめたいのが「どの図を開くか・いつ段階を取り直すか」という配線だからである。エディタ自体の挙動は SCR-007 のテストが持つ。

## 動作確認(実施済み)

```bash
cd devex-ui
npx vitest run src/features/detailed-design/components/__tests__/DfdEditorTabs.test.tsx \
  src/features/uml/components/__tests__/UmlDiagramPageContent.test.tsx
# 13 passed
```
