# Phase-5-1: 本番用Dockerイメージの監査・最終確認

## この章の目的

[`docs/implementation_plan.md`](../../docs/implementation_plan.md) WBS区分5「本番環境用Dockerイメージのビルド最適化(マルチステージビルド等)」に対応する。`devex-api/backend/Dockerfile`は既にスターターテンプレート由来の3段構成(`base → builder → runtime`)を持つため、ゼロから作り直すのではなく、本番用として要件を満たしているかを監査し、見つかった不足のみを補う(CLAUDE.md #17: 既存が要件を満たすなら変更しない)。

納期モード([`Phase-5-introduction.md`](./Phase-5-introduction.md)参照)。#14のSUT/ドライバ/スタブの言語化は省略し、「動くこと」の確認に留める。

## この章で作成・更新したファイル

- [`devex-api/backend/Dockerfile`](../../devex-api/backend/Dockerfile) ── runtimeステージに`HEALTHCHECK`命令を追加

## 監査結果

既存の`backend/Dockerfile`を次の観点で確認した。

| 観点 | 結果 |
|---|---|
| マルチステージビルド | 既に`base`/`builder`/`runtime`の3段構成。本番は`runtime`ステージのみを使う(`docker-compose.prod.yml`の`build.target: runtime`) |
| レイヤーキャッシュ | `uv sync --locked --no-install-project`(依存関係だけを先にインストール)→`COPY . /app`→`uv sync --locked`(アプリ本体)の順で分離済み。アプリコードの変更だけでは依存関係インストールのレイヤーが再実行されない |
| 非rootユーザー | `runtime`ステージで`groupadd`/`useradd`により`app`ユーザーを作成し`USER app`で実行済み |
| `--reload`の有無 | `builder`ステージのCMDは`--reload`付き(開発用)、`runtime`ステージのCMDは`--reload`無し(本番用)で分離済み |
| イメージサイズ | `docker build --target runtime`で実測、`docker image ls`で606MB(python:3.13-slimベース+LangChain/LangGraph等の依存を考えると妥当な範囲。追加の軽量化(Alpineベースへの変更等)はLangChainの依存にネイティブビルドが必要なパッケージが含まれる可能性があり、ビルド安定性とのトレードオフのため本Phaseでは見送る) |
| `.dockerignore` | `.venv`/`.git`/`__pycache__`等、ビルドコンテキストに含めるべきでないものを除外済み。追加の不足なし |
| **`HEALTHCHECK`命令** | **無し(不足)**。`nginx/nginx.conf`経由の`/health`プロキシはあるが、コンテナ単体では`docker inspect`のHealth状態が取れず、`docker compose ps`のSTATUS列にも反映されない |

不足は`HEALTHCHECK`命令のみであり、これを追加した。

## `HEALTHCHECK`追加の判断根拠(CLAUDE.md #17)

「この共通化(検証機構の追加)を今駆動している、本Phaseの実在の消費者は何か」という#17の判定基準に照らすと、次の2つが実在の消費者になる:

1. [`Phase-5-2.md`](./Phase-5-2.md)で`docker-compose.prod.yml`の`nginx`サービスの起動順序を`depends_on: backend: condition: service_healthy`にする(postgres/redisと同じパターンに揃える)。これにはイメージ組み込みのHEALTHCHECKが必須(compose側の`healthcheck:`はイメージのCMDを上書き/補完するテストコマンドを指定するが、Docker Engine自体のHealth判定機構を有効にするにはイメージ側にHEALTHCHECKが定義されているか、compose側で明示的に`test:`を書く必要がある。今回は両方行った、[`Phase-5-2.md`](./Phase-5-2.md)参照)。
2. [`Phase-5-3.md`](./Phase-5-3.md)の運用マニュアルで「監視の最低限」として`docker compose ps`のHEALTH列を使う手順を書く。これがHEALTHCHECK無しでは機能しない。

```diff
     ENV PATH="/app/.venv/bin:$PATH"

     USER app

     EXPOSE 8000

+    # nginx経由の/healthプロキシとは別に、コンテナ単体でも`docker compose ps`のHEALTH列や
+    # `depends_on: condition: service_healthy`から状態を見られるようにする。
+    HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
+        CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/health', timeout=2).status == 200 else 1)"
+
     CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

`curl`等の追加インストールを避けるため、既にイメージに含まれるPythonの`urllib.request`でヘルスチェックを行っている(イメージサイズ・攻撃面を増やさない選択)。

## テスト観点(納期モード:「動くこと」の確認)

| 確認項目 | 手段 | 結果 |
|---|---|---|
| runtimeステージのビルドが通る | `docker build --target runtime -t devex-api:phase5-check ./backend` | 成功(約21秒、既存レイヤーキャッシュ利用時はさらに高速) |
| イメージサイズ | `docker image ls devex-api:phase5-check` | 606MB |
| HEALTHCHECKがイメージに組み込まれている | `docker inspect devex-api:phase5-check --format '{{json .Config.Healthcheck}}'` | `{"Test":["CMD-SHELL","python -c \"...\""],"Interval":30000000000,...}`(30秒間隔で設定済み) |

Dockerfile自体はimport可能なPythonシンボルを追加しないため、#15(全ファイルをテストがimportする)の対象外。上記コマンド実行結果による検証で代替する。

## 既知の残課題

- イメージサイズ(606MB)のさらなる軽量化(distroless化、Alpineベースへの移行等)は本Phaseでは行わなかった。LangChain/LangGraph関連パッケージの中にネイティブ拡張を含むものがあり、ベースイメージ変更は追加のビルド検証が必要なため、個人開発規模でのコスト対効果を踏まえ見送った。
