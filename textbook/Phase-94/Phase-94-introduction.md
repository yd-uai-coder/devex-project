# Phase 94 導入: 確認事項の一覧 API(ステージ12)

## 目的

ステージ12(合意の精度)の完了の判断基準の後半は「推測の要件・推測の利用者・根拠が未決の観点が、すべて確認事項に出る」(マイルストーン13)。この Phase で、それを集める API を作る。[90-4](../Phase-90/Phase-90-4.md) の Phase 94 にあたる。

- 今の要件定義書の model と観点の表から、確認事項を決定的に並べる(LLM なし)── [94-1](./Phase-94-1.md)
- 利用者が項目ごとに決めた欄(決める機会・状態・メモ)を保存する ── [94-2](./Phase-94-2.md)
- 一覧と更新の API。推測の行を確認済みにすると採用にし、合意を記録する ── [94-3](./Phase-94-3.md)

推測の採用率(振り返り 6節)も、この一覧の状態から数える。画面は Phase 98 で作る。

## パイプライン上の位置づけ・前提

```
GET /projects/{id}/confirmations
   │ ConfirmationService.view(詳細設計モードだけ)
   │ 今の要件定義書の model + 観点の表(hearing_points)
   ▼
confirmation_items ──[94-1]── 推測の要件 → 推測の利用者 → 根拠が未決の観点(grounding_points)
   ▼
confirmation_list_read ──[94-3]── 保存した欄(confirmation_items 表 ──[94-2])を重ねる・採用率
   ▲
PATCH /projects/{id}/confirmations/{key}
   │ ConfirmationService.update
   │ 推測の要件・利用者を確認済み → apply_adopt_requirement / apply_adopt_user ──[94-3]
   │                                (行を採用に・合意 adopt・項目を確認済みに)
   ▼
ConfirmationRepository.save(渡した欄だけ)──[94-2]

POST .../requirements/rows/{id}/adopt(プレビューの「採用にする」)も、項目を確認済みにする
```

- **前提として読むもの**: [90-1](../Phase-90/Phase-90-1.md)(決定4)・[90-4](../Phase-90/Phase-90-4.md)(Phase 94 の未確定事項)・[91-1](../Phase-91/Phase-91-1.md)(合意のキー・1.2 は全体で1つ)・[92-1](../Phase-92/Phase-92-1.md)(出どころの上限と合意)。
- **今の仕組み**:
  - 要件の行と 1.2 の行は出どころ(ユーザー / 採用 / 推測)を持ち、出どころは根拠の観点の状態で上限がかかる(`cap_source`)。
  - プレビューは推測の要件の一覧と「採用にする」を出すだけで、推測の利用者・根拠が未決の観点・決める機会は出ない。
  - 観点の状態は、チャットの判定と観点の表の画面(「対象外(後で決める)」)で決まる。
- **この Phase を始めた時点の状態**: 外側のリポジトリは `9174ca1`、devex-api は `stage11-15` ブランチの `819016c`、devex-ui は `main` の `a80821e`。どれも未コミットの変更は無い。alembic の head は `956b403c67fe`。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(本体 + samples)。

E2E: この Phase では流さない。画面を変えないためである。ステージ12 の E2E は、Phase 99 で既存の分も含めて全部流す。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 94 開始時」を参照。計画モードで1回(4問)聞いた。

| # | 問い | 決定 |
|---|---|---|
| 1 | 自動実装モード | on(推奨どおり) |
| 2 | 一覧の保存と採用率 | 決めた欄だけ保存し、採用率 = 確認済み ÷(確認済み + 却下)(推奨どおり) |
| 3 | 確認済みにしたとき | 採用にして合意を記録する。プレビューの採用も確認済みにする(推奨どおり) |
| 4 | 観点の表との関係 | 観点の状態は観点の表(とチャット)で決め、一覧は読むだけ(推奨どおり) |

Claude の判断(計画の承認で確定):

- **項目のキー**: `req:<ID>`(合意のキーと同じ)・`user:<利用者の名前>`(1.2 の行には ID が無い)・`point:<観点のキー>`。
- **根拠の規則の共有**(#17): 根拠が未決の観点は、出どころの上限と同じ規則(規模は制約の行だけ)で決める。`cap_source` の中の規則を `grounding_points` に出した。消費者は確認事項の組み立て。
- **確認済み・却下の行は、一覧から消えた後も残す**(`present: false`)。採用にした行は推測でなくなって一覧から消えるため。未確認のまま消えた行は出さない。
- **採用を commit しない形に分けた**: `adopt_requirement` = `apply_adopt_requirement` + commit。確認事項の更新は、欄の保存と採用を1つのトランザクションで行う。`DocGeneratorService` は `ConfirmationRepository` を直接使い、`ConfirmationService` と循環しない。
- **利用者の採用**: 1.2 は合意では全体で1つの要素なので、利用者を確認済みにすると 1.2 全体を合意にする(ほかの推測の利用者は、推測のまま合意の中身に入る)。
- **却下は状態だけ**: 文書は変えない。行を消すのは CR か再生成。
- **簡易ドキュメントモード**: GET・PATCH とも 409。プレビューの採用は一覧に書かない(合意と同じ)。
- テンプレートから取り込むものは無い。devex-ui は変えない。マイグレーションは `382a5efa3508`(表を足すだけ)。

推奨と違った選択は0件。計画の差し戻しは無し。#39 の材料。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-94-1.md`](./Phase-94-1.md) | 確認事項を組み立てる純粋関数・採用率 | あり(本体 4 + テスト 1) | Phase 36(出どころ)・Phase 91(1.2 の扱い) |
| [`Phase-94-2.md`](./Phase-94-2.md) | 利用者が決めた欄の保存 | あり(本体 5 + テスト 1) | 94-1(`ConfirmationItem`) |
| [`Phase-94-3.md`](./Phase-94-3.md) | 一覧と更新の API、「採用にする」との接続 | あり(本体 7 + テスト 2) | 94-1・94-2・Phase 91(`AgreementService`) |

## サンプルコード一覧

`textbook/samples/backend/` の新規・更新:

- 94-1: `app/documents/requirements/assemble.py`・`app/documents/requirements/__init__.py`・`app/confirmations/items.py`(新規)・`app/confirmations/__init__.py`(新規)・`tests/unit/test_confirmation_items.py`(新規)
- 94-2: `app/models/confirmation.py`(新規)・`app/models/__init__.py`・`app/models/project.py`・`alembic/versions/382a5efa3508_add_confirmation_items.py`(新規)・`app/repositories/confirmation.py`(新規)・`tests/unit/test_confirmation_repository.py`(新規)
- 94-3: `app/services/errors.py`・`app/schemas/confirmation.py`(新規)・`app/services/agreement_service.py`・`app/services/doc_generator_service.py`・`app/services/confirmation_service.py`(新規)・`app/api/routes/confirmations.py`(新規)・`app/api/routes/__init__.py`・`tests/unit/test_confirmation_service.py`(新規)・`tests/integration/test_confirmations_flow.py`(新規)
- ミラーしないもの(#21 の共通): 無し(インフラ・設定ファイルは変えていない)。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 作成・更新するファイル | 責務(1行) | テスト観点 |
|---|---|---|---|
| 94-1 | `assemble.py`・`requirements/__init__.py` | 根拠の観点の規則を公開し、推測の利用者を採用にする | 規模は制約の行だけ・推測でない行は変えない |
| 94-1 | `confirmations/items.py`・`__init__.py` | 確認事項の項目を並べ、推測の採用率を数える | 並び・未決だけ・refs・消えた行の数え方・分母0 |
| 94-2 | `models/confirmation.py`・`models/__init__.py`・`project.py`・マイグレーション | 項目ごとの利用者が決めた欄の表 | 一意・往復・`alembic check` |
| 94-2 | `repositories/confirmation.py` | 渡した欄だけを保存し、採用で確認済みにする | 作成と部分更新・未設定に戻す |
| 94-3 | `errors.py`・`schemas/confirmation.py` | 404 のエラー、応答と本文、欄の重ね合わせ | 消えた確認済みが残る・null の状態は 422 |
| 94-3 | `agreement_service.py`・`doc_generator_service.py` | 採用を commit しない形に分け、利用者の採用と 1.2 の合意、採用で確認済みに | 合意の記録・プレビューの採用で確認済み |
| 94-3 | `confirmation_service.py`・`routes/confirmations.py`・`routes/__init__.py` | 一覧と更新の API | 確認済みで採用・却下と観点は欄だけ・404・簡易モード 409 |

## 写経順序(#23)

章番号順。各章の「作成・更新したファイル」表は依存順に並べた(#30)。

実 import 監査(#15)として、各ファイルの全 import 文を読んだ。import 先のモジュールとシンボルの誕生章が、そのファイルの章以下であることを確かめた。

- `assemble.py`(94-1)→ import の変更なし。`requirements/__init__.py`(94-1)→ `assemble` の `USER_POINTS`・`grounding_points`・`mark_user_adopted`(94-1)。
- `confirmations/items.py`(94-1)→ `USER_POINTS`・`grounding_points`(94-1)、既存の `RequirementRow`・`RequirementsModel`・`UserScene`・`POINT_KEYS`・`PointState`・`point_def`。`confirmations/__init__.py`(94-1)→ `items`(94-1)。
- `models/confirmation.py`(94-2)→ 既存の `Base`。`models/__init__.py`・`project.py`(94-2)→ `ConfirmationItemRecord`(94-2)。
- `repositories/confirmation.py`(94-2)→ `ConfirmationItem`・`ConfirmationStatus`・`Opportunity`(94-1)、`ConfirmationItemRecord`(94-2)、既存の `CRUDRepository`。
- `schemas/confirmation.py`(94-3)→ `app.confirmations` の各名前(94-1)・`ConfirmationItemRecord`(94-2)。
- `agreement_service.py`(94-3)→ 既存の `UserScene`。`doc_generator_service.py`(94-3)→ `requirement_item`・`user_item`(94-1)・`mark_user_adopted`(94-1)・`ConfirmationRepository`(94-2)。
- `confirmation_service.py`(94-3)→ `confirmation_items`・`item_target`・`ConfirmationItem`(94-1)、`ConfirmationRepository`(94-2)、`schemas/confirmation`・`ConfirmationItemNotFoundError`・`apply_adopt_*`(94-3)、既存の `require_detailed`・`parse_requirements_model`。`routes/confirmations.py`(94-3)→ `ConfirmationService`・スキーマ(94-3)。`routes/__init__.py`(94-3)→ `confirmations.router`(94-3)。
- テスト: `test_confirmation_items.py`(94-1)→ 94-1 と既存の `app.hearing`。`test_confirmation_repository.py`(94-2)→ 94-1・94-2。`test_confirmation_service.py`・`test_confirmations_flow.py`(94-3)→ 94-1〜94-3 と既存の fixture。

各章のテストは、その章で作成・更新した全ファイルを少なくとも1度 import する(#15)。`__init__.py` はテストがパッケージから import する。94-2 の `models/__init__.py`・`project.py` は、テストが `ConfirmationItemRecord` と `project.confirmation_items` を使う(テーブル作成も `Base.metadata` 経由)。マイグレーションは import せず、開発 DB の往復と `alembic check` で確かめた。94-3 の `routes/__init__.py` は、テストがアプリの OpenAPI の経路で確かめる。

## 検証結果

- ユニット: 章ごとに、章のテストと関係する既存のテスト(要件定義書の組み立て・合意の記録)を流した。Phase の終わりに全体を流した(→ 下の「全体テスト」)。
- `ruff check`(app・tests): 通った。`pyright`(触ったファイル): 0 件。
- 開発 DB: alembic の head が1つ(`382a5efa3508`)・ID の衝突なしを確かめて upgrade。downgrade → upgrade の往復と `alembic check`(差なし)。
- 「トレンド追跡アプリ」(再生成していない。読むだけ): 一覧は推測の要件12・推測の利用者2・根拠が未決の観点6の計20件。[ベースライン](../../appendix/measurements/stage12-baseline.md) の「確認事項に出ない」2件(利用者2件・観点6件)が、すべて出るようになった。採用率は分母0で null。
- `textbook/tools/samples_check.py --api-since stage11-15`: 不一致 0・本体のみ 0(一致 958 / 並び順のみ差 8 / 例外 5)。
- `textbook/tools/link_check.py`: リンク切れ 0 件。
- 全体テスト: ユニット 1707 件・統合 36 件がすべて通った(統合は専用のテスト DB)。
- E2E: 流していない(画面を変えていないため。Phase 99 で流す)。

## 未消化の申し送り(#37)

[Phase 93](../Phase-93/Phase-93-introduction.md#未消化の申し送り37) から引き継いだもの。

**ステージ12 の中で扱うもの**(行き先は [90-4](../Phase-90/Phase-90-4.md)):
- **確認事項の一覧の画面**(この Phase で API ができた)→ Phase 98。置き場と、SCR-005(プレビューの推測の要件の一覧・「採用にする」)・観点の表の画面・束・CR のページからのリンク。`present: false` の行(確認済み・却下)の見せ方、決める機会の選び方も 98 で決める。
- **影響が広がる変更の実 LLM での比較**(P89)→ Phase 99 の効果測定。保護で戻した件数(版の `protection`)、CR を反映した後の CR なしの再生成で CR の変更が残ること、確認事項の件数と採用率も測る。
- **下書きの中の直しは時系列に残さない**(P89)→ Phase 95・98。
- **段階の承認で付く印の漏れ**(P86 の決定)→ Phase 96。
- **新しい要件を足す CR の予測の起点を人が選ぶ形**(P83)→ Phase 96・98。
- **戻した件数の画面と履歴**: 版の `protection` を Phase 95(履歴)と 97(画面)で読む。合意の出どころ CR-n も 97 の画面に出す。
- **予測に無い要素を戻したことの見せ方**(Phase 93)→ Phase 97。
- **外部連携の言い換え**(Phase 91 の申し送りの残り)→ Phase 99 の実 LLM で起きるかを見る。
- **Phase 95〜99 の未確定事項**: [90-4](../Phase-90/Phase-90-4.md)「未確定事項」。

**ステージ12 の範囲の外**:
- **本番への反映と本番での確認**: ステージ15 の完了時に、[`OPERATIONS.md`](../../devex-api/OPERATIONS.md) 10.8節で行う。Phase 91 の2つのマイグレーション・Phase 92 の `956b403c67fe`・この Phase の `382a5efa3508` を、Phase 99 で 10.8節に足す。
- **推測の利用者のキーが名前であること**(この Phase で生まれた): 再生成で LLM が利用者の名前を言い換えると、別の項目になり、前の名前の欄(決める機会・メモ)は未確認のまま一覧から消える。1.2 が合意済みなら保護で名前は戻る。使われ方を見て決める(ステージ13 以降)。
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
- **開発環境の後始末**: 確認用の利用者・プロジェクト(開発 DB の束 12・CR 8 など)、DB の事故の後の複製。「トレンド追跡アプリ」は Phase 99 の効果測定の題材の候補なので残しておく(この Phase では一覧を読んだだけで、欄は保存していない)。
- **この Phase の未コミット**: 外側のリポジトリ(教材・docs・samples)と devex-api。コミットはユーザーが行う(#35)。

**この Phase で解決したもの**:
- **推測の採用率・決める機会**(振り返り 6節)→ API は [94-1](./Phase-94-1.md)・[94-3](./Phase-94-3.md)。画面は Phase 98(上の申し送り)。
- Phase 94 の未確定事項(一覧の保存・確認済みで合意を記録するか・採用率の分母・観点の表の画面との関係)→ 「着手時の相談で決めたこと」。

**この Phase で生まれたもの**:
- 上の「推測の利用者のキーが名前であること」(ステージ13 以降)。
- **セッションの区切りの記録**: Phase 94 は1セッションで行った。流れは次のとおり。
  1. 計画モードで調査(エージェントは使わず直接読んだ)・質問1回(4問)・計画の承認
  2. 94-1〜94-3 の実装(開発 DB のマイグレーションを含む)
  3. 全体テスト
  4. samples
  5. docs・教材

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

設問は Phase の要点の要約である(回答は求めない)。

1. 一覧そのものを保存せず、利用者が決めた欄だけを保存するのはなぜか。その代わりに測れなくなったものは何か(採用率の定義の改め)。
2. 「根拠が未決の観点」の根拠を、出どころの上限(`cap_source`)と同じ規則で決めるのはなぜか。
3. 確認済みにした推測の要件を採用にし、プレビューの「採用にする」も確認済みにするのはなぜか(2つの入口)。
4. 確認済みにした行を、一覧から消えた後も `present: false` で残すのはなぜか。未確認のまま消えた行を出さないのはなぜか。
5. `adopt_requirement` を commit しない `apply_adopt_requirement` に分けたのはなぜか。`DocGeneratorService` が `ConfirmationService` ではなくリポジトリを使うのはなぜか(依存の向き)。

## 次のフェーズ

**Phase 95**: 行の履歴 API と、CR の下書きの直しの時系列。要素のキーごとに、合意の記録の行・保護で戻した版・結んだ CR を並べる。CR の下書きの編集を、たどる記録に1行残す。着手時に、[90-4](../Phase-90/Phase-90-4.md) の Phase 95 の未確定事項を決める(履歴の応答の単位・下書きの直しの残し方)。
