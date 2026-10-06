# Phase-5-2: 本番相当環境での動作検証 + 実API検証

## この章の目的

[`docs/implementation_plan.md`](../../docs/implementation_plan.md) WBS区分5「クラウドインフラへのデプロイ検証」と、[`Phase-4-introduction.md`](../Phase-4/Phase-4-introduction.md)が申し送った2点(実Gemini APIキーでの動作確認、`LLM_TIMEOUT_SECONDS`の実測調整)に対応する。`docker-compose.prod.yml`スタックをローカルで本番相当に起動して疎通確認し、devex-uiのVercel向け本番ビルドを検証し、実`GOOGLE_API_KEY`での動作確認結果を`GEMINI_MODEL`・`LLM_TIMEOUT_SECONDS`に反映する。

自動実装モード: off([introduction](./Phase-5-introduction.md) 参照)。旧ルールの納期モード(旧 #21)で書いた章。ただし`LLM_TIMEOUT_SECONDS`・`GEMINI_MODEL`の値の決定は実測に基づく判断のため、理由を明記する。

## この章で作成・更新したファイル

- [`devex-api/docker-compose.prod.yml`](../../devex-api/docker-compose.prod.yml) ── `backend`に`healthcheck:`追加、`nginx`の`depends_on`を`condition: service_healthy`化、証明書取得専用の`certbot`サービス(`profiles: ["certbot"]`)+`certbot_conf`ボリューム追加
- [`devex-api/backend/app/core/config.py`](../../devex-api/backend/app/core/config.py) ── `GEMINI_MODEL`既定値・`LLM_TIMEOUT_SECONDS`既定値を実測結果に基づき更新(samples: [`textbook/samples/backend/app/core/config.py`](../samples/backend/app/core/config.py)にもPhase-5-2タグで反映)
- [`devex-api/.env`](../../devex-api/.env)・[`devex-api/.env.example`](../../devex-api/.env.example)(root)・[`devex-api/backend/.env.example`](../../devex-api/backend/.env.example) ── `GEMINI_MODEL=gemini-3.5-flash-lite`に修正
- [`devex-api/.gitignore`](../../devex-api/.gitignore) ── `nginx/certs/`(自己署名・本番certbot発行分とも)を追加

## 1. `docker-compose.prod.yml`の改修

[`Phase-5-1.md`](./Phase-5-1.md)で追加したHEALTHCHECKを実際に使う形に、`nginx`の起動順序を`postgres`/`redis`と同じ`condition: service_healthy`パターンに揃えた。

```diff
     depends_on:
       postgres:
         condition: service_healthy
       redis:
         condition: service_healthy
+    healthcheck:
+      # backend/Dockerfile の runtime ステージに定義済みの HEALTHCHECK をそのまま使う
+      # (イメージ組み込みのHEALTHCHECKはデフォルトでは`depends_on`の判定に使われないため、
+      #  ここで明示的に有効化しないと nginx 側の`service_healthy`待ちが機能しない)。
+      test: ["CMD", "python", "-c", "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/health', timeout=2).status == 200 else 1)"]
+      interval: 30s
+      timeout: 3s
+      start_period: 10s
+      retries: 3
     networks:
       - internal

   nginx:
     ...
     depends_on:
-      - backend
+      backend:
+        condition: service_healthy
     networks:
       - internal
```

証明書取得(下記「TLS証明書」節)を`docker compose run`単発で行えるよう、通常の`up`では起動しない`certbot`サービスを追加した(具体的な発行手順は[`OPERATIONS.md`](../../devex-api/OPERATIONS.md)に書く。ここでは仕組みのみ):

```diff
+  # 証明書の初回取得・更新専用のワンショットサービス。
+  # `docker compose -f docker-compose.prod.yml up`では起動しない(profilesで明示的に除外)。
+  certbot:
+    image: certbot/certbot:latest
+    profiles: ["certbot"]
+    volumes:
+      - certbot_webroot:/var/www/certbot
+      - certbot_conf:/etc/letsencrypt
+    networks:
+      - internal

 volumes:
   postgres_data:
   redis_data:
   certbot_webroot:
+  certbot_conf:
```

## 2. ローカルでの本番相当環境検証

`nginx.prod.conf`はTLS終端を行うため、`./nginx/certs/`に`fullchain.pem`/`privkey.pem`が無いと`nginx`コンテナが起動できない。実際のVPS/ドメインが無いローカル検証では、一時的な自己署名証明書で代用した(実際のVPSデプロイ時は[`OPERATIONS.md`](../../devex-api/OPERATIONS.md)「TLS証明書の取得・更新」の手順でLet's Encrypt発行の証明書に差し替える)。

```bash
mkdir -p nginx/certs
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout nginx/certs/privkey.pem -out nginx/certs/fullchain.pem \
  -days 1 -subj "/CN=localhost"

docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec backend uv run alembic upgrade head
```

### 検証結果

| 確認項目 | 手段 | 結果 |
|---|---|---|
| 4サービス起動順序 | `docker compose -f docker-compose.prod.yml up -d --build`のログ | postgres/redis healthy → backend healthy(HEALTHCHECK経由) → nginx起動、の順で待機が機能した |
| 全サービスhealthy | `docker compose -f docker-compose.prod.yml ps` | postgres/redis/backend全てhealthy(nginxはcompose上healthcheck未定義のため`Up`表示のみ、これはnginx公式イメージの標準的な扱いでありPhase 5の対象外とした) |
| マイグレーション適用 | `docker compose exec backend uv run alembic upgrade head` → `alembic current` | `3bacecabb584 (head)` |
| HTTPS疎通(自己署名証明書) | `curl -sk https://localhost/health` | `{"status":"ok","database":"ok","redis":"ok"}` |
| HTTP→HTTPSリダイレクト | `curl -sI http://localhost/` | `301 Moved Permanently` |

検証後、ボリュームを残したまま`docker compose -f docker-compose.prod.yml down`でコンテナのみ停止した(`nginx/certs/`の自己署名証明書は`.gitignore`に追加済みのため、実運用の証明書と混同されない)。

## 3. devex-ui: Vercel本番ビルドの検証

`devex-ui`は`vercel.json`等の追加設定なしでVercelにデプロイできる設計(既存README「Vercelへのデプロイ」節、静的生成中心)。`NEXT_PUBLIC_API_URL`は`src/lib/api/client.ts`が`process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"`として読むのみで、コード変更は不要と確認した。

```bash
cd devex-ui
npm run build   # Vercel上と同じ`next build`
npm run start   # Vercel相当のNode本番サーバー起動
curl -sI http://localhost:3000/          # 200 OK
curl -sI http://localhost:3000/dashboard # 200 OK
```

両方とも200 OKで応答した。追加の`vercel.json`は不要と確認した(Devex固有のデプロイ手順は[`Phase-5-3.md`](./Phase-5-3.md)で運用マニュアルに反映する)。

## 4. 実Gemini APIキーでの動作確認

`devex-api/.env`には既に実際の`GOOGLE_API_KEY`が設定済みであることが[`Phase-4-5.md`](../Phase-4/Phase-4-5.md)の検証で判明していた(Phase 1〜4は全て`E2E_FAKE_LLM=true`で意図的に検証していたため、実際にこの鍵で呼び出したことは無かった)。本章で初めて`get_gemini_llm()`を実際に呼び出した。

### `gemini-2.5-flash-lite`が新規利用不可と判明

`GEMINI_MODEL`の値([`Phase-1-2.md`](../Phase-1/Phase-1-2.md)でspec確定値として`gemini-2.5-flash-lite`に修正済み)のまま実APIを呼んだところ、次のエラーで失敗した:

```
langchain_google_genai.chat_models.ChatGoogleGenerativeAIError: Error calling model
'gemini-2.5-flash-lite' (NOT_FOUND): 404 NOT_FOUND. {'error': {'code': 404,
'message': 'This model models/gemini-2.5-flash-lite is no longer available to new
users. Please update your code to use models/gemini-3.5-flash-lite for the latest
features and improvements. ...'}}
```

Google側でモデルが廃止され、後継として`gemini-3.5-flash-lite`が案内されていた。`GEMINI_MODEL`を`gemini-3.5-flash-lite`に変更したところ実際に応答が返ることを確認した(下記「実測結果」参照)。

> **これは[`Phase-1-2.md`](../Phase-1/Phase-1-2.md)が確定した内容への遡及的な訂正である(CLAUDE.md #12)。** Phase 1時点では`gemini-2.5-flash-lite`が正しい現行モデルIDだったが、Phase 5時点でGoogle側の提供状況が変わった。`Phase-1-2.md`自体は書き換えず、この訂正は本Phaseの教材と[`decision-digest.md`](../decision-digest.md)に記録し、[`Phase-1-introduction.md`](../Phase-1/Phase-1-introduction.md)に1行の参照を追記した。

`.env`(root・backend の`.env.example`含む3ファイル)・`app/core/config.py`の既定値をいずれも`gemini-3.5-flash-lite`に修正した。

```diff
-GEMINI_MODEL: str = "gemini-2.5-flash"
+GEMINI_MODEL: str = "gemini-3.5-flash-lite"
```

(`app/core/config.py`の既定値は元々`gemini-2.5-flash-lite`ですらなく`gemini-2.5-flash`のままだった ── `.env.example`側は[`Phase-1-2.md`](../Phase-1/Phase-1-2.md)で修正済みだったが、クラス既定値側は見落とされていた。実運用では`.env`が必ず存在し既定値にフォールバックすることは無いが、一貫性のため合わせて修正した。)

### `LLM_TIMEOUT_SECONDS`の実測調整

実`GEMINI_MODEL`(`gemini-3.5-flash-lite`)に対し、`doc_generator_service.py`が実際に生成する文書と同程度の分量を要求するプロンプトを3パターン(800字/3000字/6000字相当の出力を要求)実行し、レイテンシを計測した(計測用の一回限りのスクリプトは教材にもプロジェクトにも組み込んでいない ── ChatGoogleGenerativeAIを直接呼ぶだけの検証用コードのため)。

| 要求した分量 | 実際の応答文字数 | 所要時間 |
|---|---|---|
| 800字前後 | 1,257字 | 2.96秒 |
| 3,000字前後 | 3,449字 | 7.28秒 |
| 6,000字前後 | 4,754字 | 11.25秒 |

最大11.25秒に対し約2.7倍のマージンを見て、`LLM_TIMEOUT_SECONDS`を(実測に基づかない暫定値だった)60秒から30秒に変更した。

```diff
-LLM_TIMEOUT_SECONDS: float = 60.0
+LLM_TIMEOUT_SECONDS: float = 30.0
```

30秒はまだ実測最大値の2.7倍という余裕があるため、`invoke_with_retry`(Phase 2由来、[`Phase-2-3.md`](../Phase-2/Phase-2-3.md)参照)の既定リトライ回数・間隔を変更する必要は無いと判断した(タイムアウト自体が起きる頻度が実測上極めて低いと見込まれるため)。

## テスト観点(旧ルールの納期モード: 「動くこと」の確認)

| 確認項目 | 手段 | 結果 |
|---|---|---|
| `docker-compose.prod.yml`の構文 | `docker compose -f docker-compose.prod.yml config` | エラー無し |
| `certbot`サービスが通常の`up`で起動しない | `docker compose -f docker-compose.prod.yml config --services`(既定プロファイル) vs `--profile certbot config --services` | 既定では`certbot`が一覧に出ず、`--profile certbot`指定時のみ出る |
| `config.py`の変更による既存ユニットテストの回帰確認 | `uv run pytest -m "not integration"` | 121件green(変更前と同数、既存テストに`LLM_TIMEOUT_SECONDS`/`GEMINI_MODEL`の値をハードコードしたassertは無かったため件数・内容とも変化なし) |
| `config.py`の型チェック | `uvx pyright` | 1件のエラーは`app/ai/llm/gemini.py`の既存の型債務(`E2eFakeLLM`が`ChatGoogleGenerativeAI`型と不一致、Phase 4由来)であり本章の変更とは無関係。本章の変更行に起因するエラーは無し |

`config.py`は既存のPythonシンボル(`Settings`クラス)の値変更のみで新規シンボルを追加しないが、既存の`tests/unit/test_config_safety.py`等が`Settings`を継続してimportしているため#15を満たす。Docker/nginx/certbot部分はコマンド実行結果による検証で代替する(#15対象外)。

## 既知の残課題

- TLS証明書の実際の取得(certbotによるLet's Encrypt発行)は、実ドメインが無いローカル環境では検証できていない。手順の設計のみ行い、実行自体はVPSデプロイ時にユーザーが行う([`Phase-5-3.md`](./Phase-5-3.md)の運用マニュアル参照)。
- 実測は3パターン(800/3,000/6,000字相当)のみで、統計的に十分なサンプル数ではない。実運用開始後にタイムアウトが頻発するようであれば、実際の分布を見て`LLM_TIMEOUT_SECONDS`を再調整することを推奨する。
