# Phase-29-6: `docs/*.md` への反映

## この章の目的

Phase 29 の決定と実装(段階5の行の種別・導出の置き場・図の規則・05章と段階5の画面・手順書の単位・スタブの候補の指摘・色の強調の撤回)を、設計文書に反映する。

自動実装モード: on([introduction](./Phase-29-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 更新の内容 |
| --- | --- |
| [`docs/internal_design.md`](../../docs/internal_design.md) | API 一覧に `GET /design-stages/procedures/{function_id}/sequence` を足し、参照の API の `refs` に `svg`。段階5の model に `kind`、段階5の検証の警告(シーケンスの指摘5種)、`calls_function`。3.3節「5. 実装手順書」に `STUB_OUTSIDE_SEQUENCE`、参照の展開の Mermaid と SVG、シーケンス図の実装(`sequence.py`・`sequence_svg.py`・使う5か所) |
| [`docs/external_design.md`](../../docs/external_design.md) | 05 の表の列を8列に(`[Phase 29 で確定 ── …]`)、05 のタブの図、詳細設計書の HTML と md の図。2.8節: 「Phase 29 で実装した部分」、単位の図の色の強調の撤回(`[Phase 29 で確定 ── …]`)、図の規則 |
| [`docs/implementation_plan.md`](../../docs/implementation_plan.md) | ステージ5の Phase 29 を完了に |

文書のため #13・#15・#30 の対象外。

## テスト観点

スタブ不要 ── 本章は文書の更新だけで実装ファイルを作成しないため(SUT/ドライバ/スタブという区分自体が適用対象外)。文書の目視レビューと `link_check.py` で確かめる。
