# Phase 103 導入: 共有リンク API(閲覧)(ステージ13)

## 目的

ステージ13(説明とすり合わせ)の3つ目の実装 Phase。[100-4](../Phase-100/Phase-100-4.md) の Phase 103 にあたる。

Phase 101(規模)と 102(選択肢)で、説明書の中身はそろった。ただ、クライアントは今も開発者から md を受け取って読むしかない。この Phase では、開発者が CR ごとに共有リンクを作り、クライアントがアカウントを作らずにその URL で説明書を読めるようにする(決定3・5。[100-1](../Phase-100/Phase-100-1.md))。

- 共有リンクの規則(トークン・期限・リンクの状態・前回から変わった点)を純粋関数で作る ── [103-1](./Phase-103-1.md)
- リンクを保存し、開発者が作成・一覧・取り消し・延長できるようにする。作ると CR は説明済みになり、説明済みにするたびに説明書を写す ── [103-2](./Phase-103-2.md)
- ログインの要らない閲覧の入口を作る(回数の上限・状態ごとの見せ方・前回から変わった点) ── [103-3](./Phase-103-3.md)

書き込み(コメント・案の選択・合意 / 却下)は Phase 104、開発者の画面は 107、クライアントの画面は 108。

## パイプライン上の位置づけ・前提

```
開発者 ── POST share-links ──▶ ShareLinkService.create ──[103-2]
                                 │ 下書き → record_explain(説明済み + 説明書の md・指紋を explain の行に写す)
                                 │ 説明済み → 記録だけの share の行
                                 │ 有効なリンクがあれば取り消す(CR に1本)
                                 ▼
                        表㉓(token の sha256・期限・取り消し・最後に見られた日時)
                                 │ トークンは応答で1度だけ
                                 ▼
クライアント ── GET /share/{token}(ログインなし)──[103-3]
                 │ ShareRateLimiter(IP ごと。引く前に数える)
                 │ get_by_hash → 404 / share_state ──[103-1]── revoked・expired → 410
                 ▼
     open: 説明書(Phase 101・102 の形)・案・指紋 + 前回から変わった節(explanation_changes)
     paused / closed: 状態と題だけ    decided: 説明書 + 判断の結果
```

- **前提として読むもの**: [100-1](../Phase-100/Phase-100-1.md)(決定3・5)・[100-4](../Phase-100/Phase-100-4.md)(Phase 103 の未確定事項)・[Phase 102](../Phase-102/Phase-102-introduction.md)(選択肢と説明書の6節)・[Phase 84](../Phase-84/Phase-84-introduction.md)(説明書と要約の指紋)。
- **今の仕組み**:
  - CR の状態は `states.py` の表で遷移し、遷移ごとに時系列に1行残す。説明済み(`explain`)は下書きからだけ、直すと説明済みは下書きに戻る。
  - 説明書は決定的に組み立て、`fingerprint` は md の sha256。説明書の頭に「CR の状態」の行がある。
  - 認証前の入口は `AuthRateLimiter` が IP で数える。開発用の compose で上限を1000回に上げている。
- **この Phase を始めた時点の状態**: 外側のリポジトリは `d89f376`(Phase 102 までコミット済み)。devex-api は `stage11-15` ブランチの `335e921`(Phase 102。タグ `phase-101`・`phase-102` はまだ無い)、devex-ui は `main` の `511c5e6`(`tableStyles.ts` だけ未コミット。ユーザーの編集)。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(本体 + samples)。この Phase で変えるのは devex-api だけ。

E2E: この Phase では流さない。ステージ13 の E2E は Phase 110 で既存を含めて全部流す(#36)。既存の画面と API の応答は、時系列の行の `refs` から説明書の写しを落とすほかは変えていない(説明の行の `refs` は今まで null だった)。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 103 開始時」を参照する。計画モードで1回(4問)聞いた。

| # | 問い | 決定 |
|---|---|---|
| 1 | 自動実装モード | on(推奨どおり) |
| 2 | CR ごとのリンクの数とトークンの持ち方 | CR に有効なリンクは1本。トークンは `secrets.token_urlsafe(32)` で sha256 だけを保存し、作成の応答で1度だけ返す。作り直すと前のリンクは取り消す(行は残す)。下書きに戻っても取り消さず、CR の状態から「止まっている」を導く(推奨どおり) |
| 3 | 期限・応答の区別・回数の上限 | 作成時に 1〜90日(既定14日)、延長あり(今から N 日。取り消したリンクは不可)。存在しない 404、期限切れ・取り消し 410(コードで区別)。IP ごとに1時間60回(推奨どおり) |
| 4 | 前回から変わった点の材料 | 説明済みにするたびに説明書の md と指紋を時系列の行に写し、前回の写しと今の md を節ごとに比べる(推奨どおり) |

Claude の判断(計画の承認で確定、または実装中):

- `last_viewed_at` を持つ(開発者がクライアントが開いたかを知れる)。閲覧の回数は持たない。
- 説明書の md そのものは変えない(`explanation.py` を触らない)ので、要約は古くならない。
- 写すのは状態を変えた後の説明書(頭の「CR の状態: 説明済み」をそろえるため)。写しは時系列の `explain` の行の `refs` に置き、CR の詳細の応答では md を落として指紋だけを出す。
- 説明済みの CR への作成・取り消し・延長は、状態を変えない記録だけの行(`share`・`unshare`・`extend_share`)。取り消しは2度押しても1度だけ記録する。延長は期限切れのリンクも開き直せる。
- リンクを作れるのは下書き・説明済みだけ(合意・却下の後は 409)。
- 作成の応答の `summary_needs_reconfirm` で、確認済みの要約が古いことを知らせる(作成は止めない)。
- 公開の入口は、リンクを引く前に回数を数える。見つからない・使えないリンクも数える。簡易ドキュメントモードと削除したプロジェクトは 404。
- `paused`・`closed` は 200 で状態と題だけを返す(エラーにしない。クライアントの画面が「直しています」を出せるように)。
- 前回から変わった点は `open` のときだけ出す。前回の写しが無ければ出さない(この仕組みより前に説明済みにした行は写しが無い)。
- 応答にプロジェクト・利用者の ID は出さない。判断の相手(`counterpart`)は出す(クライアント自身の名前になるため)。
- 開発用の compose の上限に、公開の入口の上限を足した(#21 の共通。インフラなので samples にミラーしない)。
- 中止の後の再開(下の「セッションの区切り」)で、本体の `sharing.py` の写しの部分を末尾に移した(章のタグを付けやすくするため。動作は同じ)。
- テンプレートから取り込むものは無い。

推奨と違った選択は0件。計画の差し戻しは無し。103-1 の途中でユーザーが一度中止し、ステージ13 を飛ばす影響の検討と完成イメージのサンプルを経て、計画どおり再開した(#38。q_a の「Phase 103 の途中」)。#39 の材料。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-103-1.md`](./Phase-103-1.md) | 共有リンクの規則(純粋関数) | あり(本体 2 + テスト 1。新規 2) | なし |
| [`Phase-103-2.md`](./Phase-103-2.md) | リンクの保存と開発者の API | あり(本体 15 + テスト 3。新規 7) | 103-1 |
| [`Phase-103-3.md`](./Phase-103-3.md) | 公開の閲覧 API | あり(本体 6 + テスト 3。新規 2) | 103-1・103-2 |

## サンプルコード一覧

すべて `textbook/samples/backend/`。

- 103-1: `app/change_requests/sharing.py`・`tests/unit/test_change_request_sharing.py`(新規)、`app/change_requests/__init__.py`(更新)。
- 103-2: `alembic/versions/c5d8e2f4a613_add_change_request_share_links.py`・`app/models/change_request_share_link.py`・`app/repositories/change_request_share_link.py`・`app/schemas/share_link.py`・`app/services/share_link_service.py`・`tests/unit/test_share_link_service.py`・`tests/unit/test_share_api.py`(新規)、`app/change_requests/sharing.py`・`__init__.py`・`states.py`・`trace.py`・`app/core/errors.py`・`app/models/__init__.py`・`app/services/errors.py`・`app/schemas/change_request.py`・`app/services/change_request_service.py`・`app/api/routes/change_requests.py`、`tests/unit/test_change_request_sharing.py`(更新)。
- 103-3: `app/services/share_rate_limit.py`・`app/api/routes/share.py`(新規)、`app/core/config.py`・`app/services/share_link_service.py`・`app/schemas/share_link.py`・`app/api/routes/__init__.py`、`tests/unit/test_share_link_service.py`・`test_share_api.py`・`tests/integration/test_change_requests_flow.py`(更新)。
- ミラーしないもの(#21 の共通): `devex-api/docker-compose.yml`(開発用の上限)。あわせて `devex-api/CLAUDE.md` のレート制限の節に、公開の入口の1行を足した。
- 更新したファイルは `tagmerge.py` で当てた。`__init__.py` は 103-1 を既定にして当て、import の追記の行と `__all__` の 103-2 の分を手で分けた(`__all__` の共有リンクの名前は samples では末尾に置いた。`__all__` の並びは `samples_check.py` が見ない)。docstring の記録の行(5ファイル)は道具の案のとおり手で書いた。複数の章で完成させた新規ファイル(`sharing.py`・`share_link_service.py`・`share_link.py`・テスト3本)は、後の章の分に `追記` のタグを付け、前の章の分へ戻る境界に再タグを付けた(#12)。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 作成・更新するファイル | 責務(1行) | テスト観点 |
|---|---|---|---|
| 103-1 | `sharing.py` | トークン・ハッシュ・期限・リンクの状態・説明書の節ごとの差分 | トークンの形・状態の優先・番号の送りに強い差分 |
| 103-1 | `__init__.py` | 共有リンクの名前を re-export | (各テストが import する) |
| 103-2 | マイグレーション・モデル・リポジトリ | 表㉓(ハッシュ・期限・取り消し・最後に見られた日時) | (サービスのテストと統合テストが通す) |
| 103-2 | `core/errors.py`・`services/errors.py` | 410 の基底と、共有リンクの4つのエラー | 410 と 404 の区別 |
| 103-2 | `sharing.py`(写し)・`change_request_service.py`・`schemas/change_request.py` | 説明済みにするたびに説明書を写す。応答では md を落とす | 写しの中身(説明済みの頭)・説明の API でも写す・応答に指紋だけ |
| 103-2 | `states.py`・`trace.py` | 記録だけの操作と、たどる記録の名前 | たどる記録の行の名前 |
| 103-2 | `share_link_service.py`・`schemas/share_link.py`・ルート | 作成(説明済みにする・作り直し)・一覧・取り消し・延長 | 合意の後は 409・作り直し・2度の取り消し・取り消した後の延長 |
| 103-3 | `config.py`・`share_rate_limit.py` | 公開の入口の回数の上限 | IP ごと・引く前に数える |
| 103-3 | `share_link_service.py`(view)・`schemas/share_link.py`・`routes/share.py`・`routes/__init__.py` | ログインの要らない閲覧と、状態ごとの見せ方 | 404/410・paused で中身なし・変わった節・判断の結果・認証なし |

## 写経順序(#23)

章番号順。各章の「作成・更新したファイル」表は依存順に並べた(#30)。

実 import 監査(#15)として、各ファイルの全 import 文を読んだ。import 先のモジュールとシンボルの誕生章が、そのファイルの章以下であることを確かめた。

- `sharing.py`(103-1・103-2)→ 標準ライブラリだけ。103-2 で `collections.abc.Iterable`・`Mapping`・`typing.Any` を足した。
- `__init__.py`(103-1・103-2)→ 103-1 で `sharing` の 103-1 の名前、103-2 で写しの名前(`SNAPSHOT_MARKDOWN_KEY`・`ExplainedSnapshot`・`explained_snapshots`・`previous_snapshot`・`snapshot_refs`)。
- `models/change_request_share_link.py`(103-2)→ `app.core.database`(既存)。`repositories/change_request_share_link.py`(103-2)→ 同じ章のモデル・`base.CRUDRepository`(既存)。
- `services/errors.py`(103-2)→ `core.errors.GoneError`(103-2)。
- `change_request_service.py`(103-2)→ `snapshot_refs`(103-2)・`ChangeRequestEvent`(既存)。`schemas/change_request.py`(103-2)→ `SNAPSHOT_MARKDOWN_KEY`(103-2)。
- `schemas/share_link.py`(103-2・103-3)→ 103-2 で `DEFAULT_EXPIRES_DAYS`・`MAX_EXPIRES_DAYS`・`SHARE_STATE_LABEL`・`ShareState`(103-1)・`aware`(既存)、型だけで `ChangeRequestShareLink`(103-2)・`CreatedShareLink`・`ShareLinkView`(103-2)。103-3 で `typing.Literal`・`STATUS_LABEL`・`option_label`・`options_from_json`(既存)・`SectionChange`(103-1)、型だけで `SharedView`(103-3)。
- `share_link_service.py`(103-2・103-3)→ 103-2 で `expires_at_from`・`new_token`・`share_state`・`token_hash`・`ShareState`(103-1)・`aware`・`next_status`(既存)・リポジトリ・スキーマ・`ChangeRequestService`・`ExplanationView`・エラー(103-2 まで)。103-3 で `READABLE_STATES`・`SectionChange`・`explanation_changes`(103-1)・`explained_snapshots`・`previous_snapshot`(103-2)・`ProjectRepository`(既存)・`ShareLinkExpiredError`・`ShareLinkRevokedError`(103-2)。
- `routes/change_requests.py`(103-2)→ `schemas.share_link` の4つ・`ShareLinkService`(103-2)。
- `share_rate_limit.py`(103-3)→ `settings`(103-3 で項目を足した)・`RateLimiter`(既存)。`routes/share.py`(103-3)→ `ClientIpDep`・`RedisDep`(既存)・`SharedChangeRequestRead`・`ShareLinkService`・`ShareRateLimiter`(103-3 まで)。`routes/__init__.py`(103-3)→ `routes.share`(103-3)。
- テスト: `test_change_request_sharing.py` の 103-2 の分(写しの名前と、そのテスト)は `追記`。`test_share_link_service.py`・`test_share_api.py` は 103-2 で作り、103-3 の分(import の行・閲覧と上限のテスト・公開の入口の登録の確かめ)を `追記` にした。103-2 の分は 103-3 の名前(`ShareRateLimiter`・`get_shared_change_request`・`FakeRedis` など)を import しない。

各章のテストは、その章で作成・更新した全ファイルを少なくとも1度 import する(#15)。103-2 のモデルの登録・`core/errors.py`・`states.py`・`trace.py` は、サービスのテストが `app.models`・`app.change_requests`・`app.services.errors` を通して import する(`ACTION_LABEL` で操作の名前も確かめる)。マイグレーションは統合テストの表と同じ形で、開発 DB の往復で確かめた。103-3 の `config.py` はテストが `settings` を import し、`routes/__init__.py` は `api_router` の登録のテストが import する。

## 検証結果

- ユニット: 章ごとに章のテストと CR のテスト(`-k change_request`)を流した。
- devex-api: `ruff check`(app・tests): 通った。`pyright`(触ったファイル): 0 件。`ruff format` は使っていない(import の並びだけ `ruff check --select I --fix`)。
- 全体テスト: devex-api はユニット 1841 件・統合 41 件(専用のテスト DB)がすべて通った。統合テストで、コミットの後の時系列の遅延読み込みの失敗を1件見つけて直した(103-3 の2節)。devex-ui は変えていない。
- マイグレーション: 開発 DB で heads が1つ・ID が重ならないことを確かめ、`c5d8e2f4a613` を upgrade → downgrade → upgrade した。
- 開発 DB(読み取りだけ): Phase 102 のときに記録した、開発 DB のすべての CR(18件)の説明書の出力の sha256 と比べ、すべて同じだった(説明書は変わらず、要約は古くならない)。
- `textbook/tools/samples_check.py --api-since 335e921 --ui-since phase-99`: 不一致 0・本体のみ 0(一致 1016 / 並び順のみ差 8 / 例外 5)。devex-api にタグ `phase-102` が無いので、Phase 102 のコミットを渡した。
- `textbook/tools/link_check.py`: リンク切れ 0 件。
- 実 LLM: 使っていない(費用 0)。
- E2E: 流していない(Phase 110 で全部流す)。

## 未消化の申し送り(#37)

[Phase 102](../Phase-102/Phase-102-introduction.md#未消化の申し送り37) から引き継いだもの。

**ステージ13 の中で扱うもの**(行き先は [100-4](../Phase-100/Phase-100-4.md)):
- **規模・要約・選択肢・共有リンクの画面**(P101・P102・この Phase)→ Phase 107。P101・P102 の分はそのまま。この Phase の分: CR の詳細に共有リンクの作成(URL を1度だけ見せる・期限の日数)・一覧(状態・期限・最後に見られた日時)・延長・作り直し・取り消し、作成の応答の `summary_needs_reconfirm` の知らせ、たどる記録の `share`・`unshare`・`extend_share` の行。`SHARE_LINK_NOT_FOUND`・`SHARE_LINK_NOT_EXTENDABLE` のエラーの文。
- **クライアントの画面**(この Phase で生まれたもの)→ Phase 108。URL は `/share/<トークン>`(`ShareLinkCreatedRead.path`)。`GET /api/v1/share/{token}` の状態ごとの表示(`open` / `paused` の「直しています」 / `decided` の判断の結果 / `closed`)、410 の `SHARE_LINK_EXPIRED`・`SHARE_LINK_REVOKED` と 404・429 の文、`changes` の「前回から変わった点」。画面の見本は Phase 103 の途中で作った完成イメージ(q_a の「Phase 103 の途中」)。
- **共有リンクで案を選ぶ・コメント・合意 / 却下**(P102・100-4)→ Phase 104。合意は `decide` の `option` と同じ規則を通し、見た版は `SharedChangeRequestRead.fingerprint`。リンクの状態が `open` のときだけ書き込める(`share_state`)。たどる記録にコメントの行。
- **CR で書き換えた行の確認事項の状態**(P99)→ Phase 106・109。
- **外部連携のサービス名の言い換えで残る重複**(P99)→ Phase 105。
- **名称を言い換える偽の LLM**(振り返り 17.6)→ Phase 105。
- **段階2・3・7 の処理 ID の参照の切れ**(P99)→ Phase 106・109。
- **推測の利用者のキーが名前**(P94)→ Phase 105。
- **起点に選べる要素の種類**(P96)・**束の一覧の入れた CR**(P88)・**巡回で消えた版の戻しの履歴**(P95)・**生成で作り直したまま DFD・データ辞書だけを直した承認**(P99)→ Phase 106・109。
- **束の段階が古いと、予測が少なく出る**(P100)→ 束を作り直すかは開発者の運用で、Phase 110 の新しい CR の前に決める(残す)。
- **Phase 110 の新しい CR の題材**: 選択肢が自然に2つ以上ある変更(100-4)。下書きを実 LLM で作るなら、費用の見積もりを計画に出す。E2E に共有リンクの流れの spec を足す(認証なしの閲覧は、開発用の上限1000回の中で流す)。

**ステージ13 の範囲の外**:
- **使い勝手(主に UI)の見直し**: ステージ13 の後に回す。
- **本番への反映と本番での確認**: ステージ15 の完了時に、[`OPERATIONS.md`](../../devex-api/OPERATIONS.md) 10.8節で行う。マイグレーション `a7c3e5d91f20`(P102)と `c5d8e2f4a613`(この Phase。表1つを足すだけ)を 10.8節に入れる(Phase 110)。Phase 101 の説明書の md の変化で、以前の要約がすべて「古い」になることも 10.8節に書く(Phase 110)。本番の `.env` では `SHARE_RATE_LIMIT_PER_IP_PER_HOUR` を置かず、既定の60回を使う(10.8節に1行)。
- **要約・選択肢の下書きの生成の回数の上限**: 使われ方を見て決める。
- 振り返り 6節の残り5件・生成の質の候補4件(Phase 100 と同じ)。

**持ち越し**(触るときに直す。中身は [振り返り](../retrospectives/project-retrospective.md) 8節):
- `test_chat_service.py` などの pyright の指摘(Phase 40)
- devex-ui の並列のテストのタイムアウト(Phase 44)
- 偽 LLM の外部設計書の GET に DF が無い(Phase 45。Phase 105 で直せる)
- `DfdEditorTabs` のテストのまれな失敗(Phase 77)
- Google の公開鍵を毎回取りに行く(Phase 74)
- `ListCard` の入れ物(Phase 79。テンプレートでは直した)
- 英語のままの refresh の失敗の文(Phase 79)
- `streamChat.test.ts` の lint の警告(既存)
- `appendix/measurements/stage11/measure.py` の `ruff check` の指摘(Phase 80 から)
- 反映の後の CR の流れの部品・束の写しの取り出し(#17。触るときに寄せる)
- `tagmerge.py` の、複数の章が触るファイルの章の振り分け(振り返り 17.7)。この Phase では `__init__.py` の import の追記の行と `__all__` を手で分けた。複数の章で完成させる新規ファイルのタグ(後の章の `追記` と、前の章へ戻る再タグ)は道具の対象の外で、6ファイルに手で付けた。

**ユーザーが決めるもの**:
- **開発環境の後始末**: 確認用の利用者・プロジェクト。「トレンド追跡アプリ」は Phase 110 の効果測定の題材なので残す(この Phase では読むだけ)。
- **この Phase の未コミット**: 外側のリポジトリ(教材・docs・samples・q_a)・devex-api(開発 DB はマイグレーション済み)。devex-ui の `tableStyles.ts`(始める前から)。devex-api のタグ `phase-101`・`phase-102` も未作成。コミットはユーザーが行う(#35)。

**この Phase で解決したもの**:
- **共有リンク(閲覧)**(位置付け・決定3・5)→ [103-1](./Phase-103-1.md)〜[103-3](./Phase-103-3.md)。書き込みは Phase 104、画面は 107・108。
- Phase 103 の未確定事項(100-4)→ 「着手時の相談で決めたこと」。

**この Phase で生まれたもの**:
- 上の「クライアントの画面」(Phase 108)と、画面の分(Phase 107)・書き込みの分(Phase 104)。
- **セッションの区切りの記録**: Phase 103 は1セッションで行った。
  1. 計画モードで調査(エージェントは使わず直接読んだ)・質問1回(4問)・計画の承認
  2. 103-1 の途中でユーザーが中止 → ステージ13 を飛ばしてステージ14 へ進む影響の検討(計画モード)→ ステージ13 の完成イメージのサンプル(Artifact)
  3. ユーザーが「ステージ13 は必要」と判断し、再開。103-1 のテスト
  4. 103-2 の実装とテスト(マイグレーションの往復を含む)
  5. 103-3 の実装とテスト(統合テストで遅延読み込みの失敗を見つけて直した)
  6. 開発 DB の確かめ(説明書の sha256)・全体テスト(devex-api のユニット・統合)
  7. samples(`tagmerge.py` と、複数の章の新規ファイルのタグは手で)
  8. docs・教材

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

設問は Phase の要点の要約である(回答は求めない)。

1. トークンを sha256 で保存し、bcrypt のような遅いハッシュを使わなかったのはなぜか。その代わりに何を諦めたか。
2. リンクの状態を列に保存せず、取り消し・期限と CR の状態から読むときに決めるのはなぜか。下書きに戻ったときにリンクを取り消さないことの利点は何か。
3. 説明書の写しを、状態を説明済みにした**後**に取るのはなぜか。節を番号でなく名前で対応づけるのはなぜか。
4. 存在しないリンクを 404、期限切れ・取り消しを 410 に分けたのはなぜか。回数の上限をリンクを引く前に数えるのはなぜか。
5. 直している(`paused`)CR の説明書を見せないのはなぜか。

## 次のフェーズ

**Phase 104**: 共有リンク API(コメントと合意・却下)。着手時に、[100-4](../Phase-100/Phase-100-4.md) の Phase 104 の未確定事項(コメントの単位〈CR 全体か節・案ごとか〉と返信の形・リンクからの合意と開発者の合意の記録の関係〈開発者があとで直せるか。両方が押されたとき〉・却下の理由を必須にするか)を決める。書き込みは `open` のリンクだけで受け、合意は `decide` の `option` と同じ規則を通し、見た版の指紋(`fingerprint`)を合意の記録に残す。
