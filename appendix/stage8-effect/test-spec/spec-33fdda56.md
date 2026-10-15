# テスト仕様書

## 1 テストの方針

| 項目 | 内容 |
|---|---|
| 対象 | POST /api/v1/users, GET /api/v1/menus, POST /api/v1/menus, DELETE /api/v1/account, SCR-001 献立管理・生成画面, and NFR-001/NFR-002/NFR-003 non-functional requirements |
| 範囲外 | 過去の履歴からの学習機能 |
| 観点 | 正常・異常・境界・セキュリティ・非機能 |
| 環境 | Python, FastAPI, PostgreSQL |
| 完了条件 | すべての結合テストおよび総合テスト項目が実行され、期待結果を満たすこと |

## 2 結合テスト(API)

| テストID | 対象 | 観点 | 前提 | 手順・入力 | 期待結果 | 要件 | 処理・単位 |
|---|---|---|---|---|---|---|---|
| IT-001 | POST /api/v1/users | 正常 | データベースに該当ユーザーが存在しないこと | POST /api/v1/users に body={'password': 'securepassword123'} を送信する | HTTP 201 Created が返され、アクセストークンとユーザーデータが保存される | FR-004 | DF-3 / M-02-T01 |
| IT-002 | POST /api/v1/users | 異常 | — | POST /api/v1/users に不正な形式の body={'invalid_key': 'value'} を送信する | HTTP 400 Bad Request が返され、データは保存されない | FR-004 | DF-3 / M-02-T01 |
| IT-003 | POST /api/v1/users | 異常 | データベースサーバーを一時的に停止または接続断の状態にする | POST /api/v1/users に body={'password': 'securepassword123'} を送信する | HTTP 500 Internal Server Error が返され、データは保存されない | FR-004 | DF-3 / M-02-T01 |
| IT-004 | POST /api/v1/users | 境界 | — | POST /api/v1/users に空の body={'password': ''} を送信する | HTTP 400 Bad Request が返され、データは保存されない(**設計に無い**: パスワードフィールドの下限・上限文字数が設計で定義されていない) | FR-004 | DF-3 / M-02-T01 |
| IT-005 | GET /api/v1/menus | 正常 | 有効なアクセストークンを保持しており、献立データが登録されていること | GET /api/v1/menus に有効な Authorization ヘッダーを付与してリクエストを送信する | HTTP 200 OK が返され、登録済み献立一覧データが表示される | FR-001・FR-004 | DF-4 / M-02-T02 |
| IT-006 | GET /api/v1/menus | 異常 | — | GET /api/v1/menus にトークンを付与せずにリクエストを送信する | HTTP 401 Unauthorized が返され、データは取得されない | FR-001・FR-004 | DF-4 / M-02-T02 |
| IT-007 | GET /api/v1/menus | 異常 | 有効なトークンを保持し、データベース接続を遮断している状態にする | GET /api/v1/menus に有効なトークンを付与してリクエストを送信する | HTTP 500 Internal Server Error が返される | FR-001・FR-004 | DF-4 / M-02-T02 |
| IT-008 | POST /api/v1/menus | 正常 | 有効なアクセストークンを保持していること | POST /api/v1/menus に body={'content': 'カレーライス', 'token': 'valid_token'} を送信する | HTTP 201 Created が返され、献立データが保存される | FR-001・FR-002・FR-004 | DF-1 / M-02-T03 |
| IT-009 | POST /api/v1/menus | 異常 | 有効なアクセストークンを保持していること | POST /api/v1/menus に body={'content': '', 'token': 'valid_token'} を送信する | HTTP 400 Bad Request が返され、献立データは保存されない | FR-001・FR-002・FR-004 | DF-1 / M-02-T03 |
| IT-010 | POST /api/v1/menus | 異常 | — | POST /api/v1/menus に無効なトークン body={'content': 'カレーライス', 'token': 'invalid_token'} を送信する | HTTP 401 Unauthorized が返され、献立データは保存されない | FR-001・FR-002・FR-004 | DF-1 / M-02-T03 |
| IT-011 | POST /api/v1/menus | 異常 | データベース接続を遮断している状態にする | POST /api/v1/menus に有効な body を送信する | HTTP 500 Internal Server Error が返され、献立データは保存されない | FR-001・FR-002・FR-004 | DF-1 / M-02-T03 |
| IT-012 | POST /api/v1/menus | 境界 | 有効なアクセストークンを保持していること | POST /api/v1/menus に body={'content': '', 'token': 'valid_token'} (空文字) を送信する | HTTP 400 Bad Request が返され、献立データは保存されない(**設計に無い**: content フィールドの文字数上限が設計で定義されていない) | FR-001・FR-002・FR-004 | DF-1 / M-02-T03 |
| IT-013 | DELETE /api/v1/account | 正常 | 有効なアカウントとトークンが存在すること | DELETE /api/v1/account に body={'token': 'valid_token'} を送信する | HTTP 204 No Content が返され、アカウントおよび関連する献立データが削除される | FR-003・FR-004 | DF-2 / M-02-T04 |
| IT-014 | DELETE /api/v1/account | 異常 | — | DELETE /api/v1/account に無効なトークン body={'token': 'invalid_token'} を送信する | HTTP 401 Unauthorized が返され、データは削除されない | FR-003・FR-004 | DF-2 / M-02-T04 |
| IT-015 | DELETE /api/v1/account | 異常 | — | DELETE /api/v1/account に存在しないアカウントのトークン body={'token': 'nonexistent_token'} を送信する | HTTP 404 Not Found が返され、データは削除されない | FR-003・FR-004 | DF-2 / M-02-T04 |

## 3 総合テスト(画面の流れ・非機能)

| テストID | 対象 | 観点 | 手順 | 期待結果 | 要件 |
|---|---|---|---|---|---|
| ST-001 | SCR-001 | 正常 | SCR-001を開き、アカウント作成を行ってトークンを取得後、献立を記録し、一覧で確認した後にアカウントを削除する | 各操作が正常に完了し、HTTP 201/200/204 が返却され、画面上で一連の処理が滞りなく流れる | FR-001・FR-002・FR-003・FR-004 |
| ST-002 | 可用性 | 非機能 | 任意のタイミングでAPIにアクセスし、システムが稼働していることを確認する | エラーなく応答を返し、利用したい時にいつでも動いている状態であること（可用性確認） | NFR-001 |
| ST-003 | 可用性 | 非機能 | 意図的にデータを損失させる障害を起こし、データの復旧が行われない仕様（諦める仕様）であることを確認する | バックアップ機能が存在せず、データ消失時に復旧しない仕様を満たしていること | NFR-002 |
| ST-004 | 性能・拡張性 | 非機能 | 同時に2〜3人のユーザーからリクエストを送信し、応答時間（レイテンシ）を計測する | 同時利用時において、応答時間が2〜3分の範囲内に収まること | NFR-003 |

## 4 要件との対応

| 要件 | 優先度 | テスト |
|---|---|---|
| FR-001 | Must | IT-005・IT-006・IT-007・IT-008・IT-009・IT-010・IT-011・IT-012・ST-001 |
| FR-002 | Must | IT-008・IT-009・IT-010・IT-011・IT-012・ST-001 |
| FR-003 | Must | IT-013・IT-014・IT-015・ST-001 |
| FR-004 | Must | IT-001・IT-002・IT-003・IT-004・IT-005・IT-006・IT-007・IT-008・IT-009・IT-010・IT-011・IT-012・IT-013・IT-014・IT-015・ST-001 |
| NFR-001 | ― | ST-002 |
| NFR-002 | ― | ST-003 |
| NFR-003 | ― | ST-004 |

「設計に無い」と印を付けたテストが 2 件あります。テストを書く前に設計を直してください。

