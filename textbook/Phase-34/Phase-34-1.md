# Phase-34-1: 観点の定義と `hearing_points`(BE)

## この章の目的

ヒアリングの5条件を置き換える「観点の表」の土台を作る。観点の定義(キー・名前・問いの例・規模ごとの必須)をコードに持ち、完了の判定(必須の観点がすべて未決以外)と、判定の LLM の結果の取り込みを純粋関数で書く。観点ごとの状態は新しいテーブル `hearing_points` に、ヒアリングで決まった規模は `projects.hearing_scale` に持つ。

LLM の呼び出しと API は [34-2](./Phase-34-2.md) で、画面は [34-3](./Phase-34-3.md) で作る。

自動実装モード: on([introduction](./Phase-34-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/hearing/points.py`](../samples/backend/app/hearing/points.py) | 新規 | 観点の定義と、必須・完了の判定・判定の取り込み・まとめ(純粋関数) |
| [`app/hearing/__init__.py`](../samples/backend/app/hearing/__init__.py) | 新規 | `points.py` の re-export |
| [`app/models/hearing_point.py`](../samples/backend/app/models/hearing_point.py) | 新規 | 観点1つの状態の ORM(`UNIQUE(project_id, point_key)`) |
| [`app/models/project.py`](../samples/backend/app/models/project.py) | 更新 | `hearing_scale` の列と `hearing_points` の relationship |
| [`app/models/__init__.py`](../samples/backend/app/models/__init__.py) | 更新 | `HearingPoint` を alembic に読ませる |
| [`app/repositories/hearing_point.py`](../samples/backend/app/repositories/hearing_point.py) | 新規 | 観点の状態の一覧と、キーで突き合わせた保存 |
| [`alembic/versions/a1b2c3d4e5f7_add_hearing_points.py`](../samples/backend/alembic/versions/a1b2c3d4e5f7_add_hearing_points.py) | 新規 | `hearing_points` の作成と `projects.hearing_scale` の追加 |
| ── ここからテスト ── | | |
| [`tests/unit/test_hearing_points.py`](../samples/backend/tests/unit/test_hearing_points.py) | 新規 | 観点の定義・必須・完了・取り込み・まとめ・発言の番号付け |
| [`tests/unit/test_hearing_point_repository.py`](../samples/backend/tests/unit/test_hearing_point_repository.py) | 新規 | 行の追加と、キーで突き合わせた更新 |

BE のパスは `devex-api/backend/` 基準。

## 要点の抜粋

```python
# app/hearing/points.py
@dataclass(frozen=True)
class PointDef:
    key: PointKey
    kind: PointKind  # "function" | "nonfunctional"
    label: str
    question: str  # 場面で聞く問いの例
    required: frozenset[Scale]  # 必須になる規模

POINT_DEFS: tuple[PointDef, ...] = (
    PointDef(key="scale", kind="function", label="規模", question="...", required=_ALL),
    ...
    PointDef(key="environment", kind="nonfunctional", label="システム環境・エコロジー",
             question="どの端末・ブラウザで使いますか", required=_INTERNAL_UP),
)

def open_required(states: Mapping[str, PointState], scale: Scale | None) -> list[PointDef]:
    """必須なのに未決の観点(定義の順)。表に無い観点は未決とみなす。"""

def is_sufficient(states, scale) -> bool:
    return not open_required(states, scale)

def merge_judgement(previous, judged: Iterable[JudgedPoint]) -> dict[str, PointState]:
    for item in judged:
        state = to_state(item.key, item.status, item.summary.strip(), item.evidence)
        if state is None or (state.status != "open" and not state.evidence):
            continue  # 知らないキー・状態、根拠の無い「決定」は取り込まない
        merged[state.key] = state
```

```python
# app/hearing/__init__.py(re-export の形)
from app.hearing.points import (POINT_DEFS, PointState, JudgedPoint, Scale, ...,
                                is_sufficient, merge_judgement, number_messages, ...)
__all__ = [...]
```

依存の向き: `app/hearing/points.py` は標準ライブラリだけを読む。`app/repositories/hearing_point.py` が `app.hearing.PointState` と `app.models.hearing_point` を読む。サービス・スキーマ([34-2](./Phase-34-2.md))が `app.hearing` を読む。

## 設計判断

### 観点の定義はコードに持つ

観点の名前・問いの例・規模ごとの必須は、見本の観点の表 と devex-ui のデモ(`hearingPointsModel.ts`)と同じ値にした([33-2](../Phase-33/Phase-33-2.md) 決定1の補足)。DB やテンプレートに持たないので、完了の判定・返信に渡す観点・画面の行の順が、同じ表から決まる。必須の数は、個人・小規模が10、社内が14、公開サービスが15。体制・期間はどの規模でも任意。

### 規模が決まるまでは「個人・小規模」の列で数える

規模が未決の間は必須が最も少ない列で数える。規模は定義の先頭なので、返信の LLM にはまず規模を聞かせる([34-2](./Phase-34-2.md))。規模が決まれば、社内・公開サービスで増える観点が必須になる。

### 根拠の無い「決定」は取り込まない

ベースライン([33-1](../Phase-33/Phase-33-1.md))では、LLM が「未達」と書いた条件を聞かないまま「十分」と判定した。取り込みの規則をコードに置き、未決以外(決定・採用・対象外)は根拠の発言が1つ以上あるときだけ表に入れる。根拠は、利用者側の発言(初期入力・添付資料・利用者の発言)の id に結べたものだけ([34-2](./Phase-34-2.md) で番号から id に直す)。返らなかった観点は前の状態のまま。未決は根拠が無くても取り込む(利用者が決めたことを取り消した場合)。

### 規模は `projects` の列にする

規模は観点の1つだが、必須の切り替えに使う値(`personal`/`internal`/`public`)なので、行の `summary`(決めたことの文)とは別に `projects.hearing_scale` に持つ。`scale_after` で、規模の観点が未決・対象外なら `None` に戻す。

### 保存は全観点をまとめて書き直す

`save_states` は観点のキーで行を突き合わせ、無い観点は行を足す。判定のたびに全観点の分を書くので、表には常に16行がそろう。

### 発言の番号と表示名

`number_messages` は利用者側の発言に 1 からの番号を付け(LLM に見せる)、表示名(初期入力・添付資料・発言N)を返す。N は利用者の発言だけを数える。根拠は `chat_histories.id` で持つので、ステージ7で発言の行と結びつけやすい(着手時の決定)。

## テスト観点

用語: SUT はテストの対象、ドライバはテストを動かすもの、スタブは SUT が呼ぶ相手の代わり。

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `app/hearing/points.py` と `app/hearing/__init__.py` の re-export | pytest(`test_hearing_points.py`) | スタブ不要 ── 対象が純粋(副作用なし)で外部依存を呼ばないため | 第一テスト: 定義が機能面10 + 非機能6で、規模が先頭。規模ごとの必須の数、未決の規模は個人・小規模の列、対象外も完了に数える、返信に渡す観点は最大3件で規模から、取り込み(根拠の無い決定・知らないキー・未決への戻し)、規模の決まり方、まとめの並び、発言の番号付け |
| `HearingPointRepository`・`HearingPoint` | pytest(`test_hearing_point_repository.py`) | スタブ不要 ── 永続化そのものが対象なので、インメモリ SQLite の `db_session` を使う | 16行の追加、キーで突き合わせた更新(他の行は変わらない) |

```sh
cd devex-api/backend && uv run pytest tests/unit/test_hearing_points.py tests/unit/test_hearing_point_repository.py
```
