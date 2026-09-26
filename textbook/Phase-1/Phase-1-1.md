# Phase-1-1: Docker Compose 環境の動作確認

## この章の目的

既存の`docker-compose.yml`スタック(postgres/redis/backend/nginx)を実際に起動し、DB/Redisへの疎通・マイグレーション適用・`devex-ui`とのCORS疎通を確認する。確認の過程で見つかった設定不整合(`DATABASE_URL`の認証情報不一致、postgres/redisの`ports`未公開など)をあわせて修正する。

納期モード([`Phase-1-introduction.md`](./Phase-1-introduction.md) 参照)。#14 の SUT/ドライバ/スタブの言語化は省略し、「動くこと」の確認に留める。

## この章で作成・更新したファイル

- [`devex-api/docker-compose.yml`](../../devex-api/docker-compose.yml) ── postgres/redis に `ports` を追加(後述)
- [`devex-api/.env`](../../devex-api/.env) ── `DATABASE_URL` の認証情報不整合を修正、`POSTGRES_PORT`/`REDIS_PORT` を追加
- [`devex-api/.env.example`](../../devex-api/.env.example) ── 同上の項目をテンプレートにも追記
- [`devex-api/backend/tests/conftest.py`](../../devex-api/backend/tests/conftest.py) ── 統合テストの `DATABASE_URL` フォールバックを実環境の認証情報に合わせて修正

## 実施内容と、確認の過程で見つかった不整合

### 1. `docker compose up` でのスタック起動

```bash
cd devex-api
docker compose up -d
docker compose ps   # postgres/redis が (healthy) になることを確認
```

`postgres`(17-alpine)・`redis`(8-alpine)・`backend`(FastAPI, `--reload`)・`nginx`(80番)の4サービスが `internal` ネットワーク上で連携する構成(既存の [`docker-compose.yml`](../../devex-api/docker-compose.yml))。`backend` は `depends_on` の `condition: service_healthy` で postgres/redis のヘルスチェック完了を待ってから起動する。

### 2. 不整合①: `DATABASE_URL` の認証情報が `POSTGRES_USER`/`PASSWORD`/`DB` と食い違っていた

[`devex-api/.env`](../../devex-api/.env) の実ファイルを確認したところ、`POSTGRES_USER=devex-user` / `POSTGRES_PASSWORD=devex-db-pg-0123` / `POSTGRES_DB=devex-app-db` に対し、`DATABASE_URL` は旧テンプレートの `postgresql+asyncpg://postgres:change-me@postgres:5432/app` のままだった。これでは `backend` コンテナが postgres コンテナに接続できない。`DATABASE_URL` を実際の認証情報に合わせて修正し、`curl http://localhost:8000/health` が `{"status":"ok","database":"ok","redis":"ok"}` を返すことを確認した。

```
# devex-api/.env(抜粋・修正後)
DATABASE_URL=postgresql+asyncpg://devex-user:devex-db-pg-0123@postgres:5432/devex-app-db
```

### 3. マイグレーションの適用

`docker-compose.yml` の `backend` サービスの起動コマンドにマイグレーション適用は含まれない(`uvicorn --reload` のみ)ため、初回は手動で1回実行する:

```bash
docker compose exec backend uv run alembic upgrade head
```

### 4. 不整合②: `pytest -m integration` がホストから実行できなかった

[`devex-api/CLAUDE.md`](../../devex-api/CLAUDE.md)・[`devex-api/README.md`](../../devex-api/README.md) は「`docker compose up postgres redis` の状態で `pytest -m integration` を実行する」ことを想定しているが、既存の `docker-compose.yml` は postgres/redis に `ports` を定義しておらず、ホストの `localhost:5432`/`6379` から到達できなかった(`backend`/`nginx` コンテナ経由の接続のみ機能していた)。ローカル開発用途に限定して `ports` を追加した(本番用 `docker-compose.prod.yml` は変更していない ── postgres/redis を内部ネットワークのみに閉じる設計を維持):

```yaml
# devex-api/docker-compose.yml(抜粋)
  postgres:
    ports:
      - "${POSTGRES_PORT:-5432}:5432"
  redis:
    ports:
      - "${REDIS_PORT:-6379}:6379"
```

さらに、[`backend/tests/conftest.py`](../../devex-api/backend/tests/conftest.py) の統合テスト用フォールバック `DATABASE_URL`(`postgresql+asyncpg://postgres:postgres@localhost:5432/test`)も、旧テンプレートの汎用認証情報のままで実際の `devex-user`/`devex-db-pg-0123` と一致していなかった。フォールバック値を実環境に合わせて修正し、テスト専用の `test` データベースを1回だけ作成した(アプリ本体の `devex-app-db` とは別データベースにすることで、統合テストの `create_all`/`drop_all` が開発用データを巻き込まないようにする、という既存設計を維持):

```bash
docker compose exec postgres psql -U devex-user -d devex-app-db -c "CREATE DATABASE test;"
```

`postgres_data` は名前付きボリュームで永続化されるため、この `test` データベース作成は通常 `docker compose down`(`-v` なし)では消えない。`docker compose down -v` でボリュームごと削除した場合のみ、再度実行する必要がある。

### 5. 検証

```bash
cd devex-api/backend
uv run pytest -m integration tests/integration/test_health.py -v
```

→ green(`test_health_reports_database_and_redis_ok` PASSED)。

> 備考: `tests/integration/` を一括実行(`pytest -m integration tests/integration/`)すると、`test_auth_flow.py` の後に `test_health.py` を実行した場合に限り pytest-asyncio のイベントループ後片付けでエラーが出ることを確認した(`test_health.py` 単体では green)。認証情報とは無関係な、複数モジュール間のイベントループスコープの相互作用によるものであり、テストコード自体(Phase 2 以降が触る領域)の問題のため本 Phase では修正しない。Phase 2 でテストを追加・変更する際に併せて確認する。

### 6. devex-ui との疎通確認

```bash
cd devex-ui
npm run dev   # http://localhost:3000
```

CORS はバックエンド側で `CORS_ORIGINS=["http://localhost:3000"]` が既定値([`devex-api/backend/app/core/config.py`](../../devex-api/backend/app/core/config.py))になっており、変更不要だった。ブラウザを起点とするリクエストを模して確認:

```bash
curl -i -H "Origin: http://localhost:3000" http://localhost:8000/health
# → access-control-allow-origin: http://localhost:3000 が付与された200応答
```

devex-ui 自体は現時点で FastAPI を呼ぶ画面を持たない(SSGデモページのみ)ため、実際の疎通確認は `curl`/`/health` による代替確認に留めた。実際の API 呼び出し画面は Phase 3 で作られる。

> **後続の改訂**: この時点のCORS設定(`allow_origins`/`allow_credentials`/`allow_methods`/`allow_headers`)は「変更不要」だったが、`Content-Disposition`のようなCORSセーフリスト対象外のレスポンスヘッダーをJSから読む機能([`Phase-3-6.md`](../Phase-3/Phase-3-6.md)のドキュメントダウンロード)を後から追加した際、`expose_headers`が未設定だったためヘッダーが読めず、ドキュメントのUUIDがファイル名になる不具合が実際に発生した。`app/main.py`に`expose_headers=["Content-Disposition"]`を追加して解決した。詳細は[`decision-digest.md`](../decision-digest.md)「ドキュメントダウンロードのファイル名がUUIDになる不具合の修正(CORS `expose_headers`未設定)」節参照。

## テスト観点(納期モード: 「動くこと」の確認)

| 確認項目 | 手段 | 結果 |
|---|---|---|
| postgres/redis/backend/nginx が healthy | `docker compose ps` | 確認済み |
| DB/Redis への疎通 | `curl http://localhost:8000/health` | `{"status":"ok",...}` |
| マイグレーション適用 | `docker compose exec backend uv run alembic upgrade head` | `2b97c8ec8533, initial schema` 適用 |
| 統合テスト(DB/Redis 実体) | `pytest -m integration tests/integration/test_health.py` | green |
| devex-ui → devex-api の CORS | `curl -H "Origin: http://localhost:3000" .../health` | `access-control-allow-origin` 付与 |
| devex-ui 起動 | `npm run dev` → `curl localhost:3000` | 200 |
