# Phase-13-3: 陳腐化の判定(純粋)と、埋め込み用 API(SVG と状態)

## この章の目的

図と内部設計書の食い違い(陳腐化)を、2つの向きで判定する(診断7の双方向化、確定事項3)。

- **図が古い**(`source_outdated`): 図を生成した後に、内部設計書が再生成・復元された。
- **文書が古い**(`doc_state`): 文書に反映した内容が、図の今の状態と違う(承認後に編集された、再生成で反映が消えた、など)。

判定は純粋関数 `diagram_sync_state` にまとめる。あわせて、文書のプレビュー(13-6)に差し込む SVG と判定結果を返す `GET /uml/embeds` を足す。

学習モード([introduction](./Phase-13-introduction.md)参照)。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/`基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/uml/sync/staleness.py`](../samples/backend/app/uml/sync/staleness.py) | 新規 | **コア** | `DocState`、`SyncState`、`diagram_sync_state` |
| [`app/uml/sync/__init__.py`](../samples/backend/app/uml/sync/__init__.py) | 更新 | 定型 | `staleness.py` の公開名を re-export する |
| [`app/schemas/uml_diagram.py`](../samples/backend/app/schemas/uml_diagram.py) | 更新 | 定型 | `UmlEmbedRead`(図の題名・状態・version・食い違い・SVG) |
| [`app/services/uml_sync_service.py`](../samples/backend/app/services/uml_sync_service.py) | 更新 | **コア** | `DiagramEmbed`、`list_embeds`、`_data_item_names`、`_render`(出力と同じ規則で描く。状態は変えない) |
| [`app/api/routes/uml.py`](../samples/backend/app/api/routes/uml.py) | 更新 | 定型 | `GET /uml/embeds` |
| ── ここからテスト ── | | | |
| [`tests/unit/test_uml_sync_staleness.py`](../samples/backend/tests/unit/test_uml_sync_staleness.py) | 新規 | **コア** | 状態×アンカーの表、版の比較(復元で下がる場合を含む) |
| [`tests/unit/test_uml_sync_service.py`](../samples/backend/tests/unit/test_uml_sync_service.py) | 更新 | **コア** | 再承認で同じ位置の置き換え、状態を変えない SVG、再生成後の双方向の判定、レビュー中の扱い |
| [`tests/unit/test_uml_sync_routes.py`](../samples/backend/tests/unit/test_uml_sync_routes.py) | 更新 | 定型 | ルートが状態と SVG を詰め替えること |

## 要点の抜粋

```python
# app/uml/sync/staleness.py
DocState = Literal["reflected", "not_reflected", "outdated", "not_applicable"]

def diagram_sync_state(*, status, version, source_doc_version, current_doc_version, anchor_version) -> SyncState:
    source_outdated = (
        source_doc_version is not None
        and current_doc_version is not None
        and source_doc_version != current_doc_version     # 「等しくない」で比べる
    )
    return SyncState(source_outdated=source_outdated, doc_state=_doc_state(status, version, anchor_version))

def _doc_state(status, version, anchor_version) -> DocState:
    if can_export(status):                                # 承認済み(approved / exported)
        if anchor_version is None:
            return "not_reflected"
        return "reflected" if anchor_version == version else "outdated"
    return "not_applicable" if anchor_version is None else "outdated"
```

```python
# app/services/uml_sync_service.py(list_embeds の中心)
anchors = {block.diagram_id: block for block in parse_anchors(document.content)}
state = diagram_sync_state(
    status=parse_status(diagram.status),
    version=diagram.version,
    source_doc_version=(diagram.source_doc_versions or {}).get(SOURCE_DOC_TYPE),
    current_doc_version=document.version,
    anchor_version=anchor.version if anchor is not None else None,
)
svg = _render(diagram, model, names, "svg") if _is_approved(diagram) else None   # 状態は変えない
```

`staleness.py` は `app.uml.domain`(`DiagramStatus`・`can_export`)だけに依存する。`__init__.py` に `DocState`・`SyncState`・`diagram_sync_state` を re-export として追記した。

## 設計判断

### DB の列を足さず、3つの版の比較だけで決める

判定に使うのは、次の3つの版である。

| 版 | 持っている場所 | 書かれるとき |
|---|---|---|
| 図を生成した内部設計書の版 | `uml_diagrams.source_doc_versions` | AI 生成(Phase 10) |
| 表示中の内部設計書の版 | `generated_documents.version`(`is_current`) | 文書の生成・復元 |
| 文書に反映した図の版 | アンカーの `v=` | 反映(13-2) |

「反映した版」をアンカーの中に持たせたので、文書を復元すると、その版に反映してあったアンカー(古い `v=`)が一緒に戻る。判定はその文書の中身だけで正しく出る。DB の列に持たせると、復元のたびに列を書き換える処理が要り、書き換え忘れで食い違う。

### 「等しくない」で比べる

復元すると、表示中の版の番号が下がることがある(版3を表示していたところから版2へ戻す)。図が版3から作られていれば、版2の文書に対しては古い。「図の版 < 文書の版」で比べると、この場合を見逃す。

### レビュー中の図のブロックは「古い」

承認済みの図を保存し直すと `reviewing` に戻る(Phase 12)。文書には前回承認したときの要素表が残っている。消すと、承認し直すまで文書から図の説明が消えてしまう。そのため、残したまま `outdated` と表示し、SVG は返さない(承認されていない図の画像を文書に出さない)。

### プレビューでは `exported` にしない

SVG は出力(`UmlDiagramService.export`)と同じ規則(`build_render` → `render_content`)で描く。ただし `export` を呼ぶと状態が `exported` になる。`exported` は「図のファイルを出力した記録」であり、プレビューで見ただけでは記録しない。描画だけを `_render` にして、状態を変えずに使う。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `diagram_sync_state` | pytest(parametrize) | スタブ不要。版と状態を受け取って判定を返す純粋関数のため | `staleness.py` の docstring の表を、そのままテストの表にした |
| `UmlSyncService.list_embeds`・再承認 | pytest(インメモリ SQLite) | スタブ不要。外部呼び出しが無いため | 再生成は `create_version`、承認後の編集は `UmlDiagramService.update` で再現する |
| `list_embeds`(ルート関数) | pytest(ルート関数を直接呼ぶ) | スタブ不要 | サービスの結果をスキーマへ詰め替えること |

**判定の規則(純粋)と、判定に渡す版を集める処理(サービス)を分けた**。規則の網羅は DB 無しで行い、サービスのテストは「再生成」「編集」といった実際の操作の後に正しい版が渡ることだけを見る。

## 動作確認(実施済み)

```bash
cd devex-api/backend
uv run pytest tests/unit/test_uml_sync_staleness.py tests/unit/test_uml_sync_service.py tests/unit/test_uml_sync_routes.py
# 27 passed(13-4 の追記分を含む最終状態での件数)
```
