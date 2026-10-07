# Phase-26-6: docs・見本への反映

## この章の目的

26-1〜26-5 で実装した段階7の改修を、`docs/*.md` と見本([`stage7-recut.md`](../../appendix/implementation-procedure-sample/stage7-recut.md))に反映する。Phase 25 で「改修する(実装は Phase 26)」と書いた箇所を、実装した形に合わせる。

自動実装モード: on([introduction](./Phase-26-introduction.md) 参照)。

## この章で作成・更新したファイル

文書のみ(#13/#15/#30 の対象外)。

| ファイル | 反映した内容 |
|---|---|
| [`docs/internal_design.md`](../../docs/internal_design.md) 3.3節「段階7」 | model の形(`kind`・`depends_on`・`modules`・`config_files`、`Milestone.function_ids` の削除)、検証の指摘(エラー・警告のコード)、下書きの入力(モジュールのパスの一覧・依存先の ID)、既存データの移行(`b8c9d0e1f2a3`)、段階7の入力の大きさ、実装計画の出力(単位の表・単位の ID) |
| [`docs/external_design.md`](../../docs/external_design.md) 2.7節「段階7の作業領域」・2.8節「作業単位」 | 表の列・上下の移動と依存の付け替え・2つのファイルの欄・承認の条件と警告・既存の段階7の差し戻し。2.8節に「Phase 26 で実装」 |
| [`docs/implementation_plan.md`](../../docs/implementation_plan.md) 4.1節ステージ5 | Phase 25・26 を完了に |
| [`appendix/implementation-procedure-sample/stage7-recut.md`](../../appendix/implementation-procedure-sample/stage7-recut.md) | 「未決」を「Phase 26 で決定」に改め、見本との違い(足した警告・マイルストーンの処理の導出)を書いた |

Phase 25 の「確定」の blockquote([`docs/internal_design.md`](../../docs/internal_design.md) の「段階7のタスクを層の横割りのままにしない」)は、決定の記録としてそのまま残した。本文の側に「Phase 26 で改修」と書き、Phase 23 の形との違いを括弧で残した。

## テスト観点

スタブ不要 ── 本章は文書の反映のみで、実装ファイルを作成しないため(SUT/ドライバ/スタブという区分自体が適用対象外)。`link_check.py` でリンク切れが無いことを確かめた。
