# Phase 86 導入: 再検証とたどれる記録(ステージ11)

## 目的

ステージ11(合意と変更の一巡)の6つ目の実装 Phase。[80-4](../Phase-80/Phase-80-4.md) の Phase 86 として、反映した CR([Phase 85](../Phase-85/Phase-85-introduction.md))を「検証済み」にする条件と API、任意の設計レビューを CR に結ぶこと、検証済みの CR を新しい合意済みの版(束)に結ぶこと、受付から検証・束までをたどる記録の API を作る([外部設計書](../../docs/external_design.md) 2.14節「検証」、[内部設計書](../../docs/internal_design.md) 3.3節 11項)。これで、CR の受付から検証までの API が一巡する(画面は Phase 87・88)。

- 印の今の状態と検証の条件 ── [86-1](./Phase-86-1.md)
- 文書の側の確認と検証の API ── [86-2](./Phase-86-2.md)
- レビューを結ぶ ── [86-3](./Phase-86-3.md)
- 束に結ぶ・たどる記録の API ── [86-4](./Phase-86-4.md)

## パイプライン上の位置づけ・前提

```
CR-1(反映済み。applied_impact に反映で付いた印の写し ← Phase 85)
   │
   ├ GET .../change-requests/1/verification                                         ──[86-2]
   │   mark_states(写し, 今の段階の印, 1)→ 未確認 / 確認済み / 承認で済んだ   ← 86-1
   │   document_items(保存した予測の画面・API, document_checks)                ← 86-1
   ├ POST /design-stages/{stage}/impact/review(既存)… 段階の印を確かめる
   ├ PUT .../document-checks {keys}  … 文書の側を確かめる                          ──[86-2]
   ├ GET .../review-candidates → POST .../reviews {review_run_id}(任意)             ──[86-3]
   │   時系列 link_review {review_run_id, gate, model}
   ▼ POST .../verify  … 未確認が0件のときだけ applied → verified                     ──[86-2]
   │   時系列 verify {mark_count, document_count, review_run_ids}
   ▼ POST /baselines {..., change_request_numbers: [1]} → B-2 に結ぶ                   ──[86-4]
   │   時系列 baseline {baseline_number}
   ▼ GET .../change-requests/1/trace … 行ごとに版(残っているか)・段階・レビュー・束  ──[86-4]
```

- **前提として読むもの**: [85-2](../Phase-85/Phase-85-2.md)(`applied_impact`・印の出どころ `cr:<番号>`)・[85-4](../Phase-85/Phase-85-4.md)(比較)・[83-3](../Phase-83/Phase-83-3.md)(予測の保存)。印の確認と承認は [`app/detailed_design/impact/marks.py`](../samples/backend/app/detailed_design/impact/marks.py)(`record`・`set_reviewed`・`blocking_marks`。Phase 43)と `DesignStageService.approve`・`review_marks`。レビューの回は `app/models/review.py`(Phase 52)。
- **今の仕組み**: 段階の印は、段階の画面で確かめ(`reviewed`)、段階を承認すると消える。承認は、他の段階・文書から届いた未確認の印があると止まる。印の付かない文書の側(画面・API)は、比較で「予測だけ(文書の側)」と分けて示すだけだった。
- **この Phase を始めた時点の状態**: devex-api の HEAD は `c59480f`(Phase 85)、外側のリポジトリは `4ca03b7`。alembic の head は `f9c9614d5329`。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(本体 + samples)。

E2E: この Phase では流さない(画面を変えないため。ステージ11 の E2E は Phase 89 で既存を含めて全部流す)。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 86 開始時」を参照。計画モードで1回(4問)聞いた。

| # | 問い | 決定 |
|---|---|---|
| 1 | 自動実装モード | on(推奨どおり) |
| 2 | 印の付かない文書の側の要素(画面・API)の扱い | CR の確認の項目にする。保存した予測の画面・API を人が確認済みにし、検証は印とこの項目の両方が済んだとき。印の仕組みは変えない(推奨どおり) |
| 3 | 段階の承認で付く印を CR に結ぶか | 結ばない。漏れは Phase 89 の効果測定で確かめる(推奨どおり) |
| 4 | レビューの結び方・検証済みの後の束 | 人が選んで結ぶ。束の作成に検証済みの CR を渡すと結び、時系列に1行。合意の記録は API では写さない(推奨どおり) |

Claude の判断(計画の承認で確定、または作業中):

- 印の今の確認の状態は「未確認 / 確認済み / 承認で済んだ」の3つ(段階の承認で印が消えるため。承認は他から届いた未確認の印があると止まる)。比較の確認の状態も今の状態にした(Phase 85 の申し送り「比較の確認の状態」)。
- 文書の側の確認の列は、確認済みにしたキーの一覧(`document_checks`)。項目は保存した予測から読むので初期化は要らない。確認できるのは反映済みの間だけで、時系列には残さない(結果は検証の行に残る)。
- 結んだレビューは別の表(`change_request_reviews`)。結べるのは反映の後に始めて成功した回だけ。外す操作は作らない。
- 束に入れた CR は列 `included_baseline_id`(1つの CR は1つの束にだけ)。`BaselineService` は CR をリポジトリで読む(サービスを import すると循環するため)。
- たどる記録は別の API(`GET .../trace`)。純粋関数が `refs` を読み解き、文書の版が今も残っているかを示す。
- 遷移の表に、記録だけの操作 `link_review`・`baseline` と、`CHECKABLE_STATUSES`・`INCLUDABLE_STATUSES` を足した。
- マイグレーションは1本(`483d9e531ba0`)。テンプレートから取り込むものは無し。
- **作業中**: 検証の行の `refs` の件数の項目を `mark_count`・`document_count` にした(反映の行の `documents`(版の一覧)と名前がぶつかり、たどる記録で読み違えたため)。
- **作業中**: 束に CR を結ぶときは、外部キーの列でなく ORM の関係(`included_baseline`)を入れる(読み込み済みの関係が更新されず、応答の束の番号が空になったため)。
- **作業中**: 反映の後の CR を作るテスト用の部品 `tests/fixtures/change_requests.py` を足した(この Phase の3つのテストが使う。#17)。
- **作業中**: 新しい POST のルート(検証・レビューを結ぶ)は、ルートのファイルの末尾に置いた(既存の写しのルートの前に挟むと、samples のタグの引き継ぎが崩れるため)。

推奨と違った選択は0件。計画の差し戻しは無し。#39 の材料。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-86-1.md`](./Phase-86-1.md) | 印の今の状態と検証の条件 | あり(本体 4 + テスト 2) | 85-4(`AppliedMark`・`compare`)・83-2(`Prediction`)・Phase 43(`StageImpact`) |
| [`Phase-86-2.md`](./Phase-86-2.md) | 文書の側の確認と検証の API | あり(本体 7 + マイグレーション 1 + テスト 3) | 86-1(`verification_of`・`with_confirmations`・`CHECKABLE_STATUSES`) |
| [`Phase-86-3.md`](./Phase-86-3.md) | レビューを結ぶ | あり(本体 8 + テスト 3) | 86-2(`ChangeRequestReview`・テストの部品) |
| [`Phase-86-4.md`](./Phase-86-4.md) | 束に結ぶ・たどる記録の API | あり(本体 10 + テスト 4) | 86-2(`included_baseline_id`)・86-3(結んだレビュー)・86-1(`INCLUDABLE_STATUSES`) |

## サンプルコード一覧

`textbook/samples/backend/` の新規・更新:

- 86-1: `app/change_requests/verification.py`(新規)・`app/change_requests/states.py`・`app/change_requests/comparison.py`・`app/change_requests/__init__.py`・`tests/unit/test_change_request_verification.py`(新規)・`tests/unit/test_change_request_states.py`
- 86-2: `alembic/versions/483d9e531ba0_add_change_request_verification.py`(新規)・`app/models/change_request.py`・`app/models/__init__.py`・`app/services/errors.py`・`app/schemas/change_request.py`・`app/services/change_request_service.py`・`app/api/routes/change_requests.py`・`tests/fixtures/change_requests.py`(新規)・`tests/unit/test_change_request_verify.py`(新規)・`tests/unit/test_change_requests_api.py`
- 86-3: `app/change_requests/reviews.py`(新規)・`app/change_requests/__init__.py`・`app/services/errors.py`・`app/repositories/review.py`・`app/repositories/change_request.py`・`app/schemas/change_request.py`・`app/services/change_request_service.py`・`app/api/routes/change_requests.py`・`tests/unit/test_change_request_reviews.py`(新規)・`tests/unit/test_change_request_verify.py`・`tests/unit/test_change_requests_api.py`
- 86-4: `app/change_requests/trace.py`(新規)・`app/change_requests/__init__.py`・`app/services/errors.py`・`app/repositories/change_request.py`・`app/schemas/baseline.py`・`app/services/baseline_service.py`・`app/api/routes/baselines.py`・`app/schemas/change_request.py`・`app/services/change_request_service.py`・`app/api/routes/change_requests.py`・`tests/fixtures/change_requests.py`・`tests/unit/test_change_request_trace.py`(新規)・`tests/unit/test_change_requests_api.py`・`tests/integration/test_change_requests_flow.py`
- ミラーしないもの(#21 の共通): 無し(インフラ・設定ファイルは変えていない)。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| [86-1](./Phase-86-1.md) | `verification.py`・`states.py`・`comparison.py` | 反映で付いた印の今の確認の状態と、文書の側の確認の項目から、検証できるかを決める | 3つの状態・ほかの CR の印・知らないキー・検証の条件・比較の確認の状態 |
| [86-2](./Phase-86-2.md) | マイグレーション・`ChangeRequestService`・ルート | 検証の確かめ・文書の側の確認・検証済みへの遷移の API | 未確認で 409・確かめて検証・承認で済んだ印・やり直し・反映の前 |
| [86-3](./Phase-86-3.md) | `reviews.py`・リポジトリ・サービス | 反映の後に成功した回を選んで CR に結ぶ | 結べる条件・候補・時系列・検証の行・409/404 |
| [86-4](./Phase-86-4.md) | `trace.py`・`BaselineService`・サービス | 検証済みの CR を束に結び、受付からの記録を指す先と一緒にたどる | 読み解き・束の 409/404・たどる記録の順・実際の PostgreSQL |

## 写経順序(#23)

章番号順(86-1 → 86-2 → 86-3 → 86-4)。各章の表の順(依存順。#30)に写す。

- 86-2 はマイグレーションを先に写し、`alembic upgrade head` を流してから API を動かす。86-3・86-4 で使う列と表(`change_request_reviews`・`included_baseline_id`)も 86-2 のマイグレーションとモデルで足す。
- 86-2 の検証の行の `refs` は `mark_count`・`document_count` だけを写す。`review_run_ids` は 86-3 で足す(samples のタグで分けてある)。
- 複数の章にまたがるファイル(`__init__.py`・`errors.py`・`schemas/change_request.py`・`change_request_service.py`・`routes/change_requests.py`・`repositories/change_request.py`・`tests/fixtures/change_requests.py`)は、samples のタグの章の分だけを写す。

実 import 監査(#15。全 import 文を読んで確かめた):

- 86-1: `verification.py` → `comparison.AppliedMark`(85-4)・`prediction.Prediction`(83-2)・`app.detailed_design.impact`(`DOCUMENT_STAGE`・`StageImpact`・`cr_source`。既存)。`__init__.py` → `states` の2つの表・`verification`(この章)。テスト → この章のものと `PredictedItem`・`PredictedTarget`・`Prediction`(83-2)・`Mark`・`StageImpact`(既存)。
- 86-2: モデル → 既存の `Base`・`PortableJSON`(`ReviewRun` は TYPE_CHECKING だけ)。スキーマ → `MARK_CONFIRMATION_LABEL`・`MarkConfirmation`・`Verification`(86-1)。サービス → `CHECKABLE_STATUSES`・`Verification`・`checked_documents`・`document_items`・`verification_of`・`with_confirmations`(86-1)・`StageImpact`(既存)・スキーマとエラー(この章)。ルート → スキーマ・`VerificationView`(この章)。部品 → 既存の fixture・サービス。テスト → この章のものと既存の `DesignStageService`・`User`。
- 86-3: `reviews.py` → `states.CHECKABLE_STATUSES`(86-1)。リポジトリ → `ChangeRequestReview`(86-2)・`ReviewRun`(既存)。サービス → `first_applied_at`・`review_link_problem`(この章)・`ReviewRun`・`ReviewRunRepository`(既存)・エラー(この章)。スキーマ → `ChangeRequestReview`・`ReviewRun`(TYPE_CHECKING だけ)。ルート → スキーマ(この章)。テスト → この章のものと 86-2 の部品・ルート。
- 86-4: `trace.py` → `explanation.DOCUMENT_LABEL`(84-2)。`baseline_service.py` → `INCLUDABLE_STATUSES`(86-1)・`ChangeRequest`・`ChangeRequestRepository`(Phase 82)・エラー(この章)。サービス → `EventFacts`・`ReviewFacts`・`TraceEntry`・`trace_entries`(この章)・`GeneratedDocumentRepository`(既存)。スキーマ → `TraceEntry`(この章)。部品の `confirm_everything` → `DocumentChecksUpdate`(86-2)・`DesignStageService`(既存)。テスト → この章のものと 86-2・86-3 のもの。

前方 import は無い。各章が作成・更新した本体のファイルは、その章のテストが import する(マイグレーションは往復の実行で確かめた)。

## 検証結果

- 章ごとの部分テスト: 86-1 は 32件(比較・遷移の表を含む)、86-2 は検証と比較・反映(18件)、86-3 は結ぶ・検証・CR のルート・レビュー(35件)、86-4 は束とたどる記録(13件)。すべて成功。
- Phase 完了時の全体テスト(#18): devex-api **1623 件成功**(32 件は integration で除外。Phase 85 から 19 件増えた ── 検証の純粋関数 5・遷移の表 1・検証の API 5・レビュー 4・束とたどる記録 4。ルーターの登録は既存の1件に足した)。integration **32 件成功**(既存を含む全部。実際の PostgreSQL と Redis。検証からたどる記録までの流れの1件を足した)。devex-ui は変えていないので流していない。
- `ruff check`(app・tests・alembic)成功(`ruff format` は使わない)。`uvx pyright`(変えた本体のファイルとテスト): 0 件。
- マイグレーション: リビジョン ID の衝突なし・head は1つ(`483d9e531ba0`)。使い捨ての DB で `upgrade head` → `alembic check`(差なし)→ `downgrade f9c9614d5329` → `upgrade head` の往復を確かめ、DB を消した。dev の DB は `upgrade head` だけ。
- `samples_check.py`(`--api-since HEAD`): 一致 857・並び順のみ差 8・例外 5、「samples のみ」「本体のみ」0件。
- `link_check.py`: リンク切れ 0 件。
- 実 LLM: 呼んでいない(費用 0)。

## 未消化の申し送り(#37)

[Phase 85](../Phase-85/Phase-85-introduction.md#未消化の申し送り37) から引き継いだもの。

**ステージ11 の中で扱うもの**:
- **`gemini-3.1-flash-lite` の終了(2027-05-07 以降)** → Phase 88。その時点の後継のモデルを確かめて、カタログを入れ替える。
- **`devex-api/postgres-init/01-create-test-db.sh` の構文の誤り**(新しいボリュームで、テストの DB が作られない)→ Phase 88。テンプレートで直した形(標準入力から渡す)を取り込む。
- **止まった段階の生成と束**(Phase 81)→ Phase 88 の画面確認。
- **一覧の応答の大きさ**(Phase 81)→ Phase 88。
- **Phase 87〜89 の未確定事項**: [80-4](../Phase-80/Phase-80-4.md)「未確定事項」(81〜86 の分は解決)。
- **写しの元の基準の束**: 写しは元の CR の基準の束をそのまま使う。運用で困るかを Phase 87 の画面で確かめる。
- **下書きの中の直しは時系列に残さない**: 必要ならステージ12(行単位の変更の履歴)で扱う。
- **変更の種類と案の画面の入力** → Phase 87。対象ごとに種類と案を入れる形(削除では案の欄を出さない)。
- **予測・説明書の応答の大きさ**: 要素は数十〜百程度で、まとめて返している。画面で重いと分かったら、Phase 87・88 で絞り方を決める。
- **説明書のプレビューと要約の確認の画面** → Phase 88。照合で合わない所の印の出し方、元の文と直した文の並べ方、「古い」の表示。
- **要約の質** → Phase 89 の効果測定で、実 LLM で1回作って確かめるか(費用の見積もりを出す)。
- **要約を直した人**: 記録していない(確かめた人だけ)。画面で要ると分かったら Phase 88 で列を足す。
- **要約の生成の回数の上限**: 置いていない(文書の生成と同じ)。既定のキーで使われすぎると分かったら決める。
- **反映のボタンと比較の画面** → Phase 87。文書の再生成と段階の生成に CR を選ぶ所、比較の3分類の見せ方。`allowed_actions` の `apply` は画面のボタンにしない(再生成で起きる)。
- **文書の版の応答に CR を出すか**: 今は出していない(時系列の `refs` とたどる記録で読める)。画面で要ると分かったら Phase 87・88 で足す。
- **反映を実 LLM で通すか** → Phase 89(80-4 の未確定事項のまま)。今は偽の LLM でしか通していない。

**この Phase で生まれたもの**(ステージ11 の中で扱う):
- **検証の画面** → Phase 87。CR の詳細に、印の3つの状態と文書の側の確認の項目を並べ、`can_verify` で検証のボタンを出す。段階の印を確かめる所(段階の画面)への行き方。
- **レビューを結ぶ画面** → Phase 87。候補の一覧から選ぶ形。外す操作が要るかを画面確認で確かめる(今は作っていない)。
- **束の作成で CR を選ぶ画面と、合意の記録の初期値** → Phase 88。選んだ CR の合意の記録(相手・メモ・理由)を初期値にする。束の応答に入れた CR の番号を出すか(今は CR の側の `included_baseline_number` とたどる記録だけ)。
- **たどる記録の画面** → Phase 87。CR の詳細の時系列を、生の `events` でなくたどる記録で出すか。
- **段階の承認で付く印の漏れ** → Phase 89 の効果測定。CR を渡して作り直した段階を承認したときに、新しく生まれた要素から先の印は CR に結ばれない(ユーザー決定で結ばない)。「実際だけ」と検証の漏れの数で確かめる。
- **反映の後の CR の流れの部品**: `tests/fixtures/change_requests.py` を足した。85-2〜85-4 のテストの中の同じ手順(合意した CR を作る)は、触るときに寄せる(#17)。

**ステージ11 の範囲の外**(行き先は [80-1](../Phase-80/Phase-80-1.md) の表):
- 振り返り 6節の残り7件:
  - ステージ12: 推測の採用率・決める機会
  - ステージ15 の前後: 前提作業・戻し方・版の一致
  - ヒアリングを扱うステージ: 認証の対の問い・基本機能の観点
- **生成の質の候補4件**: 再生成のきっかけの残り(Phase 70)・設計に無いテスト(Phase 70)・日本語の名前のデータストア(Phase 71)・語の表の範囲(Phase 71)。
- **新しい要件を足す CR の予測の起点を人が選ぶ形**(Phase 83 で見送った): 必要が分かってから(ステージ12 以降)。
- **規模の集計と選択肢つきの説明**: ステージ13。

**持ち越し**(触るときに直す。中身は [振り返り](../retrospectives/project-retrospective.md) 8節):
- `test_chat_service.py` などの pyright の指摘(Phase 40)
- devex-ui の並列のテストのタイムアウト(Phase 44)
- 偽 LLM の外部設計書の GET に DF が無い(Phase 45)
- `DfdEditorTabs` のテストのまれな失敗(Phase 77)
- Google の公開鍵を毎回取りに行く(Phase 74)
- `ListCard` の入れ物(Phase 79。テンプレートでは直した)
- 英語のままの refresh の失敗の文(Phase 79)
- `tagmerge.py` の手直し(ステージ10 の振り返り)。この Phase は単一の章のファイルだけ `tagmerge.py` で当て、複数の章にまたがるファイル(`change_request_service.py`・`schemas/change_request.py`・`routes/change_requests.py`・`repositories/change_request.py`・`__init__.py`)は、`tagmerge.py` の差分の当て方が入り組んだ(新しいメソッドを、置き換えたメソッドの中に混ぜて当てた)ので元に戻し、本体からブロックを切り出して手で当てた。docstring の中にコメントアウトを差し込んで構文を壊した所が1つあった(`comparison` の docstring。構文の読みで気づいて直した)。

**ユーザーが決めるもの**:
- **開発環境の後始末**: 確認用の利用者・プロジェクト、DB の事故の後の複製(振り返り 8節)。
- **この Phase の未コミット**: 外側のリポジトリと devex-api の変更。コミットはユーザーが行う(#35)。devex-api のタグは `phase-86`(`phase-81`〜`phase-85` もまだ無ければ、あわせて)。

**セッションの区切りの記録**: Phase 86 は1セッションで行った(計画 → 86-1〜86-4 の実装 → マイグレーションの往復 → 全体テストと integration → samples → docs → 教材)。

**この Phase で解決したもの**:
- **80-4 の Phase 86 の未確定事項**(文書の側の要素の確認の扱い・検証済みの後の新しい束の既定の記録・レビューを結ぶ条件): 着手時の相談と [86-1](./Phase-86-1.md)〜[86-4](./Phase-86-4.md)。
- **文書の側の要素の確認**(Phase 80 から): CR の確認の項目にした([86-1](./Phase-86-1.md)・[86-2](./Phase-86-2.md))。
- **検証済みの API**(Phase 82 から): [86-2](./Phase-86-2.md)。時系列にレビューの参照を足した([86-3](./Phase-86-3.md))。
- **CR の列の追加 ── 結んだレビュー**(Phase 82 から): 別の表 `change_request_reviews`([86-2](./Phase-86-2.md)・[86-3](./Phase-86-3.md))。
- **段階の承認で付く印と CR**(Phase 85 から): 結ばない(ユーザー決定。[86-1](./Phase-86-1.md))。
- **比較の確認の状態**(Phase 85 から): 今の状態を出す([86-1](./Phase-86-1.md)・[86-2](./Phase-86-2.md))。

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

設問は Phase の要点の要約(回答は求めない)。

1. 反映で付いた印の確認の状態を、CR の写し(`applied_impact`)でなく今の段階の印から読むのはなぜか。段階の印が消えていることを「確認済み」とみなしてよいのはなぜか。
2. 印の付かない文書の側の要素を、印の仕組み(段階0の印)でなく CR の確認の項目にしたのはなぜか。印の仕組みを変えると、何に影響が出るか。
3. 段階の承認で付く印を CR に結ばなくても、多くの見直しが検証の条件に残るのはなぜか(`record` の出どころの扱い)。結ばないことで漏れるのはどんな要素か。
4. レビューを結べる回を「最初の反映の後に始めた、成功した回」にしたのはなぜか。
5. 束に CR を結ぶ処理を `BaselineService` に置き、CR をリポジトリで読んだのはなぜか(import の向き)。
6. たどる記録で、反映で作った文書の版が「今も残っているか」を示すのはなぜか。

## 次のフェーズ

**Phase 87**: CR の画面。CR の一覧・作成(対象ごとの種類と案)・詳細(状態・時系列またはたどる記録・予測・合意の記録・反映のボタン・比較・検証の確かめと検証のボタン・レビューを結ぶ)。着手時に、自動実装モード(#21)と [80-4](../Phase-80/Phase-80-4.md) の Phase 87・88 の未確定事項(画面の置き場所とナビゲーション)と、この Phase の申し送り(検証の画面・レビューを結ぶ画面・たどる記録の画面)を決める。
