# Phase 96 導入: 段階の承認の印と、新しい要件の予測の起点(ステージ12)

## 目的

ステージ12(合意の精度)の決定8([90-1](../Phase-90/Phase-90-1.md))は、推奨では後へ回すはずだった2件をステージ12 に入れたものである。どちらも「合意した範囲の外へ変更が届いていないか」を CR の単位で確かめる仕組みの穴をふさぐ。[90-4](../Phase-90/Phase-90-4.md) の Phase 96 にあたる。

- CR を渡して作り直した段階を承認したときの印を CR に結び、検証の対象にする。作り直した段階が未承認の間は検証済みにしない(決定8-2。P86 の決定の見直し)── [96-1](./Phase-96-1.md)
- 新しい要件を足す CR に、人が選んだ起点(既存の要件・画面・API)を持たせ、起点から予測する(決定8-3。P83 の決定の見直し)── [96-2](./Phase-96-2.md)(純粋関数)・[96-3](./Phase-96-3.md)(保存と API)

画面は Phase 98(起点を選ぶ欄・作り直した段階の未承認の見せ方)。

## パイプライン上の位置づけ・前提

```
CR-n(反映済み)── 段階の作り直し(cr_number)── 時系列に apply{stage, version}・段階の行に generation_change_request_id
   │
   ▼ POST .../design-stages/{stage}/approve
DesignStageService.approve ──[96-1]── pending_stages で「作り直した後の最初の承認」か
   │  そうなら: 印の出どころに cr:n → CR の applied_impact に重ねる → 時系列に approve_stage
   ▼
ChangeRequestService.verification / verify ──[96-1]── 結んだ印も確かめる。未承認の段階があれば止める

新しい要件を足す CR ── origins(要件・画面・API)──[96-3 保存・確かめ]
   ▼
predict(..., origins=) ──[96-2]── 起点からも impact_of でたどる。起点の画面・API そのものも項目に
   ▼
保存した予測 → rewritable_keys(保護の例外。Phase 93)・文書の側の確認(Phase 86)・説明書・反映の指示
```

- **前提として読むもの**: [90-1](../Phase-90/Phase-90-1.md)(決定8)・[90-4](../Phase-90/Phase-90-4.md)(Phase 96 の未確定事項)・[85-3](../Phase-85/Phase-85-3.md)(印の出どころ `cr:` と CR の印の写し)・[86-1](../Phase-86/Phase-86-1.md)(検証の条件。段階の承認の印を結ばなかった理由)・[83-1](../Phase-83/Phase-83-1.md)(予測。新しい要件は予測に入らない)・[93-1](../Phase-93/Phase-93-1.md)(`rewritable_keys`)。
- **今の仕組み**:
  - 印は段階の承認と文書の表示中の版の切り替えで付く(Phase 43)。CR を渡した文書の再生成の印は出どころに `cr:<番号>` を持ち、CR の印の写し(`applied_impact`)に重なって検証の対象になる。段階を CR で作り直して承認したときの印は、CR に結ばれていなかった。
  - 予測は対象の要件から `impact_of` でたどる。新しい要件を足す分は起点が無く「予測に入っていない」と示すだけだった。保存した予測の画面・API は、反映で書き換えてよい要素になる(Phase 93)。
- **この Phase を始めた時点の状態**: Phase 91〜95 はコミット済み。devex-api は `stage11-15` ブランチの `6595142`、devex-ui は変えない。alembic の head は `382a5efa3508`。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(本体 + samples)。

E2E: この Phase では流さない。画面を変えないためである。ステージ12 の E2E は、Phase 99 で既存の分も含めて全部流す。CR の流れの E2E(`change-request-flow.spec.ts`)は段階の作り直しを通らないので、検証の新しい条件には当たらない。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 96 開始時」を参照。計画モードで1回(4問)聞いた。

| # | 問い | 決定 |
|---|---|---|
| 1 | 自動実装モード | on(推奨どおり) |
| 2 | 承認の印を結んだ後の検証の条件(90-4 の未確定事項) | 結んだ印も検証の対象にし、CR で作り直した段階が未承認の間も検証済みにしない(推奨どおり) |
| 3 | 起点の持ち方(90-4 の未確定事項) | CR の別の項目 `origins`。起点の画面・API そのものも予測に入れ、起点の要件は入れない。候補の API も作る(推奨どおり) |
| 4 | 説明書と反映の指示での見せ方(90-4 の未確定事項) | 既存の節に足す(2節の新しい要件の行・3節の「届いた対象」・指示の新しい要件の行)(推奨どおり) |

Claude の判断(計画の承認で確定):

- **結ぶのは作り直した後の最初の承認だけ**: CR の時系列の段階の反映の行の版と、段階の承認した版を比べる(列を足さない)。後で CR なしで作り直したら外れる。CR が反映済みのときだけ結ぶ。
- **記録だけの行 `approve_stage`**: 状態を変えず、段階・版・結んだ印の数を残す。印が0件でも残す。
- **循環の回避**: `DesignStageService` から CR へは `ChangeRequestRepository` で書く(Phase 86 と同じ)。`merge_applied_marks` は純粋関数なので `app/change_requests/comparison.py` へ移して共有した(#17)。
- **起点の表示名も保存する**: 反映の指示は予測を作らずに組み立てるため。束は凍結されているので古くならない。
- **起点は新しい要件を足す CR だけ**。印を外すなら起点も外す(外さなければ 422)。`null` は変えない、空の一覧で外す。
- **束の写しの取り出し**を `baseline_snapshots` にまとめた(予測・確かめ・候補で共有。#17)。
- テンプレートから取り込むものは無い。devex-ui は変えない。マイグレーションは1つ(`ee299cd210b8`)。

推奨と違った選択は0件。計画の差し戻しは無し。#39 の材料。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-96-1.md`](./Phase-96-1.md) | CR で作り直した段階の承認の印を CR に結ぶ | あり(本体 10 + テスト 2) | Phase 85(段階の反映・`cr:`)・86(検証) |
| [`Phase-96-2.md`](./Phase-96-2.md) | 新しい要件の予測の起点からたどる(純粋関数) | あり(本体 4 + テスト 3) | Phase 83(予測)・93(`rewritable_keys`)。96-1 とは独立 |
| [`Phase-96-3.md`](./Phase-96-3.md) | 起点の保存と API | あり(本体 9 + テスト 3) | 96-2 |

## サンプルコード一覧

`textbook/samples/backend/` の新規・更新:

- 96-1: `app/change_requests/states.py`・`comparison.py`・`stage_approvals.py`(新規)・`verification.py`・`trace.py`・`__init__.py`・`app/schemas/change_request.py`・`app/services/design_stage_service.py`・`app/services/change_request_service.py`・`app/api/routes/design_stages.py`・`tests/unit/test_change_request_stage_approvals.py`(新規)・`tests/unit/test_change_request_reflection.py`
- 96-2: `app/change_requests/prediction.py`・`explanation.py`・`instruction.py`・`__init__.py`・`tests/unit/test_change_request_prediction.py`・`test_change_request_explanation.py`・`test_change_request_instruction.py`
- 96-3: `app/models/change_request.py`・`alembic/versions/ee299cd210b8_add_change_request_origins.py`(新規)・`app/repositories/change_request.py`・`app/change_requests/trace.py`・`app/schemas/baseline.py`・`app/schemas/change_request.py`・`app/services/baseline_service.py`・`app/services/change_request_service.py`・`app/api/routes/baselines.py`・`tests/unit/test_change_request_origins.py`(新規)・`tests/unit/test_change_request_service.py`・`tests/integration/test_change_requests_flow.py`
- ミラーしないもの(#21 の共通): 無し(インフラ・設定ファイルは変えていない)。
- 複数の章が触るファイル(`__init__.py`・`trace.py`・`schemas/change_request.py`・`change_request_service.py`)は、章ごとの中間の版を作って `tagmerge.py` を2回当て、章ごとのタグにした。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 作成・更新するファイル | 責務(1行) | テスト観点 |
|---|---|---|---|
| 96-1 | `stage_approvals.py`・`states.py` | CR で作り直した後にまだ承認していない段階を決める | 反映の行の読み方・未承認の判定(前の承認・別の CR・CR なし・反映の行なし) |
| 96-1 | `comparison.py`・`verification.py`・`trace.py`・`__init__.py`・`schemas/change_request.py` | 印の写しに重ねる・未承認の段階で検証を止める・たどる記録に行の名前 | `complete` の条件・`approve_stage` の段階と版 |
| 96-1 | `design_stage_service.py`・`change_request_service.py`・`routes/design_stages.py` | 承認で印を CR に結び、検証の確かめに未承認の段階を出す | 作り直し → 検証が止まる → 承認で結ぶ → 未確認の印が残る。CR なしの作り直しは結ばない |
| 96-2 | `prediction.py`・`__init__.py` | 起点からたどる・起点の候補 | 起点の画面は項目に入る・起点の要件は入らない・対象との合わせ方・知らない起点・保存の形 |
| 96-2 | `explanation.py`・`instruction.py` | 説明書と反映の指示に起点を出す | 2節・3節・指示の1行。起点の無い CR は今までと同じ |
| 96-3 | `models/change_request.py`・マイグレーション・`repositories/change_request.py` | 起点を保存する | 往復・`alembic check` |
| 96-3 | `schemas/*`・`baseline_service.py`・`change_request_service.py`・`routes/baselines.py`・`trace.py` | 起点の確かめ・保存・応答・候補の API | 422 の3通り・直しの規則・写し・反映の指示・履歴・候補 |

## 写経順序(#23)

章番号順。各章の「作成・更新したファイル」表は依存順に並べた(#30)。96-1 と 96-2 は `app/change_requests/__init__.py` を、96-1 と 96-3 は `trace.py`・`schemas/change_request.py`・`change_request_service.py` を両方が更新する(章ごとのタグ)。

実 import 監査(#15)として、各ファイルの全 import 文を読んだ。import 先のモジュールとシンボルの誕生章が、そのファイルの章以下であることを確かめた。

- `stage_approvals.py`(96-1)→ `ChangeRequestAction`(既存の `states.py`。96-1 で `approve_stage` を足した)。`comparison.py`(96-1)→ 既存の `Mark`。`verification.py`・`trace.py`(96-1)→ import の変更なし。`__init__.py`(96-1)→ `merge_applied_marks`・`stage_approvals` の4つ(96-1)。(96-2)→ `prediction` の6つ(96-2)。
- `schemas/change_request.py`(96-1)→ import の変更なし。(96-3)→ import の変更なし(`Prediction.origins` は 96-2)。
- `design_stage_service.py`(96-1)→ `APPROVE_STAGE_ACTION`・`StageFacts`・`merge_applied_marks`・`pending_stages`・`stage_apply_versions`(96-1)、既存の `CHECKABLE_STATUSES`・`cr_source`・`ChangeRequestRepository`。
- `change_request_service.py`(96-1)→ `StageFacts`・`merge_applied_marks`・`pending_stages`・`stage_apply_versions`(96-1)。(96-3)→ `origin_candidates_from_snapshots`(96-2)・`baseline_snapshots`(96-3。表の上側の `baseline_service.py`)。
- `prediction.py`・`explanation.py`・`instruction.py`(96-2)→ import の追加は `explanation.py` の `PredictedItem`・`origin_name`(96-2 の `prediction.py`)だけ。
- `baseline_service.py`(96-3)→ `PredictedOrigin`・`origin_candidates_from_snapshots`(96-2)。`routes/baselines.py`(96-3)→ `BaselineOriginRead`(96-3)。モデル・リポジトリ(96-3)→ import の変更なし。
- テスト: `test_change_request_stage_approvals.py`(96-1)→ 96-1 と既存の fixture・`DesignStageApprove`。`test_change_request_prediction.py`・`explanation`・`instruction`(96-2)→ 96-2 と既存の `rewritable_keys`。`test_change_request_origins.py`(96-3)→ 96-2・96-3 と既存の `AgreementService`。

各章のテストは、その章で作成・更新した全ファイルを少なくとも1度 import する(#15)。`__init__.py` はテストがパッケージから import する。96-1 の `states.py` は `APPROVE_STAGE_ACTION` の型、`comparison.py` は `merge_applied_marks`(`test_change_request_reflection.py`)、ルートは `approve_design_stage` を通る。96-3 のモデル・リポジトリはサービスの経路で使い、マイグレーションは import せず開発 DB の往復と `alembic check` で確かめた(Phase 91〜94 と同じ)。

## 検証結果

- ユニット: 章ごとに、章のテストと関係する既存のテスト(CR・段階・束・合意)を流した。Phase の終わりに全体を流した(→ 下の「全体テスト」)。
- `ruff check`(app・tests): 通った。`pyright`(触ったファイル): 0 件。
- 開発 DB: alembic の head が1つ・リビジョン ID の衝突なしを確かめて `ee299cd210b8` へ upgrade。`382a5efa3508` への downgrade → upgrade の往復と `alembic check`(差なし)。
- `textbook/tools/samples_check.py --api-since stage11-15`: 不一致 0・本体のみ 0(一致 965 / 並び順のみ差 8 / 例外 5)。
- `textbook/tools/link_check.py`: リンク切れ 0 件。
- 全体テスト: ユニット 1740 件・統合 39 件がすべて通った(統合は専用のテスト DB)。
- E2E: 流していない(画面を変えていないため。Phase 99 で流す)。

## 未消化の申し送り(#37)

[Phase 95](../Phase-95/Phase-95-introduction.md#未消化の申し送り37) から引き継いだもの。

**ステージ12 の中で扱うもの**(行き先は [90-4](../Phase-90/Phase-90-4.md)):
- **確認事項の一覧の画面**(Phase 94 で API ができた)→ Phase 98。置き場と、SCR-005(プレビューの推測の要件の一覧・「採用にする」)・観点の表の画面・束・CR のページからのリンク。`present: false` の行(確認済み・却下)の見せ方、決める機会の選び方も 98 で決める。
- **影響が広がる変更の実 LLM での比較**(P89)→ Phase 99 の効果測定。保護で戻した件数(版の `protection`)、CR を反映した後の CR なしの再生成で CR の変更が残ること、確認事項の件数と採用率も測る。あわせて、CR の反映の後の要素の履歴に `changed`(CR-n)が並ぶことを確かめる。**段階の作り直しを伴う CR で、承認で結んだ印の数(`approve_stage` の `mark_count`)と、比較の「実際だけ」に出る数も測る**(この Phase で結ぶようにした漏れ)。
- **下書きの直しのたどる記録の画面**(Phase 95 で API ができた)→ Phase 98。`edited_fields` の見せ方(この Phase で「予測の起点」が増えた)。
- **起点を選ぶ欄と、作り直した段階の未承認の見せ方**(この Phase で API ができた)→ Phase 98。CR の作成・編集で `GET .../baselines/{number}/origins` から選ぶ。検証のタブで `pending_stages`(「段階N の承認が要る」)を出し、詳細設計画面の段階へのリンクを付ける。たどる記録の `approve_stage` の行。予測のタブの「届いた起点」(`origin_keys`)。
- **行の履歴と戻した件数の画面**(Phase 95 で履歴の API ができた)→ Phase 97。版の `protection` と要素の履歴を読む。合意の出どころ CR-n も 97 の画面に出す。
- **予測に無い要素を戻したことの見せ方**(Phase 93)→ Phase 97。
- **外部連携の言い換え**(Phase 91 の申し送りの残り)→ Phase 99 の実 LLM で起きるかを見る。
- **Phase 97〜99 の未確定事項**: [90-4](../Phase-90/Phase-90-4.md)「未確定事項」。

**ステージ12 の範囲の外**:
- **本番への反映と本番での確認**: ステージ15 の完了時に、[`OPERATIONS.md`](../../devex-api/OPERATIONS.md) 10.8節で行う。Phase 91 の2つのマイグレーション・Phase 92 の `956b403c67fe`・Phase 94 の `382a5efa3508`・この Phase の `ee299cd210b8` を、Phase 99 で 10.8節に足す。
- **巡回で消えた版の戻しは履歴に出ない**(Phase 95): 戻した記録を別に残すかは、Phase 97 の画面と Phase 99 の効果測定で、戻しがどれだけ起き、見えないことが困るかを見て決める(ステージ13 以降)。
- **起点に選べる要素の種類**(この Phase で生まれた): 要件・画面・API に限った。機能・作業単位などを起点にしたい場面があるかは、使われ方を見て決める(ステージ13 以降)。
- **推測の利用者のキーが名前であること**(Phase 94): 使われ方を見て決める(ステージ13 以降)。
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
- 束の写しの取り出し: `change_request_service.py` の説明書の組み立て(`_explanation`)に、`baseline_snapshots` と同じ内包表記が1か所残る。触るときに寄せる(#17。この Phase は消費者が無いので触らなかった)。

**ユーザーが決めるもの**:
- **開発環境の後始末**: 確認用の利用者・プロジェクト(開発 DB の束 12・CR 8 など)、DB の事故の後の複製。「トレンド追跡アプリ」は Phase 99 の効果測定の題材の候補なので残しておく(この Phase では触っていない)。
- **この Phase の未コミット**: 外側のリポジトリ(教材・docs・samples)と devex-api。コミットはユーザーが行う(#35)。

**この Phase で解決したもの**:
- **段階の承認で付く印の漏れ**(P86 の決定)→ [96-1](./Phase-96-1.md)。効果は Phase 99 で測る(上の申し送り)。
- **新しい要件を足す CR の予測の起点を人が選ぶ形**(P83)→ API は [96-2](./Phase-96-2.md)・[96-3](./Phase-96-3.md)。選ぶ欄は Phase 98(上の申し送り)。
- Phase 96 の未確定事項(承認の印を結んだ後の検証の条件・起点の持ち方と説明書での見せ方)→ 「着手時の相談で決めたこと」。

**この Phase で生まれたもの**:
- 上の「起点に選べる要素の種類」(ステージ13 以降)と、`baseline_snapshots` の持ち越し。
- **セッションの区切りの記録**: Phase 96 は1セッションで行った。流れは次のとおり。
  1. 計画モードで調査(エージェントは使わず直接読んだ)・質問1回(4問)・計画の承認
  2. 96-1〜96-3 の実装(マイグレーション1つ。開発 DB を upgrade)
  3. samples(`tagmerge.py`。複数の章が触る4ファイルは章ごとの中間の版を作って2回当てた)
  4. 全体テスト
  5. docs・教材

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

設問は Phase の要点の要約である(回答は求めない)。

1. Phase 86 で段階の承認の印を CR に結ばなかったのはなぜか。それでも漏れる「作り直しで新しく生まれた要素から先」の印とは何か。
2. 結ぶ承認を「作り直した後の最初の承認」に限り、それを列でなく CR の時系列の版と段階の承認した版で判定したのはなぜか。
3. 作り直した段階が未承認の間に検証を止めないと、何が起きるか。
4. 起点の画面・API は予測に入れ、起点の要件は入れないのはなぜか。起点の画面を予測に入れないと、Phase 93 の保護で何が起きるか。
5. 起点の表示名も CR に写して持つのはなぜか。束が凍結されていることはどう効くか。

## 次のフェーズ

**Phase 97**: 行の合意と履歴の画面。要件定義書・外部設計書のプレビューに合意の印・合意の出どころ(B-n / 採用にする / CR-n)、行の履歴(`GET .../agreements/history`)、再生成で戻した件数(版の `protection`)を出す。予測に無い要素を戻したことの見せ方も決める。着手時に、[90-4](../Phase-90/Phase-90-4.md) の Phase 97〜98 の未確定事項(画面の置き場。イメージを先に見せる)を決める。
