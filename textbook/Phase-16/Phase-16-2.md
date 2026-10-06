# Phase-16-2: 段階1の意味モデル・処理IDの引き継ぎ・段階ごとの検証(BE)

## この章の目的

段階1(機能一覧)の正本の形を決め、AI の下書きから機能一覧を組み立てる純粋関数と、段階1の検証を作る。

- 処理ID(`F-01`…)は再生成しても変えない。
- 機能グループの初期値は API のパスから決定的に作り、人が確定した値は再生成で上書きしない。
- 段階ごとの検証を登録する仕組み(`STAGE_VALIDATORS`)を作り、段階1を最初に登録する。

自動実装モード: on([introduction](./Phase-16-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-api/backend/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/detailed_design/function_list.py`](../samples/backend/app/detailed_design/function_list.py) | 新規 | **コア** | `FunctionRow`・`FunctionListModel`・`FunctionDraft`、`initial_group`、`merge_draft`(純粋) |
| [`app/detailed_design/validation.py`](../samples/backend/app/detailed_design/validation.py) | 新規 | **コア** | `StageIssue`・`StageSources`、`validate_function_list`、`STAGE_VALIDATORS`、`validate_stage`、`has_errors`(純粋) |
| [`app/detailed_design/__init__.py`](../samples/backend/app/detailed_design/__init__.py) | 更新 | 定型 | 上の2ファイルの公開名の re-export |
| ── ここからテスト ── | | | |
| [`tests/fixtures/detailed_design.py`](../samples/backend/tests/fixtures/detailed_design.py) | 更新 | 定型 | `function_list_model()`(検証を通る最小の機能一覧) |
| [`tests/unit/test_function_list.py`](../samples/backend/tests/unit/test_function_list.py) | 新規 | **コア** | 初期値、採番、再生成での引き継ぎ、検証のエラーと警告 |

## 要点の抜粋

```python
# app/detailed_design/function_list.py
class FunctionListModel(BaseModel):          # design_stages.model(段階1)の形
    groups: list[str]                        # 機能グループの並び
    functions: list[FunctionRow]             # id / name / kind / trigger / screens / group_initial / group / summary
                                             # kind: API / API+バッチ / バッチ / 画面 / その他
    next_number: int = 1                     # 次に振る番号

def initial_group(trigger: str, *, fallback: str = "その他") -> str:
    # /api/v1/projects → projects、/api/v1/projects/{id}/documents/... → documents
    # API でないトリガーは fallback(AI の提案)

def merge_draft(drafts, previous=None) -> FunctionListModel:
    for draft in drafts:
        matched = unclaimed.pop(_match_key(draft.trigger, draft.name), None)   # メソッド+正規化したパス
        if matched is not None:
            function_id, group = matched.id, matched.group or group_initial     # ID と人の確定値を引き継ぐ
        else:
            function_id, group = format_function_id(next_number), group_initial
            next_number += 1                                                    # 消えた番号は戻さない
```

```python
# app/detailed_design/validation.py
STAGE_VALIDATORS: dict[int, StageValidator] = {1: validate_function_list}

def validate_stage(stage, model, sources) -> list[StageIssue]:
    validator = STAGE_VALIDATORS.get(stage)
    if validator is None or not model:
        return []                            # 登録の無い段階・内容が空なら指摘なし
    return validator(model, sources)
```

`__init__.py` は `FunctionDraft`・`FunctionListModel`・`FunctionRow`・`initial_group`・`merge_draft`・`STAGE_VALIDATORS`・`StageIssue`・`StageSources`・`has_errors`・`validate_stage` を re-export する。依存の向きは `validation → function_list → api_list`(16-1)で、どれも DB と LLM を知らない。

## 設計判断

### 処理IDは AI に書かせず、前の版と突き合わせて決める

後の段階(DFD の処理・CRUD 図・手順 `F-01#4`)は、処理IDで互いを参照する。再生成で ID が振り直されると、参照が別の処理を指してしまう。ステージ3の `DF-n` が文書の再生成で振り直されて、図のキーに使えなかった問題と同じである([`app/uml/generation/sections.py`](../samples/backend/app/uml/generation/sections.py) の `DfdSubject`)。

そこで AI には処理の列挙だけをさせ、ID はコードで決める。

- 突き合わせのキーは、API ならメソッド+正規化したパス(16-1 の `trigger_key`)、それ以外は名称。名称は AI が言い換えやすいので、API ではトリガーを優先した。
- 一致した行は、ID と人が確定した機能グループを引き継ぐ。名称・概要などは新しい下書きの値にする。
- 新しい行は `next_number` から振る。消えた行の番号は再利用しない。`F-03` を消した後に新しい処理へ `F-03` を振ると、`F-03` を参照していた後の段階が、黙って別の処理を指すからである。

### 機能グループの初期値はパスから決定的に作る

初期値を AI に提案させると、同じ入力でも生成のたびに揺れる。人は初期値を基準に確定するので、基準が揺れると確定の手間が増える。パスの先頭のリソース名(親の個別の対象に属するものは子のリソース名)なら、毎回同じになる。

出力見本([`content.py`](../../appendix/detailed-design-devex/content.py))では、`/projects/{id}/chat` の初期値を `projects` にしていた。今回の規則では `chat` になる。見本は手で作ったもので規則が書かれておらず、docs の「プロジェクト配下は `/projects/{id}/<リソース>`」に合わせた。どちらにしても人が確定する前提の初期値である。

### 画面の中で完結する処理も載せる(種別「画面」)

サーバーを呼ばずに画面の中で完結する処理(集計・変換・図の描画など)は、種別「画面」で載せる。トリガーは `SCR-005: プレビューの切り替え` の形(画面ID: 操作)にする。日本の詳細設計の機能一覧では、画面内の処理も載せるのが一般的だからである(作業後のユーザーの質問を受けて足した。[`q_a.md`](../q_a.md))。

- AI には、外部設計書 2.3(主要画面の UI/UX 仕様)から、**非自明な演算・描画だけ**を下書きさせる(16-4 のプロンプト)。入力欄の表示や画面遷移のような単純なものは載せない(「重要な部分だけ」)。
- API ではないので、機能グループの初期値は AI の提案(`initial_group` の `fallback`)になり、突き合わせのキーは名称になる。コードの規則は変えずに済んだ。
- 関連画面の列は「その処理を使う画面」を示す列で、画面の機能そのものを並べる列ではない。

### 段階ごとの検証を登録する仕組みを、ここで作る

Phase 15 では、使う段階が無かったので作らなかった(#17、[Phase-15-2](../Phase-15/Phase-15-2.md))。段階1が最初の実在の消費者になったので作る。

- 形は「段階番号 → 検証関数」の辞書だけにした。検証は内容(`model`)のほかに、入力の文書の本文が要る(段階1は外部設計書の API 一覧と照らす)ので、`StageSources` で渡す。
- 段階2以降は、各段階の Phase でこの辞書に足す。

### エラーと警告を分ける

| 区分 | 内容 | 理由 |
|---|---|---|
| エラー(承認を止める) | 形が不正、処理が0件、ID の形式・重複・まだ振っていない番号、名称が空、機能グループが一覧に無い、機能グループの重複 | 後の段階が ID と機能グループで参照するため、壊れたまま承認されると後ろが組み立てられない |
| 警告(承認を止めない) | 使われていない機能グループ、トリガーの重複、外部設計書の API 一覧にあるのに機能一覧に無い API | 人の判断で正しいことがある(1つの API を2つの処理に分ける、ヘルスチェックを載せない など) |

「まだ振っていない番号」(`next_number` 以上の ID)をエラーにしたのは、人が手で `F-40` と書くと、後で採番した新しい処理と ID がぶつかるためである。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `merge_draft`・`initial_group` | pytest | スタブ不要。純粋関数(副作用なし)で、外部依存を呼ばないため | 第一テストの統合スモーク(組み立てた結果が検証をエラーなしで通る)。再生成での ID・機能グループの引き継ぎ、消えた番号の非再利用 |
| `validate_function_list`・`validate_stage`・`has_errors`・`STAGE_VALIDATORS` | pytest | スタブ不要。同上 | エラー7種と警告3種、登録の無い段階 |

検証の仕組みのテストは、後の段階の実装ではなく、段階1そのもので行う(段階1は仕組みの最初の実物であり、フェイクで代える必要が無い)。

## 動作確認(実施済み)

```bash
cd devex-api/backend
uv run pytest tests/unit/test_function_list.py
# 9 passed
```
