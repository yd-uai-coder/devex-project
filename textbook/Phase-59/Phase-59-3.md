# Phase-59-3: 「直ったか」の重複を防ぐ(予約札)

## この章の目的

段階を続けて承認すると、採用した指摘が「直ったか」の判定(Haiku)が、同じ指摘を同じ版で3回ずつ判定した([58-2](../Phase-58/Phase-58-2.md))。承認のたびにバックグラウンドで `run_fix_checks` が走る。これが並行に走ると、どれも DB を見て「今の版でまだ判定していない」と判断する。承認は段階の内容の版を変えないので、判定の入力はまったく同じになる。着手時の相談で、**判定の直前に (指摘, 版) の予約札を Redis に置き、置けた処理だけが判定する**(案1)と決めた。承認のルートで変化が無ければ積まない案(案3)との併用はしない。

自動実装モード: on([introduction](./Phase-59-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/services/fix_check_service.py`](../samples/backend/app/services/fix_check_service.py) | 更新 | `claim_key`・`_claim`・`_release`、`run_for` で判定の前に札を置く |
| [`tests/fixtures/fake_redis.py`](../samples/backend/tests/fixtures/fake_redis.py) | 更新 | `set` に `nx` |
| [`tests/unit/test_review_fix_check.py`](../samples/backend/tests/unit/test_review_fix_check.py) | 更新 | 札の鍵・札があれば飛ばす |

## 1. 予約札(`app/services/fix_check_service.py`)

責務(`FixCheckService`): 採用した指摘が直ったかを判定して記録する(シャドーモード。Phase 54)。

```python
# app/services/fix_check_service.py
_CLAIM_SECONDS = 600

def claim_key(finding_id: uuid.UUID, versions: Mapping[str, int | None]) -> str:
    digest = hashlib.sha1(json.dumps(dict(versions), sort_keys=True).encode(), usedforsecurity=False).hexdigest()[:16]
    return f"fix_check:{finding_id}:{digest}"

# run_for の中
for candidate in candidates[: settings.JUDGE_MAX_PER_RUN]:
    key = claim_key(candidate.finding.id, candidate.versions)
    if not await self._claim(key):
        continue  # ほかの処理が判定中か判定済み
    if not await self._within_limit(user):
        await self._release(key)
        break
    check = await self._check(project, candidate)
    if check is None:
        await self._release(key)  # 渡す内容が無く判定しなかった
    else:
        checks.append(check)

async def _claim(self, key: str) -> bool:
    if self._redis is None:
        return True
    return bool(await self._redis.set(key, "1", nx=True, ex=_CLAIM_SECONDS))
```

- **予約札はキャッシュではない**(着手時にユーザーが確かめた点)。判定の結果は今までどおり DB(`review_fix_checks`)に書く。札は「この (指摘, 版) の判定はもう誰かが始めた」という印だけである。`SET NX` は「鍵が無いときだけ置く」操作で、Redis は1つずつ順に処理する。そのため、並行に走る処理のうち置けるのは1つだけになる。1日の回数の上限(`RateLimiter` の `INCR`)と同じ性質を使っている。
- 鍵に判定する版(`candidate.versions`)のハッシュを入れる。内容を直して版が変われば鍵も変わるので、必要な判定は止まらない。
- 札を消すのは、判定しなかったとき(段階の行を結べず渡す内容が無い・1日の上限で止めた)だけにした。判定が失敗したときは、失敗も DB に記録され、今の版で判定済みとして扱われる(Phase 54 の決まり)ので、札は残してよい。
- 1日の回数は、札を置けた後で数える。札が取れず飛ばした判定まで数えないため。
- Redis を渡さない呼び出し(単体テストの多く)では札を使わず、今までどおり動く。
- **案3(承認のルートで変化が無ければ判定を積まない)を併用しない理由**: 承認は内容の版を変えないので、「変化があるか」を知るには、承認のリクエストの中で候補探し(レビューの回・採用した指摘・今の版・前の判定)とほぼ同じ問い合わせを流す必要がある。承認の応答が遅くなり、要否の判断が2か所に分かれてずれる危険が生まれる。一方で減るのは空回りの DB 読み込みだけで、Haiku の費用と記録の重複は案1 だけで 0 になる。また案3 だけでは、内容の違う段階を続けて承認したときや、生成の後の判定と承認の判定が重なったときの競合が残る。

## 2. テストの Redis(`tests/fixtures/fake_redis.py`)

責務: `RateLimiter` などが使う Redis の操作だけを模したインメモリの偽物(Phase 53 完了後の調整)。

```python
# tests/fixtures/fake_redis.py
async def set(self, key, value, *, ex=None, nx=False) -> bool | None:
    if nx and key in self._values:
        return None   # redis-py と同じ(置けなければ None)
    self._values[key] = value
    return True
```

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_claim_key_changes_with_versions`(新規) | `claim_key` | pytest | スタブ不要 ── 純粋関数。版の並び順では変わらず、版が変われば変わる |
| `test_claimed_finding_is_skipped_until_released`(新規) | `FixCheckService.run_for` | pytest(非同期) | 判定の LLM は `FakeLLM`、Redis は `FakeRedis`(札を共有する)。DB はインメモリの SQLite。ほかの処理の札があれば判定の LLM を呼ばずに飛ばし、札が消えたら判定し、判定した札は残す |

- 並行そのもの(3つの処理が同時に走る)は、1つの SQLite のセッションでは再現できない。「先に走った処理が札を置いた」状態を作って、後から来た処理が飛ばすことを確かめた。本物の並行は [59-6](./Phase-59-6.md) で、dev の Redis・DB に判定を3つ同時に流して確かめた(記録 9件、(指摘, 版) の重複 0件)。
- 更新した本体のファイルと偽物は、このテストが import している(#15)。この章の import(`hashlib`・`json`・テストの `claim_key`・`FakeRedis`)に前方 import は無い。
