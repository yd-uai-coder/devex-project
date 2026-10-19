# appendix

仕様([`docs/`](../docs/))と開発の記録([`textbook/`](../textbook/))の外にある資料です。

| 資料 | 内容 |
|---|---|
| [`concept-history.md`](./concept-history.md) | 構想の経緯。ロードマップ(ステージ5〜10 の構想と順序)、UML 製図システムの要件定義書、ステージ3の要件整理、詳細設計モードの構想、実装手順書の作成方針、ステージ9・10 の計画を1本にまとめたもの。今の仕様は `docs/` が正 |
| [`cl-development-handoff-v2.md`](./cl-development-handoff-v2.md) | CL(Curriculum Loop)開発の手法の最終版。次のプロジェクトに引き継ぐ進行のルール(#1〜#34)と、2つのプロジェクトで分かった課題 |
| [`measurements/`](./measurements/) | 効果測定の結果。改良の前(ベースライン)と後(効果測定)を、実際の LLM と決まった題材・規則で比べた記録 |
| [`goal3-generated/`](./goal3-generated/README.md) | プロジェクトのゴール3(Devex の生成文書と CL 教材の突き合わせ)に使った、Devex の実際の生成物。突き合わせの結果は [`goal3-comparison.md`](../textbook/retrospectives/goal3-comparison.md) |
| [`implementation-procedure-sample/`](./implementation-procedure-sample/README.md) | 実装手順書の見本。ステージ5で生成機能を作る前に、形を確かめるために手で書いたもの |

## 効果測定の一覧

| ステージ | ベースライン(改良の前) | 効果測定(改良の後) |
|---|---|---|
| 6 ヒアリング改良 + 上流の構造化 | [stage6-baseline](./measurements/stage6-baseline.md) | [stage6-effect](./measurements/stage6-effect.md) |
| 7 変更影響分析 | [stage7-baseline](./measurements/stage7-baseline.md) | [stage7-effect](./measurements/stage7-effect.md)(ヒアリングの数え方は [stage7-hearing](./measurements/stage7-hearing.md)) |
| 8 AI 設計レビュー + テスト設計 | [stage8-baseline](./measurements/stage8-baseline.md) | [stage8-effect](./measurements/stage8-effect.md) |

## 2026-10-19 の整理

ファイルが増えて見通しが悪くなったので、次のように整理しました。教材と記録からのリンクは、新しい場所へ張り替えるか、消したものはリンクを外して名前だけを残しています。

- **統合**: 構想・計画のメモ6本(`devex_roadmap.md`・`uml-review-drawio-requirements-external-design.md`・`stage3-requirements-organization.md`・`detailed-design-mode-organization.md`・`devex_implementation_procedure_guideline.md`・`stage9-10-plan.md`)を `concept-history.md` に。
- **移動**: 効果測定の各フォルダの README を `measurements/<名前>.md` に。`textbook/appendix/` を [`textbook/retrospectives/`](../textbook/retrospectives/) に改名。
- **削除**:
  - 効果測定の生成物・入力・実行スクリプト(結果と判定は `measurements/` に残る)。
  - CL 開発の手法の v1(`cl-development-handoff.md`。v2 が v1 の #1〜#17 をそのまま含む)。
  - UML MCP と設計書テンプレートの調査メモ(`requirements-design-uml-mcp-summary.md`。要点は `concept-history.md` 3節に残る)。
  - 手で起こした詳細設計書の見本(`detailed-design-devex/`。後に実際の生成物 `goal3-generated/` で置き換わった)。
  - 画面を作る前の見本3つ(`change-impact-sample/`・`design-review-sample/`・`structured-requirements-sample/`)。
