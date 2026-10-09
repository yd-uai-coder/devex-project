# M-03-T01 AI対話チャットとGemini API連携機能を実装する

> 種別: 機能 / マイルストーン: M-03 AI対話チャットと構造化サマリ / 依存: M-02-T02

## 目的

利用者のチャットメッセージを受け取り、Gemini APIとの連携によるAI応答の生成とDBへの履歴保存・クライアント返却を行う機能を実装する。

## 対象の処理・参照する設計

- 内部設計書 DF-03 POST /api/v1/projects/{id}/chats

## 作成・変更するファイル(依存順)

| ファイル | 種類 | 責務 | 根拠 |
|---|---|---|---|
| `backend/.env` | 環境・設定 | Gemini APIの接続に必要な環境変数を設定する | 環境・設定のファイル(例): backend/.env |
| `backend/src/modules/chats/gemini.service.ts` | モジュール | Gemini APIとの通信およびプロンプト構築を行い、AI応答テキストを取得する | backend/src/modules/chats/gemini.service.ts |
| `backend/src/modules/chats/chats.service.ts` | モジュール | チャットメッセージのDB保存処理およびGeminiServiceを呼び出すビジネスロジックを実装する | backend/src/modules/chats/chats.service.ts |
| `backend/src/modules/chats/chats.controller.ts` | モジュール | POST /api/v1/projects/{id}/chats のリクエストを受け付け、サービス層を呼び出してレスポンスを返却する | backend/src/modules/chats/chats.controller.ts |
| `backend/src/modules/chats/chats.service.spec.ts` | テスト | chats.serviceの単体テストを実施する | 実装計画書 4.3 自動テスト・CI/CD方針 |

## 実装の要点(設計に書いていないことだけ)

- 環境変数にGemini API用の設定を追加する。
- GeminiServiceを作成し、次にChatsService、最後にChatsControllerの順に依存関係に合わせて実装する。

## テスト観点

| # | 観点 | SUT | ドライバ | スタブ |
|---|---|---|---|---|
| TC-01 | チャットメッセージ送信時にAI応答が取得され、DBにユーザーとAIのメッセージが保存されること | ChatsService.create | Jestによる単体テスト | GeminiServiceはスタブ化し固定のAI応答を返すようにする |

- Given 有効なプロジェクトIDとチャットメッセージが入力されたとき
- When ChatsService.createが呼び出されGemini APIから応答が得られたとき
- Then ユーザーメッセージとAI応答がchatsテーブルに保存され、結果が返却されること

## 確認方法

- Jestを用いた単体テストがすべて成功することを確認する。
- POST /api/v1/projects/{id}/chats エンドポイントへリクエストを送り、期待されるJSONレスポンスが返ることを確認する。

## 未定義・要決定

なし
