# Phase-30-2: md の組み立て(index・単位の md・AI 向けの版)

## この章の目的

見本([`appendix/implementation-procedure-sample/`](../../appendix/implementation-procedure-sample/README.md))と作成方針の形で、実装手順書の md を3種類組み立てる。`index.md`(概要・前提・単位の一覧・未定義の一覧・完了条件)、単位ごとの人向けの md、AI 向けの版(作成方針17章の形。画面の「AI 向けにコピー」も同じもの)。

自動実装モード: on([introduction](./Phase-30-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/detailed_design/procedure_doc_refs.py`](../samples/backend/app/detailed_design/procedure_doc_refs.py) | 更新 | `ExpandedRef.mermaid`(手順の参照のシーケンス図の Mermaid の本文)。`_expanded` で SVG と Mermaid を同じ図から作る |
| [`app/detailed_design/procedure_output/markdown.py`](../samples/backend/app/detailed_design/procedure_output/markdown.py) | 新規 | `to_index_markdown`・`to_unit_markdown`・`to_ai_markdown`・`ai_warnings`・`file_kind_label`、定数(`PROCEDURE_UNAPPROVED_TEXT`・`UNIT_LIST_HEADERS`・`MODULE_RULE`・`COMPLETION_CRITERIA` など) |
| [`app/detailed_design/procedure_output/__init__.py`](../samples/backend/app/detailed_design/procedure_output/__init__.py) | 更新 | `ai_warnings`・`to_ai_markdown`・`to_index_markdown`・`to_unit_markdown` を re-export |
| ── ここからテスト ── | | |
| [`tests/unit/test_procedure_doc_refs.py`](../samples/backend/tests/unit/test_procedure_doc_refs.py) | 更新 | 手順の参照の `mermaid` が 05 と同じ図、他の参照は None |
| [`tests/unit/test_procedure_markdown.py`](../samples/backend/tests/unit/test_procedure_markdown.py) | 新規 | index の5節・単位の一覧のリンク・未定義の表・未承認・単位の md・AI 向けの版の順と展開・警告 |

## 要点の抜粋

```python
# app/detailed_design/procedure_output/markdown.py
def to_index_markdown(source) -> str      # 段階8が approved でなければ「未承認」とだけ
def to_unit_markdown(source, unit_id) -> str   # 参照は見出し(ID)だけ + 手順のシーケンス図(Mermaid)
def to_ai_markdown(source, unit_id) -> str     # 警告 → 依頼文 → 概要 → 実装ルール → 単位 → ファイル
                                               # → 参照する設計(展開) → テスト観点 → 完了条件 → 未定義 → 制約
def ai_warnings(source, findings) -> list[str] # 未承認 / 古い / 未定義が N 件(最重要 M 件)
```

```python
# app/detailed_design/procedure_doc_refs.py
@dataclass(frozen=True)
class ExpandedRef:
    ...
    svg: str | None = None
    mermaid: str | None = None   # 追記(30-2)
```

`markdown.py` の import 先: `document.markdown.md_table`・`document.views.UNIT_KIND_LABELS`(Phase 26)、`procedure_doc_refs`(Phase 28・この章の `mermaid`)、`procedure_output.source`(30-1)。

## 設計判断

### 人向けは ID だけ、AI 向けは展開する(作成方針の原則7・15章)

単位の md は「手順書は設計を書き写さない」のとおり、参照する設計を見出し(`段階5 F-01 …`・`段階6 L-01 …`・`段階4 \`…\``)だけで書く。AI 向けの版は、同じ手順書の中身に、参照の展開(`unit_context` の `markdown`。画面の単位の詳細・生成の入力と同じもの)を添える。中身を変えず整形だけを変える(作成方針15章「AI 向けの出力は手順書の1単位を整形したもの」)。

シーケンス図は人向けにも載せた(見本と同じ)。図は手順の表から導く別の見え方で、書き写しにはならない。そのため参照の展開に Mermaid の本文だけを持たせ(`ExpandedRef.mermaid`)、展開した md から図を切り出す処理を書かずに済むようにした(#17: 消費者はこの章の単位の md)。

### 実装ルールは決定的に組み立てる

見本の「実装ルール」は Claude が手で要約したものだった。本実装では AI を使わず、段階4から「モジュールは段階4の依存先にだけ依存する」の1文、07章の各項目(項目: 方針)、段階7の開発環境を並べる。AI 向けの版では、07章の表と開発環境を参照の展開と同じ md(`crosscutting_section`・`environment_section`)で入れる。

### 警告は止めない

AI 向けの版は、段階8が未承認・古い、またはその単位に未定義が残るときに先頭で警告する(作成方針15章)。渡すことは止めない。zip は承認済みのときしか単位の md を作らないので、zip の AI 向けの版に出る警告は未定義の件数だけになる。

### 完了条件は全単位に共通の定数

作成方針12章の共通の完了条件を定数にした。index はチェックボックスで「未定義がすべて決まり設計に反映されている」まで、AI 向けの版は実装者が確かめられるもの(テスト・lint・マイグレーション・確認方法)だけを載せる。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `to_index_markdown`・`to_unit_markdown`・`to_ai_markdown`・`ai_warnings` | pytest(`test_procedure_markdown.py`) | スタブ不要 ── `ProcedureOutputSource`(fixture の `sample_procedure_source`)だけから決まる純粋関数のため | 第一テスト(統合スモーク): index が5節。手順書のある単位だけをリンクにし、無い単位は「(未生成)」。全体と単位ごとの未定義の表。未承認・古いときは「未承認」の1行だけ。単位の md は手順の表を書き写さず図を添える。AI 向けの版は17章の順で、手順の展開が 05 と同じ表(`procedure_table`)。手順書の無い単位は `KeyError` |
| `unit_context`(`ExpandedRef.mermaid`) | pytest(`test_procedure_doc_refs.py`) | スタブ不要 ── 入力の段階の内容だけから決まる純粋関数のため | 手順の参照の `mermaid` が `to_mermaid(to_sequence(procedure))` と同じ、関数・モジュールの参照は None |
