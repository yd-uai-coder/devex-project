# Phase-27-2: 参照の導出と段階8の検証(決定的な実装可能性チェック)(BE)

## この章の目的

単位が参照する設計(段階5の手順・段階6の関数・段階4のモジュール)を、単位の処理ID・モジュールから導き、設計にあるか(解決できるか)を判定する。それを使って段階8の検証(`STAGE_VALIDATORS[8]`)を作り、設計の不足を「重要度」と「直す先の段階」を持つ警告として出す。段階8の指摘は、手順書をまだ1つも作っていなくても出る。

自動実装モード: on([introduction](./Phase-27-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/` 基準) | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/detailed_design/procedure_doc.py`](../samples/backend/app/detailed_design/procedure_doc.py) | 更新(後半) | `DesignRefKind`・`DesignRef`・`DesignIndex`、`design_index`・`unit_refs`・`name_key`・`spelling_match`(純粋) |
| [`app/detailed_design/validation.py`](../samples/backend/app/detailed_design/validation.py) | 更新 | `StageIssue` に `level`・`fix_stage`・`unit`、`validate_procedure_doc`・`STAGE_VALIDATORS[8]`・`VALIDATED_WITHOUT_MODEL`、`validate_stage` が段階8だけ内容が空でも検証する |
| [`app/detailed_design/__init__.py`](../samples/backend/app/detailed_design/__init__.py) | 更新 | `DesignIndex`・`DesignRef`・`design_index`・`unit_refs` の re-export |
| [`app/schemas/design_stage.py`](../samples/backend/app/schemas/design_stage.py) | 更新 | `StageIssueRead` に `level`・`fix_stage`・`unit` |
| [`app/services/design_stage_service.py`](../samples/backend/app/services/design_stage_service.py) | 更新 | `_to_read`: 行が無くても、開いている段階は検証する |
| ── ここからテスト ── | | |
| [`tests/unit/test_procedure_doc.py`](../samples/backend/tests/unit/test_procedure_doc.py) | 更新(後半) | `design_index`・`unit_refs` |
| [`tests/unit/test_procedure_doc_validation.py`](../samples/backend/tests/unit/test_procedure_doc_validation.py) | 新規 | 指摘ごとの重さ・重要度・直す先の段階・対象 |
| [`tests/unit/test_design_stage_procedure_doc.py`](../samples/backend/tests/unit/test_design_stage_procedure_doc.py) | 新規 | 段階8の開く条件・保存・承認・行が無いときの検証(サービスとルート) |
| [`tests/unit/test_function_list.py`](../samples/backend/tests/unit/test_function_list.py) | 更新 | 検証の登録が段階1〜8 |

## 要点の抜粋

```python
# app/detailed_design/procedure_doc.py(後半)
DesignRefKind = Literal["procedure", "logic", "module"]

@dataclass(frozen=True)
class DesignRef:
    kind: DesignRefKind
    key: str              # procedure = 処理ID、logic = logic_key(module::function)、module = パス
    resolved: bool        # 参照先が設計にあるか
    via: str | None = None  # logic だけ: その関数を呼ぶ最初の手順ID(F-01#1)

@dataclass(frozen=True)
class DesignIndex:        # 承認済みの段階3〜6の索引
    procedures: Mapping[str, Procedure]   # 手順のある処理(段階5)
    logic_keys: frozenset[str]            # 詳細のある関数(段階6)
    logic_functions: Mapping[str, tuple[str, ...]]   # 段階6で選んだ関数名(モジュール → 関数名)
    module_paths: frozenset[str]          # 段階4
    crud_functions: frozenset[str]        # CRUD 図に操作のある処理(段階3)

def design_index(stages: Mapping[int, Mapping]) -> DesignIndex
def unit_refs(task: PlanTask, index: DesignIndex) -> list[DesignRef]
    # 処理ID → 段階5の手順 → 手順が呼ぶ段階6の関数(段階6の候補と同じ規則)→ 単位のモジュール
def name_key(name: str) -> str                 # 小文字にし _ と - を除く(createReservation == create_reservation)
def spelling_match(index, module, function) -> str | None
    # 段階6に無い呼び出しの、同じモジュールで書き方だけが違う段階6の関数名(無ければ None)
```

```python
# app/detailed_design/validation.py
@dataclass(frozen=True)
class StageIssue:
    severity; code; message; target = None
    level: FindingLevel | None = None   # 段階8だけ
    fix_stage: int | None = None        # 段階8だけ: 直す先の段階
    unit: str | None = None             # 段階8だけ: 指摘の出た単位の ID

def validate_procedure_doc(model, sources) -> list[StageIssue]:
    units = plan_units(段階7); index = design_index(sources.stages)
    # 手順書ごと: DUPLICATE_UNIT / UNIT_MISMATCH(エラー)、UNKNOWN_FILE(警告)
    # 段階7の単位ごと(手順書の有無によらない): unit_refs を見て NO_PROCEDURE / NOT_IN_CRUD /
    #   UNRESOLVED_CALL / MODULE_NOT_FILE(警告)

VALIDATED_WITHOUT_MODEL = frozenset({8})
def validate_stage(stage, model, sources):   # 段階8は model が空でも {} として検証する
```

```python
# app/services/design_stage_service.py
def _to_read(view, row, sources):
    if row is not None: issues = validate_stage(view.stage, row.model, sources)
    elif view.is_open:  issues = validate_stage(view.stage, None, sources)   # 段階8は指摘が出る
    else:               issues = []
```

## 設計判断

### 承認を止めるのは手順書そのものの不正だけ(着手時の決定3)

| 指摘 | 重さ | 重要度・直す先 | 理由 |
|---|---|---|---|
| 形が不正(`INVALID_MODEL`)・同じ単位の手順書が2つ(`DUPLICATE_UNIT`) | エラー | ── | 手順書として読めない |
| 段階7と合わない手順書(`UNIT_MISMATCH`) | エラー | 段階8(作り直す) | 別の単位の手順書を承認させない(27-1 の鍵の決定) |
| 機能の単位の処理に段階5の手順が無い(`NO_PROCEDURE`) | 警告 | 中程度・段階5 | 処理の流れが設計に無い。ただし段階5は「主要処理」だけを選ぶ段階なので、最重要にはしない(計画では最重要としていたが、実装で中程度に改めた) |
| 手順に DB 操作があるのに CRUD 図に操作が無い(`NOT_IN_CRUD`) | 警告 | 中程度・段階3 | 段階3と段階5の食い違い |
| 単位のモジュールがディレクトリ(`MODULE_NOT_FILE`) | 警告 | 中程度・段階4 | 段階7の警告を引き継ぐ。作るファイルが決まらない |
| 手順書のモジュールのファイルが段階4に無い(`UNKNOWN_FILE`) | 警告 | 中程度・段階4 | 手順書ができる Phase 28 から出る |
| 手順の関数が段階6に無く、段階6の関数と書き方だけが違う(`UNRESOLVED_CALL`) | 警告 | 軽微・段階5 | 書き方の揺れ([25-1](../Phase-25/Phase-25-1.md) 決定9)。吸収せず、手順の関数名を段階6にそろえさせる |

設計の不足を警告にとどめたのは、未定義を「手順書の上では決めず、設計の側で直す」ため([25-1](../Phase-25/Phase-25-1.md) 決定3)。承認を止めると、細かな不足が残るだけで手順書が使えなくなる。最重要が残っているときの承認前の確認は、承認できるようになる Phase 28 で作る。

### `UNRESOLVED_CALL` を出す範囲

段階6は任意で、人が選んだ関数だけを詳しくする。段階5の呼び出しのうち段階6に無いものを全部指摘すると、選ばなかった関数が全部「軽微」に並ぶ。段階6の検証(`UNCALLED_LOGIC`)が「どの手順からも呼ばれない関数」をエラーにしているので、段階6の関数はどれも段階5のどこかから正しい名前で呼ばれている。段階8に残る揺れは、同じモジュールの同じ関数を2通りに書いた手順(`create_reservation` と `createReservation`)で、ずれているのは手順の側である。そこで:

- **出す条件**: 手順の(モジュール, 関数)が段階6に無く、同じモジュールの段階6の関数のうち `name_key`(小文字にし、`_`・`-` を除く)が等しいものがあるときだけ(`spelling_match`)。等しさで比べるだけで、部分一致は使わない([Phase 19](../Phase-19/Phase-19-introduction.md) で、部分文字列の一致は誤一致するとして採らなかった)。
- **直す先と文言**: 直す先は段階5(対象は手順ID で、移った先で行を強調できる)。文言も「段階5の手順の関数名を『create_reservation』にそろえます」と、直す先と合わせる名前を書く。

> **画面確認後の修正(この Phase の中)**: 最初の実装は「段階6で関数を選んだモジュールにあり、一致しない呼び出し」を指摘し、文言は「手順の関数名か、段階6の関数名を直します」だった。ユーザーの画面確認で、文言が段階6を主語にしているのにボタンは「段階5で直す」になる食い違いを指摘された。調べると、同じモジュールで段階6に選ばなかった別の関数(`list_reservations` など)も、揺れと区別できずに出ていた。条件を上のとおりに絞り、文言を直す先に合わせた([`q_a.md`](../q_a.md)「Phase 27 ── 画面確認」)。参照の導出(`unit_refs`)は変えていない。

### 段階7のエラーと重ねない

依存の循環・一覧に無い依存先・段階4に無いモジュールは、段階7の検証のエラー(Phase 26)で承認できない。段階8の入力は承認済みの段階7だけなので、段階8では見ない。

### 手順書が無くても検証する

段階8の指摘の多くは、段階7の単位と設計(段階3〜6)だけで決まる。手順書を生成する前に不足を直せるよう、`validate_stage` は段階8だけ空の内容でも検証し、画面の一覧(`_to_read`)は行の無い段階8でも開いていれば指摘を返す。承認は今までどおり行(内容)が要るので、手順書の無い段階8は承認できない。

### 参照の展開は Phase 28 へ(着手時の決定4)

[25-4](../Phase-25/Phase-25-4.md) では、参照の中身を md に展開する部品もこの Phase に入れていた。展開を使うのは生成の入力・単位の詳細の表示・AI 向けの出力で、どれも Phase 28 以降にある。この Phase には使う側が無い(#17)ので、導出と解決(`unit_refs`)だけを作り、展開は Phase 28 で `DesignRef` を入力にして作る。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `design_index`・`unit_refs`・`name_key`・`spelling_match` | pytest(`test_procedure_doc.py`) | スタブ不要 ── 純粋で、段階の内容(dict)だけから決まるため | 手順の無い処理・詳細の無い関数は索引に入らない。参照の順(手順 → 関数 → モジュール)と `resolved`・`via`。揺れの相手は同じモジュールで `name_key` が等しいものだけ |
| `validate_procedure_doc`・`validate_stage` | pytest(`test_procedure_doc_validation.py`) | スタブ不要 ── 同上(`StageSources` に段階の内容を直接入れる) | 第一テストの統合スモーク: `STAGE_VALIDATORS[8]` に登録され、fixture は指摘0件。各指摘の重さ・`level`・`fix_stage`・`target`・`unit`。内容が空でも段階8だけ指摘が出る。書き方だけが違う呼び出しは指摘し(文言に合わせる名前が入る)、段階6で選ばなかった別の関数・段階6を飛ばした場合の呼び出しは指摘しない |
| `DesignStageService`・ルート(段階8) | pytest(`test_design_stage_procedure_doc.py`) | 「行が無くても検証する」のテストだけ、段階8の検証を偽の検証(固定の指摘を返す関数)に差し替える(`monkeypatch`)── fixture の設計に不足が無く、本物の検証では0件になるため | 段階7の承認で段階8が開く。ルートの保存で `StageIssueRead` に `level` などが載る。警告では承認が止まらず、`UNIT_MISMATCH` で止まる。生成は未対応(409) |
| `STAGE_VALIDATORS` の登録 | pytest(`test_function_list.py`) | スタブ不要 | 1〜8 が登録され、9 は指摘なし |

## 動作確認(実施済み)

```bash
cd devex-api/backend
uv run pytest tests/unit/test_procedure_doc.py tests/unit/test_procedure_doc_validation.py tests/unit/test_design_stage_procedure_doc.py tests/unit/test_function_list.py
```
