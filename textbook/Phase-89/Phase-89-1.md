# Phase-89-1: 効果測定(N2・同じ表・決定的)

## この章の目的

ステージ11 で作った部品(予測・説明書・反映の比較・検証)を、[ベースライン](../../appendix/measurements/stage11-baseline.md)(Phase 80-2)と同じシナリオ N2・同じ材料で一巡させ、7段・4つの問い・影響の一覧の表を埋め直す。LLM・DB を使わない決定的なスクリプトにし、費用 0 で何度でも同じ結果を出す。結果と判定は [`stage11-effect.md`](../../appendix/measurements/stage11-effect.md) に書いた。

自動実装モード: on([introduction](./Phase-89-introduction.md) 参照)。この章は測定のスクリプトと記録だけで、本体と samples は変えない(#13/#15 の対象外)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`appendix/measurements/stage11/effect.py`](../../appendix/measurements/stage11/effect.py) | 新規 | N2 の CR を、本体の純粋関数で予測 → 説明書 → 反映の模擬 → 比較 → 検証まで通し、表を Markdown で出す |
| [`appendix/measurements/stage11-effect.md`](../../appendix/measurements/stage11-effect.md) | 新規 | 効果測定の結果(7段・4つの問い・影響の一覧・検証・説明書・応答の大きさ・E2E・実 LLM の一巡)と判定 |

## スクリプトの要点

```python
# appendix/measurements/stage11/effect.py(抜粋)
from measure import NEW_TEXT, TARGET, apply_cr, elements_of, load_models   # ベースラインと同じ材料と変更

prediction = predict(before, [Target(TARGET, "content", NEW_TEXT)], adds_requirement=False, texts=texts)
explanation = build_explanation(facts, prediction, snapshots_of(models), [])

changes = diff_elements(before, after, stages=(DOCUMENT_STAGE,))
marks = marks_for(before, after, changes, "doc:requirements")
current = {stage: record(StageImpact(), "doc:requirements", changes, stage_marks,
                         extra_sources=(cr_source(1),)) for stage, stage_marks in group_by_stage(marks).items()}
comparison = compare(prediction, applied, marked_stages, document_checks=[])
fresh = verification_of(applied, current, 1, prediction, [])
```

- **ベースラインのスクリプトを import する**(#17): 材料の読み出し(`git show 0c7a7f3^:...`)と FR-005 の書き換えは `measure.py` のものをそのまま使う。同じ材料・同じ変更でなければ、前と後を比べられない。
- **反映は模擬**: 本体の文書の再生成は LLM を呼ぶので、ベースラインと同じく「FR-005 の文だけを書き換えた model」を再生成の結果とみなす。印の付け方(`marks_for`)と CR の出どころの足し方(`record` の `extra_sources`)は、本体の文書の生成(`app/services/doc_generator_service.py`)と同じ関数を使う。
- **検証は2つの時点**: 反映の直後(印も文書の側も未確認)と、印を確認済みにし(`set_reviewed`)文書の側を確認済みにした後。後者でだけ `complete` が真になることで、「画面・API を見ないと検証済みにできない」ことを確かめる。
- **要約の照合**: 5節に合う文と、取り違えた文(`FR-050`・`10件`・`7件`)を `check_summary` に通す。

## 結果の要点

| 表 | ベースライン | ステージ11 |
|---|---|---|
| (a) 7段 | × 4・△ 3 | ○ 7 |
| (b) 4つの問い | × 2・△ 2 | ○ 4 |
| (c) 予測 | 6件(正解と一致) | 6件(同じ) |
| (c) 反映の後に確かめられるもの | 印 4件(画面・API は手がかりが無い) | 印 4件 + 文書の側の確認 2件。比較は一致 4・予測だけ 2(文書の側)・実際だけ 0 |

- ベースラインの穴「画面と API は印が付かない」は、**予測の文書の側の要素を、CR の確認の一覧にする**(Phase 86)ことで埋まった。印の付け方を変えずに、検証の条件に入れた。
- 照合は `FR-050` と `7` を拾い、`10` は拾わなかった。説明書の日付 `2026-10-19` に `10` があるため。照合は「5節に出ない数字」を見るだけで、5節のどこかにある数字の取り違えは見逃す。照合を関門にせず、人の確認を関門にした Phase 84 の判断の裏付けになる。
- 応答の大きさは、予測 1,667 バイト・説明書 2,064 バイト。束の写し(51KB)と比べて小さく、タブを開いたときに読む今の形で足りる(Phase 87 からの申し送りを閉じた)。

## 測れなかったもの

- **段階の承認で付く印の漏れ**: N2 は差分が要件1件で、段階の作り直しで新しい要素が生まれないため、この材料では出ない。段階の作り直しを伴う変更の測定は、ステージ12 へ送る(introduction の申し送り)。
- **実 LLM での反映と要約の質**: [89-4](./Phase-89-4.md) で開発環境で1回通し、効果測定の文書の「実 LLM での一巡」に足す。

## テスト観点

この章は測定で、本体のテストを足さない。確かめたことは次のとおり。

| 確かめ | SUT | ドライバ | スタブ |
|---|---|---|---|
| `effect.py` を2回流して出力が同じ | 本体の純粋関数(`predict`・`build_explanation`・`check_summary`・`diff_elements`・`marks_for`・`record`・`compare`・`verification_of`) | スクリプト(`uv run`) | スタブ不要 ── どれも純粋関数で、材料は git から読む固定の JSON のため |

- 各関数の単体の振る舞いは、Phase 83〜86 の devex-api のテストが固定している。ここでは、同じ材料で「つながったときの数」を見る。
