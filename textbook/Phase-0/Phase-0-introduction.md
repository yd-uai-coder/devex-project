# Phase 0 導入: CL開発ルールの確定とプロジェクトゴールの策定

## 目的

Devex 実装(Phase 1 以降)に着手する前に、次の3つを確定する:

1. [`appendix/cl-development-handoff.md`](../../appendix/cl-development-handoff.md) を土台に、本プロジェクト固有の進行ルール(#18〜28)を確定する。
2. プロダクト目標([README.md](../../README.md)/`docs/`配下 準拠)・手法目標(CL開発の洗練)・再帰検証目標(Devex生成物とCL教材の相互転用)の3層からなるプロジェクトゴールを確定する。
3. #27(Phase 0 の役割定義)に基づき、[README.md](../../README.md)/`docs/`配下を入力として Phase 1 以降の実装ロードマップを具体化する。

本 Phase は設計フェーズ(実装ファイルを作らない Phase)であり、[CLAUDE.md](../../CLAUDE.md)「進行のルール」#2 の規定に従い作業単位を持たない。章立ては [`Phase-0-1.md`](./Phase-0-1.md)(ルール・ゴール確定)・[`Phase-0-2.md`](./Phase-0-2.md)(実装ロードマップ具体化)・[`Phase-0-3.md`](./Phase-0-3.md)(初期ヒアリング入力の設計)・[`Phase-0-4.md`](./Phase-0-4.md)(ドキュメント構成の分割)・[`Phase-0-5.md`](./Phase-0-5.md)(仕様診断への対応)・[`Phase-0-6.md`](./Phase-0-6.md)(仕様診断の共通ルール化)・[`Phase-0-7.md`](./Phase-0-7.md)(自己診断のプロダクト要件化)の7本(設計トピックの逐次解説)。

## パイプライン上の位置づけ・前提

- 前提として読むべきもの: [`appendix/cl-development-handoff.md`](../../appendix/cl-development-handoff.md)(CL開発の原本ルール #1〜17 と所感5.1〜5.6)、[`README.md`](../../README.md)(概要)+ `docs/`配下(Devexのプロダクト要件定義書・外部設計書・内部設計書・実装計画書の詳細)、[`CLAUDE.md`](../../CLAUDE.md)(リポジトリ構成、および本 Phase の成果物である「進行のルール」節)。
- このプロジェクトは「Devex を CL開発で作る」と同時に「Devex という成果物(要件定義/外部設計/内部設計/実装計画の自動生成)自体が CL開発の教材品質を検証する再帰的な題材である」という二重構造を持つ。この位置づけは Phase 0 全体の前提であり、以降すべての Phase の振り返り(#25)に影響する。

## 章一覧

| 章 | トピック | 依存 |
|---|---|---|
| [`Phase-0-1.md`](./Phase-0-1.md) | 進行ルール(#18〜26)とプロジェクトゴールの確定内容の解説 | appendix原本 #1〜17、[README.md](../../README.md) |
| [`Phase-0-2.md`](./Phase-0-2.md) | #27の適用として、実装ロードマップ(Phase 1〜5)を具体化 | `Phase-0-1.md`(#27)、[`docs/implementation_plan.md`](../../docs/implementation_plan.md) 4.2 WBS |
| [`Phase-0-3.md`](./Phase-0-3.md) | #27の適用として、初期ヒアリング入力(SCR-004)のアクセシブルな設計を仕様書に反映 | `Phase-0-1.md`(#27)、[`docs/external_design.md`](../../docs/external_design.md) 2.3/2.5、[`docs/internal_design.md`](../../docs/internal_design.md) 3.2/3.3 |
| [`Phase-0-4.md`](./Phase-0-4.md) | README.mdに混在していた4文書をdocs/配下に分割し、README.mdを概要+リンクのみに縮小 | `Phase-0-1.md`(#27) |
| [`Phase-0-5.md`](./Phase-0-5.md) | Phase 1着手前の仕様診断12項目への対応(リポジトリ構成・SSE・文字数上限・完了判定基準・バージョニング・sender4値・テンプレート連携・LLMコスト・a11y・JWT等) | `Phase-0-4.md`(#27)、`docs/`配下4文書 |
| [`Phase-0-6.md`](./Phase-0-6.md) | 「実装着手前の仕様診断」を共通ルール化(#28新設) | `Phase-0-5.md` |
| [`Phase-0-7.md`](./Phase-0-7.md) | 「生成ドキュメントの自己診断」をDevexのプロダクト要件として明示(#25の適用例) | `Phase-0-6.md`(#28)、`docs/`配下4文書 |

実装ファイルを作らない章のため、[CLAUDE.md](../../CLAUDE.md)「進行のルール」#13(全ファイル解説)・#15(全ファイルimport)・#12(リファクタ追従)の対象外。

## サンプルコード一覧

なし(設計フェーズのため `textbook/samples/` への追加なし)。

## 実装前チェックリスト(#11)

設計レベルの疑問をここで出し切る(実装細部の疑問はこの Phase には存在しない — #20 の対象外だが同じ考え方を適用):

- [ ] [`appendix/cl-development-handoff.md`](../../appendix/cl-development-handoff.md) の #1〜17 のうち、本プロジェクトで運用上の解釈が必要なものはあるか(例: samples フォルダの実体をいつ作るか)
- [ ] #18〜28 の各ルールが、[`docs/implementation_plan.md`](../../docs/implementation_plan.md) のステージ1(MVP)スケジュール(Week 3 / Week 5)と矛盾しないか
- [ ] プロジェクトゴールの3層(プロダクト/手法/再帰検証)の優先順位に認識齟齬がないか
- [ ] [`decision-digest.md`](../decision-digest.md) を「能動的に参照するファイル」として今後の全セッション冒頭で読む、という運用に合意できるか
- [ ] 実装ロードマップ(Phase 1〜5、WBS 1:1対応)の粒度・順序に認識齟齬がないか

## 写経順序(#23)

該当なし(設計フェーズ・実装ファイルなし)。

## Phase完了チェック(#22)

1. #12 のルールにおいて、「以前の Phase のコードを共通化のために触ってよい」と判断してよいのはどんな場合か、具体例を挙げて説明できるか。
2. #21 のモード切替ルールにおいて、MVPコアループに関わる章はなぜ常に学習モード固定なのか説明できるか。
3. #25 の再帰検証ルールが、`docs/`配下のどの要素(`prompt_templates` テーブル、SCR-003テンプレート選択画面 等)と直接結びつくか説明できるか。
4. decision digest([`decision-digest.md`](../decision-digest.md))と q_a.md([`q_a.md`](../q_a.md))の運用上の違いを説明できるか。
5. 実装ロードマップ(Phase 1〜5)が[`docs/implementation_plan.md`](../../docs/implementation_plan.md) 4.2 WBSのどの区分に対応するか、[`Phase-0-2.md`](./Phase-0-2.md)の対応表を見ずに説明できるか。
6. なぜREADME.mdを4文書の混在から概要+リンクのみに分割したか、Devex自身の設計([`docs/external_design.md`](../../docs/external_design.md) 2.3節SCR-005)との対応関係を含めて説明できるか。

## 次のフェーズ

**Phase 1**: 環境構築(Docker Compose / `.env` 方針、リポジトリ構成の最終確認)。詳細は [`Phase-0-2.md`](./Phase-0-2.md) のロードマップを参照。チャットヒアリングフロー設計は Phase 2-3 に位置づけ直した。ユーザーが「Phase 1 を開始する」と発話するまでは着手しない(#5)。
