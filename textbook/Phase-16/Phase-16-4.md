# Phase-16-4: 段階1の下書きの生成(BE)

## この章の目的

外部設計書から、段階1(機能一覧)の下書きを AI に作らせる。生成は文書・UML 図と同じく、受け付け(リクエストの中)と実行(バックグラウンド)に分ける。失敗の理由を段階に残し、止まった生成は15分で回収する。

自動実装モード: on([introduction](./Phase-16-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/detailed_design/drafting.py`](../samples/backend/app/detailed_design/drafting.py) | 新規 | **コア** | 構造化出力のスキーマ(`FunctionListGenerationOutput`)、プロンプト、`to_drafts`(純粋) |
| [`app/services/errors.py`](../samples/backend/app/services/errors.py) | 更新 | 定型 | `DESIGN_STAGE_GENERATION_NOT_SUPPORTED` |
| [`app/detailed_design/stages.py`](../samples/backend/app/detailed_design/stages.py) | 更新 | **コア** | 保存する状態に `regenerated`(再生成済・未承認)、承認できる状態にも含める |
| [`app/models/design_stage.py`](../samples/backend/app/models/design_stage.py) | 更新 | 定型 | `status` の値のコメント |
| [`app/services/design_stage_service.py`](../samples/backend/app/services/design_stage_service.py) | 更新 | **コア** | `current_fingerprint`(生成した時点の入力の版) |
| [`app/services/design_stage_generation_service.py`](../samples/backend/app/services/design_stage_generation_service.py) | 新規 | **コア** | `generate_function_list`、`STAGE_GENERATORS`、`DesignStageGenerationService`(`request_generation`・`execute`・`recover_stale`)、`run_design_stage_generation` |
| [`app/api/routes/design_stages.py`](../samples/backend/app/api/routes/design_stages.py) | 更新 | 定型 | `POST /{stage}/generate`(202)、一覧の取得で回収 |
| [`app/ai/llm/fake.py`](../samples/backend/app/ai/llm/fake.py) | 更新 | **コア** | E2E 用の偽 LLM の段階1の下書き |
| ── ここからテスト ── | | | |
| [`tests/unit/test_design_stage_generation.py`](../samples/backend/tests/unit/test_design_stage_generation.py) | 新規 | **コア** | 受け付け → 実行、再生成での ID の引き継ぎと「再生成済」、作り直しで「古い」が消え入力の変化で戻ること、失敗の理由、断る条件、回収、偽 LLM の下書きが検証を通る |
| [`tests/unit/test_detailed_design_stages.py`](../samples/backend/tests/unit/test_detailed_design_stages.py) | 更新 | 定型 | `regenerated` の状態の導出と、承認できること |

## 要点の抜粋

```python
# app/detailed_design/drafting.py
class GeneratedFunction(BaseModel):          # AI が書くのは列挙だけ(処理ID・機能グループの初期値は書かない)
    name: str
    kind: Literal["API", "API+バッチ", "バッチ", "その他"]
    trigger: str                             # 『POST /api/v1/projects』の形
    screens: list[str]
    summary: str
    group_hint: str = ""                     # API でない処理だけ、機能グループの提案
```

```python
# app/services/design_stage_generation_service.py
async def generate_function_list(llm, sources, previous) -> dict:
    messages = build_function_list_messages(sources.documents.get("external_design", ""))
    output = await invoke_with_retry(_call, messages=messages)          # 構造化出力(include_raw)
    previous_model = FunctionListModel.model_validate(previous) if previous else None
    return merge_draft(to_drafts(output), previous_model).model_dump(mode="json")

STAGE_GENERATORS: dict[int, StageGenerator] = {1: generate_function_list}

class DesignStageGenerationService:
    async def request_generation(self, project, *, stage) -> DesignStageRead:
        await self.recover_stale(project.id)
        # 断る: 対応していない段階 / 開いていない段階 / 生成中
        row.generation_status = "generating"; row.generation_started_at = now; commit

    async def execute(self, *, project_id, user_id, stage, llm=None) -> None:
        try:
            model = await generator(llm or get_gemini_llm(), sources, row.model)
        except Exception as exc:
            rollback → 行を読み直す → failed + 理由(classify_failure の分類)
        row.model = model
        row.status = "regenerated" if regenerating else "draft"   # 作り直しは「再生成済(未承認)」
        row.input_fingerprint = fingerprint                         # 生成した時点の入力の版
        row.version += 1; completed
```

## 設計判断

### UML 図の生成と同じ形にする

受け付けと実行を分け、経過を行の `generation_status`・`generation_error` に残し、画面は一覧のポーリングで待つ。UML 図の生成(Phase 10)と同じ形である。段階1の生成は1回の LLM 呼び出しで終わるが、再試行込みで数十秒かかることがあり、リクエストの中で待たせない。

- 構造化出力の呼び出し方(`include_raw=True`)と、失敗の分類(`unwrap_structured_result`・`classify_failure`)は、UML 図のものを共有した(#17)。
- 失敗の文言だけは段階用に書いた。UML 図の文言は「設計図」「ER図はテーブルを絞って」と、図を前提にしているため。

### 下書きは draft(作り直しは regenerated)、version を1つ増やす

初めての下書きは `status='draft'`、内容のある段階を作り直したときは `status='regenerated'`(画面の表示は「再生成済(未承認)」)にする。人の保存は `reviewing`(Phase 15 の申し送り)。承認済みの段階を作り直すと、承認はやり直しになる。AI の出力で内容を置き換えた以上、前の承認は今の内容に対するものではないからである(UML 図の再生成と同じ。[Phase-14-5](../Phase-14/Phase-14-5.md) #6)。画面は作り直す前に確認する(16-6)。

### 生成した時点の入力の版を記録する

当初は、承認したときだけ `input_fingerprint` を記録していた(下書きの陳腐化は段階2で判断する予定だった)。ところが画面の確認で、次の問題が見つかった。

1. 段階1を承認する(承認時の外部設計書の版を記録)。
2. 外部設計書を生成し直す(2.6 API一覧を足すため)。段階1は「古い」になる。
3. 段階1の下書きを作り直す。内容は新しい外部設計書から作られたのに、承認時の記録が残っているので、`derive_states` は「古い」を返し続ける。

そこで、生成の完了時に、生成した時点の入力の版を記録するようにした(`DesignStageService.current_fingerprint`。承認時と同じ規則)。作り直した直後は「古い」が消え、その後に入力が変わればまた「古い」になる。下書きの陳腐化も、これで扱えるようになった。承認は従来どおり記録を上書きし、人の保存は記録を変えない。

あわせて、保存する状態に `regenerated` を足した(`app/detailed_design/stages.py`。Phase 15 のファイルなので `# Phase-16-4：更新` のタグを付けた)。承認できる状態にも含める。「下書き」と分けたのは、作り直した段階(以前の内容・承認があった)と、初めての下書きを、ステッパーの上で見分けられるようにするためである(ユーザーの要望)。

### 失敗したら rollback してから、読み直した行に記録する

生成の途中で例外が出たら、セッションを rollback してから、行を読み直して `failed` と理由を書く。rollback で行のオブジェクトは期限切れになり、そのまま触ると非同期のセッションでは読み込みが走って失敗するためである。テストでも、rollback の後に `project.id` を読むと同じ理由で失敗するので、先に値を取っておく。

### 生成できる段階を辞書で持つ

`STAGE_GENERATORS` に無い段階の生成は 409 `DESIGN_STAGE_GENERATION_NOT_SUPPORTED` にした。段階2以降の生成は、各段階の Phase でこの辞書に足す。今は段階1だけだが、検証(16-2)と同じく「段階番号 → 関数」の形にそろえた。

### 止まった生成を15分で回収する

生成中のまま止まる(プロセスの再起動など)と、その段階の生成・保存・承認が 409 で塞がり続ける。生成の受け付け時と一覧の取得時に、15分を超えた生成を `failed` に戻す。しきい値と判定は Phase 15 の `generation_staleness.is_stale` を共有した([Phase-15-3](../Phase-15/Phase-15-3.md))。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| ルート関数(`generate_design_stage`・`list_design_stages`)+ `execute` | pytest(ルート関数を直接呼ぶ) | `FakeLLM`(構造化出力の代わり) | 第一テストの統合スモーク(受け付け → 実行 → 一覧で生成の状態と指摘を見る)。BackgroundTasks に積まれた関数も確かめる |
| `DesignStageGenerationService` | pytest(インメモリ SQLite) | `FakeLLM`(クォータ超過は `_is_quota_error` を差し替えて再現) | 再生成での ID の引き継ぎと承認のやり直し、失敗の理由、断る3条件、回収 |
| `generate_function_list`・`build_function_list_messages`・`to_drafts` | pytest | `FakeLLM` / スタブ不要(後の2つは純粋) | 外部設計書が入力に入ること、名称が空の行を捨てること |
| `E2eFakeLLM`(段階1の下書き) | pytest | 偽 LLM そのものが対象 | 偽 LLM の外部設計書と照らして、指摘が0件 |

DB はスタブにしない。段階の行の状態の移り変わり(生成中 → 完了・失敗、回収)そのものが検証の対象だからである。

## 動作確認(実施済み)

```bash
cd devex-api/backend
uv run pytest tests/unit/test_design_stage_generation.py tests/unit/test_detailed_design_stages.py
# 21 passed
```
