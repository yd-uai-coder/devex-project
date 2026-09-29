# Phase-7-1: 仕様診断の確定(D5: 図↔文書対応表)

## この章の目的

Stage 3の要件整理([`appendix/stage3-requirements-organization.md`](../../appendix/stage3-requirements-organization.md))で唯一Phase 7に持ち越されていたD5(UML図記法↔文書セクションの対応表)を確定し、Stage 3の要件(Must/Should/Could)を`docs/requirements.md`等へ反映する前段の整理を行う。

学習モード(詳細は[introduction](./Phase-7-introduction.md)参照)。

## D5: 図↔文書対応表の確定

### 対立していた2つの叩き台

- [`appendix/requirements-design-uml-mcp-summary.md`](../../appendix/requirements-design-uml-mcp-summary.md)の一般的な工程対応表は、コンポーネント図を「外部設計書」に割り当てる。これは個人開発向けの一般的な設計工程を想定した記述であり、devex固有の文書構成を踏まえたものではない。
- [`appendix/uml-review-drawio-requirements-external-design.md`](../../appendix/uml-review-drawio-requirements-external-design.md) 4.3節の叩き台と、[`appendix/stage3-requirements-organization.md`](../../appendix/stage3-requirements-organization.md)の診断2は、コンポーネント図・ER図を`internal_design`3.2/3.3節に寄せる案を示していた。

### 確定: internal_designへの一本化

devexの実際の文書構成を確認すると、[`docs/external_design.md`](../../docs/external_design.md)は画面(SCR-00X)・API連携・データ入出力仕様など利用者向け仕様のみを扱い、モジュール構造の記載を一切持たない。一方[`docs/internal_design.md`](../../docs/internal_design.md)は3.2節(データモデル定義)・3.3節(バックエンド処理・モジュール設計)として既にモジュール構造・データモデルを扱っている。実装者向けの構造図・データ構造図の置き場としては`internal_design`が一貫するため、以下のとおり確定する(表は[`docs/internal_design.md`](../../docs/internal_design.md) 3.3節「3. UML設計図パイプラインの図↔文書対応」に転記済み):

| 設計ビュー | 図記法 | 対応セクション |
|---|---|---|
| システム構造(モジュール) | コンポーネント図 | `internal_design` 3.3節「1. 主要処理ロジックの分割方針」 |
| データ構造 | ER図 | `internal_design` 3.2節「2. テーブル定義」 |
| 処理別データフロー(Must) | DFD | `internal_design` 3.3節 新設予定の「処理別データフロー」節(Phase 10) |
| 振る舞い(Should、Phase 14) | アクティビティ図 | `external_design` 2.2節「画面一覧・画面遷移フロー」 |

アクティビティ図のみsummary案どおり`external_design`側に残した。画面遷移・利用者操作の流れは外部設計書が元々扱っている領域と一致するため、component/ER/DFDのような「実装者向けの構造・データ・処理」とは性質が異なると判断した。

## Stage 3要件の整理(Must/Should/Could)

[`appendix/stage3-requirements-organization.md`](../../appendix/stage3-requirements-organization.md) 4節のM1〜M9bを、devexの`docs/requirements.md`が使うMoSCoW区分に合わせて整理し直した。Stage1=Must have、Stage2=Should haveという既存の「Stage番号=優先度階層」の慣例([`docs/implementation_plan.md`](../../docs/implementation_plan.md) 4.1節見出し)に倣い、Stage3全体は`docs/requirements.md`上では**Could have**階層に位置づける。これはStage3内部でのMust/Should/Could(M1〜M9b)とは別軸であることに注意する ── 内部Mustは「Stage3自身のスコープ内での優先度」、`docs/requirements.md`のCould haveは「devex全体から見た優先度」を表す。

- Stage3内部Must(M1〜M9a): 意味モデル生成・永続化・バリデーション・レビューUI・自動レイアウト・状態遷移・draw.io/SVG出力・内部設計書への図による補完
- Stage3内部Should: アクティビティ図・undo/redo・楽観ロック・M9b(手直しの反映)
- Stage3内部Could: シーケンス図・クラス図・全面的な図間整合性検証・AIレビュー提案

反映内容は[`Phase-7-2.md`](./Phase-7-2.md)で`docs/*.md`へ書き込む。

## 後続Phaseへの申し送り

- DFDの実プロンプト追加(内部設計書生成プロンプトへの「処理別データフロー」節追加)はPhase 10。
- アクティビティ図の`external_design`側への実際の記述追加はPhase 14。

## テスト観点

スタブ不要 ── 本章は設計討議のみでファイルを作成しないため(SUT/ドライバ/スタブという区分自体が適用対象外)。
