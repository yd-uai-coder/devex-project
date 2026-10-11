# Phase-42-4: 影響のたどり方と理由

## この章の目的

42-3 の要素と辺から、ある要素を変えたときに見直しが要る要素を「処理を軸」の規則で求め、たどった道と理由を付ける。[41-2](../Phase-41/Phase-41-2.md) 決定1(処理を軸 + 辺の種類の規則)・決定6(理由はコードが書く。LLM は使わない)と、改名は直接の参照元だけ(Claude の判断)の実装。デモの `impactModel.ts`([41-3](../Phase-41/Phase-41-3.md))の `impactOf` を本体へ移した。段階の印・確認済み・画面は Phase 43・44。

自動実装モード: on([introduction](./Phase-42-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/detailed_design/impact/trace.py`](../samples/backend/app/detailed_design/impact/trace.py) | 新規 | `ChangeKind`・`Change`・`ImpactItem`・`EDGE_REASON`・`USER_REASON`・`impact_of`・`regeneration_targets`・`REGENERATION_STAGES` |
| [`app/detailed_design/impact/__init__.py`](../samples/backend/app/detailed_design/impact/__init__.py) | 更新 | `trace` の re-export |
| ── ここからテスト ── | | |
| [`tests/unit/test_impact_trace.py`](../samples/backend/tests/unit/test_impact_trace.py) | 新規 | 見本の例1〜3 と同じ形の変更・別の処理へ広げない・短い道・テーブル |

re-export(#7): `from app.detailed_design.impact.trace import (EDGE_REASON, REGENERATION_STAGES, USER_REASON, Change, ChangeKind, ImpactItem, impact_of, regeneration_targets)`。依存の向きは `trace` → `elements`(`elements` は `trace` を読まない)。

## 要点の抜粋

### 1. 規則

```python
# app/detailed_design/impact/trace.py
def impact_of(elements: Sequence[Element], change: Change) -> list[ImpactItem]:
```

1. 変わった要素の直接の参照元(1段)は、種類によらず示す。
2. 改名(`Change(key, "rename")`)は 1 だけで止める。
3. 変更が届く処理を決める。処理ならそれ自身、文書の要素(要件・画面・API)なら文書の要素だけを通って届く処理(幅優先)、テーブル・モジュールならそれを使う CRUD・手順の処理。
4. 届いた処理に属する要素(要約・CRUD・手順・作業単位)と、その先の処理ロジック・手順書を示す。モジュールは処理に属するが共有されるので示さず、その先へも広げない。
5. 横断事項は処理を持たないので、横断事項の参照元(対象のモジュールを含む手順書)まで示す。

同じ要素に複数の道があれば短い道を残す。結果は置き場の順、同じ置き場の中はキーの順。

### 2. 結果の形と理由

```python
@dataclass(frozen=True)
class ImpactItem:
    key: str
    path: tuple[str, ...]  # 変わった要素からこの要素までの道(先頭が変わった要素)
    reason: str            # たどった最後の辺の種類から決まる文

EDGE_REASON: dict[EdgeKind, str] = {
    "requirement": "この要件を持つ",
    "function": "この処理に属する",
    "called_by": "この手順から呼ばれる",
    "covers": "この横断事項の対象のモジュールを含む",
    ...
}
```

例(fixture の設計で、要件 FR-001 を変える):

| 要素 | 道 | 理由 |
|---|---|---|
| `fn:F-01` | FR-001 → F-01 | この要件を持つ |
| `proc:F-01` | FR-001 → F-01 → 手順 | この処理に属する |
| `logic:…::register` | FR-001 → F-01 → 手順 → 処理ロジック | この手順から呼ばれる |
| `unit:U-002` | FR-001 → F-01 → 手順 → 手順書 | この設計を手順書で実装する |

### 3. 再生成の候補

```python
REGENERATION_STAGES: frozenset[int] = frozenset({5, 6, 8})

def regeneration_targets(elements, items) -> list[ImpactItem]:
    """再生成の候補: 部分再生成できる段階(5・6・8)の要素。自動では再生成しない。"""
```

## ベースラインの生成物での確かめ(使い捨て)

[`appendix/stage6-effect/detailed/stages/`](../../appendix/stage6-effect/README.md) の段階1〜8 の JSON を `DesignModels.from_dicts` に入れ、段階から始まるシナリオ(S5・S6・S7・N1)を流した(文書の model は生成物に無いので、文書から始まるシナリオは Phase 49 で測る)。スクリプトは残していない。

| シナリオ | 試案(41-1)示した / 当たり / 過剰 / 見落とし | 実装 |
|---|---|---|
| S5 処理の変更 | 12 / 10 / 2 / 0 | 12 / 10 / 2 / 0 |
| S6 テーブルの変更 | 13 / 3 / 10 / 1 | 16 / 4 / 12 / 0 |
| S7 モジュールの改名 | 8 / 6 / 2 / 0 | 6 / 6 / 0 / 0 |
| N1 テーブルの変更 | 7 / 3 / 4 / 1 | 9 / 4 / 5 / 0 |

- S7 の過剰が減ったのは、手順書の参照を `unit_refs` で絞ったため(42-3)。
- S6・N1 は最初、試案と同じくリポジトリを見落としていた。モジュール → テーブルの辺(手順の行から導く。[41-2](../Phase-41/Phase-41-2.md) の Claude の判断)を作り忘れていたのが原因で、足すと見落としは0になった。代わりに、そのテーブルを読み書きする手順の処理が増え、過剰が少し増えた。
- 正式な数字は、同じシナリオ(S1〜S8・N1〜N4)を Phase 49 で `measure.py` に実装の方式を足して数える。

## 設計判断

### 共有の画面を通ると別の処理に届く

fixture では画面 SCR-001 が FR-001・FR-002 の両方を持つので、FR-001 の変更は画面を通って F-02 にも届く。試案と同じ挙動(試案も文書の要素を通る道を全部たどっていた)で、41-2 の決定どおり。画面を通る道を止めるかは、Phase 49 の数字で判断する(「未消化の申し送り」に記録)。

### 改名と内容の変更は呼び出し側が選ぶ

`Change.kind` は、何が変わったかを見て呼び出し側が決める。写しとの比較(Phase 43)で、キーが変わり中身が同じなら改名、中身が変われば内容の変更、と判定する予定。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `impact_of`・`regeneration_targets`・`EDGE_REASON` | pytest(`test_impact_trace.py`) | スタブ不要 ── 対象が純粋(副作用なし)で、DB・LLM を呼ばないため。要素は fixture の model から `build_elements` で作る(導出そのものは 42-3 のテスト) | 処理の変更(スモーク: 道・理由・再生成の候補)、要件の変更でモジュールを示さない、画面を共有しなければ別の処理へ広がらない、短い道、改名は直接だけ(段階4の中の依存にも印)、モジュールの内容の変更は使う処理へ、非機能要件 → 横断事項 → 手順書、テーブルの変更はリポジトリ(直接)と CRUD・手順の処理へ、知らない要素・参照元の無い要素は空、並び順 |

```sh
cd devex-api/backend && uv run pytest tests/unit/test_impact_trace.py
```
