# Phase-84-1: 対象ごとの変更後の案

## この章の目的

説明書の2節「対象の要件 ── 合意済みの文と変更後の案」を対象ごとに書けるよう、CR の対象(要件 ID と変更の種類の組。[83-1](../Phase-83/Phase-83-1.md))に任意の「変更後の案」(要件の新しい文の案)を足す。着手時の相談でユーザーが選んだ形で、仕様の変更なので #40 に従い [`q_a.md`](../q_a.md)「Phase 84 開始時」に CR の形で残してから docs に反映した。

自動実装モード: on([introduction](./Phase-84-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`app/change_requests/targets.py`](../samples/backend/app/change_requests/targets.py) | 更新 | `Target.proposed_text`、`normalize_targets` の案の整え(空白・重複・衝突・削除の案)、保存の形に `proposed_text` |
| [`app/schemas/change_request.py`](../samples/backend/app/schemas/change_request.py) | 更新 | `ChangeRequestTargetIn.proposed_text`(上限 2000字)、応答の対象を `ChangeRequestTargetDetailRead`(案つき)に |
| [`app/services/change_request_service.py`](../samples/backend/app/services/change_request_service.py) | 更新 | 作成・更新で `Target` に案を渡す |
| [`tests/unit/test_change_request_targets.py`](../samples/backend/tests/unit/test_change_request_targets.py) | 更新 | 案の整え・衝突・削除の案・保存の形(案の無い行の読み) |
| [`tests/unit/test_change_request_service.py`](../samples/backend/tests/unit/test_change_request_service.py) | 更新 | 作成で案が残る・スキーマの検証(空白・削除の案は 422) |

依存の向き: スキーマ・サービス → `targets.py`(既存の向きのまま)。新しい import は無い。

## 1. 案の持ち方

```python
# app/change_requests/targets.py(抜粋)
@dataclass(frozen=True)
class Target:
    requirement_id: str
    kind: TargetKind = "content"
    proposed_text: str = ""          # 任意。削除の対象は持たない

def normalize_targets(targets) -> list[Target]
    # ID と案の前後の空白を除き、同じ要件を1つにまとめる(最初に出た順)。ValueError になるのは
    # 違う種類 / 違う案(片方が空なら書かれた方を残す)/ 削除の対象に案
def targets_to_json(targets) -> list[dict]     # [{requirement_id, kind, proposed_text}]
def targets_from_json(value) -> list[Target]   # 案の無い行(83 の形)は空の案
```

- **列は JSON のまま**: `targets` は JSONB の列なので、項目を足してもマイグレーションは要らない。Phase 83 の形の行(案の無い行)は空の案として読む。
- **削除の案は誤り**: 削除は「新しい文が無い」ことなので、案を書けたら意味が二重になる。スキーマの `field_validator`(83-1 で置いた `_normalized`)が ValueError を検証の誤り(422)にする。
- **予測には持たせない**: `PredictedTarget`(予測の起点)は ID・種類・束の文のまま。説明書は案を CR の対象から読む([84-3](./Phase-84-3.md) の `facts_of`)。予測のたどり方と保存の形は変えない。
- **応答の型を分けた**: 予測の起点の応答 `PredictedTargetRead` は `ChangeRequestTargetRead` を継ぐので、そこに案を足すと予測の応答にも空の案が出る。CR の一覧・詳細だけに案を出すため、案つきの `ChangeRequestTargetDetailRead` を足し、`from_target` をそちらへ移した。

## テスト観点

用語(初出の章で定義済み): SUT = テスト対象、ドライバ = SUT を呼ぶ側、スタブ = SUT が呼ぶ外部の代わり。

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_change_request_targets.py`(更新) | `normalize_targets`・`targets_to_json`・`targets_from_json` | pytest のテスト関数 | スタブ不要 ── 対象が純粋(副作用なし)で外部依存を呼ばないため |
| `test_change_request_service.py`(更新) | `ChangeRequestService.create`・`update` と `ChangeRequestCreate` の検証 | pytest のテスト関数 | 既存のまま(SQLite のセッションと `create_impact_project`) |

- 整え: 空の案と書かれた案は書かれた方を残す / 同じ案の重複は1つ / 違う案は ValueError / 削除の空白だけの案は案なし。
- 保存の形: 案つきで往復 / 案の無い行は空の案。
- サービス: 作成で案が CR の `targets` に残り、詳細の対象に `proposed_text` が出る / 削除の案はスキーマで 422。
