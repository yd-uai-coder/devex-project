# Phase-17-4: DFD・データ辞書の編集による段階2の差し戻し(BE)

## この章の目的

段階2の内容のうち、段階の外に正本があるもの(DFD・データ辞書)を人が直したとき、承認済みの段階2を「レビュー中」に戻し、版を増やす。段階3以降に「古い」が伝わるようにするためである。

自動実装モード: on([introduction](./Phase-17-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/services/design_stage_service.py`](../samples/backend/app/services/design_stage_service.py) | 更新 | **コア** | `mark_edited`(承認済みの段階を `reviewing`・`version+1` にする。commitしない) |
| [`app/services/uml_diagram_service.py`](../samples/backend/app/services/uml_diagram_service.py) | 更新 | **コア** | DFD の保存(`update`)・自動レイアウト(`compute_layout`)で `_reopen_data_flow_stage` |
| [`app/services/data_item_service.py`](../samples/backend/app/services/data_item_service.py) | 更新 | **コア** | データ項目の作成・更新・削除で段階2を差し戻す |
| ── ここからテスト ── | | | |
| [`tests/unit/test_design_stage_reopen.py`](../samples/backend/tests/unit/test_design_stage_reopen.py) | 新規 | **コア** | DFD の保存・配置、データ項目の作成・更新・削除で差し戻ること、承認済みでない段階・簡易ドキュメントモードは何もしないこと |

## 要点の抜粋

```python
# app/services/design_stage_service.py
async def mark_edited(self, project_id: uuid.UUID, stage: int) -> bool:
    row = await self._stages.get(project_id=project_id, stage=stage)
    if row is None or row.status != "approved":
        return False                 # 承認済みでない段階・行の無い簡易ドキュメントモードは何もしない
    row.status = STATUS_AFTER_EDIT   # reviewing(段階の保存と同じ扱い)
    row.version += 1                 # 後ろの段階は「承認した版の番号」で陳腐化を判定する
    return True
```

```python
# app/services/uml_diagram_service.py(update と compute_layout の、図の状態を戻す箇所の直後)
diagram.status = STATUS_AFTER_EDIT
await self._reopen_data_flow_stage(diagram)     # notation == "dfd" なら mark_edited(project_id, 2)
```

```python
# app/services/data_item_service.py(create / update / delete の commit の前)
await self._stages.mark_edited(project_id, DATA_FLOW_STAGE)
```

## 設計判断

### 差し戻さないと何が起きるか

段階3(データモデル)は、段階2の承認した版の番号を `input_fingerprint` に記録する([Phase 15](../Phase-15/Phase-15-2.md) の陳腐化)。DFD やデータ辞書は段階2の `model` の外にあるので、直しても段階2の版は変わらない。すると段階3は、古い DFD から作った CRUD 図のまま「古い」にならない。

そこで、段階の外の正本を直したら、段階の保存と同じ扱い(`reviewing`・`version+1`)にする。人が段階2を承認し直すと、段階3に「古い」が出る。

### DFD の配置だけの保存・自動レイアウトでも差し戻す

計画では「意味モデルが変わった保存だけ」としていた。しかし DFD 自体が、配置だけの保存・自動レイアウトでも承認をやり直す(M7、[Phase 12](../Phase-12/Phase-12-introduction.md))。段階2だけ承認済みのまま残すと、「段階2は承認済みなのに、その DFD は未承認」という食い違いが起き、検証の `DFD_NOT_APPROVED` がエラーのまま段階2が承認済みに見える。図の承認がやり直しになる操作は、すべて段階2も差し戻すことにした(計画からの変更)。

### AI の生成からの書き込みは差し戻さない

`resolve_by_name`(17-3)と段階2の生成の `_save_group_dfd` は、`mark_edited` を呼ばない。生成は段階2自身の行を `draft`/`regenerated`・`version+1` にするので、別に差し戻す必要が無い。

### 呼ぶのはサービス層、commit は呼び出し元

`mark_edited` は commit しない。DFD の保存・データ項目の編集と同じトランザクションで段階の行を書き、片方だけが残らないようにする。依存の向きは `uml_diagram_service・data_item_service → design_stage_service` の一方向で、循環しない(`design_stage_service` は両者を import しない)。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `DesignStageService.mark_edited` と、それを呼ぶ `UmlDiagramService.update`・`compute_layout`、`DataItemService.create`・`update`・`delete` | pytest(サービスのメソッドを直接呼ぶ) | スタブ不要。LLM を呼ばない。DB はインメモリ SQLite で、段階の行の状態と版が変わることそのものが検証対象 | 第一テストの統合スモーク(承認済みの段階2が、DFD の保存でレビュー中・版+1 になる)。自動レイアウト、データ項目の3操作、承認済みでない段階・簡易ドキュメントモード |

## 動作確認(実施済み)

```bash
cd devex-api/backend
uv run pytest tests/unit/test_design_stage_reopen.py tests/unit/test_data_item_service.py tests/unit/test_uml_diagram_service.py
# 39 passed
```
