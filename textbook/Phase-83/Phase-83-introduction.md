# Phase 83 導入: CR に結ぶ影響の予測(ステージ11)

## 目的

ステージ11(合意と変更の一巡)の3つ目の実装 Phase。[80-4](../Phase-80/Phase-80-4.md) の Phase 83 として、合意の前に「CR の対象の要件を変えると、どの要素の見直しが要るか」を示す API を作る([外部設計書](../../docs/external_design.md) 2.14節「影響の予測」、[内部設計書](../../docs/internal_design.md) 3.3節 11項)。基準の合意済みの版(束)の写しから要素を組み、今の変更影響分析のたどり方(`impact_of`)を対象ごとに当てる。予測は判断(合意・却下)の時点で CR に保存し、Phase 84(説明書の「影響の一覧」)と Phase 85(反映の後の実際の印との比較)が使う。

着手時の相談で、CR の対象に変更の種類(内容の変更 / 削除)を持たせることになった(推奨と違う)。Phase 82 の CR の形を変えるので、最初の章で扱う。

- CR の対象に変更の種類を持たせる ── [83-1](./Phase-83-1.md)
- 予測の純粋関数 ── [83-2](./Phase-83-2.md)
- 予測の保存と API ── [83-3](./Phase-83-3.md)

## パイプライン上の位置づけ・前提

```
CR-1(下書き。基準 B-1、対象 [{FR-005, 内容の変更}])
   │
   ▼ GET /projects/{id}/change-requests/1/impact                                   ──[83-3]
   ChangeRequestService.impact
     ├ 保存した予測があれば、それを返す(判断の後)
     └ 無ければ predict_for(CR, 束の写し)                                           ──[83-3]
          ▼ predict_from_snapshots                                                  ──[83-2]
          baseline_models(束の写し: requirements・external_design・stage:1〜8
                          + 段階3の写しの ER_SNAPSHOT_KEY)
          → build_elements → 対象ごとに impact_of(Change("req:FR-005"))  ← ステージ7 のたどり方
          → 1つの一覧(要素ごとに道・理由・届いた対象)
   ▼ 200 {targets, items(画面・API・処理・手順・処理ロジック・作業単位), excluded, saved}
   │
   ├ POST /1/decision(合意・却下)で、その時点の予測を predicted_impact に保存     ──[83-3]
   ▼ Phase 84: 説明書の「影響の一覧」と「影響を受ける作業単位とテストの数」に使う
     Phase 85: 反映の後の実際の印と並べる
```

- **前提として読むもの**: [80-2](../Phase-80/Phase-80-2.md)(ベースライン。同じ求め方の予測が N2 の正解6件と一致した)・[80-4](../Phase-80/Phase-80-4.md)(Phase 83 の未確定事項)・[82-2](../Phase-82/Phase-82-2.md)(CR の対象とサービス)・[81-3](../Phase-81/Phase-81-3.md)(束の写しの形)。
- **今の仕組み**: `impact_of(elements, Change)`(`app/detailed_design/impact/trace.py`)は、変わった要素から見直しが要る要素を「処理を軸」の規則で求める純粋関数で、ステージ7 から段階の印に使っている。束の写しは、文書の model と段階の `approved_model`(段階3は承認したときの ER の定義を含む)を持つ。
- **この Phase を始めた時点の状態**: devex-api の HEAD は `4a937fa`(Phase 82)、外側のリポジトリは `01ca1bf`。alembic の head は `e1cfb47f1d13`。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(本体 + samples)。

E2E: この Phase では流さない(画面を変えないため。ステージ11 の E2E は Phase 89 で既存を含めて全部流す)。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 83 開始時」を参照。計画モードで2回(4問と、比較のあとの1問)聞いた。

| # | 問い | 決定 |
|---|---|---|
| 1 | 自動実装モード | on(推奨どおり) |
| 2 | 対象の要件の変更の種類 | **推奨と違う**: 対象ごとに種類(内容の変更 / 削除)を持つ(推奨は「すべて内容の変更として扱い、種類の欄を持たない」)。ユーザーは推奨の理由を選択肢ごとのメリット・デメリットで比べるよう求め、比較を見たうえで選んだ |
| 3 | 新しい要件を足す CR の予測 | 予測なしと示す(推奨どおり) |
| 4 | 予測を CR に保存するか | 判断(合意・却下)の時点で保存(推奨どおり) |

決定2で示した比較の要点: 今の `to_trace_changes` は反映の後の差分でも「消えた要素」を内容の変更としてたどるので、削除と内容の変更は予測の範囲が同じ。種類の欄の今の消費者は説明書(Phase 84)と画面で、欄を足すと Phase 82 の列・スキーマ・重なり・写しを直すことになる。ユーザーは、説明書・画面で「削除」を構造として示せる方を選んだ。仕様の変更なので、#40 に従い [`q_a.md`](../q_a.md) に CR の形で残してから docs に反映した。

Claude の判断(計画の承認で確定、または作業中):

- 種類は内容の変更・削除の2つ(改名は入れない)。**たどり方は種類によらず内容の変更**(予測と Phase 85 の実際の印を同じ規則にそろえる)。
- 同じ要件を同じ種類で2回は1つにまとめ、違う種類で2回は 422(スキーマの検証)。
- 予測は CR の詳細に混ぜず、別の API(`GET .../{number}/impact`)にした。
- 束に入っていない文書・段階を、応答の `excluded` に状態と一緒に出す。
- 取り下げは保存しない。却下した CR の写しは、予測を写さない。
- `ER_SNAPSHOT_KEY` を `app/services/design_stage_service.py` から `app/detailed_design/data_model.py` へ移した(#17。今の消費者 = 予測の純粋関数)。
- テンプレートから取り込むものは無し。
- **作業中**: 対象を整える(空白・重複・種類の衝突)のを、サービスからスキーマの `field_validator` に移した(種類の衝突は本文の誤りなので、検証の誤りとして返すため)。
- **作業中**: 束の写しから予測までを1つの純粋関数 `predict_from_snapshots` にまとめ、サービスは写しを渡すだけにした(`predict_for`)。
- **作業中**: integration のプロジェクトの文書を、ID だけの行から既存の fixture の model(`impact_documents`)に替えた(要件定義書の model として読めず、予測が空になるため)。

推奨と違った選択は1件(決定2。「種類の欄を持たない」→「対象ごとに種類を持つ」。推奨より、変更の意図を構造として残す向き)。計画の差し戻しは無し。#39 の材料。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-83-1.md`](./Phase-83-1.md) | CR の対象に変更の種類を持たせる | あり(本体 7 + マイグレーション 1 + テスト 6) | Phase 82(CR の表・スキーマ・サービス) |
| [`Phase-83-2.md`](./Phase-83-2.md) | 予測の純粋関数 | あり(本体 5 + テスト 2) | 83-1(`Target`)・Phase 81(束の写しの形)・ステージ7(`impact_of`) |
| [`Phase-83-3.md`](./Phase-83-3.md) | 予測の保存と API | あり(本体 4 + マイグレーション 1 + テスト 3) | 83-2(`Prediction`・`predict_from_snapshots`) |

## サンプルコード一覧

`textbook/samples/backend/` の新規・更新:

- 83-1: `app/change_requests/targets.py`(新規)・`app/change_requests/states.py`・`app/change_requests/__init__.py`・`app/models/change_request.py`・`alembic/versions/9f3e279a0210_change_request_target_kinds.py`(新規)・`app/repositories/change_request.py`・`app/schemas/change_request.py`・`app/services/change_request_service.py`・`tests/unit/test_change_request_targets.py`(新規)・`tests/unit/test_change_request_states.py`・`tests/unit/test_change_request_repository.py`・`tests/unit/test_change_request_service.py`・`tests/unit/test_change_requests_api.py`・`tests/integration/test_change_requests_flow.py`
- 83-2: `app/detailed_design/data_model.py`・`app/detailed_design/__init__.py`・`app/services/design_stage_service.py`・`app/change_requests/prediction.py`(新規)・`app/change_requests/__init__.py`・`tests/unit/test_change_request_prediction.py`(新規)・`tests/unit/test_design_stage_impact.py`
- 83-3: `app/models/change_request.py`・`alembic/versions/6c43be350866_add_change_request_predicted_impact.py`(新規)・`app/schemas/change_request.py`・`app/services/change_request_service.py`・`app/api/routes/change_requests.py`・`tests/unit/test_change_request_service.py`・`tests/unit/test_change_requests_api.py`・`tests/integration/test_change_requests_flow.py`
- ミラーしないもの(#21 の共通): 無し(インフラ・設定ファイルは変えていない)。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| [83-1](./Phase-83-1.md) | `targets.py`・`ChangeRequest.targets`・マイグレーション・CR のスキーマ・サービス | CR の対象を要件 ID と変更の種類の組にし、整え・確かめ・重なり・写しを新しい形で行う | 整え(重複・種類の衝突)・保存の形の往復・既存の行の写し替え・応答のラベル・重なりは ID で |
| [83-2](./Phase-83-2.md) | `ER_SNAPSHOT_KEY` の移動・`prediction.py` | 束の写しから要素を組み、対象ごとの `impact_of` を1つの一覧にまとめる | `impact_of` との一致・統合と届いた対象・削除の範囲・新規だけ・ER の写し・保存の形 |
| [83-3](./Phase-83-3.md) | `predicted_impact`・マイグレーション・`ChangeRequestService.impact`・`ChangeRequestImpactRead`・ルート | 予測を API で返し、判断の時点で保存する | 判断の前は求める・判断で保存・保存の後は読み直さない・取り下げは保存しない・入っていない段階・404 |

## 写経順序(#23)

章番号順(83-1 → 83-2 → 83-3)。各章の表の順(依存順。#30)に写す。

- 83-1 は Phase 82 の CR の形を変える。`targets.py` → `states.py` → `__init__.py` の順に写さないと、`__init__.py` が消えた `normalize_targets` を `states` から読もうとする。マイグレーションを写したら `alembic upgrade head` を流してから API を動かす。
- 83-2 は `data_model.py`(定数の移動先)を先に、`design_stage_service.py`(定数の定義を消す)を後に写す。
- 83-3 のマイグレーションも、写したら `alembic upgrade head` を流す。

実 import 監査(#15。全 import 文を読んで確かめた):

- 83-1: `targets.py` → 標準ライブラリだけ。`states.py` → 新しい import は無い(`Iterable` は `overlaps` が使う)。`__init__.py` → `targets`(この章)・`states`(既存)。`schemas/change_request.py` → `pydantic.field_validator`・`app.change_requests` の `TARGET_KIND_LABEL`・`Target`・`TargetKind`・`normalize_targets`・`targets_from_json`(この章)。`change_request_service.py` → `Target`・`target_ids`・`targets_from_json`・`targets_to_json`(この章)。モデル・リポジトリ・マイグレーション → 新しい import は無い。テスト → この章のものと既存の fixture。
- 83-2: `data_model.py`・`detailed_design/__init__.py` → 新しい import は `ER_SNAPSHOT_KEY`(この章。表で先に置く)。`design_stage_service.py` → `app.detailed_design.ER_SNAPSHOT_KEY`(この章)。`prediction.py` → `app.change_requests.targets`(83-1)・`app.detailed_design` の `DATA_MODEL_STAGE`(既存)・`ER_SNAPSHOT_KEY`(この章)・`app.detailed_design.impact`(既存)。`change_requests/__init__.py` → `prediction`(この章)。テスト → この章のものと既存の fixture(`impact_documents`・`impact_stages`)・`FunctionListModel`・`impact_of`(既存)。
- 83-3: `schemas/change_request.py` → `app.change_requests.Prediction`(83-2)。`change_request_service.py` → `Prediction`・`predict_from_snapshots`(83-2)。`routes/change_requests.py` → `ChangeRequestImpactRead`・`ExcludedItemRead`(この章。表でスキーマを先に置く)。テスト → `predict_for`・`get_change_request_impact`(この章)、integration は既存の fixture の `impact_documents`。

前方 import は無い。各章が作成・更新した本体のファイルは、その章のテストが import する(モデルはリポジトリ・サービスのテストが ORM を通して読み、マイグレーションは往復の実行で確かめた。`data_model.py` は `app.detailed_design` の re-export を通して予測のテストが読む)。

## 検証結果

- 章ごとの部分テスト: 83-1 は CR のテスト5本(新しい targets の4件を含む 44件)、83-2 は予測(7件)と段階の影響(18件)、83-3 は CR のテスト6本(54件)。すべて成功。
- Phase 完了時の全体テスト(#18): devex-api **1554 件成功**(29 件は integration で除外。Phase 82 から 13 件増えた ── targets 4・予測 7・サービス 2・ルート 1 と、states から移した 1件の減り)。integration **29 件成功**(既存を含む全部。実際の PostgreSQL と Redis)。devex-ui は変えていないので流していない。
  - 全体テストの後に、pyright の指摘で `checked_targets` の戻り値を `list(targets)` にした。関係するテスト(72件)を流し直して成功。
- `ruff check`(app・tests・alembic)成功(`ruff format` は使わない)。`uvx pyright`(変えた本体のファイルとテスト): 0 件(`checked_targets` の戻り値の型の1件を直した後)。
- マイグレーション: リビジョン ID の衝突なし・head は1つ(`6c43be350866`)。既存の DB に触れないよう、使い捨ての DB を作り、`e1cfb47f1d13` まで上げて CR を1行入れ → `upgrade head`(対象が `[{requirement_id, kind: "content"}]` に写った)→ `alembic check`(差なし)→ `downgrade e1cfb47f1d13`(ID の一覧に戻った)→ `upgrade head` の往復を確かめ、DB を消した。dev の DB は `upgrade head` だけ(CR の行は無かった)。
- `samples_check.py`(`--api-since HEAD`): 一致 834・並び順のみ差 8・例外 5、「samples のみ」「本体のみ」0件。
- `link_check.py`: リンク切れ 0 件。
- 実 LLM: 呼んでいない(費用 0)。

## 未消化の申し送り(#37)

[Phase 82](../Phase-82/Phase-82-introduction.md#未消化の申し送り37) から引き継いだもの。

**ステージ11 の中で扱うもの**:
- **`gemini-3.1-flash-lite` の終了(2027-05-07 以降)** → Phase 88。その時点の後継のモデルを確かめて、カタログを入れ替える。
- **`devex-api/postgres-init/01-create-test-db.sh` の構文の誤り**(新しいボリュームで、テストの DB が作られない)→ Phase 88。テンプレートで直した形(標準入力から渡す)を取り込む。
- **文書の側の要素の確認**: 今の再生成の印は、画面と API に付かない([80-2](../Phase-80/Phase-80-2.md))→ Phase 86。予測には入る(この Phase)ので、Phase 86 では予測の画面・API を確認の項目にするかを決める。
- **止まった段階の生成と束**(Phase 81)→ Phase 88 の画面確認。
- **一覧の応答の大きさ**(Phase 81)→ Phase 88。
- **Phase 84〜89 の未確定事項**: [80-4](../Phase-80/Phase-80-4.md)「未確定事項」(81〜83 の分は解決)。
- **「説明済み」の条件** → Phase 84。説明書の出力を条件にするか(今は手で遷移できる)。
- **反映済み・検証済みの API** → Phase 85・86。遷移の表(`apply`・`verify`)はある。時系列に版・再生成・レビューの参照を足す。
- **CR の列の追加** → Phase 85(反映した版)・86(結んだレビュー)。説明書の要約の持ち方は Phase 84。予測の列はこの Phase で足した。
- **写しの元の基準の束**: 写しは元の CR の基準の束をそのまま使う。基準を変えたいときは新しい CR を作る。運用で困るかを Phase 87 の画面で確かめる。
- **下書きの中の直しは時系列に残さない**: 「いつ何を直したか」が要るとステージ12(行単位の変更の履歴)で分かったら、そこで扱う。

**この Phase で生まれたもの**(ステージ11 の中で扱う):
- **変更の種類の使い方** → Phase 84。説明書の2節(合意済みの文と変更後の案)で、削除の対象をどう書くか(「変更後の案: なし」など)。画面(Phase 87)の入力も。
- **予測と実際の比較の起点** → Phase 85。保存した予測(`predicted_impact`)を基準にする。判断の前に反映はできないので、反映した CR には必ず保存がある。
- **予測の「作業単位とテストの数」** → Phase 84。予測の一覧の `unit:` の要素の数は数えられる。テストの数は、束のテスト仕様書の写し(あれば)と作業単位の対応から求めるかを決める。
- **予測の応答の大きさ**: 要素の数は数十〜百程度で、まとめて返している。画面で重いと分かったら、Phase 87 で絞り方を決める。

**ステージ11 の範囲の外**(行き先は [80-1](../Phase-80/Phase-80-1.md) の表):
- 振り返り 6節の残り7件:
  - ステージ12: 推測の採用率・決める機会
  - ステージ15 の前後: 前提作業・戻し方・版の一致
  - ヒアリングを扱うステージ: 認証の対の問い・基本機能の観点
- **生成の質の候補4件**: 再生成のきっかけの残り(Phase 70)・設計に無いテスト(Phase 70)・日本語の名前のデータストア(Phase 71)・語の表の範囲(Phase 71)。生成の質を扱うステージの仕様診断で決める。
- **新しい要件を足す CR の予測の起点を人が選ぶ形**(この Phase で見送った): 必要が分かってから(ステージ12 以降)。

**持ち越し**(触るときに直す。中身は [振り返り](../retrospectives/project-retrospective.md) 8節):
- `test_chat_service.py` などの pyright の指摘(Phase 40)
- devex-ui の並列のテストのタイムアウト(Phase 44)
- 偽 LLM の外部設計書の GET に DF が無い(Phase 45)
- `DfdEditorTabs` のテストのまれな失敗(Phase 77)
- Google の公開鍵を毎回取りに行く(Phase 74)
- `ListCard` の入れ物(Phase 79。テンプレートでは直した)
- 英語のままの refresh の失敗の文(Phase 79)
- `tagmerge.py` の手直し(ステージ10 の振り返り)。この Phase は `tagmerge.py` で15本に当て、import 文・docstring・ファイル冒頭のヘッダー・2章にまたがるファイルの章の振り分け(83-1 の既定で当てたあと、83-2・83-3 の分を直す)を手で直した。

**ユーザーが決めるもの**:
- **開発環境の後始末**: 確認用の利用者・プロジェクト、DB の事故の後の複製(振り返り 8節)。
- **この Phase の未コミット**: 外側のリポジトリと devex-api の変更。コミットはユーザーが行う(#35)。devex-api のタグは `phase-83`(`phase-81`・`phase-82` もまだ無ければ、あわせて)。

**セッションの区切りの記録**: Phase 83 は1セッションで行った。計画モードで調査(エージェントは使わず直接)→ 質問2回(4問、比較のあと1問)→ 計画の承認 → q_a の CR → 83-1〜83-3 の実装 → マイグレーションの往復 → 全体テストと integration → samples → docs → 教材。

**この Phase で解決したもの**:
- **80-4 の Phase 83 の未確定事項**(変更の種類の写し方・新しい要件の CR の予測・予測の保存): 着手時の相談と [83-1](./Phase-83-1.md)・[83-2](./Phase-83-2.md)・[83-3](./Phase-83-3.md)。
- **新しい要件を足す CR の予測の起点**(Phase 82 から): 予測なしと示す([83-2](./Phase-83-2.md) の `unpredicted_new_requirement`)。
- **CR の列の追加のうち予測の保存**(Phase 82 から): [83-3](./Phase-83-3.md) の `predicted_impact`。

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

設問は Phase の要点の要約(回答は求めない)。

1. 予測を今の文書・段階でなく、基準の束の写しから組むのはなぜか。束に入っていない段階があるとき、予測と応答には何が起きるか。
2. 対象に「削除」の種類を持たせても、たどり方を変えなかったのはなぜか(反映の後の差分の扱いとの関係)。種類はどこで使われるか。
3. 複数の対象が同じ要素に届いたとき、何を残すか。説明書(Phase 84)はそれをどう使えるか。
4. 予測を判断の時点で保存するのはなぜか。判断の前に保存しないのはなぜか。取り下げで保存しないのはなぜか。
5. `ER_SNAPSHOT_KEY` をサービスから `app/detailed_design/data_model.py` へ移したのはなぜか(#17 の判定の一問と、層の向き)。

## 次のフェーズ

**Phase 84**: 変更の説明書。CR・束の写し・予測(この Phase)・観点の表(`hearing_points` の open)・要件の出どころ(`assumed`)から、5節の md を決定的に組み立ててダウンロードできるようにする。任意の LLM の要約(ボタン)・要件 ID と数字の照合・確認の関門・「古い」の印も扱う。着手時に、自動実装モード(#21)と [80-4](../Phase-80/Phase-80-4.md) の Phase 84 の未確定事項(5節の書式とファイル名・要約の用途と入力の範囲・照合の範囲・要約を直したときの記録)、Phase 82 から送った「説明済み」の条件、この Phase で生まれた「削除の対象の書き方」「テストの数の求め方」を決める。
