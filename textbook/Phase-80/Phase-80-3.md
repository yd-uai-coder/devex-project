# Phase-80-3: `docs/*.md`・README・位置付けへの反映

## この章の目的

[80-1](./Phase-80-1.md) の決定と [80-4](./Phase-80-4.md) の計画を、仕様の文書(`docs/*.md`)と、README・位置付け・appendix の一覧に反映する。テーブルと API は「予定」の形で置き、列・形は各 Phase の着手時に決める。

自動実装モード: on([introduction](./Phase-80-introduction.md) 参照)。本体と samples は変えない。

## この章で作成・更新したファイル

文書のため、#13・#15・#30 の対象外。

| ファイル | 変えたところ |
|---|---|
| [`docs/requirements.md`](../../docs/requirements.md) | 1.4 の Could have に「合意と変更の一巡(ステージ11)」を足した |
| [`docs/external_design.md`](../../docs/external_design.md) | 画面一覧に SCR-010(変更要求・合意済みの版)を足した。2.14節「合意と変更の一巡」を新しく作った(用語・モード・合意済みの版・CR・予測・説明書・反映・検証・後に回すもの) |
| [`docs/internal_design.md`](../../docs/internal_design.md) | 3.2 の主要エンティティに Baseline・ChangeRequest を足した。テーブル⑭〜⑯(予定)と、`generated_documents` に足す列を足した。3.3 の API 一覧に2行(予定)を足した。3.3節「11. 合意と変更の一巡」(凍結・予測・反映・説明書・検証)を新しく作った |
| [`docs/implementation_plan.md`](../../docs/implementation_plan.md) | 4.1 に「(再開)」の注記と、ステージ11 の節(目的・方針・Phase 80〜89・マイルストーン12)を足した |
| [`README.md`](../../README.md) | 「今後の調整案」のステージ配分の表で、ステージ11 の合意済みの版を「プロジェクトの束」に直した。着手した旨の1行を足した |
| [`appendix/devex_project_positioning.md`](../../appendix/devex_project_positioning.md) | 12章の表で、ステージ11 の合意済みの版を「文書単位」から「プロジェクトの束」に直した(Phase 80 の決定1) |
| [`appendix/README.md`](../../appendix/README.md) | 効果測定の一覧に、ステージ11 の行を足した([80-2](./Phase-80-2.md)) |

## 反映の考え方

- **決まったことだけを書く**: 列の名前・API の形・画面の置き場所は、まだ決めていない。「予定」「Phase NN で決める」と書き、[80-4](./Phase-80-4.md) の未確定事項へリンクした。ステージ10 の docs の書き方(「Phase NN で確定」を後から足す)に合わせている。
- **位置付けの文書は、決定で変わった所だけ直す**: 位置付けは方針の正本である。直したのは、ステージ11 の合意済みの版の単位(決定1)の1か所だけにした。検証の条件(決定9)は、位置付けの「再検証(今の設計レビューと『古い』の印)」と矛盾しないので、直していない(レビューは任意で使える)。
- **CLAUDE.md は直さない**: 計画モードの決定3のとおり。ゴールの節と、CR の手順を進め方に足す案は、[introduction](./Phase-80-introduction.md#未消化の申し送り37) の申し送りに置いた。

## テスト観点

自動のテストは無い(文書のため)。代わりに次を確かめた。

- `textbook/tools/link_check.py`: リンク切れが 0 件であること。
- [`implementation_plan.md`](../../docs/implementation_plan.md) 4.1 の Phase 一覧が、[80-4](./Phase-80-4.md) の表と一致すること。
