# 段階3・5 の件数

`stage35.py` の出力(手で書き換えない)。

## detailed-1

### 段階3

- F-01 ユーザー登録する: DFD の書き込み users
- F-02 JWTログインする: DFD の書き込み なし
- F-03 プロジェクトを作成し参考資料をアップロードする: DFD の書き込み projects
- F-04 チャットメッセージを送信しAI応答を取得する: DFD の書き込み なし
- F-05 4種設計書を自動生成し不足点診断を行う: DFD の書き込み projects
- F-06 空送信チェックを行う: DFD の書き込み なし
- F-07 設計書コンテンツをクリップボードにコピーまたはダウンロードする: DFD の書き込み なし

- CRUD のセル 8、補ったセル 0
- 段階3の検証: なし
- CRUD に書き込みがあり DFD に線が無い(処理 × テーブル) 3
  - F-03 × reference_files → C
  - F-04 × chat_messages → CR
  - F-05 × documents → CR

### 段階5

- F-01 ユーザー登録する: 分岐の行 2
  - 1a 入力値の形式が不正 → ValidationError → 422 / 直前の手順 1: ユーザー登録リクエストを受け付ける(1a へ)
  - 3a 既に登録済みのメールアドレスである → ConflictError → 409 / 直前の手順 3: 既存のメールアドレスが存在するか確認する(3a へ)
- F-02 JWTログインする: 分岐の行 3
  - 1a リクエストボディの形式が不正 → ValidationError → 422 / 直前の手順 1: JWTログインリクエストを受け付ける(1a へ)
  - 3a ユーザーが見つからない場合 → AuthenticationError → 401 / 直前の手順 3: メールアドレスでユーザーを検索する(3a へ)
  - 4a パスワードが一致しない場合 → AuthenticationError → 401 / 直前の手順 4: パスワードを検証する(4a へ)
- F-03 プロジェクトを作成し参考資料をアップロードする: 分岐の行 1
  - 1a 入力データまたはファイル形式が不正 → ValidationError → 400 / 直前の手順 1: プロジェクト作成リクエストを受け付ける(1a へ)
- F-04 チャットメッセージを送信しAI応答を取得する: 分岐の行 3
  - 1a リクエストボディが不正である場合 → ValidationError → 422 / 直前の手順 1: チャット送信のエンドポイントでリクエストを受け付ける(1a へ、1b へ)
  - 1b 認証エラーの場合 → UnauthorizedError → 401 / 直前の手順 1: チャット送信のエンドポイントでリクエストを受け付ける(1a へ、1b へ)
  - 5a 外部API呼び出しに失敗した場合 → ExternalAPIError → 502 / 直前の手順 5: Gemini Flash-Liteを使用してAI応答メッセージを取得する(5a へ)
- F-05 4種設計書を自動生成し不足点診断を行う: 分岐の行 1
  - 1a プロジェクトが存在しない場合 → NotFoundError -> 404 / 直前の手順 1: 設計書自動生成と不足点診断のエンドポイントリクエストを受け付ける(1a へ)
- F-06 空送信チェックを行う: 分岐の行 1
  - 1a 入力内容が空または空白のみ → ValidationError → 送信ボタンを無効化またはエラーメッセージを表示する / 直前の手順 1: チャットメッセージの入力内容を入力して送信操作を行う(1a へ)
- F-07 設計書コンテンツをクリップボードにコピーまたはダウンロードする: 分岐の行 1
  - 1a Markdown内容が空の場合 → ValidationError → 400エラー / 直前の手順 1: クリップボードにコピーまたはダウンロードの操作を行う(1a へ)

- 処理 7、分岐の行 12(処理あたり 1.71)
- MISSING_BRANCH_TARGET: 0 
- 段階5の検証: CALLEE_NOT_DEPENDENCY, CALLEE_NOT_DEPENDENCY, EMPTY_CALL

## detailed-2

### 段階3

- F-01 アカウント登録: DFD の書き込み users
- F-02 ログイン: DFD の書き込み なし
- F-03 チャットメッセージ送信とAI応答: DFD の書き込み chats
- F-04 設計書一括生成と自己診断の実行: DFD の書き込み documents
- F-05 プレビューの切り替えと設計書表示: DFD の書き込み なし

- CRUD のセル 5、補ったセル 0
- 段階3の検証: なし
- CRUD に書き込みがあり DFD に線が無い(処理 × テーブル) 0

### 段階5

- F-01 アカウント登録: 分岐の行 2
  - 1a 入力データが不正 → ValidationError → 400 / 直前の手順 1: アカウント登録のリクエストを受け付ける(1a へ)
  - 2a すでに登録済みのメールアドレス → ConflictError → 409 / 直前の手順 2: 認証のビジネスロジックを制御しアカウントを新規登録する(2a へ)
- F-02 ログイン: 分岐の行 2
  - 3a ユーザーが存在しない場合 → AuthenticationError → 401 / 直前の手順 3: ユーザー情報を取得する(3a へ、3b へ)
  - 3b パスワードが一致しない場合 → AuthenticationError → 401 / 直前の手順 3: ユーザー情報を取得する(3a へ、3b へ)
- F-03 チャットメッセージ送信とAI応答: 分岐の行 2
  - 1a リクエストデータが不正な場合 → ValidationError → 400 / 直前の手順 1: チャットメッセージ送信とAI応答のリクエストを受け付ける(1a へ)
  - 3a 外部API呼び出しに失敗した場合 → ExternalAPIError → 502 / 直前の手順 3: Gemini Flash-Lite APIを利用してAI応答を生成する(3a へ)
- F-04 設計書一括生成と自己診断の実行: 分岐の行 1
  - 3a AI連携での生成に失敗した場合 → ExternalServiceError → 502 / 直前の手順 3: Gemini Flash-Lite APIを使用して4種のMarkdown設計書と自己診断結果を生成する(3a へ)
- F-05 プレビューの切り替えと設計書表示: 分岐の行 1
  - 2a 該当する設計書データが存在しない → NotFoundError → 404 / 直前の手順 2: タブに対応する設計書または自己診断結果の取得を要求する(2a へ)

- 処理 5、分岐の行 8(処理あたり 1.60)
- MISSING_BRANCH_TARGET: 0 
- 段階5の検証: EMPTY_CALL

## detailed-3

### 段階3

- F-01 ユーザー登録する: DFD の書き込み users
- F-02 ログインする: DFD の書き込み tokens
- F-03 プロジェクト一覧を取得する: DFD の書き込み なし
- F-04 プロジェクトを作成する: DFD の書き込み projects
- F-05 チャットメッセージを送信する: DFD の書き込み chats
- F-06 参考資料をアップロードする: DFD の書き込み documents
- F-07 構造化サマリを承認して文書生成を開始する: DFD の書き込み documents, summaries
- F-08 生成文書および版一覧を取得する: DFD の書き込み なし

- CRUD のセル 10、補ったセル 0
- 段階3の検証: なし
- CRUD に書き込みがあり DFD に線が無い(処理 × テーブル) 0

### 段階5

- F-01 ユーザー登録する: 分岐の行 2
  - 1a メールアドレスまたはパスワードの形式が不正 → ValidationError → 400 / 直前の手順 1: ユーザー登録リクエストを受信する(1a へ)
  - 2a すでに登録済みのメールアドレス → ConflictError → 409 / 直前の手順 2: ビジネスロジックを実行しパスワードをハッシュ化する(2a へ)
- F-02 ログインする: 分岐の行 1
  - 3a ユーザーが存在しない場合、またはパスワードが一致しない場合 → AuthenticationError → 401 Unauthorized / 直前の手順 3: メールアドレスをもとにユーザーを検索する(3a へ)
- F-03 プロジェクト一覧を取得する: 分岐の行 1
  - 1a 認証トークンが無効または期限切れである → UnauthorizedError → 401 / 直前の手順 1: プロジェクト一覧取得APIへのリクエストを送信する(1a へ)
- F-04 プロジェクトを作成する: 分岐の行 2
  - 1a 認証トークンが無効または期限切れ → UnauthorizedError → 401 / 直前の手順 1: プロジェクト作成リクエストを受信する(1a へ)
  - 3a トークン検証失敗 → AuthError → 401 / 直前の手順 3: 認証トークンを検証しユーザーを特定する(3a へ)
- F-05 チャットメッセージを送信する: 分岐の行 2
  - 1a メッセージが空または文字数制限を超過している場合 → ValidationError → 400 / 直前の手順 1: チャットメッセージ送信リクエストを受け付ける(1a へ、1b へ)
  - 1b 認証トークンが無効な場合 → UnauthorizedError → 401 / 直前の手順 1: チャットメッセージ送信リクエストを受け付ける(1a へ、1b へ)
- F-06 参考資料をアップロードする: 分岐の行 3
  - 1a 認証トークンが無効または期限切れ → HTTP 401 Unauthorized / 直前の手順 1: 参考資料アップロードリクエストを受け付ける(1a へ、1b へ)
  - 1b プロジェクトIDが存在しない → HTTP 404 Not Found / 直前の手順 1: 参考資料アップロードリクエストを受け付ける(1a へ、1b へ)
  - 3a サポート外のファイル形式 → HTTP 400 Bad Request / 直前の手順 3: ファイルを読み込んでテキスト化し、DBに保存する(3a へ)
- F-07 構造化サマリを承認して文書生成を開始する: 分岐の行 2
  - 1a 認証トークンが無効である → UnauthorizedError → 401 / 直前の手順 1: 構造化サマリ承認と文書生成開始のAPIリクエストを受け取る(1a へ、1b へ)
  - 1b 対象のプロジェクトまたは構造化サマリが存在しない → NotFoundError → 404 / 直前の手順 1: 構造化サマリ承認と文書生成開始のAPIリクエストを受け取る(1a へ、1b へ)
- F-08 生成文書および版一覧を取得する: 分岐の行 2
  - 1a 認証トークンが無効または期限切れ → UnauthorizedError -> 401 / 直前の手順 1: 生成文書および版一覧取得のリクエストを受け取る(1a へ)
  - 4a プロジェクトが見つからない → NotFoundError -> 404 / 直前の手順 4: PostgreSQLからプロジェクトに紐づく4種文書と直近3件の版履歴を取得する(4a へ)

- 処理 8、分岐の行 15(処理あたり 1.88)
- MISSING_BRANCH_TARGET: 0 
- 段階5の検証: CALLEE_NOT_DEPENDENCY, CALLEE_NOT_DEPENDENCY

## まとめ

```json
[
 {
  "run": "detailed-1",
  "dfd_write_inferred": 0,
  "dfd_write_missing": 0,
  "inferred_cells": 0,
  "crud_write_without_dfd": 3,
  "procedures": 7,
  "branch_rows": 12,
  "missing_branch_target": 0
 },
 {
  "run": "detailed-2",
  "dfd_write_inferred": 0,
  "dfd_write_missing": 0,
  "inferred_cells": 0,
  "crud_write_without_dfd": 0,
  "procedures": 5,
  "branch_rows": 8,
  "missing_branch_target": 0
 },
 {
  "run": "detailed-3",
  "dfd_write_inferred": 0,
  "dfd_write_missing": 0,
  "inferred_cells": 0,
  "crud_write_without_dfd": 0,
  "procedures": 8,
  "branch_rows": 15,
  "missing_branch_target": 0
 }
]
```
