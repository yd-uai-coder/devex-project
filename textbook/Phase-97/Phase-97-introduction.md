# Phase 97 導入: 行の合意と履歴の画面(ステージ12)

## 目的

Phase 91〜95 で、合意の記録・保護で戻した要素(版の `protection`)・要素の履歴の API ができた。だが画面からは、どの行が合意済みか、出どころ(B-n / 採用にする / CR-n)、再生成で合意の形に戻した件数、行の履歴が見えなかった。この Phase で、ドキュメントプレビュー(SCR-005)に出す。[90-4](../Phase-90/Phase-90-4.md) の Phase 97 にあたる。

- 表示中の版の要素ごとの合意の状態(合意済み・合意と違う・未合意・今の版に無い)と、その版で戻した要素を返す API ── [97-1](./Phase-97-1.md)
- プレビューの md の上の「合意の状態」の枠。行ごとの印と出どころ、戻した要素(CR を反映した版は「CR の予測に無い変更を戻した」)、行の履歴 ── [97-2](./Phase-97-2.md)

確認事項の一覧の画面と、CR の画面の手直しは Phase 98。

## パイプライン上の位置づけ・前提

```
SCR-005 要件定義書・外部設計書のタブ(詳細設計モード)
   │ 表示中の版の id・中身が変わったら
   ▼ GET /projects/{id}/agreements/status?doc_type= ──[97-1]
AgreementService.status ── get_current(表示中の版)+ current(今の合意)
   │   element_states: agreement_items × 今の合意 → agreed / differs / unagreed / missing
   │   restored_elements: 版の protection に表示名。版の change_request_id → CR の番号
   ▼
AgreementStatusPanel ──[97-2]── 件数・戻した要素(CR の版は予測に無い変更)・要素の一覧
   │ 行の「履歴」
   ▼ GET /projects/{id}/agreements/history?key=(Phase 95)
ElementHistoryView ── 合意の記録・戻した版・関わる CR
```

- **前提として読むもの**: [90-1](../Phase-90/Phase-90-1.md)(決定2・5・7)・[90-4](../Phase-90/Phase-90-4.md)(Phase 97〜98 の未確定事項)・[91-1](../Phase-91/Phase-91-1.md)(要素のキーと `body_of`)・[92-1](../Phase-92/Phase-92-1.md)・[93-1](../Phase-93/Phase-93-1.md)(保護と `protection`、CR で書き換えてよい要素)・[95-1](../Phase-95/Phase-95-1.md)(履歴)・[88-1](../Phase-88/Phase-88-1.md)(束の画面。feature の形)。
- **今の仕組み**:
  - プレビューは md をそのまま描き、上に要約の枠(要件の出どころの件数と「採用にする」・外部設計書の件数と指摘)を置く。行ごとの情報は持たない。
  - 文書の応答は、版の `protection`(キーと理由)を持つ。CR の番号は版の履歴の応答だけが持つ。
  - 今の合意の一覧(`GET /agreements`)は合意済みの要素だけを返し、表示中の版と比べる手段は無かった。
- **この Phase を始めた時点の状態**: Phase 91〜96 はコミット済み。devex-api は `stage11-15` ブランチの `6ef8533`、devex-ui は `main` の `a80821e`(ステージ11 の後は変えていない)。alembic の head は `ee299cd210b8`。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(本体 + samples)。

E2E: この Phase では流さない。画面を足したが、ステージ12 の E2E は Phase 99 で既存の分も含めて全部流す(#36)。合意の状態の枠は詳細設計モードの2文書のタブにだけ出るので、既存の E2E の流れ(簡易モードのプレビュー・CR の流れ)の操作は変わらない。開発環境での画面確認も Phase 99 にまとめる(#37 の運用注記)。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 97 開始時」を参照。計画モードで1回(4問)聞いた。置き場は、Phase 88 と同じく画面のイメージを並べて聞いた。

| # | 問い | 決定 |
|---|---|---|
| 1 | 自動実装モード | on(推奨どおり) |
| 2 | 置き場(90-4 の未確定事項) | プレビューの md の上の「合意の状態」の枠。行を押すと履歴がその場で開く。md は変えない(推奨どおり。md の表の行に差し込む案・別のページの案と、画面のイメージで比べた) |
| 3 | 要素ごとの状態の求め方 | devex-api に状態の API を足し、表示中の版の要素と今の合意を純粋関数で突き合わせる(推奨どおり。画面だけで組む案は、未合意の行と「合意と違う」を出せない) |
| 4 | 予測に無い要素の戻しの見せ方(Phase 93 の申し送り) | CR を反映した版の戻しは「CR-n の予測に無い変更を戻した」と言い分け、CR へのリンクを付ける(推奨どおり) |

Claude の判断(計画の承認で確定、または作業中):

- 状態は4つ(合意済み・合意と違う・未合意・今の版に無い)。「今の版に無い」は文書の種類の範囲だけで、件数には1件以上のときだけ出す。
- 版の CR の番号は、状態の API が返す(文書の応答は版の履歴でしか CR の番号を持たないため)。戻した要素には表示名を付けて返す。
- 文書の種類 → 要素の種類の対応表は、サービスの既存の `_DOCUMENT_KINDS` を使い、純粋関数は種類を引数で受ける。
- 取り直しは、表示中の版の id と中身が変わったとき(「採用にする」は版を増やさず中身を書き換えるため)。
- **作業中**: 行の「履歴」を、合意の記録のある行だけでなく未合意の行にも出した。CR で足した新しい要件は、合意の記録が無くても関わる CR を持つためである([97-2](./Phase-97-2.md))。
- テンプレートから取り込むものは無い。マイグレーションは無い。

推奨と違った選択は0件。計画の差し戻しは無し。#39 の材料。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-97-1.md`](./Phase-97-1.md) | 表示中の版の合意の状態の API | あり(本体 5 + テスト 2) | Phase 91(要素・`body_of`)・92・93(`protection`) |
| [`Phase-97-2.md`](./Phase-97-2.md) | プレビューの「合意の状態」の枠 | あり(本体 6 + テスト 4。devex-ui) | 97-1・Phase 95(履歴の API) |

## サンプルコード一覧

- 97-1(`textbook/samples/backend/`): `app/agreements/status.py`(新規)・`__init__.py`・`app/services/agreement_service.py`・`app/schemas/agreement.py`・`app/api/routes/agreements.py`・`tests/unit/test_agreement_status.py`(新規)・`test_agreement_status_service.py`(新規)
- 97-2(`textbook/samples/frontend/`): `src/features/agreements/` の `api/types.ts`・`api/agreementsApi.ts`・`agreementOps.ts`・`components/ElementHistoryView.tsx`・`components/AgreementStatusPanel.tsx`・`test-utils/agreementFixtures.ts`・テスト3本(すべて新規)、`src/features/documents/components/DocumentMarkdownView.tsx` とそのテスト(更新)
- ミラーしないもの(#21 の共通): 無し(インフラ・設定ファイルは変えていない)。
- `DocumentMarkdownView.tsx` は `tagmerge.py` を当てた後、JSX の中の追記のタグを `{/* … */}` にし、import 区間の直前へ移った過去のタグに対象の名前を補った(道具の「要手当て」の範囲)。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 作成・更新するファイル | 責務(1行) | テスト観点 |
|---|---|---|---|
| 97-1 | `status.py`・`__init__.py` | 表示中の版の要素と今の合意を突き合わせ、戻した要素に表示名を付ける | 4つの状態・並び・種類の範囲・既定値の欠け・利用者と API のキー・飛ばす行 |
| 97-1 | `agreement_service.py`・`schemas/agreement.py`・`routes/agreements.py` | 表示中の版と今の合意を読み、CR の番号と一緒に返す | 束の直後・CR の版(出どころ CR-1 と戻した要素)・古い版の表示・外部設計書・束の前・文書なし・簡易 409 |
| 97-2 | `api/types.ts`・`api/agreementsApi.ts` | 状態と履歴を読む | URL・キーの符号化 |
| 97-2 | `agreementOps.ts` | 件数・印・戻しの見出し・履歴の行の文 | CR の版の言い分け・出どころつきの印 |
| 97-2 | `AgreementStatusPanel.tsx`・`ElementHistoryView.tsx`・`DocumentMarkdownView.tsx` | 枠を出し、行の履歴をその場で開く。詳細設計モードの2文書だけ | 件数と印・CR へのリンク・履歴の開閉・空・失敗・読み直し・出し分け |

## 写経順序(#23)

章番号順。各章の「作成・更新したファイル」表は依存順に並べた(#30)。97-2 は 97-1 の API を読むが、devex-ui は devex-api のコードを import しないので、写経の順は章の中で閉じる。

実 import 監査(#15)として、各ファイルの全 import 文を読んだ。import 先のモジュールとシンボルの誕生章が、そのファイルの章以下であることを確かめた。

- `status.py`(97-1)→ 既存の `app.agreements.items` の `AgreedItem`・`AgreedKind`・`body_of`(Phase 91)、`app.agreements.protection` の `RESTORE_REASONS`・`RestoreReason`(Phase 92)。`__init__.py`(97-1)→ `status` の9つ(97-1)。
- `agreement_service.py`(97-1)→ 追加は `CurrentAgreement`・`DocumentAgreementStatus`・`element_states`・`restored_elements`(97-1。パッケージから)。ほかは既存。
- `schemas/agreement.py`(97-1)→ 追加は `ELEMENT_STATE_LABEL`・`DocumentAgreementStatus`・`ElementState`(97-1)と既存の `RESTORE_REASON_LABEL`(Phase 95)、`typing.Literal`。`routes/agreements.py`(97-1)→ `AgreementDocType`・`AgreementStatusRead`・`agreement_status_read`(97-1)。
- `agreementsApi.ts`(97-2)→ 既存の `apiFetch`、`types.ts`(97-2)。`agreementOps.ts`(97-2)→ `types.ts`(97-2)。`ElementHistoryView.tsx`(97-2)→ `agreementsApi`・`types`・`agreementOps`(97-2)、既存の `changeRequestHref`(Phase 87)。`AgreementStatusPanel.tsx`(97-2)→ 同じものと `ElementHistoryView`(97-2)。`DocumentMarkdownView.tsx`(97-2)→ `AgreementStatusPanel`(97-2)、既存の `useDocumentsStore`。
- テスト: `test_agreement_status.py`(97-1)→ 97-1 と既存の `agreement_items`・`USERS_KEY`・文書の model。`test_agreement_status_service.py`(97-1)→ 97-1 と既存の fixture・リポジトリ・エラー。devex-ui のテスト(97-2)→ 97-2 と既存の `stubFetch`・`useDocumentsStore`・tamagui の設定。

各章のテストは、その章で作成・更新した全ファイルを少なくとも1度 import する(#15)。97-1 の `__init__.py` はテストがパッケージから import し、サービス・スキーマ・ルートは `get_agreement_status` を素で呼ぶ経路で通る。97-2 の `types.ts` は fixture が、`agreementsApi.ts`・`agreementOps.ts`・2つの部品・`DocumentMarkdownView.tsx` はそれぞれのテストが import する。

## 検証結果

- ユニット: 章ごとに、章のテストと関係する既存のテスト(合意・履歴、devex-ui の `documents`・`agreements`)を流した。Phase の終わりに全体を流した(→ 下の「全体テスト」)。
- devex-api: `ruff check`(app・tests): 通った。`pyright`(触ったファイル): 0 件。
- devex-ui: `tsc --noEmit` 通った。`eslint src`: エラー 0(警告1件は既存の `streamChat.test.ts`。持ち越し)。
- 開発 DB(読み取りだけ): 「トレンド追跡アプリ」で状態のサービスを呼び、応答の形を確かめた。要件定義書 v9 は合意済み 11・合意と違う 2(FR-001・利用者と使う場面)、外部設計書 v9 は合意済み 3・合意と違う 2(外部連携2件)、戻した要素 0。v9 は保護を入れる前(Phase 90 の計測)の版なので、B-3 の合意からの揺れがそのまま「合意と違う」に出た(→ 申し送り)。
- `textbook/tools/samples_check.py --api-since stage11-15 --ui-since HEAD`: 不一致 0・本体のみ 0(一致 977 / 並び順のみ差 8 / 例外 5)。
- `textbook/tools/link_check.py`: リンク切れ 0 件。
- 全体テスト: devex-api はユニット 1752 件・統合 39 件(専用のテスト DB)がすべて通った。devex-ui はユニット 1189 件のうち、並列の実行で4件がタイムアウトした(マイページ・パスワード・手順・取り込みのフォーム。この Phase で触っていないファイル。持ち越しの「並列のテストのタイムアウト」)。4件のファイルだけを流し直すと 24 件すべて通った。
- E2E: 流していない(Phase 99 で全部流す)。

## 未消化の申し送り(#37)

[Phase 96](../Phase-96/Phase-96-introduction.md#未消化の申し送り37) から引き継いだもの。

**ステージ12 の中で扱うもの**(行き先は [90-4](../Phase-90/Phase-90-4.md)):
- **確認事項の一覧の画面**(Phase 94 で API ができた)→ Phase 98。置き場と、SCR-005(プレビューの推測の要件の一覧・「採用にする」)・観点の表の画面・束・CR のページからのリンク。`present: false` の行(確認済み・却下)の見せ方、決める機会の選び方も 98 で決める。この Phase の「合意の状態」の枠との並べ方(要件定義書のタブに2つの枠が並ぶ)も 98 で見る。
- **影響が広がる変更の実 LLM での比較**(P89)→ Phase 99 の効果測定。保護で戻した件数(版の `protection`)、CR を反映した後の CR なしの再生成で CR の変更が残ること、確認事項の件数と採用率も測る。あわせて、CR の反映の後の要素の履歴に `changed`(CR-n)が並ぶことを確かめる。段階の作り直しを伴う CR で、承認で結んだ印の数(`approve_stage` の `mark_count`)と、比較の「実際だけ」に出る数も測る。**この Phase の「合意の状態」で、CR なしの再生成の後に「合意と違う」が0件であることも数える**(開発 DB の v9 は保護の前の版なので4件出た。保護の後の版で0件になるはず)。
- **下書きの直しのたどる記録の画面**(Phase 95 で API ができた)→ Phase 98。`edited_fields` の見せ方。
- **起点を選ぶ欄と、作り直した段階の未承認の見せ方**(Phase 96 で API ができた)→ Phase 98。CR の作成・編集で `GET .../baselines/{number}/origins` から選ぶ。検証のタブで `pending_stages` を出し、詳細設計画面の段階へのリンクを付ける。たどる記録の `approve_stage` の行。予測のタブの「届いた起点」(`origin_keys`)。
- **外部連携の言い換え**(Phase 91 の申し送りの残り)→ Phase 99 の実 LLM で起きるかを見る(開発 DB の v9 では外部連携2件が「合意と違う」だった)。
- **画面確認で決める項目**(この Phase で生まれた)→ Phase 99 の開発環境での画面確認。「合意の状態」の枠の長さ(要素が多いと md が下へ押される。閉じる・件数だけ出す、などが要るか)、印の色、履歴の行の言い方。
- **Phase 98〜99 の未確定事項**: [90-4](../Phase-90/Phase-90-4.md)「未確定事項」。

**ステージ12 の範囲の外**:
- **本番への反映と本番での確認**: ステージ15 の完了時に、[`OPERATIONS.md`](../../devex-api/OPERATIONS.md) 10.8節で行う。Phase 91 の2つのマイグレーション・Phase 92 の `956b403c67fe`・Phase 94 の `382a5efa3508`・Phase 96 の `ee299cd210b8` を、Phase 99 で 10.8節に足す(この Phase はマイグレーションなし)。
- **巡回で消えた版の戻しは履歴に出ない**(Phase 95): 戻した記録を別に残すかは、この Phase の画面と Phase 99 の効果測定で、戻しがどれだけ起き、見えないことが困るかを見て決める(ステージ13 以降)。
- **起点に選べる要素の種類**(Phase 96): 要件・画面・API に限った。機能・作業単位などを起点にしたい場面があるかは、使われ方を見て決める(ステージ13 以降)。
- **推測の利用者のキーが名前であること**(Phase 94): 使われ方を見て決める(ステージ13 以降)。
- **要約の生成の回数の上限**・**束の一覧の入れた CR**: 使われ方を見て決める(ステージ13 以降)。
- 規模の集計と選択肢つきの説明(ステージ13)。
- 振り返り 6節の残り5件・生成の質の候補4件(Phase 90 と同じ)。

**持ち越し**(触るときに直す。中身は [振り返り](../retrospectives/project-retrospective.md) 8節):
- `test_chat_service.py` などの pyright の指摘(Phase 40)
- devex-ui の並列のテストのタイムアウト(Phase 44。この Phase の全体テストでも4件出た)
- 偽 LLM の外部設計書の GET に DF が無い(Phase 45)
- `DfdEditorTabs` のテストのまれな失敗(Phase 77)
- Google の公開鍵を毎回取りに行く(Phase 74)
- `ListCard` の入れ物(Phase 79。テンプレートでは直した)
- 英語のままの refresh の失敗の文(Phase 79)
- `streamChat.test.ts` の lint の警告(使っていない変数。既存)
- `appendix/measurements/stage11/measure.py` の `ruff check` の指摘(行の長さ1件。Phase 80 から)
- 反映の後の CR の流れの部品: `tests/fixtures/change_requests.py`。85-2〜85-4 のテストの中の同じ手順は、触るときに寄せる(#17)。
- 束の写しの取り出し: `change_request_service.py` の説明書の組み立て(`_explanation`)に、`baseline_snapshots` と同じ内包表記が1か所残る。触るときに寄せる(#17)。

**ユーザーが決めるもの**:
- **開発環境の後始末**: 確認用の利用者・プロジェクト(開発 DB の束 12・CR 8 など)、DB の事故の後の複製。「トレンド追跡アプリ」は Phase 99 の効果測定の題材の候補なので残しておく(この Phase では読むだけで、変えていない)。
- **この Phase の未コミット**: 外側のリポジトリ(教材・docs・samples)・devex-api・devex-ui。コミットはユーザーが行う(#35)。

**この Phase で解決したもの**:
- **行の履歴と戻した件数の画面**(Phase 95 の申し送り)→ [97-1](./Phase-97-1.md)・[97-2](./Phase-97-2.md)。合意の出どころ CR-n も印に出る。
- **予測に無い要素を戻したことの見せ方**(Phase 93 の申し送り)→ [97-2](./Phase-97-2.md)(CR の版の戻しを言い分ける)。
- Phase 97 の未確定事項(画面の置き場)→ 「着手時の相談で決めたこと」。

**この Phase で生まれたもの**:
- 上の「画面確認で決める項目」(Phase 99)と、効果測定に足した「合意と違う」の数。
- **セッションの区切りの記録**: Phase 97 は1セッションで行った。流れは次のとおり。
  1. 計画モードで調査(エージェントは使わず直接読んだ)・質問1回(4問。置き場は画面のイメージつき)・計画の承認
  2. 97-1 の実装(devex-api)
  3. 97-2 の実装(devex-ui)
  4. 全体テスト(devex-api のユニット・統合、devex-ui のユニット)と、開発 DB での応答の形の確かめ(読み取りだけ)
  5. samples(`tagmerge.py`。JSX の中のタグは手で直した)
  6. docs・教材

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

設問は Phase の要点の要約である(回答は求めない)。

1. 表示中の版の要素ごとの状態を、画面で今の合意の一覧と並べるのでなく、devex-api の純粋関数で決めたのはなぜか。画面で並べると何が出せないか。
2. 「合意と違う」は、保護がある今、どんなときに出るか。ふつうの再生成の版で出たら、何を疑うか。
3. CR を反映した版で戻した要素が「CR の予測に無い変更」と言えるのはなぜか(Phase 93 の書き換えてよい範囲から)。
4. 「採用にする」の後に枠を読み直す鍵に、版の id だけでなく中身を使ったのはなぜか。
5. md の表の行に印を差し込まず、md の上の枠にしたのはなぜか。

## 次のフェーズ

**Phase 98**: 確認事項の一覧の画面と、CR の画面の手直し。確認事項の一覧のページ(決める機会・状態の編集・採用率)と、SCR-005・束・CR のページからのリンク。CR の作成・編集で予測の起点を選ぶ欄、検証のタブの未承認の段階、下書きの直しのたどる記録。着手時に、[90-4](../Phase-90/Phase-90-4.md) の Phase 97〜98 の未確定事項(確認事項の一覧の置き場。イメージを先に見せる)を決める。
