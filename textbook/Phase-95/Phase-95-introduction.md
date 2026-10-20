# Phase 95 導入: 行の履歴 API と、CR の下書きの直しの時系列(ステージ12)

## 目的

ステージ12(合意の精度)の決定7は「合意の記録を追記型にし、行の変更の履歴にする」([90-1](../Phase-90/Phase-90-1.md))。Phase 91 で記録は追記型になったが、要素ごとに引く口が無かった。この Phase で、要素1つの履歴を返す API を作る。[90-4](../Phase-90/Phase-90-4.md) の Phase 95 にあたる。

- 合意の記録・合意の形へ戻した版・関わる CR から、要素1つの履歴を決定的に組み立てる(LLM なし)── [95-1](./Phase-95-1.md)
- 履歴の API(`GET /projects/{id}/agreements/history?key=`)── [95-2](./Phase-95-2.md)
- CR の下書きのままの直しも、直した項目の名前でたどる記録に残す(P89 の申し送り)── [95-3](./Phase-95-3.md)

画面は Phase 97(行の履歴)・98(下書きの直しのたどる記録)で作る。

## パイプライン上の位置づけ・前提

```
GET /projects/{id}/agreements/history?key=req:FR-001
   │ AgreementService.history(詳細設計モードだけ・合意の対象のキーだけ)──[95-2]
   │   AgreementRepository.list_for_key ........ 合意の記録(表⑳。消えない)
   │   GeneratedDocumentRepository.list_protected 合意を守った版(版の protection。巡回で消えうる)
   │   ChangeRequestRepository.list_for_project . CR(対象の要件・保存した予測)
   ▼
element_history ──[95-1]── 記録を agreed / changed / reaffirmed / removed に分け、
   │                         戻した版(restored)を日時の順に挟み、関わる CR を拾う
   ▼
AgreementHistoryRead(key・kind・label・current・entries・change_requests)

PATCH /projects/{id}/change-requests/{n} ──[95-3]── 値の変わった項目があれば、下書きのままでも
   時系列(⑰)に edit の行(refs.fields)→ たどる記録の edited_fields
```

- **前提として読むもの**: [90-1](../Phase-90/Phase-90-1.md)(決定7)・[90-4](../Phase-90/Phase-90-4.md)(Phase 95 の未確定事項)・[91-1](../Phase-91/Phase-91-1.md)(合意のキー・記録の形)・[92-1](../Phase-92/Phase-92-1.md)(版の `protection`)・[93-1](../Phase-93/Phase-93-1.md)(`rewritable_keys`)。
- **今の仕組み**:
  - 合意の記録はキー・中身(NULL は外れた)・出どころ(束・採用にする・CR)・日時を持つ追記型の表で、`current` がキーごとの最新を畳む。
  - 再生成で合意の形へ戻した要素は、その版の `protection`(`[{key, reason}]`)に残る。版は巡回(直近3件。CR の反映と束が指す版は残る)で消える。
  - CR の時系列は、作成・状態の遷移・反映などで1行ずつ足す。中身の直しは、説明済みから下書きに戻るときだけ行になっていた。
- **この Phase を始めた時点の状態**: Phase 91〜94 は未コミット(外側のリポジトリ・devex-api)。devex-api は `stage11-15` ブランチの `819016c` + Phase 91〜94 の作業ツリー、devex-ui は `main` の `a80821e`。alembic の head は `382a5efa3508`。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(本体 + samples)。

E2E: この Phase では流さない。画面を変えないためである。CR の流れの E2E(`change-request-flow.spec.ts`)は、たどる記録に「直した」の行が増えても通る書き方(状態の名前が含まれるか)であることを読んで確かめた。ステージ12 の E2E は、Phase 99 で既存の分も含めて全部流す。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 95 開始時」を参照。計画モードで1回(4問)聞いた。

| # | 問い | 決定 |
|---|---|---|
| 1 | 自動実装モード | on(推奨どおり) |
| 2 | 履歴の応答の単位 | 要素ごと(推奨どおり) |
| 3 | 保護で戻したことの残し方 | 版の `protection` を読む。巡回で消えた版の分は出ない(推奨どおり) |
| 4 | CR の下書きの直しの残し方 | 直した項目の名前を1行に(推奨どおり) |

Claude の判断(計画の承認で確定):

- **記録の分け方**: 最初の合意(と外れた後の合意)`agreed`・中身が変わった `changed`・同じ中身で合意し直した `reaffirmed`(束を作り直すと変わっていない要素にも記録が足される)・外れた `removed`。中身は `body_of` で比べる。
- **関わる CR は状態を問わず出す**(却下・取り下げも、その要素の変更が議論された記録)。要件は対象、画面・API は保存した予測で拾う。
- **共有**(#17): 保存した予測の文書の側のキーを `predicted_document_keys` に出し、`rewritable_keys` と履歴で共有した。
- **キーはクエリで受ける**(空白・`/` を含むため)。合意の対象でないキーは 422 `AGREEMENT_KEY_INVALID`。記録も CR も無いキーは空の履歴。簡易ドキュメントモードは 409。
- テンプレートから取り込むものは無い。devex-ui は変えない。マイグレーションは無い。

推奨と違った選択は0件。計画の差し戻しは無し。#39 の材料。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-95-1.md`](./Phase-95-1.md) | 要素1つの履歴を組み立てる純粋関数 | あり(本体 4 + テスト 1) | Phase 91(記録・`body_of`)・92/93(`protection`・`rewritable_keys`) |
| [`Phase-95-2.md`](./Phase-95-2.md) | 履歴の API | あり(本体 6 + テスト 2) | 95-1 |
| [`Phase-95-3.md`](./Phase-95-3.md) | CR の下書きの直しを時系列に残す | あり(本体 4 + テスト 4) | Phase 86(たどる記録)。95-1・95-2 とは独立 |

## サンプルコード一覧

`textbook/samples/backend/` の新規・更新:

- 95-1: `app/change_requests/prediction.py`・`app/change_requests/__init__.py`・`app/agreements/history.py`(新規)・`app/agreements/__init__.py`・`tests/unit/test_agreement_history.py`(新規)
- 95-2: `app/repositories/agreement.py`・`app/repositories/generated_document.py`・`app/services/errors.py`・`app/services/agreement_service.py`・`app/schemas/agreement.py`・`app/api/routes/agreements.py`・`tests/unit/test_agreement_history_service.py`(新規)・`tests/integration/test_agreements_flow.py`
- 95-3: `app/change_requests/trace.py`・`app/change_requests/__init__.py`・`app/services/change_request_service.py`・`app/schemas/change_request.py`・`tests/unit/test_change_request_trace.py`・`tests/unit/test_change_request_service.py`・`tests/unit/test_change_requests_api.py`・`tests/integration/test_change_requests_flow.py`
- ミラーしないもの(#21 の共通): 無し(インフラ・設定ファイルは変えていない)。
- あわせて直したもの: `app/services/errors.py` の samples で、Phase 94 のときに `Phase-52-2:追記`(`ReviewNotAllowedError`)と `Phase-94-3:追記`(`ConfirmationItemNotFoundError`)のタグが別のクラスの前に重なっていたので、それぞれのクラスの前に戻した。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 作成・更新するファイル | 責務(1行) | テスト観点 |
|---|---|---|---|
| 95-1 | `prediction.py`・`change_requests/__init__.py` | 保存した予測の文書の側のキーを出し、書き換えてよい要素と共有する | `rewritable_keys` の結果が変わらない・予測なしは空 |
| 95-1 | `agreements/history.py`・`agreements/__init__.py` | 記録・戻した版・CR から要素1つの履歴を組み立てる | 4つの分け方・既定値の欠け・戻しの挟み方・CR の拾い方・不正なキー |
| 95-2 | `repositories/agreement.py`・`generated_document.py` | 要素1つの記録、合意を守った版を読む | 記録の順・`protection` が一覧の版だけ |
| 95-2 | `errors.py`・`agreement_service.py`・`schemas/agreement.py`・`routes/agreements.py` | 履歴の API(422・409) | CR の反映で変わった要件・戻した版・空の履歴・422・409 |
| 95-3 | `trace.py`・`change_requests/__init__.py`・`schemas/change_request.py` | 直したの行の項目の名前を読み解く | 項目の並び・知らない項目・形の悪い値・ほかの行は空 |
| 95-3 | `change_request_service.py` | 値の変わった項目があれば下書きのままでも直したの行を足す | 下書きで足す・同じ値は足さない・説明済みからの直しの項目 |

## 写経順序(#23)

章番号順。各章の「作成・更新したファイル」表は依存順に並べた(#30)。95-1 と 95-3 は `app/change_requests/__init__.py` を両方が更新する(95-1 は `predicted_document_keys`、95-3 は `EDITED_FIELD_LABEL`)。

実 import 監査(#15)として、各ファイルの全 import 文を読んだ。import 先のモジュールとシンボルの誕生章が、そのファイルの章以下であることを確かめた。

- `prediction.py`(95-1)→ import の変更なし。`change_requests/__init__.py`(95-1・95-3)→ `predicted_document_keys`(95-1)・`EDITED_FIELD_LABEL`(95-3。95-3 の担当分のタグ)。
- `agreements/history.py`(95-1)→ 既存の `AgreedKind`・`body_of`・`kind_of`・`RESTORE_REASONS`・`RestoreReason`・`STATUS_LABEL`・`TARGET_KIND_LABEL`・`Target`・`TargetKind`・`DOCUMENT_LABEL`。`agreements/__init__.py`(95-1)→ `history`(95-1)。
- `repositories/agreement.py`・`generated_document.py`(95-2)→ import の追加は `collections.abc.Sequence` だけ。
- `errors.py`(95-2)→ 既存の `UnprocessableEntityError`。`agreement_service.py`(95-2)→ `ChangeRequestRef`・`ElementHistory`・`RecordFacts`・`VersionFacts`・`element_history`(95-1)・`predicted_document_keys`(95-1)・`AgreementKeyInvalidError`(95-2)、既存の `kind_of`・`origin_label`・`ChangeRequestRepository`・`GeneratedDocumentRepository`。
- `schemas/agreement.py`(95-2)→ `ElementHistory`・`HistoryEvent`(95-1)、既存の `RestoreReason`・`TargetKind`。`routes/agreements.py`(95-2)→ `AgreementHistoryRead`・`agreement_history_read`(95-2)。
- `trace.py`(95-3)→ import の変更なし。`schemas/change_request.py`・`change_request_service.py`(95-3)→ import の変更なし。
- テスト: `test_agreement_history.py`(95-1)→ 95-1 と既存の `Target`・`rewritable_keys`。`test_agreement_history_service.py`(95-2)→ 95-2 と既存の fixture。`test_change_request_trace.py`(95-3)→ `EDITED_FIELD_LABEL`(95-3)と既存の `ChangeRequestUpdate`・`TraceEntryRead`。

各章のテストは、その章で作成・更新した全ファイルを少なくとも1度 import する(#15)。`__init__.py` はテストがパッケージから import する。95-2 のリポジトリ・エラー・スキーマはサービスとルートの経路で使う。95-3 の `change_request_service.py`・`schemas/change_request.py` はサービスとスキーマのテストが使う。

## 検証結果

- ユニット: 章ごとに、章のテストと関係する既存のテスト(合意の記録・保護・CR の予測・たどる記録・CR のサービスと API)を流した。Phase の終わりに全体を流した(→ 下の「全体テスト」)。
- `ruff check`(app・tests): 通った。`pyright`(触ったファイル): 0 件。
- 開発 DB: マイグレーションなし。「トレンド追跡アプリ」(読むだけ。書き込んでいない): 今の合意 18 要素の履歴は、どれも B-3 の合意1行。`req:FR-001` には CR-3(反映済み・内容の変更)が関わる CR として出た。CR-3 は Phase 93 より前に反映したので、合意は CR で更新されていない(この Phase の範囲の外。Phase 99 の効果測定で新しい CR を反映して確かめる)。
- `textbook/tools/samples_check.py --api-since stage11-15`: 不一致 0・本体のみ 0(一致 961 / 並び順のみ差 8 / 例外 5)。
- `textbook/tools/link_check.py`: リンク切れ 0 件。
- 全体テスト: ユニット 1719 件・統合 38 件がすべて通った(統合は専用のテスト DB)。
- E2E: 流していない(画面を変えていないため。Phase 99 で流す)。

## 未消化の申し送り(#37)

[Phase 94](../Phase-94/Phase-94-introduction.md#未消化の申し送り37) から引き継いだもの。

**ステージ12 の中で扱うもの**(行き先は [90-4](../Phase-90/Phase-90-4.md)):
- **確認事項の一覧の画面**(Phase 94 で API ができた)→ Phase 98。置き場と、SCR-005(プレビューの推測の要件の一覧・「採用にする」)・観点の表の画面・束・CR のページからのリンク。`present: false` の行(確認済み・却下)の見せ方、決める機会の選び方も 98 で決める。
- **影響が広がる変更の実 LLM での比較**(P89)→ Phase 99 の効果測定。保護で戻した件数(版の `protection`)、CR を反映した後の CR なしの再生成で CR の変更が残ること、確認事項の件数と採用率も測る。あわせて、CR の反映の後の要素の履歴に `changed`(CR-n)が並ぶことを確かめる。
- **下書きの直しのたどる記録の画面**(この Phase で API ができた)→ Phase 98。`edited_fields` の見せ方。
- **段階の承認で付く印の漏れ**(P86 の決定)→ Phase 96。
- **新しい要件を足す CR の予測の起点を人が選ぶ形**(P83)→ Phase 96・98。
- **行の履歴と戻した件数の画面**(この Phase で履歴の API ができた)→ Phase 97。版の `protection` と要素の履歴(`GET .../agreements/history`)を読む。合意の出どころ CR-n も 97 の画面に出す。
- **予測に無い要素を戻したことの見せ方**(Phase 93)→ Phase 97。
- **外部連携の言い換え**(Phase 91 の申し送りの残り)→ Phase 99 の実 LLM で起きるかを見る。
- **Phase 96〜99 の未確定事項**: [90-4](../Phase-90/Phase-90-4.md)「未確定事項」。

**ステージ12 の範囲の外**:
- **本番への反映と本番での確認**: ステージ15 の完了時に、[`OPERATIONS.md`](../../devex-api/OPERATIONS.md) 10.8節で行う。Phase 91 の2つのマイグレーション・Phase 92 の `956b403c67fe`・Phase 94 の `382a5efa3508` を、Phase 99 で 10.8節に足す(この Phase はマイグレーションなし)。
- **巡回で消えた版の戻しは履歴に出ない**(この Phase で生まれた。着手時の相談 (3) の決定): 戻した記録を別に残すかは、Phase 97 の画面と Phase 99 の効果測定で、戻しがどれだけ起き、見えないことが困るかを見て決める(ステージ13 以降)。
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

**ユーザーが決めるもの**:
- **開発環境の後始末**: 確認用の利用者・プロジェクト(開発 DB の束 12・CR 8 など)、DB の事故の後の複製。「トレンド追跡アプリ」は Phase 99 の効果測定の題材の候補なので残しておく(この Phase では履歴を読んだだけ)。
- **この Phase の未コミット**: 外側のリポジトリ(教材・docs・samples)と devex-api。Phase 91〜94 の分も未コミット。コミットはユーザーが行う(#35)。

**この Phase で解決したもの**:
- **下書きの中の直しは時系列に残さない**(P89)→ [95-3](./Phase-95-3.md)。画面は Phase 98(上の申し送り)。
- **戻した件数の履歴**(Phase 92 の申し送りの半分)→ [95-1](./Phase-95-1.md)・[95-2](./Phase-95-2.md)。画面は Phase 97。
- Phase 95 の未確定事項(履歴の応答の単位・下書きの直しの残し方)→ 「着手時の相談で決めたこと」。

**この Phase で生まれたもの**:
- 上の「巡回で消えた版の戻しは履歴に出ない」(ステージ13 以降)。
- **セッションの区切りの記録**: Phase 95 は1セッションで行った。流れは次のとおり。
  1. 計画モードで調査(エージェントは使わず直接読んだ)・質問1回(4問)・計画の承認
  2. 95-1〜95-3 の実装(マイグレーションなし)
  3. samples(`tagmerge.py`。Phase 94 の未コミットの2ファイルは、この Phase の追加を取り除いて旧の版を作り直して当てた)
  4. 全体テスト・開発 DB で読むだけの確かめ
  5. docs・教材

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

設問は Phase の要点の要約である(回答は求めない)。

1. 履歴を版の差分からでなく合意の記録から組み立てるのはなぜか(決定7)。版の `protection` から読む「戻した」の行が、残っている版の分だけでよいとしたのはなぜか。
2. 同じ中身の合意(`reaffirmed`)を「変わった」と分けるのはなぜか。中身を `body_of` で比べるのはなぜか。
3. 関わる CR を、要件は対象から、画面・API は保存した予測から拾うのはなぜか。`predicted_document_keys` を `rewritable_keys` と共有したのはなぜか(#17)。
4. 履歴のキーをパスでなくクエリで受けるのはなぜか。合意の対象でないキーと、まだ合意していないキーの扱いを分けた(422 と空の履歴)のはなぜか。
5. CR の下書きの直しで、前後の値でなく直した項目の名前だけを残し、値の変わらない保存を残さないのはなぜか。

## 次のフェーズ

**Phase 96**: 段階の承認の印と、新しい要件の予測の起点。CR を渡して作り直した段階の承認で付く印に `cr:N` を足す(決定8-2)。新しい要件を足す CR に、人が選ぶ起点(既存の要件・画面・API)を持たせ、起点から予測する(決定8-3)。着手時に、[90-4](../Phase-90/Phase-90-4.md) の Phase 96 の未確定事項を決める(承認の印を結んだ後の検証の条件・起点の持ち方と説明書での見せ方)。
