# Phase-17-3: 段階2の下書きの生成(BE)

## この章の目的

17-1・17-2 の純粋関数を使って、段階2の下書きの生成を受け付け・実行できるようにする。Phase 16 で作った「受け付けとバックグラウンドの実行」の仕組みに、段階2を登録する。

- 段階2の生成は、段階の `model` のほかに、機能グループの DFD(`uml_diagrams`)とデータ項目(`data_items`)も書く。全部を1つのトランザクションで書き、失敗したらまとめて取り消す。
- そのため、生成の関数に渡す引数を `StageGenerationContext` にまとめる(段階1の生成も追従)。
- データ項目の名前の解決を、UML 図の生成と共有する(`DataItemService.resolve_by_name`)。
- 段階の検証・生成に渡す入力に、承認済みの段階1の内容と DFD の要約を足す。

学習モード([introduction](./Phase-17-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/services/data_item_service.py`](../samples/backend/app/services/data_item_service.py) | 更新 | **コア** | `resolve_by_name`(名前でデータ辞書に解決し、無い項目だけ作る。commitしない) |
| [`app/services/uml_generation_service.py`](../samples/backend/app/services/uml_generation_service.py) | 更新 | 定型 | `_resolve_data_items` の本体を `DataItemService.resolve_by_name` に移した |
| [`app/services/design_stage_service.py`](../samples/backend/app/services/design_stage_service.py) | 更新 | **コア** | `_sources`(文書の本文・承認済みの段階の内容・DFD の要約)、`_dfd_summary` |
| [`app/services/errors.py`](../samples/backend/app/services/errors.py) | 更新 | 定型 | 文書文字列だけ(`DESIGN_STAGE_INVALID` を生成の受け付けでも使う旨) |
| [`app/services/design_stage_generation_service.py`](../samples/backend/app/services/design_stage_generation_service.py) | 更新 | **コア** | `StageGenerationContext`、`_invoke_structured`、`generate_data_flow`・`_save_group_dfd`、`STAGE_GENERATORS[2]`、`_has_draft`・`_check_request` |
| [`app/api/routes/design_stages.py`](../samples/backend/app/api/routes/design_stages.py) | 更新 | 定型 | 文書文字列だけ |
| ── ここからテスト ── | | | |
| [`tests/unit/test_design_stage_generation.py`](../samples/backend/tests/unit/test_design_stage_generation.py) | 更新 | **コア** | 段階2の生成(DFD・データ項目まで書く、再生成、失敗時の取り消し、上限、グループ無し)、`resolve_by_name` |

既存の [`tests/unit/test_uml_generation_service.py`](../samples/backend/tests/unit/test_uml_generation_service.py)(変更なし)が、移した名前の解決の写経ミスの番人になる(#12-4)。

## 要点の抜粋

```python
# app/services/design_stage_generation_service.py
@dataclass(frozen=True)
class StageGenerationContext:
    llm: Any
    sources: StageSources          # 文書の本文・承認済みの段階の内容・DFD の要約
    previous: Mapping[str, Any] | None
    fingerprint: Fingerprint       # 生成した時点の入力の版(DFD の source_doc_versions にも記録)
    session: AsyncSession          # 段階2が DFD・データ項目を書く(commit は execute が1回だけ)
    project_id: uuid.UUID

StageGenerator = Callable[[StageGenerationContext], Awaitable[dict]]

async def generate_data_flow(context) -> dict:
    summary = await _invoke_structured(llm, ProcessSummaryGenerationOutput, build_summary_messages(...))
    model = merge_summaries(to_summary_drafts(summary), function_list, previous)
    for group in model.dfd_groups:
        output = await _invoke_structured(llm, GroupDfdGenerationOutput, build_group_dfd_messages(...))
        converted = to_dfd_output(output, functions)
        ids_by_name = await data_items.resolve_by_name(project_id, required_data_items(converted))
        await _save_group_dfd(context, group, to_dfd(converted, ids_by_name))   # 同じ subject の行を上書き
    return model.model_dump(mode="json")

STAGE_GENERATORS = {1: generate_function_list, 2: generate_data_flow}
```

```python
# app/services/design_stage_service.py
async def _sources(self, project_id, rows, views, documents) -> StageSources:
    diagrams = await self._diagrams.list_by_notation(project_id, "dfd")
    return StageSources(
        documents={...},                                            # 表示中の版の本文
        stages={s: row.model for s, row in rows.items() if views[s].state == "approved" and row.model},
        dfd_diagrams={d.subject: _dfd_summary(d) for d in diagrams},
    )
```

`_save_group_dfd` は、図を `status='draft'`・`version+1`・`layout_model=None` にする(UML 図の再生成と同じ。配置は画面で最初に開いたときに自動レイアウトする)。

## 設計判断

### 一括生成は1トランザクション

処理概要表 → グループ1の DFD → グループ2の DFD … を順に呼び、段階の保存と一緒に最後に1回だけ commit する。途中で失敗(クォータ超過・解釈の失敗)したら、既存の `execute` の rollback で、作りかけの DFD とデータ項目も消える。

- 半端に書くと「処理概要表は新しいが DFD の一部は古い」状態が残り、どこまで作り直したのか人に分からない。
- 代わりに、クォータ超過で途中まで進んでも全部やり直しになる。1回で呼ぶ LLM は最大6回(概要表1+DFD 5)なので、許容した。

### 選べるグループは5つまで(生成の受け付けでも止める)

1グループで LLM を1回呼び、再試行込みで1〜2分かかる。5グループなら15分の回収のしきい値([Phase 15](../Phase-15/Phase-15-introduction.md))に収まる。上限を超えたまま生成を求められたら、受け付けで 409 `DESIGN_STAGE_INVALID` にする(画面でもチェックボックスを止める。17-6)。検証のエラー(17-1)だけでは、生成を押せてしまうためである。

### 段階2の「初回」は、処理概要表の行で判定する

段階2は、人がグループの選択を保存してから初めて生成する。`model` があるかで判定すると、初回の生成が「再生成済(未承認)」(`regenerated`)になってしまう。`_has_draft` で、段階2は処理概要表の行があるかで判定する(画面の `hasDraft` も同じ規則。17-6)。

### 生成の関数の引数を文脈オブジェクトにまとめる

Phase 16 の `StageGenerator` は `(llm, sources, previous)` で、DB を知らなかった。段階2は DFD とデータ項目を同じトランザクションで書くので、セッションとプロジェクトが要る。引数を足し続けると段階ごとに使わない引数が増えるので、`StageGenerationContext` にまとめた。駆動する消費者は段階2の生成である(#17)。

### データ項目の名前の解決を共有する

UML 図の生成の `_resolve_data_items` と同じ処理が段階2でも要る。コピーせず `DataItemService.resolve_by_name` に移し、両方から呼ぶ(#17)。commit しないのは、呼び出し元の生成と同じトランザクションで、失敗時に一緒に消すためである。

### 段階の入力に、承認済みの段階1の内容と DFD の要約を足す

- 承認済み(古くない)の段階の内容だけを入れる。後ろの段階は、承認済みの前の段階だけを入力にする(docs/external_design.md 2.7節)。
- DFD は `notation='dfd'` の行をすべて要約する。詳細設計モードのプロジェクトには内部設計書が無く、DFD はすべて段階2のものだからである。

### 生成中の DFD の編集は、画面で止める

生成中は段階2の行が `generating` になるが、DFD の行は `generating` にしていない。DFD の行まで印を付けると、失敗・回収のときに図の印も戻す処理が要るためである。生成中は画面が DFD のエディタとデータ辞書の表を出さない(17-7・17-8)。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `DesignStageGenerationService`(段階2)・`generate_data_flow`・`DesignStageService` の入力と承認 | pytest(サービスのメソッドを直接呼ぶ) | `FakeLLM`(Gemini の代わり。`structured_sequence` で概要表 → DFD の順に返す) | 第一テストの統合スモーク(処理概要表・DFD・データ項目を書き、DFD を承認すると段階2を承認できる)。再生成でグループを引き継ぎ図を上書き、失敗で DFD・データ項目も消える、上限で受け付けを断る、グループ無しなら概要表だけ |
| `DataItemService.resolve_by_name` | pytest | スタブ不要。DB はインメモリ SQLite で、行の作成そのものが検証対象 | 既存はフィールドを変えずに使い、無い名前だけ作る。commit しない(rollback で消える) |
| `generate_function_list`(引数の変更) | pytest | `FakeLLM` | `StageGenerationContext` で呼べること |

DB はスタブにしない(段階・図・データ項目の行が1つのトランザクションで動くことそのものが検証対象のため)。スタブにするのは、外部サービスの LLM だけである。

## 動作確認(実施済み)

```bash
cd devex-api/backend
uv run pytest tests/unit/test_design_stage_generation.py tests/unit/test_uml_generation_service.py tests/unit/test_design_stage_service.py
# 46 passed
```
