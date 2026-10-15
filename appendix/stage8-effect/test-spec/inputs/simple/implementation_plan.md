# 4. 実装計画書

## 4.1 開発フェーズ分割・マイルストーン

フェーズ1(MVP): プロジェクト基盤の構築と、アカウント作成・トークン発行、献立の登録・一覧取得、アカウント削除までの全機能の実装を行う。

## 4.2 タスク分解（WBS）

### M-01: プロジェクト基本構造およびDocker環境の構築 ── 【Must】
- ゴール: Dockerコンテナ上でFastAPIアプリケーションが起動し、PostgreSQLとの接続が行える状態になること。
- [ ] M-01-T01 [基盤] プロジェクト基本構造およびDocker環境の構築
  - 処理: なし
  - 要件: なし
  - 依存: なし
  - モジュール: app/main.py, app/models/database.py
  - 環境・設定: Dockerfile, docker-compose.yml

### M-02: アカウント作成および献立管理機能の実装 ── 【Must】
- ゴール: アカウント作成、献立の登録・一覧取得、およびアカウント削除機能が動作すること。
- [ ] M-02-T01 [機能] アカウント作成・トークン発行APIの実装
  - 処理: DF-3
  - 要件: FR-004
  - 依存: M-01-T01
  - モジュール: app/routers/users.py, app/services/user_service.py
  - 環境・設定: なし
- [ ] M-02-T02 [機能] 献立一覧取得APIの実装
  - 処理: DF-4
  - 要件: FR-001, FR-004, NFR-003
  - 依存: M-02-T01
  - モジュール: app/routers/menus.py, app/services/menu_service.py
  - 環境・設定: なし
- [ ] M-02-T03 [機能] AI生成・献立記録APIの実装
  - 処理: DF-1
  - 要件: FR-001, FR-002, FR-004, NFR-003
  - 依存: M-02-T02
  - モジュール: app/routers/menus.py, app/services/menu_service.py, app/services/ai_service.py
  - 環境・設定: なし
- [ ] M-02-T04 [機能] アカウント削除APIおよび関連データ削除処理の実装
  - 処理: DF-2
  - 要件: FR-003, FR-004
  - 依存: M-02-T03
  - モジュール: app/routers/account.py, app/services/menu_service.py
  - 環境・設定: なし

## 4.3 開発環境・CI/CD・事前準備事項

開発言語はPython 3.11+, フレームワークにFastAPI, データベースにPostgreSQLを使用する。リポジトリ構成はレイヤードアーキテクチャに則り routers, services, models に分離する。Dockerコンテナを用いてローカル環境や手元パソコン、社内サーバーへデプロイする。

## 4.4 想定リスクと対策（トレードオフ・後回し候補）

**リスク1: 認証用トークンが未発行または漏洩した場合に不正アクセスを受ける可能性**

*対策*: アカウント作成時にユニークなトークンを発行し、すべてのAPIリクエストでトークン検証を必須とする。

