# Phase-59-5: テスト仕様書の必要なテストの穴をふさぐ

## この章の目的

テスト仕様書は、コードが「必要なテストの一覧」を決め、LLM が埋める(Phase 56)。正解例と比べると、API ごとの正常・異常・境界と `{id}` の他人のリソースはそろう。一方で、要件の中身と画面の操作が落ちた(簡易 12/17・詳細 28/38。[58-4](../Phase-58/Phase-58-4.md))。一覧が API の形(パス・エラー欄)だけを見ているためである。着手時の相談で、**次の4つをすべて一覧に足す**と決めた: Must の要件ごとの中身 / 失敗の要件に「保存されない・やり直せる」/ Must の画面ごとの操作 / 本文の `*_id`。

自動実装モード: on([introduction](./Phase-59-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/documents/test_spec/obligations.py`](../samples/backend/app/documents/test_spec/obligations.py) | 更新 | `body_ids`・`_requirement_obligation`・画面の操作・docstring の表 |
| [`tests/unit/test_test_spec_obligations.py`](../samples/backend/tests/unit/test_test_spec_obligations.py) | 更新 | 各規則の判定 |

## 1. 必要なテストの一覧(`app/documents/test_spec/obligations.py`)

責務: 要件定義書・外部設計書の model から、作るべきテストを技法ごとに決める純粋関数(Phase 56)。

| 観点 | 技法 | 元 | |
|---|---|---|---|
| 正常 | 同値分割 | API ごとに1件 | |
| 異常 | エラーの一覧の網羅 | エラー欄の HTTP ステータスごと | |
| 境界 | 境界値分析 | 本文を持つ API | |
| セキュリティ | 認可 | パスに `{…}` **か本文に `…_id` の項目**を持つ API | 59-5 で拡張 |
| 非機能 | ― | 非機能要件ごと | |
| 正常 | 状態遷移 | Must の画面を通す流れ1件 | |
| 異常 | 画面の操作 | **Must の画面ごとに1件**(入力の検証・空の送信・エラーの表示) | 59-5 で追加 |
| 正常 | 要件ベース | **Must の機能要件ごとに1件**(API に結ばれていても) | 59-5 で拡張 |
| 異常 | 要件ベース | 上のうち、**文が失敗・中断を書く要件**(失敗の後に保存されない・やり直せるか) | 59-5 で追加 |

```python
# app/documents/test_spec/obligations.py
_BODY_ID = re.compile(r"(?<![A-Za-z0-9_])([a-z][A-Za-z0-9]*(?:_id|Id))(?![A-Za-z0-9_])")
_FAILURE = re.compile(r"失敗|エラー|中断|タイムアウト|やり直|再試行|リトライ")

def body_ids(body: str) -> list[str]: ...

def _requirement_obligation(req_id: str, text: str, external: ExternalDesignModel) -> Obligation:
    screens = tuple(s.id for s in external.screens if req_id in s.req_ids)
    linked = screens or any(req_id in a.req_ids for a in external.apis)
    reason = f"要件の中身: {text}" if linked else f"API・画面に無い Must の要件: {text}"
    if _FAILURE.search(text):
        reason = f"{reason}。失敗の後の状態(保存されない・やり直せる)を確かめる"
        return Obligation("system", req_id, "異常", reason, (req_id,), screens)
    return Obligation("system", req_id, "正常", reason, (req_id,), screens)
```

- 非自明な判断: **Must の要件ごとの行は、API に結ばれていても置く**。Phase 56 は「API にも画面にも結ばれていない Must の要件」だけに総合テストを置いた。結ばれていれば、その API のテストで確かめられると見たためである。しかし、コピー・ダウンロード(FR-007)のように、API(文書の取得)に結ばれていても、API の応答だけでは要件の中身を確かめられないものがあった(Phase 56 の申し送りで予想した見落とし)。今の「結ばれていない」行は、この行にまとめた(理由の文で区別する)。
- 失敗の要件は文の言葉で見分ける(定数の正規表現)。失敗のテストは「500 が返る」だけになりやすく、要件が求める「保存されない・やり直せる」を確かめなかった(簡易 TS-10・詳細 TD-16)。
- 画面の操作の行に、画面の仕様(`ui_spec`)は添えない。最初は60文字だけ添えたが、テスト仕様書の生成は入力を小さく保つため画面の仕様を渡さない決まりがあり(Phase 56)、既存のテストがそれを確かめていた。一覧の理由は決まった文にした。
- 本文の ID は `_id` と `Id`(camelCase)で終わる項目の名前を拾う。`id_token` のように `id` で始まる名前は拾わない。本文で `session_id` を受けるチャットの送信は、パスに `{id}` が無いので、Phase 56 の一覧では他人のセッションのテストが入らなかった([58-4](../Phase-58/Phase-58-4.md))。
- 生成の指示(`drafting.py`)と検証(`validation.py`)は変えていない。指示は「必要なテストの各行に少なくとも1件」のままで足り、検証は一覧と照らさない(Phase 56 の決まり)。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_system_tests_cover_must_screens_nfr_and_every_must_requirement`(更新。旧 `…_unlinked_must`) | `required_tests` | pytest | スタブ不要 ── 純粋関数。総合の行が、流れ・画面の操作・非機能・Must の要件ごと(API に結ばれた FR-001 も)の順に並び、理由の文が正しい。Should は入らない |
| `test_failure_requirement_checks_state_after_failure`(新規) | `required_tests` | pytest | スタブ不要。失敗を書く要件が異常の観点になり、理由に「失敗の後の状態」が付く |
| `test_body_ids_need_security_tests`(新規) | `body_ids`・`required_tests` | pytest | スタブ不要。`session_id`・`projectId` を拾い、`id_token` は拾わない。本文に `session_id` のある API にセキュリティの行が付く |

- 効果(LLM が行を埋めて、正解例の当たりが増えるか)は [59-6](./Phase-59-6.md) で確かめた(簡易 12 → 13/17、詳細 28 → 33/38)。
- 更新した本体のファイルは、このテストが import している(#15)。テストが足した import(`body_ids`)はこの章で作ったもので、前方 import は無い。
