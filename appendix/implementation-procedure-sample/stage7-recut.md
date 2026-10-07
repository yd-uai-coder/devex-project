# 改修後の段階7(見本)

[Phase 25-1](../../textbook/Phase-25/Phase-25-1.md) の決定1で段階7を改修した後、ゴール3の段階7([`stage7.json`](../goal3-generated/detailed/stages/stage7.json))がどうなるかを、手で組み替えた見本です。マイルストーンの名前・ゴール・処理ID・ファイルは、元の生成物のものを使っています。

## 改修で変わること

| | 改修前(Phase 23) | 改修後 |
|---|---|---|
| タスクの切り方 | 層の横割り(`area` = 準備/バックエンド/フロントエンド/テスト/デプロイ) | 処理を持つタスクは機能ごとの縦割り(**機能**)。処理の無いものは**基盤** |
| ID | 無し | 並び順から導く(`M-01-T01`)。保存はしない(`M-01` と同じ) |
| 依存 | 無し | タスクの間に持つ(先に終わっている必要があるタスク) |
| ファイル | `modules`(例。検証しない) | **モジュール**(段階4のパス。検証する)と、**環境・設定のファイル**(例。検証しない)に分ける |
| テスト | 「テスト」の行に分かれ、ファイルが空 | 各単位の中に入る(テストのファイルは手順書で決める) |

## 組み替えた結果

モジュールは、段階4の依存先から導いた依存順(依存されるものが先)に並べています。

### M-01 環境構築と認証・横断事項の実装(Must)

| ID | 種別 | タスク | 処理 | 依存 | モジュール | 環境・設定のファイル(例) |
|---|---|---|---|---|---|---|
| M-01-T01 | 基盤 | 開発環境と横断事項の土台 | — | — | `cache/redis_client.py` | `docker-compose.yml`、`Dockerfile`、`frontend/package.json` |
| M-01-T02 | 機能 | 新規ユーザー登録を行う | F-01 | M-01-T01 | `repositories/user_repository.py`、`services/auth_service.py`、`api/routes/auth.py`、`frontend` | — |
| M-01-T03 | 機能 | ログインを行う | F-02 | M-01-T02 | `repositories/user_repository.py`、`services/auth_service.py`、`api/routes/auth.py`、`frontend` | — |
| M-01-T04 | 機能 | ログアウトを行う | F-03 | M-01-T03 | `cache/redis_client.py`、`services/auth_service.py`、`api/routes/auth.py`、`frontend` | — |
| M-01-T05 | 基盤 | 自動デプロイ | — | M-01-T01 | — | `.github/workflows/deploy.yml` |

### M-02 プロジェクト管理と参考資料アップロード機能の実装(Must)

| ID | 種別 | タスク | 処理 | 依存 | モジュール | 環境・設定のファイル(例) |
|---|---|---|---|---|---|---|
| M-02-T01 | 機能 | プロジェクトを作成し参考資料をアップロードする | F-05 | M-01-T03 | `repositories/project_repository.py`、`external/gemini_client.py`、`services/project_service.py`、`api/routes/projects.py`、`frontend` | — |
| M-02-T02 | 機能 | プロジェクト一覧を取得する | F-04 | M-02-T01 | `repositories/project_repository.py`、`services/project_service.py`、`api/routes/projects.py`、`frontend` | — |
| M-02-T03 | 機能 | プロジェクト詳細を取得する | F-06 | M-02-T01 | `repositories/project_repository.py`、`services/project_service.py`、`api/routes/projects.py`、`frontend` | — |

### M-03 AI対話ヒアリングとSSEストリーミングの実装(Must)

| ID | 種別 | タスク | 処理 | 依存 | モジュール | 環境・設定のファイル(例) |
|---|---|---|---|---|---|---|
| M-03-T01 | 機能 | チャットメッセージを送信する | F-07 | M-02-T03 | `repositories/project_repository.py`、`external/gemini_client.py`、`services/ai_service.py`、`api/routes/projects.py`、`frontend` | — |

### M-04 4種設計書の自動生成と自己診断・閲覧機能の実装(Must)

| ID | 種別 | タスク | 処理 | 依存 | モジュール | 環境・設定のファイル(例) |
|---|---|---|---|---|---|---|
| M-04-T01 | 機能 | ヒアリング結果を承認し設計書生成をトリガーする | F-08 | M-03-T01 | `repositories/project_repository.py`、`repositories/document_repository.py`、`external/gemini_client.py`、`services/ai_service.py`、`services/project_service.py`、`api/routes/projects.py`、`frontend` | — |
| M-04-T02 | 機能 | 生成された設計書一覧を取得する | F-09 | M-04-T01 | `repositories/document_repository.py`、`services/ai_service.py`、`api/routes/documents.py`、`frontend` | — |
| M-04-T03 | 機能 | 特定の設計書内容と自己診断結果を取得する | F-10 | M-04-T02 | `repositories/document_repository.py`、`services/ai_service.py`、`api/routes/documents.py`、`frontend` | — |
| M-04-T04 | 機能 | 設計書の自己診断を実行する | F-11 | M-04-T03 | `repositories/document_repository.py`、`external/gemini_client.py`、`services/ai_service.py`、`api/routes/documents.py`、`frontend` | — |

## 段階7の検証で出るもの(改修後)

改修後の段階7の検証(決定論)では、次が出ます。手順書を作る前の段階7で出るので、手順書の側では繰り返しません。

- 警告 `MODULE_NOT_FILE`: `frontend` はディレクトリで、ファイルが決まらない(全11処理の単位)。段階4のモジュール一覧を直す。
- 警告 `UNPLANNED_FUNCTION`: なし(F-01〜F-11 がすべて、どれかの単位に入っている)。

## 未決だったこと(Phase 26 で決定)

[Phase 26](../../textbook/Phase-26/Phase-26-introduction.md) の着手時に、次のように決めて実装した。

- 1つの単位に入れる処理の数: 原則1処理。上限は設けず、4つ以上で警告(`MANY_FUNCTIONS`)を出す。
- 依存: AI が下書きし(出力の並び順から導く ID で書かせる)、人が画面で直せる。依存先が単位の一覧に無い・自分か後ろの単位を指すのは、検証のエラー。
- 既存のプロジェクトの改修前の形の段階7: Alembic のデータ移行で新しい形に変え、承認済みの段階7はレビュー中に戻した。
- 見本との違い: 見本の検証の警告 `UNPLANNED_FUNCTION` 等に加え、`UNKNOWN_MODULE`(エラー)・`DUPLICATE_FUNCTION`・`KIND_MISMATCH`・`NO_MODULES`(警告)を足した。マイルストーンの処理は保存せず、タスクの処理から導く。
