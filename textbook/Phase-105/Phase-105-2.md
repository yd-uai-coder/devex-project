# Phase-105-2: 外部連携の重複を除く

## この章の目的

外部連携は、合意の記録でサービス名をキーにしている(`integration:<サービス名>`。Phase 91)。再生成で LLM が合意済みの「X API」を「X」と書くと、保護は「X API」を落ちたとみなして戻し、言い換えた「X」は合意の無い新しい行として残る。外部設計書に同じ連携が2行並ぶ(Phase 99 の実 LLM で起きた)。この章で、画面の「同じ名前の新しい画面を除く」と同じ仕組みで、正規化したサービス名が合意済みの行と同じ新しい行を除く。

自動実装モード: on([introduction](./Phase-105-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 内容 |
| --- | --- |
| [`backend/app/agreements/items.py`](../samples/backend/app/agreements/items.py) | サービス名の正規形 `service_match_key` を足した |
| [`backend/app/agreements/protection.py`](../samples/backend/app/agreements/protection.py) | 外部連携の保護に重複の判定を渡した |
| [`backend/app/agreements/__init__.py`](../samples/backend/app/agreements/__init__.py) | `service_match_key` を re-export |
| [`backend/tests/unit/test_external_design_protection.py`](../samples/backend/tests/unit/test_external_design_protection.py) | 正規化と重複を除くテストを足した |
| [`backend/tests/unit/test_external_design_protection_flow.py`](../samples/backend/tests/unit/test_external_design_protection_flow.py) | 言い換えた再生成で1行に戻る流れのテストを足した |

## 1. サービス名の正規形 `service_match_key`

```python
# app/agreements/items.py(抜粋)
_NON_WORD = re.compile(r"[\W_]+")
_TRAILING_API = re.compile(r"api$")


def service_match_key(service: str) -> str:
    name = _NON_WORD.sub("", unicodedata.normalize("NFKC", service).lower())
    return _TRAILING_API.sub("", name) or name
```

- NFKC で全角・半角をそろえ、小文字にし、空白・記号を除き、末尾の「api」を除く。「Google Maps API」「google maps」「［E2E Fake］ 予約通知API」と「[E2E Fake] 予約通知」は、それぞれ同じになる。
- 「API」だけの名前は、除くと空になるので除かない(空のキーどうしが同じとみなされないように)。
- 判定は名前だけにした(相談の決定4)。同じ要件 ID で見ると、1つの要件に2つの連携(通知のメールと SMS など)があるときに取り違える。
- 合意のキーはサービス名のまま(`integration_key`)。正規形はキーにせず、重複の判定だけに使う。キーを変えると、既存の合意の記録が読めなくなるからである。

## 2. 保護に渡す `protection.py`

```python
# app/agreements/protection.py(抜粋)
integrations, restored_integrations, _ = _protect_rows(
    model.integrations,
    previous.integrations if previous else [],
    _agreed_rows(agreed, _INTEGRATION_PREFIX, IntegrationRow, exempt),
    "integration",
    key_of=lambda row: integration_key(row.service),
    duplicate_of=lambda row: service_match_key(row.service),
)
```

- `_protect_rows` の `duplicate_of` は、画面(名前)と要件(文)で使っている仕組み(Phase 92・93)。合意済みの行と同じ値を持つ、合意の無い行を除く。外部連携にも同じものを渡すだけで、手順は増やしていない(#17。画面と同じ事実を共有する)。
- 順は今までと同じ。合意と違う行を置き換え → 重複を除く → 落ちた合意の行を前の版の位置に戻す。言い換えた「X」は除かれ、「X API」が `dropped` として戻る。
- 除くのは合意済みの行の重複だけ。合意の無い行どうし(「地図」と「地図 API」が両方新しい)は触らない。どちらが正しいかは、まだ合意で決まっていないからである。
- CR で書き換えてよい要素(`exempt`)に入った連携は、合意の行に入らないので、重複も除かない(CR の変更を戻さない)。

## テスト観点

- `test_external_design_protection.py`(足した3件)
  - SUT: `service_match_key` と `protect_external_design` の外部連携。ドライバ: テスト関数。スタブ不要 ── 純粋関数で、外部依存を呼ばないため。言い換えた名前は 105-1 の `paraphrase_service` で作る。
  - 大文字小文字・空白・記号・全角・末尾の「API」を無視し、違うサービスは違う。「API」だけは空にしない。
  - 合意済みの「地図 API」を言い換えた「地図」は除かれ、合意の行が `dropped` で戻る。正規化して違う新しい連携(メール配信)は残る。
  - 合意の無い行どうしは除かない。
- `test_external_design_protection_flow.py`(足した1件)
  - SUT: `DocGeneratorService.generate` の外部設計書の生成(保護を通る)。ドライバ: テスト関数。スタブ: DB はインメモリ SQLite、文書の生成の LLM は FakeLLM(外部連携を持つ見本と、それを言い換えた見本を返す)。
  - 束で合意した後に言い換えた出力で作り直しても、外部連携は合意の名前の1行だけで、版の `protection` に `dropped` が残る。
