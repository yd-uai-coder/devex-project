# Phase-10-6: API 層とプレースホルダーの廃止

## この章の目的

`POST /projects/{id}/uml/diagrams` を、Phase 8 のプレースホルダー(空の draft を 201 で返す)から、AI 生成の受け付け(202 と生成履歴を返し、バックグラウンドで実行する)に差し替える。あわせて、FE が使う3つの GET を追加する。図の一覧(ポーリング用)、生成対象の候補、生成履歴である。プレースホルダーだった `UmlDiagramService.create` はここで削除する。

学習モード([introduction](./Phase-10-introduction.md)参照)。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/`基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/schemas/uml_generation.py`](../samples/backend/app/schemas/uml_generation.py) | 新規 | 定型 | `UmlSubjectSpec`・`UmlGenerateRequest`・`DfdSubjectRead`・`UmlCandidatesRead`・`UmlGenerationResultRead`・`UmlGenerationRunRead` |
| [`app/schemas/uml_diagram.py`](../samples/backend/app/schemas/uml_diagram.py) | 更新 | 定型 | `UmlDiagramRead` に `subject`・`scope`・`generation_status`・`generation_error`・`source_doc_versions` を追加する。`UmlDiagramCreate` は削除する |
| [`app/services/uml_diagram_service.py`](../samples/backend/app/services/uml_diagram_service.py) | 更新 | 定型 | `create`(プレースホルダー)とその import を削除する |
| [`app/api/routes/uml.py`](../samples/backend/app/api/routes/uml.py) | 更新 | 定型 | `POST /diagrams` を 202 に変える(`generate_diagrams`)。`GET /diagrams`・`GET /candidates`・`GET /generation-runs` を追加する |
| ── ここからテスト ── | | | |
| [`tests/unit/test_uml_diagram_routes.py`](../samples/backend/tests/unit/test_uml_diagram_routes.py) | 更新 | 定型 | 202 とバックグラウンドタスクの登録、一覧・候補・履歴。既存のテストは `create_empty_diagram` へ置き換える |
| [`tests/unit/test_uml_diagram_service.py`](../samples/backend/tests/unit/test_uml_diagram_service.py) | 更新 | 定型 | `create` のテスト2件を削除し、既存のテストを `create_empty_diagram` へ置き換える |

## API の一覧(`/api/v1/projects/{id}/uml` 配下)

| メソッド | パス | 概要 |
|---|---|---|
| POST | `/diagrams` | AI 生成の受け付け。本文は `{notation, subjects: [{subject, tables?}]}`。202 で生成履歴(running)を返す |
| GET | `/diagrams` | 図の一覧。`generation_status` を FE がポーリングする |
| GET | `/candidates` | `{internal_design_version, dfd_subjects: [{code, title}], er_tables}` |
| GET | `/generation-runs` | 生成履歴(新しい順に最大20件)。`results[].message` が「止まった理由+再度の生成指示が必要な旨」 |

`subjects` の指定方法は記法によって違う。

- **component・ER の全体**: 省略できる(`''` 1件とみなす)。
- **DFD**: 候補の `title` を1〜5件指定する。
- **ER の部分図**: `{subject: "<グループ名>", tables: [...]}` の形で指定する。再生成のときは `tables` を省略すると、前回の選択を使う。

## 要点の抜粋

```python
# app/api/routes/uml.py
@router.post("/diagrams", response_model=UmlGenerationRunRead, status_code=status.HTTP_202_ACCEPTED)
async def generate_diagrams(payload, session, current_project, background_tasks):
    run = await UmlGenerationService(session).request_generation(
        project_id=current_project.id, notation=payload.notation,
        subjects=[SubjectRequest(subject=s.subject, tables=s.tables) for s in payload.subjects],
    )
    background_tasks.add_task(run_uml_generation, current_project.id, run.id)
    return UmlGenerationRunRead.model_validate(run)
```

## 設計判断

### なぜ `create` の削除をこの章にしたか

`create` を 10-5 で削除すると、10-5 を写経し終えた時点では、まだ Phase 8 の `create_diagram` ルートが `create` を呼んでいる。そのため `POST /diagrams` が壊れた状態が、10-6 まで続いてしまう。ルートの差し替えと同じ章で消せば、どの章を終えた時点でもテストが通る(#15 の前方 import の考え方を、削除にも当てはめたもの)。

### background task に渡すのが project_id と run_id だけなのはなぜか

4文書生成(`POST /projects/{id}/generate`)と同じ理由である。リクエストのセッション(`SessionDep`)は background task の実行前に閉じられる。そのため ORM オブジェクトは渡さず、値だけを渡し、タスクの中で自前のセッションを開く。

### 一括生成の上限5件の位置づけ

これは図の「数」の上限ではない(ユーザー確定事項6。数の上限は設けない)。1つのバックグラウンドタスクが順番に処理する件数を抑え、長時間の占有と、1回の操作でクォータを使い切ることを避けるための値である。6件目以降は、次のリクエストで生成する。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| ルート関数(`generate_diagrams` ほか) | pytest(直接呼び出し。`test_prompt_templates_routes.py` と同じパターン) | スタブ不要。`BackgroundTasks()` を実物で渡し、登録されたタスク(`run_uml_generation`、引数)を確認するだけで、実行はしないため | 生成の中身はサービス層のテスト(10-5)で確かめる |

## 動作確認(実施済み、10-1〜10-6 まとめて実施)

samples に反映した後、`devex-api`(`stage3` ブランチ)の実環境に反映して、以下を確認した。

```bash
cd backend
uv run pytest -m "not integration" -q
# 325 passed, 5 deselected(Phase 9時点の261件 + Phase 10の追加分)
uv run ruff check .
# All checks passed!
uvx pyright
# 1 error(既知の1件、app/ai/llm/gemini.py のみ。Phase 10由来の新規エラー0件)
uv run alembic history
# f1a2b3c4d5e6 -> b7c8d9e0f1a2 (head)
```

- **PostgreSQL での往復**: `docker compose` の開発用 DB で `alembic upgrade head` → `downgrade -1` → `upgrade head` を実行した。`subject`/`scope`/`generation_status`/`generation_error` 列、一意制約 `uq_uml_diagrams_project_notation_subject`、`uml_generation_runs` テーブルを確認した(実行前の `uml_diagrams` は0件で、削除された行は無い)。
- **実 Gemini でのスモーク**(`gemini-3.5-flash-lite`、`INTERNAL_DESIGN_MD` を入力に2回呼び出し):

  | 記法 | 結果 | 所要時間 | layer | M4 検証 |
  |---|---|---|---|---|
  | component | `finish_reason=STOP` | 10.6秒 | api/service/repository が埋まった | エラー・警告なし |
  | DFD(DF-1) | `finish_reason=STOP` | 5.5秒 | 処理に layer が埋まった | エラー・警告なし |

  出力スキーマ(`json_schema` 方式)を Gemini が受け付けることを確認した。
- **samples のオーバーレイ**: samples の Phase 10 関連ファイルを本体のコピーに重ねて全体テストを実行し、325 passed を確認した。

## 既知の残課題

- 生成の受け付け・ポーリング・履歴の表示は、FE(Phase 11)の関心事である。
- プロセスが落ちて `generating` のまま残った図の回復手段は無い([introduction](./Phase-10-introduction.md)「後続 Phase への申し送り」を参照)。
