# Phase-99-1: 効果測定(決定的な再現と実 LLM の流れ)

## この章の目的

ステージ12 の保護・確認事項が、[ベースライン](../../appendix/measurements/stage12-baseline.md)(Phase 90-2)で見た「合意した行が CR の外の再生成で動く」を止めたかを、同じ題材「トレンド追跡アプリ」で測る。測り方は2つある。1つは、ベースラインで書き出した版にステージ12 の保護を当て直す決定的な再現。もう1つは、ユーザーが画面で行った実 LLM の流れである(操作の記録は [99-4](./Phase-99-4.md))。マイルストーン13 を判定する。

自動実装モード: on([introduction](./Phase-99-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`appendix/measurements/stage12/effect.py`](../../appendix/measurements/stage12/effect.py) | 新規 | `export`(合意の記録と CR-3 を書き出す)・`snapshot <名前>`・`snapshot-version <版>`・`report`(A と B) |
| `appendix/measurements/stage12/data/`(`agreements-b3.json`・`cr3.json`・`effect/*.json`) | 新規 | 書き出したもの(report はこれだけを読む) |
| [`appendix/measurements/stage12-effect.md`](../../appendix/measurements/stage12-effect.md) | 新規 | 表・判定・分かったこと |

測定のスクリプトなので samples に写さない(#21。Phase 89 と同じ)。#13/#15/#30 の対象外。

## スクリプトの要点

```python
# appendix/measurements/stage12/effect.py(抜粋)
def simulated(records, cr3, v5) -> dict:
    """ステージ12 の流れなら残っていた合意: 記録どおりの合意 → CR-3 の反映での更新 → 全行の採用。"""
    ...
    rewritable = rewritable_keys(targets, cr3["predicted_impact"])
    updated, removed = change_request_items(rewritable, items, agreed, DOC_KINDS)

def replay(label, agreed, snaps) -> None:
    # 前の版も保護した後のものを渡す(本体の再生成と同じ順)
    new_req, r_req = protect_requirements(req, prev_req, agreed_contents(agreed))
    new_ext, r_ext = protect_external_design(ext, prev_ext, agreed_contents(agreed))
```

- **本体の純粋関数をそのまま使う**: `protect_requirements`・`protect_external_design`・`element_states`・`change_request_items`・`rewritable_keys`・`confirmation_items`・`adoption_counts`。測定のために同じ規則を書き直さない(#17)。
- **合意は2通り**: 「記録どおり」は、開発 DB の合意の記録(B-3 の移行分。ステージ12 より前の CR-3 と「採用にする」は入っていない)。「ステージ12 の流れなら」は、そこに CR-3 の反映での更新と、v5 の全12行の採用を足したもの。前者は今の DB で起きることを示し、後者はステージ12 が初めからあった場合を示す。
- **版を後から書き出す**: 段の途中で書き出せなかった版は `snapshot-version` で読む。合意は、その版が今の版だった間(次の版を作るまで)の記録から組み直す。記録は追記だけで日時を持つので、組み直せる。

## 結果の要点

詳細は [`stage12-effect.md`](../../appendix/measurements/stage12-effect.md)。

- **A(決定的な再現)**: どちらの合意でも、v6〜v9 の保護の後の「合意と違う・無い」は0件。「記録どおり」では FR-001 も戻る。これは、ステージ12 より前に反映した CR-3 が合意に入っていないためで、実 LLM の流れでは先に B-4 で合意し直した。
- **B(実 LLM)**: CR を渡さない再生成 v10・v12 の後、「合意済み 18 / 合意と違う 0」。利用者は毎回言い換えられ、毎回戻した。v12 では LLM が FR-003 を書き換え、CR-4 の合意の形に戻した(CR の変更が残った)。外部連携は一度も戻していない(ベースラインでは毎回言い換えられていた)。
- **確認事項**: 起点の v9 で推測の要件 12・推測の利用者 2・未決の観点 6。ベースラインの数と一致する。採用率は 92%(12/13)。
- **判定**: マイルストーン13 の2つとも ○。

## 測れなかったもの

- CR-4 の検証と、CR-4 の後の2回目の CR なしの再生成(行っていない)。
- 段の途中の確認事項・段階の状態(最後の書き出しだけ)。

## テスト観点

この章は本体のテストを足さない(測定)。

| 確かめ | SUT | ドライバ | スタブ |
|---|---|---|---|
| A を2回流して同じ出力 | 保護・合意の状態の純粋関数(`app/agreements`) | `effect.py report` | スタブ不要 ── 書き出した JSON だけを読む純粋な計算のため |
| B の版ごとの表 | 本体の保存した結果(版の `protection`・合意の記録・確認事項) | `effect.py snapshot`/`snapshot-version`(psql) | スタブ不要 ── 開発 DB の実データを読むだけのため |
