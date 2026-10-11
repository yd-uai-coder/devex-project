# Phase-42-2: 横断事項の要件ID

## この章の目的

段階7の横断事項(例外と HTTP・認証・トランザクション・ログ…)に、その方針が担う要件ID(`req_ids`)を持たせる。非機能要件から下流への辺が無く、[41-1](../Phase-41/Phase-41-1.md) の S2(非機能要件の変更)はどの方式でも何も示せなかった。横断事項は処理を持たないので、段階1の処理からは届かない。[41-2](../Phase-41/Phase-41-2.md) 決定5([Phase 38](../Phase-38/Phase-38-introduction.md) の案2。影響分析という使い道ができたので #17 の判定を満たす)の実装。

自動実装モード: on([introduction](./Phase-42-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/detailed_design/plan.py`](../samples/backend/app/detailed_design/plan.py) | 更新 | `CrossCuttingRow.req_ids`、`normalize_plan` が空白と重複を除く |
| [`app/detailed_design/plan_drafting.py`](../samples/backend/app/detailed_design/plan_drafting.py) | 更新 | `GeneratedCrossCutting.req_ids`、プロンプトの規則、`to_crosscutting` が形をそろえる(`_req_ids`) |
| [`app/detailed_design/validation.py`](../samples/backend/app/detailed_design/validation.py) | 更新 | `_crosscutting_requirement_issues`: 要件定義書に無い ID は `UNKNOWN_REQUIREMENT_ID`(警告) |
| [`src/features/detailed-design/api/types.ts`](../samples/frontend/src/features/detailed-design/api/types.ts) | 更新 | `CrossCuttingRow.req_ids` |
| [`src/features/detailed-design/planOps.ts`](../samples/frontend/src/features/detailed-design/planOps.ts) | 更新 | `toPlan`・`addCrossCutting` が要件ID を持つ |
| [`src/features/detailed-design/components/PlanTables.tsx`](../samples/frontend/src/features/detailed-design/components/PlanTables.tsx) | 更新 | 横断事項の表に「要件」の列(`ListInput`) |
| ── ここからテスト ── | | |
| [`tests/unit/test_plan.py`](../samples/backend/tests/unit/test_plan.py) | 更新 | `normalize_plan` が要件ID を保つ、要件定義書に無い ID の警告と、一覧の無いときは照合しない |
| [`tests/unit/test_plan_drafting.py`](../samples/backend/tests/unit/test_plan_drafting.py) | 更新 | プロンプトに `req_ids`、出力の要件ID の形をそろえる |
| [`src/features/detailed-design/test-utils/stageFixtures.ts`](../samples/frontend/src/features/detailed-design/test-utils/stageFixtures.ts) | 更新 | 「認証」に `NFR-001` |
| [`src/features/detailed-design/__tests__/planOps.test.ts`](../samples/frontend/src/features/detailed-design/__tests__/planOps.test.ts) | 更新 | 横断事項の要件ID を足す・直す |
| [`src/features/detailed-design/components/__tests__/PlanTables.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/PlanTables.test.tsx) | 更新 | 要件の列を出す・「,」区切りで書ける |

## 要点の抜粋

### 1. model と生成

```python
# app/detailed_design/plan.py
class CrossCuttingRow(BaseModel):
    topic: str
    policy: str = ""
    modules: list[str] = Field(default_factory=list)
    req_ids: list[str] = Field(default_factory=list)
```

```python
# app/detailed_design/plan_drafting.py
CROSSCUTTING_SYSTEM_PROMPT = (
    ...
    "- req_ids には、その方針が担う要件の ID を【要件定義書】の ID のまま書く(認証なら"
    "アクセス制御の非機能要件、ログなら監視・個人情報の要件など)。要件定義書に無い ID は"
    "作らない。当てはまる要件が無ければ空にする" + NAMING_RULES
)

def _req_ids(values: Sequence[str]) -> list[str]:
    """AI が書いた要件ID を`FR-001`の形にそろえる。形の違う値は捨てる(AI の書き損じのため)。"""
    return [req for req in (normalize_req_id(v) for v in values) if req is not None]
```

### 2. 検証

```python
# app/detailed_design/validation.py
def _crosscutting_requirement_issues(parsed: PlanModel, sources: StageSources) -> list[StageIssue]:
    index = index_from_external_design(sources.document_models.get("external_design"))
    if not index.available:
        return []
    known = set(index.known_ids)
    return [_warning("UNKNOWN_REQUIREMENT_ID", ..., row.topic.strip()) for row in ... if req not in known]
```

照合は段階1(Phase 38)と同じく、外部設計書の model に写した要件ID の一覧(`known_req_ids`)と比べる。一覧の無いプロジェクト(Phase 37 より前の外部設計書)は照合しない。

## 設計判断

### 下書きは LLM に付けさせる

案は LLM に付けさせる・モジュールと処理から導く・人が付ける、の3つ(着手時の相談で LLM に決めた)。モジュール → 処理 → 段階1の要件ID と導くと機能要件しか付かず、S2 のような非機能要件からの辺は作れない。

### 要件の一覧は新しく渡さない

計画では、生成の入力に要件の一覧(`ID|種別|本文`)を足すつもりだった。横断事項の生成は、すでに要件定義書の md を丸ごと入力にしており、その表に要件ID がある。同じものを2度渡さず、プロンプトの規則だけを足した。

### 詳細設計書の 07 章には出さない

07 章の表(md・HTML)に「要件」の列を足す案は見送った。要件ID は変更の影響をたどるためのもので、実装者が読む 07 章の方針には要らない。必要になれば Phase 44 の画面の作業で見直す。

### 判定は警告

段階1の `UNKNOWN_REQUIREMENT_ID` と同じく警告(承認を止めない)。要件ID が無くても段階7は成り立ち、影響が届かないだけだから。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `normalize_plan`・`validate_plan`(`_crosscutting_requirement_issues`) | pytest(`test_plan.py`) | スタブ不要 ── 対象が純粋(副作用なし)で、外部依存を呼ばないため。外部設計書の model は `StageSources.document_models` に dict で渡す | 要件定義書に無い `NFR-009` だけを警告(対象は項目の名前)、一覧の無いときは何も言わない |
| `to_crosscutting`・`CROSSCUTTING_SYSTEM_PROMPT` | pytest(`test_plan_drafting.py`) | スタブ不要 ── LLM を呼ばず、構造化出力を受け取って変換するだけ | `nfr-1` → `NFR-001`、「全部」は捨てる、要件の無い行は空 |
| `toPlan`・`addCrossCutting`・`updateCrossCutting` | vitest(`planOps.test.ts`) | スタブ不要 ── 純粋関数 | 足した行は空の要件ID、直すと要件ID が入る |
| `CrossCuttingTable` | vitest + Testing Library(`PlanTables.test.tsx`) | `onChange` は `vi.fn`(表は編集した model を返すだけで、保存は呼び出し元の責務のため) | 要件の列に `NFR-001`、貼り付けた「NFR-002, NFR-003」が配列で返る |

```sh
cd devex-api/backend && uv run pytest tests/unit/test_plan.py tests/unit/test_plan_drafting.py
cd devex-ui && npx vitest run src/features/detailed-design/__tests__/planOps.test.ts src/features/detailed-design/components/__tests__/PlanTables.test.tsx
```
