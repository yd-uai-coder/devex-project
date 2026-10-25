# Phase 104 導入: 共有リンク API(コメントと合意・却下)(ステージ13)

## 目的

ステージ13(説明とすり合わせ)の4つ目の実装 Phase。[100-4](../Phase-100/Phase-100-4.md) の Phase 104 にあたる。

Phase 103 で、クライアントは共有リンクでログインせずに説明書を読めるようになった。ただ、質問も判断も、今は開発者に別の手段で伝えるしかない。この Phase では、クライアントが名前を書いてコメント・合意 / 却下をし、合意・却下はそのまま CR の判断になり(相手 = 書いた名前・出どころ = 共有リンク・見た説明書の版)、開発者はコメントに返信できるようにする(決定3・5。[100-1](../Phase-100/Phase-100-1.md))。

- コメント欄の並べ方・返信できるコメント・書き込みを受ける条件・却下の理由を純粋関数で作る ── [104-1](./Phase-104-1.md)
- コメントを保存し、クライアントが共有リンクからコメントし、開発者が返信できるようにする ── [104-2](./Phase-104-2.md)
- クライアントが共有リンクから合意・却下し、CR の判断にする(開発者の判断と同じ規則) ── [104-3](./Phase-104-3.md)

開発者の画面は Phase 107、クライアントの画面は 108。

## パイプライン上の位置づけ・前提

```
クライアント ── POST /share/{token}/comments ・ /decision(ログインなし)
                 │ ShareRateLimiter.enforce_write(IP ごと。閲覧と別に数える)──[104-2]
                 │ _resolve: 404 / 410(閲覧と共有)──[104-2]
                 │ _require_writable: write_problem ──[104-1]
                 │   open でない → 409 SHARE_LINK_NOT_WRITABLE
                 │   見た版 ≠ 今の版 → 409 SHARE_EXPLANATION_CHANGED
                 ├─ コメント → 表㉔ + 記録だけの comment の行 ──[104-2]
                 └─ 判断 → share_decision_reason(却下は理由が要る)──[104-1]
                          → ChangeRequestService.record_decision ──[104-3]
                             (開発者の decide と同じ規則。相手 = 名前・出どころ share_link・指紋)
開発者 ── GET .../comments ・ POST .../comments/{id}/replies(返信は1段)──[104-2]
       └─ POST .../decision → record_decision(出どころ developer・今の説明書の指紋)──[104-3]
先に押した方で決まる: 後の側は 409(リンクは decided / 開発者は状態の表)
```

- **前提として読むもの**: [100-1](../Phase-100/Phase-100-1.md)(決定3・5)・[100-4](../Phase-100/Phase-100-4.md)(Phase 104 の未確定事項)・[Phase 103](../Phase-103/Phase-103-introduction.md)(リンクの状態・公開の入口・説明書の写し)・[Phase 102](../Phase-102/Phase-102-introduction.md)(合意で案を選ぶ規則)。
- **今の仕組み**:
  - リンクの状態は `share_state` で読むときに決める(`open` = 説明済み、`paused` = 下書き、`decided` = 判断の後)。公開の入口は `ShareRateLimiter` が IP で数える。
  - CR の合意・却下は `ChangeRequestService.decide` が、案の選び方(`chosen_option`)・選んだ案の対象・予測の保存・合意の記録(相手・日時・メモ・理由・記録した人)をまとめて行う。理由は必須(`AgreementNotes`)。
  - 説明書の `fingerprint` は md の sha256。閲覧の応答に出している(見た版)。
- **この Phase を始めた時点の状態**: 外側のリポジトリは `f6de808`(Phase 103 までコミット済み)。devex-api は `stage11-15` ブランチの `8fa2655`(Phase 103。タグ `phase-101`〜`phase-103` はまだ無い)、devex-ui は `main` の `511c5e6`(`tableStyles.ts` だけ未コミット。ユーザーの編集)。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(本体 + samples)。この Phase で変えるのは devex-api だけ。

E2E: この Phase では流さない。ステージ13 の E2E は Phase 110 で既存を含めて全部流す(#36)。既存の API の応答は、項目を足したほか(閲覧の `comments`・判断の結果と CR の詳細の出どころ・指紋)は変えていない。開発者の合意・却下の時系列の行とたどる記録は今までと同じ形である。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 104 開始時」を参照する。計画モードで1回(4問)聞いた。

| # | 問い | 決定 |
|---|---|---|
| 1 | 自動実装モード | on(推奨どおり) |
| 2 | コメントの単位と返信の形 | CR 全体に1本のコメント欄。開発者がクライアントのコメントに返信する(1段)。各コメントに見た説明書の指紋を残し、リンクを作り直しても CR に残る(推奨どおり) |
| 3 | リンクからの合意と開発者の合意の関係 | 先に押した方で決まる。出どころ(共有リンク / 開発者)と指紋を残す。後の側は押せない。判断を直す仕組みは作らない(推奨どおり) |
| 4 | 却下の理由を必須にするか | リンクからは却下だけ必須。合意は任意(空なら記録の理由は「共有リンクで合意」)。名前は両方で必須(推奨どおり) |

Claude の判断(計画の承認で確定、または実装中):

- 書き込みは `open` のリンクだけ。開いていても、クライアントが送った見た版(`fingerprint`)が今の説明書の版と違えば 409 `SHARE_EXPLANATION_CHANGED`(開いた後に開発者が直して説明し直したとき)。コメントも判断も同じ。
- 開発者の判断にも、出どころ `developer` と判断したときの説明書の指紋を残す(記録の形をそろえる)。既存の判断済みの行は NULL のまま。
- `decide` の中身を `record_decision`(commit しない)に切り出し、共有リンクの判断も同じ規則を通す。共有リンクの判断の日時はサーバーの今、記録した人は NULL、時系列の行の `refs` に `{source, fingerprint, link_id}`。
- コメント・返信は状態を変えない記録だけの行(`comment`・`reply_comment`)。本文は時系列に写さない。
- 公開の書き込みは閲覧と別の上限(IP ごとに1時間20回。`SHARE_WRITE_RATE_LIMIT_PER_IP_PER_HOUR`)。開発用の compose にも1000回を足した(#21 の共通。インフラなので samples にミラーしない)。
- 閲覧の応答に `comments` を足す(説明書を見せる状態だけ)。開発者の返信の書き手は「開発者」と出し、利用者の名前・ID は出さない。
- 開発者の返信は CR の状態によらずできる(判断の後に届いた質問にも答えるため)。コメントの削除・編集は作らない(画面確認で要るかを決める)。
- 本文は 1〜2000字、名前は 1〜200字(合意の記録の相手と同じ)、指紋は sha256 の形。
- 書き手の種類は `author_kind` の列で持つ(`author_id` の有無で決めると、利用者を消したときに返信がクライアントのコメントに見える)。
- 公開の入口のリンクの解決を `ShareLinkService._resolve` に切り出し、閲覧・コメント・判断で共有した(閲覧の動作は同じ)。
- 実装中: たどる記録の合意・却下の行の出どころは、共有リンクのときだけ出す(最初は開発者の判断にも「開発者が記録」と出し、既存のテストが2件落ちて読みにくさに気づいた)。
- テンプレートから取り込むものは無い。

推奨と違った選択は0件。計画の差し戻しは無し。#39 の材料。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-104-1.md`](./Phase-104-1.md) | コメント欄と共有リンクの判断の規則(純粋関数) | あり(本体 3 + テスト 2。新規 2) | なし |
| [`Phase-104-2.md`](./Phase-104-2.md) | コメントの保存・公開のコメント・開発者の返信 | あり(本体 13 + テスト 2。新規 3) | 104-1 |
| [`Phase-104-3.md`](./Phase-104-3.md) | 共有リンクからの合意・却下 | あり(本体 11 + テスト 3。新規 1) | 104-1・104-2 |

## サンプルコード一覧

すべて `textbook/samples/backend/`。

- 104-1: `app/change_requests/comments.py`・`tests/unit/test_change_request_comments.py`(新規)、`app/change_requests/sharing.py`・`__init__.py`・`tests/unit/test_change_request_sharing.py`(更新)。
- 104-2: `alembic/versions/d7e1f3a5b802_add_change_request_comments.py`・`app/models/change_request_comment.py`・`app/repositories/change_request_comment.py`(新規)、`app/models/__init__.py`・`app/change_requests/states.py`・`trace.py`・`app/services/errors.py`・`app/core/config.py`・`app/services/share_rate_limit.py`・`app/schemas/share_link.py`・`app/services/share_link_service.py`・`app/api/routes/share.py`・`change_requests.py`、`tests/unit/test_share_link_service.py`・`test_share_api.py`(更新)。
- 104-3: `alembic/versions/e8f2a4b6c913_add_change_request_decision_source.py`(新規)、`app/models/change_request.py`・`app/change_requests/sharing.py`・`__init__.py`・`trace.py`・`app/services/errors.py`・`app/schemas/change_request.py`・`app/services/change_request_service.py`・`app/schemas/share_link.py`・`app/services/share_link_service.py`・`app/api/routes/share.py`、`tests/unit/test_share_link_service.py`・`test_share_api.py`・`tests/integration/test_change_requests_flow.py`(更新)。
- ミラーしないもの(#21 の共通): `devex-api/docker-compose.yml`(開発用の上限)。あわせて `devex-api/CLAUDE.md` のレート制限の節に、書き込みの上限の1文を足した。
- 更新したファイルは `tagmerge.py` で当てた。複数の章が触るファイル(`sharing.py`・`__init__.py`・`trace.py`・`errors.py`・`schemas/share_link.py`・`share_link_service.py`・`routes/share.py`・テスト2本)は、主な章を既定にして当て、後の章の分のタグ・import の追記の行を手で分けた。docstring の記録の行(12ファイル)は道具の案のとおり手で書いた。
- `share_link_service.py` の `view` と `change_request_service.py` の `decide` は、差分の対応がずれて読みにくくなったので、手で組み直した(移した旧コードを `：更新` でコメントアウトし、移した先の `_resolve`・`record_decision` は `:追記`)。本体のテストの、ルートの登録の確かめの並びを samples に合わせて入れ替えた(動作は同じ)。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 作成・更新するファイル | 責務(1行) | テスト観点 |
|---|---|---|---|
| 104-1 | `comments.py` | コメント欄の並べ方と返信できるコメント | 古い順・返信を親の下に・返信への返信は不可 |
| 104-1 | `sharing.py`・`__init__.py` | 書き込みを受ける条件・却下の理由・出どころの名前 | open だけ・版の違い・却下の理由 |
| 104-2 | マイグレーション・モデル・リポジトリ | 表㉔(書き手の種類・名前・親・リンク・見た版) | (サービスのテストと統合テストが通す) |
| 104-2 | `states.py`・`trace.py`・`errors.py` | 記録だけの操作と名前、4つのエラー | 時系列の行の名前・409 と 404 |
| 104-2 | `config.py`・`share_rate_limit.py` | 書き込みの上限(閲覧と別) | 別に数える・429 |
| 104-2 | `share_link_service.py`・`schemas/share_link.py`・ルート2本 | リンクの解決の共有・コメント・一覧・返信・閲覧のコメント欄 | 直している・古い版・取り消し・返信の規則・作り直しても残る・利用者の ID を出さない |
| 104-3 | マイグレーション・`models/change_request.py` | ⑯の出どころ・指紋 | (サービスのテストが通す) |
| 104-3 | `change_request_service.py`・`schemas/change_request.py`・`trace.py` | `record_decision` の切り出しと、出どころ・指紋の記録と表示 | 開発者の判断の出どころ・指紋、たどる記録のメモ |
| 104-3 | `share_link_service.py`・`schemas/share_link.py`・`routes/share.py`・`errors.py` | 共有リンクの判断 | 理由・古い版・先に押した方・案の規則・統合の流れ |

## 写経順序(#23)

章番号順。各章の「作成・更新したファイル」表は依存順に並べた(#30)。

実 import 監査(#15)として、各ファイルの全 import 文を読んだ。import 先のモジュールとシンボルの誕生章が、そのファイルの章以下であることを確かめた。

- `comments.py`(104-1)→ 標準ライブラリだけ。
- `sharing.py`(104-1・104-3)→ 標準ライブラリだけ(新しい import は無い)。
- `__init__.py`(104-1・104-3)→ 104-1 で `comments` の6つと `sharing` の 104-1 の名前、104-3 で `decision_source_label`(104-3)。
- `models/change_request_comment.py`(104-2)→ `app.core.database`(既存)。`repositories/change_request_comment.py`(104-2)→ 同じ章のモデル・`base.CRUDRepository`(既存)。
- `trace.py`(104-2・104-3)→ 104-3 で `sharing.decision_source_label`(104-3)。104-2 の分は import を足していない。
- `schemas/share_link.py`(104-2・104-3)→ 104-2 で `Annotated`・`StringConstraints`・`COMMENT_BODY_MAX`・`DEVELOPER_LABEL`・`CommentFacts`・`CommentThread`(104-1)・`COUNTERPART_MAX`(既存)。104-3 で `decision_source_label`(104-3)・`REASON_MAX`(既存)。
- `share_link_service.py`(104-2・104-3)→ 104-2 で `CommentFacts`・`CommentThread`・`can_reply`・`comment_threads`・`write_problem`(104-1)・モデル・リポジトリ・`ChangeRequestReplyCreate`・`SharedCommentCreate`・4つのエラー(104-2)。104-3 で `share_decision_reason`(104-1)・`ChangeRequestDecision`(既存)・`SharedDecisionCreate`・`ShareDecisionReasonRequiredError`(104-3)。`record_decision`(104-3)は 104-3 の `decide` だけが呼ぶ。
- `change_request_service.py`(104-3)→ `DecisionSource`(104-1)。`schemas/change_request.py`(104-3)→ `decision_source_label`(104-3)。
- `routes/share.py`(104-2・104-3)→ 104-2 で `status`・`SharedCommentCreate`・`SharedCommentRead`、104-3 で `SharedDecisionCreate`。`routes/change_requests.py`(104-2)→ `ChangeRequestCommentRead`・`ChangeRequestReplyCreate`(104-2)。
- `share_rate_limit.py`(104-2)→ `settings`(104-2 で項目を足した)。
- テスト: `test_share_link_service.py`・`test_share_api.py` の 104-2 の分は 104-3 の名前(`SharedDecisionCreate`・`ShareDecisionReasonRequiredError`・`decide_shared_change_request`・`get_change_request` など)を import しない(import の追記の行を章ごとに分けた)。統合テストは 104-3 で `ChangeRequestComment`(104-2)を import する。

各章のテストは、その章で作成・更新した全ファイルを少なくとも1度 import する(#15)。104-2 のモデルの登録・`states.py`・`trace.py`・`errors.py`・`config.py` は、サービスのテストが `app.models`・`app.change_requests`(`ACTION_LABEL`)・`app.services.errors`・`settings` を通して import する。104-3 の `models/change_request.py`・`schemas/change_request.py`・`trace.py` は、サービスのテスト(列・たどる記録)とルートのテスト(`get_change_request`)が通す。マイグレーションは統合テストの表と同じ形で、開発 DB の往復で確かめた。

## 検証結果

- ユニット: 章ごとに章のテストと CR・共有リンクのテスト(`-k "change_request or share"`)を流した。
- devex-api: `ruff check`(app・tests): 通った。`pyright`(触ったファイル): 0 件。`ruff format` は使っていない(import の並びだけ `ruff check --select I --fix`)。
- 全体テスト: devex-api はユニット 1857 件・統合 42 件(専用のテスト DB)がすべて通った。devex-ui は変えていない。
- マイグレーション: 開発 DB で heads が1つ・ID が重ならないことを確かめ、`e8f2a4b6c913` まで upgrade → `c5d8e2f4a613` へ downgrade(2本)→ upgrade した。
- 開発 DB(読み取りだけ): Phase 103 のコード(`8fa2655`。一時的な worktree)とこの Phase のコードで、開発 DB の詳細設計モードのすべての CR(18件)の説明書の出力の sha256 を比べ、すべて同じだった(説明書は変わらず、要約は古くならない)。
- `textbook/tools/samples_check.py --api-since 8fa2655 --ui-since phase-99`: 不一致 0・本体のみ 0(一致 1022 / 並び順のみ差 8 / 例外 5)。devex-api にタグ `phase-103` が無いので、Phase 103 のコミットを渡した。
- `textbook/tools/link_check.py`: リンク切れ 0 件。
- 実 LLM: 使っていない(費用 0)。
- E2E: 流していない(Phase 110 で全部流す)。backend のコンテナは、開発用の上限を足したので作り直した。

## 未消化の申し送り(#37)

[Phase 103](../Phase-103/Phase-103-introduction.md#未消化の申し送り37) から引き継いだもの。

**ステージ13 の中で扱うもの**(行き先は [100-4](../Phase-100/Phase-100-4.md)):
- **規模・要約・選択肢・共有リンクの画面**(P101・P102・P103・この Phase)→ Phase 107。P101〜P103 の分はそのまま。この Phase の分: CR の詳細のコメント欄(クライアントのコメントと返信・見た版が今の版と違うときの印・返信の入力)、判断の記録の出どころ(`source_label`)、たどる記録の `comment`・`reply_comment` の行と「出どころ: 共有リンク」。`CR_COMMENT_NOT_FOUND`・`CR_COMMENT_NOT_REPLIABLE` のエラーの文。
- **クライアントの画面**(P103・この Phase)→ Phase 108。P103 の分はそのまま。この Phase の分: コメントの入力(名前・本文)と一覧(返信の書き手は「開発者」)、案の選択と合意 / 却下のフォーム(名前・却下の理由は必須・合意の理由は任意)、送るときの見た版(閲覧の `fingerprint`)、409 の `SHARE_LINK_NOT_WRITABLE`(今は受け付けていない)・`SHARE_EXPLANATION_CHANGED`(読み直す)、422 の `SHARE_DECISION_REASON_REQUIRED`・`CR_OPTION_INVALID` の文、判断の後の応答をそのまま「判断済み」として出す。名前を2回目から入れ直さずに済むか(ブラウザに覚えるか)は画面で決める。
- **コメントの削除・編集**(この Phase で生まれたもの)→ Phase 107〜109 の画面確認で、要るかを決める。
- **CR で書き換えた行の確認事項の状態**(P99)→ Phase 106・109。確認事項を未確認に戻すとき、クライアントが共有リンクで合意した案の文なら確認済みのままにするか(100-4 の Phase 106)は、この Phase の `decision_source` で判定できる。
- **外部連携のサービス名の言い換えで残る重複**(P99)→ Phase 105。
- **名称を言い換える偽の LLM**(振り返り 17.6)→ Phase 105。
- **段階2・3・7 の処理 ID の参照の切れ**(P99)→ Phase 106・109。
- **推測の利用者のキーが名前**(P94)→ Phase 105。
- **起点に選べる要素の種類**(P96)・**束の一覧の入れた CR**(P88)・**巡回で消えた版の戻しの履歴**(P95)・**生成で作り直したまま DFD・データ辞書だけを直した承認**(P99)→ Phase 106・109。
- **束の段階が古いと、予測が少なく出る**(P100)→ 束を作り直すかは開発者の運用で、Phase 110 の新しい CR の前に決める(残す)。
- **Phase 110 の新しい CR の題材**: 選択肢が自然に2つ以上ある変更(100-4)。下書きを実 LLM で作るなら、費用の見積もりを計画に出す。E2E に共有リンクの流れの spec を足す(閲覧・コメント・合意。認証なしの入口は、開発用の上限1000回の中で流す)。

**ステージ13 の範囲の外**:
- **使い勝手(主に UI)の見直し**: ステージ13 の後に回す。
- **本番への反映と本番での確認**: ステージ15 の完了時に、[`OPERATIONS.md`](../../devex-api/OPERATIONS.md) 10.8節で行う。マイグレーション `a7c3e5d91f20`(P102)・`c5d8e2f4a613`(P103)と、この Phase の `d7e1f3a5b802`(表1つを足す)・`e8f2a4b6c913`(⑯に NULL 可の2列を足す。既存の行は触らない)を 10.8節に入れる(Phase 110)。Phase 101 の説明書の md の変化で、以前の要約がすべて「古い」になることも 10.8節に書く(Phase 110)。本番の `.env` では `SHARE_RATE_LIMIT_PER_IP_PER_HOUR`・`SHARE_WRITE_RATE_LIMIT_PER_IP_PER_HOUR` を置かず、既定の60回・20回を使う(10.8節に1行)。
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
- `tagmerge.py` の、複数の章が触るファイルの章の振り分け(振り返り 17.7)。この Phase では9ファイルで後の章の分を手で分けた。加えて、メソッドの中身を別のメソッドへ移す変更(`view` → `_resolve`、`decide` → `record_decision`)は、差分の対応がずれて旧コードのコメントアウトが移した先の途中に入り、読めない形になった(2ファイルを手で組み直した)。振り返りで、移す変更の扱いを道具に足すかを決める。

**ユーザーが決めるもの**:
- **開発環境の後始末**: 確認用の利用者・プロジェクト。「トレンド追跡アプリ」は Phase 110 の効果測定の題材なので残す(この Phase では読むだけ)。
- **この Phase の未コミット**: 外側のリポジトリ(教材・docs・samples・q_a)・devex-api(開発 DB はマイグレーション済み)。devex-ui の `tableStyles.ts`(始める前から)。devex-api のタグ `phase-101`〜`phase-104` も未作成。コミットはユーザーが行う(#35)。

**この Phase で解決したもの**:
- **共有リンクで案を選ぶ・コメント・合意 / 却下**(P102・P103・100-4)→ [104-1](./Phase-104-1.md)〜[104-3](./Phase-104-3.md)。画面は 107・108。
- Phase 104 の未確定事項(100-4)→ 「着手時の相談で決めたこと」。

**この Phase で生まれたもの**:
- 上の「クライアントの画面」「CR の画面」の分と、コメントの削除・編集の要否。
- **セッションの区切りの記録**: Phase 104 は1セッションで行った。
  1. 計画モードで調査(エージェントは使わず直接読んだ)・質問1回(4問)・計画の承認
  2. 104-1 の実装とテスト
  3. 104-2 の実装とテスト
  4. 104-3 の実装とテスト(たどる記録の出どころを、既存のテストが落ちて共有リンクのときだけに直した)
  5. マイグレーションの往復・全体テスト(devex-api のユニット・統合)・pyright・開発 DB の確かめ(説明書の sha256)
  6. samples(`tagmerge.py` と、章の振り分け・移した中身の組み直しは手で)
  7. docs・教材

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

設問は Phase の要点の要約である(回答は求めない)。

1. 書き込みを `open` のリンクだけで受けても、見た版の指紋をさらに比べるのはなぜか。どんな手順で、状態は `open` なのに中身が違う、が起きるか。
2. 共有リンクの判断のために新しい仕組みを足さず、「先に押した方で決まる」が今の状態の表だけで成り立つのはなぜか。
3. `decide` の中身を `record_decision` に切り出したとき、開発者の入口と共有リンクの入口で同じになったもの・違うまま残したもの(日時・記録した人・指紋)は何か。
4. コメントを共有リンクでなく CR に付けたのはなぜか。書き手の種類を `author_id` の有無で決めなかったのはなぜか。
5. 書き込みの回数を閲覧と別に数えるのはなぜか。

## 次のフェーズ

**Phase 105**: 名称を言い換える偽の LLM と、名前の揺れの直し(外部連携の重複・推測の利用者のキー)。着手時に、[100-4](../Phase-100/Phase-100-4.md) の Phase 105 の未確定事項(言い換えのモードの決め方〈偽の LLM の引数か、環境変数か〉と言い換えの規則・推測の利用者のキーの形と今の確認事項の記録〈`user:<名前>`〉の移行・外部連携の重複の判定)を決める。
