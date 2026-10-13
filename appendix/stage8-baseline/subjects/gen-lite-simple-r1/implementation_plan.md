# 4. 実装計画書

## 4.1 開発フェーズ分割・マイルストーン

フェーズ1(MVP): コア機能であるユーザー登録、参考資料読み込み、チャットヒアリング、4種設計書の一括生成と自己診断、プレビュー・コピー・ダウンロードを実現します。(M-01, M-02, M-03, M-04)

## 4.2 タスク分解（WBS）

### M-01: 基盤構築と認証機能 ── 【Must】
- ゴール: プロジェクトの枠組みが整い、ユーザー登録とログイン認証ができるようになる
- [ ] M-01-T01 [基盤] プロジェクト初期設定とDB・Docker環境構築
  - 処理: なし
  - 要件: なし
  - 依存: なし
  - モジュール: なし
  - 環境・設定: Dockerfile, docker-compose.yml
- [ ] M-01-T02 [機能] ユーザー登録機能の実装
  - 処理: DF-1
  - 要件: FR-001
  - 依存: M-01-T01
  - モジュール: backend/api/auth.py, backend/services/auth_service.py, backend/repositories/user_repository.py
  - 環境・設定: なし
- [ ] M-01-T03 [機能] ログイン認証とJWT・Redis管理の実装
  - 処理: DF-2
  - 要件: NFR-007
  - 依存: M-01-T02
  - モジュール: backend/api/auth.py, backend/services/auth_service.py, backend/repositories/user_repository.py
  - 環境・設定: なし

### M-02: 参考資料読み込みとプロジェクト作成 ── 【Must】
- ゴール: 初期入力で参考資料を読み込み、プロジェクトを作成できるようになる
- [ ] M-02-T01 [機能] プロジェクト作成と参考資料アップロード機能の実装
  - 処理: DF-3
  - 要件: FR-005
  - 依存: M-01-T03
  - モジュール: backend/api/projects.py, backend/services/project_service.py, backend/repositories/project_repository.py
  - 環境・設定: なし

### M-03: チャットヒアリング機能 ── 【Must】
- ゴール: チャットでのヒアリング応答と文字数・空送信の制御、失敗時の再送処理ができるようになる
- [ ] M-03-T01 [機能] チャットメッセージ送信とLLMヒアリング応答の実装
  - 処理: DF-4
  - 要件: FR-006, FR-007
  - 依存: M-02-T01
  - モジュール: backend/api/projects.py, backend/services/project_service.py, backend/repositories/project_repository.py
  - 環境・設定: なし

### M-04: 設計書一括生成と自己診断・プレビュー機能 ── 【Must】
- ゴール: LangGraphを用いて4種の設計書一括生成と3段階の自己診断を行い、フロントエンドでプレビュー・コピー・ダウンロードができるようになる
- [ ] M-04-T01 [機能] 設計書一括生成および自己診断機能の実装
  - 処理: DF-5
  - 要件: FR-002, FR-003
  - 依存: M-03-T01
  - モジュール: backend/api/projects.py, backend/services/project_service.py, backend/repositories/project_repository.py
  - 環境・設定: なし
- [ ] M-04-T02 [機能] 生成成果物のプレビュー・コピー・ダウンロード機能の実装
  - 処理: なし
  - 要件: FR-004
  - 依存: M-04-T01
  - モジュール: backend/api/projects.py
  - 環境・設定: なし

## 4.3 開発環境・CI/CD・事前準備事項

開発環境として Python 3.13、FastAPI、Next.js (App Router) + Tamagui を利用する。データベースには PostgreSQL と Redis を使用し、Docker Compose を用いてローカルおよび VPS 上でのコンテナ管理を行う。CI/CD には GitHub Actions を使用し、自動デプロイを構成する。

## 4.4 想定リスクと対策（トレードオフ・後回し候補）

**リスク1: LLM(Gemini Flash-Lite)の応答時間が数分を超える性能要件の限界に達するリスク**

*対策*: プロンプトの効率化やLangGraphの処理フローを最適化し、タイムアウトや応答遅延を防ぐ。必要に応じて生成処理を非同期ジョブ化するトレードオフを検討する。

**リスク2: 参考資料のパース処理におけるファイル形式エラーや容量超過のリスク**

*対策*: バックエンド側のバリデーション層でファイル形式・サイズを厳格に検証し、例外発生時は適切にエラーを返すようにする。
