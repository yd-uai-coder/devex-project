# Phase-19-4: 構成図の編集による段階4の差し戻し(BE)

## この章の目的

詳細設計モードで構成図を保存・自動レイアウトしたら、承認済みの段階4を「レビュー中」に戻す。構成図は段階4の内容の一部だが、正本は段階の `model` の外(`uml_diagrams`)にある。段階の保存を経ずに内容が変わっても、承認をやり直させ、後ろの段階(段階5)に「古い」を伝えるためである。

自動実装モード: on([introduction](./Phase-19-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/services/uml_diagram_service.py`](../samples/backend/app/services/uml_diagram_service.py) | 更新 | **コア** | `_STAGE_OF_NOTATION` に `"component": STRUCTURE_STAGE` を足す |
| ── ここからテスト ── | | | |
| [`tests/unit/test_design_stage_reopen.py`](../samples/backend/tests/unit/test_design_stage_reopen.py) | 更新 | **コア** | 構成図の保存・自動レイアウトで、承認済みの段階4がレビュー中に戻り版が増える |

## 要点の抜粋

```python
# app/services/uml_diagram_service.py
# 詳細設計モードで、図がどの段階の内容の一部か(図の編集でその段階を差し戻す。Phase 17〜19)
_STAGE_OF_NOTATION: dict[str, int] = {
    "dfd": DATA_FLOW_STAGE,
    "er": DATA_MODEL_STAGE,
    "component": STRUCTURE_STAGE,
}
```

`update`(保存)と `compute_layout`(自動レイアウト)が呼ぶ `_reopen_stage` は変えない。対応表に1行足すだけで、構成図にも同じ差し戻しが効く。

## 設計判断

### 記法 → 段階の対応表に足すだけで済む

Phase 18(18-4)で、図の編集による差し戻しを「記法 → 段階」の対応表にまとめた。段階4の構成図は3つ目の消費者で、新しい分岐は要らない。`DesignStageService.mark_edited` は、承認済みの段階だけを差し戻し、段階の行が無いプロジェクト(簡易ドキュメントモード)では何もしない。そのため、簡易ドキュメントモードの component 図(ステージ3)を編集しても段階は動かない。

### 座標だけの保存でも差し戻す

構成図の保存は、座標だけの変更でも図の承認をやり直す(Phase 12 の M7)。段階4もそれに合わせて差し戻す。図の承認と段階の承認がずれない(「図は未承認なのに段階は承認済み」にならない)ことを優先した(DFD・ER と同じ)。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `UmlDiagramService.update / compute_layout`(構成図)→ `DesignStageService.mark_edited`(段階4)、`STRUCTURE_STAGE` | pytest(サービスのメソッドを直接呼ぶ) | スタブ不要 ── LLM を呼ばない。DB はインメモリ SQLite で、スタブにはしない(段階の行の状態と版が変わることそのものが検証対象のため) | 段階4を承認 → 構成図を保存 → レビュー中・version 2 → 構成図と段階4を承認し直す → 自動レイアウト → レビュー中・version 3。承認時に検証の指摘が無いこと |

## 動作確認(実施済み)

```bash
cd devex-api/backend
uv run pytest tests/unit/test_design_stage_reopen.py tests/unit/test_uml_diagram_service.py
# 34 passed
```
