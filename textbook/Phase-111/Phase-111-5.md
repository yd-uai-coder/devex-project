# Phase-111-5: `docs/*.md`・README・位置付けへの反映

## この章の目的

[111-1](./Phase-111-1.md) の決定と [111-4](./Phase-111-4.md) の計画を、仕様の文書(`docs/*.md`)・README・[位置付け](../../appendix/devex_project_positioning.md)に写す(#28 の「決定が出揃ったら docs に反映」)。

自動実装モード: on([introduction](./Phase-111-introduction.md) 参照)。文書だけで、本体と samples は変えない(#13・#15・#30 の対象外)。

## この章で作成・更新したファイル

| ファイル | 反映したこと |
|---|---|
| [`docs/requirements.md`](../../docs/requirements.md) | Could に「変更の取り込み(ステージ14)」の項目(資料・最新の束と比べる・違いの一覧と検査・選んで CR の下書き・束が古いときの知らせ) |
| [`docs/external_design.md`](../../docs/external_design.md) | 画面の一覧に SCR-013(資料)。2.17節「変更の取り込み」を新設(資料・比べる相手・違いの一覧・CR の下書き・束が古いときの知らせ・使い勝手の見直し・ステージ14 の後に回すもの) |
| [`docs/internal_design.md`](../../docs/internal_design.md) | 3.3節に「14. 変更の取り込み」(Phase 111 で決まった構造と、使い回す既存の部品だけ。形は各 Phase で決める) |
| [`docs/implementation_plan.md`](../../docs/implementation_plan.md) | 4.1 にステージ14(目的・方針・Phase 111〜117・マイルストーン15) |
| [`appendix/devex_project_positioning.md`](../../appendix/devex_project_positioning.md) | 12章のステージ14 の行(中身に足したもの・判断基準に CR の下書きに使える形・Phase の目安 約5 → 7) |
| [`README.md`](../../README.md) | ステージの表の14 の判断基準と、ステージ14 の着手の1文 |

## 判断

- **判断基準の書き足しは CR の形をとらない**: 計画の承認の前の決定なので、Phase 100 と同じく docs と位置付けに直接書いた(#40 は承認の後の変更が対象)。
- **SCR-013 の置き場は決めない**: プロジェクトのメニューに足すか CR の一覧の中かは、Phase 116 の着手時に決める(111-4 の未確定事項)。
- **内部設計の 3.2節(データモデル)には、まだ書かない**: 資料・違いのテーブルの列は Phase 113・114 で決める。3.3節「14」に、使い回す既存の部品(`_ingest_file` の本文の取り出し・`option_drafting.py` の型・`checked_targets`・`checked_origins`・`scale.py`)だけを書いた。
- **2.16節の「ステージ13 の後に回すもの」は書き換えない**: ステージ13 の決定の記録のため。2.17節の「使い勝手の見直し」と「ステージ14 の後に回すもの」で続きを書いた。
