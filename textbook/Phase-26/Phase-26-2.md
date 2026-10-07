# Phase-26-2: 実装計画の下書きのプロンプト・偽の出力・入力の大きさ(BE)

## この章の目的

段階7の実装計画を AI が下書きするときに、26-1 の単位の形(種別・依存・2つのファイルの欄)で書かせる。プロンプトを層の横割りから機能ごとの縦割りに書き換え、依存先を出力の並び順から導く ID で書かせる。モジュールの欄が検証されるようになったので、入力にモジュールのパスの一覧を足す。E2E 用の偽の出力も新しい形にする。あわせて、Phase 24 からの申し送り「段階7の入力の大きさ」を測る。

自動実装モード: on([introduction](./Phase-26-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/` 基準) | 新規/更新 | 責務 |
| --- | --- | --- |
| [`app/detailed_design/plan_drafting.py`](../samples/backend/app/detailed_design/plan_drafting.py) | 更新 | `GeneratedTask`(`kind`・`function_ids`・`depends_on`・`modules`・`config_files`)、`GeneratedMilestone`(`function_ids` を削除)、`PLAN_SYSTEM_PROMPT`(縦割り・ID・2つの欄)、`build_plan_messages(..., module_paths)`、`to_plan_model` |
| [`app/services/design_stage_generation_service.py`](../samples/backend/app/services/design_stage_generation_service.py) | 更新 | `generate_plan` がモジュールのパスの一覧をプロンプトに渡す |
| [`app/ai/llm/fake.py`](../samples/backend/app/ai/llm/fake.py) | 更新 | E2E の偽の段階7(基盤 M-01-T01 → 機能 M-01-T02(F-01)→ 機能 M-01-T03(F-02)) |
| ── ここからテスト ── | | |
| [`tests/unit/test_plan_drafting.py`](../samples/backend/tests/unit/test_plan_drafting.py) | 更新 | プロンプトの規則・入力の組み立て・偽の出力が検証を通ること |
| [`tests/unit/test_design_stage_plan_generation.py`](../samples/backend/tests/unit/test_design_stage_plan_generation.py) | 更新 | 生成の統合(入力にモジュールのパスの一覧、処理の重複とモジュールの短い書き方を整える) |

## 要点の抜粋

```python
# app/detailed_design/plan_drafting.py
class GeneratedTask(BaseModel):
    kind: UnitKind             # feature = 処理を動くようにする機能の単位、base = 準備・デプロイ
    title: str
    function_ids: list[str]    # feature は原則1つ。base は空
    depends_on: list[str]      # M-01-T01 の形。前にある単位だけ
    modules: list[str]         # 【モジュールのパスの一覧】にあるものだけ
    config_files: list[str]    # Dockerfile・docker-compose.yml・CI の設定など

PLAN_SYSTEM_PROMPT = (
    "...タスクは実装の作業単位で、層で横に分けず、機能ごとに縦に切る。処理を動くようにするタスクは"
    "kind=feature にし、その処理のバックエンド・フロントエンド・テストを1つのタスクにまとめる。"
    "1つのタスクの処理は原則1つ...準備とデプロイは kind=base..."
    "...タスクの ID は、出力の並び順から M-<2桁>-T<2桁> と決まる(1つ目のマイルストーンの2つ目の"
    "タスクは M-01-T02)。depends_on には...自分より前に並ぶタスクだけ..."
)

def build_plan_messages(requirements, design_markdown, crosscutting, functions, module_paths):
    # 「## モジュールのパスの一覧」を、処理ID の一覧の後に足す
```

## 設計判断

### 依存先は「出力の並び順から導く ID」で書かせる

単位の ID は保存しないので(26-1)、AI が出力する時点では ID はまだ無い。依存先を書かせる方法を比べた。

| 案 | 採否 | 理由 |
|---|---|---|
| 並び順から導く ID の規則をプロンプトで教え、その ID で書かせる | **採用** | 保存の形と同じ ID で受け取れる。間違えれば検証(`UNKNOWN_DEPENDENCY`・`FORWARD_DEPENDENCY`)で見える |
| タスクの名前で書かせ、`normalize_plan` で ID に解決する | 不採用 | 名前の揺れで解決できないことがある。解決の規則が1つ増える |

規則には例(`M-01-T02`)を添え、「後ろのタスクに依存するときは並び順を入れ替える」と書いた。実際の LLM での再生成は、ユーザーの画面確認で OK だった([introduction](./Phase-26-introduction.md)「未消化の申し送り」)。

### モジュールのパスの一覧を別に渡す

詳細設計書の md(04章)にもモジュール一覧はあるが、処理ID の一覧と同じく、選べる値を箇条で別に渡す。モジュールの欄は検証される(`UNKNOWN_MODULE` はエラー)ので、AI が一覧に無いパスを書く余地を減らす。一覧に無いもの(`Dockerfile` など)は `config_files` に書かせる。

## 段階7の入力の大きさ(計測)

Phase 24 からの申し送り。ゴール3で Devex 自身を題材に生成したもの([`appendix/goal3-generated/detailed/`](../../appendix/goal3-generated/README.md)。11処理・12モジュール・旧形式で4マイルストーン17タスク)を入力に、`build_crosscutting_messages`・`build_plan_messages` のメッセージの文字数を数えた(LLM は呼ばない。スクリプトはリポジトリに残していない)。

| 入力 | 文字数 |
|---|---|
| 要件定義書 | 3,621 |
| 外部設計書 | 4,306 |
| 詳細設計書の md(01〜06章) | 8,399 |
| 横断事項の下書きの入力(合計) | 約1.7万 |
| 実装計画の下書きの入力(合計) | 約1.5万 |

どちらもモデルの入力の上限に対して小さく、段階7の入力を絞り込む必要は無い。段階8の手順書の生成は、単位ごとに参照する箇所だけを渡す方針のまま([25-1](../Phase-25/Phase-25-1.md) 決定10)。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `build_crosscutting_messages`・`build_plan_messages`・`to_crosscutting`・`to_plan_model` | pytest | スタブ不要。純粋(LLM を呼ばない) | 第一テストの統合スモーク。プロンプトが縦割り・ID・2つの欄を指示すること。モジュールのパスの一覧と、空のときの「(ありません)」 |
| `fake.py` の偽の段階7 | pytest | スタブ不要。同上 | 偽の出力を整えると、段階7の検証が指摘なしで通る(E2E が段階7を承認できる) |
| `generate_plan`・`STAGE_GENERATORS[7]` | pytest + インメモリ SQLite | FakeLLM(構造化出力を順に返す)。プロンプトの組み立ては spy で包んで中身を確かめる | 入力にモジュールのパスの一覧が入る。処理の重複を除き、モジュールの短い書き方をパスにそろえる。そのまま承認できる |

## 動作確認(実施済み)

```bash
cd devex-api/backend
uv run pytest tests/unit/test_plan_drafting.py tests/unit/test_design_stage_plan_generation.py
# 8 passed
```
