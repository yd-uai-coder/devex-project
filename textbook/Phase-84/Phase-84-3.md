# Phase-84-3: 説明書の API

## この章の目的

[84-2](./Phase-84-2.md) の5節を、CR ごとにプレビュー(JSON)とダウンロード(md)で返す API を作る。予測は影響の API([83-3](../Phase-83/Phase-83-3.md))と同じもの(判断の前は束から求め、判断の後は保存したもの)を使い、そのためにサービスの「束と予測を求める所」を説明書と共有する形にする。

自動実装モード: on([introduction](./Phase-84-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/change_requests/explanation.py`](../samples/backend/app/change_requests/explanation.py) | 更新 | `explanation_filename`(`cr-<番号>-explanation.md`) |
| [`app/change_requests/__init__.py`](../samples/backend/app/change_requests/__init__.py) | 更新 | `explanation_filename` の re-export |
| [`app/schemas/change_request.py`](../samples/backend/app/schemas/change_request.py) | 更新 | `ChangeRequestExplanationRead`(プレビューの応答) |
| [`app/services/change_request_service.py`](../samples/backend/app/services/change_request_service.py) | 更新 | `ExplanationView`・`explanation`・`_explanation`・`_impact_with_baseline`(`impact` から移した)・`facts_of` |
| [`app/api/routes/change_requests.py`](../samples/backend/app/api/routes/change_requests.py) | 更新 | `GET .../{number}/explanation`・`GET .../{number}/explanation/download`・`_explanation` |
| [`tests/unit/test_change_request_explanation.py`](../samples/backend/tests/unit/test_change_request_explanation.py) | 更新 | ファイル名 |
| [`tests/unit/test_change_request_service.py`](../samples/backend/tests/unit/test_change_request_service.py) | 更新 | 説明書が CR の直しと判断に従う・`facts_of` |
| [`tests/unit/test_change_requests_api.py`](../samples/backend/tests/unit/test_change_requests_api.py) | 更新 | プレビューとダウンロード・登録 |

依存の向き: ルート → サービス(`ExplanationView`)・スキーマ・`explanation_filename`。サービス → `build_explanation`・`ChangeRequestFacts`([84-2](./Phase-84-2.md))。

## 1. サービス

```python
# app/services/change_request_service.py(抜粋)
@dataclass(frozen=True)
class ExplanationView:
    change_request: ChangeRequest
    explanation: Explanation

async def impact(self, project, number) -> ImpactView          # _impact_with_baseline を呼ぶだけに
async def explanation(self, project, number) -> ExplanationView
async def _explanation(self, change_request) -> Explanation
    # 束(写し付き)と予測を _impact_with_baseline で得て、build_explanation に渡す
async def _impact_with_baseline(self, change_request) -> tuple[Baseline, ImpactView]
    # 83-3 の impact の中身(保存した予測があればそれ、無ければ束から求める)

def facts_of(change_request, baseline_number) -> ChangeRequestFacts   # 行 → 値(1か所)
```

- **影響と説明書で予測を共有**: `impact` の中身を `_impact_with_baseline` に移し、説明書も同じ所から予測と除外の一覧を得る。説明書の3節と影響の API が食い違わない。束は説明書の写し(要件定義書・テスト仕様書)にも要るので、一緒に返す。
- **説明済みの条件は置かない**(ユーザー決定): 説明書を出したかどうかで「説明済み」への遷移を止めない。口頭や別の資料で説明することもあるため。説明書は CR のどの状態でも何度でも出せる。

## 2. API

| メソッド | パス | 応答 |
|---|---|---|
| GET | `/projects/{id}/change-requests/{number}/explanation` | `ChangeRequestExplanationRead`(`label`・`filename`・`markdown`・`fingerprint`・`units`・`integration_tests`・`system_tests`・`has_test_spec`) |
| GET | `.../{number}/explanation/download` | md(`text/markdown`。ファイル名は `cr-<番号>-explanation.md`) |

- ファイル名は文書のダウンロード(`{doc_type}.md`)と同じく ASCII にした(`content_disposition` は日本語も扱えるが、CR の番号で一意に決まれば足りる)。
- [84-4](./Phase-84-4.md) で、応答に要約と「出力する md」(`output`)を足し、ダウンロードは確認済みの要約を載せる。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_change_request_explanation.py`(更新) | `explanation_filename` | pytest のテスト関数 | スタブ不要 ── 純粋 |
| `test_change_request_service.py`(更新) | `ChangeRequestService.explanation`・`facts_of` | pytest のテスト関数 | スタブ不要 ── LLM を呼ばず、組み立ての配線が検証対象のため、SQLite のセッションと `create_impact_project` の束を使う。`facts_of` は属性だけを持つ `SimpleNamespace` を行の代わりに渡す |
| `test_change_requests_api.py`(更新) | ルート `get_change_request_explanation`・`download_change_request_explanation` と登録 | pytest のテスト関数(関数を直接呼ぶ) | 同上 |

- 説明書: 題と2節の案 / 束にテスト仕様書が無いことが3節・5節に出る / CR を直すと fingerprint が変わる / 合意の後は状態の行だけが変わり、本文は保存した予測で同じ。
- ルート: プレビューのファイル名・fingerprint の長さ・作業単位 / ダウンロードの本文はプレビューの md と同じ・`Content-Disposition` / 無い CR は 404 / パスの登録。
