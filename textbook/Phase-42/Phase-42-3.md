# Phase-42-3: 要素と参照の導出

## この章の目的

要件定義書・外部設計書の model と段階1〜8 の model から、設計の要素(要件・画面・API・処理・要約・テーブル・CRUD・モジュール・手順・処理ロジック・作業単位・横断事項・手順書)と、「A が B を参照する」辺を種類つきで作る。変更の影響のたどり方(42-4)と、承認時の写しとの比較(Phase 43)の土台になる。[41-1](../Phase-41/Phase-41-1.md) の `measure.py` の `build_detailed` を、本体の model を読む純粋関数にしたもの。

自動実装モード: on([introduction](./Phase-42-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/detailed_design/impact/elements.py`](../samples/backend/app/detailed_design/impact/elements.py) | 新規 | `ElementKind`・`EdgeKind`・`Ref`・`Element`・`DesignModels`(`from_dicts`)・`build_elements`・`parse_db_tables` |
| [`app/detailed_design/impact/__init__.py`](../samples/backend/app/detailed_design/impact/__init__.py) | 新規 | パッケージの re-export |
| ── ここからテスト ── | | |
| [`tests/fixtures/change_impact.py`](../samples/backend/tests/fixtures/change_impact.py) | 新規 | 予約の登録(F-01)と一覧(F-02)が3層のモジュールを共有する設計(段階1〜8・2文書) |
| [`tests/unit/test_impact_elements.py`](../samples/backend/tests/unit/test_impact_elements.py) | 新規 | 種類ごとの辺・DB 欄・キーでの付け直し・形の正しくない入力 |

パッケージの形(#7):

```python
# app/detailed_design/impact/__init__.py
from app.detailed_design.impact.elements import (
    DOCUMENT_STAGE, DesignModels, EdgeKind, Element, ElementKind, Ref, build_elements, parse_db_tables,
)
```

依存の向き: `impact.elements` → `app.detailed_design` の各 model(`function_list`・`data_flow`・`data_model`・`structure`・`procedure`・`logic`・`plan`・`procedure_doc`)と `app.documents` の2つの model。逆向き(既存のモジュールが `impact` を読む)は無い。`app/detailed_design/__init__.py` からは re-export しない(サブパッケージとして `app.detailed_design.impact` から読む)。

## 要点の抜粋

### 1. 要素と辺の形

```python
# app/detailed_design/impact/elements.py
@dataclass(frozen=True)
class Ref:
    to: str
    edge: EdgeKind

@dataclass(frozen=True)
class Element:
    key: str          # 例: "fn:F-01"、"module:app/services/reservation.py"、"task:U-002"
    kind: ElementKind
    stage: int        # 0 = 文書、1〜8 = 段階
    label: str
    refs: tuple[Ref, ...] = ()
```

キーは既存の ID に種類の接頭辞を付けたもの。

| 種類 | キー | 置き場 | 参照(辺の種類) |
|---|---|---|---|
| 要件 | `req:FR-001` | 文書 | なし |
| 画面 | `screen:SCR-001` | 文書 | 要件(requirement) |
| API | `api:<endpoint_key>` | 文書 | 画面(screen)・要件(requirement) |
| 処理 | `fn:F-01` | 1 | 要件・画面・トリガーの API(trigger) |
| 要約 | `summary:F-01` | 2 | 処理(function) |
| テーブル | `table:<table_key>` | 3 | なし |
| CRUD | `crud:F-01×<table_key>` | 3 | 処理・テーブル(table) |
| モジュール | `module:<パス>` | 4 | 処理・依存先のモジュール(depends)・読み書きするテーブル(table) |
| 手順 | `proc:F-01` | 5 | 処理・呼び出し先のモジュール(calls)・テーブル(table) |
| 処理ロジック | `logic:<logic_key>` | 6 | 置き場のモジュール(placed)・呼ぶ手順(called_by) |
| 作業単位 | `task:U-002` | 7 | 処理・モジュール(depends) |
| 横断事項 | `cc:<項目>` | 7 | 要件(42-2 の `req_ids`)・モジュール(depends) |
| 手順書 | `unit:U-002` | 8 | 作業単位(unit)・参照する手順と処理ロジック(implements)・モジュール(depends)・対象のモジュールを含む横断事項(covers) |

### 2. 入力(`DesignModels.from_dicts`)

```python
models = DesignModels.from_dicts(stages, documents, er_tables=er_names)
elements = build_elements(models)
```

保存された形(段階の `model`・文書の `model` の dict)を受け取る。形の正しくない段階・文書は空とみなす(検証が別に指摘するので、ここでは落とさない)。ER のテーブル名は段階の model の外(図)にあるので、別に渡す。

### 3. DB 欄からテーブルへの辺

```python
_DB_TABLE = re.compile(r"([A-Za-z_][\w.]*)\s+[CRUD]+\b")

def parse_db_tables(db: str, known_tables: Iterable[str]) -> list[str]:
    known = set(known_tables)
    found = (table_key(name) for name in _DB_TABLE.findall(db))
    return list(dict.fromkeys(name for name in found if name in known))
```

手順の行の DB 欄(`reservations C`・`users R, Reservations CU` など)から、段階3 の CRUD・ER に在るテーブルだけを取り出す。手順と、**同じ行の呼び出し先のモジュール**から、そのテーブルへ辺を張る。

### 4. 手順書の参照は段階8と同じ規則

手順書が参照する手順・処理ロジックは、段階8の画面・生成が使う `unit_refs`(Phase 27)で導く。同じモジュールにある別の処理の関数は含めない。

## 設計判断

### キーは既存の ID に接頭辞(Claude の判断)

41-5 の未確定事項。段階ごとの ID・`logic_key`・パス・テーブル名をそのまま使い、種類の接頭辞で衝突を避けた。新しい ID の体系を作ると、写し(Phase 43)と画面(Phase 44)で ID の対応表が要る。

### グラフは読むたびに組む(Claude の判断)

41-5 の未確定事項。要素は数百で、組むのは一瞬。保存すると、段階を直すたびに作り直しと整合の確認が要る。Phase 43 は model の写しを持てば、同じ関数で前と今のグラフを組める。外部のグラフライブラリは使わない(辞書と集合で足りる。[41-2](../Phase-41/Phase-41-2.md))。

### モジュールとテーブルの辺は手順の行から

段階4の model にテーブルの欄は無い。足すと段階4の生成・画面・検証を変えることになる。[41-2](../Phase-41/Phase-41-2.md) の Claude の判断どおり、段階5の手順の行(呼び出し先と DB 欄が同じ行)から導いた。最初は手順 → テーブルだけを作り、モジュール → テーブルを作り忘れていた。ベースラインの生成物で確かめたとき(42-4)に S6・N1 でリポジトリを見落としていて気づき、足した。

### 辺の種類を1つ足した(`implements`)

デモ([41-3](../Phase-41/Phase-41-3.md))の11種では、手順書 → 処理ロジックを `called_by`(「この手順から呼ばれる」)にしていた。処理ロジックを変えたときに手順書の理由がこの文になるのはおかしいので、`implements`(「この設計を手順書で実装する」)を足した。

### 本文の文字列からは辺を作らない

方針・手順の本文に出てくる名前は拾わない(言い回しで辺が増減するため。[41-1](../Phase-41/Phase-41-1.md))。例外は DB 欄で、名前と操作の決まった書き方(`表名 CRUD`)があり、知っているテーブル名だけを拾う。

## テスト観点

この章から、用語は前の Phase と同じ(SUT = テスト対象、ドライバ = SUT を呼ぶ側、スタブ = SUT が呼ぶ相手の代わり)。

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `DesignModels.from_dicts`・`build_elements` | pytest(`test_impact_elements.py`) | スタブ不要 ── 対象が純粋(副作用なし)で、DB・LLM を呼ばないため。model は DB から読まず fixture の dict で渡す(読み取りはサービス層の責務) | 文書と段階1〜8 の13種がそろう、種類ごとの辺、手順書は単位の処理の関数だけ、並べ替えた後も手順書はキーで単位に付く、段階7に無いキーの手順書は要素にしない、知らない参照先の辺は捨てる、形の正しくない入力は空 |
| `parse_db_tables` | pytest(同上) | スタブ不要 ── 純粋関数 | 知っている名前だけを現れた順に、大文字小文字をそろえる、`—` は空 |

fixture を最小の `plan_model()` などと別に置いたのは、処理が1つでは「別の処理へ広がらない」(42-4)を確かめられないため(#15: 集約の機構はフェイクの設計で確かめる)。

```sh
cd devex-api/backend && uv run pytest tests/unit/test_impact_elements.py
```
