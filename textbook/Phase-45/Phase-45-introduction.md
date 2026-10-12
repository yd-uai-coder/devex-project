# Phase 45 導入: 簡易モードの文書のモデル化

## 目的

ステージ7(変更影響分析・変更管理)の4つ目の実装 Phase。[41-2](../Phase-41/Phase-41-2.md) の決定7で、簡易ドキュメントモードの内部設計書・実装計画書も、要件定義書([Phase 36](../Phase-36/Phase-36-introduction.md))・外部設計書([Phase 37](../Phase-37/Phase-37-introduction.md))と同じ「構造化出力 → model → md」にすると決めた。今までは LLM の md をそのまま保存し、段階8が md を毎回解析していた([Phase 31](../Phase-31/Phase-31-introduction.md))。そのため次の3つが残っていた。

1. **書き落とし**が段階8を開くまで見えない。ベースライン([33-1](../Phase-33/Phase-33-1.md) の分類 B)では、処理(DF)の無い機能の単位が5件あった。
2. Phase 46(簡易モードの変更の影響)が比べる **model が無い**。
3. 簡易モードの**作業単位のキー**が単位の ID のまま([Phase 42](../Phase-42/Phase-42-introduction.md) の申し送り)。

この Phase で、2文書の model・組み立て・md・検証を作り(45-1・45-2)、生成につなぎ(45-3)、段階8が model を読むようにし(45-4)、プレビューに指摘を出す(45-5)。確定した仕様は [`docs/internal_design.md`](../../docs/internal_design.md) 3.3節「7. 変更影響分析・変更管理」の「Phase 45 で実装した部分」と、[`docs/external_design.md`](../../docs/external_design.md) の上流の文書の節(「Phase 45 で実装した部分(簡易モード)」)に足した。

## パイプライン上の位置づけ・前提

```
[45-1] 内部設計書の model ─┐  (テーブル・API・モジュール・DF の行 + 本文の節。DF の ID は前の版から)
[45-2] 実装計画書の model ─┤  (段階7の Milestone・PlanTask・Risk。キーはタスク名で引き継ぐ)
        │                 │
        ▼                 ▼
[45-3] DocGeneratorService.generate: 4文書とも構造化出力 → model → md、応答に行数と指摘
        │
        ├─▶ [45-4] 段階8(procedure_basis): model があれば model から、無ければ md を解析
        └─▶ [45-5] プレビュー(SCR-005): SimpleDesignSummaryPanel
        │
        ▼
[Phase 46]  簡易モードの変更の影響(4文書の版の model の差分 → 段階8の単位の印)
```

- **前提として読むもの**:
  - [41-2](../Phase-41/Phase-41-2.md)(決定7)・[41-5](../Phase-41/Phase-41-5.md)(Phase 45 のスコープと未確定事項)。
  - [Phase 37](../Phase-37/Phase-37-introduction.md)(外部設計書の model。同じ5ファイルの形)。
  - [Phase 31](../Phase-31/Phase-31-introduction.md)(簡易モードの段階8。WBS と内部設計書の解析)・[Phase 42-1](../Phase-42/Phase-42-1.md)(作業単位の安定キー)。
- **この Phase を始めた時点の状態**: Phase 44 までコミット済み(外側のリポジトリ・devex-api・devex-ui)。Phase 44 の画面確認は終わり、完了後の調整2件も同じコミットに入っている。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(AI が devex-api・devex-ui に実装し、`textbook/samples/` も同じ内容で作った)。

E2E: この Phase では流さない。簡易モードの文書の生成を変えたので既存の E2E(`devex-flow.spec.ts`)が壊れうるが、偽 LLM の契約テスト(`test_fake_llm_e2e.py`・`test_fake_llm_simple_procedure.py`)で、偽 LLM の4文書が段階8の生成・承認・zip まで通ることを確かめた。ステージ7の E2E は Phase 50 で既存を含めて全部流す。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 45 開始時」を参照。

1. **Phase 44 の画面確認**: 終わった・追加の調整なし。
2. **自動実装モード**: on(推奨どおり)。
3. **model の形**: 今の見出しに合わせる(推奨どおり)。表になる部分は行、説明の節は本文の文字列。md は model から今と同じ見出しで組み立てるので、プレビュー・ダウンロード・段階8の解析は変わらない。既存の文書は移さず、model の無い版は今の md の解析で読む。
4. **検証の指摘の出し場所**: プレビューにも出す(推奨どおり。devex-ui も変える)。

Claude の判断(計画の承認で確定、または実装中):

- **実装計画書の model は段階7の型を流用**(`Milestone`・`PlanTask`・`Risk`。#17。[45-2](./Phase-45-2.md))。
- **DF の ID は AI に書かせず、トリガー(API・バッチ名)で前の版から引き継ぐ**([45-1](./Phase-45-1.md))。計画の「下書きに前の版の DF を渡す」は要らなくなったのでやめた。
- **タスクの安定キーはタスク名で引き継ぐ**(段階7の作り直しと同じ。[45-2](./Phase-45-2.md))。
- **検証の重要度**: 外部設計書の API に処理が無い・処理の無い機能のタスクは中程度、モジュール一覧が無い・タスクが無いは最重要([45-1](./Phase-45-1.md)・[45-2](./Phase-45-2.md))。計画の「DF の流れに 3.2 に無いテーブル名」は、流れの元・先がテーブル名かを決められないのでやめ、「流れの行が無い処理」(軽微)にした。
- **段階8の検証と判定は共有しなかった**(実装中に判断。指摘の形が違い、共有できるのは1行の述語だけだった。[45-2](./Phase-45-2.md))。
- **段階8は `app.documents` のモジュールを直接読む**(パッケージの `__init__` を読むと循環 import になる。[45-4](./Phase-45-4.md))。
- **プレビューのパネルは1つ**(実装中に判断。計画では2つ。[45-5](./Phase-45-5.md))。
- **4文書とも構造化出力になったので、md をそのまま書かせる経路(`_DOC_TYPE_PROMPTS`・`_generate_one`)を消した**([45-3](./Phase-45-3.md))。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-45-1.md`](./Phase-45-1.md) | 内部設計書の model(組み立て・md・検証・下書き) | あり(API) | なし |
| [`Phase-45-2.md`](./Phase-45-2.md) | 実装計画書の model(段階7の型の流用・キー・検証) | あり(API) | 45-1(DF の ID の形) |
| [`Phase-45-3.md`](./Phase-45-3.md) | 生成への組み込みと文書の応答(偽 LLM を含む) | あり(API) | 45-1・45-2 |
| [`Phase-45-4.md`](./Phase-45-4.md) | 段階8が model を読む | あり(API) | 45-1・45-2(45-3 の見本を使う) |
| [`Phase-45-5.md`](./Phase-45-5.md) | プレビューの指摘 | あり(UI) | 45-3(応答の形) |

## サンプルコード一覧

`textbook/samples/backend/` 配下:

- 45-1: `app/documents/internal_design/{model,assemble,markdown,validation,drafting,__init__}.py`
- 45-2: `app/detailed_design/plan.py`・`app/detailed_design/simple_procedure/wbs.py`・`app/documents/implementation_plan/{model,assemble,markdown,validation,drafting,__init__}.py`
- 45-3: `app/schemas/document.py`・`app/ai/llm/fake.py`・`app/services/doc_generator_service.py`
- 45-4: `app/detailed_design/simple_procedure/{internal_design,__init__}.py`・`app/detailed_design/{procedure_basis,validation}.py`・`app/services/{design_stage_service,design_stage_generation_service,detailed_design_export_service}.py`
- テスト: `tests/unit/test_{internal_design_doc,implementation_plan_doc,simple_procedure_model}.py`(新規)、`tests/fixtures/simple_documents.py`(新規)・`tests/fixtures/{external_design,simple_procedure}.py`、`tests/unit/test_{doc_generator_service,external_api_list,fake_llm_e2e,fake_llm_simple_procedure,project_mode}.py`

`textbook/samples/frontend/src/features/documents/` 配下:

- 45-5: `api/documentsApi.ts`・`components/{DocumentIssueList,SimpleDesignSummaryPanel,DocumentMarkdownView}.tsx`・`components/__tests__/{SimpleDesignSummaryPanel,DocumentMarkdownView}.test.tsx`

マイグレーションは無い(`generated_documents.model` は Phase 36 からある列)。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| [45-1](./Phase-45-1.md) | `app/documents/internal_design/` | 内部設計書の行と本文を model に持ち、DF の ID を引き継ぎ、今と同じ md を組み立て、書き落としを検証する | 純粋関数(スタブ不要)。md を古い版の解析で読めること |
| [45-2](./Phase-45-2.md) | `app/documents/implementation_plan/`・`plan.renamed_task_ids` | 実装計画書を段階7の型で持ち、キーを引き継ぎ、今と同じ WBS の md を組み立て、書き落としを検証する | 純粋関数(スタブ不要)。md を `parse_wbs` で読めること、WBS の解析の番人 |
| [45-3](./Phase-45-3.md) | `doc_generator_service.py`・`schemas/document.py`・`fake.py` | 4文書を構造化出力で連鎖して生成し、応答に行数と指摘を付ける | スタブは `FakeLLM`(スキーマごとの出力)。偽 LLM の契約 |
| [45-4](./Phase-45-4.md) | `procedure_basis.py`・`simple_procedure/internal_design.py` | 段階8が model を優先して読み、無ければ md を解析する | 純粋関数(スタブ不要)。model と md で同じ土台 |
| [45-5](./Phase-45-5.md) | `SimpleDesignSummaryPanel.tsx` | プレビューに件数と指摘を出す | props だけ(スタブ不要) |

## 写経順序(#23)

章番号順。各章の中は「この章で作成・更新したファイル」の表の順(#30。依存されるファイルが上、テストは末尾)。

実 import 監査(#15。全 import 文を読んで確かめた):

- 45-1: `model.py` は既存の `api_list`(`endpoint_key`・`trigger_key`)・`structure.ModuleRow` を読む。`assemble.py` は既存の `api_list`(`HTTP_METHODS`・`endpoint_key`)・`ModuleRow` と同じ章の `model` を読む。`markdown.py` は既存の `document.markdown.md_table` と同じ章の `model` を読む。`validation.py` は既存の `api_list.trigger_key`・`documents.issues` と同じ章の `model` を読む。`drafting.py` は同じ章の `assemble` を読む。テストは同じ章の名前と既存の `simple_procedure.parse_internal_design` を読む。
- 45-2: `plan.py` の追記は import を足していない。`wbs.py` は同じ章の `plan.renamed_task_ids` を読む。`model.py` は既存の `plan`(`Milestone`・`PlanModel`・`Risk`)を読む。`assemble.py` は既存の `plan`(型・`assign_unit_keys`・`carry_over_unit_keys`)と同じ章の `renamed_task_ids`、既存の `requirement_trace.normalize_req_id`・`requirements.model`、45-1 の `internal_design.model`(`dataflow_id`・`dataflow_seq`)を読む。`markdown.py` は既存の `plan` と 45-1 の `internal_design.markdown.body_text` を読む。`validation.py` は既存の `procedure_doc.plan_units`・`requirement_trace.unit_req_ids`・`documents.issues` を読む。テストは同じ章の名前と既存の `parse_wbs`・`requirements` を読む。
- 45-3: `schemas/document.py` は import を足していない。`fake.py` は 45-1・45-2 の `drafting` を読む。`doc_generator_service.py` は 45-1・45-2 のパッケージと `drafting`、同じ章の `DocumentSummaryRead` を読む。`simple_documents.py` は 45-1・45-2 の名前と既存の `E2eFakeLLM` を読む。`external_design.py`(フィクスチャ)は同じ章の `simple_documents` と 45-1・45-2 の `drafting` を読む。各テストは同じ章のフィクスチャと 45-1・45-2 の名前を読む。
- 45-4: `simple_procedure/internal_design.py` は 45-1 の `internal_design.markdown`・`internal_design.model` を読む。`simple_procedure/__init__.py` は同じ章の `book_from_model` を読む。`procedure_basis.py` は同じ章の `book_from_model`、既存の `WbsParse`、45-1・45-2 の `model` を読む。各サービスと `validation.py` は import を足していない。テストは 45-1・45-2 の名前と 45-3 の `simple_documents` を読む。
- 45-5: `documentsApi.ts` は import を足していない。`SimpleDesignSummaryPanel.tsx` は同じ章の型と既存の `DocumentIssueList` を読む。`DocumentMarkdownView.tsx` は同じ章のパネルを読む。テストは同じ章のパネル・型を読む。
- 前方 import は無い。章が作成・更新するファイルは、その章のテストが少なくとも1度 import する(`plan.py` は `test_implementation_plan_doc.py`、`wbs.py` は既存の `test_simple_wbs.py`、`schemas/document.py` は `document_read` 経由、`fake.py` は契約テスト、45-4 の各サービスと `validation.py` は `test_fake_llm_simple_procedure.py`、`DocumentIssueList.tsx` はパネル経由)。

## 検証結果

- devex-api: 部分テスト(各章の「テスト観点」のコマンド)成功、`ruff check`・pyright(触ったファイル)0件。Phase 完了時の全体テスト(#18): 1019 件成功(Phase 43 時点の 1003 件 + 新規20件 − 置き換え・削除4件)。
- devex-ui: `vitest run src/features/documents` 53件成功、`tsc --noEmit`・`npm run lint`(既存の警告1件だけ)・`npm run build` 成功。全体テスト: 774 件成功(`--maxWorkers=4`)。
- 実 LLM での生成: していない(利用枠を使うため、ユーザーの判断を待つ。「未消化の申し送り」)。
- `samples_check.py`(`--api-since HEAD --ui-since HEAD`): 不一致 0 件・作り忘れ 0 件(一致 559 / 並び順のみ差 8 / 例外 5)。`link_check.py`: 切れ 0 件。

## 未消化の申し送り(#37)

Phase 44 から引き継いだもの(未解決のまま):

- **持ち越し(Phase 22 から)**: 段階6が開いていないときの、05 の詳細バッジ / ER の主キーの NULL の表示。
- **E2E を CI で流すか**: 未定([`retrospective-memo.md`](../retrospective-memo.md) に候補として記録済み)。#36 のまま。
- **コミュニケーション図**: 後回し([25-5](../Phase-25/Phase-25-5.md))。
- **「AI に提案を求める」**: ステージ8との境界として申し送る。
- **段階8の生成の入力の大きさ・判定の LLM の入力の大きさ**: 問題になれば測る。
- **生成済みの簡易モードのプロジェクト**: Phase 31 より前に生成した文書では段階8の単位が空。再生成で使える。
- **既存のプロジェクトの会話の順**(Phase 35 から): 直さない。
- **`test_chat_service.py` の pyright の指摘4件**(Phase 40 から): 触るときに `isinstance` で絞る。
- **ステージ7の計画に入れたもの**: L2・L5・L6・L14 と判定のゆらぎ → Phase 47・49 / 段階3の CRUD の下書きと DFD の食い違い・段階5の分岐の行の書き落とし → Phase 48。
- **Phase 46〜50 の未確定事項**: [41-5](../Phase-41/Phase-41-5.md)「未確定事項」。
- **共有のモジュールの中で「どれを直すか」**: 示さない。効果測定では見落としとして数え続ける。
- **devex-ui の「開発用」メニュー**: ステージ7の完了時に、ユーザーが前と同じく外すかを決める。
- **共有の画面を通って別の処理に届く**(Phase 42 から): 止めるかは Phase 49 の数字で決める。
- **テーブルの変更は、そのテーブルを読み書きする全処理に届く**(Phase 42 から): Phase 49 で数える。
- **文書の要素(要件・画面・API)からの影響は、まだ生成物で確かめていない**(Phase 42 から): Phase 49 で、測定用に文書の model を用意して測る。
- **改名の後に下流の参照を直して承認すると、内容の変更として広がる**(Phase 43 から): 過剰かどうかは Phase 49 で数える。
- **ER 以外の段階の外の図(段階2の DFD・データ辞書、段階4の構成図)の変更は差分に入らない**(Phase 43 から): DFD の線が効いているかを Phase 49 で見る。
- **「段階Nで直す」の推定は名前の照合**(Phase 44 から): 当たる割合は Phase 49 の効果測定で見るか、画面確認で外れが目立てば直す。
- **影響の取得は段階の一覧のたびに1回**(Phase 44 から): 重く感じたら、生成のポーリング中は取らないなどで減らす。
- **並列のテストのタイムアウト**(Phase 44 から): devex-ui の全体テストは `--maxWorkers=4` で流すと安定する。CI で流すなら上限を上げるか並列を絞る。

この Phase で生まれたもの:

- **実 LLM での生成の確認(ユーザー)**: 内部設計書は1回の構造化出力が大きい(テーブルの全カラム・全 DF の流れの行)。偽 LLM と単体テストでは確かめたが、実際の Gemini で出力が上限に収まるか・行が欠けないかは確かめていない。簡易モードのプロジェクトで「再生成」を1回押し、プレビューの内部設計書・実装計画書に件数と指摘が出ること、段階8の単位が今までどおり出ることを見る。欠けるなら、内部設計書を2回の呼び出し(データモデルと処理)に分ける。
- **Phase 46 への入力**: 差分の起点は、内部設計書の DF の ID(トリガーで引き継ぐ)・テーブル名・モジュールのパスと、実装計画書のタスクのキー(タスク名で引き継ぐ)。タスクの改名はキーが変わる(段階7と同じ)。
- **以前の版の段階8の手順書**: キーが単位の ID のまま。model を持つ実装計画書に再生成すると、手順書は単位の ID とタスク名で付いたままで、作り直した手順書から新しいキーになる([45-4](./Phase-45-4.md))。Phase 46 の印は、キーで引けない手順書に付かない。
- **偽 LLM の外部設計書の GET に DF が無い**: プレビューに中程度の指摘が1件出る(E2E の検証対象ではない。[45-3](./Phase-45-3.md))。
- **セッションの区切りの記録**: Phase 45 は1セッションで行った(計画モードで質問4問 → 45-1 → 45-2 → 45-3 → 45-4 → 45-5 → 全体テスト → samples → 教材)。

この Phase で解決したもの:

- **簡易モードの内部設計書の書き落とし**(ベースライン 33-1 から、ステージ7の計画)→ 内部設計書・実装計画書の検証とプレビューの指摘([45-1](./Phase-45-1.md)・[45-2](./Phase-45-2.md)・[45-5](./Phase-45-5.md))。
- **Phase 44 の画面の操作感の確認(ユーザー)**→ 終わった(調整は Phase 44 の「完了後の調整」2件)。
- **簡易モードの作業単位のキー**(Phase 42 から)→ 実装計画書の model のタスクのキー([45-2](./Phase-45-2.md))。
- 41-5 の Phase 45 の未確定事項(model の形・検証の重要度・既存の文書の扱い)→ この introduction の「着手時の相談で決めたこと」。

## 完了後の調整

(まだ無い)

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

設問は Phase の要点の要約(回答は求めない)。

1. 処理別データフローの ID を AI に書かせず、トリガーで前の版から引き継ぐのはなぜか。外部設計書の画面ID の引き継ぎとの違いは何か。
2. 実装計画書の model に段階7の型(`Milestone`・`PlanTask`)を使うと、段階8の何が変わらずに済むか。
3. model から組み立てた md を、古い版の解析(`parse_internal_design`・`parse_wbs`)で読めることを確かめるのはなぜか。
4. 段階8が `app.documents.internal_design` のパッケージでなくモジュールを読むのはなぜか。どの順で読むと循環するか。
5. 以前の版で作った段階8の手順書は、model を持つ実装計画書に再生成した後もなぜ付いたままなのか。

## 次のフェーズ

**Phase 46**: 簡易モードの変更の影響(4文書の版の model の差分 → 段階8の単位の印・画面は Phase 44 の部品)。着手時に自動実装モード(#21)と [41-5](../Phase-41/Phase-41-5.md) の Phase 46 の未確定事項(単位の影響のたどり方 ── WBS の処理(DF)・要件・モジュールのどれを軸にするか)を決める。実 LLM での生成の確認の結果、調整があれば先に行う。
