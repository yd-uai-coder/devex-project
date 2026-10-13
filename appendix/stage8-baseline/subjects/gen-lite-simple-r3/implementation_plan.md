# 4. 実装計画書

## 4.1 開発フェーズ分割・マイルストーン

フェーズ1(MVP): 基盤構築、ユーザー認証機能、プロジェクト管理機能、チャットヒアリング機能、4種設計書一括生成およびプレビュー機能の基本機能を構築し、セキュアな状態でデプロイする。

## 4.2 タスク分解（WBS）

### M-01: 基盤構築と環境設定 ── 【Must】
- ゴール: FastAPI、Next.js、PostgreSQL、Redis、Docker Composeの環境が正常に起動する状態にする。
- [ ] M-01-T01 [基盤] バックエンド・フロントエンドのプロジェクト初期設定とDocker Compose構築
  - 処理: なし
  - 要件: なし
  - 依存: なし
  - モジュール: なし
  - 環境・設定: Dockerfile, docker-compose.yml, backend/requirements.txt

### M-02: 認証・プロジェクト・チャット・生成機能の実装 ── 【Must】
- ゴール: ユーザー登録・ログインから、参考資料付きプロジェクト作成、チャットヒアリング、4種設計書の自動生成とプレビュー・コピー・ダウンロード、自己診断提示までの一連のコア機能がすべて動作する状態にする。
- [ ] M-02-T01 [機能] アカウント登録・ログイン認証機能の実装
  - 処理: DF-1, DF-2
  - 要件: FR-001
  - 依存: M-01-T01
  - モジュール: backend/app/api/v1/auth.py, backend/app/core/security.py
  - 環境・設定: なし
- [ ] M-02-T02 [機能] プロジェクト作成・参考資料読み込み機能の実装
  - 処理: DF-3, DF-4
  - 要件: FR-005
  - 依存: M-02-T01
  - モジュール: backend/app/api/v1/projects.py
  - 環境・設定: なし
- [ ] M-02-T03 [機能] チャットヒアリングとLLM対話制御・例外処理の実装
  - 処理: DF-5
  - 要件: FR-006
  - 依存: M-02-T02
  - モジュール: backend/app/services/chat_service.py, backend/app/api/v1/projects.py
  - 環境・設定: なし
- [ ] M-02-T04 [機能] 4種設計書一括生成および自己診断・プレビュー機能の実装
  - 処理: DF-6, DF-7
  - 要件: FR-002, FR-003, FR-004
  - 依存: M-02-T03
  - モジュール: backend/app/services/generation_service.py, backend/app/api/v1/projects.py
  - 環境・設定: なし

## 4.3 開発環境・CI/CD・事前準備事項

開発環境としてPython 3.13、Node.js、Docker Composeを使用する。CI/CDはGitHub Actionsを用い、VPS上のDocker Compose環境へ自動デプロイする構成とする。

## 4.4 想定リスクと対策（トレードオフ・後回し候補）

**リスク1: LLMの応答遅延やAPI制限による生成失敗**

*対策*: Gemini Flash-Liteを使用し、タイムアウト設定やエラーハンドリングを適切に実装して再送を促すUI設計とする。

**リスク2: VPS環境でのリソース枯渇**

*対策*: 同時接続数制限とRedisによるレートリミットを導入し、不正利用や過負荷を防ぐ。
