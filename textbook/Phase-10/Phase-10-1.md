# Phase-10-1: 内部設計書プロンプトの改訂と、節の抽出・候補の列挙

## この章の目的

内部設計書の生成プロンプトに「処理別データフロー」節を追加する。あわせて、テーブル定義と処理の見出しを固定形式で書かせる(#12 の改訂。元は Phase-2-4)。そのうえで、固定形式の見出しを手がかりに、内部設計書から「図ごとに AI に渡す節」と「生成対象の候補(DFD の処理・ER のテーブル)」を LLM を呼ばずに取り出す純粋関数を作る。

自動実装モード: on([introduction](./Phase-10-introduction.md) 参照)。

## この章で作成・更新したファイル

写経順序は依存順(#30)。

| ファイル(`devex-api/backend/`基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/services/doc_generator_service.py`](../samples/backend/app/services/doc_generator_service.py) | 更新 | **コア** | 内部設計書プロンプトに固定形式の見出しを追加する。3.2 は `### テーブル: <名前>`。3.3 は `### 処理別データフロー` + `#### DF-<n>: <処理名>` + 元/データ/変換/先の表 + `- データ項目: 名前(フィールド…)` |
| [`app/uml/generation/sections.py`](../samples/backend/app/uml/generation/sections.py) | 新規 | **コア** | `extract_section`・`remove_subsection`・`extract_dfd_subjects`・`extract_er_tables`・`extract_er_table_blocks`(いずれも純粋関数) |
| [`app/uml/generation/__init__.py`](../samples/backend/app/uml/generation/__init__.py) | 新規 | 定型 | 本章の担当分として、`sections` の公開シンボルを re-export する |
| [`app/ai/llm/fake.py`](../samples/backend/app/ai/llm/fake.py) | 更新 | 定型 | E2E 用の内部設計書の応答に、テーブル見出しと DF 見出しを含める |
| ── ここからテスト ── | | | |
| [`tests/fixtures/uml.py`](../samples/backend/tests/fixtures/uml.py) | 新規 | 定型 | 本章の担当分として、固定形式の見出しを持つ内部設計書のサンプル `INTERNAL_DESIGN_MD` を用意する(DF-1〜3、テーブル2件) |
| [`tests/unit/test_uml_generation_sections.py`](../samples/backend/tests/unit/test_uml_generation_sections.py) | 新規 | **コア** | 節の範囲、小節の除去、DF 見出しと本文の範囲、旧形式の文書で空になること、テーブル見出しの抽出 |
| [`tests/unit/test_doc_generator_service.py`](../samples/backend/tests/unit/test_doc_generator_service.py) | 更新 | 定型 | プロンプトが固定形式の見出しを指示していること |
| [`tests/unit/test_fake_llm_e2e.py`](../samples/backend/tests/unit/test_fake_llm_e2e.py) | 更新 | 定型 | E2E 用の内部設計書から候補を列挙できること |

## 要点の抜粋

```python
# app/uml/generation/sections.py
_DFD_SUBJECT_HEADING = re.compile(r"^####\s+(DF-\d+)\s*[:：]\s*(.+?)\s*$", re.MULTILINE)
_ER_TABLE_HEADING = re.compile(r"^###\s+テーブル\s*[:：]\s*`?(.+?)`?\s*$", re.MULTILINE)

@dataclass(frozen=True)
class DfdSubject:
    code: str   # DF-1(表示用。再生成で振り直されうる)
    title: str  # POST /api/v1/reservations(図の識別キー subject になる)
    body: str   # 次の #### 以上の見出しの直前までの本文

def extract_section(markdown: str, number: str) -> str: ...        # "## 3.2" から次の #/## まで
def remove_subsection(section: str, title: str) -> str: ...        # "### 処理別データフロー" を除く
def extract_dfd_subjects(markdown: str) -> list[DfdSubject]: ...
def extract_er_tables(markdown: str) -> list[str]: ...
def extract_er_table_blocks(markdown: str, table_names: list[str]) -> str: ...
```

```python
# app/uml/generation/__init__.py(本章の担当分)
from app.uml.generation.sections import (
    DFD_SECTION_TITLE, DfdSubject, extract_dfd_subjects, extract_er_table_blocks,
    extract_er_tables, extract_section, remove_subsection,
)
```

依存の向きは `app.uml.generation.sections` → 標準ライブラリ(`re`・`dataclasses`)のみ。DB にも LLM にも依存しない。

## 設計判断

### なぜ候補の列挙に LLM を使わず、見出しを正規表現で解析するのか(ユーザー確定事項4)

LLM に「この内部設計書から処理を列挙して」と頼む方法もある。しかし、候補を出すたびに無料枠のクォータを1回消費し、しかも結果が毎回変わりうる。そこで生成プロンプトの側で見出しの形式を固定し、読む側は正規表現で決定的に取り出す。形式を決めた者(プロンプト)と読む者(パーサ)が同じ Devex の中にいるからこそ取れる方法である。

代償として、Phase 10 以前に生成した内部設計書(旧形式)では候補が0件になる。この場合は内部設計書の再生成を促す(Phase 11 の UI の関心事)。

### なぜ DFD の識別キーを `DF-n` ではなく処理名(`title`)にしたか

`DF-n` の番号は、内部設計書を再生成すると振り直されうる。`POST /api/v1/reservations` のような処理名の方が、再生成をまたいでも同じ処理を指し続ける。再生成時の上書き(ユーザー確定事項2)は `(project, notation, subject)` で対象を探すため、キーの安定性がそのまま上書きの正しさになる。

### なぜ節を抽出してから AI に渡すのか(ユーザー確定事項7)

全文を渡すと、図ごとに不要な節のぶんまで入力トークンを消費する。component 図には 3.2 のテーブル定義は要らず、ER 図には 3.3 のモジュール構成は要らない。どの節を渡すかは 10-2 の `build_source_text` が決め、本章はそのための部品(節の抽出と小節の除去)を用意する。

### テーブル見出しの形式も固定した理由

ER の部分図(ユーザー確定事項7)では、ユーザーが対象のテーブルを選ぶ。そのためには、テーブルの一覧を決定的に取り出せる必要がある。従来のプロンプトは「テーブルごとに見出しを立て」とだけ指示しており、見出しの書き方が決まっていなかった。

## テスト観点(#14)

**SUT/ドライバ/スタブ**の用語定義は [Phase-8-1.md](../Phase-8/Phase-8-1.md) を参照。

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `sections.py` の各関数 | pytest(直接呼び出し) | スタブ不要。対象が純粋(文字列を受け取り文字列・リストを返す)で、外部依存を呼ばないため | `test_uml_generation_sections.py`。入力は共有フィクスチャ `INTERNAL_DESIGN_MD` |
| `_DOC_TYPE_PROMPTS["internal_design"]` | pytest | スタブ不要。定数の文言の確認のため | `test_doc_generator_service.py` |
| `E2eFakeLLM` の内部設計書の応答 | pytest | スタブ不要。E2eFakeLLM 自体が、テスト用のスタブ実装を SUT にしているため | `test_fake_llm_e2e.py`。応答をそのまま `extract_*` に通し、候補を取り出せることを確認する |

## 既知の残課題

- 見出しの形式に揺れがあるとき(例: `DF-1：` のような全角コロン)は正規表現で吸収している。ただし、LLM が見出し自体を書き落とした場合の補完はしない。
