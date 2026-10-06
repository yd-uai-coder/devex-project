# Phase-19-2: 段階4の下書きのプロンプトと出力スキーマ(BE)

## この章の目的

段階4の AI の下書きの入出力を作る。1回の生成で、構成図(パッケージ単位・層のレーン)→ その構成図のパッケージをファイルに分けたモジュール一覧、の順に2回 LLM を呼ぶ。この章はメッセージの組み立てと出力の変換だけで、LLM は呼ばない(呼び出しは 19-3)。

- 構成図は、ステージ3の出力スキーマ(`ComponentGenerationOutput`)と写像(`to_component`)をそのまま使い、プロンプトだけ段階4専用にする。
- モジュール一覧には、先に作った構成図の要素と層・CRUD 図・ER のテーブル・機能一覧を渡す。
- E2E 用の偽 LLM に、段階4のモジュール一覧の固定の出力を足す。

自動実装モード: on([introduction](./Phase-19-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/detailed_design/prompt_rules.py`](../samples/backend/app/detailed_design/prompt_rules.py) | 新規(画面確認後) | **コア** | `NAMING_RULES`(段階の下書きに共通の表記の規則) |
| [`app/detailed_design/drafting.py`](../samples/backend/app/detailed_design/drafting.py)・[`data_flow_drafting.py`](../samples/backend/app/detailed_design/data_flow_drafting.py)・[`data_model_drafting.py`](../samples/backend/app/detailed_design/data_model_drafting.py) | 更新(画面確認後) | 定型 | 段階1〜3の system プロンプトの末尾に `NAMING_RULES` |
| [`app/detailed_design/structure_drafting.py`](../samples/backend/app/detailed_design/structure_drafting.py) | 新規 | **コア** | `COMPONENT_SYSTEM_PROMPT`・`MODULE_SYSTEM_PROMPT`、`GeneratedModuleRow`・`ModuleListGenerationOutput`、`build_component_messages`・`build_module_messages`・`to_module_drafts`(純粋) |
| [`app/ai/llm/fake.py`](../samples/backend/app/ai/llm/fake.py) | 更新 | 定型 | E2E 用の偽 LLM に、段階4のモジュール一覧(既存の構成図の層 api・service にそろえた3行) |
| ── ここからテスト ── | | | |
| [`tests/unit/test_structure_drafting.py`](../samples/backend/tests/unit/test_structure_drafting.py) | 新規 | 定型 | 偽 LLM の出力で構成図 → モジュール一覧 → 検証が通ること、メッセージに入力が載ること、出力の変換 |

## 要点の抜粋

```python
# app/detailed_design/structure_drafting.py
MAX_COMPONENTS = 15                          # 構成図の箱の数の目安(パッケージ単位の俯瞰図にする)

class GeneratedModuleRow(BaseModel):         # AI が書くモジュール一覧の1行
    path: str                                # 似たファイルは {a,b}.py・* でまとめてよい
    layer: str                               # 【構成図】の層の名前から1つ選ぶ
    responsibility: str
    depends_on: list[str]
    functions: list[str]                     # 処理ID。全処理が通るモジュールは空
    all_functions: bool

class ModuleListGenerationOutput(BaseModel):
    modules: list[GeneratedModuleRow]

def build_component_messages(requirements, functions, summaries, tables) -> list[BaseMessage]: ...
    # 要件定義(全文。技術スタック)・機能一覧・処理概要表・ER のテーブル名
def build_module_messages(component, requirements, functions, summaries, cells, tables): ...
    # 構成図(パッケージ名・層・責務と依存の向き)・CRUD 図(処理 × テーブル: 操作)を足す
def to_module_drafts(output) -> list[ModuleDraft]: ...
```

依存の向きは `structure_drafting → structure・data_flow・data_model・function_list・uml.domain.component` で、ステージ3の `app/uml/generation`(スキーマ・写像)は呼び出し側(19-3)が使う。

## 設計判断

### 構成図はステージ3の出力スキーマを再利用し、プロンプトだけ変える

ステージ3の component 図の出力(`modules`・`dependencies`、`layer` 必須)は、段階4の構成図にもそのまま合う。スキーマと写像(`to_component`)を再利用し、意味モデル(`ComponentSemanticModel`)・エディタ・自動レイアウトも同じものを使う。

変えるのはプロンプトだけである。ステージ3は「内部設計書の 3.1+3.3 節からモジュール構成を写す」だったが、詳細設計モードには内部設計書が無い。段階4は、要件定義の技術スタックと段階1〜3の成果物から構成を設計させる。

| 規則 | 理由 |
|---|---|
| 箱はパッケージ(ディレクトリ)単位、15個以内 | arc42 の Level 1(俯瞰図)。ファイル単位はモジュール一覧に任せる |
| `layer` は「入口・ユースケース・ドメイン・外部連携・永続化」のような層の名前で、上流から下流の順に現れるように並べる | 自動レイアウトはレーンを `layer` の初出順に並べる(Phase 9)ので、並べ方で図の左右が決まる |
| 設定・ログ・入出力の型のような定型のパッケージは省く | 出力見本の注記(「core と schemas はほぼ全層から使うので図から省いた」)と同じ |

簡易ドキュメントモードの component 図のプロンプト(`app/uml/generation/prompts.py`)は変えない。

### モジュール一覧には、構成図・CRUD 図・ER を渡す

Phase 18 の申し送り(「関わる処理」「依存先」の入力に CRUD 図と ER)を、AI への入力として回収する。

- 構成図の層の名前を渡し、「その中から選ぶ」と指示する。検証(19-1)は構成図に無い層を警告するので、AI が層を作らないようにする。
- CRUD 図は「`F-01 × reservations: C`」の行で渡す。テーブルを読み書きするリポジトリの「関わる処理」の手がかりになる。決定的な対応付けはしない(着手時の決定2)。
- 全処理が通るモジュールは `all_functions` を true にし、`functions` を空にさせる(出力見本の「全処理」)。

### 偽 LLM の固定の出力

E2E 用の偽 LLM(`app/ai/llm/fake.py`)は、スキーマごとに固定の出力を返す。構成図はステージ3の `ComponentGenerationOutput`(層 api・service)がすでにあるので、それを使う。モジュール一覧は、その層にそろえた3行(`app/main.py` は全処理)を足した。段階1〜3の偽の出力(F-01・F-02・reservations)と組み合わせると、段階4の検証がエラーなしで通る。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `build_component_messages`・`build_module_messages`・`to_module_drafts` | pytest | スタブ不要。純粋関数(副作用なし)で、LLM を呼ばないため(メッセージを組み立て、構造化出力を受け取って変換するだけ) | 第一テストの統合スモーク(偽 LLM の構成図 → `to_component` → 層、偽 LLM のモジュール一覧 → `merge_modules` → 段階4の検証がエラーなし)。入力が無いときの「(ありません)」、構成図の依存の向き・CRUD 図の行がメッセージに載ること |
| 偽 LLM の固定の出力(`fake.py`) | pytest | スタブ不要。固定値を読むだけ | 上の統合スモークで、段階1〜3の偽の出力と食い違わないこと |

## 動作確認(実施済み)

```bash
cd devex-api/backend
uv run pytest tests/unit/test_structure_drafting.py
# 6 passed(画面確認後の修正を含む)
```

## 画面確認後の修正: 下書きの表記の規則(日本語と英語の使い分け)

**報告**: モジュール一覧の責務が英語で書かれた。下書きのプロンプトに表記の指示が無く、AI が入力の英語の識別子(パス・テーブル名)に引きずられたため。

**ユーザーの規則と、Devex への絞り込み**: ユーザーは「日本語表記および命名規則」(設計上の名称・説明は日本語、プログラム上の識別子や技術的な制約がある要素は英語。新規のディレクトリ名・ファイル名も原則は日本語で、互換性に問題があれば英語)を示した。相談で次のように決めた。

| 決めたこと | 内容 | 理由 |
|---|---|---|
| 入れる範囲 | 詳細設計モードの全段階の下書き(段階1〜4。段階5〜7も同じ規則を使う)。簡易ドキュメントモードは変えない | ユーザーの決定。詳細設計モードは段階をまたいで名前で突き合わせるので、表記を全段階でそろえる |
| パス | ファイル・ディレクトリのパスは英語 | 元の規則の「互換性に問題がある場合は英語」を、Python・TypeScript などのパスでは常に当てはまるとみなした(import・ツール・フレームワーク)。パスは段階5の手順の鍵にもなる |
| 名称・説明 | 責務・説明・層の名前・注釈は日本語。英語の識別子を説明の代わりにしない。構成図の箱は「サービス(services)」のように併記 | 設計書として読む人のため |
| 入力の名前 | 処理ID・テーブル名・パス・層の名前・データ項目の名前は変えない | 後の段階が名前で突き合わせる(テーブル名とデータストア、層、パス) |

```python
# app/detailed_design/prompt_rules.py
NAMING_RULES = (
    "\n表記の規則:\n"
    "- 名称・説明・責務・層の名前・注釈は日本語で書く。英語の識別子を説明の代わりに使わない"
    "(必要なら『日本語の名称(識別子)』のように併記する)\n"
    "- ファイル・ディレクトリのパス、テーブル名・列名、クラス名・関数名・変数名などの識別子は、"
    "技術スタックの命名規則に従って英語で書く\n"
    "- フレームワーク・ライブラリ・外部サービス・プロトコルの正式名称と、環境変数・設定キー・"
    "コマンド・パッケージ名は原文のまま書く\n"
    "- 入力にある名前(処理ID・テーブル名・パス・層の名前・データ項目の名前)は変えずにそのまま使う"
)

# 各段階の system プロンプト(drafting.SYSTEM_PROMPT・SUMMARY/DFD・ER/CRUD・COMPONENT/MODULE)
XXX_SYSTEM_PROMPT = ("…規則…" + NAMING_RULES)
```

あわせて `structure_drafting.py` の構成図のプロンプトで name を「日本語の名称(実際に作るディレクトリ)」にし、モジュール一覧の責務を「日本語の1文で」、依存先を「パス(またはそのディレクトリ)」とした。規則を1か所(`prompt_rules.py`)に置いたのは、段階1〜4の7つのプロンプトで同じ文を重複させないためである(#17: 消費者は段階1〜4の全プロンプト)。

テスト(`tests/unit/test_structure_drafting.py`): 段階1〜4の7つの system プロンプトが、すべて `NAMING_RULES` で終わること。各 drafting モジュールを import するので、写経漏れも検知できる。SUT はプロンプトの定数、スタブ不要(定数を読むだけ)。

既存のプロジェクトの下書きは、作り直すと新しい規則で書かれる(保存済みの英語の責務は自動では変わらない)。
