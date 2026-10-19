# Phase 84 導入: 変更の説明書(ステージ11)

## 目的

ステージ11(合意と変更の一巡)の4つ目の実装 Phase。[80-4](../Phase-80/Phase-80-4.md) の Phase 84 として、合意の前にクライアントへ見せる「変更の説明書」(5節の md)を、CR・基準の合意済みの版(束)の写し・影響の予測([Phase 83](../Phase-83/Phase-83-introduction.md))から決定的に組み立て、プレビューとダウンロードの API で返す([外部設計書](../../docs/external_design.md) 2.14節「変更の説明書」、[内部設計書](../../docs/internal_design.md) 3.3節 11項)。任意で LLM の要約を足せるが、人が確かめるまで出力に載らない(要件 ID・数字の照合、5節が変わったら「古い」)。

着手時の相談で、CR の対象に「変更後の案」を持たせることになった(推奨どおり。仕様の変更なので #40 の CR として残した)。最初の章で扱う。

- 対象ごとの変更後の案 ── [84-1](./Phase-84-1.md)
- 5節の組み立て(純粋) ── [84-2](./Phase-84-2.md)
- 説明書の API ── [84-3](./Phase-84-3.md)
- 任意の要約 ── [84-4](./Phase-84-4.md)

## パイプライン上の位置づけ・前提

```
CR-1(下書き。基準 B-1、対象 [{FR-001, 内容の変更, 案「…」}])                       ──[84-1]
   │
   ▼ GET .../change-requests/1/explanation                                           ──[84-3]
   ChangeRequestService.explanation
     ├ _impact_with_baseline: 束(写し付き)と予測(保存があればそれ、無ければ束から)  ← Phase 83
     └ build_explanation(facts_of(CR), 予測, 束の写し, 束に入っていないもの)          ──[84-2]
          1. 内容と背景 / 2. 対象の要件(合意済みの文・変更後の案)/ 3. 影響の一覧
          4. 関わる未決事項(束の要件定義書の観点の状態)/ 5. 作業単位とテストの数
          → markdown・fingerprint(sha256)
   ▼ 200 {markdown, fingerprint, output, units, …, summary}
   │
   ├ POST .../explanation/summary(LLM。5節だけを渡す。未確認)                       ──[84-4]
   ├ PATCH .../explanation/summary(直す。未確認に戻る)/ POST .../summary/confirm(確認済み)
   │     照合: 要約の要件 ID・数字のうち5節に無いもの / 状態: fingerprint が違えば「古い」
   ▼ GET .../explanation/download → cr-1-explanation.md(確認済みで古くない要約だけ載る)
     Phase 87・88: CR の画面と説明書のプレビュー・要約の確認の画面
```

- **前提として読むもの**: [80-4](../Phase-80/Phase-80-4.md)(Phase 84 の未確定事項)・[83-2](../Phase-83/Phase-83-2.md)(予測の形)・[83-3](../Phase-83/Phase-83-3.md)(予測の保存と API)・[83-1](../Phase-83/Phase-83-1.md)(対象の形)。
- **今の仕組み**: 予測(`Prediction`)は要素ごとに置き場・ラベル・理由・届いた対象を持つ。束の要件定義書の写しは、要件の行(`points`・`source`)と生成時の観点の状態(`point_statuses`)を持つ。テスト仕様書の写し(あれば)は、ケースごとに `functions`・`req_ids` を持つ。
- **この Phase を始めた時点の状態**: devex-api の HEAD は `d6c4444`(Phase 83)、外側のリポジトリは `808de21`。alembic の head は `6c43be350866`。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(本体 + samples)。

E2E: この Phase では流さない(画面を変えないため。ステージ11 の E2E は Phase 89 で既存を含めて全部流す)。E2E の偽の LLM には、要約の固定の応答を足した(Phase 89 の E2E で使う)。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 84 開始時」を参照。計画モードで1回(4問)聞いた。

| # | 問い | 決定 |
|---|---|---|
| 1 | 自動実装モード | on(推奨どおり) |
| 2 | 2節の「変更後の案」をどこから取るか | 対象ごとに任意の案の欄 `proposed_text` を足す(推奨どおり)。#40 の CR |
| 3 | 「説明済み」の条件(Phase 82 から) | 条件を置かない(推奨どおり) |
| 4 | 要約の持ち方と直したときの記録 | 別表 `change_request_summaries`、元の文と直した文の両方を残す(推奨どおり) |

Claude の判断(計画の承認で確定、または作業中):

- 5節の組み立ては純粋関数(`app/change_requests/explanation.py`)。CR の行は `ChangeRequestFacts` に写して渡す。
- 4節の「観点の表の open」は、今の `hearing_points` でなく束の要件定義書の写しの `point_statuses` で読む(合意した版と同じものを示し、決定的にするため)。
- 5節のテストは、束のテスト仕様書の写しのケースのうち、処理か対象の要件に当たるもの。束に無ければ「数えていない」。
- fingerprint は5節の md の sha256。照合は要件 ID と数字だけ(画面 ID・API は照合しない)。
- 要約の用途は生成(`Purpose.GENERATION`)。ファイル名は `cr-<番号>-explanation.md`。要約はどの状態の CR でも作れる。CR の詳細には混ぜず別の API。
- テンプレートから取り込むものは無し。
- **作業中**: 予測の起点の応答(`PredictedTargetRead`)に案を出さないよう、案つきの `ChangeRequestTargetDetailRead` を分けた。
- **作業中**: 影響の API と説明書で予測を共有するため、`impact` の中身を `_impact_with_baseline` に移した。
- **作業中**: 照合で、5節の見出しの行を元にしない(節の番号が要約の数字を通すため)。英字や数字に続く数字(`E2E`・`T03`)は名前の一部として数えない。
- **作業中**: 「確認した」は照合の結果で止めない(5節に無くても正しい数字がありうるので、人が判断する)。確かめると fingerprint を今の5節に合わせる(古い要約も確かめ直せる)。
- **作業中**: 要約を直した人は記録しない(残すのは確かめた人と日時)。要約の生成に回数の上限は置かない(文書の生成と同じ)。

推奨と違った選択は0件。計画の差し戻しは無し。#39 の材料。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-84-1.md`](./Phase-84-1.md) | 対象ごとの変更後の案 | あり(本体 3 + テスト 2) | Phase 83(CR の対象) |
| [`Phase-84-2.md`](./Phase-84-2.md) | 5節の組み立て(純粋) | あり(本体 2 + テスト 1) | 84-1(`Target.proposed_text`)・Phase 83(`Prediction`) |
| [`Phase-84-3.md`](./Phase-84-3.md) | 説明書の API | あり(本体 5 + テスト 3) | 84-2(`build_explanation`) |
| [`Phase-84-4.md`](./Phase-84-4.md) | 任意の要約 | あり(本体 10 + マイグレーション 1 + テスト 5) | 84-2(`check_summary`・`with_summary`)・84-3(`ExplanationView`) |

## サンプルコード一覧

`textbook/samples/backend/` の新規・更新:

- 84-1: `app/change_requests/targets.py`・`app/schemas/change_request.py`・`app/services/change_request_service.py`・`tests/unit/test_change_request_targets.py`・`tests/unit/test_change_request_service.py`
- 84-2: `app/change_requests/explanation.py`(新規)・`app/change_requests/__init__.py`・`tests/unit/test_change_request_explanation.py`(新規)
- 84-3: `app/change_requests/explanation.py`・`app/change_requests/__init__.py`・`app/schemas/change_request.py`・`app/services/change_request_service.py`・`app/api/routes/change_requests.py`・`tests/unit/test_change_request_explanation.py`・`tests/unit/test_change_request_service.py`・`tests/unit/test_change_requests_api.py`
- 84-4: `app/change_requests/summary.py`(新規)・`app/change_requests/__init__.py`・`app/models/change_request_summary.py`(新規)・`app/models/__init__.py`・`alembic/versions/fee4fbc2a00c_add_change_request_summaries.py`(新規)・`app/repositories/change_request_summary.py`(新規)・`app/services/errors.py`・`app/schemas/change_request.py`・`app/services/change_request_service.py`・`app/api/routes/change_requests.py`・`app/ai/llm/fake.py`・`tests/unit/test_change_request_summary.py`(新規)・`tests/unit/test_change_request_service.py`・`tests/unit/test_change_requests_api.py`・`tests/unit/test_fake_llm_e2e.py`・`tests/integration/test_change_requests_flow.py`
- ミラーしないもの(#21 の共通): 無し(インフラ・設定ファイルは変えていない)。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| [84-1](./Phase-84-1.md) | `targets.py`・CR のスキーマ・サービス | CR の対象に任意の変更後の案を持たせ、整え・保存・応答に通す | 案の整え(重複・衝突・削除の案)・案の無い行の読み・作成で残る |
| [84-2](./Phase-84-2.md) | `explanation.py` | CR の値・予測・束の写しから5節の md と fingerprint を作り、要約を照合する | 5節の中身・束に無いものの注記・未決の観点・作業単位とテストの数・fingerprint・照合 |
| [84-3](./Phase-84-3.md) | `ChangeRequestService.explanation`・`ChangeRequestExplanationRead`・ルート | 説明書を影響の API と同じ予測で組み、プレビューとダウンロードで返す | CR の直しで変わる・判断の後も同じ本文・ファイル名・404 |
| [84-4](./Phase-84-4.md) | `summary.py`・⑱・リポジトリ・サービス・ルート | 要約を作り・直し・確かめ、確認済みで古くない要約だけを出力に載せる | 未確認は載らない・元の文が残る・古い・作り直し・照合・CR ごとに1行・CASCADE |

## 写経順序(#23)

章番号順(84-1 → 84-2 → 84-3 → 84-4)。各章の表の順(依存順。#30)に写す。

- 84-1 は Phase 83 の対象の形を変える。`targets.py` を先に写す(スキーマ・サービスが `Target` に案を渡す)。
- 84-3 は `impact` の中身を `_impact_with_baseline` に移す。影響の API の挙動は変わらない(83-3 のテストが番人)。
- 84-4 は `__init__` に `llm` を足し、`ExplanationView` に要約を足す。ルートの `_explanation` とダウンロードも 84-4 の形に直す。マイグレーションを写したら `alembic upgrade head` を流してから API を動かす。

実 import 監査(#15。全 import 文を読んで確かめた):

- 84-1: 新しい import は無い(`targets.py` は標準ライブラリだけ。スキーマ・サービスは既存の `Target` に案を渡すだけ)。テスト → `Target`・`targets_from_json`(83-1)。
- 84-2: `explanation.py` → `prediction.Prediction`(83-2)・`states` の表示名と型(82-2)・`targets`(83-1・84-1)・`app.hearing.points` の `is_point_key`・`point_def`(既存)。`__init__.py` → `explanation`(この章)。テスト → この章のものと既存の fixture・`predict_from_snapshots`(83-2)。
- 84-3: `explanation.py` の `explanation_filename`(この章で足す。表で先に置く)。スキーマ → `Explanation`・`explanation_filename`(84-2・この章)。サービス → `ChangeRequestFacts`・`Explanation`・`build_explanation`(84-2)。ルート → `fastapi.Response`・`content_disposition`(既存)・`explanation_filename`・`ChangeRequestExplanationRead`・`ExplanationView`(この章)。テスト → `facts_of`・ルートの2関数(この章)。
- 84-4: `summary.py` → `langchain_core.messages`。モデル → 既存の `Base`。リポジトリ → モデル(この章)。サービス → `summary.py` の関数・`with_summary`(84-2)・`ChangeRequestSummary`・`ChangeRequestSummaryRepository`・`ChangeRequestSummaryNotFoundError`(この章)・`Purpose`・`extract_text_content`・`LlmResolver`・`ResolvedLlm`・`injected_llm`・`invoke_with_retry`(既存)。スキーマ → `SUMMARY_MAX`・`SUMMARY_STATE_LABEL`・`SummaryState`・`check_summary`(この章・84-2)、`ChangeRequestSummary` は `TYPE_CHECKING` の中。ルート → `SummaryEdit`(この章)。テスト → この章のものと既存の `FakeLLM`・`stub_llm_resolver`。

前方 import は無い。各章が作成・更新した本体のファイルは、その章のテストが import する(モデルはリポジトリのテストが、マイグレーションは往復の実行で確かめた)。

## 検証結果

- 章ごとの部分テスト: 84-1 は CR のテスト6本(57件)、84-2 は説明書(10件)、84-3 は説明書・サービス・ルート(32件)、84-4 は要約・サービス・ルート・偽の LLM。すべて成功。
- Phase 完了時の全体テスト(#18): devex-api **1580 件成功**(30 件は integration で除外。Phase 83 から 26 件増えた ── targets 3・説明書 11・要約 5・サービス 4・ルート 2・偽の LLM 1)。integration **30 件成功**(既存を含む全部。実際の PostgreSQL と Redis。説明書と要約の流れの1件を足した)。devex-ui は変えていないので流していない。
- `ruff check`(app・tests・alembic)成功(`ruff format` は使わない)。`uvx pyright`(変えた本体のファイルとテスト): 0 件。
- マイグレーション: リビジョン ID の衝突なし・head は1つ(`fee4fbc2a00c`)。使い捨ての DB で `upgrade head` → `alembic check`(差なし)→ `downgrade 6c43be350866` → `upgrade head` の往復を確かめ、DB を消した。dev の DB は `upgrade head` だけ。
- `samples_check.py`(`--api-since HEAD`): 一致 841・並び順のみ差 8・例外 5、「samples のみ」「本体のみ」0件。
- `link_check.py`: リンク切れ 0 件。
- 実 LLM: 呼んでいない(費用 0。要約はフェイクで確かめた)。

## 未消化の申し送り(#37)

[Phase 83](../Phase-83/Phase-83-introduction.md#未消化の申し送り37) から引き継いだもの。

**ステージ11 の中で扱うもの**:
- **`gemini-3.1-flash-lite` の終了(2027-05-07 以降)** → Phase 88。その時点の後継のモデルを確かめて、カタログを入れ替える。
- **`devex-api/postgres-init/01-create-test-db.sh` の構文の誤り**(新しいボリュームで、テストの DB が作られない)→ Phase 88。テンプレートで直した形(標準入力から渡す)を取り込む。
- **文書の側の要素の確認**: 今の再生成の印は、画面と API に付かない([80-2](../Phase-80/Phase-80-2.md))→ Phase 86。予測と説明書には入るので、Phase 86 では予測の画面・API を確認の項目にするかを決める。
- **止まった段階の生成と束**(Phase 81)→ Phase 88 の画面確認。
- **一覧の応答の大きさ**(Phase 81)→ Phase 88。
- **Phase 85〜89 の未確定事項**: [80-4](../Phase-80/Phase-80-4.md)「未確定事項」(81〜84 の分は解決)。
- **反映済み・検証済みの API** → Phase 85・86。遷移の表(`apply`・`verify`)はある。時系列に版・再生成・レビューの参照を足す。
- **CR の列の追加** → Phase 85(反映した版)・86(結んだレビュー)。
- **写しの元の基準の束**: 写しは元の CR の基準の束をそのまま使う。運用で困るかを Phase 87 の画面で確かめる。
- **下書きの中の直しは時系列に残さない**: 必要ならステージ12(行単位の変更の履歴)で扱う。
- **変更の種類と案の画面の入力** → Phase 87。対象ごとに種類と案を入れる形(削除では案の欄を出さない)。
- **予測と実際の比較の起点** → Phase 85。保存した予測(`predicted_impact`)を基準にする。
- **予測・説明書の応答の大きさ**: 要素は数十〜百程度で、まとめて返している。画面で重いと分かったら、Phase 87・88 で絞り方を決める。

**この Phase で生まれたもの**(ステージ11 の中で扱う):
- **説明書のプレビューと要約の確認の画面** → Phase 88。照合で合わない所の印の出し方、元の文と直した文の並べ方、「古い」の表示。
- **要約の質** → Phase 89 の効果測定で、実 LLM で1回作って確かめるか(費用の見積もりを出す)。今は偽の LLM でしか通していない。
- **要約を直した人**: 記録していない(確かめた人だけ)。画面で要ると分かったら Phase 88 で列を足す。
- **要約の生成の回数の上限**: 置いていない(文書の生成と同じ)。既定のキーで使われすぎると分かったら決める。

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
- `tagmerge.py` の手直し(ステージ10 の振り返り)。この Phase は `tagmerge.py` で13本に当て、import 文・docstring・ヘッダー・4章にまたがるファイルの章の振り分け(既定の章で当てた後に直す)・関数の書き換え(`normalize_targets` は細切れのタグを関数ごとの「更新」にまとめた)・`__all__` の章ごとのまとめを手で直した。

**ユーザーが決めるもの**:
- **開発環境の後始末**: 確認用の利用者・プロジェクト、DB の事故の後の複製(振り返り 8節)。
- **この Phase の未コミット**: 外側のリポジトリと devex-api の変更。コミットはユーザーが行う(#35)。devex-api のタグは `phase-84`(`phase-81`〜`phase-83` もまだ無ければ、あわせて)。

**セッションの区切りの記録**: Phase 84 は2セッションで行った(1つ目で計画 → q_a の CR → 84-1〜84-4 の実装 → マイグレーションの往復 → 全体テストと integration → samples → docs、利用の上限で区切り、2つ目で教材)。

**この Phase で解決したもの**:
- **80-4 の Phase 84 の未確定事項**(5節の書式とファイル名・要約の用途と入力の範囲・照合の範囲・要約を直したときの記録): 着手時の相談と [84-2](./Phase-84-2.md)・[84-3](./Phase-84-3.md)・[84-4](./Phase-84-4.md)。
- **「説明済み」の条件**(Phase 82 から): 置かない([84-3](./Phase-84-3.md))。
- **変更の種類の使い方 ── 削除の対象の書き方**(Phase 83 から): 2節で「(削除)」([84-2](./Phase-84-2.md))。
- **予測の「作業単位とテストの数」**(Phase 83 から): [84-2](./Phase-84-2.md) の5節。
- **説明書の要約の持ち方**(Phase 82 から): 別表⑱([84-4](./Phase-84-4.md))。

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

設問は Phase の要点の要約(回答は求めない)。

1. 4節の未決の観点を、今の観点の表でなく束の要件定義書の写しから読むのはなぜか。今の表から読むと、fingerprint と要約に何が起きるか。
2. 要約の「古い」を列に保存せず、読むたびに fingerprint で決めるのはなぜか。fingerprint を5節の md の hash にすると、入力ごとの版を数えなくてよいのはなぜか。
3. 要約の LLM に5節だけを渡し、照合を要件 ID と数字に絞ったのはなぜか。照合で合わなくても「確認した」を止めないのはなぜか。
4. 影響の API と説明書が、同じ所(`_impact_with_baseline`)から予測を得るのはなぜか。判断の後に説明書の本文が変わらないのはなぜか。
5. 予測の起点の応答に変更後の案を出さないよう、応答の型を分けたのはなぜか(継承の向き)。

## 次のフェーズ

**Phase 85**: 反映。合意した CR を、設計レビューの採用した指摘と同じ経路で再生成の指示に入れ(`cr_id`)、生成の版に CR と生成したモデルを残す。反映の後の実際の印を、保存した予測と並べる。着手時に、自動実装モード(#21)と [80-4](../Phase-80/Phase-80-4.md) の Phase 85 の未確定事項(再生成の起点・CR の内容を修正の指示にする形・やり直し・反映中のほかの生成・比較の表し方)を決める。
