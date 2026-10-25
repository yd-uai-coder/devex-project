# Phase-106-3: DFD・データ辞書だけを直した承認の印

## この章の目的

段階を生成で作り直したまま(`regenerated`)承認すると、前の段階へ印を送らない(Phase 99 の調整。生成の結果が前の段階を直す必要を生むことはまれで、毎回の見直しが手間になるため)。人が直して保存した後の承認は送る。ところが段階2 の DFD・データ辞書(段階3 の ER・段階4 の構成図も)は段階の外の表にあり、そこだけを直しても段階は `regenerated` のままで、人が直したのに前の段階へ印が行かなかった(Phase 99 の知られた限界)。この章で、段階の外を直す保存を「人が直した」とみなす(着手時の相談 5。保存の記録で判定)。

自動実装モード: on([introduction](./Phase-106-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 内容 |
| --- | --- |
| [`backend/app/services/design_stage_service.py`](../samples/backend/app/services/design_stage_service.py) | `mark_edited` が `regenerated` の段階もレビュー中にする |
| [`backend/tests/unit/test_design_stage_reopen.py`](../samples/backend/tests/unit/test_design_stage_reopen.py) | データ辞書を直すと `regenerated` の段階2 がレビュー中になるテストを足した |
| [`backend/tests/unit/test_design_stage_impact.py`](../samples/backend/tests/unit/test_design_stage_impact.py) | 段階の外を直した後の承認で前の段階へ印が行くテストを足した |

## 1. `mark_edited` を生成で作り直したままの段階にも

```python
# app/services/design_stage_service.py(抜粋)
async def mark_edited(self, project_id: uuid.UUID, stage: int) -> bool:
    row = await self._stages.get(project_id=project_id, stage=stage)
    if row is None or row.status not in ("approved", "regenerated"):
        return False
    row.status = STATUS_AFTER_EDIT   # reviewing
    row.version += 1
```

- `mark_edited` は、DFD・データ辞書・ER・構成図の保存(`DataItemService`・`UmlDiagramService`)が呼ぶ。これまでは承認済みの段階を差し戻すだけだった。
- `regenerated` も、段階の `model` を人が保存したときと同じ `reviewing` にする。承認の側(`approve` の `min_target`)は変えない。`reviewing` からの承認は、前の段階へも印を送る。
- 判定は「保存があったか」にした(相談の決定)。DFD・データ辞書は履歴を持たないので、生成直後の形と比べるには写しを新しく持つ必要がある。人が保存したなら直す意図があったとみなせるので、保存の記録で足りる。
- 印の中身は段階の `model` の差分から作る(DFD・データ辞書は影響の要素ではない)。前の段階へ届くのは、作り直しで変わった段階の `model` の差分である。
- version を増やすので、画面が古い version のまま承認すると 409 になる(承認済みの段階で今までも同じ)。マイグレーションは無い。

## テスト観点

- `test_design_stage_reopen.py`(足した1件)
  - SUT: `DataItemService.create` から `DesignStageService.mark_edited`。ドライバ: テスト関数。スタブ不要 ── LLM を呼ばず、段階の行の状態と版が検証対象のため DB はインメモリ SQLite。
  - `regenerated` の段階2 でデータ辞書を足すと、レビュー中になり版が1つ増える。下書き・簡易モードは今までどおり何もしない(既存のテスト)。
- `test_design_stage_impact.py`(足した1件)
  - SUT: `mark_edited` の後の `DesignStageService.approve`。ドライバ: テスト関数。スタブ: DB はインメモリ SQLite、段階1〜8 は承認済みの fixture。段階ごとの検証は外す(印の記録だけを見る)。
  - 生成で作り直した段階4 で構成図を直した(`mark_edited`)後の承認は、前の段階へ印を送る。直さずに承認すると送らないことは既存のテストのまま。
