# Phase-103-3: 公開の閲覧 API

## この章の目的

クライアントがアカウントを作らずに、共有リンクの URL だけで CR の説明書を読めるようにする。ログインの要らない入口 `GET /api/v1/share/{token}` を作り、回数の上限をかけ、リンクの状態に応じて見せるものを変える。直して出し直したときは、前回から変わった節を添える。クライアントの画面は Phase 108、書き込み(コメント・合意・却下)は Phase 104。

自動実装モード: on([introduction](./Phase-103-introduction.md) 参照)。

## この章で作成・更新したファイル

依存順(#30)。

| ファイル | 内容 |
| --- | --- |
| [`backend/app/core/config.py`](../samples/backend/app/core/config.py) | `SHARE_RATE_LIMIT_PER_IP_PER_HOUR`(既定60) |
| [`backend/app/services/share_rate_limit.py`](../samples/backend/app/services/share_rate_limit.py) | 新規。`ShareRateLimiter` |
| [`backend/app/services/share_link_service.py`](../samples/backend/app/services/share_link_service.py) | `view`・`SharedView` |
| [`backend/app/schemas/share_link.py`](../samples/backend/app/schemas/share_link.py) | `SharedChangeRequestRead`・`SharedOptionRead`・`SharedDecisionRead`・`SectionChangeRead` |
| [`backend/app/api/routes/share.py`](../samples/backend/app/api/routes/share.py) | 新規。`GET /share/{token}`(認証なし) |
| [`backend/app/api/routes/__init__.py`](../samples/backend/app/api/routes/__init__.py) | ルーターの登録 |
| [`backend/tests/unit/test_share_link_service.py`](../samples/backend/tests/unit/test_share_link_service.py) | 閲覧と回数の上限のテスト |
| [`backend/tests/unit/test_share_api.py`](../samples/backend/tests/unit/test_share_api.py) | 公開のルートのテスト |
| [`backend/tests/integration/test_change_requests_flow.py`](../samples/backend/tests/integration/test_change_requests_flow.py) | 共有リンクの流れ(実際の PostgreSQL・Redis) |

## 1. 回数の上限 `ShareRateLimiter`

- 認証の入口(`AuthRateLimiter`)と同じく、利用者 id が無いので IP で数える。既定は1時間60回(相談の決定3)。
- ルートで、**リンクを引く前に**数える。見つからない・期限切れのトークンも数えないと、トークンの総当たりを止められない。
- 開発用の compose では1000回に上げた(103-2 のインフラの変更)。

## 2. 閲覧 `ShareLinkService.view`

```python
# app/services/share_link_service.py(抜粋)
async def view(self, token: str) -> SharedView:
    link = await self._links.get_by_hash(token_hash(token))          # 無い → 404
    change_request = await self._change_requests.find_one(id=link.change_request_id)
    project = await ProjectRepository(self._session).find_one(id=..., deleted_at=None)
    if project is None or project.mode != "detailed": raise ShareLinkNotFoundError(...)
    state = self._state(link, change_request)
    if state == "revoked": raise ShareLinkRevokedError(...)            # 410
    if state == "expired": raise ShareLinkExpiredError(...)            # 410
    link.last_viewed_at = datetime.now(UTC)
    if state in READABLE_STATES:
        explanation = await self._service.explanation_of(change_request)
    if state == "open":
        previous = previous_snapshot(explained_snapshots(...))        # 103-2 の写し
        changes = explanation_changes(previous.markdown, explanation.explanation.markdown)
```

- 存在しない(404)と、期限切れ・取り消し(410)をコードで分けた(相談の決定3)。トークンを持つのは開発者から URL を受け取った正当な相手なので、「新しいリンクを頼む」「今のリンクを確かめる」と次にどうするかを伝えたほうがよい。存在しないトークンは手がかりを出さない。
- 簡易ドキュメントモードのプロジェクトと、削除したプロジェクトは 404(外部設計書 2.16「共有リンクの入口も断る」)。
- CR は `find_one` で読む(時系列・束を一緒に読む既定の読み込みが付く)。`get_by_id` は既定の読み込みを付けないので、コミットの後に時系列を遅延読み込みしようとして非同期のセッションで失敗した(統合テストで見つけた)。
- 前回から変わった点は、説明済み(`open`)のときだけ出す。判断の後は、もう判断する場面ではないので出さない。前回は「最後から2つ目の写し」で、写しが1つなら出さない。
- `last_viewed_at` は開発者の一覧(103-2)に出る。クライアントが開いたかを開発者が知れる。

## 3. 応答 `SharedChangeRequestRead`

| 項目 | いつ | 中身 |
| --- | --- | --- |
| `state`・`state_label`・`label`・`title`・`expires_at` | いつも | 状態・`CR-n`・題・期限 |
| `markdown`・`fingerprint` | `open`・`decided` | 出力する説明書(確認済みで古くない要約つき)と、その版の指紋。104 で合意を押すとき「見た版」として送る |
| `options`・`recommended_reason` | `open`・`decided` | 案の番号・呼び名・名前・結果・おすすめ。変える要件と規模は説明書の中にある |
| `changes`・`changed_since` | `open` で前回の写しがあるとき | 変わった節(`name`・`removed`・`added`)と前回の日時 |
| `decision` | 判断の後 | 合意 / 却下・日時・相手・選んだ案 |

- プロジェクト・利用者などの内部の ID は出さない(外部設計書 2.16「見せるのはその CR の説明書・選択肢・規模だけ」)。
- 直している(`paused`)・閉じた(`closed`)ときは、状態と題だけを返す(200)。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
| --- | --- | --- | --- |
| `test_share_link_service.py`(103-3 の分) | `ShareLinkService.view`・`SharedView`・`ShareRateLimiter` | pytest のテスト関数 | SQLite の db_session(永続化が検証対象)。回数の上限は `FakeRedis`(incr / expire / pipeline)── Redis の数え方は既存の `RateLimiter` のテストで確かめてあり、ここでは IP ごとに数えることだけを見る |
| `test_share_api.py`(103-3 の分) | `get_shared_change_request` と応答のスキーマ、api_router への登録 | pytest のテスト関数(ルートの関数を直接呼ぶ) | SQLite の db_session と `FakeRedis` |
| `test_change_requests_flow.py::test_share_link_flow` | HTTP の入口からの一巡(認証なしの GET・410/404 のコード・CASCADE) | httpx の AsyncClient(ASGITransport) | スタブなし ── 実際の PostgreSQL・Redis(統合テスト専用の DB) |

- 開いているリンクで説明書が読め、`last_viewed_at` が残る。
- 直すと `paused` で説明書なし。説明済みに戻すと、変わった節(内容の行の入れ替え)と前回の日時が出る。
- 却下の後は `decided`、取り下げると `closed`。合意で選んだ案は `decision.option` に `案2 名前`。
- 無いトークン 404、期限切れ・取り消し 410(`GoneError`)、簡易モード 404。
- 上限: 同じ IP の3回目で 429、ほかの IP は数えない。取り消したリンクの閲覧も数える。
- 公開の入口には OpenAPI の `security` が付かない(認証の依存を付けていない)。
