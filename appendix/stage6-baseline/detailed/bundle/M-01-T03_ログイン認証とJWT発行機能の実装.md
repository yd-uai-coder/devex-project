# M-01-T03 ログイン認証とJWT発行機能の実装

> 種別: 機能 / マイルストーン: M-01 環境構築と認証基盤の実装 / 依存: M-01-T02

## 目的

利用者がメールアドレスとパスワードでログインし、JWTアクセストークンを取得できるようにする。

## 対象の処理・参照する設計

- 段階5 F-02 ログイン認証
- 段階6 login(`app/api/auth.py`)(設計に無い ── 未定義を参照)
- 段階6 L-02 authenticate_user(`app/services/auth.py`)
- 段階6 find_by_email(`app/repositories/user.py`)(設計に無い ── 未定義を参照)
- 段階6 update_last_login(`app/repositories/user.py`)(設計に無い ── 未定義を参照)
- 段階6 L-03 create_access_token(`app/services/auth.py`)
- 段階4 `app/api/auth.py`
- 段階4 `app/services/auth.py`
- 段階4 `app/repositories/user.py`

### シーケンス図(段階5 F-02 ログイン認証 の手順から導出)

```mermaid
sequenceDiagram
  participant P1 as 利用者
  participant P2 as app/api/auth.py
  participant P3 as app/services/auth.py
  participant P4 as app/repositories/user.py
  P1->>P2: 1: login(ログイン認証情報)
  Note over P1,P2: 1a リクエストのバリデーションエラー → ValidationError → 400
  P2->>P3: 2: authenticate_user(ログイン認証情報)
  P3->>P4: 3: find_by_email(メールアドレス)
  Note over P3,P4: 3a 該当するユーザーが存在しない場合 → NotFoundError → 401
  Note over P3,P4: 3b パスワードが一致しない場合 → AuthenticationError → 401
  P4-->>P3: (3 の戻り) ユーザー情報
  P3->>P4: 4: update_last_login(ユーザーID)
  P4-->>P3: (4 の戻り) 更新成功
  P3->>P3: 5: create_access_token(ユーザー情報)
  P3-->>P2: (2 の戻り) 認証結果
  P2-->>P1: 6: JWT
```

## 作成・変更するファイル(依存順)

| ファイル | 種類 | 責務 | 根拠 |
|---|---|---|---|
| `app/repositories/user.py` | モジュール | usersテーブルに対するユーザー検索および最終ログイン日時更新を行う | 段階4 |
| `app/services/auth.py` | モジュール | 認証のビジネスロジック、パスワード検証、トランザクション制御、およびJWTの生成を行う | 段階4 |
| `app/api/auth.py` | モジュール | ログインAPIのエンドポイントとしてリクエストを受け取り、バリデーションとJWT返却を行う | 段階4 |

## 実装の要点(設計に書いていないことだけ)

- app/repositories/user.py、app/services/auth.py、app/api/auth.pyの順に実装する
- 手順3から5までを単一のトランザクションとしてサービス層で処理する

## テスト観点

| # | 観点 | SUT | ドライバ | スタブ |
|---|---|---|---|---|
| TC-01 | 正常系: 有効な認証情報でログインしJWTが発行されること | app/api/auth.pyのlogin関数 | 結合テスト(pytest) | スタブ不要 ── 実際のデータベースおよびサービス層を使用する |
| TC-02 | 異常系: 存在しないメールアドレスの場合に401が返ること | app/api/auth.pyのlogin関数 | 結合テスト(pytest) | スタブ不要 ── 実際のデータベースを使用する |
| TC-03 | 異常系: パスワードが一致しない場合に401が返ること | app/api/auth.pyのlogin関数 | 結合テスト(pytest) | スタブ不要 ── 実際のデータベースを使用する |

- Given: 登録済みのユーザーが存在する / When: 正しいメールアドレスとパスワードでログインAPIを呼び出す / Then: 200 OKとJWTアクセストークンが返却される

## 確認方法

- pytestを実行し、ログイン機能のテストがすべて成功することを確認する

## 未定義・要決定

| 重要度 | 出どころ | 対象 | 内容 | 直す段階 |
|---|---|---|---|---|
| 最重要 | AI | 07章 認証 | JWTの有効期限が『(要決定)』となっており具体的な時間が決まっていない。 | 段階7 |
| 最重要 | AI | 段階6 authenticate_user | パスワードのハッシュ化アルゴリズムや検証ライブラリについての指定が設計にない。 | 段階6 |
| 最重要 | AI | 段階6 create_access_token | JWTの署名に使用する秘密鍵の取得元やアルゴリズムの指定が設計にない。 | 段階6 |
