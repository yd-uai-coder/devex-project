# Phase-101-1: 変更の規模の集計(純粋関数)

## この章の目的

CR の予測(見直しが要る要素)と基準の束の写しから、変更の規模 ── 作業単位・ファイル・テスト・画面・API の数 ── を決定的に数える純粋関数を作る。たどれないときは0件でなく「数えられない」とし、理由を返す。ベースラインの CR-4 は、束の段階1 の処理に要件 ID が無く、予測が画面1件で止まって「作業単位0件」と出ていた([100-2](../Phase-100/Phase-100-2.md))。数えた0件と数えられなかった0件を分ければ、クライアントは「この部分は別に聞く」と分かり、開発者は束を作り直すきっかけを得る(決定1)。

自動実装モード: on([introduction](./Phase-101-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 内容 |
| --- | --- |
| [`backend/app/change_requests/scale.py`](../samples/backend/app/change_requests/scale.py) | 新規。規模の型・数え方・予測と実際の並べ方・名前を先にする表示 |
| [`backend/app/change_requests/__init__.py`](../samples/backend/app/change_requests/__init__.py) | 規模の名前を re-export |
| [`backend/tests/unit/test_change_request_scale.py`](../samples/backend/tests/unit/test_change_request_scale.py) | 新規。規模の純粋関数のテスト |

## 1. 型

```python
# app/change_requests/scale.py(抜粋)
ScaleKind = Literal["unit", "file", "test", "screen", "api"]
UncountableReason = Literal[
    "stage_missing", "document_missing", "requirement_unlinked", "new_requirement_unpredicted"
]
ScaleNoteKind = Literal["stage_outdated", "planned_modules_only"]


@dataclass(frozen=True)
class ScaleRemark:          # 数えられない理由、または注記1つ
    code: str
    label: str
    detail: str = ""        # 対象(段階・文書・要件 ID・単位)の並び


@dataclass(frozen=True)
class ScaleCount:
    kind: ScaleKind
    names: tuple[str, ...]                    # 数えたもの(表示名)
    uncountable: tuple[ScaleRemark, ...] = ()
    notes: tuple[ScaleRemark, ...] = ()       # 数えられないときは出さない(__post_init__ で空にする)

    @property
    def count(self) -> int | None:
        return None if self.uncountable else len(self.names)


@dataclass(frozen=True)
class Scale:
    counts: tuple[ScaleCount, ...]            # 種類の順
    integration_tests: tuple[str, ...] = ()
    system_tests: tuple[str, ...] = ()
    has_test_spec: bool = False
```

- `count` は「数えられない」を `None` で表す。0件(数えた結果)と区別するためである。
- `Scale` は、今の説明書の応答の項目(`integration_tests`・`system_tests`・`has_test_spec`)をそのまま出せるよう、テストの内訳も持つ。今の `explanation.AffectedUnits` はこの `Scale` に置き換えた(#17。消費者は説明書とスキーマだけ。101-2)。

## 2. 数え方 `count_scale`

```python
# app/change_requests/scale.py(抜粋)
@dataclass(frozen=True)
class ScaleSources:
    plan: PlanModel | None                    # 段階7
    procedure_docs: ProcedureDocModel | None  # 段階8
    test_spec: Mapping[str, Any] | None
    has_external_design: bool
    missing_stages: frozenset[int] = frozenset()   # 要る段階(1・7)のうち無いもの
    outdated_stages: frozenset[int] = frozenset()  # 承認のままでない段階


def count_scale(items, sources, *, requirement_ids=(), unlinked=(), unpredicted_new_requirement=False) -> Scale: ...
```

`items` は要素の (キー, ラベル)。予測の要素でも、反映で付いた印でも同じ関数に通す(101-3)。種類はキーの接頭辞で決める。

| 種類 | 数えるもの | 数えられない | 注記 |
|---|---|---|---|
| 作業単位 | `task:`・`unit:` のキーを単位のキーで1つに。段階7 の並び順に `タスク名(単位 ID)` | 段階1・7 が無い / FR が処理に届かない | 段階1・7 が古い |
| ファイル | その単位の `procedure_coverage.unit_files`(手順書のファイル + 段階7 のモジュール・設定)をパスで重なりを除く | 同上 | 段階1・7・8 が古い / 手順書の無い単位は段階7 から数えた |
| テスト | テスト仕様書の結合・総合のうち、要素の処理(`fn:`)か対象の要件に当たるもの | 段階1・テスト仕様書が無い / FR が処理に届かない | 段階1 が古い |
| 画面・API | `screen:`・`api:` のキー | 外部設計書が無い | ─ |

- 新しい要件の起点が無い(`unpredicted_new_requirement`)ときは、すべての種類が数えられない。新しい要件の分が数に入らないからである。
- ファイルは `unit_files` をそのまま使う(段階8 の検証と同じ材料。`row_of` は責務を引くためのもので、数には要らないので `lambda _: None`)。同じパスを複数の単位が触っても1件(相談の決定4)。
- 束の段階が承認のままでない(古い・承認の後に編集した)だけなら数えて注記する(相談の決定2)。数は出るが、古い段階は要件の ID を持たないなど、少なく出ることがあるからである。

## 3. 予測から数える `predicted_scale`

```python
# app/change_requests/scale.py(抜粋)
def unlinked_requirements(targets, prediction) -> tuple[str, ...]:
    """機能要件の対象のうち、予測で処理(段階1)に1つも届かなかったもの。"""
    reached = {rid for item in prediction.items if item.kind == "function" for rid in item.requirement_ids}
    return tuple(t.requirement_id for t in targets
                 if t.requirement_id.startswith(FUNCTIONAL_PREFIX) and t.requirement_id not in reached)


def predicted_scale(targets, prediction, snapshots, stage_states) -> Scale:
    sources = sources_from_snapshots(snapshots, stage_states)
    unlinked = () if 1 in sources.missing_stages else unlinked_requirements(targets, prediction)
    return count_scale([(i.key, i.label) for i in prediction.items], sources,
                       requirement_ids=[t.requirement_id for t in targets], unlinked=unlinked,
                       unpredicted_new_requirement=prediction.unpredicted_new_requirement)
```

- **つながりは「予測が処理に届いたか」で見る**。処理の要件 ID だけでなく、API のトリガーから処理に届いても、つながっているとみなす(たどり方は `impact_of` のまま)。CR-4 は、処理にも API にも FR-003 が無く、画面にしか届かなかった。
- **非機能要件・制約は見ない**。横断事項(段階7)などに届き、処理に届かないのがふつうだからである。
- 段階1 が束に無いときは、つながりの理由を出さない(段階の理由と同じことを二重に言うため)。
- `sources_from_snapshots` は、束の写しの `stage:N` のうち中身のあるものを「ある」とし、束の行の状態(`state`)が `approved` でない段階を「古い」とする。状態はサービスが束の行から渡す(101-3)。

## 4. 予測と実際を並べる `compare_scale`・名前を先にする `display_name`

- `compare_scale(predicted, actual, predicted_keys, document_checks)` は、種類ごとに `ScaleComparisonRow(kind, predicted, actual, basis)` を返す。作業単位・ファイル・テストは `actual`(反映の印から数えた `Scale`)の数、画面・API は予測の画面・API のうち文書の側の確認の一覧で確かめた数(`basis="document_checks"`。画面・API には印が付かないため。相談の決定6)。
- `display_name` は、`ID 名前` の形のラベルを `名前(ID)` にする(`SCR-001 トップページ` → `トップページ(SCR-001)`)。先頭が ID でないもの(パス・`GET /…`)と、ID の後ろが「の」「×」で続くもの(`M-01-T02 の手順書`・`F-01 × reservations`)はそのまま。説明書(101-2)も使う。

## テスト観点

**SUT / ドライバ / スタブ**(#14):

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_change_request_scale.py` の全テスト | `predicted_scale`・`count_scale`・`sources_from_snapshots`・`unlinked_requirements`・`compare_scale`・`display_name` と、`Scale`・`ScaleCount`・`ScaleRemark`・`ScaleSources`・`ScaleComparisonRow` | pytest のテスト関数 | スタブ不要 ── 対象が純粋(副作用なし)で外部依存を呼ばないため。入力は、変更の影響の fixture(`tests/fixtures/change_impact.py`。要件3件・段階1〜8)を束の写しの形に並べ、テスト仕様書の写しを足したもの |

- 種類ごとの数: FR-001 なら作業単位1(`予約を登録する(M-01-T02)`)・ファイル3・テスト2(結合1・総合1)・画面1・API1。種類の順は決まっている。
- 重なり: FR-001・FR-002 の2単位が同じ3層のファイルを触っても、ファイルは3件。
- 手順書の無い単位: 段階8 を空にすると、段階7 のモジュールから数え、注記に単位の ID が出る。
- つながらない FR: 処理と API の要件 ID を消すと、作業単位・ファイル・テストが数えられない(理由に FR-001)。古い段階を渡しても注記は出ない。画面は数える。非機能要件は、つながらないとみなさない。
- 段階・文書が無い: 段階1 を消すと段階の理由だけ(つながりの理由は出ない)。テスト仕様書・外部設計書が無ければ、テスト・画面・API が数えられない。
- 古い段階: 段階7 が古いと作業単位・ファイルに注記、段階8 はファイルにだけ。テストには出ない。
- 新しい要件の起点が無い: すべての種類が数えられない。
- 予測と実際: 作業単位・ファイル・テストは印から数えた数、画面・API は確認済みの数。
- 名前を先に: ID の形・「の」「×」・パス・API の扱い。

`__init__.py` の re-export は、このテストが `app.change_requests` から import して通る(#15)。
