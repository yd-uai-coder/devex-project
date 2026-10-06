# Phase-22-1: 組み立ての入力と章の状態(BE)

## この章の目的

詳細設計書の組み立てに使う値を1つの `DocumentSource` にまとめ、章ごとの状態(承認/省略/未承認)を決める純粋関数を作る。ここから先(22-2〜22-4)の導出と書き出しは、すべてこの入力だけを見る。

- 01〜06章は段階1〜6と1対1(07 横断事項は Phase 23 で決める。着手時の決定2)。
- 承認済みの段階だけを本文に組み立てる。未承認・未着手・古い段階の章は「未承認」、0件で承認した段階6は「省略」にする(着手時の決定3)。

自動実装モード: on([introduction](./Phase-22-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/detailed_design/document/source.py`](../samples/backend/app/detailed_design/document/source.py) | 新規 | **コア** | `ChapterStatus`・`Chapter`・`CHAPTERS`・`RenderedDiagram`・`DataItemEntry`・`DocumentSource`、`chapter_status`・`chapter_statuses`・`document_source`(純粋) |
| [`app/detailed_design/document/__init__.py`](../samples/backend/app/detailed_design/document/__init__.py) | 新規 | 定型 | `source` の公開名の re-export(22-2〜22-4 で追記) |
| ── ここからテスト ── | | | |
| [`tests/fixtures/detailed_design.py`](../samples/backend/tests/fixtures/detailed_design.py) | 更新 | 定型 | `document_stage_models(dfd_groups?)`(段階1〜6の検証を通る内容一式)・`ALL_APPROVED` |
| [`tests/unit/test_detailed_design_document_source.py`](../samples/backend/tests/unit/test_detailed_design_document_source.py) | 新規 | **コア** | 章の並び、状態の決め方(省略を含む)、承認済みの内容だけを渡すこと |

## 要点の抜粋

```python
# app/detailed_design/document/source.py
ChapterStatus = Literal["approved", "skipped", "unapproved"]

CHAPTERS = (Chapter(1, "01", "機能(処理)一覧"), ..., Chapter(6, "06", "処理ロジックの詳細"))

@dataclass(frozen=True)
class RenderedDiagram:          # 描画済みの図(描画はサービスの責務。22-5)
    title: str
    path: str                   # zip の中の SVG のパス(md の画像の参照先)
    svg: str                    # HTML に埋め込む SVG

@dataclass(frozen=True)
class DocumentSource:
    title: str
    chapters: Mapping[int, ChapterStatus]
    function_list: FunctionListModel | None = None   # 承認していない段階は None
    data_flow: ... ; crud: ... ; modules: ... ; procedures: ... ; logics: ...
    dfd_diagrams: Mapping[str, RenderedDiagram]      # 機能グループ → DFD
    dfd_models: tuple[Mapping[str, Any], ...]        # データ辞書の使う処理・CRUD の記号に使う
    data_items: tuple[DataItemEntry, ...]
    er: ErSemanticModel | None; er_diagram: ...; component_diagram: ...

def chapter_status(stage, state, model) -> ChapterStatus:
    if state != "approved": return "unapproved"
    if stage == LOGIC_STAGE and not LogicModel.model_validate(model or {}).logics: return "skipped"
    return "approved"

def document_source(title, states, models, *, dfd_diagrams=None, ..., component_diagram=None) -> DocumentSource
```

```python
# app/detailed_design/document/__init__.py(22-1 の時点)
from app.detailed_design.document.source import (CHAPTERS, Chapter, ChapterStatus, DataItemEntry,
    DocumentSource, RenderedDiagram, chapter_status, chapter_statuses, document_source)
```

依存の向きは `source → 以前の Phase の model(function_list・data_flow・data_model・structure・procedure・logic・stages)`。DB と図の描画を知らない。親パッケージ(`app.detailed_design`)の `__init__` からは re-export しない。組み立てを使うのは出力のサービスだけで、段階の検証・生成からは使わないため。

## 設計判断

### 承認していない段階の内容は本文に出さない

`DesignStageService` の `StageSources.stages` は、もともと「承認済み(古くない)段階の内容」だけを持つ(後ろの段階は承認済みの前の段階だけを入力にする、という Phase 15 の規則)。組み立ても同じ規則に乗せた。

| 案 | 採否 | 理由 |
|---|---|---|
| 承認済みだけを本文にし、他は「未承認」とだけ書く | **採用** | 人が確定していない内容を、成果物として配らない。`StageSources.stages` をそのまま使える |
| 保存済みの最新の内容を「未承認」の印つきで出す | 不採用 | 承認した版の内容は別に保存していないので、承認後に編集すると承認していない内容が出てしまう |
| 段階1〜6がすべて承認済みのときだけダウンロードできる | 不採用 | 途中の段階でも、承認済みの章だけを人に見せたい場面がある |

「古い」(前の段階や文書が変わった)段階も「未承認」にする。中身は承認時のままだが、前提が変わっているので確定とはみなさない。

### 省略は「承認済み」と「未承認」の間の第3の状態

段階6を0件で承認する操作は「06 を書かない」という人の決定(Phase 21)。未承認と同じ扱いにすると「まだ書いていない」と区別できない。そこで `skipped` を足した。`document_source` は、省略の段階6も0件の `LogicModel` として渡す(05 の索引の「詳細(06)」が空になる)。

### 図は描画済みの値で受け取る

SVG の描画には DB の配置(`layout_model`)とデータ辞書の名前が要る。純粋な組み立てに DB を持ち込まないよう、サービスが描いた結果(`RenderedDiagram`)を受け取る。md は `path`、HTML は `svg` を使う。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `CHAPTERS` | pytest | スタブ不要。純粋(副作用なし)で、外部依存を呼ばないため | 01〜06が段階1〜6に並ぶ |
| `chapter_status`・`chapter_statuses` | pytest | スタブ不要。同上 | 承認済み以外はすべて未承認、段階6の0件だけ省略、無い段階は未承認 |
| `document_source`・`DocumentSource.status` | pytest | スタブ不要。段階の状態と内容は dict で渡す(読み取りはサービス層の責務) | 第一テストの統合スモーク(全段階承認で `FunctionListModel` に変換される)。レビュー中の段階3は `None`、省略は0件の `LogicModel` |

## 動作確認(実施済み)

```bash
cd devex-api/backend
uv run pytest tests/unit/test_detailed_design_document_source.py
# 6 passed
```
