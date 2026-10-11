# Phase-40-2: 偽 LLM の契約テスト(観点・カード・2文書の model)

## この章の目的

E2E 用の偽 LLM(`E2eFakeLLM`)は、Phase 34〜37 で観点の判定・返信とカード・要件定義書と外部設計書の構造化出力を返すようになった。それぞれの出力は単体で確かめてきた([`test_fake_llm_e2e.py`](../samples/backend/tests/unit/test_fake_llm_e2e.py))が、**サービスの経路を通して**、偽物の出力が観点の取り込みの規則・完了判定・文書の組み立てと検証を通ることは固定していなかった。ブラウザの E2E と同じ順(作成 → 規模のカード → 3回の送信 → 4文書の生成 → 「採用にする」)を、画面を使わずにサービスのメソッドで流す契約テストを足す([Phase 32-1](../Phase-32/Phase-32-1.md) の段階8の契約テストと同じ考え方)。

自動実装モード: on([introduction](./Phase-40-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/ai/llm/fake.py`](../samples/backend/app/ai/llm/fake.py) | 更新 | 偽の要件定義書に、規模だけを根拠にした制約(`CON`、観点 `scale`)を1行足す([40-1](./Phase-40-1.md) の直しが偽の出力でも効くことを確かめるため) |
| ── ここからテスト ── | | |
| [`tests/unit/test_fake_llm_hearing_documents.py`](../samples/backend/tests/unit/test_fake_llm_hearing_documents.py) | 新規 | 作成 → 規模のカードに答える → 文を送る → 十分 → 4文書 → 「採用にする」を、偽 LLM とサービスで通す |

## 要点の抜粋

```python
# tests/unit/test_fake_llm_hearing_documents.py
# 最初の発話には、コードが規模のカードを付ける(規模は初期入力から推し量らない)
await chat.generate_opening_reply(project, llm=llm)
[scale_card] = cards_from_json(history[-1].cards)

# 規模のカードに答えて文も送る → 規模は利用者の発言を根拠に「採用」
answer = CardAnswer(card_id=scale_card.id, option=0)
chunks = await _send(chat, project, llm, "利用者は倉庫の担当者です", [answer])
assert {p.key: p.status for p in view.points}["scale"] == "adopted"

# 文を2回送る → 偽の判定が全観点を決め、必須がそろって十分
...
# 推測は、偽物が assumed と書いたセキュリティの要件だけ。規模だけを根拠にした制約も推測にならない
assert [(r.id, r.kind) for r in summary.assumed] == [("NFR-002", "NFR")]
assert (rows["CON-002"]["points"], rows["CON-002"]["source"]) == (["scale"], "user")
```

偽の判定は「利用者の発言(初期入力を含む)が4つになったら全観点を決定」で、根拠は最後の発言の番号(`fake.py` の `_judge_points`)。Phase 39 で、規模・技術スタックと「採用」は利用者の発言(sender='user')が根拠のときだけ取り込むようにした。根拠が最後の発言(= 利用者の発言)なので、偽物の判定はこの規則を通る ── それをこのテストが固定する。

## 設計判断

### 新しいファイルに置く

`test_fake_llm_e2e.py` は DB を使わない偽 LLM 単体のテスト、`test_fake_llm_simple_procedure.py`・`test_fake_llm_detailed_design.py` は段階の経路のテストである。ヒアリングから上流の文書までは、そのどちらでもない区間なので、Phase 32 と同じく新しいファイルにした。

### 偽の外部設計書の API は増やさない

`API_BODY_MISSING` の直し([40-1](./Phase-40-1.md))を偽物でも確かめるには、本文「なし」の POST を偽の外部設計書に足す案もある。しかし偽の外部設計書の API は、詳細設計モードの段階1の偽の機能一覧と同じ2つにそろえてある(段階1の `MISSING_API` の契約)。増やすと段階1以降の契約テストと E2E に波及するので、このテストは「外部設計書の指摘が0件」で、偽物の出力が検証を通ることだけを固定した。「なし」の扱いは 40-1 の単体テストが固定する。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| 偽 LLM の判定・返信・2文書の構造化出力と、`ChatService`(`generate_opening_reply`・`stream_reply`・`points_view`)・`DocGeneratorService`(`generate`・`adopt_requirement`)・`document_read` | pytest(`test_fake_llm_hearing_documents.py`) | なし ── 偽 LLM は検証される側(出力の出どころ)。DB はインメモリ SQLite(`db_session`) | 最初の発話に規模のカード、カードの回答で規模が採用、3回目で十分(全観点が決定・根拠あり、まとめでカードなし)、要件の出どころ(ユーザー4・採用1・推測1、規模の制約はユーザー)、外部設計書の指摘0、「採用にする」で同じ版のまま推測0 |
| 偽 LLM の単体(既存) | pytest(`test_fake_llm_e2e.py`) | スタブ不要 ── 偽 LLM そのものが対象 | 制約の行を足しても、ID の引き継ぎ・推測1件は変わらない |

```sh
cd devex-api/backend && uv run pytest tests/unit/test_fake_llm_hearing_documents.py tests/unit/test_fake_llm_e2e.py tests/unit/test_fake_llm_detailed_design.py tests/unit/test_fake_llm_simple_procedure.py
```
