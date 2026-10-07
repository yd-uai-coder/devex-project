# Phase-29-4: 段階5の画面の図(BE + FE)

## この章の目的

段階5の作業領域で、処理のタブの手順の表の下にシーケンス図を出す。図はバックエンドが保存した手順から導いて SVG で返し(読み取り専用の API)、画面はそれを埋め込むだけにする。図にするときの指摘も図の下に並べる。

自動実装モード: on([introduction](./Phase-29-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/services/errors.py`](../samples/backend/app/services/errors.py) | 更新 | `DesignProcedureNotFoundError`(404) |
| [`app/schemas/design_stage.py`](../samples/backend/app/schemas/design_stage.py) | 更新 | `SequenceIssueRead`・`SequenceRead` |
| [`app/services/design_stage_service.py`](../samples/backend/app/services/design_stage_service.py) | 更新 | `procedure_sequence`(段階5が開いているか・処理があるかを確かめ、保存した手順から図を導く) |
| [`app/api/routes/design_stages.py`](../samples/backend/app/api/routes/design_stages.py) | 更新 | `GET /design-stages/procedures/{function_id}/sequence` |
| [`src/features/detailed-design/api/types.ts`](../samples/frontend/src/features/detailed-design/api/types.ts) | 更新 | `SequenceIssueRead`・`SequenceRead` |
| [`src/features/detailed-design/api/designStagesApi.ts`](../samples/frontend/src/features/detailed-design/api/designStagesApi.ts) | 更新 | `getProcedureSequence` |
| [`src/features/detailed-design/components/ProcedureSequenceView.tsx`](../samples/frontend/src/features/detailed-design/components/ProcedureSequenceView.tsx) | 新規 | `SequenceSvg`(SVG の埋め込み。29-5 も使う)・`ProcedureSequenceView`(取得・読み込み中・失敗・指摘・保存していない編集の注記) |
| [`src/features/detailed-design/components/ProcedurePanel.tsx`](../samples/frontend/src/features/detailed-design/components/ProcedurePanel.tsx) | 更新 | 手順のある(保存した)処理のタブで、表の下に `ProcedureSequenceView` を置く |
| ── ここからテスト ── | | |
| [`tests/unit/test_design_stage_sequence.py`](../samples/backend/tests/unit/test_design_stage_sequence.py) | 新規 | API の成功・指摘・選んでいない処理・開いていない段階5 |
| [`src/features/detailed-design/api/__tests__/designStagesApi.test.ts`](../samples/frontend/src/features/detailed-design/api/__tests__/designStagesApi.test.ts) | 更新 | `getProcedureSequence` の URL |
| [`src/features/detailed-design/components/__tests__/ProcedureSequenceView.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/ProcedureSequenceView.test.tsx) | 新規 | 埋め込みと指摘・保存していない編集の注記・版が変わると取り直す・失敗 |
| [`src/features/detailed-design/components/__tests__/ProcedurePanel.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/ProcedurePanel.test.tsx) | 更新 | 手順のある処理に図を出す・手順の無い処理には出さない |

BE のパスは `devex-api/backend/`、FE のパスは `devex-ui/` 基準。

## 要点の抜粋

```python
# app/services/design_stage_service.py
async def procedure_sequence(self, project, function_id) -> SequenceRead:
    _ensure_detailed(project); _ensure_open(views[PROCEDURE_STAGE])
    model = ProcedureModel.model_validate(rows[5].model)       # 保存した手順(下書き・レビュー中も)
    procedure = ...                                            # 無ければ DesignProcedureNotFoundError(404)
    modules = ModuleListModel(...) if 段階4が承認済み else None
    diagram = to_sequence(procedure, module_dependencies(modules))
    return SequenceRead(function_id=..., svg=to_sequence_svg(diagram), issues=[...])
```

```tsx
// src/features/detailed-design/components/ProcedureSequenceView.tsx
export function SequenceSvg({ svg, label })                       // role="img"、横スクロール
export function ProcedureSequenceView({ projectId, functionId, version, dirty })
  // key = `${functionId}:${version}` が変わったら取り直す。結果の key が今の key と違う間は「読み込み中」
```

## 設計判断

### 図は保存した手順から(着手時の決定)

導出をバックエンドだけに置いた(29-2)ので、画面の図は保存した内容から描く。手順の表は編集中の内容をこのコンポーネントの中だけに持つ(段階5の既存の作り)ため、図は保存まで表とずれる。そのことを「保存していない編集は、保存すると図に反映されます」と出す。保存すると段階の版(`version`)が変わるので、それを鍵に取り直す。

- 段階5は承認していなくても図を出す(下書き・レビュー中の手順を見直すための図)。そのため入力は `StageSources`(承認済みの段階だけ)でなく、段階5の保存した行から読む。依存先は承認済みの段階4だけを使う(段階5が開いていれば段階4は承認済み)。
- 手順の無い処理(選んだだけ・未生成)には図を出さず、API も呼ばない。

### 置き場は処理のタブの中、表の下(着手時の決定)

表の横に並べると、8列の表の幅が足りなくなる。表と図を切り替えるタブにすると、表を直しながら図を見られない。処理ごとのタブの中で、表の下に置いた。

### 取り直しの書き方(lint への対応)

効果(`useEffect`)の中で同期的に「読み込み中」に戻すと、`react-hooks/set-state-in-effect` に当たる。結果に取得したときの鍵を持たせ、今の鍵と違う間は読み込み中とみなす形にした。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `DesignStageService.procedure_sequence`・ルート | pytest(`test_design_stage_sequence.py`) | スタブ不要 ── DB はインメモリ SQLite(fixture)で、図は純粋関数で導き LLM を呼ばないため | 第一テスト: ルートが保存した(承認していない)手順の SVG を返す。戻りを呼び出しとして書いた行の指摘が出る。選んでいない処理は `DesignProcedureNotFoundError`、段階5が開いていなければ `DesignStageLockedError` |
| `getProcedureSequence` | vitest | スタブ: fetch(`stubFetch`。サーバーの代わり) | URL が `/design-stages/procedures/F-01/sequence` |
| `ProcedureSequenceView`・`SequenceSvg` | vitest + Testing Library | スタブ: `getProcedureSequence`(devex-api が導いた SVG と指摘を返す代わり) | SVG を `role="img"` の中にそのまま埋め込み、指摘を並べる。保存していない編集の注記。版が変わると取り直す。失敗の理由を出す |
| `ProcedurePanel` | vitest + Testing Library | スタブ: 段階のストアの操作と `getProcedureSequence` | 手順のある処理のタブに図が出る。手順の無い処理には出さず、API を呼ばない |
