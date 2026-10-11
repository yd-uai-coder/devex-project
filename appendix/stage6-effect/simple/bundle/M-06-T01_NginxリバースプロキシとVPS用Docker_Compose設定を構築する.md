# M-06-T01 NginxリバースプロキシとVPS用Docker Compose設定を構築する

> 種別: 基盤 / マイルストーン: M-06 Docker・Nginx・CI/CDによるデプロイ基盤構築 / 要件: NFR-005, CON-004 / 依存: M-05-T01

## 目的

VPS環境向けのNginxリバースプロキシと統合Docker Compose設定を構築する。

## 対象の処理・参照する設計

- 内部設計書 3.2 データモデル

## 作成・変更するファイル(依存順)

| ファイル | 種類 | 責務 | 根拠 |
|---|---|---|---|
| `nginx/Dockerfile` | 環境・設定 | Nginxのカスタムビルドまたは設定適用を行うためのDockerfileを定義する | 段階7 環境・設定のファイル |
| `nginx/conf.d/default.conf` | モジュール | リバースプロキシのルーティングとSSL終端、静的ファイル配信の設定を行う | 段階4 |
| `docker-compose.yml` | 環境・設定 | バックエンド・フロントエンド・データベース・Nginxを含むVPS用統合Docker Compose環境を定義する | 段階7 環境・設定のファイル |

## 実装の要点(設計に書いていないことだけ)

- nginx/conf.d/default.confを先に配置し、それを参照するnginx/Dockerfileおよびdocker-compose.ymlを順に作成する。

## テスト観点

| # | 観点 | SUT | ドライバ | スタブ |
|---|---|---|---|---|
| TC-01 | NginxおよびDocker Compose環境が正常に起動しリバースプロキシとして機能するか | docker-compose.yml | 手動テスト (docker compose up) | スタブ不要 ── インフラ構築のため |

- Given Docker Composeの設定が完了している When docker compose upを実行する Then 全てのコンテナが正常に起動する

## 確認方法

- docker compose up --buildコマンドを実行し、エラーなくコンテナが起動することを確認する。
- ブラウザまたはcurlでNginx経由のアクセスが各バックエンド・フロントエンドコンテナへルーティングされることを確認する。

## 未定義・要決定

なし
