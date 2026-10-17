# Phase-70-2: テスト仕様書の要件ごとのテストと落ちる型

## この章の目的

テスト仕様書の要件ごとのテストが「FR-00x の要件どおり〜が提供されること」と浅かった(Phase 59 の詳細の版で10件)。また、正解例のうち `{id}` の API の未認証・LLM の上限超過・回数上限の画面の表示・本文のトークンで本人を決める API が落ちていた。この章では、生成の指示で要件のテストを振る舞いに分けて書かせ、落ちる型を必要なテストの一覧に足し、浅いテストを決定的な検証で知らせる。

自動実装モード: on([introduction](./Phase-70-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/documents/test_spec/obligations.py`](../samples/backend/app/documents/test_spec/obligations.py) | 更新 | `{id}` の未認証・本文の `token`(`body_tokens`)・上限を書く非機能要件・外部サービスの上限を書く制約 |
| [`app/documents/test_spec/drafting.py`](../samples/backend/app/documents/test_spec/drafting.py) | 更新 | 要件ベースの行の書き方の規則 |
| [`app/documents/test_spec/validation.py`](../samples/backend/app/documents/test_spec/validation.py) | 更新 | `SHALLOW_REQUIREMENT_TEST`(軽微) |
| [`tests/unit/test_test_spec_obligations.py`](../samples/backend/tests/unit/test_test_spec_obligations.py) | 更新 | 足した4つの型 |
| [`tests/unit/test_test_spec_drafting.py`](../samples/backend/tests/unit/test_test_spec_drafting.py) | 更新 | 規則の文 |
| [`tests/unit/test_test_spec_validation.py`](../samples/backend/tests/unit/test_test_spec_validation.py) | 更新 | 浅いテストの指摘 |

## 1. 必要なテストの一覧に足す(`obligations.py`)

責務: 要件定義書・外部設計書の model から、作るべきテストを技法ごとに決める(純粋関数。Phase 56・59)。

| 観点 | 技法 | 元(この章で足したもの) |
|---|---|---|
| 異常 | 認証 | パスに `{…}` を持ち、エラー欄に 401 が無い API(設計のどこかの API に 401 があるとき) |
| セキュリティ | 認証 | 本文に `token`・`…_token` の項目を持つ API |
| 非機能 | ― | 上限・回数を書く非機能要件は、理由に「超えたときの応答と、画面での伝え方」 |
| 異常 | 外部サービス | 外部サービスの上限・無料枠・料金を書く制約(CON)ごとに総合テスト1件 |

```python
# app/documents/test_spec/obligations.py(要点)
uses_auth = any("401" in error_statuses(api.errors) for api in external.apis)
...
if uses_auth and "{" in api.path and "401" not in statuses:
    checks.append(("異常", "認証なしで呼ぶ(401)"))
for name in body_tokens(api.body):
    checks.append(("セキュリティ", f"本文の {name} をほかの利用者のもの・無効なものにする"))
```

- 非自明な判断: 未認証は `{id}` の API にだけ足す。ログイン・登録のようにログインの要らない API にまで足すと、誤った義務になる。`{id}` の API は利用者のリソースを指すので、ログインが要る。設計に 401 が1つも無い(ログインの無い)システムには足さない。
- 本文の `token` は Phase 59 の `_BODY_ID`(`…_id`)の続き。正解例の簡易(TS-5)は、本文の `token` で本人を決める API だった。
- LLM の上限超過(TD-17)は、要件定義書の制約(CON-004「Gemini の無料枠」)にしか書かれていなかった。今までの一覧は CON を見ていなかった。

## 2. 要件のテストを振る舞いに分けて書かせる(`drafting.py`)

```python
# app/documents/test_spec/drafting.py(SYSTEM_PROMPT の抜粋)
"- 対象が要件ID の総合テスト(理由が「要件の中身」)は、要件の文を確かめられる振る舞い"
"(何をする → 何が見える・残る・変わる)に分け、手順は具体的な入力・操作で、期待結果は画面の"
"表示・値・保存されるデータで書く。「要件どおり」「提供されること」「正しく動作すること」"
"とだけ書かない(ほかの行の書き方は上の規則のまま)\n"
```

- 非自明な判断: 「ほかの行の書き方は上の規則のまま」を一緒に書いた。Phase 59 で、異常系の1行を足したら正常系が消えた(指示を1行足すと、ほかが押し出される)ため。

## 3. 浅いテストを知らせる(`validation.py`)

```python
# app/documents/test_spec/validation.py
_SHALLOW_EXPECTED = re.compile(r"要件(どおり|通り)|提供される(こと)?|正しく(動作|機能)する")
...
shallow = [c.id for c in model.system if c.req_ids and _SHALLOW_EXPECTED.search(c.expected)]
```

- 今までの `MUST_REQUIREMENT_UNTESTED` は、要件 ID を持つテストが1件あれば通るので、浅いテストを見分けられなかった。軽微の警告にとどめる(生成も保存も止めない。Phase 51-2 の決定)。
- 画面は検証の指摘をコードではなく文言で出すので、devex-ui の変更は要らない。

## テスト観点

| テスト | SUT | ドライバ | スタブ | 観点 |
|---|---|---|---|---|
| `test_test_spec_obligations.py` | `required_tests`・`body_tokens` | pytest の関数 | スタブ不要 ── 要件定義書・外部設計書の model だけから決まる純粋関数のため | `{id}` の未認証(設計に 401 があるときだけ・401 がエラー欄にあれば重ねない・`{id}` の無い API には置かない)/ `token` の取り出しと義務 / 上限の非機能要件の理由 / 外部サービスの上限の制約(上限を書かない制約には置かない) |
| `test_test_spec_drafting.py` | `SYSTEM_PROMPT` | pytest の関数 | スタブ不要 ── 定数の中身 | 要件のテストの規則・ほかの行を変えない一文 |
| `test_test_spec_validation.py` | `validate_test_spec` | pytest の関数 | スタブ不要 ── model だけから決まる純粋関数のため | 言い直しの期待結果を指摘し、振る舞いを書いたもの・要件 ID の無い総合テストは指摘しない |

- 既存の `test_path_parameter_needs_security_test_and_no_body_skips_boundary` は、見本の外部設計書(一覧の API が 401 を返す)の削除の API に未認証が増えるので、期待を `["正常", "異常", "異常", "セキュリティ"]` に替えた。
- AI が振る舞いを書くか・足した義務がテストになるかは、[70-4](./Phase-70-4.md) の実際の生成で確かめた。
- この章で更新した3つの本体のファイルは、それぞれのテストが import している。テストが新しく import するのは `body_tokens`(この章)と既存の `RequirementRow` で、前方 import は無い。
