# Phase-88-1: 小さな修正(テストの DB・終了するモデル・束の一覧・版の履歴の CR)

## この章の目的

Phase 81〜87 から積んできた小さな修正を先に済ませる。
- 新しいボリュームでテストの DB が作られない `postgres-init` の誤りを直す。
- 終了の告知があった `gemini-3.1-flash-lite` をカタログから外し、選んでいた利用者の設定を後継へ移す。
- 束の一覧が写しの中身まで DB から読む重さを除く。
- 文書の版の履歴(SCR-005)に、反映した CR とモデル名を出す。

自動実装モード: on([introduction](./Phase-88-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| `devex-api/postgres-init/01-create-test-db.sh` | 更新 | SQL を標準入力から渡す(テンプレートで直した形)。インフラのファイルなので samples にミラーしない(#21) |
| [`backend/app/ai/llm/catalog.py`](../samples/backend/app/ai/llm/catalog.py) | 更新 | `gemini-3.1-flash-lite` を外す。確かめた日を 2026-10-20 に |
| [`backend/alembic/versions/be106e6426be_retire_gemini_31_flash_lite.py`](../samples/backend/alembic/versions/be106e6426be_retire_gemini_31_flash_lite.py) | 新規 | データのマイグレーション(`RETIRED` の表で `user_model_settings.model` を後継へ。downgrade は何もしない) |
| [`backend/app/repositories/baseline.py`](../samples/backend/app/repositories/baseline.py) | 更新 | `list_for_project` は写しの `content`・`model` を読まない(`defer`)。`latest`(最新の束を中身ごと) |
| [`backend/app/repositories/change_request.py`](../samples/backend/app/repositories/change_request.py) | 更新 | `numbers_by_id`(CR の id → 番号) |
| [`backend/app/services/change_request_service.py`](../samples/backend/app/services/change_request_service.py) | 更新 | `_base_baseline` が `latest` を使う |
| [`backend/app/schemas/document.py`](../samples/backend/app/schemas/document.py) | 更新 | `GeneratedDocumentRead.change_request_number` |
| [`backend/app/services/doc_generator_service.py`](../samples/backend/app/services/doc_generator_service.py) | 更新 | `change_request_numbers`、`document_read` の引数 `change_request_number` |
| [`backend/app/api/routes/projects.py`](../samples/backend/app/api/routes/projects.py) | 更新 | 版の履歴の応答に CR の番号を入れる |
| [`frontend/src/features/documents/api/documentsApi.ts`](../samples/frontend/src/features/documents/api/documentsApi.ts) | 更新 | `GeneratedDocumentRead` に `generated_model`・`change_request_number` |
| [`frontend/src/features/documents/components/VersionHistoryPanel.tsx`](../samples/frontend/src/features/documents/components/VersionHistoryPanel.tsx) | 更新 | 版ごとにモデルと「CR-N で反映」を出す |
| [`backend/tests/unit/test_llm_catalog.py`](../samples/backend/tests/unit/test_llm_catalog.py) | 更新 | 数(Gemini 3・Claude 4)と、外したモデルが無いこと |
| [`backend/tests/unit/test_llm_settings_service.py`](../samples/backend/tests/unit/test_llm_settings_service.py) | 更新 | カタログの API の数を `CATALOG` と比べる |
| [`backend/tests/unit/test_retire_model_migration.py`](../samples/backend/tests/unit/test_retire_model_migration.py) | 新規 | 移す先の表とカタログの食い違い |
| [`backend/tests/unit/test_baseline_service.py`](../samples/backend/tests/unit/test_baseline_service.py) | 更新 | 一覧が中身を読まないこと・`latest` |
| [`backend/tests/unit/test_document_versions.py`](../samples/backend/tests/unit/test_document_versions.py) | 更新 | CR を渡した再生成の版が CR の番号を出す |
| [`frontend/src/features/documents/components/__tests__/VersionHistoryPanel.test.tsx`](../samples/frontend/src/features/documents/components/__tests__/VersionHistoryPanel.test.tsx) | 更新 | モデルと CR の表示 |

## 1. テストの DB を作るスクリプト

```sh
# devex-api/postgres-init/01-create-test-db.sh(抜粋)
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<SQL
SELECT 'CREATE DATABASE "$POSTGRES_TEST_DB"'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$POSTGRES_TEST_DB')\gexec
SQL
```

- **何が誤りだったか**: `\gexec` は psql のメタコマンドなので、`-c` の中では SQL として読まれ、構文の誤りになる。新しいボリュームでは、テストの DB が作られなかった(既存のボリュームでは、このスクリプトが走らないので気づかなかった)。
- テンプレート(`project-templates/fastapi-langchain-template`)で直した形をそのまま取り込んだ。コメントのパスは devex-api の `CLAUDE.md` のまま。
- 空のボリュームの使い捨てのコンテナ(`postgres:17-alpine`)で走らせ、`app_test` ができることを確かめた。

## 2. 終了するモデルを外し、設定を移す

```python
# alembic/versions/be106e6426be_retire_gemini_31_flash_lite.py(抜粋)
RETIRED: dict[str, str] = {'gemini-3.1-flash-lite': 'gemini-3.5-flash-lite'}

def upgrade() -> None:
    for old, new in RETIRED.items():
        op.execute(sa.text('UPDATE user_model_settings SET model = :new WHERE model = :old')
                   .bindparams(old=old, new=new))
```

- **後継**: Context7 で Gemini API の deprecations ページを確かめた。`gemini-3.1-flash-lite` の終了は 2027-05-07、推奨の後継は `gemini-3.5-flash-lite`。後継は既にカタログにあり、既定の `GEMINI_MODEL` も 3.5 なので、`.env` は変えない。
- **なぜ外すだけにしないか**(ユーザー決定): カタログに無いモデルは `timeout_seconds` が `ValueError` を出し、その利用者の呼び出しが失敗する。カタログから外すときは、選んでいた設定を移す。既定値の行(`user_id` が NULL)も同じに扱う。
- **変えないもの**: 過去の版(`generated_documents.generated_model`)・束の写し・要約の `generated_model` は「何で作ったか」の記録なので、書き換えない。
- **downgrade は何もしない**: 移す前にどの行が外したモデルだったかは分からない。
- 移行のファイルは app を import しない(後で app を直しても移行の意味が変わらないように)。表とカタログの食い違いは、テストで確かめる。
- 選べる Gemini は3つになった。画面(マイページ)はカタログの API から作るので、devex-ui は変えていない。

## 3. 束の一覧は写しの中身を読まない

```python
# app/repositories/baseline.py(抜粋)
async def list_for_project(self, project_id) -> list[Baseline]:
    stmt = (select(Baseline).where(...).order_by(Baseline.number.desc())
            .options(selectinload(Baseline.items).options(defer(BaselineItem.content), defer(BaselineItem.model))))

async def latest(self, project_id) -> Baseline | None:   # 中身ごと(_default_options)
```

- **申し送り「一覧の応答の大きさ」**(Phase 81): 一覧の応答は写しの中身を返さないのに、DB からは束ごとに 11 件の写しの md と model を読んでいた。束の画面(88-3)で一覧を開くたびに読むので、ここで直した。応答の形は変えない。
- **気をつける所**: `defer` した列は、非同期のセッションで後から触ると読めない(暗黙の読み込みができない)。一覧の束を中身ごと使っていたのは、CR の作成の「基準の束を省くと最新」(`_base_baseline`)だけで、ここは中身(要件の写し)を読むので、新しい `latest` に替えた。

## 4. 版の履歴に反映した CR とモデル名を出す

```python
# app/services/doc_generator_service.py(抜粋)
async def change_request_numbers(self, documents) -> dict[uuid.UUID, int]
def document_read(document, change_request_number: int | None = None) -> GeneratedDocumentRead

# app/api/routes/projects.py の list_document_versions
numbers = await service.change_request_numbers(versions)
return [document_read(v, numbers.get(v.change_request_id) if v.change_request_id is not None else None) for v in versions]
```

- **申し送り「文書の版の応答に CR を出すか」**(Phase 85): 版の側から「どの CR で作った版か」を読めるようにした(マイルストーン12 の「どこに反映したか」を、たどる記録だけでなく版の履歴からも)。
- **番号は版の履歴の応答だけ**: 版(`generated_documents`)は CR の id を持つが、番号は持たない。関係(relationship)を足すと、文書を読むどの経路でも CR を読むことになるので、版の履歴のルートだけが番号をまとめて引く(`numbers_by_id`。1回の問い合わせ)。ほかの文書の応答では `null` のまま。
- モデル名(`generated_model`。Phase 81)も、応答にはあったが画面に出していなかったので、一緒に出した。

```tsx
// src/features/documents/components/VersionHistoryPanel.tsx(抜粋)
{doc.generated_model ? ` ・${doc.generated_model}` : ""}
{doc.change_request_number != null ? ` ・CR-${doc.change_request_number} で反映` : ""}
```

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_llm_catalog.py`(更新) | `CATALOG`・`find_model` | pytest のテスト関数 | スタブ不要 ── 対象が純粋(副作用なし)で外部依存を呼ばないため |
| `test_retire_model_migration.py`(新規) | 移行の `RETIRED` と `find_model` | pytest のテスト関数(移行ファイルを `importlib` で読む) | スタブ不要 ── 表と `find_model` は純粋。行の書き換えは upgrade の責務で、使い捨ての DB で往復を確かめた(下) |
| `test_llm_settings_service.py`(更新) | カタログの API のルート | pytest のテスト関数 | 既存のとおり(SQLite のセッション) |
| `test_baseline_service.py`(更新) | `BaselineRepository.list_for_project`・`latest` | pytest のテスト関数 | スタブ不要 ── SQLite のセッションで、読んだ列(`inspect(...).unloaded`)を確かめる |
| `test_document_versions.py`(更新) | ルート `list_document_versions`(`change_request_numbers`・`numbers_by_id`・`document_read`) | pytest のテスト関数 | `tests/fixtures/change_requests.py` の反映まで(偽の LLM) |
| `VersionHistoryPanel.test.tsx`(更新) | `VersionHistoryPanel` | Testing Library | `fetch`(`stubFetch`) |

- カタログ: Gemini 3・Claude 4、外したモデルが無い。移行: 外したモデルはカタログに無く、後継はある。
- 束の一覧: セッションを空にしてから読むと、写しの `content`・`model` が読まれていない。`latest` は中身を持つ。
- 版の履歴: CR を渡した版だけが番号を持ち、モデル名がある。
- 画面: モデル名と「CR-3 で反映」を出し、CR の無い版には出さない。
- マイグレーションの往復: 使い捨ての DB で、`483d9e531ba0` まで上げ → 3.1 の行と別のモデルの行を入れ → head へ上げて 3.1 の行だけが 3.5 になる → 1つ下げ → もう一度上げる、を確かめた。開発の DB には 3.1 の行が無く、head まで上げた。
