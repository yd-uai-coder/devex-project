# Phase-83-3: 予測の保存と API

## この章の目的

CR の影響の予測を API で返し、判断(合意・却下)の時点で CR に保存する。判断の前は、見るたびに基準の束から求める([83-2](./Phase-83-2.md) の純粋関数)。保存した予測は「合意したときに示した範囲」の記録で、後でたどり方の規則を直しても変わらない。Phase 85 で、反映の後の実際の印と比べる基準になる。

自動実装モード: on([introduction](./Phase-83-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/models/change_request.py`](../samples/backend/app/models/change_request.py) | 更新 | 列 `predicted_impact`(JSON。NULL 可) |
| [`alembic/versions/6c43be350866_add_change_request_predicted_impact.py`](../samples/backend/alembic/versions/6c43be350866_add_change_request_predicted_impact.py) | 新規 | 列を足す(既存の行は NULL) |
| [`app/schemas/change_request.py`](../samples/backend/app/schemas/change_request.py) | 更新 | `PredictedTargetRead`・`PredictedItemRead`・`ExcludedItemRead`・`ChangeRequestImpactRead` |
| [`app/services/change_request_service.py`](../samples/backend/app/services/change_request_service.py) | 更新 | `ExcludedItem`・`ImpactView`・`ChangeRequestService.impact`・判断で保存・`predict_for` |
| [`app/api/routes/change_requests.py`](../samples/backend/app/api/routes/change_requests.py) | 更新 | `GET /projects/{id}/change-requests/{number}/impact` |
| [`tests/unit/test_change_request_service.py`](../samples/backend/tests/unit/test_change_request_service.py) | 更新 | 求める・判断で保存・保存の後は読み直さない・取り下げは保存しない |
| [`tests/unit/test_change_requests_api.py`](../samples/backend/tests/unit/test_change_requests_api.py) | 更新 | 予測のルート(判断の前と後)・404・ルーターの登録 |
| [`tests/integration/test_change_requests_flow.py`](../samples/backend/tests/integration/test_change_requests_flow.py) | 更新 | 判断の後の予測が JSONB から同じ形で返る・入っていない段階 |

依存の向き: ルート → `ChangeRequestService.impact` → `predict_for`(サービスの中の関数)→ `predict_from_snapshots`([83-2](./Phase-83-2.md))。スキーマは `Prediction` を応答に詰める。

## 1. 保存の列と、いつ保存するか

```python
# app/models/change_request.py(抜粋)
predicted_impact: Mapped[dict | None] = mapped_column(PortableJSON, nullable=True)

# app/services/change_request_service.py(抜粋)
async def decide(self, project, number, payload, *, actor_id):
    ...
    baseline = await self._baseline_with_items(change_request)
    change_request.predicted_impact = predict_for(change_request, baseline).to_dict()
    ...   # 合意の記録・時系列と同じトランザクションで commit
```

- **判断の時点で保存**(ユーザー決定): 判断の前は CR を直せる(対象が変わる)ので、保存しても古くなる。判断の後は CR を直せないので、そのとき示した範囲が確定する。却下でも保存する(却下したときに何を示したかも記録になる。写した CR は新しい下書きなので、予測を写さない)。
- **取り下げは保存しない**(Claude の判断): 合意の記録が無いので、示した範囲を残す意味が薄い。求めれば、基準の束からいつでも同じ予測が出る。
- **マイグレーション** `6c43be350866`: 列を足すだけ。既存の行(判断済みの CR があっても)は NULL のままで、求めるたびに束から作る。

## 2. 取得

```python
# app/services/change_request_service.py(抜粋)
@dataclass(frozen=True)
class ImpactView:
    change_request: ChangeRequest
    prediction: Prediction
    saved: bool                        # 判断の時点で保存したものか
    excluded: list[ExcludedItem]       # 束に入っていない文書・段階(key・state)

async def impact(self, project, number) -> ImpactView
def predict_for(change_request, baseline) -> Prediction   # 束の入っている写しだけを渡す
```

- **保存があればそれを返す**: たどり方の規則を後で直しても、合意したときの範囲が変わらない(テストは、予測の関数を例外を投げるスタブに差し替えて、保存した予測を読み直さないことを確かめる)。
- **入っていない文書・段階**(`excluded`): 束の「入っていない」の行(未承認の段階・テスト仕様書が無い など)を、束を作ったときの状態と一緒に返す。その段階の要素は予測に出ないので、画面(Phase 87)で「段階6 は束に入っていない」と示せる。保存した予測でも、束から読む(束は凍結されているので同じ)。

## 3. API

```
GET /api/v1/projects/{id}/change-requests/{number}/impact
→ 200 {number, label, baseline_number, baseline_label, saved,
       targets: [{requirement_id, kind, kind_label, text}],
       items: [{key, kind, stage, label, path, reason, requirement_ids}],
       unpredicted_new_requirement, excluded: [{key, state}]}
   無い番号は 404
```

- **詳細と別の API にした**(Claude の判断): 予測は要素を組む計算を伴い、応答も大きい。CR の詳細(一覧から開くたびに読む)を軽く保ち、画面は要るときだけ読む。
- **プロジェクトの持ち主の確かめ**: 既存のルートと同じ `CurrentProjectDep`(他人のプロジェクトは 404)。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_change_request_service.py`(更新) | `ChangeRequestService.impact`・`decide`(保存)・`predict_for` | pytest のテスト関数 | 保存の後の1件だけ、予測の関数(`predict_from_snapshots`)を例外を投げるスタブに差し替える(monkeypatch) ── 保存した予測を読み直さないことを確かめるため。ほかはスタブ不要(インメモリの SQLite と `create_impact_project` の束) |
| `test_change_requests_api.py`(更新) | ルート `get_change_request_impact` と、ルーターへの登録 | pytest のテスト関数(ルートを直接呼ぶ)・FastAPI の openapi | スタブ不要 ── 同上 |
| `test_change_requests_flow.py`(integration・更新) | `GET .../{number}/impact`(ルート → サービス → JSONB の列) | httpx の AsyncClient | スタブ不要 ── 実際の PostgreSQL |

- サービス: 判断の前は保存なし(`saved` 偽・列は NULL)・対象の種類と、共有の画面に届いた2つの要件・新規の印 / テスト仕様書の無い束では `excluded` に `test_spec` / 合意で列に予測が入り、その後はスタブに差し替えても同じ予測が返る / 取り下げは保存しない・`predict_for` と同じ予測 / 無い番号は 404。
- ルート: 判断の前と後で同じ項目・後は `saved` が真 / 対象の文とラベル / 無い番号は 404 / `.../impact` のパスが登録されている。
- integration: 合意の後の予測が JSONB から同じ形で返る / 段階を承認していないプロジェクトでは、予測は画面・API だけで、段階は `excluded` に出る。
