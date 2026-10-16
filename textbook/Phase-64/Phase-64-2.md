# Phase-64-2: バックグラウンドの処理の消失への強さ

## この章の目的

[64-1](./Phase-64-1.md) で、生成中でもプロジェクトを削除できるようにした。この章では、4つのバックグラウンドの処理(文書の生成・設計レビュー・「直ったか」の判定・段階の生成)を、途中でプロジェクトが消えても壊れないようにする。消えたプロジェクトには、結果も失敗の通知も書かない。各処理の終わりには、物理削除をもう一度試す。

自動実装モード: on([introduction](./Phase-64-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/services/project_deletion.py`](../samples/backend/app/services/project_deletion.py) | 更新 | `commit_if_live` を追記 |
| [`app/services/doc_generator_service.py`](../samples/backend/app/services/doc_generator_service.py) | 更新 | 成功・失敗の commit・レビューの後段・自己診断の代わりの commit・入口の終わりの物理削除 |
| [`app/services/review_service.py`](../samples/backend/app/services/review_service.py) | 更新 | `execute` の入口・失敗の記録の前・成功の commit |
| [`app/api/routes/reviews.py`](../samples/backend/app/api/routes/reviews.py) | 更新 | `execute_review` の終わりの物理削除 |
| [`app/services/fix_check_service.py`](../samples/backend/app/services/fix_check_service.py) | 更新 | `run_for` の途中の例外と commit・`run_fix_checks` の終わりの物理削除 |
| [`app/services/design_stage_generation_service.py`](../samples/backend/app/services/design_stage_generation_service.py) | 更新 | `execute` の失敗の記録の前・成功と失敗の commit・入口の終わりの物理削除 |
| [`tests/fixtures/vanishing_llm.py`](../samples/backend/tests/fixtures/vanishing_llm.py) | 新規 | 途中で削除される場合を模す LLM のスタブ |
| [`tests/unit/test_job_project_vanish.py`](../samples/backend/tests/unit/test_job_project_vanish.py) | 新規 | `commit_if_live` と4つの処理 |

## 1. 3つの規則と共通の部品(`commit_if_live`)

各処理に、次の3つの規則を当てる。

| 時点 | 確かめ方 | 消えていたら |
|---|---|---|
| 入口 | `get_by_id`(印の付いた行を返さない。[64-1](./Phase-64-1.md))か `project_vanished` | 何もしない |
| 失敗の記録の前(rollback の後) | `project_vanished` | 失敗の通知・状態の戻し・`failed` の印を書かない |
| 成功・失敗の commit | `commit_if_live` | rollback して終える(結果を捨てる) |

```python
# app/services/project_deletion.py
async def commit_if_live(session, project_id, *, job, write=None) -> bool:
    if await project_vanished(session, project_id, job=job):
        await session.rollback()
        return False
    try:
        if write is not None:
            await write()
        await session.commit()
    except VANISHED_ERRORS:
        await session.rollback()
        if await project_vanished(session, project_id, job=job):
            return False
        raise
    return True
```

- **2つの消え方を1か所で扱う**: 印だけが付いた(行はある)ときは、確かめた時点で分かる。物理削除まで済んでいたときは、書き込み(子の行の INSERT の外部キーの違反)か commit(行の無い UPDATE の `StaleDataError`)で例外になる。どちらも、消えていれば False を返す。生きているプロジェクトでの例外は、そのまま上げる(本当の不具合を隠さない)。
- `write` は、書き込みを確かめた後に回したいとき(レビューの成功の記録)に渡す。
- **確かめてから commit するまでの競合は許す**: その間に印が付くと、結果は印の付いたプロジェクトに入る。画面には出ず、後の物理削除で消えるので、害が無い。ロックで競合を閉じる案(`SELECT ... FOR NO KEY UPDATE`)は、DELETE の印の更新と待ち合うことになるので採らなかった。
- **記録はログだけ**([61-3](../Phase-61/Phase-61-3.md) の未確定事項): 消えたプロジェクトには、記録を書く場所が無い。

## 2. 文書の生成(`DocGeneratorService.generate`)

- 入口: `get_by_id` が印の付いた行を返さないので、今のまま(何もしない)。
- 失敗の経路: rollback と進み具合の消去の後、`project_vanished` なら return する(警告のログ `documents_generation_failed` も残さない)。失敗の通知の commit は `commit_if_live`。
- 成功の経路: `project.status = "completed"` の commit を `commit_if_live` にする。消えていれば、作った版ごと捨てる(4文書の組の rollback と同じ)。その後の設計レビューと「直ったか」の判定にも進まない。
- 設計レビューの後段(`_review_after_generation`): 入口と、受け付けの想定外の失敗の rollback の後で確かめる(失敗の回を書かない)。自己診断の代わりの通知の commit も `commit_if_live` にする。
- 入口の関数 `generate_documents` の `finally` で `purge_deleted_projects()` を呼ぶ。生成中に削除されたプロジェクトは、ここで初めて消せる。

## 3. 設計レビュー(`ReviewService.execute`・`execute_review`)

- 入口: 回(`review_runs`)は CASCADE で消える。回が残っていても(印だけ)、`project_vanished` で確かめてから進む。以前の `session.get(Project, ...)` は identity map を返すので、印に気づけない。
- 失敗の経路: DB の失敗の rollback の後、回を `failed` にする前に確かめる。
- 成功の経路: 指摘の保存(`runs.finish`。指摘の INSERT と flush)とチャットの知らせを `write` に入れ、`commit_if_live` で書く。物理削除の後なら、指摘の INSERT が外部キーの違反になるので、`write` の中で起きた例外も消失として読む。
- 消えたときは `None` を返す。文書の生成の後段は `None` を「レビューに失敗」として自己診断に切り替えるが、その commit も `commit_if_live` なので書かない。
- `execute_review`(ルートのモジュールの入口)の `finally` で物理削除を試す。

## 4. 「直ったか」の判定(`FixCheckService.run_for`・`run_fix_checks`)

- 判定は、指摘1件ごとに LLM を呼び、記録(`ReviewFixCheck`)を flush する。物理削除の後なら、この flush が外部キーの違反になる。ループを `try ... except VANISHED_ERRORS` で包み、消えていれば rollback して空を返す。
- 最後の commit を `commit_if_live` にする。
- 予約札(Redis の `fix_check:*`)は戻さない。10分で切れ、消えたプロジェクトの指摘は二度と判定しない。
- 入口の関数 `run_fix_checks` の `finally` で物理削除を試す。

## 5. 段階の生成(`DesignStageGenerationService.execute`)

- 入口: `get_by_id` で今のまま。
- 失敗の経路: rollback の後、段階の行を読み直す前に確かめる(`failed` と理由を書かない)。失敗の記録の commit は `commit_if_live`。
- 成功の経路: 下書きの保存(`generation_status="completed"` など)の commit を `commit_if_live` にする。段階の行は CASCADE で消えるので、物理削除の後なら `StaleDataError` になる。これも消失として読む。
- 入口の関数 `run_design_stage_generation` の `finally` で物理削除を試す。

## 6. 途中で削除される場合を模す(`VanishingLLM`)

```python
# tests/fixtures/vanishing_llm.py
class VanishingLLM:
    async def _before_call(self) -> None:
        if not self.marked:
            await self._session.execute(update(Project).where(...).values(deleted_at=datetime.now(UTC)))
            await self._session.commit()
            self.marked = True
        if self._fail is not None:
            raise self._fail
```

- 最初の LLM の呼び出しの前に、プロジェクトに印を付けて commit する。これが別のリクエストの DELETE の代わりになる。インメモリの SQLite は接続が1つなので、処理と同じセッションで付ける。
- `fail` を渡すと、印を付けた後の呼び出しをすべて失敗させる(失敗の経路を通す)。
- 構造化出力(`with_structured_output(...).ainvoke`)と素の `ainvoke`(自己診断)の両方の前に挟む。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_job_project_vanish.py`(新規) | `commit_if_live`・`DocGeneratorService.generate`・`ReviewService.execute`・`FixCheckService.run_for`・`DesignStageGenerationService.execute` | 各テスト関数 | `VanishingLLM`(途中で印を付ける)とその中の `FakeLLM`。`commit_if_live` のテストは、外部キーの違反を例外で直接投げる(SQLite では起きないため) |

- `commit_if_live`: 生きていれば書いて True。印があれば rollback して False(書いた内容は残らない)。書き込みの途中で消えた(例外 + 印)なら False。生きているプロジェクトの例外はそのまま上げる。
- 文書の生成: 途中で消えると、版を1つも残さず、状態を `completed` にせず、自己診断も載せない。失敗の経路では、状態を戻さず(`generating` のまま。プロジェクトごと消える)、失敗の通知も書かない。入口で印があれば LLM を呼ばない。
- 設計レビュー: 成功・失敗のどちらの経路でも、回は `running` のまま(成功も失敗も記録しない)で、チャットの知らせも増えない(`parametrize`)。
- 「直ったか」の判定: 判定を1件も記録せず、空を返す。
- 段階の生成: 成功・失敗のどちらでも、段階は `generating` のまま(`completed` にも `failed` にもしない)、下書きも保存しない(`parametrize`)。
- 各処理の入口の関数(`generate_documents` など)の `finally` の物理削除は、テストでは流さない(今までどおり、入口の関数はセッションの工場を使うのでユニットでは呼ばない)。物理削除そのものは [64-1](./Phase-64-1.md) のテストで確かめた。
- rollback の後は、読み込んだオブジェクトが失効する。テストでは ID を先に変数に取っておく(`project.id` を後から読むと、非同期のセッションで暗黙の読み込みになって落ちる)。
- 既存のジョブのテスト(文書の生成・レビュー・判定・段階の生成。131件)も、変えずに通る。消えないプロジェクトの振る舞いは変わっていない。
- 作成・更新したファイルは、この章のテストがすべて import する(ルートの `reviews.py` は既存の `test_review_routes.py` が import する)。前方 import は無い。
