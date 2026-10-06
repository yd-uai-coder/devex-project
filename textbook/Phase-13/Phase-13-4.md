# Phase-13-4: zip のダウンロード(画像リンクの差し込み、`exported` にする)

## この章の目的

内部設計書の md と、文書に反映済みの図のファイル(SVG・draw.io)を zip にまとめてダウンロードさせる(D8、確定事項4)。

- zip の中の md では、アンカーの範囲の先頭に、図ファイルへの相対パスの画像リンクを入れる(DB の本文は変えない)。
- zip に入れた図は `approved` → `exported` にする。

自動実装モード: on([introduction](./Phase-13-introduction.md) 参照)。旧ルールの納期モード(旧 #21)で書いた章。zip の組み立て・ルート・ファイル名の重複回避が中心で、「入れた図を `exported` にする」判断は確定事項4で済んでいる。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/`基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| `app/uml/sync/anchors.py` | 更新 | 定型 | `ImageLink`、`with_image_links`(純粋) |
| `app/uml/sync/__init__.py` | 更新 | 定型 | `ImageLink`・`with_image_links` の re-export |
| `app/services/uml_sync_service.py` | 更新 | 定型 | `BundleFile`、`bundle`、`_unique_base`、zip の中の名前の定数 |
| [`app/api/routes/uml.py`](../samples/backend/app/api/routes/uml.py) | 更新 | 定型 | `GET /uml/bundle`(`content_disposition` を再利用) |
| ── ここからテスト ── | | | |
| `tests/unit/test_uml_sync_anchors.py` | 更新 | 定型 | 指定した図のブロックだけに画像リンクが入ること |
| `tests/unit/test_uml_sync_service.py` | 更新 | 定型 | zip の中身・`exported`・DB の本文が変わらないこと、文書に無い図を入れないこと、ファイル名の連番 |
| `tests/unit/test_uml_sync_routes.py` | 更新 | 定型 | zip の添付として返すこと |

## 要点の抜粋

```python
# app/uml/sync/anchors.py(追記)
def with_image_links(markdown: str, links: Mapping[str, ImageLink]) -> str:
    for block in reversed(parse_anchors(markdown)):      # 後ろから書き換えると前の位置がずれない
        ...
        image = f"![{link.title}](<{link.path}>)"        # 空白・日本語を含むパスは <...> で囲む
```

```python
# app/services/uml_sync_service.py(bundle の中心)
anchored = {block.diagram_id for block in parse_anchors(document.content)}
for diagram in await self._diagrams.list_for_project(project_id):
    if not _is_approved(diagram) or str(diagram.id) not in anchored:
        continue                                          # 文書に載っている承認済みの図だけ
    base = _unique_base(export_filename(model.notation, diagram.subject, "svg").removesuffix(".svg"), used_bases)
    files[f"diagrams/{base}.svg"] = _render(diagram, model, names, "svg")
    files[f"diagrams/{base}.drawio"] = _render(diagram, model, names, "drawio")
    diagram.status = STATUS_AFTER_EXPORT
with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
    archive.writestr("internal_design.md", with_image_links(document.content, links))
```

## 設計判断(要点のみ)

- **入れるのは「文書に載っている」承認済みの図だけ**。文書の再生成でアンカーが消えた図まで入れると、md から参照されないファイルが zip に混ざる。その図は `exported` にもしない。
- **画像リンクは zip の中の md だけに入れる**。DB の本文に入れると、プレビュー(13-6)で SVG と画像リンクが二重になる。
- **ファイル名は `export_filename` を共有し、衝突したら連番**。禁止文字を `_` に置き換えると、`a/b` と `a:b` が同じ名前になる。zip の中では上書きされてしまうので、2つ目以降に `_2`、`_3` を付ける。
- **zip はメモリ上で組み立てる**(`BytesIO`)。図は最大でも数十枚、1枚は数十KBなので、一時ファイルは要らない。

## テスト観点(#14)

旧ルールの納期モード(旧 #21)で書いたため、SUT・ドライバ・スタブの言語化は省略している。テストは `zipfile` で開いて、ファイル一覧・md の画像リンク・状態の変化を確かめる。

## 動作確認(実施済み)

```bash
cd devex-api/backend
uv run pytest tests/unit/test_uml_sync_anchors.py tests/unit/test_uml_sync_service.py tests/unit/test_uml_sync_routes.py
# 24 passed
uvx pyright app/uml/sync app/services/uml_sync_service.py app/api/routes/uml.py
# 0 errors
```
