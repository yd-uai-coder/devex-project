# Phase-13-2: 反映サービス(in-place 更新、承認時の自動反映、一括の再反映 API)

## この章の目的

13-1 の純粋関数を使って、承認済みの図の要素表を内部設計書に書き込む。

- 承認(`POST .../approve`)と同じトランザクションで、その図を反映する(確定事項1)。
- 書き込み先は表示中の版(`is_current`)で、版は増やさない(D1 案A)。
- 文書を再生成・復元してアンカーが消えたときのために、承認済みの図すべてを反映し直す API(`POST /uml/reflect`)を足す。

あわせて、Phase 12-4 でサービスの中に置いた題名・ファイル名・形式の分岐を、`app/uml/export/files.py` へ移す。反映・埋め込み・zip のサービスと共有するためである。

学習モード([introduction](./Phase-13-introduction.md)参照)。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/`基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/uml/export/files.py`](../samples/backend/app/uml/export/files.py) | 新規 | 定型 | `ExportFormat`・`MEDIA_TYPES`・`diagram_title`・`export_filename`・`render_content`(12-4 から移した) |
| [`app/uml/export/__init__.py`](../samples/backend/app/uml/export/__init__.py) | 更新 | 定型 | `files.py` の公開名を re-export する |
| [`app/repositories/generated_document.py`](../samples/backend/app/repositories/generated_document.py) | 更新 | **コア** | `update_content_in_place`(版を増やさずに本文を書き換える。D1 案A) |
| [`app/services/doc_generator_service.py`](../samples/backend/app/services/doc_generator_service.py) | 更新 | 定型 | `restore_version` の docstring に、書き換えの例外(反映)を明記 |
| [`app/services/uml_sync_service.py`](../samples/backend/app/services/uml_sync_service.py) | 新規 | **コア** | `UmlSyncService.reflect`・`reflect_all`、`_is_approved`、`_apply` |
| [`app/services/uml_diagram_service.py`](../samples/backend/app/services/uml_diagram_service.py) | 更新 | **コア** | `approve` の中で `reflect` を呼ぶ。題名・ファイル名・形式の分岐を `files.py` の関数に置き換える |
| [`app/schemas/uml_diagram.py`](../samples/backend/app/schemas/uml_diagram.py) | 更新 | 定型 | `UmlReflectRead {reflected}` |
| [`app/api/routes/uml.py`](../samples/backend/app/api/routes/uml.py) | 更新 | 定型 | `POST /uml/reflect` |
| ── ここからテスト ── | | | |
| [`tests/fixtures/uml.py`](../samples/backend/tests/fixtures/uml.py) | 更新 | 定型 | `TWO_MODULES`、`create_approved_diagram`(保存 → 自動レイアウト → 承認) |
| [`tests/unit/test_generated_document_repository.py`](../samples/backend/tests/unit/test_generated_document_repository.py) | 更新 | 定型 | in-place 更新で版と他の版が変わらないこと |
| [`tests/unit/test_uml_export_files.py`](../samples/backend/tests/unit/test_uml_export_files.py) | 新規 | 定型 | 移した関数が移す前と同じ結果になること |
| [`tests/unit/test_uml_sync_service.py`](../samples/backend/tests/unit/test_uml_sync_service.py) | 新規 | **コア** | 承認で反映・版は据え置き、文書が無くても承認できる、再生成で消えたら再反映、未承認は反映しない、文書が無ければ 404 |
| [`tests/unit/test_uml_sync_routes.py`](../samples/backend/tests/unit/test_uml_sync_routes.py) | 新規 | 定型 | 反映した数を返す、文書が無ければ 404 |

`uml_diagram_service.py` は `uml_sync_service.py` を import するので、表では後者を先に置いた(#30)。

## 要点の抜粋

```python
# app/repositories/generated_document.py(追記)
async def update_content_in_place(self, document: GeneratedDocument, content: str) -> GeneratedDocument:
    document.content = content        # 版は増やさず、他の版も消さない(D1 案A)
    await self._session.flush()
    return document
```

```python
# app/services/uml_sync_service.py
async def reflect(self, diagram: UmlDiagram) -> bool:      # commit しない(承認と同じトランザクション)
    document = await self._documents.get_current(project_id=diagram.project_id, doc_type=SOURCE_DOC_TYPE)
    if document is None or not _is_approved(diagram):
        return False                                        # 文書が無くても承認は妨げない
    data_items = await self._data_item_summaries(diagram.project_id)
    content = _apply(document.content, diagram, data_items)
    if content != document.content:
        await self._documents.update_content_in_place(document, content)
    return True

async def reflect_all(self, project_id) -> int:            # 承認済みの図すべて。commit する。文書が無ければ404

def _is_approved(diagram) -> bool:                          # 承認済み・出力済みで、AI 生成中でない
    return diagram.generation_status != "generating" and can_export(parse_status(diagram.status))

def _apply(content, diagram, data_items) -> str:            # 13-1 の純粋関数を組み合わせるだけ
    body = render_block_body(diagram_title(...), render_element_table(model, data_items))
    return upsert_block(content, diagram_id=str(diagram.id), version=diagram.version, body=body, ...)
```

```python
# app/services/uml_diagram_service.py(approve の末尾)
diagram.status = STATUS_AFTER_APPROVE
await self._sync.reflect(diagram)     # 同じトランザクションで内部設計書へ反映する
await self._session.flush()
await self._session.commit()
```

依存の向きは、`uml_diagram_service` → `uml_sync_service` → (`app/uml/sync`・`app/uml/export`・リポジトリ) である。`uml_sync_service` は `uml_diagram_service` を import しない。

## 設計判断

### 版を増やさずに書き換える(D1 案A)

`create_version` で反映すると、次の2つの問題が起きる。

- 版は3件までしか保持しない。反映を3回すると、AI が生成した原本が押し出されて消える。
- Phase 6 で「復元は新しい版を作らない」と決めたのと同じ理由(保持数の無駄な消費)が、そのまま当たる。

反映する内容は、正本(`uml_diagrams`)から決定的に作り直せる。履歴に残す価値は低いので、表示中の版を書き換える。その代わり、文書の再生成・復元で反映が消えるので、再反映の API と陳腐化の検知(13-3)が前提になる。

`restore_version` の docstring には「既存版の内容も書き換えない」とある。例外が1つあることを、同じ docstring に書き足した。不変条件を破る箇所を、不変条件が書いてある場所から辿れるようにするためである。

### 承認と同じトランザクションにする(確定事項1)

`reflect` は commit しない。承認の commit で、状態の変更と文書の書き換えが一緒に確定する。「承認されたのに文書に無い」「文書にあるのに承認されていない」という中途半端な状態が、DB に残らない。

内部設計書が無いプロジェクトでも承認はできる。反映は承認の条件ではなく、承認の結果だからである。

### サービス同士の循環を避ける

承認(`UmlDiagramService`)が反映(`UmlSyncService`)を呼ぶ。反映・埋め込み・zip も「題名」「ファイル名」「形式ごとの書き出し」を使う。これらが `UmlDiagramService` のモジュール関数のままだと、`uml_sync_service` が `uml_diagram_service` を import することになり、循環する。

そこで、12-4 の関数を I/O の無い `app/uml/export/files.py` へ移した(#17: 共有を選ぶ。今の消費者は `export`・`reflect`・13-3 の埋め込み・13-4 の zip)。ルートは `ExportFormat` を `uml_diagram_service` から import しているので、サービスは `app.uml.export` から取り込んだ名前をそのまま公開する。ルートは変えずに済む。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `update_content_in_place` | pytest(インメモリ SQLite) | スタブ不要。外部呼び出しが無いため | 版番号・他の版・`is_current` が変わらないこと |
| `diagram_title`・`export_filename`・`render_content` | pytest | スタブ不要。純粋関数のため | 移す前(12-4 のテスト)と同じ期待値 |
| `UmlSyncService.reflect`(`UmlDiagramService.approve` 経由)・`reflect_all` | pytest(インメモリ SQLite、`create_approved_diagram`) | スタブ不要。レイアウト・描画は実エンジンを使い、LLM を呼ばないため | 再生成は `create_version` を直接呼んで再現する |
| `reflect_diagrams`(ルート関数) | pytest(ルート関数を直接呼ぶ) | スタブ不要 | 件数と 404 |

`create_approved_diagram` は、Phase 12 のテストの `_laid_out_diagram`(保存 → 自動レイアウト)に承認を足したものを、`tests/fixtures/uml.py` へ置いた。13-3・13-4 のテストでも共有するためである。

## 動作確認(実施済み)

```bash
cd devex-api/backend
uv run pytest tests/unit/test_generated_document_repository.py tests/unit/test_uml_export_files.py \
  tests/unit/test_uml_sync_service.py tests/unit/test_uml_sync_routes.py \
  tests/unit/test_uml_diagram_service.py tests/unit/test_document_versions.py
# 66 passed(13-3・13-4 の追記分を含む最終状態での件数)
```
