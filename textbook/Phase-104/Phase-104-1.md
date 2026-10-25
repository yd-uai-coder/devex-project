# Phase-104-1: コメント欄と共有リンクの判断の規則(純粋関数)

## この章の目的

共有リンクからの書き込み(コメント・合意 / 却下)の規則を、DB にも HTTP にも触らない純粋関数で作る。コメント欄の並べ方(コメントごとに返信をまとめる)と返信できるコメント、書き込みを受けるリンクの状態と「見た版が今の版か」の判定、却下だけ理由を要る規則である。保存とルートは 104-2・104-3 がこの章の関数を呼ぶ。

自動実装モード: on([introduction](./Phase-104-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 内容 |
| --- | --- |
| [`backend/app/change_requests/comments.py`](../samples/backend/app/change_requests/comments.py) | 新規。コメント欄の並べ方と返信できるコメント |
| [`backend/app/change_requests/sharing.py`](../samples/backend/app/change_requests/sharing.py) | 書き込みの規則(`write_problem`)・判断の理由(`share_decision_reason`)・判断の出どころの名前 |
| [`backend/app/change_requests/__init__.py`](../samples/backend/app/change_requests/__init__.py) | コメント欄と書き込みの規則の名前を re-export |
| [`backend/tests/unit/test_change_request_comments.py`](../samples/backend/tests/unit/test_change_request_comments.py) | 新規。コメント欄の規則のテスト |
| [`backend/tests/unit/test_change_request_sharing.py`](../samples/backend/tests/unit/test_change_request_sharing.py) | 書き込みの規則と判断の理由のテストを足した |

## 1. コメント欄 `comments.py`

```python
# app/change_requests/comments.py(抜粋)
COMMENT_BODY_MAX = 2000
DEVELOPER_LABEL = "開発者"   # クライアントに見せる、開発者の返信の書き手


@dataclass(frozen=True)
class CommentFacts:
    id: Any
    parent_id: Any           # 返信の親(コメントは None)
    author_name: str         # クライアントが書いた名前(返信は空)
    is_developer: bool
    body: str
    fingerprint: str         # 書いたときに見ていた説明書の版
    created_at: datetime
    author_id: Any = None    # 返信した利用者(開発者の画面だけ)


@dataclass(frozen=True)
class CommentThread:
    comment: CommentFacts
    replies: tuple[CommentFacts, ...]


def comment_threads(comments: Iterable[CommentFacts]) -> list[CommentThread]: ...
def can_reply(parent: CommentFacts) -> bool:
    return parent.parent_id is None and not parent.is_developer
```

- コメント欄は CR に1本で、返信は1段(相談の決定2)。クライアントが名前を書いてコメントし、開発者がそのコメントに返信する。返信への返信と、開発者からの新しいコメントは無い。クライアントとのやりとりは「質問 → 答え」がほとんどで、スレッドにすると表と画面が重くなるからである。
- `comment_threads` は、渡した順によらず古い順に並べ、返信を親の下にまとめる。親の無い返信は出さない(親は CASCADE で一緒に消えるので、通常は起きない)。
- 各コメントに見た説明書の版(指紋)を持たせる。開発者は、コメントがどの版の説明書についてのものかを後で確かめられる。

## 2. 書き込みの規則 `write_problem`

```python
# app/change_requests/sharing.py(抜粋)
WRITABLE_STATES: frozenset[ShareState] = frozenset({"open"})
WriteProblem = Literal["not_writable", "changed"]


def write_problem(state, seen_fingerprint, current_fingerprint) -> WriteProblem | None:
    if state not in WRITABLE_STATES:
        return "not_writable"
    if seen_fingerprint != current_fingerprint:
        return "changed"
    return None
```

- 書き込みを受けるのは開いている(`open`)リンクだけ。直している(`paused`)間に合意を受けると、見た説明書と合意する中身がずれる(決定5)。判断済み・閉じたリンクも受けない。
- 開いていても、クライアントが見た版が今の版と違えば受けない(`changed`)。クライアントがページを開いた後に、開発者が直して説明し直すと、状態は `open` に戻るのに中身は変わっている。状態だけを見ると、古い説明書を見たまま合意できてしまう。Claude の判断(計画の承認で確定)。
- 期限切れ・取り消しは、閲覧と同じ 410 で先に止まる(104-2 の `_resolve`)。ここでは `not_writable` に入るが、呼ばれることはない。

## 3. 判断の理由と出どころ

```python
# app/change_requests/sharing.py(抜粋)
DecisionSource = Literal["developer", "share_link"]
DECISION_SOURCE_LABEL = {"developer": "開発者が記録", "share_link": "共有リンク"}
SHARE_AGREE_REASON = "共有リンクで合意"


def share_decision_reason(decision: str, reason: str) -> str | None:
    text = reason.strip()
    if text:
        return text
    return None if decision == "rejected" else SHARE_AGREE_REASON
```

- 却下は理由が要り、合意は任意(相談の決定4)。却下の理由は、写して出し直すとき(ステージ11)の材料になる。合意のたびにクライアントに理由を書かせるのは手間なので、空なら決まった文を記録の理由にする(合意の記録の理由は空にできないため。`AgreementNotes`)。
- 出どころは 104-3 で CR の列に残す。名前の表はここに置き、たどる記録と応答が同じ名前を使う(`decision_source_label` は 104-3 で足した)。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
| --- | --- | --- | --- |
| `test_change_request_comments.py` | `comment_threads`・`can_reply`・`CommentFacts`・`CommentThread`・`COMMENT_BODY_MAX`・`DEVELOPER_LABEL` | pytest のテスト関数 | スタブ不要 ── 対象が純粋(副作用なし)で外部依存を呼ばないため |
| `test_change_request_sharing.py`(追記分) | `write_problem`・`share_decision_reason`・`WRITABLE_STATES`・`DECISION_SOURCE_LABEL`・`SHARE_AGREE_REASON` | pytest のテスト関数 | スタブ不要 ── 同上 |

- 並べ方: 渡した順をばらしても、コメントも返信も古い順。親の無い返信は出ない。
- 返信: クライアントのコメントにだけ返信でき、返信・開発者の行には返信できない。
- 書き込み: `open` で同じ版なら None、版が違えば `changed`、ほかの5つの状態は `not_writable`。
- 理由: 却下で空白だけなら None、前後の空白は除く。合意で空なら決まった文。
