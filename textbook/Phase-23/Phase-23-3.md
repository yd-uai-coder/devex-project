# Phase-23-3: 組み立ての入力の切り出しと、zip への実装計画の追加(BE)

## この章の目的

Phase 22 の出力サービス `DetailedDesignExportService.bundle` は、次の2つを1つのメソッドで行っていた。

1. DB から段階の状態・内容・図・データ辞書を読み、図を描く
2. zip に書く

この章では、1 を `collect(project, render=...)` として切り出す。段階7の生成(23-4)が、同じ入力から詳細設計書の md を作れるようにするため。あわせて、zip に `implementation_plan.{html,md}` を足す。

学習モード([introduction](./Phase-23-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/services/detailed_design_export_service.py`](../samples/backend/app/services/detailed_design_export_service.py) | 更新 | **コア** | `CollectedDocument`、`collect(project, *, render)`(入力を集める。描くなら図も)、`bundle`(zip に実装計画も書く)、`PLAN_HTML_NAME`・`PLAN_MARKDOWN_NAME` |
| [`app/api/routes/design_stages.py`](../samples/backend/app/api/routes/design_stages.py) | 更新 | 定型 | ダウンロードの docstring(zip に実装計画が入る) |
| ── ここからテスト ── | | | |
| [`tests/unit/test_detailed_design_plan_export.py`](../samples/backend/tests/unit/test_detailed_design_plan_export.py) | 新規 | **コア** | zip の実装計画、段階7が未承認のとき、`collect` の描く・描かない |
| [`tests/unit/test_detailed_design_export.py`](../samples/backend/tests/unit/test_detailed_design_export.py) | 更新 | 定型 | zip のファイル一覧に `implementation_plan.{html,md}` が加わったこと |

## 要点の抜粋

```python
# app/services/detailed_design_export_service.py
PLAN_HTML_NAME = "implementation_plan.html"
PLAN_MARKDOWN_NAME = "implementation_plan.md"

@dataclass
class CollectedDocument:
    source: DocumentSource
    files: dict[str, str] = field(default_factory=dict)       # zip の中のパス → 図の SVG・draw.io
    rendered: list[UmlDiagram] = field(default_factory=list)  # 描いた図(zip に入れたら exported)

class DetailedDesignExportService:
    async def bundle(self, project) -> BundleFile:
        collected = await self.collect(project, render=True)
        # detailed_design.{html,md}・implementation_plan.{html,md}・diagrams/* を書き、描いた図を exported にして commit

    async def collect(self, project, *, render: bool) -> CollectedDocument:
        # overview(段階の状態と承認済みの内容)・データ辞書・承認済みの図を読む。DB は書き換えない
        # usable(diagram): 承認済みで、描くなら配置がある
        # draw(diagram):   render のときだけ描いて files・rendered に足す
```

## 設計判断

### 共通化してよいか(#17)

判定の問い「この共通化を今駆動している、この Phase の実在の消費者は何か」には、「段階7の生成(`generate_plan`、23-4)」と答えられる。

段階7の生成は、承認済みの段階1〜6を詳細設計書と同じ形で読む必要がある。データ辞書の「使う処理」や CRUD の記号は、DFD の線から導く(Phase 22)。そのため、段階の model だけでなく、DFD と ER の意味モデルも要る。この読み方をコピーすると、規則が2か所に分かれる。そこで、出力サービスの中から切り出して共有した。

### `render=False` の意味

| | `render=True`(zip) | `render=False`(段階7の生成) |
|---|---|---|
| 図の意味モデル(DFD の線・ER のテーブル)を読む | 読む | 読む(表の導出に要る) |
| 図を SVG・draw.io に描く | 描く | 描かない(md の画像は、生成の入力に要らない) |
| 配置(`layout_model`)の無い承認済みの図 | 載せない(描けない) | 意味モデルは使う |
| 図を `exported` にする | `bundle` が行う | 行わない(出力していないため) |

`collect` 自身は DB を書き換えない。状態を変える(`exported`・commit)のは `bundle` だけにした。こうすると、生成の途中で `collect` を呼んでも、図の状態が変わらない。

切り出しの前後で、`render=True` の振る舞いは変えていない。ER は、配置があって描けたときだけ `er` を渡していた。今は「承認済みなら渡す」に変えたが、描く場合は配置のある図だけが `usable` なので、結果は同じになる。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `download_detailed_design` → `bundle` | pytest(ルート関数を直接呼ぶ) | なし ── DB はテスト用のインメモリ SQLite(`db_session`)で、図はレイアウトエンジンで実際に配置する | 第一テストの統合スモーク(段階1〜7承認で、実装計画の md・HTML と07章が zip に入る) |
| `bundle`(段階7が未承認) | pytest | なし(同上) | 実装計画と07章が「未承認」になる |
| `collect(render=False)` | pytest | なし(同上) | 図のファイルも描いた図も無い。ER と DFD の意味モデルは読む。図は `approved` のまま |
| `collect(render=True)` | pytest | なし(同上) | 3枚の図(DFD・ER・構成図)を描き、6ファイルになる |
| `bundle` のファイル一覧(`test_detailed_design_export.py`) | pytest | なし(同上) | Phase 22 のテストに、実装計画の2ファイルを足した |

組み立ての中身(md・HTML の文)は 23-2 の純粋関数のテストで確かめたので、ここでは集めた入力・zip の構成・図の状態だけを見る。

## 動作確認(実施済み)

```bash
cd devex-api/backend
uv run pytest tests/unit/test_detailed_design_plan_export.py tests/unit/test_detailed_design_export.py
# 12 passed
```
