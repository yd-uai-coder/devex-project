# Phase-40-1: Phase 39 で見つけた不具合の直し

## この章の目的

[Phase 39](../Phase-39/Phase-39-introduction.md) の効果測定で見つけ、「この Phase で生まれたもの」に積んだ小さな不具合のうち、ユーザーが選んだ4つを直す ── 返信の問いの二重、規模の制約(CON)の出どころ、`API_BODY_MISSING` の誤検知、実装計画書の見出しの記号の重なり。どれも測定の生成物([`appendix/measurements/stage6-effect.md`](../../appendix/measurements/stage6-effect.md))で実際に出たもので、本番に出す前に片づける。

自動実装モード: on([introduction](./Phase-40-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/documents/requirements/assemble.py`](../samples/backend/app/documents/requirements/assemble.py) | 更新 | `cap_source(..., kind=)`: 制約(CON)の行は規模の観点も上限の根拠に数える |
| [`app/documents/external_design/model.py`](../samples/backend/app/documents/external_design/model.py) | 更新 | `NO_BODY = "なし"`(本文の要らない API の本文の欄の値) |
| [`app/documents/external_design/drafting.py`](../samples/backend/app/documents/external_design/drafting.py) | 更新 | 本文の欄の説明と規則に「本文の要らないものは『なし』」 |
| [`app/documents/external_design/validation.py`](../samples/backend/app/documents/external_design/validation.py) | 更新 | `API_BODY_MISSING` の文言に「なし」の書き方を添える(判定は空欄だけのまま) |
| [`app/documents/external_design/__init__.py`](../samples/backend/app/documents/external_design/__init__.py) | 更新 | `NO_BODY` の re-export |
| [`app/services/chat_service.py`](../samples/backend/app/services/chat_service.py) | 更新 | `_has_question`(「？」か依頼・問いの言い切りがあれば問いあり)を `_ensure_question` が使う |
| [`app/services/doc_generator_service.py`](../samples/backend/app/services/doc_generator_service.py) | 更新 | `_collapse_doubled_headings`: 自由記述の文書の見出しの記号の重なりを1つにまとめる |
| ── ここからテスト ── | | |
| [`tests/unit/test_requirements_doc.py`](../samples/backend/tests/unit/test_requirements_doc.py) | 更新 | 規模は制約の行だけで上限に数える |
| [`tests/unit/test_external_design_doc.py`](../samples/backend/tests/unit/test_external_design_doc.py) | 更新 | 「なし」は警告しない、空欄は警告する |
| [`tests/unit/test_chat_service.py`](../samples/backend/tests/unit/test_chat_service.py) | 更新 | 「〜教えてください。」で終わる返信に問いを足さない |
| [`tests/unit/test_doc_generator_service.py`](../samples/backend/tests/unit/test_doc_generator_service.py) | 更新 | 見出しの記号の重なりを先頭だけ残す、本文の `#` は変えない |

`__init__.py` の re-export(#7): `from app.documents.external_design.model import (BODY_METHODS, NO_BODY, SCREEN_PREFIX, …)`。依存の向きは `drafting`・`validation` → `model`(`model` は何も読まない)で変わらない。

## 要点の抜粋

### 1. 問いの二重(`_ensure_question`)

返信に問いもカードも無いとき、コードが次の観点の問いを足す(Phase 35 完了後の調整)。問いの有無を「？」だけで見ていたので、「〜について教えてください。」で終わる返信にも足し、同じ観点を二度聞いていた(2回目の簡易の1発言目)。

```python
# app/services/chat_service.py
_QUESTION_ENDING = re.compile(
    r"(ください|ますか|ませんか|ですか|でしょうか)(?=[。．.!！」)）]|\s|$)"
)

def _has_question(message: str) -> bool:
    return "？" in message or "?" in message or _QUESTION_ENDING.search(message) is not None
```

### 2. 規模の制約の出どころ(`cap_source`)

Phase 36 で「規模はほぼ必ず決まっているので、それだけを根拠に上限を上げない」とした。その結果、利用者がカードで選んだ規模を述べる制約(「誰でも登録できる公開サービスとして提供する」、観点は規模だけ)まで、どの回も「推測」になった。規模を数えるのを**制約の行に限る**。

```python
# app/documents/requirements/assemble.py
_NOT_GROUNDING: frozenset[str] = frozenset({"scale"})
_SCALE_GROUNDS_KINDS: frozenset[str] = frozenset({"CON"})

def cap_source(source, points, states, *, kind: str = "") -> RequirementSource:
    ...
    excluded = frozenset() if kind in _SCALE_GROUNDS_KINDS else _NOT_GROUNDING
```

`build_model` が要件の行の種別を渡す。1.2(利用者と使う場面)の呼び出しは種別を渡さないので、従来どおり規模を数えない。

### 3. `API_BODY_MISSING` の誤検知

検証はもともと「POST・PUT・PATCH で本文の欄が空」だけを警告していた。誤検知の原因は、AI が本文の要らない POST(`/generate` など)の欄を空にしていたこと。検証は変えず、本文の要らないものには `NO_BODY`(「なし」)を書かせる。

```python
# app/documents/external_design/drafting.py(GeneratedApi.body の説明)
f"書き、本文の要らないもの(生成の開始など)は`{NO_BODY}`と書く。GET・DELETE は空"
```

### 4. 見出しの記号の重なり

簡易の手順書の index で `### ### 1.` と出たのは、index が写した**実装計画書の本文**に LLM がそう書いていたため(index の組み立ての誤りではない)。自由記述の文書(内部設計書・実装計画書)を生成した時点で直す。

```python
# app/services/doc_generator_service.py
_DOUBLED_HEADING = re.compile(r"^(#{1,6})(?:[ \t]+#{1,6})+(?=[ \t])", re.MULTILINE)

def _collapse_doubled_headings(markdown: str) -> str:
    return _DOUBLED_HEADING.sub(r"\1", markdown)
```

## 設計判断

### 規模を数えるのは制約の行だけ

案は「根拠の観点が規模だけのときに数える」と「制約の行なら数える」の2つ。前者では、AI が機能・非機能の要件に規模だけを付けたときにも上限が上がり、Phase 36 の懸念(規模はどの要件にも付けられる)が戻る。規模そのもの(公開か社内か、誰が使うか)を述べるのは制約なので、種別で絞った。規模は Phase 39 から利用者の発言からしか決まらない(`confirm_in_chat`)ので、カードで選べば「採用」、自分の言葉で答えれば「ユーザー」になる。

### 「なし」は検証でなく生成で

検証を緩める案(本文の要らない API を推し量って警告しない)は、何が本文の要らない API かをコードが知らないので取れない。AI に「なし」と明示させれば、空欄(書き忘れ)と区別でき、検証の意味(書き忘れの指摘)は保てる。

### 見出しは生成の時点で直す

index の側で直すと、実装計画書のプレビュー・ダウンロードには重なったまま残る。生成の時点で直せば、どこに写しても同じ。既存の文書は再生成で直る([`OPERATIONS.md`](../../devex-api/OPERATIONS.md) 10.3節に記載)。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `cap_source` | pytest(`test_requirements_doc.py`) | スタブ不要 ── 対象が純粋(副作用なし)で、LLM・DB を呼ばないため | 規模が採用なら制約は採用、非機能は推測、規模が未決なら制約も推測。既存の「規模だけでは上げない」(種別なし)も通る |
| `validate_external_design` | pytest(`test_external_design_doc.py`) | スタブ不要 ── 同上 | 本文「なし」の POST は警告せず、空欄の PUT だけを警告する |
| `ChatService.stream_reply`(`_ensure_question`) | pytest(`test_chat_service.py`) | LLM は決まった返信を返すスタブ(`_RecordingLLM`)、DB はインメモリ SQLite | 「〜教えてください。」で終わる返信はそのまま。「設計を進めます。」には問いを足す(既存) |
| `_collapse_doubled_headings` | pytest(`test_doc_generator_service.py`) | スタブ不要 ── 純粋関数 | `### ### 1.` → `### 1.`、`## ### 2.` → `## 2.`。本文の `#12`・`#タグ` は変えない |

`model.py`・`drafting.py`・`__init__.py` は `test_external_design_doc.py`(`NO_BODY` を `app.documents.external_design` から import)と既存の `test_doc_generator_service.py`(`ExternalDesignGenerationOutput`)が import する(#15)。

```sh
cd devex-api/backend && uv run pytest tests/unit/test_requirements_doc.py tests/unit/test_external_design_doc.py tests/unit/test_chat_service.py tests/unit/test_doc_generator_service.py
```
