# Phase-49-3: 直し ── 差分の再生成・単位のキーの引き継ぎ・たどり方

## この章の目的

[49-1](./Phase-49-1.md)・[49-2](./Phase-49-2.md) で基準に届かなかった原因を直す。直す範囲は2つ目のセッションの着手時に決めた([introduction](./Phase-49-introduction.md)「着手時の相談で決めたこと」)。

- **再生成の揺れ**(実 LLM の過剰の大部分): 文書の再生成を前の版の差分にとどめる(R1)。単位のキーを、タスク名の言い換えがあっても引き継ぐ(R2)。
- **たどり方の広がり**(シナリオの過剰と見落とし): テーブルの変更は処理まで上らない(B)、文書の要素の変更では処理の CRUD・作業単位(・要約)を示さない(C)、API の変更は API を受ける入口のモジュールも示す(D)、要件の変更は共有の画面を通って別の処理へ広げない(G)。

直した本体で、49-1 のシナリオ(S1〜S8・N1〜N4)を測り直す。実 LLM での確かめは [49-4](./Phase-49-4.md)。

自動実装モード: on([introduction](./Phase-49-introduction.md) 参照)。

## この章で作成・更新したファイル

`textbook/samples/backend/` 配下(表は依存順。#30)。

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/detailed_design/plan.py`](../samples/backend/app/detailed_design/plan.py) | 更新 | `carry_over_unit_keys` を「前のキー → 名前 → 重なり・似た名前」の順の1対1に |
| [`app/detailed_design/impact/elements.py`](../samples/backend/app/detailed_design/impact/elements.py) | 更新 | 辺 `receives`(手順の最初の呼び出し先のモジュール → トリガーの API) |
| [`app/detailed_design/impact/trace.py`](../samples/backend/app/detailed_design/impact/trace.py) | 更新 | 規則 B・C・G(D は辺で直接の参照元になる)、理由の文 `receives` |
| [`app/documents/revision.py`](../samples/backend/app/documents/revision.py) | 新規 | 前の版の行・上流の変わった行の文と、変更なしの規則の文 |
| [`app/documents/requirements/assemble.py`](../samples/backend/app/documents/requirements/assemble.py) | 更新 | 変更なしの要件は前の版の行を使う |
| [`app/documents/requirements/drafting.py`](../samples/backend/app/documents/requirements/drafting.py) | 更新 | `GeneratedRequirement.unchanged`・規則の文 |
| [`app/documents/external_design/assemble.py`](../samples/backend/app/documents/external_design/assemble.py) | 更新 | 変更なしの画面・API は前の版の行を使う |
| [`app/documents/external_design/drafting.py`](../samples/backend/app/documents/external_design/drafting.py) | 更新 | `unchanged`・前の版の画面と API・上流の変わった行 |
| [`app/documents/internal_design/assemble.py`](../samples/backend/app/documents/internal_design/assemble.py) | 更新 | 変更なしのテーブル・API・モジュール・処理別データフローは前の版の行を使う |
| [`app/documents/internal_design/drafting.py`](../samples/backend/app/documents/internal_design/drafting.py) | 更新 | `unchanged`・前の版の4種の行・上流の変わった行 |
| [`app/documents/implementation_plan/assemble.py`](../samples/backend/app/documents/implementation_plan/assemble.py) | 更新 | `prev_key` でキーを指し、変更なしのタスクは中身(依存先を除く)を使う |
| [`app/documents/implementation_plan/drafting.py`](../samples/backend/app/documents/implementation_plan/drafting.py) | 更新 | `prev_key`・`unchanged`・前の版のタスク・上流の変わった行 |
| [`app/services/doc_generator_service.py`](../samples/backend/app/services/doc_generator_service.py) | 更新 | `upstream_changes` で上流の変わった行を求め、3文書の生成に渡す |
| ── ここからテスト ── | | |
| [`tests/unit/test_plan.py`](../samples/backend/tests/unit/test_plan.py) | 更新 | 重なり・似た名前・前のキーで引き継ぐ |
| [`tests/unit/test_impact_elements.py`](../samples/backend/tests/unit/test_impact_elements.py) | 更新 | 入口のモジュールの `receives` の辺 |
| [`tests/unit/test_impact_trace.py`](../samples/backend/tests/unit/test_impact_trace.py) | 更新 | B・C・D・G の規則 |
| [`tests/unit/test_document_revision.py`](../samples/backend/tests/unit/test_document_revision.py) | 新規 | 4文書の変更なし・`prev_key`・メッセージ・`upstream_changes` |
| [`tests/unit/test_doc_generator_service.py`](../samples/backend/tests/unit/test_doc_generator_service.py) | 更新 | 前の版の画面のプロンプトの形(1行1つの JSON) |

測定(samples の対象外): [`appendix/stage7-effect/impact/measure.py`](../../appendix/stage7-effect/README.md)(比較の方式を「実装 + A」だけにし、S2 を除いた合計を足した)・[`results.md`](../../appendix/stage7-effect/impact/results.md)(直した後)・[`results-49-1.md`](../../appendix/stage7-effect/impact/results-49-1.md)(49-1 の時点の出力)。

## 要点の抜粋

### 1. 差分の再生成(revision.py と4文書)

AI に前の版の行を見せ、変えない行は「変更なし」とだけ答えさせる。前の版の行を写すのはシステム(言い回しを AI に任せない)ので、変更なしの行は版を重ねても一字も変わらない。

```python
# app/documents/revision.py
REVISION_RULE = (
    "- 【前の版】があるときは、前の版を直す再生成。変更のきっかけ(【会話】の新しい依頼・"
    "【上流の変わった行】)に関係しない行は、前の版の同じ行を指して unchanged を true にし、"
    "言い換え・並べ替え・項目名の変更をしない(unchanged の行は、システムが前の版の行をそのまま"
    "使う)。関係する行だけを書き直す。前の版が「なし」なら unchanged は false"
)

def changed_rows(before: Mapping[str, BaseModel], after: Mapping[str, BaseModel]) -> list[str]:
    """前の版から変わった行(今回の版の順。消えた行は最後)。前の版が無ければ空(初回の生成)。"""
```

- 行の照合のキーは、各文書がすでに持つ安定した ID・名前: 要件ID(`prev_id`)・画面ID・API(`endpoint_key`)・テーブル名・モジュールのパス・処理別データフローのトリガー(`match_key`)・タスクのキー(`prev_key`)。
- 組み立ての形はどの文書も同じ(抜粋は外部設計書の API):

```python
# app/documents/external_design/assemble.py
        if d.unchanged and key in same:
            rows.append(same[key])
            continue
```

- 実装計画書のタスクは、AI に `prev_key`(前の版のタスクのキー)を書かせる。変更なしなら前の版の中身を使い、依存先だけは今回の並びで書いたものにする(依存先は並び順の ID のため)。
- **上流の変わった行**(`DocGeneratorService.upstream_changes`): 生成の前に表示していた版の model と、今回作った上流の model を `changed_rows` で比べる(外部設計書には要件定義書の、内部設計書には要件定義書・外部設計書の、実装計画書には要件定義書・内部設計書の行)。要件定義書の上流は会話なので、手がかりは会話の新しい依頼。

```python
# app/services/doc_generator_service.py
                changed = upstream_changes(
                    doc_type, previous_models, requirements, external, internal
                )
```

### 2. 単位のキーの引き継ぎ(plan.py)

```python
# app/detailed_design/plan.py
def carry_over_unit_keys(model: PlanModel, previous: PlanModel) -> PlanModel:
    # 1. すでに前の計画のキーを持つタスク(書き手が前の版のタスクを指したもの)
    # 2. タスク名が同じタスク(前の計画で同じ名前が2つあるものは除く)
    # 3. 種別が同じで、処理・要件の重なり(Jaccard)が大きい順。重なりが無ければ、
    #    タスク名が似ているもの(_TITLE_SIMILARITY = 0.6 以上)
```

- 49-2 の簡易1回目の言い換え(「プロジェクト初期化と…」→「プロジェクト初期構成と…」、処理の ID の振り直し)に当てると、5つとも前のキーに当たった(版1・版2 の model で確かめた。テストの例は同じ形)。
- 詳細設計モードの段階7の作り直しも同じ関数を使う(AI はキーを書かないので 1 は起きず、2・3 が効く)。

### 3. たどり方(trace.py・elements.py)

```python
# app/detailed_design/impact/trace.py
_HIDDEN_OWN: dict[ElementKind, frozenset[ElementKind]] = {
    "requirement": frozenset({"crud", "task", "summary"}),
    "screen": frozenset({"crud", "task", "summary"}),
    "api": frozenset({"crud", "task"}),
}
...
    changed_kind = kind_of(change.key)
    if changed_kind == "table":
        _add_implementers(change.key, direct, back, add)   # B: 処理には上らない
        return _sorted(found.values(), by_key)
...
            elif kind in _TOWARD_FUNCTION and kind != "screen":   # G: 画面は変わった要素のときだけ通る
                queue.append((*path, b.src))
```

- **C** は「示さない」だけで、その先(手順を実装する手順書)へはたどる。簡易モードの軸のタスク(置き場0)は隠さない(要件を直接持つ軸のため)。49-1 の試算は簡易モードのタスクも隠していたので N4 の見落としが1つ増えていた。実装ではこれを避けた。
- **D** はたどり方ではなく辺で入れた。`receives`(手順の最初の呼び出し先のモジュール → 処理のトリガーの API)を足すと、API の変更で入口のモジュールが「直接の参照元」(規則1)になる。49-1 の試算は段階4の層の名前「入口」で決めていたが、層の名前は構成図のレーンで決まり固定でないので、手順の最初の呼び出し先(利用者が呼ぶモジュール)にした。

```python
# app/detailed_design/impact/elements.py
        entry = next((s.callee.strip() for s in procedure.steps if calls_function(s)), "")
        api = triggers.get(fid)
        if entry and api is not None and f"module:{entry}" in b.elements:
            # 利用者が最初に呼ぶモジュールが、処理のトリガーの API を受ける
            b.ref(f"module:{entry}", f"api:{api}", "receives")
```

## 設計判断

- **R1 は「AI に写させる」でなく「AI に印を付けさせ、システムが写す」**: プロンプトで「変えない行はそのまま写す」と頼むだけでは、言い換えを止められない(49-2 の揺れ)。`unchanged` の行は前の版の行で置き換えるので、AI がどう書いても変わらない。代わりに、AI が関係する行まで `unchanged` にすると変更が落ちる。これは 49-4 の実 LLM で、正解の見落としとして数える。
- **上流の変わった行を渡す**: 後ろの文書は前の文書の md を読むが、どこが変わったかは md からは分からない。前の版との比較はシステムが決定的にできるので、手がかりとして渡した(LLM の判断を軽くする)。
- **S2 は範囲の外**(着手時の決定): 非機能要件 → 横断事項の対象のモジュール → そのモジュールを呼ぶ手順、は ID の辺では届かない。広げると過剰が大きく増える(41-2 で LLM を使わないと決めた範囲の外)。判定は S2 を除いて数える。

## シナリオの再測定(直した本体)

材料・正解は 49-1 と同じ。「実装 + A」は、stage6-effect の段階7(Phase 42 より前の生成物)に、今の生成で LLM が付ける横断事項の `req_ids` を補ったもの。

| 方式 | S1〜S8 示した / 当たり / 過剰の割合 / 見落とし | S1〜S8(S2 を除く) | N1〜N4 |
|---|---|---|---|
| 49-1 の実装(たどり方) | 51 / 30 / 41% / 9 | 51 / 30 / 41% / 3 | 31 / 16 / 48% / 1 |
| **直した実装(たどり方)** | 40 / 31 / 22% / 8 | **40 / 31 / 22% / 2** | **22 / 17 / 23% / 0** |
| 直した実装(印) | 38 / 30 / 21% / 8 | 38 / 30 / 21% / 2 | 16 / 14 / 12% / 0 |
| 直した実装 + A | 42 / 33 / 21% / 6 | 40 / 31 / 22% / 2 | 22 / 17 / 23% / 0 |

**判定(厳しめ: 過剰 ≤ 35%・見落とし S ≤ 5 / N ≤ 1。S2 は範囲の外)**: S1〜S8 は過剰 22%・見落とし 2、N1〜N4 は過剰 23%・見落とし 0 で、**どちらも基準に届いた**。

- 49-1 の試算(候補 A〜D: S 21%・6、N 24%・1)と比べ、N の見落としが 1 → 0(C で簡易モードの軸のタスクを隠さなかった)。S の見落とし(S2 を除く)は 2(S1・S4 の `clients/ai.py`。共有のモジュールの「どれを直すか」は ID では決まらない。Phase 42 からの申し送りのまま)。
- 残る過剰: S6 の5(テーブル documents を読み書きする CRUD・手順・処理ロジック・手順書のうち、正解は列を使う所だけ。列の単位は ID では分からない)、S5 の2(永続化の層のモジュール)、N4 の3(簡易モードにだけある要素)など。
- 49-1 の「改名の後に下流の参照を直して承認すると広がる」(2件)は変わらない(直す範囲に入れていない)。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
| --- | --- | --- | --- |
| `carry_over_unit_keys` | pytest(`test_plan.py`) | スタブ不要 ── 純粋関数(副作用なし)で、外部依存を呼ばないため | 前のキー・同じ名前・重なりの大きい順・似た名前(基盤)、同じ名前が2つの前のタスクは名前だけでは引き継がない、残りは次の番号 |
| `build_elements`(`receives`) | pytest(`test_impact_elements.py`) | スタブ不要 ── 純粋関数で、要素は fixture の model から作る | 入口のモジュールだけが API を受け、サービスのモジュールは受けない |
| `impact_of`(B・C・D・G)・`EDGE_REASON` | pytest(`test_impact_trace.py`) | スタブ不要 ── 純粋関数で、DB や LLM を呼ばない | 要件の変更は CRUD・作業単位・要約を示さず手順書へは届く、API の変更は要約と入口のモジュール、要件の変更は共有の画面で広がらず画面の変更は届く、テーブルの変更は処理に上らない |
| `revision.py`・4文書の `build_model`・メッセージ・`upstream_changes` | pytest(`test_document_revision.py`) | スタブ不要 ── 純粋関数で、下書きは偽の LLM の見本の構造化出力を `to_draft` で変換して作る | 統合スモーク: 変更なしの要件は前の版の行と同じ・変わった行の数え方(新しい・変わった・消えた・初回は空)・4文書の変更なしと書き直し・実装計画書の `prev_key`・前の版の行と上流の変わった行がメッセージに入る |
| `DocGeneratorService.generate`(再生成) | pytest(`test_doc_generator_service.py`) | スタブ: 偽の LLM(`FakeLLM`)── 実の Gemini を呼ばないため。DB はインメモリの SQLite | 前の版の画面が JSON の行でプロンプトに入り、前の版に無い仮の画面ID は振り直す(既存のテストの形を直した) |

```sh
cd devex-api/backend
uv run pytest -q tests/unit/test_plan.py tests/unit/test_impact_elements.py tests/unit/test_impact_trace.py tests/unit/test_document_revision.py tests/unit/test_doc_generator_service.py
PYTHONPATH=devex-api/backend uv run --project devex-api/backend python appendix/stage7-effect/impact/measure.py   # リポジトリ直下で
```
