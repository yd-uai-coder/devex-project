# Phase-93-4: CR の反映での合意の更新

## この章の目的

CR を反映したら、CR で書き換えてよい要素(対象の要件と、保存した予測の画面・API)の合意を、作り直した中身で更新する。合意の出どころはその CR にする。Phase 92 では合意が CR で更新されなかったので、CR で変えた行は、次の CR を渡さない再生成で古い合意の形に戻っていた([Phase 92](../Phase-92/Phase-92-introduction.md) の申し送り)。この章でその穴を閉じる。

自動実装モード: on([introduction](./Phase-93-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/agreements/items.py`](../samples/backend/app/agreements/items.py) | 更新 | `change_request_items`・`kind_of` |
| [`app/agreements/__init__.py`](../samples/backend/app/agreements/__init__.py) | 更新 | 上の2つの re-export |
| [`app/services/agreement_service.py`](../samples/backend/app/services/agreement_service.py) | 更新 | `record_change_request` |
| [`app/services/doc_generator_service.py`](../samples/backend/app/services/doc_generator_service.py) | 更新 | `generate` が反映の記録の直後に合意を更新する |
| [`tests/unit/test_change_request_agreement.py`](../samples/backend/tests/unit/test_change_request_agreement.py) | 新規 | CR の文が再生成で残る・予測の要素・外れた・作り直さなかった文書・やり直し・簡易モード |

## 1. 更新する要素(純粋関数)

```python
# app/agreements/items.py(抜粋)
def kind_of(key: str) -> AgreedKind | None
def change_request_items(rewritable: Collection[str], items: Sequence[AgreedItem],
                         agreed_keys: Iterable[str], kinds: Collection[AgreedKind]
                         ) -> tuple[list[AgreedItem], list[str]]
```

- 書き換えてよい要素(`rewritable_keys`。93-3)のうち、作り直した文書にあるものは、今の中身で合意にする(文書の並び順)。
- 今の合意にあって無くなったもの(削除の対象・CR で消えた予測の画面など)は「外れた」とする。数えるのは作り直した文書の種類の要素だけ(`kind_of` でキーから種類を読む)。作り直さなかった文書の要素を、無いからといって外さないためである。
- **CR で足された新しい要素**(新しい要件・予測に無い新しい画面)は合意にしない(Claude の判断)。仕様 2.15節の更新の範囲は「対象の行と、予測が届いた画面・API」で、新しい行は次の合意済みの版(束)で合意になる。
- 予測の画面・API が CR で変わらなかったときも、出どころは CR になる(その CR で見直して合意した、という記録)。

## 2. 記録の時点と経路

```python
# app/services/agreement_service.py(抜粋)
async def record_change_request(self, project, change_request,
                                models: Mapping[str, Mapping[str, Any] | None], *,
                                recorded_by) -> list[AgreementRecord]
```

- **反映済みの時点**(ユーザー決定): `DocGeneratorService.generate` の `record_document_apply`(CR を反映済みにする)の直後で、同じトランザクションの中で記録する。反映の後・検証の前に CR を渡さない再生成をしても、CR の変更は戻されない。検証済みの時点で記録すると、その間は Phase 92 の穴が残る。
- `models` は作り直した文書の新しい model(`new_models`)。保護(93-3・92-3)を通した後の model なので、予測に無い要素は合意と同じ中身で、`rewritable` にも入らない。
- 記録は追記型(Phase 91)。出どころ `change_request`・`change_request_id` を付ける(Phase 91 で表に列だけを用意していた)。やり直しの反映(反映済みのまま)は、そのときの中身でまた足す。
- 簡易ドキュメントモードは記録しない(合意は詳細設計モードの機能。`record_adopt` と同じ)。
- 段階の生成(CR を渡した段階の作り直し)は合意の対象の要素を作らないので、記録しない。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_change_request_agreement.py`(新規・純粋関数) | `change_request_items`・`kind_of` | pytest のテスト関数 | スタブ不要 ── 純粋関数(副作用なし)のため |
| `test_change_request_agreement.py`(新規・流れ) | `AgreementService.record_change_request` と `DocGeneratorService.generate` からの呼び出し | pytest のテスト関数 | DB はインメモリ SQLite(`db_session`)。CR-1 の反映は fixture の `reflect_change_request`(FakeLLM。FR-001 を CR の文にした要件定義書と、外部設計書の見本) |

- 統合スモーク: CR-1 を反映 → FR-001・SCR-001・POST の合意の出どころが CR-1 になり、FR-001 の文は CR の文。GET と FR-002 は束のまま。その後の CR を渡さない再生成で、LLM が FR-001 を書き換えても CR の文に戻る(Phase 92 の穴が閉じた)。
- 純粋関数: 作り直した文書にある要素は合意にし、無くなったものは外れたとする。CR で足された新しい要素は触らない。作り直さなかった文書の要素は外さない。
- やり直しの反映は記録を足す(束 → CR → CR)。
- 簡易ドキュメントモードは記録しない。
- 既存の `test_agreement_recording.py`(束・採用にするの記録)・`test_change_request_reflection.py`(反映の記録)が番人。
