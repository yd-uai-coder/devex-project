# Phase-30-5: 画面の「AI 向けにコピー」(BE・FE)

## この章の目的

段階8の単位の詳細に「AI 向けにコピー」を置く。押すと、サーバーが保存済みの手順書と承認済みの設計から組み立てた AI 向けの md(zip の `ai/<単位ID>.md` と同じ組み立て)をクリップボードへ写す。段階8が未承認・古いとき、未定義が残るときは件数を示して警告する(渡すのは止めない)。

自動実装モード: on([introduction](./Phase-30-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/services/errors.py`](../samples/backend/app/services/errors.py) | 更新 | `DesignUnitProcedureNotFoundError`(404。手順書の無い単位) |
| [`app/schemas/design_stage.py`](../samples/backend/app/schemas/design_stage.py) | 更新 | `UnitAiMarkdownRead`(`unit_id`・`markdown`・`state`・`finding_total`・`critical`) |
| [`app/services/design_stage_service.py`](../samples/backend/app/services/design_stage_service.py) | 更新 | `unit_ai_markdown`(段階8が開いているか・単位が段階7にあるか・手順書があるかを確かめ、保存済みの行から組み立てる) |
| [`app/api/routes/design_stages.py`](../samples/backend/app/api/routes/design_stages.py) | 更新 | `GET /design-stages/units/{unit_id}/ai-markdown` |
| [`src/features/detailed-design/api/types.ts`](../samples/frontend/src/features/detailed-design/api/types.ts) | 更新 | `UnitAiMarkdownRead` |
| [`src/features/detailed-design/api/designStagesApi.ts`](../samples/frontend/src/features/detailed-design/api/designStagesApi.ts) | 更新 | `getUnitAiMarkdown` |
| [`src/features/detailed-design/procedureDocOps.ts`](../samples/frontend/src/features/detailed-design/procedureDocOps.ts) | 更新 | `aiCopyNotices`(写した後に知らせること。純粋関数) |
| [`src/features/detailed-design/components/UnitProcedureEditor.tsx`](../samples/frontend/src/features/detailed-design/components/UnitProcedureEditor.tsx) | 更新 | `AiCopyButton`(取得 → クリップボード → 警告・失敗)、`unsaved` の prop |
| [`src/features/detailed-design/components/ProcedureDocPanel.tsx`](../samples/frontend/src/features/detailed-design/components/ProcedureDocPanel.tsx) | 更新 | `unsaved={dirty}` を渡す |
| ── ここからテスト ── | | |
| [`tests/unit/test_design_stage_ai_markdown.py`](../samples/backend/tests/unit/test_design_stage_ai_markdown.py) | 新規 | 保存済み(未承認)からの組み立てと件数・承認済み・手順書の無い単位・段階7に無い単位・開いていない段階8 |
| [`src/features/detailed-design/__tests__/procedureDocOps.test.ts`](../samples/frontend/src/features/detailed-design/__tests__/procedureDocOps.test.ts) | 更新 | `aiCopyNotices` |
| [`src/features/detailed-design/api/__tests__/designStagesApi.test.ts`](../samples/frontend/src/features/detailed-design/api/__tests__/designStagesApi.test.ts) | 更新 | `getUnitAiMarkdown` の URL |
| [`src/features/detailed-design/components/__tests__/UnitProcedureEditor.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/UnitProcedureEditor.test.tsx) | 更新 | コピーと警告・失敗・保存していない編集・手順書の無い単位 |

BE のパスは `devex-api/backend/`、FE のパスは `devex-ui/` 基準。

## 要点の抜粋

```python
# app/services/design_stage_service.py
async def unit_ai_markdown(self, project, unit_id) -> UnitAiMarkdownRead:
    _ensure_detailed(project); _ensure_open(views[8])             # 開いていなければ 409
    if find_unit(plan, unit_id) is None: raise DesignUnitNotFoundError          # 404
    model = rows[8].model                                          # 保存済み(下書き・レビュー中・古いも)
    source = procedure_output_source(project.title, views[8].state, sources.stages, model,
                                     validate_stage(8, model, sources), requirements)
    if key not in source.procedures: raise DesignUnitProcedureNotFoundError     # 404
    return UnitAiMarkdownRead(markdown=to_ai_markdown(source, key), state=..., finding_total=..., critical=...)
```

```tsx
// src/features/detailed-design/components/UnitProcedureEditor.tsx
function AiCopyButton({ projectId, unitId, unsaved })
  // 押す → getUnitAiMarkdown → navigator.clipboard.writeText → aiCopyNotices(result) を role="status" に
  // unsaved なら押せない(写す中身が画面とずれるため)。失敗は role="alert"
```

## 設計判断

### 組み立てはサーバー(計画の承認で確定)

参照の展開をバックエンドだけに置いた(Phase 28-1)のと同じ理由で、AI 向けの md もサーバーで組み立てる。画面は受け取った文字列を写すだけにし、zip の `ai/<単位ID>.md` と同じ関数(`to_ai_markdown`)を使う。デモの `toAiMarkdown` は本体へ移さない。

### 保存済みから作り、保存していない編集があれば押せない

段階8の手順書の編集は保存して初めてサーバーへ送る(Phase 28)。サーバーが保存済みの内容から組み立てるので、画面の編集が残っていると、写した中身と画面が食い違う。そのため `ProcedureDocPanel` の `dirty` を渡して押せなくし、理由を出す。

### 警告は写した後に出す(止めない)

外部設計の「未定義が残っていれば、件数を示して警告する(渡すのは止めない)」のとおり、確認のダイアログは出さない。md の先頭にも同じ警告が入るので、AI 側でも見える。画面には、未承認・古い・未定義の件数(最重要)を `aiCopyNotices` で文にして出す。件数はサーバーが返す(`finding_total`・`critical`)ので、画面の一覧と同じ数え方になる(30-1)。

### 手順書の無い単位・合わない手順書にはボタンを出さない

画面では、手順書の無い単位は生成を促す表示だけ、タスク名の合わない手順書は作り直しを促す表示だけにし、ボタンを出さない。サーバーも同じ条件(`documented_unit_ids`)で 404 を返す。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `DesignStageService.unit_ai_markdown`・ルート | pytest(`test_design_stage_ai_markdown.py`) | スタブ不要 ── DB はインメモリ SQLite(fixture)で、組み立ては純粋関数のため | 第一テスト(統合スモーク): ルートが保存済み(レビュー中)の手順書から md を作り、`state`・件数(1件・最重要1件)を返し、先頭に未承認の警告。承認済みなら状態の警告は無い(単位の ID の前後の空白は除く)。手順書の無い単位・タスク名の合わない手順書は `DesignUnitProcedureNotFoundError`、段階7に無い単位は `DesignUnitNotFoundError`、段階8が開いていなければ `DesignStageLockedError` |
| `aiCopyNotices` | vitest | スタブ不要 ── 応答の値だけから決まる純粋関数のため | 承認済みで未定義が無ければ空。未承認・古い・未定義の件数の文 |
| `getUnitAiMarkdown` | vitest | スタブ: fetch(`stubFetch`。サーバーの代わり) | URL が `/design-stages/units/M-01-T02/ai-markdown` |
| `UnitProcedureEditor`(`AiCopyButton`) | vitest + Testing Library | スタブ: `getUnitContext`・`getUnitAiMarkdown`(サーバーの代わり)、`navigator.clipboard.writeText`(ブラウザのクリップボードの代わり)、`onChange`・`onFix` | 押すとサーバーの md を写し、未承認と件数を出す。失敗の理由を出す。保存していない編集があれば押せない。手順書の無い単位にはボタンが無い |
