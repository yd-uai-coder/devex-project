# Phase-31-1: WBS の書式と解析(BE・純粋関数)

## この章の目的

簡易ドキュメントモードには段階7が無いので、実装手順書の作業単位を実装計画書の WBS から取る。この章では2つのことをする。

- 実装計画書のプロンプトを変え、4.2 の WBS を、段階7と同じ縦割りで ID 付きの決まった書式で書かせる。
- その書式を段階7と同じ `PlanModel` に決定的に読み替える純粋関数 `parse_wbs` を作る。

AI で単位を抽出しないのは、文書に書かれた ID と手順書の ID を必ず一致させるためである(着手時の決定3)。

自動実装モード: on([introduction](./Phase-31-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/detailed_design/procedure_doc.py`](../samples/backend/app/detailed_design/procedure_doc.py) | 更新 | `DesignDocument`(4文書の種類。簡易モードの指摘の直す先)・`DESIGN_DOCUMENT_LABELS` |
| [`app/detailed_design/simple_procedure/wbs.py`](../samples/backend/app/detailed_design/simple_procedure/wbs.py) | 新規 | `parse_wbs`・`WbsParse`・`WbsIssue`・`WBS_SECTION`・`ENVIRONMENT_SECTION` |
| [`app/detailed_design/simple_procedure/__init__.py`](../samples/backend/app/detailed_design/simple_procedure/__init__.py) | 新規 | パッケージ。この章では `wbs` の名前だけを re-export する(31-2 で足す) |
| [`app/services/doc_generator_service.py`](../samples/backend/app/services/doc_generator_service.py) | 更新 | 実装計画書のプロンプトの 4.1・4.2(縦割り・ID 付きの決まった書式と例) |
| [`app/ai/llm/fake.py`](../samples/backend/app/ai/llm/fake.py) | 更新 | E2E 用の偽 LLM。内部設計書に API 一覧・モジュール一覧・3.4節を足し、実装計画書を新しい書式で返す |
| ── ここからテスト ── | | |
| [`tests/fixtures/simple_procedure.py`](../samples/backend/tests/fixtures/simple_procedure.py) | 新規 | `PLAN_MD`(書式どおりの実装計画書)・`OLD_PLAN_MD`(番号の無い旧形式)。31-2〜31-4 で足す |
| [`tests/unit/test_simple_wbs.py`](../samples/backend/tests/unit/test_simple_wbs.py) | 新規 | 書式どおりの WBS・旧形式・節が無い・ID の食い違い・読めない行・Won't |
| [`tests/unit/test_doc_generator_service.py`](../samples/backend/tests/unit/test_doc_generator_service.py) | 更新 | プロンプトが縦割り・ID 付きの書式を指示すること(番号を付けない指示を消したこと) |
| [`tests/unit/test_fake_llm_e2e.py`](../samples/backend/tests/unit/test_fake_llm_e2e.py) | 更新 | 偽の実装計画書を、指摘0件で単位として読めること |

BE のパスは `devex-api/backend/` 基準。

## 要点の抜粋

WBS の書式(プロンプトで指示し、例も見せる):

```md
### M-01: 予約の登録 ── 【Must】
- ゴール: 備品を予約して一覧で確かめられる
- [ ] M-01-T01 [基盤] 開発環境とDBを用意する
  - 処理: なし
  - 依存: なし
  - モジュール: backend/app/main.py
  - 環境・設定: docker-compose.yml
- [ ] M-01-T02 [機能] 予約を登録する
  - 処理: DF-1
  - 依存: M-01-T01
  - モジュール: backend/app/api/reservations.py, backend/app/services/reservation.py
  - 環境・設定: なし
```

```python
# app/detailed_design/simple_procedure/wbs.py
@dataclass(frozen=True)
class WbsIssue:
    code: str                    # WBS_MISSING / WBS_FORMAT / WBS_ID_MISMATCH
    message: str
    level: FindingLevel
    fix_document: DesignDocument = "implementation_plan"
    target: str | None = None
    unit: str | None = None      # 指摘の出た単位の(導いた)ID

@dataclass(frozen=True)
class WbsParse:
    plan: PlanModel              # 段階7と同じ形(横断事項・リスクは持たない)
    issues: tuple[WbsIssue, ...] = ()

def parse_wbs(markdown: str) -> WbsParse   # 4.2 → PlanModel。開発環境は 4.3 の本文
```

```python
# app/detailed_design/simple_procedure/__init__.py(この章の時点)
from app.detailed_design.simple_procedure.wbs import (
    ENVIRONMENT_SECTION, WBS_SECTION, WbsIssue, WbsParse, parse_wbs,
)
```

依存の向き: `wbs` → `plan`(`PlanModel`・`task_id`)・`procedure_doc`(`DesignDocument`・`FindingLevel`)・`uml.generation.sections.extract_section`。

## 設計判断

### 決まった書式を決定的に読む(着手時の決定3)

ほかの案は、実装計画書を構造化出力で生成する案と、段階8を開くときに AI で単位を抽出する案だった。構造化出力は4文書の生成の仕組み(Markdown の版)を大きく変える。AI で抽出すると、文書の ID と手順書の ID がずれうる。プロンプトで書式を固定し、純粋関数で読むのが変更の小さい案だった。書式の崩れは指摘にして、実装計画書の再生成で直す。

### ID は並び順から導き、書かれた ID は突き合わせるだけ

段階7と同じく、ID は並び順から導く(`task_id`)。LLM が書いた ID が導いた ID と違えば `WBS_ID_MISMATCH`(軽微)にして、導いた ID で読む。依存先は、書かれた ID から導いた ID に読み替える。こうすると、番号の飛び・重複があっても依存がずれない。ゴール3後の調整で「番号を付けない」にした理由(LLM の番号は区分をまたいで重複した)には、この形で答えた。

### 単位が1つも読めなければ `WBS_MISSING` だけを返す

この書式より前に生成した計画書は、番号の無いチェックボックスの行ばかりである。行ごとに `WBS_FORMAT` を出すと指摘が並ぶだけになる。単位が0件なら最重要の `WBS_MISSING`(旧形式なら「古い形式です。再生成してください」)だけを返す。この扱いは 31-3 の検証を書いたときに決めた(31-1 で作ったファイルを 31-3 で直した。samples ではタグで区別している)。

### 表記の揺れは許し、読めない行は捨てて指摘する

全角のコロン・太字(`**M-01**`)・`──` と `--` は許す。見出しの前のタスク・ID や `[機能]/[基盤]` の無いタスク行・優先度の無い見出し(Must とみなす)は `WBS_FORMAT`(中程度)。Won't のマイルストーンは読み飛ばし、軽微の指摘にする。

### 偽 LLM の文書も新しい書式に

E2E は偽 LLM で4文書を生成する。手順書の画面が作業単位を出せるように、偽の実装計画書を新しい書式にし、内部設計書にモジュール一覧・API 一覧・3.4節を足した。E2E の「E2E Fake」の表示の確認が崩れないように、見出しの「(E2E Fake)」は1か所だけにしている。

## テスト観点

用語: SUT = テスト対象、ドライバ = テストを呼び出す側、スタブ = SUT の依存を差し替える偽物。

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `parse_wbs` | pytest(`test_simple_wbs.py`) | スタブ不要 ── 実装計画書の Markdown の文字列だけから決まり、DB や LLM を呼ばないため | 第一テスト(統合スモーク): 書式どおりの WBS は指摘0件で、マイルストーン(名前・優先度・ゴール)・単位の ID・種別・処理・依存・モジュール(`` ` `` を外す)・環境・設定・開発環境を読む。旧形式は `WBS_MISSING` だけ。節が無い。ID の食い違い(依存の読み替え)。読めない行4種。Won't |
| `_DOC_TYPE_PROMPTS["implementation_plan"]` | pytest(`test_doc_generator_service.py`) | スタブ不要 ── プロンプトの文字列を読むだけ | 見出し・タスク行・4つの欄の書式を指示し、「番号を付けない」を含まない |
| `E2eFakeLLM`(実装計画書の応答)と `parse_wbs` | pytest(`test_fake_llm_e2e.py`) | スタブ不要 ── 偽 LLM 自体がテスト用の決定的な実装 | 偽の実装計画書が指摘0件で `M-01-T01`・`M-01-T02` に読める |
