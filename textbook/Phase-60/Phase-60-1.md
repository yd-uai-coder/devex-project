# Phase-60-1: 偽 LLM の契約テスト(設計レビュー・テスト仕様書)

## この章の目的

Phase 52〜59 で作った設計レビュー(自動のレビュー・採否・差し戻し・聞き直し・「直ったか」)とテスト仕様書は、それぞれ fixture の偽物で確かめてきた([`test_review_service.py`](../samples/backend/tests/unit/test_review_service.py) など)。E2E 用の偽 LLM(`E2eFakeLLM`)の出力が、この経路を**通しで**通ることは固定していなかった。ブラウザの E2E([60-2](./Phase-60-2.md))で見るのはパネルと採否までなので、その先(採用した指摘での再生成・再生成の後のレビュー・「直ったか」・聞き直し)を、画面を使わずにサービスのメソッドで流す契約テストを足す([Phase 50-1](../Phase-50/Phase-50-1.md) と同じ考え方)。

自動実装モード: on([introduction](./Phase-60-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| ── ここからテスト ── | | |
| [`tests/unit/test_fake_llm_design_review.py`](../samples/backend/tests/unit/test_fake_llm_design_review.py) | 新規 | 簡易モードのレビュー → 採用 → 差し戻し → 流れ直し → 「直ったか」→ 聞き直し、オフの自己診断、詳細設計モードの段階の区切りとテスト仕様書 |

本体のアプリのコード(`fake.py` を含む)は変えていない。偽 LLM の出力は、そのままで経路を通った。

## 要点の抜粋

```python
# tests/unit/test_fake_llm_design_review.py
class _SendbackLLM(E2eFakeLLM):
    """修正指示(指摘の文の頭)を受けた外部設計書の生成でだけ、SCR-001 の操作に「取り消す」を
    足す偽LLM。"""

    def with_structured_output(self, schema, *, include_raw=False, method=None) -> Any:
        inner = super().with_structured_output(schema, include_raw=include_raw, method=method)
        if schema is not ExternalDesignGenerationOutput:
            return inner
        return _EditedExternal(inner)   # messages に INSTRUCTION_HEAD があれば parsed を1行変える
```

```python
# 採用した設計の指摘で、外部設計書から下流を作り直す
await _generate(
    db_session, project, llm, redis, start_from="external_design", finding_ids=[design.id]
)
[gate] = await reviews.gate_summaries(project)
assert {f.id for f in gate.adopted_before} == {design.id, hearing.id}
assert gate.followups[design.id] == "changed"
assert gate.fix_checks[design.id].verdict == "fixed"
```

3つのテスト:

1. **簡易モードの通し**(統合スモーク): superuser でレビューがオンの持ち主が、ヒアリングを終えて4文書を生成する → テスト仕様書が同じ組で作られ検証の指摘 0 → 文書の区切りが自動でレビュー済み(偽の指摘2件が重要度の順、テスト仕様書はレビューに渡さない、チャットは自己診断でなく件数の一行)→ 2件を採用(ヒアリングの指摘は再生成に渡すと 409)→ 設計の指摘で外部設計書から作り直す → 新しい回・前の回で採用した指摘・追跡「変更あり」・「直ったか」= `fixed` → 同じ版で判定し直しても0件 → ヒアリングの指摘で聞き直すと `security` が未決・プロジェクトは修正中。
2. **オフ**: 一般の利用者では回は無く(区切りは未レビュー)、チャットの最後は自己診断。
3. **詳細設計モード**: 段階1〜5 の承認では段階の区切りは「まだ無い」。段階1〜7 を承認した後に段階6・7 の区切りを流すと成功し、版に `stage:6` を持つ。起点 `test_spec` でテスト仕様書を作っても、文書の区切りのレビューは流れない。

## 設計判断

### 「直ったか」まで通すため、修正指示に反応する包みを足す

偽 LLM は毎回同じ出力を返す。最初は包みなしで書いたところ、再生成の後の追跡は `target_unchanged`(版は変わったが、指摘の対象の行は変わらない)になり、「直ったか」は判定されなかった。これは正しい動き(直していない指摘で Haiku を呼ばない)で、その性質も固定できた。そのうえで、判定まで通すには「指摘を直した版」が要る。

偽 LLM 自体に分岐を足す案もあるが、E2E の出力が変わり、ほかの契約テストにも響く。そこで、テストの中だけで偽 LLM を包み、**生成のプロンプトに修正指示の文の頭(`INSTRUCTION_HEAD`)が入ったときだけ** SCR-001 の行を1つ変える。行が変わったこと自体が「差し戻しの指示が外部設計書の生成に届いた」ことの確かめにもなる。

見出し `## 修正指示` は指摘が無くても毎回プロンプトに入る(中身が「なし」)ので、判定には使えない。指摘があるときだけ入る文の頭を使った。

### スタブは Redis だけ

予約札(`SET NX EX`)と1日の回数は Redis を使うので、[`fake_redis.py`](../samples/backend/tests/fixtures/fake_redis.py)(Phase 59-3)を渡す。偽 LLM は検証される側なので、スタブではない。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
| --- | --- | --- | --- |
| `test_smoke_simple_review_adopt_sendback_rehearing_and_fix_check` | E2eFakeLLM のレビュー・判定・テスト仕様書の出力と、`DocGeneratorService.generate`(自動のレビュー・差し戻し)・`ReviewService`(区切り・採否・追跡・聞き直し)・`FixCheckService.run_for` の経路 | テスト関数(画面の操作と同じ順) | `FakeRedis`(予約札と回数)・`_SendbackLLM`(修正指示を受けたときだけ外部設計書の行を変える)。DB はインメモリ SQLite |
| `test_review_off_keeps_self_diagnosis` | 実効値がオフのときの生成の後の流れ | 同上 | `FakeRedis` |
| `test_detailed_stage_gates_and_test_spec` | 段階の区切りの受け付け・実行・状態と、起点 `test_spec` の生成 | 同上 | `FakeRedis`。段階の手順は [`fake_llm_flow.py`](../samples/backend/tests/fixtures/fake_llm_flow.py)(Phase 50-1) |

```sh
cd devex-api/backend
uv run pytest -q tests/unit/test_fake_llm_design_review.py
```
