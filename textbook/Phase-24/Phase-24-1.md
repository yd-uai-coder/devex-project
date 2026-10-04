# Phase-24-1: 偽 LLM の契約テスト(BE)

## この章の目的

E2E 用の偽 LLM(`E2eFakeLLM`)が返す段階1〜7の下書きが、本物の生成・検証・承認・出力の経路を通ることを、ブラウザを使わない単体テストで確かめる。

これまでテストで確かめていたのは、段階1の出力だけだった。段階2〜7はコードを読んで「通るはず」と判断していた。このテストがあれば、24-3 の E2E が落ちたときに、原因が画面にあるのか、偽 LLM の出力にあるのかを切り分けられる。

学習モード([introduction](./Phase-24-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`tests/unit/test_fake_llm_detailed_design.py`](../samples/backend/tests/unit/test_fake_llm_detailed_design.py) | 新規 | **コア** | 偽 LLM で段階1〜7を生成し、図を配置・承認し、段階を承認して zip を作る |

`app/ai/llm/fake.py` は変更していない。テストが一度で通ったため。

## 要点の抜粋

画面の操作と同じ順に、サービスのメソッドを呼ぶ。生成は画面と同じく「受け付け → 実行」の2段で呼ぶ。実行は、本来は `BackgroundTasks` が行うところを、テストから直接呼ぶ。

```python
# tests/unit/test_fake_llm_detailed_design.py
async def _generate(session, project, stage, llm, **targets) -> None:
    service = DesignStageGenerationService(session)
    await service.request_generation(project, stage=stage, **targets)
    await service.execute(
        project_id=project.id, user_id=project.user_id, stage=stage, llm=llm, **targets
    )
    read = await DesignStageService(session).read(project.id, stage)
    assert read.generation_status == "completed", (stage, read.generation_error)
```

図(DFD・ER・構成図)は、画面で開いたときと同じく、自動レイアウトしてから承認する。図の承認には配置が要るため。

```python
# tests/unit/test_fake_llm_detailed_design.py
laid_out = await diagrams.compute_layout(project_id=project.id, diagram_id=diagram.id)
await diagrams.approve(project_id=project.id, diagram_id=diagram.id, expected_version=laid_out.version)
```

段階を承認する前に、`validate_stage` の結果を見る。`approve` は、エラーがあると `DesignStageInvalidError` を投げるだけで、どのコードかを返さない。そこで先に検証の結果を見ておき、落ちたときにコードが分かるようにする。

```python
# tests/unit/test_fake_llm_detailed_design.py
row, _, sources = await stages.stage_view(project, stage)
issues = validate_stage(stage, row.model, sources)
assert not has_errors(issues), (stage, [i for i in issues if i.severity == "error"])
await stages.approve(project, stage=stage, expected_version=row.version)
```

段階2・5・6は、生成の前に選択を保存する。画面の「保存する」に当たる。

| 段階 | 選択 |
|---|---|
| 2 | DFD を描くグループ |
| 5 | 手順を書く処理 |
| 6 | 詳細を書く関数 |

段階6で選ぶ関数は、偽 LLM の段階5の手順にある呼び出し先と関数(`app/services/reservation.py` の `ReservationService.create`)にする。

## 設計判断

### 契約を固定する層: E2E ではなく、サービスの経路

偽 LLM の出力が本物の規則に従っているか(契約)は、E2E でも確かめられる。ただし、E2E で落ちると、原因の候補が多すぎる。

- 画面のラベル
- ポーリングの待ち方
- 自動レイアウトの時間
- 偽 LLM の出力

そこで、契約だけを、ブラウザを使わない層で固定する。このテストは約3秒で終わり、`pytest` の全体の中で毎回流れる。E2E は手元でしか流していないので、偽 LLM を直したときに契約が壊れても、こちらで先に気づける。

なお、検証の関数(`validate_stage`)を直接呼ぶだけのテストにはしなかった。それでは、次の2つの食い違いを拾えないため。

- 生成の経路(`STAGE_GENERATORS` が下書きを model に整える処理、段階2の DFD とデータ項目の保存)
- 承認の経路(図の配置、`*_NOT_APPROVED`)

### 偽 LLM は「検証される側」

普段の BE のテストの `FakeLLM`(`tests/fixtures/fake_llm.py`)は、テストごとに台本を注入するスタブだ。SUT はサービスで、LLM はその外側にある。

このテストでは、`E2eFakeLLM` の固定の出力そのものが、確かめたい対象(SUT の一部)になる。差し替えのためのスタブではない。

## テスト観点(#14)

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_e2e_fake_outputs_pass_stages_1_to_7_and_bundle` | `E2eFakeLLM` の構造化出力と、それを受ける生成・検証・承認・出力の経路(`DesignStageGenerationService`・`DesignStageService`・`UmlDiagramService`・`DetailedDesignExportService`) | テスト関数(画面の操作と同じ順にメソッドを呼ぶ) | なし。偽 LLM は検証される側。DB はインメモリ SQLite、図の配置はレイアウトエンジンで実際に計算する |

最後に、次の2つを確かめる。

- 7段階すべての状態が `approved` になる。
- zip に `detailed_design.{html,md}`・`implementation_plan.{html,md}`・`diagrams/` が入る。

## 動作確認(実施済み)

```bash
cd devex-api/backend
uv run pytest tests/unit/test_fake_llm_detailed_design.py
# 1 passed(約3秒)
```
