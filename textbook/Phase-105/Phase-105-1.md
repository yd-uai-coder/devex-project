# Phase-105-1: 言い換えの規則と、E2E の偽の LLM の言い換えのモード

## この章の目的

実 LLM は再生成のたびに、外部連携のサービス名・利用者の名前・処理の名称を少し言い換えることがある(「X API」→「X」、「トップページ表示」→「トップページ表示処理」)。名前で同一性を決める照合がこの揺れに耐えるかを、テストで確かめられるようにする。そのために、同じ揺れを決定的に作る規則(純粋関数)を置き、E2E の偽の LLM には「印のあるプロジェクトだけ言い換える」モードを足す。この章では、今の照合のうち揺れに耐えるもの(画面・段階1 の処理)をテストで固定する。耐えないもの(外部連携・推測の利用者)は 105-2・105-3 で直す。

自動実装モード: on([introduction](./Phase-105-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 内容 |
| --- | --- |
| [`backend/app/ai/llm/paraphrase.py`](../samples/backend/app/ai/llm/paraphrase.py) | 新規。名称を決定的に言い換える規則 |
| [`backend/app/ai/llm/fake.py`](../samples/backend/app/ai/llm/fake.py) | E2E の偽の LLM に、印のあるプロジェクトだけ言い換えるモードを足した |
| [`backend/tests/unit/test_paraphrase.py`](../samples/backend/tests/unit/test_paraphrase.py) | 新規。規則と、言い換えた出力に対する今の照合(段階1・画面)のテスト |
| [`backend/tests/unit/test_fake_llm_e2e.py`](../samples/backend/tests/unit/test_fake_llm_e2e.py) | 印の有無で、偽の LLM の再生成の出力が変わる / 変わらないテストを足した |

## 1. 言い換えの規則 `paraphrase.py`

```python
# app/ai/llm/paraphrase.py(抜粋)
PARAPHRASE_MARK = "[言い換え]"     # E2E の偽の LLM に言い換えさせるプロジェクトの印
PARAPHRASE_SUFFIX = "(言い換え)"   # 名前の後ろに足す語


def paraphrase_name(name: str) -> str: ...      # 後ろに語を足す(付いていれば足さない)
def base_name(name: str) -> str: ...            # 足した語を外す
def paraphrase_service(service: str) -> str: ...  # 末尾の「API」を外す・無ければ「 API」を足す

def paraphrase_requirements(output: RequirementsGenerationOutput) -> RequirementsGenerationOutput: ...
def paraphrase_external_design(output: ExternalDesignGenerationOutput) -> ExternalDesignGenerationOutput: ...
def paraphrase_function_list(output: FunctionListGenerationOutput) -> FunctionListGenerationOutput: ...
```

- 規則は決定的にした(乱数を使わない)。テストが毎回同じ結果になり、落ちたときに再現できるからである。
- 言い換える対象は、名前で同一性を決める要素だけ。要件定義書は利用者(1.2)の名前、外部設計書は画面名と外部連携のサービス名、段階1 は処理の名称。要件の文は言い換えない。要件は前の版の ID を `prev_id` で指すので、文の言い換えには元から耐えるからである。
- サービス名は、実 LLM で見た揺れ(Phase 99 の「X API」→「X」)と同じ形にした。他の名前は語を後ろに足すだけにした。
- 構造化出力ごとの関数は `model_copy` で新しい出力を返し、渡した出力は変えない。単体テストは、生成の見本の出力にこれを当てて「言い換えた再生成の出力」にする(偽の LLM を介さない)。

## 2. E2E の偽の LLM の言い換えのモード `fake.py`

```python
# app/ai/llm/fake.py(抜粋)
def _paraphrasing(messages) -> bool:
    return PARAPHRASE_MARK in _human_text(messages)   # 会話(下流では上流の md)に印がある


def _requirements_output(messages) -> RequirementsGenerationOutput:
    previous = _previous_ids(messages)
    paraphrasing = _paraphrasing(messages)
    output = _base_requirements_output(previous, paraphrasing)   # 印があれば推測の利用者を足す
    ...
    return paraphrase_requirements(output) if paraphrasing and previous else output


def _external_design_output(messages) -> ExternalDesignGenerationOutput: ...  # 外部連携を足し、再生成なら言い換える
def _function_list_output(messages) -> FunctionListGenerationOutput: ...       # 外部設計書に言い換えの語があれば言い換える
```

- **モードの決め方**(相談の決定2): 環境変数にすると、E2E のすべての spec で名前が変わり、既存の spec(合意の流れ・詳細設計の流れ)の期待も直すことになる。プロジェクトの印にすれば、言い換えを試す spec だけが印を書けばよい。偽の LLM はステートレスなので、印はプロンプトの中にあるものから読む。
- **印の届け方**: 要件定義書のプロンプトには会話(初期入力を含む)が入るので、プロジェクトの概要に印を書けば届く。外部設計書のプロンプトは要件定義書の md を、段階1 のプロンプトは外部設計書の md を読むので、偽の LLM は要件定義書の目的・外部設計書の概要に印を写して下流へ渡す。
- **再生成の見分け方**: 要件定義書は前の版の要件の節、外部設計書は前の版の画面の節に中身があれば再生成とみなす。段階1 のプロンプトには前の版が無いので、外部設計書の md に言い換えの語があるとき(外部設計書を作り直したとき)に言い換える。
- 印のあるプロジェクトでは、推測の利用者を1行(総務の担当者)と外部連携を1行(予約通知 API)足す。どちらも、言い換えたときに照合を試す相手が要るからである。印の無いプロジェクトの出力は今までと同じ(既存の E2E の前提を変えない)。
- 段階1 は、画面の処理を足さず、今の2つの API の処理の名称を言い換えるだけにした。段階2 以降の偽の出力は処理 `F-01`・`F-02` を前提に固定しているので、処理を足すと後の段階の検証で止まる。API でない処理の引き継ぎ(名称で当たらなければ関連画面で引き継ぐ)は、`test_paraphrase.py` の純粋なテストで確かめる。Claude の判断(実装中。計画では画面の処理を足す予定だった)。
- 推測の利用者の ID の引き継ぎ(`_previous_user_ids`)は 105-3 で足した。

## 3. 今の照合の強さ

言い換えた出力で、今の照合が耐えるものを固定した(`test_paraphrase.py`)。

| 要素 | 照合のキー | 言い換えたとき |
| --- | --- | --- |
| 段階1 の API の処理 | トリガー(メソッドとパス) | ID を引き継ぐ |
| 段階1 の画面の処理 | 名称、当たらなければ関連画面(Phase 99 の調整) | ID を引き継ぐ |
| 外部設計書の画面 | 画面 ID | 合意済みなら合意の名前に戻る |
| 外部連携 | サービス名 | **合意の行が戻り、言い換えた行も残る**(105-2 で直す) |
| 推測の利用者 | 名前(`user:<名前>`) | **確認事項の決める機会・メモが別の項目に移る**(105-3 で直す) |

## テスト観点

用語: SUT = テストの対象、ドライバ = SUT を呼ぶもの、スタブ = SUT が呼ぶ相手の代わり。

- `test_paraphrase.py`
  - SUT: `paraphrase.py` の規則と、言い換えた出力の消費者(`merge_draft`・`protect_external_design`)。ドライバ: テスト関数。スタブ不要 ── どれも純粋関数で、外部依存を呼ばないため。
  - 統合スモーク(第一テスト): 段階1 の下書きを言い換えて組み立て直しても、処理 ID が変わらない(API・画面の処理)。
  - 名前の語は1回だけ足し、`base_name` で外せる。サービス名は末尾の「API」を外す・足す。
  - 要件定義書は利用者の名前だけ、外部設計書は画面名とサービス名だけを変え、渡した出力は変えない。
  - 合意済みの画面は、名前を言い換えても合意の形に戻る。
- `test_fake_llm_e2e.py`(足した2件)
  - SUT: `E2eFakeLLM` の要件定義書・外部設計書・段階1 の出力。ドライバ: テスト関数(本物のプロンプトの組み立てで、生成と作り直しを続けて呼ぶ)。スタブ不要 ── 偽の LLM そのものが SUT で、DB を使わないため。
  - 印があると、初回は目的・概要に印を写し、推測の利用者と外部連携を足す。作り直すと利用者・画面・外部連携・処理の名前を言い換え、要件の `prev_id` は引き継ぐ。
  - 印が無いと、作り直しても同じ名前・同じ要素(既存の E2E の前提)。
