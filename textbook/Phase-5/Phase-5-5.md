# Phase-5-5: 共有Traefikリバースプロキシへの移行(複数プロジェクト同居対応)

## この章の目的

実際にConoHa VPSへ`docker-compose.prod.yml`をデプロイしたところ、同じVPSに同居する別プロジェクトが既にポート80/443を専有しており、devex-api自身の`nginx`サービスが起動できなかった(`sudo ss -tlnp`で`docker-proxy`が0.0.0.0:80を掴んでいることを確認)。ユーザーは今後もこのVPSに複数プロジェクトを同居させる予定であり、標準的な構成を採りたいとのことだったため、devex-api固有の`nginx`+`certbot`を廃止し、VPS共有の**Traefik**リバースプロキシへ移行する。

納期モード([`Phase-5-introduction.md`](./Phase-5-introduction.md)参照)。ただしTraefik採用の判断根拠(#17: 実在する消費者=複数プロジェクトの同居)は明記する。

## この章で作成・更新したファイル

- [`devex-api/docker-compose.prod.yml`](../../devex-api/docker-compose.prod.yml) ── `nginx`・`certbot`サービスと関連ボリューム(`certbot_webroot`・`certbot_conf`)を削除。`backend`に外部ネットワーク`edge`への参加とTraefikルーティング用labelを追加
- [`devex-api/nginx/nginx.prod.conf`](../../devex-api/nginx/nginx.prod.conf) ── 削除(本番専用ファイルのため。開発用`nginx/nginx.conf`は維持)
- [`devex-api/OPERATIONS.md`](../../devex-api/OPERATIONS.md) ── 全体構成図・「1. VPS初期セットアップ」(Traefik導入手順)・「3. 初回デプロイ手順」・「4. 新規プロジェクトをTraefik配下に追加する手順」(新設、旧「TLS証明書の取得・更新」を置き換え)・「7. 監視の最低限」を更新
- [`devex-api/README.md`](../../devex-api/README.md) ── ディレクトリ構造・「本番環境」節を更新

## なぜTraefikか(CLAUDE.md #17)

「この構成変更を今駆動している実在の消費者は何か」という#17の判定基準に照らすと、消費者は**同じVPSに同居する複数プロジェクト**そのものである。ユーザーへの確認で、今後も複数プロジェクトを同居させていく方針が明言されたため、場当たり的なポート変更(例: devex-apiだけ8443等の非標準ポートを使う)ではなく、標準的な「1つの共有リバースプロキシが80/443を持ち、各プロジェクトはドメイン(Host)ベースでルーティングされる」構成を採用した。

Traefikを選んだ理由は、Docker Provider(コンテナのlabelを見て動的にルーティング規則を生成)とACME(Let's Encrypt)による証明書の自動取得・自動更新を1コンテナで完結できる点。プロジェクトを追加するたびに共有nginxの設定ファイルを手で書き足す必要がなく、各プロジェクト側の`docker-compose.prod.yml`にlabelを追加するだけで完結する。

## 構成の変更点

### Before(nginx + certbot、devex-api専有)

```
[ ブラウザ ] → [ devex-api: nginx (80/443、TLS終端) ] → [ backend ]
```

### After(共有Traefik)

```
[ ブラウザ ] → [ 共有Traefik (80/443、TLS終端、VPS共有) ] → [ devex-api: backend ]
                                                     └→ [ 他プロジェクト ]
```

`docker-compose.prod.yml`の変更差分(要点):

```diff
   backend:
     ...
     networks:
       - internal
+      - edge
+    labels:
+      - "traefik.enable=true"
+      - "traefik.docker.network=edge"
+      - "traefik.http.routers.devex-api.rule=Host(`your-domain.example.com`)"
+      - "traefik.http.routers.devex-api.entrypoints=websecure"
+      - "traefik.http.routers.devex-api.tls.certresolver=letsencrypt"
+      - "traefik.http.services.devex-api.loadbalancer.server.port=8000"

-  nginx:
-    image: nginx:1.27-alpine
-    ports:
-      - "80:80"
-      - "443:443"
-    ...
-
-  certbot:
-    image: certbot/certbot:latest
-    ...

 volumes:
   postgres_data:
   redis_data:
-  certbot_webroot:
-  certbot_conf:

 networks:
   internal:
+  edge:
+    external: true
```

`backend`自体はホストへポートを一切公開しない(Traefikが持つ`edge`ネットワーク経由でのみ到達可能)。

## リクエストボディサイズの防御が失われないことの確認

nginxの`client_max_body_size`は無くなるが、`app/api/middleware.py`の`BodySizeLimitMiddleware`(`devex-api/CLAUDE.md`「リクエスト保護」節)が元々「nginxを経由しない経路(開発環境やdocker内部ネットワーク直接アクセス)でも効くように」という理由でアプリ層に重ねて実装されていた。この既存の防御がそのまま機能するため、nginxを撤去しても防御が失われるわけではない(むしろ、Traefikに置き換わったことでnginx層自体が無くなった今、この設計判断がより重要になったとも言える)。

## テスト観点

インフラ設定(compose YAML・Traefik自体の設定)のみの変更で、importシンボルの変更が無いため#15の対象外。検証はコマンド実行結果で代替する。

| 確認項目 | 手段 | 結果 |
|---|---|---|
| `docker-compose.prod.yml`の構文 | `docker compose -f docker-compose.prod.yml config` | エラー無し |
| labelが正しくコンテナに反映される | `docker inspect devex-api-backend-1 --format '{{json .Config.Labels}}'` | `traefik.enable=true`等6個のlabelを確認 |
| ホストへポートが公開されていない | `docker compose -f docker-compose.prod.yml ps`のPORTS列 | `8000/tcp`のみ(ホスト側マッピング無し) |
| backend/postgres/redisが起動する | ローカルで外部ネットワーク`edge`を作成した上で`docker compose -f docker-compose.prod.yml up -d --build` | 3サービスともhealthy、マイグレーション適用・`/health`応答(コンテナ内から確認)とも成功 |

TLS込みの検証(実際にTraefikを経由したHTTPSアクセス)は、Traefikがdevex-apiのリポジトリ外(VPS共有)にあるためローカルでは行っていない。実VPSでの検証手順は[`OPERATIONS.md`](../../devex-api/OPERATIONS.md)「4. 新規プロジェクトをTraefik配下に追加する手順」の動作確認ステップに委ねる。

## 既に同居していた別プロジェクトの移行

同じVPSに以前から同居していた別プロジェクトも、Traefik導入にあたって直接のポート公開をやめてTraefik配下へ移行する必要がある(2つのコンテナが同じホストポートを同時に持つことはできないため)。この移行手順は`OPERATIONS.md`「4. 新規プロジェクトをTraefik配下に追加する手順」に汎用テンプレートとして記載し、devex-apiの移行はその最初の適用例、既存の他プロジェクトの移行は2番目の適用例という位置づけにした。同節には移行後の動作確認(対象ドメインへの`curl`・`docker compose ps`・Traefikログ確認)を必須ステップとして含めている。この手順は今後さらに別のプロジェクトを追加する際にも、devex-api固有の内容(ドメイン名・label値)を読み替えるだけでそのまま使える。

## 実VPSデプロイでの検証結果(追記)

本章執筆時点では「実VPSでの検証はユーザー自身が行う」としていたが、その後ユーザーが実際にConoHa VPS上で本手順を実行し、2件の実害ある不具合が見つかった。いずれも解決済みで、`https://devex-api.uandi-tech.com/health`が`{"status":"ok","database":"ok","redis":"ok"}`を返すことまで確認済み。

1. **Traefikのイメージタグ`v3.3`がDocker Engine 29+と非互換**: Docker 29がAPI最小サポートバージョンを1.44に引き上げたため、`v3.3`が使う古いDockerクライアント(APIバージョン1.24固定)がDockerデーモンとの通信そのものに失敗し(`client version 1.24 is too old`エラーで無限リトライ)、Traefikがコンテナを一切検出できなかった。`DOCKER_API_VERSION`環境変数での回避を試みたが効果が無く(Traefikの内部Dockerクライアントはこの環境変数を参照しないため)、`traefik:v3.6`(Docker API自動ネゴシエーション対応)へのイメージタグ変更で解決した。
2. **複数ネットワークに参加するコンテナへの到達にはネットワーク明示指定が必要**: `backend`は`internal`(DB/Redis用)と`edge`(Traefik用)の2つのネットワークに参加しているが、Traefikにどちらを使うか明示しないと誤ったネットワーク側のIPで接続を試み、`504 Gateway Timeout`になった。`traefik.docker.network=edge`labelを追加して解決した。

この2点は`OPERATIONS.md`「1. ConoHa VPS初期セットアップ」・「4. 新規プロジェクトをTraefik配下に追加する手順」に既知の注意点として反映済み。ローカル環境ではDocker Engineの実バージョンやTraefikの複数ネットワーク解決の挙動を完全には再現できず、実VPSデプロイで初めて顕在化した典型例である。

## 既知の残課題

- Traefikのダッシュボード機能は`OPERATIONS.md`のcompose例では有効化していない(個人利用規模では不要、かつ誤って公開すると情報漏洩リスクがあるため)。将来的に必要になった場合はBasic認証等でアクセス制限した上で有効化することを推奨する。
- 既に同居していた別プロジェクト(quaiz-api)自体のTraefik配下への移行、および今後quaiz-api以外のプロジェクトを追加する際の実際の適用は、本章執筆時点ではまだ実施例が1件(devex-api自身)のみである。
