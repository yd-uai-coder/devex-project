# Devex 詳細設計書(詳細設計モードの出力見本)

詳細設計モード(ステージ4)が、段階1〜6を承認した後に組み立てる「詳細設計書」の見本です。Devex 自身を題材にしました。2026-09-30、[Phase 14](../../textbook/Phase-14/Phase-14-introduction.md) の完了後に作成しています。

- **目的**: 次の2点を確かめるために使います。
  - Devex の要件と処理ロジック。
  - 書式が想定どおりか。書式は [`docs/external_design.md`](../../docs/external_design.md) 2.7節と [`docs/internal_design.md`](../../docs/internal_design.md) 3.3節「4. 詳細設計モード」で決めたもので、章 01〜07、手順ID `F-xx#n`、関数の ID `L-xx`、05 と 06 の紐づけ、HTML と md の出力を指します。
- **中身の根拠**: 実際のコードから手で起こしました。devex(013bd88)、devex-api stage3(46c0039)、devex-ui(9bea340)です。AI による生成(製品の機能)ではありません。
- **図**: devex-api の実際のレイアウトエンジンと出力エンジン(`app/uml/layout`・`app/uml/export`)で描きました。

閲覧用の Artifact(非公開): <https://claude.ai/artifact/RFBWgwFJefonHgNsKJvj1W>

## ファイル

| ファイル | 中身 |
|---|---|
| [`detailed-design.html`](./detailed-design.html) | 読む用。1ファイルで完結し、CSS・スクリプト・図の SVG を中に持つ。ブラウザで開けば、タブとリンクが動く |
| [`detailed-design.md`](./detailed-design.md) | 差分や AI への入力用。リンクを持たず、ID を本文に書く。図は `diagrams/` の相対パスで参照する |
| `diagrams/*.svg`・`*.drawio` | DFD 3枚、ER 部分図 2枚、構成図 1枚 |
| [`content.py`](./content.py) | 内容の正本。各段階の意味モデルに当たるデータ |
| [`diagrams.py`](./diagrams.py) | `content.py` の図の定義を devex-api の意味モデルへ変換し、検証・レイアウト・出力する |
| [`build.py`](./build.py) | HTML と md を組み立てる。05 と 06 の逆引き・関与表と、CRUD 図の色分け(DFD との突き合わせ)も導く |

## 再生成

```bash
cd devex-api/backend
PYTHONPATH=.:../../appendix/detailed-design-devex uv run python ../../appendix/detailed-design-devex/build.py
```

- DB も `.env` も要りません。
- 自動レイアウトに時間がかかるため、全体で数分かかります。付録の「気づき」を参照してください。
