# Phase-18-4: ER の編集による段階3の差し戻し(BE)

## この章の目的

詳細設計モードで ER を保存・自動レイアウトしたら、承認済みの段階3を「レビュー中」に戻す。段階2の DFD の差し戻し(17-4)を、図の記法 → 段階の対応表にして ER にも広げる。

自動実装モード: on([introduction](./Phase-18-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/services/uml_diagram_service.py`](../samples/backend/app/services/uml_diagram_service.py) | 更新 | **コア** | `_reopen_data_flow_stage` を `_reopen_stage` にし、`_STAGE_OF_NOTATION`(dfd → 段階2、er → 段階3)で差し戻す段階を決める |
| ── ここからテスト ── | | | |
| [`tests/unit/test_design_stage_reopen.py`](../samples/backend/tests/unit/test_design_stage_reopen.py) | 更新 | **コア** | ER の保存・自動レイアウトで、承認済みの段階3がレビュー中に戻り版が増える |

## 要点の抜粋

```python
# app/services/uml_diagram_service.py
_STAGE_OF_NOTATION: dict[str, int] = {"dfd": DATA_FLOW_STAGE, "er": DATA_MODEL_STAGE}

async def _reopen_stage(self, diagram: UmlDiagram) -> None:
    stage = _STAGE_OF_NOTATION.get(diagram.notation)
    if stage is not None:
        await DesignStageService(self._session).mark_edited(diagram.project_id, stage)
```

`update`(保存)と `compute_layout`(自動レイアウト)の2か所から呼ぶ(17-4 と同じ場所)。

## 設計判断

### なぜ差し戻すか

段階4(モジュール一覧)は、段階3を承認した版の番号で陳腐化を判定する(Phase 15 の `input_fingerprint`)。ER は段階3の `model` の外にあるので、ER を直しても段階3の版は変わらず、段階4に「古い」が伝わらない。ER の編集を「段階3の人の編集」とみなして承認済みの段階3を差し戻すと(`mark_edited`: reviewing・version+1)、段階4が古くなり、段階3の承認もやり直しになる。

### 対応表にした

17-4 では `if diagram.notation == "dfd"` の1か所だった。ER が加わり、記法と段階の対応が2組になったので、対応表 `_STAGE_OF_NOTATION` にした。component(構成図)は段階4で同じ扱いになる見込みだが、駆動する消費者がまだ無いので足さない(#17)。

簡易ドキュメントモードのプロジェクトには段階の行が無いので、`mark_edited` は何もしない(17-4 と同じ)。ER の subject は見ない(詳細設計モードの ER は全体1枚だけ)。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `UmlDiagramService.update`・`compute_layout`(ER)→ `DesignStageService.mark_edited` | テスト関数(サービスのメソッドを直接呼ぶ) | スタブ不要 ── LLM を呼ばない。DB はインメモリ SQLite で、段階の行の状態と版が変わることそのものが検証対象のため | 承認済み(版1)→ ER の保存でレビュー中(版2)→ ER と段階3を承認し直し → 自動レイアウトでレビュー中(版3) |

ER を保存すると ER 自体の承認もやり直しになる(M7)。段階3を承認し直す前に ER を承認し直さないと、段階3の検証(`ER_NOT_APPROVED`)で止まる。テストはこの順を守って書いた。

## 動作確認(実施済み)

```bash
cd devex-api/backend
uv run pytest tests/unit/test_design_stage_reopen.py tests/unit/test_uml_diagram_service.py
# 33 passed
```
