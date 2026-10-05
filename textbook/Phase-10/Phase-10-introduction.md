# Phase 10 導入: AI生成(構造化出力)・内部設計書プロンプトへの「処理別データフロー」節追加

## 目的

[`docs/implementation_plan.md`](../../docs/implementation_plan.md) 4.1節 ステージ3ロードマップの「Phase 10: AI生成(構造化出力)・内部設計書プロンプトへの「処理別データフロー」節追加」を実装する。対象は M1(設計図の生成)。Phase 8 の `POST /uml/diagrams` は空の draft を作るだけのプレースホルダーだったが、これを「内部設計書から AI が意味モデル(JSON)を生成する」処理に置き換える。

あわせて、過去の Phase からの申し送りを解消する。

- **Phase 8**: DFD の境界フロー一致検証は、フラットな複数図構成を前提に Phase 10 で決める([`Phase-8-introduction.md`](../Phase-8/Phase-8-introduction.md))。
- **Phase 9**: AI 生成は要素の `layer` を埋める責務を持つ。レーン割り当ての入力になる([`Phase-9-introduction.md`](../Phase-9/Phase-9-introduction.md))。
- **診断8**: 内部設計書が処理ごとのデータの流れを構造化して書いていない。生成プロンプトに「処理別データフロー」節を追加する(#12 改訂)。
- **診断4**: 無料枠の制約がある。図ごとに独立して実行し、生成の対象を選べるようにする。

## 実装前の設計判断(このセッションで確定)

着手前の相談で、次の7点を確定した。詳細は [`textbook/q_a.md`](../q_a.md) と [`decision-digest.md`](../decision-digest.md)「Phase 10完了」節を参照。

1. **実行方式は BackgroundTasks**(4文書生成と同じ)。`POST /diagrams` は 202 を返し、FE は `GET /diagrams` をポーリングする。
2. **再生成は上書き**。図は `(project, notation, subject)` ごとに1枚とする。再生成すると semantic_model を置き換え、layout_model を破棄し、status を draft に戻し、version を +1 する。
3. **DFD はフラット構成で確定**(処理ごとに1枚)。「上位図と下位図の境界フロー一致」規則は撤回する。代わりに、未参照データ項目の検査を全 DFD 横断に改訂する。
4. **DFD の対象は決定的に列挙する**。内部設計書の固定形式の見出し(`#### DF-<n>: <処理名>`)を正規表現で解析し、LLM は呼ばない。
5. **生成単位は個別と一括の両方**。`subjects` に1件を渡せば個別生成、最大5件(`MAX_SUBJECTS_PER_REQUEST`)を渡せば一括生成になる。一括生成は、1つのバックグラウンドタスクが順番に処理する。
6. **図の「数」による上限は設けない**。図によってトークン消費が違うため。代わりに、止まった理由を**生成履歴**(`uml_generation_runs`)に残す。ユーザーに伝えるのは「止まった理由」と「再度の生成指示が必要なこと」。検討の途中で「DFD は1プロジェクト10件まで」という案が出たが、根拠の無い値だったので撤回した。
7. **入力の節の抽出を全図に適用し、ER も部分図に分けられるようにする**。component には 3.1+3.3、ER には 3.2、DFD には 3.2+対象の DF 節だけを渡す。ER はテーブルが30件を超えるとき、選んだテーブルだけで部分図を作る。

## パイプライン上の位置づけ・前提

```
生成: 内部設計書(is_current) → 節の抽出 → AI(構造化出力, include_raw) → 出力スキーマ
      → mapper(名前→UUID) → 意味モデル → uml_diagrams(draft) + uml_generation_runs(履歴)
```

- **前提として読むもの**:
  - [`Phase-8-introduction.md`](../Phase-8/Phase-8-introduction.md): 意味モデル、`DfdFlow.data_item_id`、データ辞書
  - [`Phase-9-introduction.md`](../Phase-9/Phase-9-introduction.md): `layer` とレーン、`MAX_ELEMENTS`
  - [`appendix/stage3-requirements-organization.md`](../../appendix/stage3-requirements-organization.md): 診断4・診断8
  - [`docs/internal_design.md`](../../docs/internal_design.md) 3.3節③: 図と文書の対応(D5)
- **本 Phase 開始時点の状態**:
  - `app/uml/generation/` は存在しない。
  - 構造化出力の前例は `chat_service.py` の `with_structured_output(HearingCompletionCheck)` の1件だけ。
  - `uml_diagrams.source_doc_versions` 列は Phase 8 で確保済みだが、まだ使われていない。
- **既存コードに前例が無い新規パターン**:
  - (1) `with_structured_output(schema, include_raw=True)` で生の応答(`finish_reason`)を読み、トークン上限と出力の揺らぎを見分ける。
  - (2) 1つのバックグラウンドタスクが複数の対象を順番に処理し、1件ごとに commit・rollback する。

## モード宣言(#21)

全章を**学習モード**で進める。appendix の章立て案が本 Phase を「コア級 → 学習モード」と明記しているため。M1 はステージ3のコアであり、入力の選び方、出力スキーマの分離、失敗の分類はいずれも設計判断そのものである。

## 章一覧

| 章 | トピック | モード | 依存 |
|---|---|---|---|
| [`Phase-10-1.md`](./Phase-10-1.md) | 内部設計書プロンプトの改訂(#12)と、節の抽出・候補の列挙(`sections.py`) | 学習 | なし |
| [`Phase-10-2.md`](./Phase-10-2.md) | LLM 出力スキーマとプロンプトの組み立て(`schemas.py`/`prompts.py`) | 学習 | 10-1 |
| [`Phase-10-3.md`](./Phase-10-3.md) | 出力から意味モデルへの変換(`mapper.py`) | 学習 | 10-2 |
| [`Phase-10-4.md`](./Phase-10-4.md) | 永続化(subject/scope/generation_status、`uml_generation_runs`)と検証の改訂(DFD 横断・境界フロー規則の撤回) | 学習 | 10-1 |
| [`Phase-10-5.md`](./Phase-10-5.md) | サービス層とバックグラウンド生成(`uml_generation_service.py`、失敗の分類 `failures.py`) | 学習 | 10-2, 10-3, 10-4 |
| [`Phase-10-6.md`](./Phase-10-6.md) | API 層(`POST /diagrams` の 202 化、一覧・候補・履歴の GET)とプレースホルダーの廃止 | 学習 | 10-5 |

## サンプルコード一覧

`textbook/samples/backend/` 配下の、`devex-api/backend/` と同じ相対パスに置く。各ファイルが新規か更新か、写経レベルは各章の「この章で作成・更新したファイル」表を参照。

- **新規パッケージ**: `app/uml/generation/{__init__,sections,schemas,prompts,mapper,failures}.py`
- **新規ファイル**:
  - `app/models/uml_generation_run.py`
  - `app/repositories/uml_generation_run.py`
  - `app/services/uml_generation_service.py`
  - `app/schemas/uml_generation.py`
  - `alembic/versions/b7c8d9e0f1a2_add_uml_generation.py`
  - `tests/fixtures/uml.py`
- **更新**:
  - `app/services/doc_generator_service.py`(内部設計書プロンプト)
  - `app/ai/llm/fake.py`
  - `app/models/{uml_diagram,project,__init__}.py`
  - `app/repositories/uml_diagram.py`
  - `app/uml/validation/{dfd_rules,__init__}.py`
  - `app/services/{errors,llm_retry,uml_diagram_service}.py`
  - `app/uml/domain/__init__.py`
  - `app/schemas/uml_diagram.py`
  - `app/api/routes/uml.py`
  - `tests/fixtures/fake_llm.py`
  - `pyproject.toml`

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| 10-1 | `doc_generator_service.py`(更新)、`app/uml/generation/{__init__,sections}.py`(新規)、`app/ai/llm/fake.py`(更新)、`tests/fixtures/uml.py`(新規) | 内部設計書に固定形式の見出しを書かせ、その見出しから入力の節と生成対象の候補を決定的に取り出す | `uv run pytest tests/unit/test_uml_generation_sections.py tests/unit/test_doc_generator_service.py tests/unit/test_fake_llm_e2e.py` |
| 10-2 | `app/uml/generation/{schemas,prompts}.py`(新規) | ドメインと分けた LLM 出力スキーマ(layer 必須・データ項目の名前参照)と、記法ごとに節を絞ったプロンプト | `uv run pytest tests/unit/test_uml_generation_prompts.py` |
| 10-3 | `app/uml/generation/mapper.py`(新規)、`tests/fixtures/uml.py`(更新) | 出力スキーマから意味モデルへの純粋な変換。名前→UUID の対応表は外から受け取る | `uv run pytest tests/unit/test_uml_generation_mapper.py` |
| 10-4 | マイグレーション、`app/models/{uml_diagram,uml_generation_run,project,__init__}.py`、`app/repositories/{uml_diagram,uml_generation_run}.py`、`app/uml/validation/{dfd_rules,__init__}.py`、`pyproject.toml`、`tests/fixtures/uml.py` | 図の識別キー・生成状態・生成履歴の永続化と、未参照データ項目の判定の横断化 | `uv run pytest tests/unit/test_uml_diagram_repository.py tests/unit/test_uml_generation_run_repository.py tests/unit/test_uml_validation.py` |
| 10-5 | `app/services/{errors,llm_retry}.py`(更新)、`app/uml/generation/failures.py`(新規)、`app/services/uml_generation_service.py`(新規)、`app/services/uml_diagram_service.py`・`app/uml/domain/__init__.py`・`app/ai/llm/fake.py`・`tests/fixtures/fake_llm.py`(更新) | 受け付けと実行を分けた生成のユースケース。クォータ超過で残りを skipped にし、理由を履歴に残す | `uv run pytest tests/unit/test_llm_retry.py tests/unit/test_uml_generation_failures.py tests/unit/test_uml_generation_service.py tests/unit/test_uml_diagram_service.py tests/unit/test_fake_llm_e2e.py` |
| 10-6 | `app/schemas/{uml_diagram,uml_generation}.py`、`app/api/routes/uml.py`、`app/services/uml_diagram_service.py`(`create` の削除) | 生成の受け付け(202)・一覧・候補・履歴の API | `uv run pytest tests/unit/test_uml_diagram_routes.py tests/unit/test_uml_diagram_service.py` |

## 写経順序(#23)

章番号順(10-1 → 10-2 → 10-3 → 10-4 → 10-5 → 10-6)に進める。各章の中は依存順(#30)で、順番は各章の表を参照。

2つのファイルは複数の章にまたがって完成する。章ごとの担当分には `# Phase-10-<n>:追記` タグを付けてある。

- `tests/fixtures/uml.py`: 10-1 で内部設計書のサンプル、10-3 で出力のサンプル、10-4 で作成ヘルパーを追加する。
- `app/uml/generation/__init__.py`: 10-1、10-2、10-3、10-5 で re-export を足していく。

**注意(前方 import を避けるための配置)**: `UmlDiagramService.create`(Phase 8 のプレースホルダー)は、ルートを差し替える 10-6 で削除する。10-5 で先に消すと、10-5 と 10-6 の間は `POST /diagrams` が壊れた状態になるため。

## Stage 3 固有の運用(Phase 7 から継続)

`textbook/samples/backend/` への反映と並行して、`devex-api` 本体(`stage3` ブランチ)に Claude が直接実装する。samples 側の Phase タグは本体には書かない。

## 後続 Phase への申し送り

- **Phase 11(FE)**:
  - `POST /diagrams` は 202 と生成履歴を返す。完了は `GET /diagrams` の `generation_status` をポーリングして判定する。
  - 失敗の理由は `generation_error`(図ごと)と `GET /generation-runs`(リクエストごと)で見せる。
  - 対象の選択 UI では、`GET /candidates` の `dfd_subjects`・`er_tables` を個別ボタン、またはチェックボックス(最大5件)で選ばせる。
  - `candidates` が空で `internal_design_version` がある場合は、内部設計書が Phase 10 以前の形式なので、再生成を促す。
- **Phase 13(文書連携)**: `source_doc_versions = {"internal_design": <version>}` を生成時に記録している。陳腐化の検知はこの値と `generated_documents` の現行版を比べて行う。
- **既知の制約**: プロセスが落ちると `generation_status='generating'` のまま残る。その場合、同じプロジェクトでは再生成できない(4文書生成の `project.status='generating'` と同じ制約)。対策は入れていない。

## 後続 Phase での改訂

- [`Phase-13-1.md`](../Phase-13/Phase-13-1.md)で、10-1 の `app/uml/generation/sections.py` に見出し行の直後の位置を返す `find_section_heading_end`・`find_dfd_heading_end` を追記した(図を反映するアンカーの挿入位置に使う)。既存の関数は変えていない。
- [`Phase-15-3.md`](../Phase-15/Phase-15-3.md): 15分を超えて生成中のまま止まった図と生成履歴を回収する`UmlGenerationService.recover_stale`を足し、受け付け時と図の一覧の取得時に呼ぶようにした。理由コードに`STALE_GENERATION`を足した。
- Phase 24 完了後の調整([`q_a.md`](../q_a.md)「Phase 24 完了後 ── 文書プレビューの不具合・簡易モードの設計図の削除・モード表示」): 簡易モードの設計図を削除した。`uml_generation_service.py`・`prompts.py` の組み立て・`sections.py` の DFD/ER の抽出・`to_er`・`to_semantic_model`・ER の出力スキーマと、生成・候補・履歴の API を消した。詳細設計モードの段階が使う `failures.py`・`to_component`・`to_dfd`・構成図と DFD の出力スキーマ・`ExistingDataItem`・`extract_section` は残した。消したファイルは、外側のリポジトリの `4f6b6d7` 以前の履歴にある。

## Phase 完了チェック(#22)

1. LLM の構造化出力に、ドメインモデル(`app/uml/domain`)ではなく専用の出力スキーマを渡す理由を、`DfdFlow.data_item_id` と `layer` の2点から説明できるか。
2. DFD の対象を LLM に列挙させず、内部設計書の見出しを正規表現で解析する方式にした利点(クォータと決定性)と、その代償(プロンプトの形式への依存。旧形式の文書では候補が0件)を説明できるか。
3. `include_raw=True` にした理由を、「トークン上限(再試行しても同じ)」と「出力の揺らぎ(再試行で直りうる)」の区別と、`invoke_with_retry` のリトライ方針の違いから説明できるか。
4. 図の「数」に上限を設けず、生成履歴で理由を見せる設計にした理由を、図ごとのトークン消費の違いとクォータ超過時の skipped の扱いから説明できるか。
5. 「境界フロー一致」規則を撤回し、「未参照データ項目」を全 DFD 横断に改訂した理由を、フラット構成の決定と結びつけて説明できるか。

## 次のフェーズ

**Phase 11**: フロントエンド(Adapter・React Flow のプレビュー/編集)。生成の受け付け・ポーリング・生成履歴の表示もここで扱う。
