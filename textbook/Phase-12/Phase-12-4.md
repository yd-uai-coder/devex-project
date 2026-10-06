# Phase-12-4: 出力 API とダウンロード用ヘッダーの共通化

## この章の目的

12-3 の出力エンジンを、HTTP から呼べるようにする。

- `GET .../diagrams/{id}/export/drawio`
- `GET .../diagrams/{id}/export/svg`

出力は、承認済み・出力済みの図だけに許す。出力に成功したら、`approved` を `exported` にする(M7)。

ダウンロードの `Content-Disposition` ヘッダーを組み立てる関数は、Phase 2-5 で文書のダウンロード用に `routes/projects.py` の中に書いた。UML の出力が2つ目の利用者になるので、`app/api/responses.py` へ移して共有する(#17)。

自動実装モード: on([introduction](./Phase-12-introduction.md) 参照)。旧ルールの納期モード(旧 #21)で書いた章。#14 の SUT/ドライバ/スタブの言語化は省略し、テストの一覧だけを載せる。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/`基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/api/responses.py`](../samples/backend/app/api/responses.py) | 新規 | 定型 | `content_disposition(filename)`(`routes/projects.py` の `_content_disposition` を移したもの) |
| [`app/api/routes/projects.py`](../samples/backend/app/api/routes/projects.py) | 更新 | 定型 | `_content_disposition` を削除し、`app.api.responses.content_disposition` を使う |
| [`app/services/errors.py`](../samples/backend/app/services/errors.py) | 更新 | 定型 | `UmlDiagramNotApprovedError`(409 `UML_DIAGRAM_NOT_APPROVED`) |
| [`app/services/uml_diagram_service.py`](../samples/backend/app/services/uml_diagram_service.py) | 更新 | 定型 | `export(project_id, diagram_id, fmt) -> ExportedFile`、`ExportFormat`、題名とファイル名の組み立て |
| [`app/api/routes/uml.py`](../samples/backend/app/api/routes/uml.py) | 更新 | 定型 | `export_diagram_drawio`・`export_diagram_svg`(共通部分は `_export`) |
| ── ここからテスト ── | | | |
| [`tests/unit/test_uml_diagram_service.py`](../samples/backend/tests/unit/test_uml_diagram_service.py) | 更新 | 定型 | 出力で `exported`(version は不変)、出力済みからの再出力、未承認の拒否、ファイル名の禁止文字 |
| [`tests/unit/test_uml_diagram_routes.py`](../samples/backend/tests/unit/test_uml_diagram_routes.py) | 更新 | 定型 | `Content-Disposition`・media type・本文、未承認の拒否 |
| [`tests/unit/test_document_download.py`](../samples/backend/tests/unit/test_document_download.py) | 更新 | 定型 | import 先を `app.api.responses` に変える(テストの中身は不変) |

## 要点の抜粋

```python
# app/services/uml_diagram_service.py(export)
diagram = await self._get_owned(project_id=project_id, diagram_id=diagram_id)
if not can_export(parse_status(diagram.status)):          # approved / exported だけ(409)
    raise UmlDiagramNotApprovedError(...)
model = SemanticModelAdapter.validate_python(diagram.semantic_model)
_ensure_layout_covers(diagram, model)                      # 12-1 と共有
render = build_render(model, LayoutModel.model_validate(diagram.layout_model),
                      edge_labels(model, await self._data_item_names(diagram, model)))  # 12-2 と共有
content = to_drawio(render, diagram_id=str(diagram.id), title=title) if fmt == "drawio" else to_svg(render)
diagram.status = STATUS_AFTER_EXPORT                       # version は増やさない
return ExportedFile(filename=_export_filename(...), content=content, media_type=_MEDIA_TYPES[fmt])
```

```python
# ファイル名: {notation}[_{subject}].{拡張子}。subject の禁止文字は "_" に置き換える
_UNSAFE_FILENAME_CHARS = re.compile(r'[\\/:*?"<>|\x00-\x1f]')
# "DF-1: POST /api/v1/reservations" → "dfd_DF-1_ POST _api_v1_reservations.svg"
```

```python
# app/api/routes/uml.py
@router.get("/diagrams/{diagram_id}/export/drawio")
async def export_diagram_drawio(diagram_id, session, current_project) -> Response:
    return await _export(diagram_id, "drawio", session, current_project)
# _export は Response(content, media_type, headers={"Content-Disposition": content_disposition(...)})
```

## 設計判断(要点のみ)

- **GET で状態を変える**。docs の API 表(`GET .../export/drawio`)に合わせた。状態の変化は `approved → exported` の一方向だけで、何度出力しても `exported` のままなので冪等である。出力を記録する POST を別に設ける案もあったが、ユーザー確定事項1で、この形に決めた。
- **media type**: draw.io は `application/xml`、SVG は `image/svg+xml`。`.drawio` の中身は mxfile の XML で、ファイル名の拡張子で draw.io に関連付く。
- **題名**: draw.io のページ名(`<diagram name>`)には、FE の `diagramTitle` と同じ題名(`データフロー図: DF-1 ...`、`コンポーネント図(全体)`)を使う。
- **`content_disposition` の移動(#17)**: Phase 2-5 の文書ダウンロードと、UML の出力という2つの実在する利用者がいるので、共有した。移動先の `app/api/responses.py` はルート層の部品で、サービス層は HTTP ヘッダーを知らない。

## テスト(旧ルールの納期モードのため一覧のみ)

- `test_uml_diagram_service.py`:
  - `test_export_drawio_marks_diagram_exported`
  - `test_export_svg_can_be_repeated_after_exported`
  - `test_export_rejects_diagram_that_is_not_approved`
  - `test_export_filename_replaces_unsafe_characters_in_subject`
- `test_uml_diagram_routes.py`:
  - `test_export_diagram_drawio_returns_attachment`(`content_disposition` を import して、ヘッダーの期待値を作る)
  - `test_export_diagram_svg_returns_svg`
  - `test_export_diagram_rejects_unapproved_diagram`
- `test_document_download.py`: 既存の `test_content_disposition_includes_ascii_fallback_and_utf8_filename` が、移した `content_disposition` をそのまま検証する。

## 動作確認(実施済み)

```bash
cd devex-api/backend
uv run pytest tests/unit/test_uml_diagram_service.py tests/unit/test_uml_diagram_routes.py tests/unit/test_document_download.py
# 49 passed
uv run pytest
# 382 passed, 5 deselected(Phase 完了時の全体テスト)
uv run ruff check app tests && uvx pyright
# All checks passed! / 既知の1件のみ
```
