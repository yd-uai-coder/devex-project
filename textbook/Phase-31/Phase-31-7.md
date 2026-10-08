# Phase-31-7: 完了後の調整 ── 簡易モードの参照の粒度と、段階1〜7の表示

## この章の目的

Phase 31 の後、開発環境の簡易モードのプロジェクト(「トレンドをサーチして記事にするシステム」)で段階8を試した。そこで2つの問題が出た。どちらも、詳細設計モードと同じ粒度で内部設計書を照合していたことが原因である。簡易モードの文書の粒度に合わせて、参照とチェックを直す。

1. **AI が「テーブル定義やモデルの構造が記載されていないため、具体的なテーブル設計を定義する必要がある」と指摘した**(M-01-T02)。内部設計書 3.2 には、テーブルの定義がある。
2. **「モジュール「○○」が、内部設計書のモジュール一覧にありません」が多数出た**。簡易モードではモジュール一覧を細かく作らないので、一致しなくて当然である。

あわせて、画面も直す(ユーザーの追加の指示)。簡易モードのステッパーは段階8だけを並べていたので、「8.」から始まって見た目が悪い。段階1〜7を、使えない行として並べる。

自動実装モード: on([introduction](./Phase-31-introduction.md) 参照)。

## 原因(実データで確かめたこと)

開発 DB の内部設計書・実装計画書・段階8の model を読み出して確かめた。

- **テーブル**: M-01-T02 はモデルを作る基盤の単位で、処理(DF)を持たない。参照に入るのは DF に添えるテーブルだけなので、テーブルが1つも入らない。さらに、DF に添えるテーブルの照合が、流れの表の元・先のセルとテーブル名の**完全一致**だった。実際のセルは「データベース (`trends`, `trend_sources` テーブル)」の形なので、どの DF にもテーブルが添わっていなかった。
- **モジュール**: 簡易モードの内部設計書のモジュール一覧は、層ごとにまとめた行(`app/routers/*.py`・層「ルーター」など)だった。WBS のファイル(`backend/app/routers/trends.py`)とは完全一致しない。

## ユーザーの決定

- テーブルは2つの経路で参照させる。
  - DF の本文に名前の出るテーブルを拾って添える。
  - DF を持たない単位には、3.2 のデータモデル全体を添える。
- モジュールは層まで照合する。どの層にも当たらないファイル(`backend/Dockerfile`・`main.py`・`app/core/config.py` など)は警告しない。
- 詳細設計モードの機能には影響させない。
- 簡易モードのステッパーは、段階1〜7をダミーの行として置き、詳細設計モード用で使えない旨を示す。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/detailed_design/procedure_doc.py`](../samples/backend/app/detailed_design/procedure_doc.py) | 更新 | `DesignRefKind` に `datamodel` |
| [`app/detailed_design/simple_procedure/internal_design.py`](../samples/backend/app/detailed_design/simple_procedure/internal_design.py) | 更新 | `DataFlow.tables`(本文に名前の出るテーブル。`nodes` を置き換えた)・`SimpleDesignBook.data_model`(3.2 の本文)・テーブルの見出しの説明を除く・`module_layer`(層の照合) |
| [`app/detailed_design/simple_procedure/refs.py`](../samples/backend/app/detailed_design/simple_procedure/refs.py) | 更新 | DF の無い単位に `datamodel` の参照、モジュールは層の決まるものだけ、層の行で展開 |
| [`app/detailed_design/simple_procedure/__init__.py`](../samples/backend/app/detailed_design/simple_procedure/__init__.py) | 更新 | `module_layer` を re-export |
| [`app/detailed_design/validation.py`](../samples/backend/app/detailed_design/validation.py) | 更新 | 簡易モードの分岐から `UNKNOWN_MODULE`・`MODULE_NOT_FILE`・`UNKNOWN_FILE` を除いた(`_simple_module_issues`・`_simple_file_issues` を削除)。詳細設計モードの分岐は変えない |
| [`app/schemas/design_stage.py`](../samples/backend/app/schemas/design_stage.py) | 更新 | `DesignRefRead.kind` に `datamodel` |
| [`src/features/detailed-design/api/types.ts`](../samples/frontend/src/features/detailed-design/api/types.ts) | 更新 | `DesignRefRead.kind` に `datamodel` |
| [`src/features/detailed-design/components/StageStepper.tsx`](../samples/frontend/src/features/detailed-design/components/StageStepper.tsx) | 更新 | 簡易モードは段階1〜7を「詳細設計モードのみ」の押せない行として前に並べ、注記を添える(`DETAILED_ONLY_NOTICE`) |
| ── ここからテスト ── | | |
| [`tests/fixtures/simple_procedure.py`](../samples/backend/tests/fixtures/simple_procedure.py) | 更新 | `LAYERED_INTERNAL_DESIGN_MD`(層ごとのまとめた行と「データベース (`x` テーブル)」形の DF) |
| [`tests/unit/test_simple_internal_design.py`](../samples/backend/tests/unit/test_simple_internal_design.py) | 更新 | DF のテーブルを本文から拾う・`module_layer` |
| [`tests/unit/test_simple_procedure_refs.py`](../samples/backend/tests/unit/test_simple_procedure_refs.py) | 更新 | 層に当たらないファイルを出さない・DF の無い単位の `datamodel`・層の展開 |
| [`tests/unit/test_simple_procedure_validation.py`](../samples/backend/tests/unit/test_simple_procedure_validation.py) | 更新 | モジュール・ファイルを指摘しない(層ごとのまとめた一覧でも) |
| [`src/features/detailed-design/components/__tests__/StageStepper.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/StageStepper.test.tsx) | 更新 | 簡易モードの段階1〜7の行は押せず、段階8は押せる |

## 要点の抜粋

```python
# app/detailed_design/simple_procedure/internal_design.py
@dataclass(frozen=True)
class DataFlow:
    id: str; title: str; markdown: str
    tables: tuple[str, ...] = ()     # 本文に名前の出る 3.2 のテーブル(trends は trend_sources の中では一致させない)

def module_layer(path: str, book: SimpleDesignBook) -> ModuleRow | None:
    # 1. 一覧の行と完全一致 → 2. 行のパターン(* ・ {a,b})がパスの末尾に一致(backend/ などの前置きは見ない)
    # → 3. 行のディレクトリがパスのディレクトリの末尾に一致(同じ層のディレクトリ)
```

```python
# app/detailed_design/simple_procedure/refs.py
def simple_unit_refs(task, book) -> list[DesignRef]:
    refs = [DesignRef("dataflow", key, key in book.dataflows) for key in ...]
    if not refs and book.data_model.strip():
        refs.append(DesignRef("datamodel", "3.2", True))        # DF を持たない単位にデータモデル全体
    refs += [DesignRef("module", path, True) for path in ... if module_layer(path, book) is not None]
```

展開の例(実データ):

```md
- 内部設計書 3.3 `backend/app/routers/categories.py` → 層 `app/routers/*.py`(ルーター): HTTPリクエストの受け付け、… / 依存先: FastAPI, Services
```

## 設計判断

### 詳細設計モードの経路は触らない

変更は `simple_procedure/` と、`validation.py` の簡易モードの分岐(`_simple_*`)だけに閉じた。次のものは変えていない。

- `unit_refs`・`unit_context`
- `validate_procedure_doc` の詳細設計モードの分岐
- `module_ref_matches`・`resolve_callee`

段階8と出力の既存のテストは、変更なしで通る。参照の種類に `datamodel` を足したのは型だけで、詳細設計モードはこの種類を作らない。

### テーブルは本文から拾い、DF の無い単位にはデータモデル全体

表の元・先のセルの書き方は LLM ごとに揺れる(「データベース (`trends` テーブル)」「trends」など)。セルを解析するより、DF の本文に 3.2 のテーブル名が識別子として出るかを見るほうが頑丈である。前後が英数字・`_` でないところだけを一致とするので、`trends` が `trend_sources` の中で一致することは無い。

DF を持たない単位(環境の用意・モデルの作成・共通の例外処理など)は、どのテーブルを使うかを DF から決められない。そこで 3.2 の全体を添える。簡易モードの 3.2 は数テーブルの規模なので、入力の大きさは問題にならないと判断した。

### モジュールは層まで照合し、層に当たらないファイルは指摘しない

簡易モードのモジュール一覧は、層の責務と依存の向きを示すもので、ファイルの一覧ではない。照合の目的を「そのファイルがどの層に属し、どこに依存してよいか」に置き換えた。層の行のパターン(`*`・`{a,b}`)と、同じディレクトリで当てる。

層に当たらないファイル(Dockerfile・設定・一覧に無いディレクトリ)は、簡易モードの粒度では一覧に無くて当然とみなし、指摘しない(ユーザーの決定)。参照にも出さない。設計に無い参照(赤字)として AI に渡すと、AI が「設計に無い」と書くためである。

### ステッパーの段階1〜7は画面だけのダミー

段階1〜7は、サーバーもストアも返さない(簡易モードのプロジェクトは段階8だけを持つ)。ステッパーが、段階の一覧のモードを見て、使えない行を前に足すだけにした。行は押せず(`aria-disabled`・破線・透過)、「詳細設計モードのみ」と添え、上に「段階1〜7は詳細設計モード用です。簡易ドキュメントモードは4文書から段階8(実装手順書)を作ります」と書く。詳細設計モードの表示は変わらない。

## 既存のデータへの効き方

- 検証の指摘は表示のたびに導くので、段階8を開き直すとモジュールの警告は消える。
- AI の「テーブル定義が無い」の指摘は、M-01-T02 の手順書に保存されている。消すには、その単位の手順書を作り直す(今回の参照の展開は、作り直したときの AI の入力に入る)。

実データでは、調整の後の指摘は `FEATURE_WITHOUT_DATAFLOW`(M-06-T01。機能の単位なのに処理が「なし」)の1件だけになった。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `parse_internal_design`(DF のテーブル)・`module_layer` | pytest(`test_simple_internal_design.py`) | スタブ不要 ── 文書の Markdown だけから決まるため | 表の先が「データベース (`reservations` テーブル)」でも拾う、見出しの説明を除く、似た名前の中では一致させない。完全一致・パターン(`*`・`{a,b}`。`backend/` の前置き)・同じディレクトリ・層に当たらない(`Dockerfile`・`app/core`) |
| `simple_unit_refs`・`expand_simple_ref`・`simple_unit_context` | pytest(`test_simple_procedure_refs.py`) | スタブ不要 ── 純粋関数 | 層に当たらないファイルは出さない。DF の無い単位に `datamodel`(ラベルと 3.2 の表)。層の行の展開と、DF のテーブル |
| `validate_procedure_doc`(簡易モード) | pytest(`test_simple_procedure_validation.py`) | スタブ不要 ── 入力は `StageSources` | 計画の不足だけを指摘する。層ごとのまとめた一覧で、層に当たらないファイルがあっても指摘0件 |
| `StageStepper`(簡易モード) | vitest(render と操作) | `onSelect` | 注記・段階1〜7の押せない行(7つ。`aria-disabled`)・押しても選ばない・押せるのは段階8だけ |
