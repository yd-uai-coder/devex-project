# Phase-31-6: `docs/*.md` への反映

## この章の目的

Phase 31 の決定と実装を、設計文書と作成方針に反映する。反映するのは次のとおり。

- SCR-005 の入口と、段階8だけの SCR-008
- WBS の書式と決定的な解析
- 内部設計書からの参照
- 直す先の文書
- 簡易モードの段階の入力と陳腐化
- API の変更

自動実装モード: on([introduction](./Phase-31-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 更新の内容 |
| --- | --- |
| [`docs/external_design.md`](../../docs/external_design.md) | 画面一覧の SCR-005・SCR-008、画面遷移(「実装手順書へ進む」)、SCR-005 のアクションバー、2.7節の段階の進め方、2.8節の簡易ドキュメントモードに「実装(Phase 31)」(入口・作業単位・入力と陳腐化・直す先・決定的なチェック・参照の展開・出力) |
| [`docs/internal_design.md`](../../docs/internal_design.md) | 3.3節1. の実装計画書の WBS に、番号を付けない方針を撤回した記録。API 一覧の `design-stages`(簡易モードは段階8だけ・`mode`・`plan`)・`document`・`procedure-document`・`sequence`・`units/{unit_id}/context`・`ai-markdown`。3.3節「5. 実装手順書」の出力の `procedure_output_source` の引数と、簡易ドキュメントモードの「実装(Phase 31)」 |
| [`docs/implementation_plan.md`](../../docs/implementation_plan.md) | ステージ5の Phase 31 を完了に |
| [`appendix/devex_implementation_procedure_guideline.md`](../../appendix/devex_implementation_procedure_guideline.md) | 3章(単位の元・実装の注記)、8.2(ID の形式は決定済み・簡易モードの ID の突き合わせ)、10章(DF の展開にテーブルを添える)、21章(簡易モードの部分を実装した注記) |

文書のため #13・#15・#30 の対象外。

## 設計判断

### 撤回の記録は内部設計書の WBS の項に

「WBS のタスクに番号を付けない」はゴール3後の調整で決めた方針で、Phase 31 でそれを改めた。#12 の撤回の形(`[Phase 31 で確定 ── 〈…〉]`)で、もとの項の直下に理由とともに残した。

## テスト観点

スタブ不要 ── 本章は文書の更新だけで実装ファイルを作成しないため(SUT/ドライバ/スタブという区分自体が適用対象外)。文書の目視レビューと `link_check.py` で確かめる。
