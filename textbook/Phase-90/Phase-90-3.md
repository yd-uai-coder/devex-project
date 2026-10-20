# Phase-90-3: `docs/*.md`・README・位置付けへの反映

## この章の目的

[90-1](./Phase-90-1.md) の決定と [90-4](./Phase-90-4.md) の計画を、仕様の文書(`docs/*.md`)と、README・位置付け・appendix の一覧に反映する。テーブルと API は「予定」の形で置き、列・形は各 Phase の着手時に決める([Phase 80-3](../Phase-80/Phase-80-3.md) と同じ)。

自動実装モード: on([introduction](./Phase-90-introduction.md) 参照)。本体と samples は変えない。

## この章で作成・更新したファイル

文書のため、#13・#15・#30 の対象外。

| ファイル | 変えたところ |
|---|---|
| [`docs/requirements.md`](../../docs/requirements.md) | 1.4 の Could have に「合意の精度(ステージ12)」を足した |
| [`docs/external_design.md`](../../docs/external_design.md) | 2.15節「合意の精度」を新しく作った(モード・合意済みの行・保護・確認事項の一覧・版の巡回・CR の手直し)。2.14節の「ステージ12 以降に回すもの」から 2.15節へリンクした |
| [`docs/internal_design.md`](../../docs/internal_design.md) | 3.3 に「12. 合意の精度」を足した(合意の記録・保護・版の巡回・確認事項・履歴・CR の手直しの置き場。すべて予定) |
| [`docs/implementation_plan.md`](../../docs/implementation_plan.md) | 4.1 にステージ12 の節(目的・方針・Phase 90〜99・マイルストーン13)を足した |
| [`README.md`](../../README.md) | ステージ配分の下の1行を、ステージ11 の完了とステージ12 の着手に直した |
| [`appendix/devex_project_positioning.md`](../../appendix/devex_project_positioning.md) | 12章の表のステージ12 の行に、Phase 90 で足した範囲(外部設計書の要素・段階の承認の印・新しい要件の予測の起点・確認事項の範囲)を書き足した |
| [`appendix/README.md`](../../appendix/README.md) | 効果測定の一覧に、ステージ12 の行を足した([90-2](./Phase-90-2.md))。ステージ11 の効果測定の欄が「(Phase 89)」のままだったので、[stage11-effect](../../appendix/measurements/stage11-effect.md) へのリンクに直した |

## 反映の考え方

- **決まったことだけを書く**: テーブルの名前・列・API の形・画面の置き場所は、まだ決めていない。「予定」「Phase NN で決める」と書き、[90-4](./Phase-90-4.md) の未確定事項へリンクした。
- **位置付けの文書は、決定で変わった所だけ直す**: 直したのは、ステージ12 の行の範囲と判断基準(決定4・5・8)だけにした。
- **ステージ11 の節(2.14・3.3-11)は直さない**: ステージ12 で変わる振る舞い(版の巡回・段階の承認の印・新しい要件の予測)は、2.15節にまとめて書いた。各 Phase で実装したときに、2.14節の該当の行へ「(Phase NN で変更)」を足す。
- **マイルストーンの番号**: ステージ11 がマイルストーン12 なので、ステージ12 はマイルストーン13 にした。
- **#40 の CR は無い**: Phase 90 は、ステージ12 の仕様を決めて docs に合意の版として書く側である。#40 は、その後(Phase 91 以降)に docs を変えるときの決まりなので、この章の反映は q_a に CR の形では残さない。

## テスト観点

自動のテストは無い(文書のため)。代わりに次を確かめた。

- `textbook/tools/link_check.py`: リンク切れが 0 件であること。
- [`implementation_plan.md`](../../docs/implementation_plan.md) 4.1 の Phase 一覧が、[90-4](./Phase-90-4.md) の表と一致すること。
