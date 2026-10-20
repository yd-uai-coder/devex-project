# Phase 93 導入: 外部設計書の保護と、CR の反映での合意の更新(ステージ12)

## 目的

ステージ12(合意の精度)の完了の判断基準は「合意済みの行が、CR の範囲の外の再生成で変わらない」。この Phase で、その残りの2つを片付ける。[90-4](../Phase-90/Phase-90-4.md) の Phase 93 にあたる。

- **外部設計書の保護**: [Phase 92](../Phase-92/Phase-92-introduction.md) で要件定義書を守ったのと同じく、外部設計書の画面・API・外部連携を、再生成の後に合意の形へコードで戻す(決定5)。
- **CR の反映での合意の更新**: CR を反映したら、CR で書き換えてよい要素(対象の要件と、保存した予測の画面・API。決定5-2)の合意を、その CR を出どころに更新する。

これで「CR で変えた行が、次の CR を渡さない再生成で古い合意の形に戻る」という Phase 92 の穴が閉じる([外部設計書](../../docs/external_design.md) 2.15節、[内部設計書](../../docs/internal_design.md) 3.3節 12項)。画面は Phase 97 で作る。

- 外部設計書の要素を合意の形へ戻す純粋関数 ── [93-1](./Phase-93-1.md)
- 外部設計書のプロンプトの印と、前の版の外部連携 ── [93-2](./Phase-93-2.md)
- 外部設計書の生成の経路と、CR で書き換えてよい要素 ── [93-3](./Phase-93-3.md)
- CR の反映での合意の更新 ── [93-4](./Phase-93-4.md)

## パイプライン上の位置づけ・前提

```
POST /projects/{id}/generate(CR なし / cr_number)
   │ DocGeneratorService.generate
   │ _rewritable(CR)= rewritable_keys(対象の要件 + 保存した予測の画面・API)──[93-3]
   ▼
_generate_requirements(92-3。exempt = _rewritable)
   ▼
_generate_external_design ──[93-3]── _agreed_elements(詳細設計モードだけ)
   │ build_external_design_messages(前の版の画面・API・外部連携に「合意済み」の印)──[93-2]
   │ LLM(構造化出力)→ build_model
   ▼
protect_external_design(書き換え → 戻す / 同じ名前の画面を除く / 脱落 → 前の版の位置へ)──[93-1]
   ▼
create_version(protection=[{key, reason}])
   ▼
変更影響分析の印 → record_document_apply(反映済み)
   ▼
AgreementService.record_change_request(書き換えてよい要素の合意を CR を出どころに更新)──[93-4]
```

- **前提として読むもの**: [90-1](../Phase-90/Phase-90-1.md)(決定5・5-2)・[90-4](../Phase-90/Phase-90-4.md)(Phase 93 の未確定事項)・[91-1](../Phase-91/Phase-91-1.md)(キーと `body_of`)・[92-1](../Phase-92/Phase-92-1.md)・[92-3](../Phase-92/Phase-92-3.md)(要件定義書の保護と経路)。
- **今の仕組み**:
  - 外部設計書の再生成は、LLM に「関係しない行は unchanged」と頼むだけで、書き換え・脱落をコードで拒まない。
  - 前の版の外部連携はプロンプトに渡らないので、外部連携は毎回書き直される。
  - CR の反映は CR を反映済みにして印を残すだけで、合意の記録は変えない。そのため、CR で変えた要件の行は、次の CR を渡さない再生成で 92 の保護により束の形に戻る。
- **この Phase を始めた時点の状態**: 外側のリポジトリは `d9d3f3c`、devex-api は `stage11-15` ブランチの `87ea4f9`、devex-ui は `main` の `a80821e`。どれも未コミットの変更は無い。alembic の head は `956b403c67fe`。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(本体 + samples)。

E2E: この Phase では流さない。画面を変えないためである。ステージ12 の E2E は、Phase 99 で既存の分も含めて全部流す。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 93 開始時」を参照。計画モードで1回(4問)聞いた。

| # | 問い | 決定 |
|---|---|---|
| 1 | 自動実装モード | on(推奨どおり) |
| 2 | CR の反映で合意を更新する時点 | 反映済み(推奨どおり) |
| 3 | 予測に無い画面・API が CR で変わったとき | 合意の形に戻す(推奨どおり) |
| 4 | 外部連携のプロンプト | 前の版の節を足す(推奨どおり) |

Claude の判断(計画の承認で確定):

- **要素の同一性**: キーで決める(画面 = ID、API = `endpoint_key`、外部連携 = サービス名)。合意済みの画面と同じ名前の新しい画面は、ID の付け直しによる重複として除く(90-4 の未確定事項「ID の付け直しの照合」)。外部連携の言い換え(90-4・Phase 91 の申し送り「外部連携のキーはサービス名」)は、決定的に見分けられないので残し、プロンプトの節で起きにくくする。
- **戻す範囲**: 要素のすべての欄。概要・画面遷移・データ入出力は合意の対象ではないので戻さない。
- **CR で書き換えてよい要素の置き場**: `app/change_requests/prediction.py` の `rewritable_keys`。要件定義書・外部設計書の保護と、合意の更新の3か所で使う。
- **合意の更新の範囲**:
  - 書き換えてよい要素のうち、作り直した文書にあるものは今の中身で記録し、無くなったものは「外れた」と記録する。
  - CR で足された新しい要素は合意にしない(次の束で合意になる)。
  - やり直しの反映は、そのときの中身で記録を足す。
- **共通化**(#17): 92-1 の戻す手順を、一覧の種類によらない形(`_protect_rows`)に寄せた。消費者は要件・画面・API・外部連携の4つの一覧である。
- **簡易ドキュメントモード**: 合意を読まず、守らず、記録もしない。
- テンプレートから取り込むものは無い。devex-ui は変えない(応答の `protection` に外部設計書の分が載るだけ)。マイグレーションは無い。

推奨と違った選択は0件。計画の差し戻しは無し。#39 の材料。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-93-1.md`](./Phase-93-1.md) | 外部設計書の要素を合意の形へ戻す純粋関数 | あり(本体 2 + テスト 1) | Phase 91(`body_of`・`integration_key`)・92-1 |
| [`Phase-93-2.md`](./Phase-93-2.md) | プロンプトの印と、前の版の外部連携 | あり(本体 1 + テスト 1) | 92-2(`AGREED_MARK`) |
| [`Phase-93-3.md`](./Phase-93-3.md) | 外部設計書の生成の経路と、CR で書き換えてよい要素 | あり(本体 5 + テスト 1) | 93-1・93-2・92-3 |
| [`Phase-93-4.md`](./Phase-93-4.md) | CR の反映での合意の更新 | あり(本体 4 + テスト 1) | 93-3(`rewritable_keys`)・Phase 91(`AgreementService`) |

## サンプルコード一覧

`textbook/samples/backend/` の新規・更新:

- 93-1: `app/agreements/protection.py`・`app/agreements/__init__.py`・`tests/unit/test_external_design_protection.py`(新規)
- 93-2: `app/documents/external_design/drafting.py`・`tests/unit/test_document_revision.py`
- 93-3: `app/change_requests/prediction.py`・`app/change_requests/__init__.py`・`app/models/generated_document.py`・`app/schemas/document.py`・`app/services/doc_generator_service.py`・`tests/unit/test_external_design_protection_flow.py`(新規)
- 93-4: `app/agreements/items.py`・`app/agreements/__init__.py`・`app/services/agreement_service.py`・`app/services/doc_generator_service.py`・`tests/unit/test_change_request_agreement.py`(新規)
- ミラーしないもの(#21 の共通): 無し(インフラ・設定ファイルは変えていない)。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 作成・更新するファイル | 責務(1行) | テスト観点 |
|---|---|---|---|
| 93-1 | `app/agreements/protection.py` | 外部設計書の合意済みの画面・API・外部連携を合意の形に戻し、戻した要素を返す。プロンプトの印のための ID を返す | 書き換え・脱落の位置・同じ名前の重複・免除・外部連携・次の番号・素通し |
| 93-1 | `app/agreements/__init__.py` | re-export | 同上(パッケージから import) |
| 93-2 | `drafting.py`(外部設計書) | 前の版の外部連携の節・合意済みの印・規則 | 印は合意済みの行だけ・節・印なしは今までどおり |
| 93-3 | `prediction.py`・`change_requests/__init__.py` | CR で書き換えてよい要素のキー | 対象の要件 + 予測の画面・API |
| 93-3 | `generated_document.py`(model)・`document.py`(schema) | 列・応答のコメント | (コメントだけ) |
| 93-3 | `doc_generator_service.py` | 詳細設計モードで外部設計書を守り、戻した要素を版に残す | 束の後の戻し・CR の予測だけ書き換え可・簡易モードは NULL |
| 93-4 | `items.py`・`agreements/__init__.py` | CR の反映で合意にする要素と外れたキー | 更新・外れた・新しい要素・作り直さなかった文書 |
| 93-4 | `agreement_service.py`・`doc_generator_service.py` | 反映と同じトランザクションで合意を CR を出どころに更新する | CR の文が次の再生成で残る・やり直し・簡易モード |

## 写経順序(#23)

章番号順。各章の「作成・更新したファイル」表は依存順に並べた(#30)。

実 import 監査(#15)として、各ファイルの全 import 文を読んだ。import 先のモジュールとシンボルの誕生章が、そのファイルの章以下であることを確かめた。

- `app/agreements/protection.py`(93-1)→ `app.agreements.items` の `AgreedKind`・`integration_key`(Phase 91)、既存の `app.detailed_design.api_list.endpoint_key`・`app.documents.external_design.model`。
- `app/agreements/__init__.py` の 93-1 の分 → `protection` の `AgreedExternalIds`・`agreed_external_ids`・`protect_external_design`(93-1)。93-4 の分 → `items` の `change_request_items`・`kind_of`(93-4)。
- `drafting.py`(93-2)→ 既存の `endpoint_key`、`AGREED_MARK`(92-2)。
- `prediction.py`(93-3)→ 既存の `DOCUMENT_STAGE`。`change_requests/__init__.py`(93-3)→ `rewritable_keys`(93-3)。
- `doc_generator_service.py` の 93-3 の分 → `agreed_external_ids`・`protect_external_design`(93-1)、`rewritable_keys`(93-3)、`build_external_design_messages` の `agreed_*`(93-2)。93-4 の分 → 既存の `AgreementService` の `record_change_request`(93-4)。
- `agreement_service.py`(93-4)→ `change_request_items`(93-4)・`AgreedKind`(91)・`rewritable_keys`(93-3)・既存の `targets_from_json`・`ChangeRequest`。
- テスト:
  - `test_external_design_protection.py`(93-1)→ 93-1 と Phase 91。
  - `test_document_revision.py` の追記(93-2)→ 既存の `GeneratedIntegration`・`AGREED_MARK`。
  - `test_external_design_protection_flow.py`(93-3)→ `rewritable_keys`(93-3)・`RestoredRead`(92-3)・既存の fixture。
  - `test_change_request_agreement.py`(93-4)→ `change_request_items`・`kind_of`(93-4)・既存の fixture。

各章のテストは、その章で作成・更新した全ファイルを少なくとも1度 import する(#15)。`__init__.py` は、テストがパッケージから import する。93-3 の model・schema は、流れのテストが `GeneratedDocument`・`RestoredRead` を import する。

## 検証結果

- ユニット: 章ごとに、章のテストと関係する既存のテスト(要件定義書の保護・生成・CR の反映と検証・予測・合意の記録)を流した。Phase の終わりに全体を流した(→ 下の「全体テスト」)。
- `ruff check`(app・tests): 通った。`pyright`(触ったファイル): 0 件。
- 開発 DB: マイグレーションは無い。alembic の head は `956b403c67fe` のままで、`alembic check` で差が無いことを確かめた。「トレンド追跡アプリ」は再生成していない(Phase 99 の題材のため)。
- `textbook/tools/samples_check.py --api-since stage11-15`: 不一致 0・本体のみ 0(一致 946 / 並び順のみ差 8 / 例外 5)。
- `textbook/tools/link_check.py`: リンク切れ 0 件。
- 全体テスト: ユニット 1686 件・統合 34 件がすべて通った(統合は専用のテスト DB)。
- E2E: 流していない(画面を変えていないため。Phase 99 で流す)。

## 未消化の申し送り(#37)

[Phase 92](../Phase-92/Phase-92-introduction.md#未消化の申し送り37) から引き継いだもの。

**ステージ12 の中で扱うもの**(行き先は [90-4](../Phase-90/Phase-90-4.md)):
- **推測の採用率・決める機会**(振り返り 6節)→ Phase 94・98。
- **影響が広がる変更の実 LLM での比較**(P89)→ Phase 99 の効果測定。要件定義書と外部設計書の保護で戻した件数も、実 LLM で測る(版の `protection`)。CR を反映した後の CR なしの再生成で、CR の変更が残ることも確かめる。
- **下書きの中の直しは時系列に残さない**(P89)→ Phase 95・98。
- **段階の承認で付く印の漏れ**(P86 の決定)→ Phase 96。
- **新しい要件を足す CR の予測の起点を人が選ぶ形**(P83)→ Phase 96・98。起点を持たせると `rewritable_keys` の予測の要素も増える(この Phase の仕組みのまま効く)。
- **戻した件数の画面と履歴**: 版の `protection`(要件定義書・外部設計書)を、Phase 95(履歴)と 97(画面)で読む。合意の出どころ CR-n も 97 の画面に出す。
- **予測に無い要素を戻したことの見せ方**(この Phase で生まれた): CR の反映で予測に無い画面・API を戻すと、予測と実際の比較の「実際だけ」に出ない。Phase 97 の画面で、版の `protection` から「CR の範囲の外なので戻した」と分かるようにする。
- **外部連携の言い換え**(Phase 91 の申し送りの残り): サービス名を言い換えた行は、合意済みの行と並んで残る(プロンプトの節で起きにくくした)。Phase 99 の実 LLM で起きるかを見る。
- **Phase 94〜99 の未確定事項**: [90-4](../Phase-90/Phase-90-4.md)「未確定事項」。

**ステージ12 の範囲の外**:
- **本番への反映と本番での確認**: ステージ15 の完了時に、[`OPERATIONS.md`](../../devex-api/OPERATIONS.md) 10.8節で行う。Phase 91 の2つのマイグレーションと Phase 92 の `956b403c67fe` を、Phase 99 で 10.8節に足す(この Phase にマイグレーションは無い)。
- **要約の生成の回数の上限**・**束の一覧の入れた CR**: 使われ方を見て決める(ステージ13 以降)。
- 規模の集計と選択肢つきの説明(ステージ13)。
- 振り返り 6節の残り5件・生成の質の候補4件(Phase 90 と同じ)。

**持ち越し**(触るときに直す。中身は [振り返り](../retrospectives/project-retrospective.md) 8節):
- `test_chat_service.py` などの pyright の指摘(Phase 40)
- devex-ui の並列のテストのタイムアウト(Phase 44)
- 偽 LLM の外部設計書の GET に DF が無い(Phase 45)
- `DfdEditorTabs` のテストのまれな失敗(Phase 77)
- Google の公開鍵を毎回取りに行く(Phase 74)
- `ListCard` の入れ物(Phase 79。テンプレートでは直した)
- 英語のままの refresh の失敗の文(Phase 79)
- `streamChat.test.ts` の lint の警告(使っていない変数。既存)
- `appendix/measurements/stage11/measure.py` の `ruff check` の指摘(行の長さ1件。Phase 80 から)
- 反映の後の CR の流れの部品: `tests/fixtures/change_requests.py`。85-2〜85-4 のテストの中の同じ手順は、触るときに寄せる(#17)。

**ユーザーが決めるもの**:
- **開発環境の後始末**: 確認用の利用者・プロジェクト(開発 DB の束 12・CR 8 など)、DB の事故の後の複製。「トレンド追跡アプリ」は Phase 99 の効果測定の題材の候補なので残しておく。
- **この Phase の未コミット**: 外側のリポジトリ(教材・docs・samples)と devex-api。コミットはユーザーが行う(#35)。

**この Phase で解決したもの**:
- CR を渡さない再生成で、合意した外部設計書の画面・API・外部連携が動く(P89)→ [93-1](./Phase-93-1.md)・[93-3](./Phase-93-3.md)。
- CR を反映した行が、次の CR なしの再生成で合意の形に戻る(Phase 92 で生まれた)→ [93-4](./Phase-93-4.md)。
- 外部連携のキーはサービス名(Phase 91)→ キーはそのままで、前の版の節で言い換えを起きにくくした([93-2](./Phase-93-2.md))。残りは上の「外部連携の言い換え」。
- Phase 93 の未確定事項(合意を更新する時点・予測に無い要素が変わったとき・ID の付け直しの照合)→ 「着手時の相談で決めたこと」。

**この Phase で生まれたもの**:
- 上の「予測に無い要素を戻したことの見せ方」(Phase 97 へ)。
- **セッションの区切りの記録**: Phase 93 は1セッションで行った。流れは次のとおり。
  1. 計画モードで調査(Explore エージェント1つ)・質問1回(4問)・計画の承認
  2. 93-1〜93-4 の実装
  3. 全体テスト
  4. samples
  5. docs・教材

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

設問は Phase の要点の要約である(回答は求めない)。

1. CR で書き換えてよい要素を「対象の要件と、保存した予測の画面・API」に限り、予測に無い画面・API の変更は戻すのはなぜか。その代わりに失うものは何か。
2. 合意を更新する時点を、検証済みではなく反映済みにしたのはなぜか。
3. 画面は ID で戻し、同じ名前の新しい画面を除くのに、外部連携の言い換えは残すのはなぜか。
4. プロンプトの印のために、合意のキーではなく画面 ID・`endpoint_key`・サービス名を渡すのはなぜか(依存の向き)。
5. CR で足された新しい要件・画面を、反映の時点で合意にしないのはなぜか。それはいつ合意になるか。

## 次のフェーズ

**Phase 94**: 確認事項の一覧 API。今の model と観点の表から、推測の要件・推測の利用者・根拠が open の観点を決定的に集める。行ごとの「決める機会」と状態(未確認 / 確認済み / 却下)を保存し、推測の採用率を数える。着手時に、[90-4](../Phase-90/Phase-90-4.md) の Phase 94 の未確定事項を決める(一覧を保存するか・確認済みで合意を記録するか・採用率の分母・観点の表の画面との関係)。
