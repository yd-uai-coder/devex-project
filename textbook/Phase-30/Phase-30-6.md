# Phase-30-6: `docs/*.md` への反映

## この章の目的

Phase 30 の決定と実装(zip の `implementation_procedure/` の中身と、承認済みだけを組み立てる規則・HTML の形・AI 向けの版の順・画面の「AI 向けにコピー」と API・組み立ての置き場)を、設計文書に反映する。

自動実装モード: on([introduction](./Phase-30-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 更新の内容 |
| --- | --- |
| [`docs/external_design.md`](../../docs/external_design.md) | 2.7節: ダウンロードのボタン名と件数(段階1〜8)、詳細設計書の出力に実装手順書。2.8節: 「Phase 30 で実装した部分」(AI 向けにコピー)、「出力」の実装(ファイル名・承認済みだけ・各ファイルの中身・HTML の形) |
| [`docs/internal_design.md`](../../docs/internal_design.md) | API 一覧に `GET /design-stages/units/{unit_id}/ai-markdown`、`GET /design-stages/document` に手順書。3.3節「5. 実装手順書」の「出力」に `procedure_output/` の構成と、zip・画面のコピーの入力の違い |
| [`docs/implementation_plan.md`](../../docs/implementation_plan.md) | ステージ5の Phase 30 を完了に |

文書のため #13・#15・#30 の対象外。

## テスト観点

スタブ不要 ── 本章は文書の更新だけで実装ファイルを作成しないため(SUT/ドライバ/スタブという区分自体が適用対象外)。文書の目視レビューと `link_check.py` で確かめる。
