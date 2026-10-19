# Phase-86-4: 束に結ぶ・たどる記録の API

## この章の目的

検証済みの CR を、開発者が作る新しい合意済みの版(束)に結ぶ(着手時の相談のユーザー決定「束は CR を指すだけ」)。あわせて、CR の受付から検証・束までを、時系列の行が指す先(作った文書の版・段階の版・結んだレビュー・束)と一緒にたどる API を作る([80-4](../Phase-80/Phase-80-4.md) の「CR の時系列(どの版・どの再生成・どのレビュー)の API」)。

自動実装モード: on([introduction](./Phase-86-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/change_requests/trace.py`](../samples/backend/app/change_requests/trace.py) | 新規 | `EventFacts`・`ReviewFacts`・`TraceDocument`・`TraceStage`・`TraceEntry`・`ACTION_LABEL`・`trace_entries` |
| [`app/change_requests/__init__.py`](../samples/backend/app/change_requests/__init__.py) | 更新 | 上の re-export |
| [`app/services/errors.py`](../samples/backend/app/services/errors.py) | 更新 | `ChangeRequestNotIncludableError`(409 `CR_NOT_INCLUDABLE`) |
| [`app/repositories/change_request.py`](../samples/backend/app/repositories/change_request.py) | 更新 | 入れた束を CR と一緒に読む、作成で `included_baseline=None` |
| [`app/schemas/baseline.py`](../samples/backend/app/schemas/baseline.py) | 更新 | `BaselineCreate.change_request_numbers`(重なりを除く・1以上) |
| [`app/services/baseline_service.py`](../samples/backend/app/services/baseline_service.py) | 更新 | `_includable`、束を作ると CR を結び時系列に `baseline` |
| [`app/api/routes/baselines.py`](../samples/backend/app/api/routes/baselines.py) | 更新 | docstring(404/409) |
| [`app/schemas/change_request.py`](../samples/backend/app/schemas/change_request.py) | 更新 | `TraceDocumentRead`・`TraceStageRead`・`TraceReviewRead`・`TraceEntryRead`・`ChangeRequestTraceRead`、詳細の `included_baseline_number` |
| [`app/services/change_request_service.py`](../samples/backend/app/services/change_request_service.py) | 更新 | `TraceView`・`trace`・`review_facts` |
| [`app/api/routes/change_requests.py`](../samples/backend/app/api/routes/change_requests.py) | 更新 | `GET .../trace` |
| [`tests/fixtures/change_requests.py`](../samples/backend/tests/fixtures/change_requests.py) | 更新 | `confirm_everything`(印と文書の側をすべて確かめる) |
| [`tests/unit/test_change_request_trace.py`](../samples/backend/tests/unit/test_change_request_trace.py) | 新規 | `refs` の読み解き(純粋)・束に結ぶ・たどる記録・409/404 |
| [`tests/unit/test_change_requests_api.py`](../samples/backend/tests/unit/test_change_requests_api.py) | 更新 | ルーターにパス |
| [`tests/integration/test_change_requests_flow.py`](../samples/backend/tests/integration/test_change_requests_flow.py) | 更新 | 実際の PostgreSQL で、反映 → 確認 → レビュー → 検証 → 束 → たどる記録 → CASCADE |

依存の向き: `trace.py` → `explanation.DOCUMENT_LABEL`(84-2)。`baseline_service.py` → `INCLUDABLE_STATUSES`(86-1)・`ChangeRequest`・`ChangeRequestRepository`(Phase 82)。サービス → `trace.py`・`GeneratedDocumentRepository`(既存)。

## 1. 束に結ぶ

```python
# app/services/baseline_service.py(抜粋)
async def create(project, payload, *, recorded_by) -> Baseline
    # ...今までの確かめ → _includable(渡した CR がどれもあり、検証済みで、まだ束に入っていない)
    # → 束を作る → CR ごとに included_baseline = 束、時系列に baseline {baseline_number}
```

- **`BaselineService` は CR をリポジトリで読む**: `ChangeRequestService` は `BaselineService` を使う(基準の束を読むため)ので、逆向きにサービスを import すると循環する。Phase 85 の段階の読み出しと同じ判断。
- **確かめは束を作る前**: 1つでも入れられない CR があれば、束を作らずに 409(または 404)にする。束と CR の時系列は同じトランザクションで書く。
- **1つの CR は1つの束にだけ入る**: 列 `included_baseline_id`。後の束も、前の束の内容を含むので、CR から見て「入れた束」は最初の1つでよい。
- **合意の記録は写さない**(ユーザー決定): 本文の合意の記録(相手・日時・メモ・理由)は今までどおり送る。画面(Phase 88)で、選んだ CR の合意の記録を初期値にする。
- **関係は ORM の属性で付ける**: `included_baseline_id` でなく `included_baseline = baseline` を入れる。読み込み済みの CR の関係は、外部キーの列を変えても更新されないため(作業中に、応答の `included_baseline_number` が空のままになったので直した)。

## 2. たどる記録

```python
# app/change_requests/trace.py(抜粋)
def trace_entries(events: Sequence[EventFacts],
                  available_versions: Mapping[str, Collection[int]],
                  reviews: Mapping[str, ReviewFacts]) -> list[TraceEntry]
    # 行ごとに refs を読み解く: documents → 版が今も残っているか、stage → 段階の版、
    # review_run_id / review_run_ids → 結んだ回の要点、baseline_number、model
```

- **文書の版が残っているか**: 文書は直近3版だけ残す(巡回)ので、反映で作った版が消えていることがある。`available` で示す(たどれなくなったことを隠さない)。
- **レビューは結んだ回だけ**: `refs` に id があっても、結んだ回の一覧に無いもの(消えた回)は出さない。
- **形の正しくない `refs` は読まない**: JSON の列なので、壊れた項目でたどる記録を落とさない(比較の写しの読みと同じ考え方)。
- **操作の名前**(`ACTION_LABEL`): 画面(Phase 87)の時系列に出す名前。すべての操作を覆うことをテストで確かめる。
- **API**: `GET .../{number}/trace` は、CR の番号・状態・基準の束・入れた束(`included_baseline_number`)と、起きた順の行(操作の名前・前後の状態・日時・開発者・補足・モデル名・作った文書の版・段階の版・結んだレビュー・束の番号)。CR の詳細の `events` は生の行のまま残す。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_change_request_trace.py`(新規) | `trace_entries`・`ACTION_LABEL`、`ChangeRequestService.trace`・`review_facts`、`BaselineService.create` の CR、`BaselineCreate`・`ChangeRequestTraceRead`、`ChangeRequestNotIncludableError`、ルート `get_change_request_trace`・`create_baseline`、列 `included_baseline_id` | pytest のテスト関数 | 純粋関数はスタブ不要 ── 対象が純粋(副作用なし)で外部依存を呼ばないため。サービスとルートは SQLite と `tests/fixtures/change_requests.py`(反映まで・確認をすべて済ませる)。レビューの回はリポジトリで直接作る |
| `test_change_requests_api.py`(更新) | ルーターの登録 | pytest のテスト関数 | スタブ不要 ── OpenAPI のパスを読むだけ |
| `test_change_requests_flow.py`(integration、更新) | 検証・確認・レビューを結ぶ・束の `change_request_numbers`・たどる記録・CASCADE | httpx の AsyncClient | 文書の生成の LLM だけ、解決を FakeLLM に差し替える(`stub_llm_resolver`)。レビューの回はセッションで直接作る |

- 読み解き: 文書の版(残っている / 消えた / 壊れた行)・モデル名・段階の版・結んだ回(消えた回は出さない)・束の番号・操作の名前。
- 束: 番号の重なりを除く / 0 は 422 / 検証の前は 409 / 検証の後に束 B-2 に入り、時系列と `included_baseline_number` / 2回目は 409 / 無い CR は 404。
- たどる記録: 作成 → 説明 → 合意 → 反映 → レビュー → 検証 → 束 の順と、各行の指す先。
- integration: 段階が無いプロジェクトでは印は無く、文書の側だけで検証の可否が決まる / 409 `CR_NOT_VERIFIABLE`・`CR_REVIEW_NOT_LINKABLE` / 束 B-2 とたどる記録 / プロジェクトの削除で結んだレビューの行も消える。
