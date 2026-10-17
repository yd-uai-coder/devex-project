# Phase-69-1: 生成の失敗をプロジェクトに記録する

## この章の目的

設計書・テスト仕様書の生成(再生成・テスト仕様書の作り直し・チャットからの最初の生成)が失敗したとき、今は状態を生成の前に戻し、画面に出ないチャットの行を1つ書くだけだった。そのため画面は、失敗したのか成功したのかを見分けられない。この章では、失敗の理由・作り直そうとした文書・日時をプロジェクトに記録し、`GET /projects/{id}` で返す。あわせて、キーが無くて LLM を解決できない失敗(Phase 68 の `LlmUnavailableError`)を、ほかの失敗と分けて案内する。画面の側は [69-3](./Phase-69-3.md)。

自動実装モード: on([introduction](./Phase-69-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/uml/generation/failures.py`](../samples/backend/app/uml/generation/failures.py) | 更新 | 理由のコードに `LLM_UNAVAILABLE` を足し、`LlmUnavailableError` をそれに分類する |
| [`app/services/design_stage_generation_service.py`](../samples/backend/app/services/design_stage_generation_service.py) | 更新 | 段階の下書きの文言に `LLM_UNAVAILABLE` を足す |
| [`app/models/project.py`](../samples/backend/app/models/project.py) | 更新 | `generation_failure`(JSON。NULL 可) |
| [`alembic/versions/a7d3c9e1f5b2_add_generation_failure_to_projects.py`](../samples/backend/alembic/versions/a7d3c9e1f5b2_add_generation_failure_to_projects.py) | 新規 | `projects.generation_failure` を足す |
| [`app/schemas/project.py`](../samples/backend/app/schemas/project.py) | 更新 | `GenerationFailureRead`・`ProjectRead.generation_failure` |
| [`app/services/doc_generator_service.py`](../samples/backend/app/services/doc_generator_service.py) | 更新 | 理由ごとの文言の表・`failure_record`・失敗と回収で書き、受け付けで消す |
| [`app/services/project.py`](../samples/backend/app/services/project.py) | 更新 | 詳細の取得で `generation_failure` を返す |
| [`tests/unit/test_generation_failure.py`](../samples/backend/tests/unit/test_generation_failure.py) | 新規 | 記録・分類・受け付けで消す・回収・取得 |
| [`tests/unit/test_doc_generation_guard.py`](../samples/backend/tests/unit/test_doc_generation_guard.py) | 更新 | 出力を解釈できない失敗の文言が理由のものになる |

## 1. 理由の分類を共有する(`failures.py`)

```python
# app/uml/generation/failures.py(要点)
ReasonCode = Literal[
    "QUOTA_EXCEEDED", "TOKEN_LIMIT", "INVALID_OUTPUT",
    "LLM_UNAVAILABLE",          # 使う AI のキーが自分にも既定にも無い
    "GENERATION_FAILED", "STALE_GENERATION",
]

def classify_failure(exc: BaseException) -> GenerationFailure:
    if isinstance(exc, LLMQuotaExceededError): reason = "QUOTA_EXCEEDED"
    elif isinstance(exc, LlmUnavailableError): reason = "LLM_UNAVAILABLE"
    ...
```

- 分類は UML 図・段階の下書きがすでに使っている `classify_failure` を、設計書の生成でも使う(#17。同じ「例外 → 理由」の事実を3か所目でコピーしない)。文言は使う側ごとに持つ(UML 図は「設計図」、段階は「下書き」、設計書は「設計書」と言い換えるため)。
- `LlmUnavailableError` は解決の段階で出る(呼び出しの前)ので、`invoke_with_retry` に包まれない。そのまま `isinstance` で見分けられる。
- 段階の下書きの文言にも `LLM_UNAVAILABLE` を足した。「使うAIのAPIキーが設定されていないため、下書きを作れませんでした。マイページでモデルかAPIキーを見直してください。」(Phase 68 の申し送り「解決できないときの段階の文言」の解消)。

## 2. 失敗の記録(`projects.generation_failure`)

```python
# app/models/project.py(要点)
generation_failure: Mapped[dict | None] = mapped_column(PortableJSON, nullable=True)
# {reason_code, message, targets, failed_at}。失敗していなければ None
```

```python
# app/schemas/project.py(要点)
class GenerationFailureRead(BaseModel):
    reason_code: str
    message: str
    targets: list[str]          # 作り直そうとした文書(上流から。テスト仕様書は "test_spec")
    failed_at: datetime

class ProjectRead(BaseModel):
    ...
    generation_failure: GenerationFailureRead | None = None
```

- **置き場**(着手時の相談。推奨どおり): プロジェクトに「直近の失敗」の列を1つ持つ。生成の記録のテーブル(回ごとの履歴)を作る案は、履歴が残る代わりにテーブル・API・画面の取得が増える。画面に要るのは「直近の生成が失敗したか、なぜか」だけで、段階の `generation_error` と同じ考え方で足りる。
- `targets` を持つのは、詳細設計画面のテスト仕様書が「テスト仕様書を作り直そうとした失敗」だけを出すため(設計書だけの再生成の失敗はプレビューに出す)。
- `ProjectRead` に足したので、一覧(`GET /projects`)にも載る。一覧は今は使わない。

## 3. 書く・消す(`doc_generator_service.py`)

```python
# app/services/doc_generator_service.py(要点)
_FAILURE_MESSAGES: dict[ReasonCode, str] = {
    "QUOTA_EXCEEDED": "本日の利用上限に達しました。時間をおいて再度お試しください。",
    "LLM_UNAVAILABLE": "使うAIのAPIキーが設定されていないため、設計書を作れませんでした。マイページで…",
    "GENERATION_FAILED": "設計書の生成に失敗しました。時間をおいて再度お試しください。",
    ...
}

def failure_record(reason: ReasonCode, targets: Sequence[str], now: datetime) -> dict: ...
```

| いつ | すること |
|---|---|
| 生成の受け付け(`request_generation`) | `generating` にするのと同じ commit で `generation_failure = None`(前の失敗の知らせを消す) |
| 生成の失敗(`generate` の `except`) | rollback・状態を戻す・**`classify_failure` の理由で記録**・同じ文言をチャットの行にも書く(今までどおり) |
| 止まった生成の回収(`recover_if_stale`) | `STALE_GENERATION` で記録する。作り直そうとした文書は Redis の進み具合から読む(TTL は回収の15分より長い1時間)。消えていればモードの全部 |

- 文言の表は、今までの `_QUOTA_MESSAGE`・`_FAILED_MESSAGE`・`_STALE_MESSAGE` を取り込んだ。割り当ての超過・その他・止まった生成の文言は変えていない。**変わるのは、トークンの上限・出力を解釈できない・キーが無いの3つ**(今までは「設計書の生成に失敗しました」にまとめていた)。既存の `test_doc_generation_guard.py` は、出力を解釈できない失敗の文言を期待していたので、新しい文言に替えた。
- 失敗の記録の「作り直そうとした文書」は `_failure_targets(mode, start_from)`。起点がモードに無い失敗(`GenerationStartInvalidError`)そのものを記録するとき、もう一度 `generation_targets` を呼ぶと同じ例外が出るため、モードの全部に読み替える。
- 削除されたプロジェクトの失敗は記録しない(Phase 64 の `project_vanished` の後に書くので、今までと同じ)。

`ProjectService.get_detail` は `ProjectDetail` を手で組み立てているので、`generation_failure=project.generation_failure` を足した(`model_validate` で作る一覧・作成は何もしなくても載る)。

## テスト観点

| テスト | SUT | ドライバ | スタブ | 観点 |
|---|---|---|---|---|
| `test_generation_failure.py` | `failure_record`・`classify_failure`(純粋関数)・`DocGeneratorService`(`generate`・`request_generation`・`recover_if_stale`)・`ProjectService.get_detail` | pytest の関数 | 純粋関数はスタブ不要 ── 例外と値から記録を作るだけで外部を呼ばないため。生成は FakeLLM(失敗する構造化出力)・StubResolver(キーが無いときの解決の失敗)・FakeRedis(止まった生成の進み具合)。DB はテスト用の SQLite | 記録の形 / キーが無い失敗を分ける(段階の文言も) / 失敗で全部の対象を記録しチャットにも同じ文言 / 割り当ての超過(`_is_quota_error` を差し替えて `invoke_with_retry` の読み替えを通す) / 解決の失敗は `LLM_UNAVAILABLE` / 起点からの対象・受け付けで消す / 回収は進み具合の対象と回収の時刻 / 詳細と一覧の読み出しに載る |
| `test_doc_generation_guard.py` | `DocGeneratorService.generate` | pytest の関数 | FakeLLM(途中で解釈できない出力) | 途中の失敗は版を残さず、理由の文言(`INVALID_OUTPUT`)で記録する |

この章で作成・更新した本体のファイルは、すべて `test_generation_failure.py` が import する(`models/project.py`・`schemas/project.py` は `Project`・`ProjectRead` を通して、`design_stage_generation_service.py` は `_MESSAGES` を直接)。マイグレーションは dev の DB で upgrade と往復を確かめた([introduction](./Phase-69-introduction.md) の検証結果)。
