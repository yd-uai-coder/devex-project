# Phase-48-1: 段階3 ── DFD の書き込みの線と CRUD 図

## この章の目的

段階3の CRUD 図の検証のエラー `DFD_WRITE_MISSING`(DFD に書き込みの線があるのに、CRUD 図に C/U/D が無い)を、生成の時点で減らす。ステージ6のベースラインの4件はすべて「取得」の処理で、AI の CRUD 図は正しく、DFD に誤った書き込みの線があったと考えられる。そこで、DFD の下書きで読むだけの処理に書き込みの線を描かせないようにする。それでも残ったセルは、システムが処理の名前から操作を補い、印と警告で人に確かめさせる。

自動実装モード: on([introduction](./Phase-48-introduction.md) 参照)。

## この章で作成・更新したファイル

`textbook/samples/backend/`・`textbook/samples/frontend/` 配下(表は依存順。#30)。

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/detailed_design/data_flow_drafting.py`](../samples/backend/app/detailed_design/data_flow_drafting.py) | 更新 | DFD の下書きのプロンプトに、書き込みの線を描く処理の規則を足す |
| [`app/detailed_design/data_model.py`](../samples/backend/app/detailed_design/data_model.py) | 更新 | `CrudCell.inferred`・`infer_write_ops`。`merge_crud` が補い、`confirm_drafts` が印を外す |
| [`app/detailed_design/validation.py`](../samples/backend/app/detailed_design/validation.py) | 更新 | 警告 `DFD_WRITE_INFERRED`、`DFD_WRITE_MISSING` の文に DFD を直す案内 |
| [`app/detailed_design/impact/elements.py`](../samples/backend/app/detailed_design/impact/elements.py) | 更新 | CRUD のセルの内容(差分で比べる値)から `inferred` を除く |
| [`app/detailed_design/__init__.py`](../samples/backend/app/detailed_design/__init__.py) | 更新 | `infer_write_ops` の re-export |
| [`src/features/detailed-design/api/types.ts`](../samples/frontend/src/features/detailed-design/api/types.ts) | 更新 | `CrudCell.inferred?` |
| [`src/features/detailed-design/crudOps.ts`](../samples/frontend/src/features/detailed-design/crudOps.ts) | 更新 | `toCrud` が印を残し、`setCellOps` が外す |
| ── ここからテスト ── | | |
| [`tests/unit/test_data_flow_drafting.py`](../samples/backend/tests/unit/test_data_flow_drafting.py) | 更新 | プロンプトの規則 |
| [`tests/unit/test_data_model.py`](../samples/backend/tests/unit/test_data_model.py) | 更新 | 推定・印・検証の警告と案内・保存の形 |
| [`tests/unit/test_impact_diff.py`](../samples/backend/tests/unit/test_impact_diff.py) | 更新 | 推定の印は差分にならない |
| [`src/features/detailed-design/__tests__/crudOps.test.ts`](../samples/frontend/src/features/detailed-design/__tests__/crudOps.test.ts) | 更新 | 印が保存で残り、書き換えで外れる |

依存の向き: `validation` → `data_model`、`impact/elements` → `data_model`(どちらも既存のまま)。`__init__.py` は `from app.detailed_design.data_model import (..., infer_write_ops, ...)` を足し、`__all__` にも足した。

## 要点の抜粋

### 1. DFD の下書きの規則(data_flow_drafting.py)

```python
# app/detailed_design/data_flow_drafting.py
DFD_SYSTEM_PROMPT = (
    ...
    "- 処理 → データストアの線は、そのデータを作成・更新・削除する処理にだけ描く。"
    "読むだけの処理は データストア → 処理 の線だけにし、検索条件などをデータストアへ向けて"
    "描かない(線の向きが CRUD 図の読み・書き込みになる)\n"
    ...
)
```

DFD の線の向きは、CRUD 図の R と W を決定的に決める(Phase 18)。読むだけの処理が「検索条件」をデータストアへ向けて描くと、それが書き込みになる。誤りの元は DFD なので、まず DFD の下書きで防ぐ。効果は実 LLM でしか測れないので、Phase 49 で数える。

### 2. 補う(data_model.py)

```python
# app/detailed_design/data_model.py
class CrudCell(BaseModel):
    ...
    draft: bool = False
    inferred: bool = Field(default=False, exclude_if=lambda value: not value)

def infer_write_ops(name: str) -> str: ...   # 「削除」→ D、「登録」「作成」など → C、それ以外 → U

def merge_crud(drafts, accesses, function_list, tables) -> CrudModel:
    ...
    for key in writes & ops.keys():
        if not ops[key] & WRITE_OPS:
            ops[key].update(infer_write_ops(function_names[key[0]]))
            inferred.add(key)
```

- **補う文字は処理の名前から推定する**(着手時の相談)。C の手がかりは「登録・作成・追加・送信・新規・アップロード」、D は「削除」(先に見る)、どれにも当たらなければ U。ベースラインの4件は「取得」の処理なので U になり、人が直した文字と同じ。
- **補ったセルは `draft` と `inferred` の両方の印を付ける**。`inferred` は真のときだけ保存する(pydantic の `exclude_if`)。印の無いセルの保存の形は今までと同じで、既存のデータもテストの期待値も変わらない。
- **承認で外れる**(`confirm_drafts`)。承認 = 人がまとめて確定した、という Phase 18 の考え方のまま。

### 3. 警告と案内(validation.py)

```python
# app/detailed_design/validation.py
for cell in parsed.cells:
    if cell.inferred:
        message = (
            f"DFD の書き込みの線から、{target} の操作を「{cell.ops}」と推定しました。"
            "読むだけの処理なら、段階2の DFD の線の向きを直してください。"
        )
        issues.append(_warning("DFD_WRITE_INFERRED", message, target))
```

補ったセルは承認を止めない(警告)。人が補った文字を消すと、今までどおりエラー `DFD_WRITE_MISSING` になり、その文にも同じ案内を足した。ベースラインでは、人は検証を通すために「取得」の処理へ U を足していた。案内が無いと、誤った DFD に CRUD 図を合わせる直し方しか見えない。

### 4. 差分と画面(impact/elements.py・crudOps.ts)

- **変更の影響の差分**: CRUD のセルの内容から `draft` と同じく `inferred` を除く(`row_body(cell, "function_id", "table", "draft", "inferred")`)。印が外れただけで「内容の変更」にしない。
- **devex-ui**: 画面は CRUD 図の model 全体を保存するので、`toCrud` が印を落とすと、1つのセルを直しただけで他のセルの印まで消える。`toCrud` は印を残し(`...(cell.inferred ? { inferred: true } : {})`)、`setCellOps` で書き換えたセルからは外す。表示は変えていない(警告は検証の一覧に出る)。

## 設計判断

- **DFD のプロンプトとシステムの補いの両方**(ユーザーの選択。推奨は DFD のプロンプトだけ)。推奨の理由は、補うと DFD の誤りが CRUD 図に入ること。補ったセルに警告を出し、DFD を直す道を案内することで、その心配を和らげた。
- **CRUD の下書きのプロンプトは変えない**。ベースラインでは AI の CRUD 図のほうが正しかった。
- **既存のプロジェクトの DFD・CRUD 図は直さない**。再生成すると新しい規則で作られる。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
| --- | --- | --- | --- |
| `build_group_dfd_messages`(`DFD_SYSTEM_PROMPT`) | pytest(`test_data_flow_drafting.py`) | スタブ不要 ── 純粋関数(副作用なし)で、LLM を呼ばないため | 読むだけの処理の線の規則がシステムプロンプトにある |
| `merge_crud`・`infer_write_ops`・`confirm_drafts`・`validate_data_model` | pytest(`test_data_model.py`) | スタブ不要 ── 純粋関数で、DFD・ER は DB から読まず `StageSources` の要約を渡す | 書き込みに C/U/D が無いセルだけ補う(読みの R は残す・AI が書いたセルは補わない)、削除を先に見る、承認で両方の印が外れる、`DFD_WRITE_INFERRED` と案内、`DFD_WRITE_MISSING` の案内、印の無いセルは `inferred` を保存しない |
| `diff_elements`(`Element.body`) | pytest(`test_impact_diff.py`) | スタブ不要 ── 純粋関数で、前と後の model は fixture の dict を書き換えて作る | 下書き・推定の印は差分にならない |
| `toCrud`・`setCellOps` | vitest(`crudOps.test.ts`) | スタブ不要 ── 純粋関数で、外部依存を呼ばないため | 推定の印が保存の形で残り、書き換えたセルから外れる |

既存の `test_design_stage_generation.py`(段階3の生成と承認)は変えずに通る(偽 LLM の CRUD 図は書き込みに C を書くので補わない)。

```sh
cd devex-api/backend && uv run pytest tests/unit/test_data_flow_drafting.py tests/unit/test_data_model.py tests/unit/test_impact_diff.py tests/unit/test_impact_elements.py tests/unit/test_design_stage_generation.py -q
cd devex-ui && npx vitest run src/features/detailed-design/__tests__/crudOps.test.ts
```
