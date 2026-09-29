# Phase-7-2: `docs/*.md`への反映

## この章の目的

[`Phase-7-1.md`](./Phase-7-1.md)で確定したD5(図↔文書対応表)とStage 3のMust/Should/Could区分を、devexの仕様書4点へ反映する。実装ファイルではなく文書更新のみのため、[CLAUDE.md](../../CLAUDE.md) #13(全ファイル解説)・#15(全ファイルimport)・#30(依存順ソート)の対象外(設計フェーズの注記に準拠)。

学習モード(詳細は[introduction](./Phase-7-introduction.md)参照)。

## この章で作成・更新するファイル

| ファイル | 更新内容 |
|---|---|
| [`docs/requirements.md`](../../docs/requirements.md) | 1.4節 Could haveにStage3機能を1項目追加 |
| [`docs/external_design.md`](../../docs/external_design.md) | 2.2節の画面一覧にSCR-007を追加・画面遷移フロー図を更新、2.6節「UML設計図生成・レビュー機能」を新設 |
| [`docs/internal_design.md`](../../docs/internal_design.md) | 3.2節に`uml_diagrams`テーブル+データ辞書(`DataItem`)の説明を追加、3.3節にUMLパイプラインのディレクトリ構成・APIエンドポイント一覧・D5対応表(「3. UML設計図パイプラインの図↔文書対応」)を追加 |
| [`docs/implementation_plan.md`](../../docs/implementation_plan.md) | 4.1節に「ステージ3」節を新設(目的・対象Phase7〜14・マイルストーン4)、冒頭の「2ステージ」を「3ステージ」に修正 |

## 設計判断

### なぜCould have階層か

[`Phase-7-1.md`](./Phase-7-1.md)で述べたとおり、Stage番号と全体MoSCoW階層(Stage1=Must、Stage2=Should)の対応関係を踏襲し、Stage3全体をCould haveとした。Stage3内部のMust(M1〜M9a)はあくまでStage3自身のスコープ内での優先度であり、devex全体から見た優先度とは別軸である。

### SCR-007への画面遷移

既存のSCR-005(ドキュメントプレビュー)から「設計図を生成する」操作でSCR-007へ遷移する導線を追加した。既存のSCR-004→SCR-005の「ヒアリング完了→承認→生成」という操作パターンと一貫させている([`appendix/stage3-requirements-organization.md`](../../appendix/stage3-requirements-organization.md) 4.4節2番の未決定事項への回答)。

### `uml_diagrams`のカラム設計

[`appendix/uml-review-drawio-requirements-external-design.md`](../../appendix/uml-review-drawio-requirements-external-design.md) 4.3節の推奨モジュール構成と、[`appendix/stage3-requirements-organization.md`](../../appendix/stage3-requirements-organization.md)のM3・診断7(陳腐化の双方向化)を踏まえ、`source_doc_versions`(生成元の`generated_documents`バージョン)を追加し、文書側が再生成された場合の陳腐化検知の基礎とした(実際の検知ロジックはPhase 13)。

### APIパスの設計

[`appendix/uml-review-drawio-requirements-external-design.md`](../../appendix/uml-review-drawio-requirements-external-design.md) 2.6節の`/api/uml/diagrams`を、devex既存のプロジェクトスコープ(`/api/v1/projects/{id}/...`)配下へ変更し、既存の`CurrentProjectDep`をそのまま再利用できるようにした(4.3節の推奨方針どおり)。

## テスト観点

スタブ不要 ── 本章の成果物はMarkdown文書のみで、実行可能なコード・外部依存を一切持たないため(SUT/ドライバ/スタブという区分自体が適用対象外)。整合性の確認は、D5対応表が[`appendix/uml-review-drawio-requirements-external-design.md`](../../appendix/uml-review-drawio-requirements-external-design.md)・[`appendix/stage3-requirements-organization.md`](../../appendix/stage3-requirements-organization.md)の内容と矛盾しないかを目視で突き合わせることで行う。
