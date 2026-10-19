# Phase-85-4: 予測と実際の比較

## この章の目的

反映した CR について、判断の時点で保存した影響の予測([Phase 83](../Phase-83/Phase-83-introduction.md) の `predicted_impact`)と、反映で実際に付いた印の写し(85-2 の `applied_impact`)を要素ごとに突き合わせ、「一致 / 予測だけ / 実際だけ」を返す API を作る(着手時の相談のユーザー決定「両方を並べる」)。予測に無かった変更(見落とし・CR の範囲の外の書き換え)と、予測したが印の付かなかったものを、それぞれ見えるようにする。

自動実装モード: on([introduction](./Phase-85-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/change_requests/comparison.py`](../samples/backend/app/change_requests/comparison.py) | 新規 | `AppliedMark`・`ComparedItem`・`Comparison`・`applied_marks_from_json`・`compare` と表示名の表 |
| [`app/change_requests/__init__.py`](../samples/backend/app/change_requests/__init__.py) | 更新 | 上の re-export |
| [`app/services/errors.py`](../samples/backend/app/services/errors.py) | 更新 | `ChangeRequestNotAppliedError`(409 `CR_NOT_APPLIED`) |
| [`app/schemas/change_request.py`](../samples/backend/app/schemas/change_request.py) | 更新 | `ComparedItemRead`・`ChangeRequestComparisonRead.build` |
| [`app/services/change_request_service.py`](../samples/backend/app/services/change_request_service.py) | 更新 | `APPLIED_STATUSES`・`ComparisonView`・`comparison` |
| [`app/api/routes/change_requests.py`](../samples/backend/app/api/routes/change_requests.py) | 更新 | `GET .../change-requests/{number}/comparison` |
| [`tests/unit/test_change_request_comparison.py`](../samples/backend/tests/unit/test_change_request_comparison.py) | 新規 | 分類(純粋)・壊れた写しの読み・反映の後の API |
| [`tests/unit/test_change_requests_api.py`](../samples/backend/tests/unit/test_change_requests_api.py) | 更新 | ルーターに比較のパス |
| [`tests/integration/test_change_requests_flow.py`](../samples/backend/tests/integration/test_change_requests_flow.py) | 更新 | 実際の PostgreSQL で、合意 → 文書の反映 → 版の CR → 比較 → CASCADE |

依存の向き: `comparison.py` → `prediction.Prediction`(83-2)・`app.detailed_design.impact.DOCUMENT_STAGE`(既存)。サービス → `comparison`・`DesignStageRepository`(印を付ける段階を読む)。

## 1. 分類

```python
# app/change_requests/comparison.py(抜粋)
ComparisonStatus = Literal["matched", "predicted_only", "actual_only"]
PredictedOnlyReason = Literal["document_side", "unmarked_stage", "not_changed"]

def compare(prediction: Prediction, applied: Sequence[AppliedMark],
            marked_stages: Collection[int]) -> Comparison
    # 予測の要素ごとに印の写しをキーで引く。あれば matched、無ければ predicted_only(理由つき)。
    # 残った印は actual_only。置き場とキーの順。
```

| 分類 | 意味 | 理由 |
|---|---|---|
| 一致 | 予測にも印にもある | ── |
| 予測だけ | 予測にあるが印が無い | `document_side`: 画面・API(置き場0)。印が付かない(ベースラインの4件の差。[80-2](../Phase-80/Phase-80-2.md))/ `unmarked_stage`: 一度も承認していない段階。印は承認した段階にだけ付く / `not_changed`: 印を付けられる段階なのに差分が届かなかった |
| 実際だけ | 予測に無いのに印が付いた | 見落とし、または CR の範囲の外の書き換え |

- **予測だけを3つに分ける**(Claude の判断): 「予測が外れた」のは `not_changed` だけで、ほかの2つは印の仕組みの側で付かない。分けないと、文書の側の要素が毎回「外れ」に見える。文書の側の確認の扱いは Phase 86 で決める(申し送り)。
- **印を付ける段階は今の状態で読む**: 一度でも承認した段階(`approved_version` がある)。反映の時点の値ではないが、反映の後に初めて承認した段階は「承認していない段階」でなくなるだけで、写しの印は変わらない。
- **`reviewed` は写しの時点の値**: 写しは反映のときに作るので、ふつうは未確認。人が印を確かめた状態を比較に出すかは、検証(Phase 86)で決める。
- **写しの読みは壊れた項目を捨てる**(`applied_marks_from_json`): JSON の列なので、形の正しくない項目で比較の API を落とさない(印の `StageImpact.from_dict` と同じ考え方)。

## 2. API

```python
# app/services/change_request_service.py(抜粋)
APPLIED_STATUSES = frozenset({"applied", "verified"})

async def comparison(project, number) -> ComparisonView
    # 反映の前は ChangeRequestNotAppliedError(409)。予測は _impact_with_baseline(保存したもの)
```

- 応答 `ChangeRequestComparisonRead`: `number`・`label`・`status`・`saved`(予測が保存したものか)・`counts`(分類ごとの件数)・`items`(`key`・`label`・`stage`・`status`・`status_label`・`predicted_only_reason`・`predicted_only_reason_label`・予測と実際の理由・届いた対象の要件・`reviewed`)。
- **反映の前は 409**: 比べる実際の印が無い。画面(Phase 87)では反映済みの CR だけに出す。
- 予測は影響の API・説明書と同じ所(`_impact_with_baseline`。84-3)から得る。反映した CR は合意で予測を保存しているので、いつも `saved: true`。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_change_request_comparison.py`(新規) | `compare`・`applied_marks_from_json`・`Comparison.count`、`ChangeRequestService.comparison`、`ChangeRequestComparisonRead`、`ChangeRequestNotAppliedError`、ルート `get_change_request_comparison` | pytest のテスト関数 | 純粋関数はスタブ不要 ── 対象が純粋(副作用なし)で外部依存を呼ばないため。サービスとルートは SQLite と `create_impact_project`、文書の反映は FakeLLM |
| `test_change_requests_api.py`(更新) | ルーターの登録 | pytest のテスト関数 | スタブ不要 ── OpenAPI のパスを読むだけ |
| `test_change_requests_flow.py`(integration、更新) | `POST /generate`(`cr_number`)・`GET .../comparison`・CASCADE | httpx の AsyncClient | 文書の生成の LLM だけ、解決を FakeLLM に差し替える(`stub_llm_resolver`) |

- 分類: 文書の側 / 一致(予測と実際の理由・確認の状態)/ 届かなかった / 実際だけ / 承認していない段階、件数の数え方。
- 読み: キーの無い項目・数でない置き場は捨てる / None は空。
- API: 反映の前は 409 / 反映の後は `fn:F-01` が一致、画面・API は「文書の側」。
- integration: 下書きの CR を渡すと 409 `CR_NOT_REFLECTABLE`、反映の前の比較は 409 `CR_NOT_APPLIED` / 合意の後の生成で反映済み・時系列の `refs` / 版2つに CR が結ばれる(JSONB と FK)/ 段階を承認していないので全部「予測だけ」/ プロジェクトの削除で CR と時系列が消える。
