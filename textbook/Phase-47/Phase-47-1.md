# Phase-47-1: 観点を4つ足す(データの保全・保持と削除・ログ・不正利用)

## この章の目的

ステージ6の効果測定で、どの回も聞かれなかった潜在の事実 L2(バックアップ)・L5(ログに本文を残さない)・L6(不正利用)・L14(削除)を聞けるようにする。原因は、1つの観点に問いが1つしかないため、可用性・セキュリティなどの2つ目の側面まで問いが届かなかったこと。側面をそれぞれ独立した観点として観点の表に足し、判定・返信・カード・対象外・まとめ・要件定義書といった今の仕組みにそのまま乗せる。

自動実装モード: on([introduction](./Phase-47-introduction.md) 参照)。

## この章で作成・更新したファイル

`textbook/samples/backend/` 配下(表は依存順。#30)。

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/hearing/points.py`](../samples/backend/app/hearing/points.py) | 更新 | 観点のキー4つと定義、`PointDef.category`・`ipa_category`(IPA の大項目) |
| [`app/documents/requirements/assemble.py`](../samples/backend/app/documents/requirements/assemble.py) | 更新 | NFR の大項目を `ipa_category` にそろえる(6大項目のまま) |
| [`app/documents/requirements/validation.py`](../samples/backend/app/documents/requirements/validation.py) | 更新 | 必須の未決は、その版の `point_statuses` に記録した観点だけで数える |
| ── ここからテスト ── | | |
| [`tests/unit/test_hearing_points.py`](../samples/backend/tests/unit/test_hearing_points.py) | 更新 | 観点の数・並び・大項目、規模ごとの必須、任意の列 |
| [`tests/unit/test_hearing_point_repository.py`](../samples/backend/tests/unit/test_hearing_point_repository.py) | 更新 | 行の数を `len(POINT_DEFS)` で数える |
| [`tests/unit/test_requirements_doc.py`](../samples/backend/tests/unit/test_requirements_doc.py) | 更新 | 新しい観点の NFR の大項目、以前の版に後から足した観点の指摘を付けない |

依存の向き: `documents/requirements` → `hearing`(既存のまま)。`app/hearing/__init__.py` の re-export は変えていない(`PointDef` は既に出している)。

## 要点の抜粋

### 1. 観点の定義(points.py)

```python
# app/hearing/points.py
@dataclass(frozen=True)
class PointDef:
    ...
    confirm_in_chat: bool = False
    # IPA の大項目(非機能の観点で、ラベルが大項目と違うとき)
    category: str = ""

    @property
    def ipa_category(self) -> str:
        return self.category or self.label
```

| key | ラベル | 大項目 | 必須 | 問いの例 |
| --- | --- | --- | --- | --- |
| `backup` | 可用性(データの保全) | 可用性 | 全規模 | 入れたデータが消えてしまったら、どのくらい前の状態まで戻せればよいですか |
| `data_retention` | 運用・保守性(データの保持・削除) | 運用・保守性 | 全規模 | 作ったデータやアカウントを、利用者が消せる必要はありますか。いつまで残しますか |
| `logging` | セキュリティ(ログ) | セキュリティ | 社内以上 | 動きの記録(ログ)に、入力した内容を残してよいですか |
| `abuse` | セキュリティ(不正利用) | セキュリティ | 社内以上 | なりすましや、機械的な大量の登録・利用を防ぐ必要はありますか |

- **並びは大項目の観点のすぐ後ろ**: 可用性 → データの保全 → 性能 → 運用 → データの保持・削除 → 移行 → セキュリティ → ログ → 不正利用 → 環境。定義の順は聞く順なので、同じ話題が続けて聞かれる。
- **`done_when`(決まったと言える条件)** も観点ごとに持つ。例えばデータの保全は「データを失ったときにどこまで戻せればよいか(バックアップの要否・頻度・残す期間のどれか)が分かる」。判定の表と返信のカードの指示に、今までどおり渡る。
- **必須は側面ごとに違う**(着手時の相談)。データを失うことや、消せないことは個人でも困るので、データの保全と保持・削除は全規模で必須にした。ログと不正利用は社内以上で必須にした。
- **コードを変えずに付いてくるもの**: 判定の LLM の出力の型(`PointKey`)、判定の表、次に聞く観点とカード、対象外のボタン、まとめ、偽 LLM(`POINT_DEFS` を回す)、devex-ui の表(ラベルは API から返す)。`hearing_points.point_key` は文字列なので、マイグレーションは要らない。devex-ui の観点のデモ(`src/features/hearing-points/demo/`)は当時の記録なので変えない。

### 2. 要件定義書の大項目(assemble.py)

```python
# app/documents/requirements/assemble.py
_NFR_CATEGORY: dict[str, str] = {
    d.key: d.ipa_category for d in POINT_DEFS if d.kind == "nonfunctional"
}
```

AI が NFR の大項目に6つ以外(「データの保全」など)を書いたとき、根拠の観点から大項目を決める。新しい観点はラベルが大項目と違うので、ラベルではなく `ipa_category` を引く。要件定義書の大項目は6つのままになる。

### 3. 以前の版の検証(validation.py)

```python
# app/documents/requirements/validation.py
open_required = [
    d for d in POINT_DEFS
    if is_required(d.key, scale) and statuses.get(d.key) == "open"
]
```

以前は、表に無い観点を未決とみなしていた。それでは、Phase 47 より前に生成した要件定義書に、その時には無かった観点の「必須の観点が未決のまま生成しました」が後から付いてしまう。`build_model` は全観点の状態を写すので、新しく生成する版では今までどおり未決の必須が数えられる。

## 設計判断

- **観点を足す(側面を構造化しない)**。着手時に、観点の下に側面を持たせる案と比べた([introduction](./Phase-47-introduction.md)「着手時の相談で決めたこと」2)。構造化にしかない利点は表を大項目でまとめて見せることだけで、ラベルの先頭に大項目を付ければほぼ代わりがきく。一方、構造化すると、状態の列・判定の出力・カードの指す先・要件の出どころの根拠のキー・API・画面がすべて変わる。
- **L14 は運用・保守性の下**(ユーザーの選択。推奨はセキュリティの下)。保存の期間と消す運用として聞く。
- **すでにヒアリングしたプロジェクトでは、新しい観点は未決として表に出る**。聞いていないので、決まったことにはしない。保存済みの完了判定(`hearing_check`)は次の発言まで変わらない。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
| --- | --- | --- | --- |
| `POINT_DEFS`・`is_required`・`open_required`・`open_optional`(統合スモーク: 定義の数と順) | pytest(`test_hearing_points.py`) | スタブ不要 ── 純粋関数(副作用なし)で、外部依存を呼ばないため | 非機能10、側面は大項目の観点のすぐ後ろ、大項目は6つ、規模ごとの必須(個人12・社内18・公開19)、ログと不正利用は個人で任意 |
| `HearingPointRepository.save_states` | pytest(`test_hearing_point_repository.py`) | スタブ不要 ── インメモリ SQLite を使う(永続化そのものが対象のため) | 全観点の行を書く(数は `len(POINT_DEFS)`) |
| `build_model`・`validate_requirements` | pytest(`test_requirements_doc.py`) | スタブ不要 ── 純粋関数で、観点の表は `PointState` を直接作って渡す | 新しい観点の NFR は可用性・セキュリティ・運用・保守性に入る。以前の版の表に無い観点は指摘しない。新しい観点を決めた表は指摘0件 |

既存の `test_chat_service.py`・`test_fake_llm_*`・`tests/integration/test_projects_flow.py` は変えずに通る(観点の数を `len(POINT_DEFS)` で数えている)。

```sh
cd devex-api/backend && uv run pytest tests/unit/test_hearing_points.py tests/unit/test_hearing_point_repository.py tests/unit/test_requirements_doc.py tests/unit/test_chat_service.py tests/unit/test_fake_llm_e2e.py tests/unit/test_fake_llm_hearing_documents.py tests/integration/test_projects_flow.py -q
```
