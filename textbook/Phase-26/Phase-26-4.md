# Phase-26-4: 既存の段階7のデータ移行と差し戻し(BE)

## この章の目的

Phase 23〜25 に作った段階7は、区分の横割りの形(`area`・例のファイルの欄・マイルストーンの処理)で DB に保存されている。Alembic のデータ移行で、これを 26-1 の単位の形に変える。承認済みの段階7は、新しい形の検証を通して承認し直してもらうため、レビュー中に戻す。

自動実装モード: on([introduction](./Phase-26-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/` 基準) | 新規/更新 | 責務 |
| --- | --- | --- |
| [`alembic/versions/b8c9d0e1f2a3_recut_plan_stage.py`](../samples/backend/alembic/versions/b8c9d0e1f2a3_recut_plan_stage.py) | 新規 | `is_recut`・`recut_plan`・`restore_plan`(純粋)、`upgrade`(変換・承認の差し戻し・版を上げる)・`downgrade`(形だけ戻す) |
| ── ここからテスト ── | | |
| [`tests/unit/test_plan_stage_migration.py`](../samples/backend/tests/unit/test_plan_stage_migration.py) | 新規 | 変換の純粋関数と、変換の結果が新しい検証を通ること |

## 要点の抜粋

```python
# alembic/versions/b8c9d0e1f2a3_recut_plan_stage.py(down_revision = a5b6c7d8e9f0)
def recut_plan(model: dict, module_paths) -> dict:
    # タスクごと: kind = 処理があれば "feature"、無ければ "base"(区分は捨てる)
    #            modules = 段階4のパスに一致するもの、config_files = 残り、depends_on = []
    # マイルストーンの function_ids は捨てる(タスクに無い処理は UNPLANNED_FUNCTION で見える)
def restore_plan(model: dict) -> dict:   # downgrade。feature → バックエンド、base → 準備、2つの欄をまとめる
def is_recut(model: dict) -> bool:        # タスクに kind があるか(2回流しても変換しない)

def upgrade():
    # 段階4の model をプロジェクトごとに読み、段階7の行を変換する
    # status == "approved" → "reviewing"。どの行も version + 1
```

## 設計判断

### 読み込み時の互換ではなく、データ移行+差し戻し

[Phase 25](../Phase-25/Phase-25-introduction.md) の申し送り「既存のプロジェクトの段階7」を、着手時に次のように決めた。

| 案 | 採否 | 理由 |
|---|---|---|
| データ移行で新しい形に変え、承認済みをレビュー中に戻す | **採用** | コード(BE の model・FE の `toPlan`)は新しい形だけを扱える。新しい検証(依存・モジュール)を通っていない内容を「承認済み」のままにしない |
| 読み込むたびに旧形式を変換する(互換) | 不採用 | BE と FE の両方に旧形式の分岐が残り続ける。承認は旧形式のまま残る |
| 変換せず、再生成を促すだけ | 不採用 | 人が手直しした内容が失われる |

差し戻しは `status` を `reviewing` にするだけで、承認の記録(`approved_version`・`input_fingerprint`)は変えない。段階7の後ろの段階はまだ無い(段階8は Phase 27)ので、ほかに陳腐化が伝わる先は無い。内容が変わるので、どの行も `version` を1つ上げる。開いている画面からの保存は、版の不一致(409)で止まる。

### 変換は移行ファイルの中に閉じる

変換の関数は移行ファイルの中の純粋関数にし、`app` のコードを import しない。後の Phase で `app/detailed_design/plan.py` を改めても、この移行の結果が変わらないようにするため(移行は過去の時点の形から、その時点の形への変換)。モジュールの振り分けは、段階4のパスとの完全一致だけで見る(下書きのときの `resolve_callee` の部分一致は使わない。迷うものは環境・設定のファイルの側に入り、検証の `NO_MODULES` などで見える)。

テストは、移行ファイルを `importlib` でパスから読み込み、純粋関数を直接呼ぶ。変換の結果が新しい検証を通ることは、テストの側で `app` の `validate_plan` を使って確かめる。

### downgrade は形だけを戻す

戻すときは、`feature` をバックエンド、`base` を準備の区分にし、2つのファイルの欄をまとめ、マイルストーンの処理をタスクから作る。upgrade で差し戻した承認は戻さない(どの行が承認済みだったかを残していないため。承認し直してもらう)。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `recut_plan`・`is_recut`(移行ファイル) | pytest(移行ファイルを `importlib` で読み込む) | スタブ不要。純粋(DB を呼ばない。行の読み書きは `upgrade` の責務) | 第一テストの統合スモーク: 旧形式を変換すると、新しい検証で単位の指摘が出ない。種別とファイルの振り分け、段階4が無いときは全部が環境・設定のファイル、タスクの無い model は旧形式とみなす |
| `restore_plan` | pytest | スタブ不要。同上 | 往復で旧形式に戻る(マイルストーンの処理はタスクから作る) |

`upgrade`・`downgrade` の DB の読み書きはユニットテストでは扱わず、開発 DB で確かめた(下記)。

## 動作確認(実施済み)

```bash
cd devex-api/backend
uv run pytest tests/unit/test_plan_stage_migration.py
# 5 passed

cd devex-api
docker compose exec -T backend uv run alembic upgrade head     # a5b6c7d8e9f0 -> b8c9d0e1f2a3
docker compose exec -T backend uv run alembic downgrade -1
docker compose exec -T backend uv run alembic upgrade head
# 段階7の6行が、作業単位の形・レビュー中になった(移行の前に、段階7の行を作業用の場所へ退避した)
```
