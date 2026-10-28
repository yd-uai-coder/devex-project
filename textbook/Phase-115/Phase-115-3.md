# Phase-115-3: 古い束の知らせと、規模の「古い」の状態

## この章の目的

CR の基準の束が古い(束の後にほかの CR を文書へ反映した・束を作った時点で段階が古かった)ことを、CR の詳細・説明書・共有リンクの作成で開発者に知らせ(止めない)、規模の数を「数えた」「古い版から数えた」「数えられない」に分けて返す。説明書(クライアントに見せる md)の規模の節には、どの束の設計から数えたかを書き、合意の前に束の後の CR があれば注記する。ステージ13 の振り返り 18.3・18.4 の入力「古い束を基準にした説明」への答え。

自動実装モード: on([introduction](./Phase-115-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/change_requests/freshness.py`](../samples/backend/app/change_requests/freshness.py) | 更新 | `Freshness.excluding` |
| [`app/change_requests/scale.py`](../samples/backend/app/change_requests/scale.py) | 更新 | 注記 `baseline_changed`・`ScaleCount.state`・`with_baseline_changes` |
| [`app/change_requests/states.py`](../samples/backend/app/change_requests/states.py) | 更新 | `UNDECIDED_STATUSES` |
| [`app/change_requests/explanation.py`](../samples/backend/app/change_requests/explanation.py) | 更新 | 規模の節の基準の束の行と注記(`changed_after`) |
| [`app/change_requests/__init__.py`](../samples/backend/app/change_requests/__init__.py) | 更新 | re-export |
| [`app/services/baseline_service.py`](../samples/backend/app/services/baseline_service.py) | 更新 | `freshness_in`(プロジェクトの id で) |
| [`app/schemas/change_request.py`](../samples/backend/app/schemas/change_request.py) | 更新 | `baseline_freshness`・`ScaleCountRead.state` |
| [`app/schemas/share_link.py`](../samples/backend/app/schemas/share_link.py) | 更新 | `ShareLinkCreatedRead.baseline_freshness` |
| [`app/services/change_request_service.py`](../samples/backend/app/services/change_request_service.py) | 更新 | 詳細・説明書の基準の束の鮮度 |
| [`app/services/share_link_service.py`](../samples/backend/app/services/share_link_service.py) | 更新 | 作成の応答の鮮度 |
| [`app/api/routes/change_requests.py`](../samples/backend/app/api/routes/change_requests.py) | 更新 | 説明書の応答に鮮度 |
| [`tests/unit/test_change_request_staleness.py`](../samples/backend/tests/unit/test_change_request_staleness.py) | 新規 | 純粋の部分とサービス・ルート |
| [`tests/integration/test_material_change_requests_flow.py`](../samples/backend/tests/integration/test_material_change_requests_flow.py) | 更新 | CR の詳細・説明書の JSON の鮮度と状態 |

## 1. 鮮度から CR 自身を除く

```python
# app/change_requests/freshness.py(抜粋)
def excluding(self, number: int) -> "Freshness":
    """束の後に反映した CR から、番号の CR を除いた鮮度。"""
```

- 反映した CR の基準の束は、その CR 自身の反映で「束の後に反映した CR がある」になる。それを「古い」と知らせても意味が無いので除く(Claude の判断)。
- 鮮度の判定そのものは Phase 113 のまま(`BaselineService.freshness_in` はプロジェクトを id で渡す入口)。

## 2. 規模の状態(着手時の決定7)

```python
# app/change_requests/scale.py(抜粋)
ScaleNoteKind = Literal["stage_outdated", "baseline_changed", "planned_modules_only"]
ScaleState = Literal["counted", "stale", "uncountable"]
STALE_NOTE_KINDS = frozenset({"stage_outdated", "baseline_changed"})

ScaleCount.state -> ScaleState          # 数えられない > 古い > 数えた
def with_baseline_changes(scale, baseline_number, change_request_numbers) -> Scale
```

| 状態 | いつ | 読み手への意味 |
|---|---|---|
| `uncountable` | 数えられない理由がある(段階・文書が無い・起点が無い 等) | 数は出ない。開発者に別に確かめる |
| `stale` | 古い段階から数えた(`stage_outdated`。Phase 101)・束の後にほかの CR を反映した(`baseline_changed`) | 数は出るが、少ない・今の設計と違うことがある |
| `counted` | どちらでもない | そのまま |

- 18.4 の示唆「数えられない」と「古くて少ない」を別の結果にする、への答え。今までの `count`・`notes`・`uncountable` はそのまま残し、`state` を足した(画面は Phase 116)。
- 注記は数えた種類にだけ足す(数えられない種類には足さない。`ScaleCount` の今の規則と同じ)。詳細は「B-1 の後に CR-2・CR-3」。

## 3. 説明書の規模の節(着手時の決定6)

```
## 3. 変更の規模

この節は、変更で手を入れる量の目安です。…
合意済みの版 B-1 の設計から数えました。

| 種類 | 数 | 内訳 |
…
- 作業単位・ファイル・…: 合意済みの版の後に別の変更を反映したため、今の設計と違うことがある(B-1 の後に CR-1)
```

- 「B-n の設計から数えました」は**常に**書く(案ごとの規模の節も)。束の後の CR の注記は**合意の前**(`UNDECIDED_STATUSES` = 下書き・説明済み)だけ。判断の後の説明書は判断の時点の予測から組むので、後から注記を足さない(Claude の判断)。
- `build_explanation` は純粋のまま、束の後の CR の番号(`changed_after`)を受ける。番号を求めるのはサービス(`ChangeRequestService._explanation`)。
- **md が変わることの影響**: 既存の CR の説明書も1行変わる。共有リンクでは「3. 変更の規模」が変わった節として出て、確認済みの要約は「確かめ直す」になる(要約の fingerprint は md 全体)。開発環境の題材の CR も同じ。本番では、ステージ15 の反映の後に、説明済みの CR があれば要約を確かめ直す(申し送り)。

## 4. 知らせ(着手時の決定5)

| 応答 | 足した値 |
|---|---|
| CR の詳細(`GET .../change-requests/{n}`・作成・資料からの作成・編集など、`ChangeRequestRead` を返すすべて) | `baseline_freshness` |
| 説明書(`GET .../explanation`) | `baseline_freshness`、`scale[].state`・`option_scales[].scale[].state` |
| 共有リンクの作成(`POST .../share-links`) | `baseline_freshness` |

- 形は Phase 113 の `BaselineFreshnessRead`(`label`・`fresh`・`is_latest`・`tracked`・`newer_numbers`・`applied_after`・`outdated_stages`)。止めない(作成・共有はできる)。共有リンクの作成は `summary_needs_reconfirm`(Phase 101)と同じく、応答の値で知らせる。
- 取り込み(違いの取り出し)の知らせは Phase 114 の `extraction.freshness`。3つの入口(取り込み・CR の作成・共有リンクの作成)が同じ判定を使う(111-1 の決定5)。
- クライアントの画面(公開の入口)には値を出さない。クライアントには説明書の規模の節の行と注記で伝わる。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_change_request_staleness.py`(新規)の純粋の3本 | `Freshness.excluding`・`ScaleCount.state`・`with_baseline_changes`・`STALE_NOTE_KINDS`・`build_explanation`(規模の節)・`UNDECIDED_STATUSES` | pytest のテスト関数 | スタブ不要 ── 純粋(副作用なし)で外部依存を呼ばないため。束の写しは fixture の dict |
| 同 サービス・ルートの2本 | `ChangeRequestService`(詳細・説明書)・`BaselineService.freshness_in`・`ShareLinkService.create`、ルート `get_change_request`・`get_change_request_explanation`・`create_change_request_share_link` | 同上(ルートは関数を直接呼ぶ) | 束と反映済みの CR を偽の LLM で反映する fixture、DB は SQLite |
| `test_material_change_requests_flow.py`(更新・統合) | CR の詳細・説明書の JSON の `baseline_freshness`・`state`・基準の束の行 | httpx の AsyncClient | 偽の LLM(E2eFakeLLM) |

- 純粋: 自身を除く、テストだけ数えられない規模に注記を足すと他は stale・テストは uncountable のまま、古い段階も stale、束の行は常に・注記は番号つき。
- サービス: 反映済みの CR-1 の後に B-1 を基準に作った CR-2 は古い(詳細・説明書・共有リンクの作成)、説明書の数は stale、CR-1 自身は新しい、反映済みの CR-1 の説明書には注記なし。束が新しいときは fresh。
