# Phase-103-1: 共有リンクの規則(純粋関数)

## この章の目的

CR の共有リンクの規則を、DB にも HTTP にも触らない純粋関数で作る。推測できないトークンと、DB に残す sha256、期限の日数、リンクの今の状態の決め方(取り消し・期限と CR の状態から)、「前回から変わった点」の比べ方(説明書の節ごとの差分)である。保存と API は 103-2、公開の入口は 103-3 がこの章の関数を呼ぶ。

自動実装モード: on([introduction](./Phase-103-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 内容 |
| --- | --- |
| [`backend/app/change_requests/sharing.py`](../samples/backend/app/change_requests/sharing.py) | 新規。トークン・期限・リンクの状態・説明書の節ごとの差分 |
| [`backend/app/change_requests/__init__.py`](../samples/backend/app/change_requests/__init__.py) | 共有リンクの名前を re-export |
| [`backend/tests/unit/test_change_request_sharing.py`](../samples/backend/tests/unit/test_change_request_sharing.py) | 新規。共有リンクの純粋関数のテスト |

## 1. トークンと期限

```python
# app/change_requests/sharing.py(抜粋)
TOKEN_BYTES = 32
DEFAULT_EXPIRES_DAYS = 14
MAX_EXPIRES_DAYS = 90


def new_token() -> str:
    return secrets.token_urlsafe(TOKEN_BYTES)   # 43 文字・URL にそのまま載る


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def expires_at_from(now: datetime, days: int) -> datetime: ...
```

- DB にはトークンの sha256 だけを残す(相談の決定2)。DB が漏れても、そこから URL は作れない。256 bit の乱数なので、パスワードのような遅いハッシュ(bcrypt など)は要らない(総当たりの手がかりになる弱い値ではないため)。
- その代わり、トークンは作った応答で1度だけ返す。なくしたら作り直す(103-2)。
- 期限は日数で決める。上限90日は、クライアントとのやりとりが長引いても延長(103-2)で足りる長さとした。

## 2. リンクの状態 `share_state`

```python
# app/change_requests/sharing.py(抜粋)
ShareState = Literal["open", "paused", "decided", "closed", "expired", "revoked"]


def share_state(revoked_at, expires_at, cr_status, now) -> ShareState:
    if revoked_at is not None:
        return "revoked"
    if expires_at <= now:
        return "expired"
    return _STATE_BY_STATUS.get(cr_status, "closed")
    # explained → open / draft → paused / agreed・rejected・applied・verified → decided / withdrawn → closed
```

- 状態は保存しない。CR の状態が変わるたびにリンクの行を書き換えると、書き忘れで食い違うからである(要約の「古い」を指紋から読むときに決めるのと同じ考え。Phase 84)。
- 下書きに戻っても取り消さない(相談の決定2)。説明済みに戻れば同じリンクで再開でき、クライアントに URL を送り直さずに済む。
- `READABLE_STATES = {"open", "decided"}` が、説明書を見せる状態(103-3)。直している途中の中身で合意されないよう、`paused` では見せない。

## 3. 前回から変わった点 `explanation_changes`

```python
# app/change_requests/sharing.py(抜粋)
@dataclass(frozen=True)
class SectionChange:
    name: str                    # 節の名前(番号を除いた見出し。頭の部分は「題と基準」)
    removed: tuple[str, ...]     # 消えた行(空行を除く)
    added: tuple[str, ...]       # 足した行


def split_sections(markdown: str) -> list[tuple[str, list[str]]]: ...
def explanation_changes(old_markdown: str, new_markdown: str) -> tuple[SectionChange, ...]: ...
```

- 説明書の md を `## ` の見出しで節に分け、節ごとに `difflib.SequenceMatcher` で消えた行・足した行を出す(相談の決定4)。
- 節は**番号でなく名前**で対応づける。案を足すと「3. 選択肢」が入り、規模・影響・確かめたい点の番号が1つずつ送られる(Phase 102)。番号で対応づけると、中身の変わらない節まで「変わった」と出てしまう。
- 今の説明書の節の順に並べ、前回だけにあった節は後ろに置く。同じなら空。

## テスト観点

用語: **SUT** = テストする対象、**ドライバ** = SUT を呼ぶ側、**スタブ(テストダブル)** = SUT が呼ぶ外部の代わり。

| テスト | SUT | ドライバ | スタブ |
| --- | --- | --- | --- |
| `test_change_request_sharing.py` | `new_token`・`token_hash`・`expires_at_from`・`share_state`・`explanation_changes`・`READABLE_STATES`・`SHARE_STATE_LABEL` | pytest のテスト関数 | スタブ不要 ── 対象が純粋(副作用なし)で外部依存を呼ばないため(トークンは乱数だが、形と重ならないことだけを確かめる) |

- トークンは43文字・URL に安全な文字だけ・20回作って重ならない。ハッシュは同じ入力で同じ64文字。
- 状態: CR の状態ごとの表(parametrize)と、取り消し > 期限切れ > CR の状態の優先。期限ちょうどは切れている。
- 差分: 同じ md は空。案を足して番号が送られても、中身の変わらない「影響の一覧」は出ない。題の変更は「題と基準」に、消えた節は後ろに出る。
