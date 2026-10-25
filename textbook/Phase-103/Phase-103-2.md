# Phase-103-2: リンクの保存と開発者の API

## この章の目的

開発者が CR ごとに共有リンクを作り、一覧で見て、取り消し・延長できるようにする。リンクを作ると下書きの CR は説明済みになる(外部設計書 2.16)。あわせて、説明済みにするたびにその時点の説明書を時系列に写し、103-3 の「前回から変わった点」の材料にする。

自動実装モード: on([introduction](./Phase-103-introduction.md) 参照)。

## この章で作成・更新したファイル

依存順(#30)。

| ファイル | 内容 |
| --- | --- |
| [`backend/alembic/versions/c5d8e2f4a613_add_change_request_share_links.py`](../samples/backend/alembic/versions/c5d8e2f4a613_add_change_request_share_links.py) | 新規。表㉓ `change_request_share_links` |
| [`backend/app/models/change_request_share_link.py`](../samples/backend/app/models/change_request_share_link.py) | 新規。`ChangeRequestShareLink` |
| [`backend/app/models/__init__.py`](../samples/backend/app/models/__init__.py) | モデルの登録 |
| [`backend/app/repositories/change_request_share_link.py`](../samples/backend/app/repositories/change_request_share_link.py) | 新規。作成・取り消し・有効なリンク・ハッシュで引く |
| [`backend/app/core/errors.py`](../samples/backend/app/core/errors.py) | `GoneError`(410) |
| [`backend/app/services/errors.py`](../samples/backend/app/services/errors.py) | `ShareLinkNotFoundError`(404)・`ShareLinkExpiredError`・`ShareLinkRevokedError`(410)・`ShareLinkNotExtendableError`(409) |
| [`backend/app/change_requests/sharing.py`](../samples/backend/app/change_requests/sharing.py) | 説明の写し(`snapshot_refs`・`explained_snapshots`・`previous_snapshot`) |
| [`backend/app/change_requests/__init__.py`](../samples/backend/app/change_requests/__init__.py) | 写しの名前を re-export |
| [`backend/app/change_requests/states.py`](../samples/backend/app/change_requests/states.py) | 記録だけの操作 `share`・`unshare`・`extend_share` |
| [`backend/app/change_requests/trace.py`](../samples/backend/app/change_requests/trace.py) | 共有の行の名前 |
| [`backend/app/schemas/change_request.py`](../samples/backend/app/schemas/change_request.py) | 時系列の行の応答から md の写しを落とす |
| [`backend/app/services/change_request_service.py`](../samples/backend/app/services/change_request_service.py) | `record_explain`(説明済みにして写す)・`explanation_of`・`load` |
| [`backend/app/schemas/share_link.py`](../samples/backend/app/schemas/share_link.py) | 新規。`ShareLinkCreate`・`ShareLinkExtend`・`ShareLinkRead`・`ShareLinkCreatedRead` |
| [`backend/app/services/share_link_service.py`](../samples/backend/app/services/share_link_service.py) | 新規。`ShareLinkService`(作成・一覧・取り消し・延長) |
| [`backend/app/api/routes/change_requests.py`](../samples/backend/app/api/routes/change_requests.py) | 4つのルート |
| [`backend/tests/unit/test_change_request_sharing.py`](../samples/backend/tests/unit/test_change_request_sharing.py) | 写しの関数のテスト |
| [`backend/tests/unit/test_share_link_service.py`](../samples/backend/tests/unit/test_share_link_service.py) | 新規。サービスのテスト |
| [`backend/tests/unit/test_share_api.py`](../samples/backend/tests/unit/test_share_api.py) | 新規。ルートのテスト |

インフラの変更(#21 の共通。samples にミラーしない): `devex-api/docker-compose.yml` の開発用の上限に `SHARE_RATE_LIMIT_PER_IP_PER_HOUR: "1000"` を足した(103-3 の上限。統合テスト・E2E で何度も読むため。認証の上限と同じ扱い)。

## 1. 表㉓とリポジトリ

- 列: `token_hash`(一意)・`expires_at`・`revoked_at`/`revoked_by`・`last_viewed_at`・`created_by`/`created_at`。CR が消えると一緒に消える(CASCADE)。
- 状態の列は持たない(103-1 の `share_state`)。
- `active_for(cr_id)` は取り消していないリンク(期限切れも含む)。作り直しで取り消す相手を探すのに使う。`get_by_hash` は公開の入口(103-3)が使う。

## 2. 説明済みにするたびに写す `record_explain`

```python
# app/services/change_request_service.py(抜粋)
async def record_explain(self, change_request, *, actor_id, note="") -> ChangeRequestEvent:
    event = await self._change_requests.add_event(
        change_request, action="explain", to_status=self._next(change_request, "explain"), ...
    )
    # 説明済みにした後の説明書(頭の「CR の状態」も説明済み)を写す
    explanation = await self._explanation(change_request)
    event.refs = snapshot_refs(explanation.markdown, explanation.fingerprint)
```

- 説明済みの API(`explain`)とリンクの作成の両方がこれを通る。リンクを作る前に説明済みにした CR でも、前回の写しが残る。
- 写すのは状態を変えた**後**の説明書。説明書の頭に「CR の状態: 説明済み」があり、前回と今回の両方を説明済みの時点でそろえないと、頭の行がいつも差分に出てしまう。
- 写しは時系列の行の `refs` に置いた(新しい表を作らない。相談の決定4)。CR の詳細の応答(`ChangeRequestEventRead`)では md を落とし、指紋だけを出す(説明済みにするたびに数十 KB ずつ応答が膨らむのを避ける)。
- 写しの無い説明の行(この仕組みより前の行)は `explained_snapshots` が読まない。

## 3. `ShareLinkService`

```python
# app/services/share_link_service.py(抜粋)
async def create(self, project, number, payload, *, actor_id) -> CreatedShareLink:
    change_request = await self._service.load(project, number)
    if change_request.status not in SHAREABLE_STATUSES:        # 下書き・説明済み
        raise ChangeRequestInvalidTransitionError(...)
    previous = await self._links.active_for(change_request.id)
    if previous is not None:
        await self._links.revoke(previous, revoked_by=actor_id)   # CR に有効なリンクは1本
    if next_status(change_request.status, "explain") is not None:
        await self._service.record_explain(change_request, actor_id=actor_id, note=note)
    else:
        await self._change_requests.add_event(change_request, action="share", ...)
    token = new_token()
    link = await self._links.create(token_hash=token_hash(token), expires_at=..., ...)
```

- 合意・却下の後は作れない(説明して合意を取る段階が終わっているため)。
- 説明済みの CR への作成・取り消し・延長は、状態を変えない記録だけの行(`share`・`unshare`・`extend_share`)。`link_review` と同じく遷移の表には持たない。たどる記録に「共有リンクを作った」などの名前で出る。
- 作成の応答の `summary_needs_reconfirm` で、確認済みの要約がその後の説明書の変化で古くなっていることを知らせる(外部設計書 2.16「確認済みの要約が古いときは、共有の前に開発者に知らせる」)。作成は止めない(要約は任意で、古い要約は出力に載らないため)。
- 取り消しは2度押しても1度だけ記録する。延長は今から N 日に置き直し、期限切れのリンクも開き直せる。取り消したリンクは延ばせない(409)。

## 4. ルート(すべてログインが要る)

| メソッド | パス | 応答 |
| --- | --- | --- |
| POST | `/projects/{id}/change-requests/{n}/share-links` | 201 `ShareLinkCreatedRead`(`token`・`path` = `/share/<token>`・`summary_needs_reconfirm`) |
| GET | `.../share-links` | `ShareLinkRead` の一覧(トークンなし) |
| POST | `.../share-links/{link_id}/revoke` | `ShareLinkRead` |
| POST | `.../share-links/{link_id}/extend` | `ShareLinkRead` |

## テスト観点

| テスト | SUT | ドライバ | スタブ |
| --- | --- | --- | --- |
| `test_change_request_sharing.py`(追記分) | `snapshot_refs`・`explained_snapshots`・`previous_snapshot` | pytest のテスト関数 | スタブ不要 ── 純粋関数のため |
| `test_share_link_service.py`(103-2 の分) | `ShareLinkService`(create / list_for / revoke / extend)・`record_explain`・リポジトリ・`ChangeRequestEventRead`・スキーマの日数の範囲 | pytest のテスト関数 | SQLite の db_session と `create_impact_project`(合意済みの版)── 永続化と遷移が検証対象のため、フェイクに置き換えない |
| `test_share_api.py`(103-2 の分) | 開発者の4つのルート | pytest のテスト関数(ルートの関数を直接呼ぶ) | 同上 |

- 下書きで作ると説明済みになり、説明の行に写し(説明済みの頭を含む)、応答の行には指紋だけ。説明済みの API でも写す。
- 作り直すと前のリンクは `revoked`、記録だけの `share` の行。合意の後は 409。
- 延長と2度の取り消し、取り消した後の延長は 409。ほかの CR のリンクは 404。日数は 1〜90。
- リポジトリにはトークンでなくハッシュが残る。
