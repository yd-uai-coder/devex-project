# Phase-29-5: 手順書の単位への表示とスタブの候補(BE + FE)

## この章の目的

段階8の単位の詳細で、段階5の手順の参照を展開したときにシーケンス図を出す。展開した md(手順書の生成の入力、Phase 30 の AI 向けの出力)にも同じ図を Mermaid で入れる。あわせて、手順書のテスト観点のスタブの欄が、図で SUT から呼ばれないモジュール(手順に無い依存)を挙げていれば、段階8の検証の軽微な指摘にする。

自動実装モード: on([introduction](./Phase-29-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/detailed_design/procedure_doc_refs.py`](../samples/backend/app/detailed_design/procedure_doc_refs.py) | 更新 | `ExpandedRef.svg`・`ref_sequence`。`expand_ref`(手順)の表の後に Mermaid、`unit_context` が手順の参照に SVG を付ける |
| [`app/detailed_design/validation.py`](../samples/backend/app/detailed_design/validation.py) | 更新 | `_stub_issues`(`STUB_OUTSIDE_SEQUENCE`。軽微・段階5) |
| [`app/schemas/design_stage.py`](../samples/backend/app/schemas/design_stage.py) | 更新 | `DesignRefRead.svg` |
| [`src/features/detailed-design/api/types.ts`](../samples/frontend/src/features/detailed-design/api/types.ts) | 更新 | `DesignRefRead.svg` |
| [`src/features/detailed-design/components/UnitProcedureEditor.tsx`](../samples/frontend/src/features/detailed-design/components/UnitProcedureEditor.tsx) | 更新 | 展開した参照に SVG があれば、md の上に `SequenceSvg` で出す |
| ── ここからテスト ── | | |
| [`tests/unit/test_procedure_doc_refs.py`](../samples/backend/tests/unit/test_procedure_doc_refs.py) | 更新 | 手順の参照の md の末尾が 05 と同じ Mermaid のブロック、SVG は手順の参照だけ |
| [`tests/unit/test_procedure_doc_validation.py`](../samples/backend/tests/unit/test_procedure_doc_validation.py) | 更新 | スタブが図の候補の外なら軽微・段階5の警告、SUT の名前・図に無い SUT は判断しない |
| [`src/features/detailed-design/components/__tests__/UnitProcedureEditor.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/UnitProcedureEditor.test.tsx) | 更新 | 手順の参照を展開すると SVG が出て、他の参照には出ない |

BE のパスは `devex-api/backend/`、FE のパスは `devex-ui/` 基準。`procedure_doc_refs.py` は 29-3 の `sequence_block`・`to_sequence_svg` を、`UnitProcedureEditor.tsx` は 29-4 の `SequenceSvg` を読む。

## 要点の抜粋

```python
# app/detailed_design/procedure_doc_refs.py
def ref_sequence(ref, book) -> SequenceDiagram | None   # 手順の参照で解決できるときだけ(依存先は段階4)
def expand_ref(ref, book):                              # 手順: 表 + 注記 + sequence_block(05 と同じ)
ExpandedRef(..., markdown=expand_ref(ref, book), svg=_ref_svg(ref, book))
```

```python
# app/detailed_design/validation.py
def _stub_issues(doc, unit, index, triggers) -> list[StageIssue]:
    # 単位の処理の図ごとに、テスト観点の SUT を参加者に対応させ(sut_participant)、
    # 候補 = SUT + SUT から呼ぶ先(reachable_callees)。スタブの欄が候補の外のモジュールを
    # 挙げていれば STUB_OUTSIDE_SEQUENCE(minor, fix_stage=5, target=処理ID, unit=単位の ID)
```

## 設計判断

### 展開の md に Mermaid を入れる(Claude の判断)

参照の展開は、手順書の生成の入力・画面の単位の詳細・AI 向けの出力(Phase 30)の3か所で共有している(28-1)。手順の展開に図を入れておけば、3か所が同じ図を持つ。生成の AI は、表の行と図の矢印を同じ手順番号で読める。画面にはさらに SVG を返す(Mermaid の描画を画面に持たないため)。

### 色の強調はしない(撤回)

[25-5](../Phase-25/Phase-25-5.md) の見本では、単位の図に単位のファイル・選んだテストの SUT・スタブの候補を色で示した。本実装では図をバックエンドの SVG にしたので、テストを選ぶたびに色を変えるには導出を画面にも持つことになる(29-2 で避けた二重管理)。そこで色付けはやめ、スタブの候補の突き合わせは検証の指摘として出す。撤回は [`docs/external_design.md`](../../docs/external_design.md) 2.8節に `[Phase 29 で確定 ── …]` の形で残した。

### スタブの候補の指摘を軽微・段階5にする

[25-5](../Phase-25/Phase-25-5.md) の見本で見つかった穴(TC-01 のスタブ `project_repository` が手順に無い)は、手順の側の不足(リポジトリを呼ぶ行が無い)だった。そこで直す先は段階5にした。ただし観点の側の書き過ぎのこともあり、名前の突き合わせはファイル名からの推測(拡張子・`_`・`-` を除いた小文字の部分一致)なので、重要度は軽微にした。

- SUT 自身のモジュールは候補に含める(「reservations の外側だけをフェイク」のような書き方で、SUT の名前がスタブの文に出ることがある)。
- SUT が図の参加者に対応しなければ判断しない(画面のテストなど)。
- 候補なのにスタブに無いものは指摘しない(本物を使う結合テストなど)。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `unit_context`・`expand_ref`・`ref_sequence` | pytest(`test_procedure_doc_refs.py`) | スタブ不要 ── 純粋で、段階の内容(dict)だけから決まるため | 手順の参照の md は `sequence_block(to_sequence(...))` で終わる。SVG は手順の参照だけ |
| `validate_procedure_doc`(`_stub_issues`) | pytest(`test_procedure_doc_validation.py`) | スタブ不要(同上) | 段階4にリポジトリを足し、スタブの欄にそれを書くと `STUB_OUTSIDE_SEQUENCE`(minor・段階5・F-01・M-01-T02)。SUT の名前だけ・図に無い SUT は指摘しない。fixture のままなら指摘0件(既存の第一テスト) |
| `UnitProcedureEditor` | vitest + Testing Library | スタブ: 参照の API(`getUnitContext`。サーバーが展開した設計と SVG を返す) | 手順の参照を開くと `role="img"` の図が出て、07章を開くと出ない |
