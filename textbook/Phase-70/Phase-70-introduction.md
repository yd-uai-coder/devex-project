# Phase 70 導入: ヒアリングとテスト仕様書の質(ステージ9)

## 目的

ステージ9の9つ目の実装 Phase。[61-3](../Phase-61/Phase-61-3.md) の Phase 70 として、Phase 59 の効果の確認([59-6](../Phase-59/Phase-59-6.md))で残った4件を片付ける。

- カードで選ぶと観点の要約が置き換わる・値のカードが論点の一部しか値にしない → 聞き直しでも要約を残し、聞き直している観点へのカードの答えは判定の LLM が前の要約と合わせて決める。カードは指摘の対象ごとに値を書く([70-1](./Phase-70-1.md))
- 要件ごとのテストの書き方が浅い → 要件のテストを振る舞いに分けて書かせ、落ちる型(`{id}` の未認証・本文の `token`・上限の表示・外部サービスの上限)を必要なテストの一覧に足し、浅いテストを検証で知らせる([70-2](./Phase-70-2.md))
- 変更のきっかけを列挙する再生成の設計 → きっかけを各文書のプロンプトの節の分け方から作り、テストで節と突き合わせる。要件定義書の写した行にも出どころの上限をかける([70-3](./Phase-70-3.md))

効果は実際の Gemini で確かめた([70-4](./Phase-70-4.md))。

## パイプライン上の位置づけ・前提

```
設計レビューの指摘(ヒアリングが原因)── 聞き直し(reopen_points): open に。要約は残す            ──[70-1]
  └ 「おすすめでよい」→ 値のカード(指摘を名指し: 対象ごとの値。_REHEARING_CARD_NOTE)       ──[70-1]
      └ カードの答え ── 聞き直し中なら判定の LLM へ(_REHEARING_ANSWER_NOTE)                    ──[70-1]
           ├ 対象すべてに値 → adopted(前の要約 + 値)。カードだけの decided は adopted に
           └ 値の無い対象が残る → open のまま → 次のカード
観点の表 ─▶ 要件定義書の再生成(きっかけ = 観点の表・修正指示・会話。revision_rule(REVISION))    ──[70-3]
              └ 写した行(unchanged)も cap_source をかけ直す                                  ──[70-3]
要件定義書・外部設計書 ─▶ 必要なテストの一覧(obligations)─▶ テスト仕様書(要件は振る舞いで)        ──[70-2]
                                                        └ 検証: SHALLOW_REQUIREMENT_TEST      ──[70-2]
```

- **前提として読むもの**: [61-3](../Phase-61/Phase-61-3.md)(Phase 70 のスコープと未確定事項)、[Phase 59](../Phase-59/Phase-59-introduction.md)(委ねたときの値のカード・観点の表の変化のきっかけ・必要なテストの拡張)と [59-6](../Phase-59/Phase-59-6.md)(残ったもの)、[Phase 54](../Phase-54/Phase-54-introduction.md)(聞き直し・修正指示)、[Phase 49](../Phase-49/Phase-49-introduction.md)(差分の再生成)、[Phase 56](../Phase-56/Phase-56-introduction.md)(テスト仕様書)。
- **今の仕組み**: カードの答えは判定の LLM を呼ばず、コードが「採用」と記録する(Phase 35)。聞き直しは観点を open にし、聞き直しの発言の id を `hearing_points.reopened_after` に記録する(Phase 54)。再生成は前の版の行を AI に見せ、変えない行を `unchanged` と答えさせて写す(Phase 49)。テスト仕様書は、コードが決めた「必要なテスト」の表を AI が埋める(Phase 56・59)。
- **この Phase を始めた時点の状態**: devex-api の HEAD は `2fa2cab`、devex-ui は `c11673a`(Phase 69)。外側のリポジトリは Phase 69 までコミット済み(`46db856`)。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(本体 + samples)。devex-ui は変えていない(検証の指摘は文言で出るので、新しいコードを画面で扱う必要が無い)。

E2E: この Phase では流さない(Phase 72 で既存を含めて全部流す)。偽 LLM の流れ(E2E)は、聞き直しを通らないので変わらない見込み。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 70 開始時」を参照。

| # | 問い | 決定 |
|---|---|---|
| 1 | 自動実装モード | on(推奨どおり) |
| 2 | ヒアリングの2件の直し方 | 聞き直しの答えは判定に通す(要約を残し、指摘を名指しした注記で前の要約と合わせる)(推奨どおり) |
| 3 | テスト仕様書の直し方 | 指示 + 一覧 + 検証(推奨どおり) |
| 4 | 再生成のきっかけの直し方 | きっかけを入力の節から作る(テストで節と突き合わせる)(推奨どおり) |

Claude の判断(計画の承認で確定、または作業中):

- 効果の確かめは実 Gemini(flash-lite の無料枠)で、Sonnet のレビューは流さない(見込み $0)。聞き直し2回・要件定義書の再生成1回・テスト仕様書を簡易と詳細で2回ずつ。
- 指摘の本文は、聞き直しの発言から取り出す(`rehearing_findings_text`)。指摘の行を観点に保存しない(マイグレーションを避けた)。
- 未認証の義務は、パスに `{id}` を持つ API にだけ足す(ログインの要らない API に誤った義務を足さない)。
- **作業中**: 聞き直しで要約を残しても、文で答えた回の判定が空の要約で消すので、`merge_judgement` で前の要約を補った。
- **作業中**(効果の確かめで): 判定がカードの選択を `decided` と書いたので、カードだけを根拠にした `decided` をコードが `adopted` に直した。判定とカードの注記の「論点」を「指摘が挙げた対象(例: …)」に具体化し、3回目を流した([70-4](./Phase-70-4.md))。
- **作業中**: 統合テストを最初にホストから流してしまった(手順は `docker-compose.test.yml` 経由)。既定の向き先は `test` という別の DB で、開発用 DB(プロジェクト 109件・Alembic head)は無事だった。手順どおりの方法でも流し直して通した。

推奨と違った選択は無し。計画の差し戻しは無し。#39 の材料。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-70-1.md`](./Phase-70-1.md) | 聞き直しの答えを判定に通す | あり(本体 4 + テスト 2) | なし(Phase 54 の聞き直し・Phase 59 の注記) |
| [`Phase-70-2.md`](./Phase-70-2.md) | テスト仕様書の要件ごとのテストと落ちる型 | あり(本体 3 + テスト 3) | なし |
| [`Phase-70-3.md`](./Phase-70-3.md) | 再生成のきっかけを入力の節から作る | あり(本体 6 + テスト 2) | なし |
| [`Phase-70-4.md`](./Phase-70-4.md) | 効果の確認(実際の LLM) | なし(測定。記録は [`appendix/stage8-effect/phase70/`](../../appendix/stage8-effect/phase70/README.md)) | 70-1〜70-3 |

## サンプルコード一覧

`textbook/samples/backend/` の更新(新規ファイルは無い):

- 70-1: `app/review/rehearing.py`・`app/review/__init__.py`・`app/hearing/points.py`・`app/services/chat_service.py`・`tests/unit/test_review_rehearing.py`・`tests/unit/test_chat_service.py`
- 70-2: `app/documents/test_spec/`(`obligations.py`・`drafting.py`・`validation.py`)・`tests/unit/test_test_spec_{obligations,drafting,validation}.py`
- 70-3: `app/documents/revision.py`・`app/documents/requirements/`(`assemble.py`・`drafting.py`)・`app/documents/{external_design,internal_design,implementation_plan}/drafting.py`・`tests/unit/test_document_revision.py`・`tests/unit/test_review_sendback.py`
- 測定の出力は `appendix/stage8-effect/phase70/` に置き、samples にミラーしない。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| [70-1](./Phase-70-1.md) | `chat_service.py`・`points.py`・`rehearing.py` | 聞き直しの要約を残し、聞き直し中のカードの答えを判定で前の要約と合わせる。カードは指摘の対象ごとに値 | 要約を残す / 判定に回す(注記の全文)/ open のまま / 判定の失敗で記録 / 2つの注記 / `decided` → `adopted` / 指摘の取り出し |
| [70-2](./Phase-70-2.md) | `obligations.py`・`drafting.py`・`validation.py` | 落ちる型を必要なテストに足し、要件のテストを振る舞いで書かせ、浅いテストを知らせる | 未認証の条件 / `token` / 上限の非機能・制約 / 規則の文 / 浅いテストの指摘 |
| [70-3](./Phase-70-3.md) | `revision.py`・4文書の `drafting.py`・`assemble.py` | きっかけを節の分け方から作り、写した行にも出どころの上限をかける | 規則の文 / 節 = 分け方 / 名指ししない節 / 写した行の出どころ |

## 写経順序(#23)

章番号順(70-1 → 70-2 → 70-3)。各章の表の順(依存順。#30)に写す。3つの章は互いに依存しない。

- 70-1 の `chat_service.py` は `app.review.rehearing.rehearing_findings_text` を使うので、`rehearing.py` を先に写す。
- 70-3 は `revision.py` の `REVISION_RULE` を消すので、4文書の `drafting.py` と `test_review_sendback.py` を同じ章で替える(途中では import できない)。

実 import 監査(#15。全 import 文を読んで確かめた):

- 70-1: `chat_service.py` → `dataclasses.replace`(標準)・`rehearing_findings_text`(70-1。表で先に置く)。`review/__init__.py` → 同。テスト → `_REHEARING_ANSWER_NOTE`・`_REHEARING_CARD_NOTE`・`rehearing_findings_text`(70-1)・`PointStatus`・`SendbackFinding`・`rehearing_message`・`rehearing_points`(既存)。
- 70-2: `validation.py` → `re`(標準)。テスト → `body_tokens`(70-2)・`RequirementRow`(既存)。
- 70-3: `revision.py` → `dataclasses.dataclass`(標準)。4文書の `drafting.py` → `RevisionInputs`・`revision_rule`(70-3。表で先に置く)。テスト → 各文書の `REVISION`(70-3)・`SYSTEM_PROMPT`・`build_requirements_messages`・`PointState`・`initial_states`(既存)。

前方 import は無い。各章が更新した本体のファイルは、その章のテストが import する(各章の「テスト観点」の末尾)。

## 検証結果

- 章ごとの部分テスト: 70-1(チャット・聞き直し・ヒアリング 114件)・70-2(テスト仕様書 44件)・70-3(再生成・4文書・差し戻し 220件)。すべて成功。
- Phase 完了時の全体テスト(#18): devex-api **1419 件成功**(integration は除外)。integration **19 件成功**(`docker-compose.test.yml` 経由。既存を含む全部)。devex-ui は変えていないので流していない。
- `ruff check`(全体)成功。`pyright`: この Phase で変えたファイルの指摘は、以前からの `test_chat_service.py` の4件だけ。
- **実際の LLM**([70-4](./Phase-70-4.md)): 聞き直しの前の要約が6回とも残った・「など」のカード 0枚・要件定義書の FR-011・FR-012 に値・テスト仕様書の詳細の正解例 33/38 → 36/38(簡易は 13/17 のまま)・要件の言い直しのテスト 10件 → 0件・3件。費用 $0。
- `samples_check.py`(`--api-since HEAD --ui-since HEAD`): 作り忘れ 0 件。不一致 1 件は Phase 65 から残る `ProjectListControls.tsx`(下の「未消化の申し送り」)。この Phase のファイルはすべて一致(一致 770 / 並び順のみ差 8 / 例外 5。「samples のみ」2件は以前からの `change-impact-demo` のルート)。`link_check.py`: 切れ 0 件。

## 未消化の申し送り(#37)

Phase 69 から引き継いだもの:

- **ステージ9の計画の残り**(Phase 71〜72): 実装手順書のゴールと単位の食い違い(PR-7)・DFD のデータストアの書き漏れ・画面の文の変更は、その画面のすべての処理へ届く(→ 71)。
- 持ち越し(触るときに直す): **`test_chat_service.py` の pyright の指摘4件**(Phase 40 から。全体では `test_chat_stream_errors.py`・`test_doc_generation_start.py` の3件も出ている)・**並列のテストのタイムアウト**(Phase 44 から。Phase 69 でも devex-ui を既定の並列で流すと 19 件が 5 秒で落ち、`--maxWorkers=4` で通った)・**偽 LLM の外部設計書の GET に DF が無い**(Phase 45 から)。
- **Phase 71〜72 の未確定事項**: [61-3](../Phase-61/Phase-61-3.md)「未確定事項」(62〜70 の分は解決)。
- **モデルのカタログの見直し**: `gemini-3.1-flash-lite` は 2027-05-07 以降に終了する(表は [`app/ai/llm/catalog.py`](../samples/backend/app/ai/llm/catalog.py))。
- **確認メールの送信**: 範囲の外。
- **画面確認(#37 の運用注記)**: ヘッダー・メニュー・モード選択(Phase 62)・認証ページの振り分け(Phase 63)・削除のボタン・ダイアログ・トースト(Phase 64)・検索・絞込み・ページ送り(Phase 65)・マイページのアカウント(Phase 66)・**生成の失敗の知らせ・承認できない理由・渡した指摘(Phase 69)** は、Phase 72 の本番確認でまとめて見る。本番は https なので、印に `Secure` が付くこともそこで確かめる。マイページ(アカウント・モデル・API キー)の操作感は、Phase 67 の直後にユーザーが確かめる([61-3](../Phase-61/Phase-61-3.md))。手元で試すには、`devex-api/.env` に `ENCRYPTION_KEY` を足して API を起動し直す。
- **登録の上限と手元の確認**: 既存の `test_auth_flow.py`・`test_projects_flow.py` は API で登録するので、integration を流し直すと登録・ログインの上限(10回/時)に当たる。[`retrospective-memo.md`](../retrospective-memo.md) の「統合テストとレート制限のカウンタを分ける」と同じ問題(この Phase は2回流して2回とも通った)。
- **削除したプロジェクトの URL を開いたときの表示**(Phase 64 から): 「Project {id} not found」がそのまま出る。直すなら、404 のときの文言を画面で「このプロジェクトは見つかりません(削除された可能性があります)」とし、ダッシュボードへのリンクを出す。
- **AlertDialog の開発時の警告**(Phase 64 から): Tamagui 2.6.0 の AlertDialog が、開く前に説明文を探して警告を出す(誤検知)。版を上げるときに消えるか確かめる。
- **トーストの v2 の API**(Phase 64 から): `@tamagui/toast/v2` の `Toaster` は 2.6.0 の web で `accessibilityLabel` を DOM に渡す。版を上げて直っていれば、v2 に寄せてもよい。
- **新規作成の後の一覧の cache**(Phase 65 から): `dashboard-store` の `invalidate` を呼ぶ所が無い。プロジェクトを作ってから20秒以内に同じ条件のダッシュボードへ戻ると、新しいプロジェクトが出ない。気になるなら、作成の成功で `invalidate()` を呼ぶ。
- **ダッシュボードの見出しの折り返し**(Phase 65 から): 幅 375px で「ダッシュボード」の見出しが3行に折り返す。Phase 72 の画面確認で見る。
- **`ProjectListControls.tsx` の samples と本体の食い違い**(Phase 65 の完了後の調整から): 本体のコミット(`5269927`)の検索欄に `maxWidth="480px"` が無く、samples にはある。どちらが正しいかをユーザーが決め、もう一方を合わせる。
- **ほかの端末のアクセストークン**(Phase 66 から): パスワードを変えても、ほかの端末のアクセストークン(30分)はその寿命まで使える(今は入れない)。
- **アカウントのフォームの縦の余白**(Phase 66 から): `FormGeneral` はボタンの下にスピナーの場所(40px)を持つので、3つのフォームの下に空きが出る。アコーディオンの中での見た目を、操作感の確認で見る。
- **閉じると保存していない編集が消える**(Phase 67 の完了後の調整から): アコーディオンで節を閉じると中身が外れる。気になるなら、`Accordion.Content` に `forceMount` を付けて中身を残す。
- **本番の既定値の行と暗号の鍵**(Phase 67 から → Phase 72): 本番で既定値の行を `seed_default_models` だけ流して入れるか、行が無くても `.env` の値で補う今の形のままにするかを決める。`ENCRYPTION_KEY` の作り方と置き場、鍵を回す手順を `OPERATIONS.md` に書く。この Phase の Alembic 2本も本番の手順に入れる。
- **dev の DB に残った確認用の利用者**(Phase 67 から): ブラウザでの確認で作った `mypage67-…@example.com` の利用者が2人ある。消してもよい。
- **レビューを使えることの案内**(Phase 68 から): 一般ユーザーには、レビューのパネルがまるごと出ない。「マイページでレビューの AI のキーを登録すると、設計レビューを使えます」の案内を出すかを、Phase 72 の画面確認で決める。
- **判定の既定のキー**(Phase 68 から): 自分の Claude キーでレビューを使う一般ユーザーが、判定の用途に Gemini を選び、その自分のキーが無い場合は、既定の Gemini キーで判定を呼ぶ(既定のキーの回は1日の上限で数える)。
- **受け付けと実行のモデル**(Phase 68 から): レビューの回の `model` は受け付けのときに解決したモデルで、実行はジョブの中で解決し直す。受け付けと実行の間にマイページでモデルを替えると、記録と実際が食い違う(数秒の間)。
- **Claude Haiku の推論のトークン**(Phase 68 から): Haiku 5.5 はチャットでも推論のトークンを使った(出力 3,310 のうち 2,628)。Phase 70 の効果の確かめは Gemini だけで行ったので見ていない。Claude で実際に流す Phase で見る。
- **Gemini の温度の警告**(Phase 68 から): `gemini-3.5-flash-lite` は温度を無視すると langchain-google-genai が警告する。動作には影響しない。

- **押せないボタンの見た目**(Phase 69 から): `StyledButton` は押せないとき(`disabled`)の見た目を変えないので、承認できない段階の「承認する」が押せるボタンと同じ緑に見える(画面の確認で気づいた。以前から)。Phase 69 で理由を横に出したので分かるようにはなった。見た目も変えるなら、`StyledButton` に `disabled` のときの不透明度を足す(ほかの画面のボタンにも効く)。
- **チャットの知らせの範囲**(Phase 69 から): チャットの上の知らせは、プレビューからの再生成の失敗も出す(記録は直近の1件で、どこから始めた生成かは持たない)。気になるなら、記録に起点の画面を足すか、チャットではヒアリングからの生成(全部を作る)の失敗だけを出す。
- **一覧の失敗の記録**(Phase 69 から): `GET /projects` の項目にも `generation_failure` が載るが、ダッシュボードは使っていない。カードに「前回の生成に失敗」を出すかは、Phase 72 の画面確認で決める。

この Phase で生まれたもの:

- **値の欠けた答えを open に残す経路**: 判定の注記で「値の無い対象が残れば open」としたが、実際の LLM で open に残った例をまだ見ていない(h2 は直す前の注記で adopted、h3 は値が欠けなかった)。次に聞き直しを流すとき(Phase 72 の本番確認など)に、論点の欠けた選択肢を選んで確かめる。
- **残った浅い要件のテスト**: 詳細の2回目で3件(`SHALLOW_REQUIREMENT_TEST` の軽微の警告で見える)。増えるようなら、指示の位置を規則の先頭へ動かす(Phase 58 の言語の規則と同じ)。
- **設計に無いテスト**: 正解例の残り(版の切り替え・献立1件の削除・GET の一覧で本人を決める方法)は、テスト仕様書でなく設計の抜け。Phase 71(設計の検証)で扱えるかを着手時に見る。
- **再生成のきっかけの残り**: 外部連携(2.4)・内部の API は差分(`changed_rows`)に入らない。`unchanged` を持たない節(要件の目的・利用者・範囲、外部の概要・遷移、内部の構成・エラー方針、計画のフェーズ・環境・リスク)は毎回書き直す。要件定義書の前の版は `id|text` だけを見せる。詳細設計の段階・テスト仕様書は写す仕組みを使っていない。どれも入力の分け方の問題ではないので、この Phase では触っていない。
- **dev の DB に残った確認用のプロジェクト**: `(Phase 70 確認用 …)` の複製が5つある(`appendix/stage8-effect/state.json` の `p70-*`)。記録を見返すのに使う。
- **セッションの区切りの記録**: Phase 70 は1セッションで行った(計画モードで調査(調査エージェント2つ)→ 質問1回(4問)→ 計画の承認 → 70-1〜70-3 の実装 → 実 Gemini の確かめ(途中で本体を2つ直した)→ samples → docs → 教材)。

この Phase で解決したもの:

- **カードで選ぶと観点の要約が置き換わる**(Phase 59 から): [70-1](./Phase-70-1.md)。
- **値のカードが論点の一部しか値にしない**(Phase 59 から): [70-1](./Phase-70-1.md)(値の欠けた答えの扱いは上の「生まれたもの」)。
- **要件ごとのテストの書き方が浅い**(Phase 59 から): [70-2](./Phase-70-2.md)。
- **変更のきっかけを列挙する再生成の設計**(Phase 59 から): [70-3](./Phase-70-3.md)。
- **61-3 の Phase 70 の未確定事項**(4件の直し方・効果の確かめ方): 着手時の相談。

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

設問は Phase の要点の要約(回答は求めない)。

1. 聞き直している観点へのカードの答えだけを、コードで記録せず判定の LLM に回したのはなぜか。ふつうの問いのカードは、なぜ今までどおりでよいか。
2. 聞き直しで要約を残すだけでは足りず、`merge_judgement` でも前の要約を補ったのはなぜか。
3. 判定がカードの選択を `decided` と書いたのを、プロンプトでなくコードで直したのはなぜか。
4. 未認証のテストの義務を、パスに `{id}` を持つ API にだけ足したのはなぜか。
5. 再生成のきっかけを「並べない」でなく「節の分け方から作る」にしたのはなぜか。テストは何を突き合わせるか。

## 次のフェーズ

**Phase 71**: 設計の検証(手順書のマイルストーンのゴールと単位の食い違い(PR-7)・DFD のデータストアの書き漏れ(CRUD 図との逆向きの照合)・画面の文の変更の波及を絞る)。着手時に自動実装モード(#21)と [61-3](../Phase-61/Phase-61-3.md) の未確定事項(3件それぞれの直し方・重要度・効果の確かめ方)を決める。
