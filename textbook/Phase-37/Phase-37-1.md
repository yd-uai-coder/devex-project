# Phase-37-1: 外部設計書の model と純粋関数(BE)

## この章の目的

外部設計書を「意味モデル(model)→ md」の形にするための土台を置く。画面・API・外部連携を行にし、各行に関係する要件ID(Phase 36 の `FR-001` など)を持たせる。画面ID(`SCR-001`)の振り方(前の版の引き継ぎ)、API の行の整え方、md の組み立て、検証を、LLM も DB も呼ばない純粋関数で決める。あわせて、要件定義書と共通になる採番と指摘の型を `app/documents/` に切り出す(#17)。

自動実装モード: on([introduction](./Phase-37-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/documents/ids.py`](../samples/backend/app/documents/ids.py) | 新規 | 行の ID(`FR-001`・`SCR-001`)の形と、前の版を引き継ぐ採番(`carry_over_ids`) |
| [`app/documents/issues.py`](../samples/backend/app/documents/issues.py) | 新規 | 検証の指摘の型(`DocumentIssue`・`IssueLevel`) |
| [`app/documents/requirements/model.py`](../samples/backend/app/documents/requirements/model.py) | 更新 | ID の形を `ids.py` に寄せる(挙動は変えない) |
| [`app/documents/requirements/assemble.py`](../samples/backend/app/documents/requirements/assemble.py) | 更新 | `assign_ids` を `ids.py` の採番で書き直す(挙動は変えない) |
| [`app/documents/requirements/validation.py`](../samples/backend/app/documents/requirements/validation.py) | 更新 | 指摘を `DocumentIssue` に(`RequirementIssue` は無くした) |
| [`app/documents/requirements/__init__.py`](../samples/backend/app/documents/requirements/__init__.py) | 更新 | `IssueLevel`・`RequirementIssue` の re-export を外す |
| [`app/documents/external_design/model.py`](../samples/backend/app/documents/external_design/model.py) | 新規 | `ScreenRow`・`ApiRow`・`IntegrationRow`・`ExternalDesignModel`、画面ID の形 |
| [`app/documents/external_design/assemble.py`](../samples/backend/app/documents/external_design/assemble.py) | 新規 | 下書き → model(画面ID の引き継ぎと API の参照の付け替え・API の整え・要件ID の正規化) |
| [`app/documents/external_design/validation.py`](../samples/backend/app/documents/external_design/validation.py) | 新規 | 行数・要件ごとの画面と API・検証の指摘(警告だけ) |
| [`app/documents/external_design/markdown.py`](../samples/backend/app/documents/external_design/markdown.py) | 新規 | model → md(2.1〜2.6 と付録「要件との対応」) |
| [`app/documents/external_design/__init__.py`](../samples/backend/app/documents/external_design/__init__.py) | 新規 | 上の4つの re-export |
| [`app/models/generated_document.py`](../samples/backend/app/models/generated_document.py) | 更新 | 列 `model` のコメント(外部設計書も持つ)。列は増やさない |
| ── ここからテスト ── | | |
| [`tests/unit/test_external_design_doc.py`](../samples/backend/tests/unit/test_external_design_doc.py) | 新規 | `app/documents/external_design`・`ids`・`issues` の純粋関数 |

BE のパスは `devex-api/backend/` 基準。並びは import の依存順(#30): `validation.py` を `markdown.py` が読む(付録が `covered_by` を使う)ので、`validation.py` を先に置いた。

## 要点の抜粋

```python
# app/documents/ids.py
def seq_id(prefix: str, seq: int) -> str: ...                        # SCR-001
def parse_seq_id(value: str, prefixes) -> tuple[str, int] | None: ...
def initial_next_seq(prefixes, previous_ids, stored) -> dict[str, int]: ...
def carry_over_ids(kinds_and_prev, previous_kinds, next_seq) -> tuple[list[str], dict[str, int]]:
    """prev_id が前の版に在り、種別が同じで、まだ使われていなければ引き継ぐ。それ以外は次の番号。"""
```

```python
# app/documents/external_design/model.py
class ScreenRow(BaseModel):
    id: str               # SCR-001
    name: str
    role: str
    priority: Priority    # 要件定義書の Must / Should / Could / Won't
    req_ids: list[str]
    ui_spec: str          # 2.3 の「### SCR-001: 画面名」の下の本文

class ApiRow(BaseModel):
    method: str; path: str; summary: str
    screens: list[str]    # 画面ID(一覧に無い ID も残し、検証で指摘)
    req_ids: list[str]
    body: str; response: str; errors: str

class ExternalDesignModel(BaseModel):
    overview: str; transition: str; data_io: str          # 本文の節
    screens: list[ScreenRow]; apis: list[ApiRow]; integrations: list[IntegrationRow]
    known_req_ids: list[str]    # 生成した時点の要件定義書の要件ID(検証が読む)
    must_fr_ids: list[str]      # 同じく Must の機能要件ID(検証・付録が読む)
    next_seq: dict[str, int]    # 画面ID の次の番号
```

```python
# app/documents/external_design/assemble.py
def build_model(draft: ExternalDesignDraft, previous: ExternalDesignModel | None,
                requirements: RequirementsModel | None) -> ExternalDesignModel: ...
def split_ids(values) -> list[str]: ...   # 「FR-001・FR-002」を分け、大文字・重複なしに
```

```python
# app/documents/external_design/__init__.py(re-export の形)
from app.documents.external_design.assemble import (ApiDraft, ExternalDesignDraft, IntegrationDraft,
    ScreenDraft, build_model, split_ids)
from app.documents.external_design.markdown import render_external_design
from app.documents.external_design.model import (BODY_METHODS, SCREEN_PREFIX, ApiRow,
    ExternalDesignModel, IntegrationRow, ScreenRow, screen_id)
from app.documents.external_design.validation import covered_by, row_counts, validate_external_design
```

依存の向き: `ids.py`・`issues.py` は何も読まない(葉)。`external_design/model.py` は `ids.py` と要件定義書の `Priority` を読む。`assemble.py` は `model.py`・`ids.py`・要件定義書の model・`app.detailed_design.api_list`(`HTTP_METHODS`・`endpoint_key`、Phase 16)を読む。`validation.py` は `model.py`・`issues.py`、`markdown.py` は `model.py`・`validation.py`・`md_table`(Phase 22-3)を読む。要件定義書側の `model.py`・`assemble.py` は `ids.py`、`validation.py` は `issues.py` を読む。

## 設計判断

### 画面ID は前の版を引き継ぐ(要件ID と同じ考え方)

API の行の「関連画面」と、段階1の機能の「画面」が画面ID で画面を指す。再生成のたびに番号が揺れると、それらが黙って別の画面を指す。そこで AI には仮の画面ID を書かせ(前の版と同じ画面なら前の版の ID)、コードが前の版に在る ID だけを残す。それ以外(前の版に無い ID・2回目の同じ ID)は次の番号に振り直し、消えた番号は使い回さない。要件ID と違って AI に「`prev_id` と別の参照キー」の2つを書かせないのは、API の行が同じ出力の中で画面を指す必要があるため。仮の ID が「参照のキー」と「前の版の ID」を兼ね、振り直したら API の参照も同じ対応表で付け替える。

採番の規則は要件ID と同じなので、`app/documents/ids.py` に切り出して共有した(#17。駆動する消費者は画面ID)。要件定義書の `assign_ids` は同じ関数で書き直し、`test_requirements_doc.py` がそのまま通ることで挙動が変わっていないことを確かめた。

### API の行は、後続が読める形だけを残す

メソッドを大文字にし、知らないメソッド・`/` で始まらないパス・同じ API(`endpoint_key` が同じ。`{id}` と `{item_id}` は同じ)の2行目を捨てる。2.6 の表は段階1(機能一覧の下書きと `MISSING_API`)と簡易モードの段階8が `extract_api_endpoints` で読むので、その関数が読み飛ばす行を model に残しても意味が無い。本文・応答・エラーの欄の「—」「なし」は空にそろえる(検証の「本文が無い」を正しく数えるため)。

### 要件ID は捨てずに残し、検証で指摘する

要件定義書に無い ID(`FR-099`)も model に残す。AI の書き間違いか、要件定義書の不足かは、人が見ないと分からないため。照合の相手は、同じ生成で作った要件定義書の model から写した `known_req_ids`・`must_fr_ids`。Phase 36 の `point_statuses` と同じく生成した時点の写しを持つので、後で要件定義書の「採用にする」が走っても(版も ID も変わらない)、検証が揺れない。写しが空(要件定義書に model が無い)のときは照合しない。

### md の見出しと 2.6 の列名は以前のまま

`# 2. 外部設計書` と 2.1〜2.6 の見出し、2.6 の「メソッド/パス/概要/関連画面」の列名を変えず、後ろに「要件/本文/応答/エラー」を足した。`extract_api_endpoints` は列を見出しの名前で探すので、関数を変えずに今までどおり読める(テストで確かめる)。内部設計書の生成・段階7の下書き・自己診断は md 全体を読むので、列が増えても困らない。2.3 は画面の行の `ui_spec` から `### SCR-001: 画面名` の小見出しで組み立てるので、画面一覧と UI 仕様の画面ID が食い違わない。画面遷移はテキスト図をコードブロックに入れる(AI が囲んでいれば囲み直さない)。末尾の付録「要件との対応」は、Must の機能要件ごとの画面・API を検証と同じ計算(`covered_by`)で出す。

### 検証は警告だけ

中程度: 画面も API も無い Must の機能要件(`MUST_REQUIREMENT_UNCOVERED`)、本文の欄が空の POST・PUT・PATCH(`API_BODY_MISSING`。ベースラインの分類 B「API の本文が無い」を拾う)。軽微: 要件定義書に無い要件ID(`UNKNOWN_REQUIREMENT_ID`)、どの要件にも結ばれていない画面・API(`UNLINKED_ROWS`)、画面一覧に無い画面ID を指す API(`UNKNOWN_SCREEN_REF`)。生成も保存も止めない(ユーザーの選択)。指摘の型は要件定義書と同じ形なので `app/documents/issues.py` の `DocumentIssue` に移した(#17。駆動する消費者は外部設計書の検証)。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `app/documents/external_design`(`model`・`assemble`・`validation`・`markdown`)と `__init__.py` の re-export、`app/documents/ids.py`・`issues.py` | pytest(`test_external_design_doc.py`) | スタブ不要 ── 対象が純粋(副作用なし)で、LLM・DB を呼ばないため。要件定義書の model は `RequirementRow` を直接作って渡す | 第一テスト(統合スモーク): 採番の往復と引き継ぎ(前の版に在る ID だけ・重複・使い回さない番号・渡した辞書を書き換えない)。続けて、`split_ids`、新規の採番と要件ID の写し、画面ID の引き継ぎと API の参照の付け替え、形の違う API・同じ API・空の画面を捨てる、md の見出し・列・UI 仕様の小見出し・画面遷移の囲み・**2.6 を `extract_api_endpoints` が読める**・付録、空の model、検証の各コードと重要度、指摘の無い model、写しが空なら照合しない |
| 要件定義書の `assign_ids`・`validate_requirements`(共通化の後) | pytest(`test_requirements_doc.py`、既存) | スタブ不要(同上) | 共通化で挙動が変わっていないこと(既存の 16 件がそのまま通る。#12 のリファクタの番人) |

```sh
cd devex-api/backend && uv run pytest tests/unit/test_external_design_doc.py tests/unit/test_requirements_doc.py
```
