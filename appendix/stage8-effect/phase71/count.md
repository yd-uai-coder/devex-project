# Phase 71 の新しい警告(保存済みの実行)

`count.py` の出力(手で書き換えない)。

## DFD_STORE_MISSING(段階3)

- stage7-effect/hearing/detailed-1: 3
  - F-03 × reference_files
  - F-04 × chat_messages
  - F-05 × documents
- stage7-effect/hearing/detailed-2: 0
- stage7-effect/hearing/detailed-3: 0
- stage8-effect/hearing/detailed-1: 2
  - F-03 × tokens
  - F-08 × messages
- stage8-effect/phase59/schema: 2
  - F-03 × tokens
  - F-08 × messages

## GOAL_WITHOUT_TASK(段階7・実装計画書)

- goal3-generated/detailed/stages/stage7.json: 0/4
- stage6-baseline/detailed/stages/stage7.json: 0/4
- stage6-effect/detailed/stages/stage7.json: 0/3
- stage7-effect/hearing/detailed-1/stages/stage7.json: 0/4
- stage7-effect/hearing/detailed-2/stages/stage7.json: 0/3
- stage7-effect/hearing/detailed-3/stages/stage7.json: 0/4
- stage8-effect/hearing/detailed-1/stages/stage7.json: 0/3
- stage8-effect/phase59/schema/stages/stage7.json: 0/3
- goal3-generated/detailed/bundle/implementation_plan.md: 0/0
- goal3-generated/simple/implementation_plan.md: 0/0
- stage6-baseline/detailed/bundle/design/implementation_plan.md: 0/0
- stage6-baseline/simple/implementation_plan.md: 0/6
- stage6-effect/detailed/bundle/design/implementation_plan.md: 0/0
- stage6-effect/simple/implementation_plan.md: 1/6
  - M-01(フロントエンド): バックエンド・フロントエンドの雛形が立ち上がり、PostgreSQLに接続できること
- stage6-effect/simple-2/implementation_plan.md: 0/4
- stage7-effect/hearing/simple-1/implementation_plan.md: 0/3
- stage7-effect/hearing/simple-1/regen/implementation_plan.md: 1/3
  - M-01(フロントエンド): Docker Composeによるデータベースおよびコンテナ環境が起動し、バックエンド・フロントエンドの雛形が動作すること。
- stage7-effect/hearing/simple-2/implementation_plan.md: 1/3
  - M-01(フロントエンド): FastAPIおよびNext.jsのプロジェクト構造が作成され、Docker ComposeでDB・キャッシュを含めて起動できるようになること
- stage7-effect/hearing/simple-2/regen/implementation_plan.md: 0/5
- stage7-effect/hearing/simple-3/implementation_plan.md: 1/4
  - M-01(フロントエンド): Next.jsとFastAPIの基本リポジトリ構造とDocker環境が起動するようになること
- stage7-effect/hearing/simple-3/regen/implementation_plan.md: 0/4
- stage8-baseline/subjects/detailed-full/implementation_plan.md: 0/0
- stage8-baseline/subjects/gen-38f-simple-r1/implementation_plan.md: 0/5
- stage8-baseline/subjects/gen-38f-simple-r2/implementation_plan.md: 1/5
  - M-05(バックアップ): VPS上でnginx・コンテナ群が稼働し、GitHub Actionsによる自動テストおよびデプロイ、DBバックアップ体制が確立すること
- stage8-baseline/subjects/gen-38f-simple-r3/implementation_plan.md: 0/4
- stage8-baseline/subjects/gen-lite-simple-r1/implementation_plan.md: 0/4
- stage8-baseline/subjects/gen-lite-simple-r2/implementation_plan.md: 0/3
- stage8-baseline/subjects/gen-lite-simple-r3/implementation_plan.md: 0/2
- stage8-baseline/subjects/simple/implementation_plan.md: 1/3
  - M-01(フロントエンド): FastAPIおよびNext.jsのプロジェクト構造が作成され、Docker ComposeでDB・キャッシュを含めて起動できるようになること
- stage8-baseline/subjects/simple-procedure/implementation_plan.md: 1/3
  - M-01(フロントエンド): FastAPIおよびNext.jsのプロジェクト構造が作成され、Docker ComposeでDB・キャッシュを含めて起動できるようになること
- stage8-effect/hearing/simple-1/v1/implementation_plan.md: 1/4
  - M-01(フロントエンド): Docker Composeによる開発・稼働環境が構築され、FastAPIとNext.jsの基本設定が完了する
- stage8-effect/hearing/simple-1/v2/implementation_plan.md: 1/4
  - M-01(CI/CD・バックアップ): コンテナ環境、データベース、Redis、リポジトリおよびCI/CD・バックアップ基盤が整うこと。
- stage8-effect/test-spec/inputs/simple/implementation_plan.md: 0/2
