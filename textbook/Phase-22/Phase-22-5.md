# Phase-22-5: 図の描画の共通化・出力サービス・ルート(BE)

## この章の目的

DB から段階の状態と承認済みの内容・図・データ辞書を読み、図を描いて、22-3・22-4 の md・HTML と一緒に zip にして返す。`GET /api/v1/projects/{id}/design-stages/document` で詳細設計書をダウンロードできるようにする。

- 図の描画と zip の名前の重複除けは、ステージ3の zip(`uml_sync_service`)と同じ関数を使う(#17)。
- zip に入れた図は `exported` にする。

自動実装モード: on([introduction](./Phase-22-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/uml/export/files.py`](../samples/backend/app/uml/export/files.py) | 更新 | 定型 | `render_diagram`(意味モデル+配置+データ辞書の名前 → SVG/drawio)・`unique_base` を `uml_sync_service` から移した |
| [`app/uml/export/__init__.py`](../samples/backend/app/uml/export/__init__.py) | 更新 | 定型 | 上の2つの re-export |
| `app/services/uml_sync_service.py` | 更新 | 定型 | `_render` は `render_diagram` を呼ぶだけに、`_unique_base` を削除して `unique_base` を使う |
| [`app/services/design_stage_service.py`](../samples/backend/app/services/design_stage_service.py) | 更新 | 定型 | `overview(project)`: 全段階の状態と `StageSources`(承認済みの内容)を返す |
| [`app/services/detailed_design_export_service.py`](../samples/backend/app/services/detailed_design_export_service.py) | 新規 | **コア** | `DetailedDesignExportService.bundle(project)`、`DOCUMENT_FILENAME` などの名前、`_is_approved` |
| [`app/api/routes/design_stages.py`](../samples/backend/app/api/routes/design_stages.py) | 更新 | 定型 | `GET /document`(zip を `Content-Disposition` 付きで返す) |
| ── ここからテスト ── | | | |
| [`tests/fixtures/detailed_design.py`](../samples/backend/tests/fixtures/detailed_design.py) | 更新 | 定型 | `create_document_project`(段階1〜6を承認し、図に配置を持たせる) |
| [`tests/unit/test_detailed_design_export.py`](../samples/backend/tests/unit/test_detailed_design_export.py) | 新規 | 定型 | `overview`、zip の構成、図の `exported`、未承認の章と図、簡易モードの 409、ルート、共通化した描画とステージ3の zip |

## 要点の抜粋

```python
# app/uml/export/files.py(Phase 13 の uml_sync_service._render・_unique_base から移した)
def render_diagram(model, layout_model, data_item_names, fmt, *, diagram_id, title) -> str:
    layout = LayoutModel.model_validate(layout_model)
    render = build_render(model, layout, edge_labels(model, data_item_names))
    return render_content(render, fmt, diagram_id=diagram_id, title=title)

def unique_base(base, used) -> str: ...      # 2つ目以降に _2, _3 …
```

```python
# app/services/detailed_design_export_service.py
DOCUMENT_FILENAME = "detailed_design.zip"     # 中身: detailed_design.html / .md / diagrams/*

async def bundle(self, project) -> BundleFile:
    views, sources = await self._stages.overview(project)    # 簡易モードは 409
    approved = sources.stages                                # 承認済みの段階の内容だけ
    # 承認済みの章の図だけを描く: 段階2 → dfd_groups の DFD、段階3 → ER、段階4 → 構成図
    #   add(diagram): 承認済み・出力済みで、生成中でなく、配置がある図 → SVG・drawio を files へ
    source = document_source(project.title, states, approved, dfd_diagrams=..., er=..., ...)
    # zip に to_html(source)・to_markdown(source)・図を書く → 入れた図を exported → commit
```

```python
# app/api/routes/design_stages.py
@router.get("/document")
async def download_detailed_design(session, current_project) -> Response:
    bundle = await DetailedDesignExportService(session).bundle(current_project)
    return Response(content=bundle.content, media_type=bundle.media_type,
                    headers={"Content-Disposition": content_disposition(bundle.filename)})
```

`BundleFile`(ファイル名・中身・形式)は `uml_sync_service` のものを使う。出力サービスは `DesignStageService` を呼び、`uml_sync_service` からは `BundleFile` だけを import する(承認が反映を呼ぶ向きの循環は起きない)。

## 設計判断

### 描画を共通化する(#17)

ステージ3の zip と詳細設計書の zip は、同じ図を同じ見た目で描く必要がある(同じ図を両方からダウンロードすることもある)。`_render`・`_unique_base` を出力サービスにコピーすると、規則が2か所に分かれる。#17 の判定「この共通化を今駆動している、この Phase の実在の消費者は何か」には、`DetailedDesignExportService` と答えられる。そこで純粋関数のモジュール `app/uml/export/files.py`(Phase 13 で同じ理由で作った置き場)へ移した。`_render` は ORM の行を受け取る形のまま残し、中身を `render_diagram` に任せた(`uml_sync_service` の呼び出し側を変えないため)。

### 承認済みの章の図だけを載せる

章が「未承認」なら、その章の図も載せない(段階2が未承認なら DFD のファイルも zip に入らない)。図そのものが承認済みでも、段階の承認が済んでいなければ章としては確定していないため。逆に、章が承認済みなら図も承認済みのはずである(段階2〜4の承認には図の承認が要る)。配置の無い図は描けないので載せず、md・HTML には「図がありません」と出す。図の承認には配置が要るので、通常は起きない(テスト用の fixture だけが配置なしで承認済みにしている)。

### 入れた図は `exported` にする

ステージ3の zip と同じく、ファイルとして出力した記録を図の状態に残す。出力済みの図も承認済みとみなすので(`APPROVED_DIAGRAM_STATUSES`)、段階は差し戻されない。テストでもこの点を確かめている。

### `overview` を足した

組み立てに要るのは、全段階の状態と承認済みの内容である。`DesignStageService` の `_load`・`_sources` はどちらも private だったので、2つを続けて呼ぶ公開の入口を足した。詳細設計モードでないプロジェクトは、既存の `_ensure_detailed` で 409(`DESIGN_STAGES_NOT_AVAILABLE`)になる。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `unique_base` | pytest | スタブ不要。純粋関数 | `_2`・`_3` |
| `DesignStageService.overview` | pytest | なし。テスト用のインメモリ SQLite(`db_session`) | 承認済みの段階1・2だけが `sources.stages` に入る |
| `DetailedDesignExportService.bundle` | pytest | なし。DB はインメモリ SQLite、図はレイアウトエンジンで実際に配置する | 第一テストの統合スモーク(段階1〜6を承認した fixture で、zip に html・md・図6ファイルがそろう)。図が `exported` になり段階は承認済みのまま、未承認の段階3の章と ER が出ない、簡易モードは 409 |
| `download_detailed_design`(ルート) | pytest(ハンドラを直接呼ぶ。ステージ3のルートのテストと同じ形) | なし。同上 | `application/zip` と `Content-Disposition` |
| `render_diagram`・`uml_sync_service._render` | pytest | なし。同上 | 共通化した描画で SVG が出て、ステージ3の zip(`download_bundle`)も図を入れられる(リファクタの番人) |

組み立て(md・HTML)の中身は 22-3・22-4 の純粋関数のテストで確かめたので、ここでは zip の構成・章の状態・図の状態の変化だけを見る。

## 動作確認(実施済み)

```bash
cd devex-api/backend
uv run pytest tests/unit/test_detailed_design_export.py tests/unit/test_uml_sync_service.py tests/unit/test_uml_sync_routes.py
# 24 passed
```
