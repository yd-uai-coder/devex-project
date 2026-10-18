# Phase-78-4: 負荷のときだけ落ちるテスト

## この章の目的

`test_doc_generation_guard.py::test_stale_generating_is_recovered_before_new_request` が、devex-ui の全体テストと同時に流したときだけ1回落ちた(Phase 72)。原因を確かめ、テストを直す。Phase 72 では「チャットの履歴の並び(`created_at` だけで並べる)」を疑い、並びに2つ目の鍵を足す案だったが、原因は別だった。本体のコードは変えない。

自動実装モード: on([introduction](./Phase-78-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`tests/unit/test_doc_generation_guard.py`](../samples/backend/tests/unit/test_doc_generation_guard.py) | 更新 | 判定の時刻を、生成を始めた時刻から作る。しきい値の手前の確かめを足す |

## 1. 原因

```python
# tests/unit/test_doc_generation_guard.py(直す前)
LATER = datetime.now(UTC) + timedelta(minutes=16)   # モジュールの読み込みの時刻 + 16分
...
recovered = await service.recover_if_stale(project, now=LATER)
```

- `recover_if_stale` は、生成を始めた時刻(`projects.updated_at`。テストの中で `request_generation` が DB の時刻で入れる)から15分を超えていれば「止まった」とみなす(`generation_staleness.is_stale`)。
- `LATER` は pytest がファイルを集める(import する)ときに決まる。テストそのものが、集めてから **1分を超えて後** に走ると、`LATER - updated_at` が15分以下になり、`recover_if_stale` が False を返して落ちる。全体のテストは、ほかの重い処理(devex-ui の全体テスト)と同時に流すと遅くなるので、負荷のときだけ落ちた。
- **確かめ**: 直す前のファイルで `LATER` を2分早めて流すと(2分遅れて走ったのと同じ)、`assert recovered is True` で落ちた。そのテストではチャットの履歴は「中断しました」の1行しか書かないので、並びは結果に関わらない。Phase 72 の記録の「最後の行が『中断しました』でなかった」は、落ちた箇所の書き違いとみられる。
- **並びの2つ目の鍵は足さない**(着手時の相談でユーザーが決定。推奨どおり): `chat_histories.id` は uuid4 で順の鍵にならない。`created_at` は、利用者の発言と AI の返信を同じトランザクションで保存しても順に並ぶよう、行ごとにアプリ側の時刻(マイクロ秒)を入れている(Phase 35 の完了後の調整で、同じ時刻の2行の順が入れ替わったのを直した)。連番の列を足すのは、今の原因に対して大きすぎる。

## 2. 直し方

```python
# tests/unit/test_doc_generation_guard.py(抜粋)
def _after_start(project: Project, minutes: int) -> datetime:
    started_at = project.updated_at
    if started_at.tzinfo is None:          # SQLite はタイムゾーン無しで返す
        started_at = started_at.replace(tzinfo=UTC)
    return started_at + timedelta(minutes=minutes)
...
assert await service.recover_if_stale(project, now=_after_start(project, 14)) is False
recovered = await service.recover_if_stale(project, now=_after_start(project, 16))
```

- **判定の時刻を、テストの中で始めた時刻から作る**: テストがいつ走っても、始めた時刻との差は14分・16分に決まる。
- **しきい値の両側を見る**: 14分では戻さず、16分で戻す。以前は16分の側だけだった。
- タイムゾーンの扱いは `is_stale` と同じ(タイムゾーンの無い時刻は UTC とみなす)。
- ほかのテストに、読み込みの時刻で決める定数は無かった(`grep` で確かめた)。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_stale_generating_is_recovered_before_new_request`(更新) | `DocGeneratorService.recover_if_stale` | テスト関数 | スタブ不要 ── DB はインメモリの SQLite(本物)で、時刻は引数 `now` で渡せるため |

- 始めてから14分では戻さない / 16分で `interviewing` に戻し、チャットに「中断しました」を残す。
- 更新したファイルは、このテスト自身。前方 import は無い(`app.models.project.Project` は以前からある)。
