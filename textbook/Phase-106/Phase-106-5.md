# Phase-106-5: 起点の種類と、束に入れた CR

## この章の目的

新しい要件を足す CR は、人が選んだ起点(既存の要件・画面・API)から影響を予測する(Phase 96)。画面にも API にも出ない処理(バッチ・内部の処理)に新しい要件が載る場合は、起点を選べなかった。この章で起点に段階1 の処理を足す(着手時の相談 4)。あわせて、束の応答に「入れた CR」を持たせる。今は画面が CR の一覧の `included_baseline_number` から引いている(Phase 88)が、束の画面だけで分かるようにする(相談 7。画面の切り替えは Phase 109)。

自動実装モード: on([introduction](./Phase-106-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 内容 |
| --- | --- |
| [`backend/app/change_requests/prediction.py`](../samples/backend/app/change_requests/prediction.py) | `ORIGIN_KINDS` に `function` を足した |
| [`backend/app/models/change_request.py`](../samples/backend/app/models/change_request.py) | `origins` の説明に処理を足した(docstring) |
| [`backend/app/schemas/change_request.py`](../samples/backend/app/schemas/change_request.py) | `origins` の説明に処理を足した(docstring) |
| [`backend/app/repositories/change_request.py`](../samples/backend/app/repositories/change_request.py) | 束ごとに入れた CR を引く `included_by_baselines` |
| [`backend/app/schemas/baseline.py`](../samples/backend/app/schemas/baseline.py) | `BaselineChangeRequestRead`・`included_change_requests`・`with_included` |
| [`backend/app/services/baseline_service.py`](../samples/backend/app/services/baseline_service.py) | `included_change_requests`。起点の候補の説明 |
| [`backend/app/services/change_request_service.py`](../samples/backend/app/services/change_request_service.py) | 起点の確かめの説明と知らないキーの文 |
| [`backend/app/api/routes/baselines.py`](../samples/backend/app/api/routes/baselines.py) | 束の作成・一覧・中身の応答に入れた CR を添える |
| [`backend/tests/unit/test_change_request_prediction.py`](../samples/backend/tests/unit/test_change_request_prediction.py) | 処理の候補と、処理を起点にした予測のテスト |
| [`backend/tests/unit/test_change_request_origins.py`](../samples/backend/tests/unit/test_change_request_origins.py) | 処理を起点に保存し説明書に名前が出るテスト。選べない種類の例を直した |
| [`backend/tests/unit/test_change_request_trace.py`](../samples/backend/tests/unit/test_change_request_trace.py) | 束の応答の入れた CR のテストを足した |

## 1. 起点に段階1 の処理

```python
# app/change_requests/prediction.py(抜粋)
ORIGIN_KINDS: tuple[ElementKind, ...] = ("requirement", "screen", "api", "function")
```

- 候補は束の写しから組んだ要素のうち、この種類のもの(`origin_candidates`)。処理(`fn:F-01`)は束に段階1 が入っているときだけ出る。並びは文書の要素 → 機能一覧。
- `predict` は、要件でない起点そのものを「新しい要件の起点」として項目に入れ、`impact_of` でその先へたどる(画面・API と同じ手順。コードは増えていない)。処理の項目は段階1 なので、反映で書き換えてよい要素(`rewritable_keys`。段階0 だけ)には入らない。
- 説明書は表示名から名前を先にした形(`display_name`。「予約を登録する(F-01)」)で出し、反映の指示も表示名を並べるので、変えていない。
- テーブル・モジュールまで広げる案は取らなかった(相談の決定)。新しい要件は「何をするか」から決まり、処理より細かい要素を起点にする場面がまだ無い(#17)。

## 2. 束に入れた CR

```python
# app/repositories/change_request.py(抜粋)
async def included_by_baselines(self, baseline_ids) -> dict[uuid.UUID, list[tuple[int, str]]]:
    # 番号・題だけを select(時系列は読まない)

# app/api/routes/baselines.py(一覧の抜粋)
included = await service.included_change_requests(baselines)
return [BaselineSummaryRead.model_validate(b).with_included(included.get(b.id, [])) for b in baselines]
```

- 束の行には CR への関係が無い(結び付きは CR の `included_baseline_id`)。束の一覧は写しの中身を読まない軽い形にしてある(Phase 88)ので、CR も番号と題だけを1回の問い合わせで引く。
- 応答の形は、ORM の行から作った後に `with_included` で足す。`from_attributes` で読めない値をスキーマに持たせるため、既定値は空にした(入れた CR の無い束は空の一覧)。
- マイグレーションは無い。

## テスト観点

- `test_change_request_prediction.py`(1件を名前ごと直し、1件足した)
  - SUT: `origin_candidates`・`predict_from_snapshots`・`rewritable_keys`。ドライバ: テスト関数。スタブ不要 ── 純粋関数で、外部依存を呼ばないため。
  - 候補に処理が入り、文書の要素の後ろに並ぶ。処理を起点にすると、処理が起点の理由で段階1 の項目になり、その先の段階の項目は処理から届いたことを持つ。反映で書き換えてよい要素は空。
- `test_change_request_origins.py`(足した1件、直した2か所)
  - SUT: `BaselineService.origins`・`ChangeRequestService.create`・`impact`・`explanation`。ドライバ: テスト関数(ルートも直接呼ぶ)。スタブ: DB はインメモリ SQLite、要件・段階1〜8 を承認済みにした fixture。
  - 処理を起点に保存でき、予測に処理が入り、説明書に「名前(F-01)」で出る。束の候補の種類に `function` が入る。選べない種類の例は処理概要(`summary:F-01`)にした。
- `test_change_request_trace.py`(足した確かめ)
  - SUT: ルート `create_baseline`・`list_baselines`・`get_baseline` の入れた CR(`included_by_baselines`・`with_included`)。ドライバ: テスト関数。スタブ: DB はインメモリ SQLite と、反映・確認まで済ませた fixture。
  - CR-1 を入れた B-2 の作成・一覧・中身は CR-1(番号と題)を持ち、入れていない B-1 は空。
