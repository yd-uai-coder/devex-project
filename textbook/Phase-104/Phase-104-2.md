# Phase-104-2: コメントの保存・公開のコメント・開発者の返信

## この章の目的

コメント欄を保存し、クライアントが共有リンクからログインなしでコメントでき、開発者がそのコメントに返信できるようにする。閲覧の応答にコメント欄を足し、公開の書き込みは閲覧と別の回数の上限で数える。合意・却下は 104-3。

自動実装モード: on([introduction](./Phase-104-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 内容 |
| --- | --- |
| [`backend/alembic/versions/d7e1f3a5b802_add_change_request_comments.py`](../samples/backend/alembic/versions/d7e1f3a5b802_add_change_request_comments.py) | 新規。表㉔ `change_request_comments` |
| [`backend/app/models/change_request_comment.py`](../samples/backend/app/models/change_request_comment.py) | 新規。コメント欄の1行の ORM |
| [`backend/app/models/__init__.py`](../samples/backend/app/models/__init__.py) | `ChangeRequestComment` を登録 |
| [`backend/app/repositories/change_request_comment.py`](../samples/backend/app/repositories/change_request_comment.py) | 新規。コメントの作成・一覧 |
| [`backend/app/change_requests/states.py`](../samples/backend/app/change_requests/states.py) | 記録だけの操作 `comment`・`reply_comment` |
| [`backend/app/change_requests/trace.py`](../samples/backend/app/change_requests/trace.py) | たどる記録の名前「コメントを受けた」「コメントに返信した」 |
| [`backend/app/services/errors.py`](../samples/backend/app/services/errors.py) | 書き込めない・版が古い・コメントが無い・返信できないの4つのエラー |
| [`backend/app/core/config.py`](../samples/backend/app/core/config.py) | `SHARE_WRITE_RATE_LIMIT_PER_IP_PER_HOUR`(既定20) |
| [`backend/app/services/share_rate_limit.py`](../samples/backend/app/services/share_rate_limit.py) | `enforce_write`(閲覧と別に数える) |
| [`backend/app/schemas/share_link.py`](../samples/backend/app/schemas/share_link.py) | コメントの作成・応答(クライアント向けと開発者向け)、閲覧の応答に `comments` |
| [`backend/app/services/share_link_service.py`](../samples/backend/app/services/share_link_service.py) | リンクの解決を `_resolve` に切り出し、コメント・一覧・返信と、閲覧のコメント欄 |
| [`backend/app/api/routes/share.py`](../samples/backend/app/api/routes/share.py) | `POST /share/{token}/comments`(ログイン不要) |
| [`backend/app/api/routes/change_requests.py`](../samples/backend/app/api/routes/change_requests.py) | `GET .../comments`・`POST .../comments/{comment_id}/replies` |
| [`backend/tests/unit/test_share_link_service.py`](../samples/backend/tests/unit/test_share_link_service.py) | コメント欄のサービスのテストを足した |
| [`backend/tests/unit/test_share_api.py`](../samples/backend/tests/unit/test_share_api.py) | コメント欄のルートのテストと、ルートの登録を足した |

インフラ(#21 の共通。samples にミラーしない): `devex-api/docker-compose.yml` の開発用の上限に `SHARE_WRITE_RATE_LIMIT_PER_IP_PER_HOUR: "1000"` を足した。

## 1. 表㉔ とリポジトリ

```python
# app/models/change_request_comment.py(抜粋)
class ChangeRequestComment(Base):
    __tablename__ = "change_request_comments"
    change_request_id   # CR(CASCADE。INDEX)
    parent_id           # 返信の親(自分の表への FK。CASCADE)
    share_link_id       # クライアントが書いたリンク(SET NULL)
    author_kind         # "client" / "developer"
    author_name         # クライアントが書いた名前(返信は空)
    author_id           # 返信した開発者(SET NULL)
    body, fingerprint, created_at
```

- 書き手の種類は `author_kind` で持つ。`author_id` の有無で決めると、利用者を消したとき(SET NULL)に返信がクライアントのコメントに見えてしまう。
- コメントは CR に付ける(リンクでなく)。リンクを作り直してもコメントは残り、`share_link_id` はどのリンクから書かれたかの記録だけ。
- `ChangeRequestCommentRepository` は `create`(flush まで)と `list_for`(古い順)だけ。並べ方は 104-1 の `comment_threads`。

## 2. リンクの解決 `_resolve` と書き込みの確かめ

```python
# app/services/share_link_service.py(抜粋)
async def _resolve(self, token) -> tuple[ChangeRequestShareLink, ChangeRequest, ShareState]:
    # トークン → リンク(無ければ404)→ CR → プロジェクト(簡易モード・削除は404)→ 状態
    # revoked / expired は 410

async def _require_writable(self, change_request, state, seen_fingerprint) -> ExplanationView:
    explanation = await self._service.explanation_of(change_request)
    problem = write_problem(state, seen_fingerprint, explanation.explanation.fingerprint)
    # not_writable → ShareLinkNotWritableError(409) / changed → ShareExplanationChangedError(409)
```

- Phase 103 の `view` の頭(リンクを引いて状態を決めるところ)を `_resolve` に移した。閲覧・コメント・判断(104-3)が同じ順で同じエラーを出すためである(#17 の消費者 = コメントと判断)。`view` の動作は変えていない。
- 書き込めない2つは、どちらも 409 にしてコードで分けた。`SHARE_LINK_NOT_WRITABLE` は「今は受け付けていない」、`SHARE_EXPLANATION_CHANGED` は「読み直してから送り直す」で、クライアントの画面(Phase 108)の出し方が違う。

## 3. コメントと返信

```python
# app/services/share_link_service.py(抜粋)
async def comment(self, token, payload: SharedCommentCreate) -> CommentThread:
    link, change_request, state = await self._resolve(token)
    await self._require_writable(change_request, state, payload.fingerprint)
    # 保存(author_kind=client・share_link_id)+ 記録だけの "comment" の行(note = 名前、refs = comment_id)

async def comments_for(self, project, number) -> list[CommentThread]: ...

async def reply(self, project, number, comment_id, payload, *, actor_id) -> CommentThread:
    # 無いコメント → 404 / can_reply でない → 409
    # 指紋は返信した時点の説明書。記録だけの "reply_comment" の行
```

- 開発者の返信は CR の状態によらずできる。判断の後に届いた質問にも答えられるようにするためである(クライアントの書き込みは `open` だけ)。
- 時系列には本文を写さず、名前とコメントの ID だけを残す(本文は表㉔ にある。時系列は「いつ何が起きたか」の記録)。
- 閲覧(`view`)は、説明書を見せる状態(`open`・`decided`)のときだけ `comments` を返す。直している・閉じた CR では題と状態だけ(Phase 103 と同じ)。

## 4. スキーマとルート

```python
# app/schemas/share_link.py(抜粋)
ClientName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=COUNTERPART_MAX)]
CommentBody = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=COMMENT_BODY_MAX)]
Fingerprint = Annotated[str, StringConstraints(pattern=r"^[0-9a-f]{64}$")]

class SharedCommentCreate(BaseModel): name: ClientName; body: CommentBody; fingerprint: Fingerprint
class SharedCommentRead(BaseModel): author; from_developer; body; created_at; replies   # 利用者の ID は出さない
class ChangeRequestReplyCreate(BaseModel): body: CommentBody
class ChangeRequestCommentRead(BaseModel): id; from_developer; author_name; author_id; body; fingerprint; created_at; can_reply; replies
```

- クライアントに見せる応答では、開発者の返信の書き手を「開発者」とし、利用者の名前と ID を出さない(Phase 103 の「応答に利用者の ID を出さない」と同じ)。
- 名前の長さは合意の記録の相手(`COUNTERPART_MAX`)と同じ。104-3 で、名前がそのまま相手に入るためである。
- `POST /share/{token}/comments` は 201。`ShareRateLimiter(redis).enforce_write(ip=...)` を先に数える。書き込みの上限(既定20回/時)は閲覧(60回/時)と別のカウンタにした。書き込みで閲覧の回数を使い切らないためと、書き込みの方が少なくてよいためである。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
| --- | --- | --- | --- |
| `test_share_link_service.py`(追記分) | `ShareLinkService.comment`・`comments_for`・`reply`・`view` のコメント欄、`comment_facts`、`ChangeRequestCommentRepository`・`ChangeRequestComment`、`ACTION_LABEL` の2つ、4つのエラー、スキーマの確かめ、`ShareRateLimiter.enforce_write` | pytest のテスト関数 | 永続化と遷移が検証対象のため、テスト用の SQLite のセッションと合意済みの版の fixture。回数の上限は FakeRedis |
| `test_share_api.py`(追記分) | `comment_on_shared_change_request`・`list_change_request_comments`・`reply_change_request_comment`、`SharedCommentRead`・`ChangeRequestCommentRead`、`api_router` への登録 | pytest のテスト関数(ルートは関数を直接呼ぶ) | 同上 |

- コメント → 返信 → 閲覧と開発者の一覧の両方に同じ形で出る。時系列に `comment`(名前)・`reply_comment` の行。表の行には書いたリンクが残る。
- 直している間は 409(書き込めない)、説明し直した後は古い指紋で 409(版が古い)、新しい指紋なら通る。取り消したリンクは 410。
- 返信への返信は 409、無いコメントは 404。リンクを作り直してもコメントは残る。
- 名前・本文は空白だけを断り、指紋は sha256 の形だけを受ける。
- 書き込みの上限は閲覧と別に数える。ルートでは、上限を超えると 429。公開の入口には認証が付かない。
