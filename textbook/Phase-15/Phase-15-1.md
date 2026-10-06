# Phase-15-1: プロジェクトのモードと、モードごとの生成(BE)

## この章の目的

プロジェクトを作るときに選んだモード(簡易ドキュメント / 詳細設計)を `projects.mode` に保存する。文書の生成は、モードごとの文書の組で行う。

- **簡易ドキュメントモード**: 今と同じ4文書。
- **詳細設計モード**: 要件定義・外部設計の2文書。残りは段階(15-2 以降)で組み立てる。

あわせて、次の2つを行う。

- **気づき#1**: ルートが `template_id` をサービスへ渡していなかったのを直す。
- 簡易ドキュメントモードの内部設計書に、ファイル単位の「モジュール一覧」の表を求める([Phase-14-1](../Phase-14/Phase-14-1.md) 決定#6)。

自動実装モード: on([introduction](./Phase-15-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`alembic/versions/c1d2e3f4a5b6_add_mode_to_projects.py`](../samples/backend/alembic/versions/c1d2e3f4a5b6_add_mode_to_projects.py) | 新規 | 定型 | `projects.mode` を足す(既存の行は `simple`) |
| [`app/models/project.py`](../samples/backend/app/models/project.py) | 更新 | 定型 | `mode` 列(既定 `simple`) |
| [`app/schemas/project.py`](../samples/backend/app/schemas/project.py) | 更新 | 定型 | `ProjectMode`、`ProjectRead.mode` |
| [`app/repositories/project.py`](../samples/backend/app/repositories/project.py) | 更新 | 定型 | `create(mode=...)` |
| [`app/services/doc_generator_service.py`](../samples/backend/app/services/doc_generator_service.py) | 更新 | **コア** | `DOC_TYPES_BY_MODE`、モードごとの生成、モジュール一覧のプロンプト |
| [`app/services/project.py`](../samples/backend/app/services/project.py) | 更新 | 定型 | `create(mode=...)`、`get_detail` に `mode` |
| [`app/api/routes/projects.py`](../samples/backend/app/api/routes/projects.py) | 更新 | 定型 | `POST /projects` の `mode` 欄、`template_id` と `mode` をサービスへ渡す |
| ── ここからテスト ── | | | |
| [`tests/unit/test_project_mode.py`](../samples/backend/tests/unit/test_project_mode.py) | 新規 | **コア** | ルートの受け渡し、既定のモード、文書の組の順序、2文書だけの生成、プロンプト |

## 要点の抜粋

```python
# app/services/doc_generator_service.py
# モード(projects.mode)ごとに生成する文書。並びは生成の順序で、_DOC_TYPE_INPUTSの前段が必ず先に来る。
DOC_TYPES_BY_MODE: dict[str, tuple[str, ...]] = {
    "simple": DOC_TYPES,
    "detailed": ("requirements", "external_design"),
}

# generate の中
doc_types = DOC_TYPES_BY_MODE[project.mode]
for doc_type in doc_types:
    content = await self._generate_one(doc_type, transcript, generated, llm=llm)
```

```python
# app/api/routes/projects.py(create_project)
    template_id: Annotated[uuid.UUID | None, Form()] = None,
    mode: Annotated[ProjectMode, Form()] = "simple",     # 不正な値は 422
    ...
project = await ProjectService(session).create(
    user_id=current_user.id, intake=intake, files=file_inputs,
    template_id=template_id, mode=mode,
)
```

内部設計書のプロンプトの3.3節には、APIエンドポイント一覧の次に「`### モジュール一覧`(パス/層/責務/主な依存先)」を足した。Phase 10 で固定した見出し(`### テーブル:`・`#### DF-<n>:`)は変えていない。

## 設計判断

### モードは作成後に変えない

モードで、生成する文書の組と段階のデータの有無が変わる。途中で切り替えると、どちらの組にも当てはまらない状態(内部設計書があるのに段階もある、など)ができる([Phase-14-5](../Phase-14/Phase-14-5.md) 決定1)。そのため、`mode` を変える API は作らない。

### 文書の組は、生成の順序を持つタプルで表す

詳細設計モードで外部設計書を生成するには、要件定義書が先に要る(`_DOC_TYPE_INPUTS`)。組を集合ではなく順序つきのタプルにした。「入力の文書は必ず前にある」ことは、テストで確かめる(`test_doc_types_by_mode_keep_generation_order`)。

### モジュール一覧の列に「関わる処理」を入れない

詳細設計モードの段階4は5列(パス/層/責務/主な依存先/関わる処理)である。簡易ドキュメントモードには処理ID(`F-01`…)が無いので、「関わる処理」を除いた4列にした。

### `template_id` の受け渡しは、本体の写経漏れだった

samples のルートは、Phase 6-3 から `template_id` をサービスへ渡していた。本体だけ渡しておらず、SCR-003 で選んだテンプレートが保存されていなかった。テストはサービスを直接呼んでいたため、ルートの漏れに気づけなかった。この章では、ルート関数を直接呼ぶテストを足した。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `create_project`(ルート関数) | pytest(ルート関数を直接呼ぶ) | `ChatService.generate_opening_reply` を monkeypatch で無効にする。最初の AI 発話は Gemini を呼ぶため | `template_id`・`mode` が保存されること(気づき#1 の回帰テスト) |
| `ProjectService.create`・`get_detail` | pytest(インメモリ SQLite) | スタブ不要。外部呼び出しが無いため | 省略時は `simple` |
| `DOC_TYPES_BY_MODE` | pytest | スタブ不要。純粋なデータのため | どのモードでも入力の文書が先にある |
| `DocGeneratorService.generate`(詳細設計モード) | pytest(インメモリ SQLite) | FakeLLM(3回分の応答。要件定義・外部設計・自己診断) | 2文書だけが生成され、`completed` になる |
| 内部設計書のプロンプト | pytest | スタブ不要 | `### モジュール一覧` と4列の指示がある |

## 動作確認(実施済み)

```bash
cd devex-api/backend
uv run pytest tests/unit/test_project_mode.py tests/unit/test_project_service.py tests/unit/test_doc_generator_service.py
# 41 passed
```
