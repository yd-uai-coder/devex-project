# Phase 71 導入: 設計の検証(ステージ9)

## 目的

ステージ9の10個目の実装 Phase。[61-3](../Phase-61/Phase-61-3.md) の Phase 71 として、ステージ7・8 の効果の確認で残った設計の欠陥3件を片付ける。

- マイルストーンのゴールと単位の食い違い(PR-7。ゴールは CI/CD・バックアップを挙げ、タスクは Docker と nginx だけ)→ ゴールの少数の語をタスクと照らす警告と、両方の計画のプロンプトの規則([71-1](./Phase-71-1.md))
- DFD のデータストアの書き漏れ(CRUD 図に C/U/D があるのに、DFD に線が無い)→ 逆向きの照合の警告と、DFD のプロンプトの規則([71-2](./Phase-71-2.md))
- 画面の文の変更は、その画面のすべての処理へ届く → UI 仕様の本文だけの変更は、同じ差分の要件・API が届いた処理に絞る([71-3](./Phase-71-3.md))

効果は、保存済みの記録と実際の Gemini で確かめた([71-4](./Phase-71-4.md))。

## パイプライン上の位置づけ・前提

```
実装計画書(簡易)/ 段階7(詳細)── マイルストーン(ゴール + タスク)
   ├ プロンプト: GOAL_RULE(ゴールは作るものだけ)                                   ──[71-1]
   └ 検証: GOAL_WITHOUT_TASK(ゴールの語 ↔ タスクの名前・modules・config_files)      ──[71-1]
段階2 DFD ─▶ 段階3 ER・CRUD 図
   ├ プロンプト: 保存するデータはすべてデータストアに                                 ──[71-2]
   └ 検証: DFD → CRUD(既存) + CRUD → DFD の DFD_STORE_MISSING(選んだ DFD の処理だけ)──[71-2]
変更の影響: diff_elements ─▶ marks_for ─▶ impact_of(変更1つずつ)
   └ UI 仕様の本文だけの画面: ほかの変更が届いた処理に絞る(届かなければ全部)           ──[71-3]
```

- **前提として読むもの**:
  - [61-3](../Phase-61/Phase-61-3.md)(Phase 71 のスコープと未確定事項)
  - [Phase 58](../Phase-58/Phase-58-introduction.md) と [58-3](../Phase-58/Phase-58-3.md)(PR-7)
  - [Phase 49](../Phase-49/Phase-49-introduction.md) と [49-2](../Phase-49/Phase-49-2.md)・[49-4](../Phase-49/Phase-49-4.md)(DFD の書き漏れ・画面の文の波及)
  - [Phase 48](../Phase-48/Phase-48-introduction.md)(DFD → CRUD の照合)
  - [Phase 43](../Phase-43/Phase-43-introduction.md)(変更の影響の差分と印)
- **今の仕組み**:
  - マイルストーンは自由文のゴールと、タスクの列を持つ。タスクは `modules`(検証する)と `config_files`(例として書く)の2つの欄を持つ。
  - 段階3の検証は、選んだ DFD の線から CRUD 図を照らす。
  - 変更の影響は、変わった要素を1つずつ `impact_of` でたどり、`marks_for` が印を合わせる。
- **この Phase を始めた時点の状態**: devex-api の HEAD は `9808e85`、devex-ui は `c11673a`(Phase 69)。外側のリポジトリは Phase 70 までコミット済み(`16fe650`)。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(本体 + samples)。devex-ui は変えていない。新しい指摘は、既存の指摘の表示(文言)で出る。

E2E: この Phase では流さない(Phase 72 で既存を含めて全部流す)。偽 LLM の段階7・実装計画書の出力には新しい警告が出ない(`test_e2e_fake_outputs_pass_stage7_validation` が通る)。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 71 開始時」を参照。

| # | 問い | 決定 |
|---|---|---|
| 1 | 自動実装モード | on(推奨どおり) |
| 2 | PR-7 の直し方 | 指示 + 小さな語の表の警告(推奨どおり) |
| 3 | DFD の書き漏れの直し方 | 逆向きの警告 + DFD の指示(推奨どおり) |
| 4 | 画面の波及の絞り方 | 同時の変更で絞る(推奨どおり) |

Claude の判断(計画の承認で確定、または作業中):

- 重要度は、どちらの警告も承認を止めないものにした。実装計画書は中程度、段階7・段階3は警告。
- 効果の確かめ方:
  - 決定的な部分は保存済みの記録に当てる。画面の波及は `regen.py`、警告は新しい `count.py` を使う。
  - プロンプトは実 Gemini(flash-lite の無料枠)で2回ずつ確かめる。Sonnet のレビューは流さない(見込み $0)。
- **作業中**(保存済みの記録に当てて): 機能のマイルストーンの「フロントエンドでプレビュー」を誤って指摘した。そこで、フロントエンドは機能のタスクがあれば作るとみなすようにした([71-1](./Phase-71-1.md))。
- **作業中**: 既存の段階3のテストは、DFD に書き込みの線の無いまま CRUD の fixture(F-01 × reservations の C)を検証していた。新しい警告が出るので、テストの既定の DFD に F-01 の書き込みの線を持たせた([71-2](./Phase-71-2.md))。
- **作業中**: 1回目の integration は、実 LLM の確かめのログインと合わせてログインの上限(127.0.0.1)に当たり、既存の2件が落ちた。カウンタが切れてから流し直した(下の「検証結果」)。

推奨と違った選択は無かった。計画の差し戻しも無かった。#39 の材料。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-71-1.md`](./Phase-71-1.md) | マイルストーンのゴールと単位(PR-7) | あり(本体 5 + テスト 3。新規 2) | なし |
| [`Phase-71-2.md`](./Phase-71-2.md) | DFD のデータストアの書き漏れ(逆向きの照合) | あり(本体 2 + テスト 2) | なし(`validation.py` は 71-1 と同じファイル) |
| [`Phase-71-3.md`](./Phase-71-3.md) | 画面の文の変更の波及を絞る | あり(本体 3 + テスト 1) | なし |
| [`Phase-71-4.md`](./Phase-71-4.md) | 効果の確認(保存済みの記録と実際の LLM) | なし(測定。記録は `appendix/stage8-effect/phase71/`) | 71-1〜71-3 |

## サンプルコード一覧

`textbook/samples/backend/` の新規・更新:

- 71-1:
  - 新規: `app/detailed_design/plan_goal.py`・`tests/unit/test_plan_goal.py`
  - 更新: `app/detailed_design/plan_drafting.py`・`app/documents/implementation_plan/`(`drafting.py`・`validation.py`)・`app/detailed_design/validation.py`(段階7)・`tests/unit/test_implementation_plan_doc.py`・`tests/unit/test_plan.py`
- 71-2: `app/detailed_design/data_flow_drafting.py`・`app/detailed_design/validation.py`(段階3)・`tests/unit/test_data_model.py`・`tests/unit/test_data_flow_drafting.py`
- 71-3: `app/detailed_design/impact/`(`diff.py`・`trace.py`・`marks.py`)・`tests/unit/test_impact_marks.py`
- 測定のスクリプトと出力は `appendix/stage8-effect/phase71/` に置き、samples にミラーしない。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| [71-1](./Phase-71-1.md) | `plan_goal.py`・2つの計画の `drafting.py`・`validation.py` | ゴールの少数の語を、同じマイルストーンのタスクの名前・ファイルと照らして警告し、プロンプトで作るものだけを書かせる | 実際の形 / 証拠の3つの欄 / 機能のタスクとフロントエンド / 拾わない語 / 両方のプロンプト / 2つの検証の重要度と対象 |
| [71-2](./Phase-71-2.md) | `validation.py`・`data_flow_drafting.py` | CRUD 図の書き込みに当たる DFD の線が無いことを、選んだ DFD の処理に限って警告する | 指摘 / R だけ / 線あり / 選んでいないグループ / 規則の文 |
| [71-3](./Phase-71-3.md) | `diff.py`・`trace.py`・`marks.py` | UI 仕様の本文だけの画面の変更を、同じ差分のほかの変更が届いた処理に絞る | 絞る / ほかの変更なし / 本文の外の変更 / 道の上の処理 |

## 写経順序(#23)

章番号順(71-1 → 71-2 → 71-3)。各章の表の順(依存順。#30)に写す。3つの章は互いに依存しない。

- 71-1 の2つの `drafting.py` と `validation.py` は `plan_goal.py` を import するので、`plan_goal.py` を先に写す。
- `app/detailed_design/validation.py` は 71-1(段階7)と 71-2(段階3)の両方で更新する。samples のタグで章を分けている。
- 71-3 の `marks.py` は `diff.ui_spec_only`・`trace.path_axis` を使うので、`diff.py`・`trace.py` を先に写す。

実 import 監査(#15。全 import 文を読んで確かめた):

- 71-1:
  - `plan_goal.py` → `re`・`dataclasses`(標準)、`Milestone`(既存)。
  - 2つの `drafting.py` → `GOAL_RULE`(71-1。表で先に置く)。
  - 実装計画書の `validation.py` → `milestone_id`(既存)・`uncovered_goal_terms`(71-1)。段階の `validation.py` → `uncovered_goal_terms`(71-1)。
  - テスト → `GOAL_RULE`・`GOAL_TERMS`・`uncovered_goal_terms`(71-1)と、既存の `Milestone`・`PlanTask`・`PLAN_SYSTEM_PROMPT`・`SYSTEM_PROMPT`。
- 71-2: `validation.py` は新しい import を持たない(`DataFlowModel`・`dfd_subject`・`table_key` は既存)。テスト → `selected_dfd_processes`(71-2)。
- 71-3:
  - `diff.py` → `json`(標準)。`trace.py` は新しい import を持たない。
  - `marks.py` → `ui_spec_only`・`path_axis`(71-3。表で先に置く)、`ImpactItem`(既存)。
  - テスト → `ui_spec_only`・`path_axis`(71-3)。

前方 import は無い。各章が作成・更新した本体のファイルは、その章のテストが import する(各章の「テスト観点」の末尾)。

## 検証結果

- 章ごとの部分テスト(すべて成功):
  - 71-1: 計画・実装計画書・ゴール 49件
  - 71-2: 段階3・DFD 20件、関連の段階・手順書・偽 LLM 464件
  - 71-3: 変更の影響 76件
- Phase 完了時の全体テスト(#18):
  - devex-api: **1431 件成功**(integration は除外)。
  - integration: 1回目はログインの上限(作業中の実 LLM の確かめのログインと合わせて 127.0.0.1 で 14回)で既存の2件が落ちた。カウンタが切れてから流し直し、**19 件成功**(`docker-compose.test.yml` 経由。既存を含む全部)。
  - devex-ui は変えていないので流していない。
- `ruff check`(全体)成功。`pyright`: この Phase で変えたファイルの指摘は 0件。
- 効果([71-4](./Phase-71-4.md)):
  - 画面の波及の過剰: detailed-3 5 → 2、simple-2 2 → 0(見落とし 0)。
  - 保存済みの記録: `DFD_STORE_MISSING` が 49-2 の3件、`GOAL_WITHOUT_TASK` が PR-7 の2例を拾った。
  - 実 Gemini: 簡易のゴールの食い違い 1 → 0・0、`DFD_STORE_MISSING` 2 → 0・0。
  - 費用 $0。
- `samples_check.py`(`--api-since HEAD --ui-since HEAD`):
  - 作り忘れ 0 件。
  - 不一致 1 件は、Phase 65 から残る `ProjectListControls.tsx`(下の「未消化の申し送り」)。
  - この Phase のファイルはすべて一致した(一致 772 / 並び順のみ差 8 / 例外 5)。「samples のみ」2件は、以前からの `change-impact-demo` のルート。
- `link_check.py`: 切れ 0 件。

## 未消化の申し送り(#37)

Phase 70 から引き継いだもの:

- **ステージ9の計画の残り**(Phase 72): 既存を含めた全 E2E・マイグレーションの往復・本番反映の手順・本番での確認。
- **持ち越し**(触るときに直す):
  - `test_chat_service.py` の pyright の指摘4件(Phase 40 から)。全体では `test_chat_stream_errors.py`・`test_doc_generation_start.py` の3件も出ている。
  - 並列のテストのタイムアウト(Phase 44 から)。
  - 偽 LLM の外部設計書の GET に DF が無い(Phase 45 から)。
- **Phase 72 の未確定事項**: [61-3](../Phase-61/Phase-61-3.md)「未確定事項」(62〜71 の分は解決)。
- **モデルのカタログの見直し**: `gemini-3.1-flash-lite` は 2027-05-07 以降に終了する(表は [`app/ai/llm/catalog.py`](../samples/backend/app/ai/llm/catalog.py))。
- **確認メールの送信**: 範囲の外。
- **画面確認(#37 の運用注記)**: 次のものは、Phase 72 の本番確認でまとめて見る。本番は https なので、印に `Secure` が付くこともそこで確かめる。
  - ヘッダー・メニュー・モード選択(Phase 62)
  - 認証ページの振り分け(Phase 63)
  - 削除のボタン・ダイアログ・トースト(Phase 64)
  - 検索・絞込み・ページ送り(Phase 65)
  - マイページのアカウント(Phase 66)
  - 生成の失敗の知らせ・承認できない理由・渡した指摘(Phase 69)

  マイページ(アカウント・モデル・API キー)の操作感は、Phase 67 の直後にユーザーが確かめる([61-3](../Phase-61/Phase-61-3.md))。手元で試すには、`devex-api/.env` に `ENCRYPTION_KEY` を足して API を起動し直す。
- **登録の上限と手元の確認**: 既存の `test_auth_flow.py`・`test_projects_flow.py` は API で登録するので、integration を流し直すと登録・ログインの上限(10回/時)に当たる。[`retrospective-memo.md`](../retrospective-memo.md) の「統合テストとレート制限のカウンタを分ける」と同じ問題である。この Phase では、実 LLM の確かめのログイン(`drive71.py` は1回ごとにログインする)も同じ 127.0.0.1 のカウンタに入った。
- **削除したプロジェクトの URL を開いたときの表示**(Phase 64 から): 「Project {id} not found」がそのまま出る。直すなら、404 のときの文言を画面で「このプロジェクトは見つかりません(削除された可能性があります)」とし、ダッシュボードへのリンクを出す。
- **AlertDialog の開発時の警告**(Phase 64 から): Tamagui 2.6.0 の AlertDialog が、開く前に説明文を探して警告を出す(誤検知)。版を上げるときに消えるか確かめる。
- **トーストの v2 の API**(Phase 64 から): `@tamagui/toast/v2` の `Toaster` は、2.6.0 の web で `accessibilityLabel` を DOM に渡す。版を上げて直っていれば、v2 に寄せてもよい。
- **新規作成の後の一覧の cache**(Phase 65 から): `dashboard-store` の `invalidate` を呼ぶ所が無い。プロジェクトを作ってから20秒以内に同じ条件のダッシュボードへ戻ると、新しいプロジェクトが出ない。気になるなら、作成の成功で `invalidate()` を呼ぶ。
- **ダッシュボードの見出しの折り返し**(Phase 65 から): 幅 375px で「ダッシュボード」の見出しが3行に折り返す。Phase 72 の画面確認で見る。
- **`ProjectListControls.tsx` の samples と本体の食い違い**(Phase 65 の完了後の調整から): 本体のコミット(`5269927`)の検索欄に `maxWidth="480px"` が無く、samples にはある。どちらが正しいかをユーザーが決め、もう一方を合わせる。
- **ほかの端末のアクセストークン**(Phase 66 から): パスワードを変えても、ほかの端末のアクセストークン(30分)は寿命まで使える(今は入れない)。
- **アカウントのフォームの縦の余白**(Phase 66 から): `FormGeneral` はボタンの下にスピナーの場所(40px)を持つので、3つのフォームの下に空きが出る。アコーディオンの中での見た目を、操作感の確認で見る。
- **閉じると保存していない編集が消える**(Phase 67 の完了後の調整から): アコーディオンで節を閉じると中身が外れる。気になるなら、`Accordion.Content` に `forceMount` を付けて中身を残す。
- **本番の既定値の行と暗号の鍵**(Phase 67 から → Phase 72):
  - 本番で既定値の行を `seed_default_models` だけ流して入れるか、行が無くても `.env` の値で補う今の形のままにするかを決める。
  - `ENCRYPTION_KEY` の作り方と置き場、鍵を回す手順を `OPERATIONS.md` に書く。
  - Phase 67 と 69 の Alembic(各2本)も本番の手順に入れる。
- **dev の DB に残った確認用の利用者**(Phase 67 から): ブラウザでの確認で作った `mypage67-…@example.com` の利用者が2人ある。消してもよい。
- **レビューを使えることの案内**(Phase 68 から): 一般ユーザーには、レビューのパネルがまるごと出ない。「マイページでレビューの AI のキーを登録すると、設計レビューを使えます」の案内を出すかを、Phase 72 の画面確認で決める。
- **判定の既定のキー**(Phase 68 から): 自分の Claude キーでレビューを使う一般ユーザーが、判定の用途に Gemini を選び、その自分のキーを持っていないとする。この場合、判定は既定の Gemini キーで呼ぶ(既定のキーの回は1日の上限で数える)。
- **受け付けと実行のモデル**(Phase 68 から): レビューの回の `model` は、受け付けのときに解決したモデルである。実行はジョブの中で解決し直す。受け付けと実行の間(数秒)にマイページでモデルを替えると、記録と実際が食い違う。
- **Claude Haiku の推論のトークン**(Phase 68 から): Haiku 5.5 はチャットでも推論のトークンを使った(出力 3,310 のうち 2,628)。Phase 70・71 の効果の確かめは Gemini だけで行ったので見ていない。Claude で実際に流す Phase で見る。
- **Gemini の温度の警告**(Phase 68 から): `gemini-3.5-flash-lite` で温度が無視されると、langchain-google-genai が警告を出す。動作には影響しない。
- **押せないボタンの見た目**(Phase 69 から): `StyledButton` は押せないとき(`disabled`)の見た目を変えない。そのため、承認できない段階の「承認する」が、押せるボタンと同じ緑に見える(以前から)。見た目も変えるなら、`StyledButton` に `disabled` のときの不透明度を足す(ほかの画面のボタンにも効く)。
- **チャットの知らせの範囲**(Phase 69 から): チャットの上の知らせは、プレビューからの再生成の失敗も出す。記録は直近の1件で、どの画面から始めた生成かは持たない。
- **一覧の失敗の記録**(Phase 69 から): `GET /projects` の項目にも `generation_failure` が載るが、ダッシュボードは使っていない。カードに「前回の生成に失敗」を出すかは、Phase 72 の画面確認で決める。
- **値の欠けた答えを open に残す経路**(Phase 70 から): 実際の LLM で、open に残った例をまだ見ていない。次に聞き直しを流すとき(Phase 72 の本番確認など)に確かめる。
- **残った浅い要件のテスト**(Phase 70 から): 詳細の2回目で3件(`SHALLOW_REQUIREMENT_TEST` が知らせる)。増えるようなら、指示の位置を規則の先頭へ動かす。
- **再生成のきっかけの残り**(Phase 70 から):
  - 外部連携(2.4)・内部の API は差分(`changed_rows`)に入らない。
  - `unchanged` を持たない節は毎回書き直す。
  - 要件定義書の前の版は `id|text` だけを見せる。
  - 詳細設計の段階・テスト仕様書は、写す仕組みを使っていない。
- **設計に無いテスト**(Phase 70 から): テスト仕様書の正解例の残り(版の切り替え・献立1件の削除・GET の一覧で本人を決める方法)は、設計の抜けである。この Phase の3件(ゴールと単位・DFD の保存先・画面の波及)とは別の種類で、決定的に見る手がかり(要件と API の対応の欠け)を新しく作る必要がある。そのため、この Phase では扱わなかった。
- **dev の DB に残った確認用のプロジェクト**:
  - Phase 70 の `(Phase 70 確認用 …)` 5つ(`appendix/stage8-effect/state.json` の `p70-*`)。
  - この Phase の `(Phase 71 確認用 …)` 4つ(`p71-*`)。

  どちらも記録を見返すのに使う。

この Phase で生まれたもの:

- **日本語の名前のデータストア**: 実 Gemini の1回目の DFD に「チャットメッセージ」が出た。ER のテーブルに無いので `STORE_NOT_IN_ER` になった(1/2)。保存先をすべて描く規則を足したことで、新しいデータストアの名前の規則(英小文字の複数形)が抜けたおそれがある。増えるようなら、保存先の規則の文に「名前は英小文字の複数形」を繰り返す。
- **語の表の範囲**: `GOAL_TERMS` は CI/CD・バックアップ・フロントエンド・監視の4つだけである。ゴールのほかの約束(DB・Redis・認証など)は照らさない。PR-7 のほかの形が見つかったら、誤検知しにくいかを保存済みの記録(`count.py`)で確かめてから足す。
- **セッションの区切りの記録**: Phase 71 は1セッションで行った(計画モードで調査(調査エージェント3つ)→ 質問1回(4問)→ 計画の承認 → 71-1〜71-3 の実装 → 保存済みの記録に当てる(途中でフロントエンドの扱いを直した)→ 実 Gemini の確かめ → samples → docs → 教材)。

この Phase で解決したもの:

- **実装手順書のゴールと単位の食い違い(PR-7)**(Phase 55 から): [71-1](./Phase-71-1.md)。
- **DFD のデータストアの書き漏れ**(Phase 49 から): [71-2](./Phase-71-2.md)。
- **画面の文の変更は、その画面のすべての処理へ届く**(Phase 49 から): [71-3](./Phase-71-3.md)。
- **61-3 の Phase 71 の未確定事項**(3件の直し方・重要度・効果の確かめ方): 着手時の相談と計画。

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

設問は Phase の要点の要約(回答は求めない)。

1. ゴールの食い違いを、ゴールの文を読む LLM でなく、少数の語の表で照らしたのはなぜか。表に DB・Redis を入れなかったのはなぜか。
2. フロントエンドだけ、機能のタスクがあれば作るとみなしたのはなぜか。
3. 逆向きの照合を、選んだ DFD の処理に限ったのはなぜか。エラーでなく警告にしたのはなぜか。
4. 画面の文の変更の絞り込みを、`impact_of` でなく `marks_for` に置いたのはなぜか。どの処理にも届いていないときに絞らないのはなぜか。
5. プロンプトの規則が2回とも効いたのに、検証の警告も残したのはなぜか。

## 次のフェーズ

**Phase 72**: 統合/E2E・デプロイでの確認。既存を含めた全 E2E(#36)・マイグレーションの往復・本番反映の手順(`OPERATIONS.md`。`ENCRYPTION_KEY`・Alembic・seed の既定値)・本番での確認を行う。着手時に、自動実装モード(#21)と [61-3](../Phase-61/Phase-61-3.md) の未確定事項(本番の鍵の作り方と置き場・本番での確認の範囲)を決める。
