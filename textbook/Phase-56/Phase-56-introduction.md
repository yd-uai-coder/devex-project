# Phase 56 導入: テスト仕様書の model と生成

## 目的

ステージ8で決めた「テスト設計」([51-2](../Phase-51/Phase-51-2.md) の決定7・8)を作る。結合テスト(API 単位)と総合テスト(画面の流れ・非機能)の「テスト仕様書」を、両モードで生成する。形は見本 [`test-spec.md`](../../appendix/design-review-sample/test-spec.md)(`IT-001`・`ST-001`、観点 = 正常・異常・境界・セキュリティ・非機能、要件 → テストの対応表)。レビューには渡さず、決定的な検証だけで見る(51-2 のユーザー決定)。画面・ダウンロード・zip は Phase 57。

- model・必要なテストの一覧・md・検証(純粋関数)── [56-1](./Phase-56-1.md)
- 生成と API(両モード)・偽 LLM・UI の型 ── [56-2](./Phase-56-2.md)
- dev の DB と実 Gemini での確認・docs ── [56-3](./Phase-56-3.md)

## パイプライン上の位置づけ・前提

```
要件定義書の model ──┐
外部設計書の model ──┼─→ required_tests(必要なテストの一覧)──┐
                     │                                         ├─→ Gemini(構造化出力)─→ build_model ─→ render_test_spec(md)
要件定義書の md ─────┘                                         │                         ↑          └→ validate_test_spec(5つの指摘)
                                                                │       links(API → 処理 → 単位)
簡易: 内部設計書の処理別データフロー + 実装計画書のタスク ──────┤
詳細: 段階1の処理 + 段階7の単位(承認済みで古くないもの)───────┘
```

- **前提として読むもの**: [51-5](../Phase-51/Phase-51-5.md) の Phase 56 の未確定事項、見本 [`test-spec.md`](../../appendix/design-review-sample/test-spec.md)、[`docs/external_design.md`](../../docs/external_design.md) 2.11節と [`docs/internal_design.md`](../../docs/internal_design.md) 3.3節「8.」のテスト仕様書。
- **今の仕組み**: 4文書は「構造化出力 → assemble → model → markdown → validation」の同じ形(`app/documents/<文書>/`)。テスト仕様書も同じ形のパッケージ `app/documents/test_spec/` にした。生成は `DocGeneratorService.generate`(`POST /projects/{id}/generate`、`start_from` で起点を選ぶ。Phase 53 の完了後の調整)。
- **この Phase を始めた時点の状態**: Phase 55(と完了後の調整)までコミット済み。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(AI が devex-api・devex-ui の本体へ実装し、`textbook/samples/` も同じ内容で作る)。

E2E: この Phase では流さない([51-5](../Phase-51/Phase-51-5.md) のとおり Phase 59)。簡易モードの生成が5回目の構造化出力を呼ぶので、E2E 用の偽 LLM にテスト仕様書の応答を足した(足さないと `NotImplementedError` で生成が止まる)。画面は変えていない(devex-ui は型と表示名だけ)。

実 LLM: Gemini flash-lite(無料枠)を2回(簡易1件・詳細1件)。Anthropic は呼んでいない(費用 $0)。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 56 開始時」を参照。すべて推奨どおり。

1. **自動実装モード**: on。
2. **生成の入力**: 要件定義書・外部設計書の model + 処理/単位(処理・単位の列を埋める)。
3. **陳腐化**: 生成時の入力の版を model に写し、今の版と違えば「古い」(ステージ7の印は使わない)。
4. **きっかけ**: 簡易 = 4文書の生成に続けて自動、詳細 = 段階7の承認の後に API(ボタンは Phase 57)。
5. **テストパターンの戦略**(計画の確認中の質問「テストパターンはどのような戦略で生成されるか」から): コードが「必要なテストの一覧」を組み立て、LLM が各項目を埋める。一覧は生成の誘導だけに使い、検証は 51-2 の3点のまま。

Claude の判断(計画の承認で確定、または作業中):

- **model の形**: 結合と総合を別の表(見本どおり)。行の型は1つ(`SpecCase`)で `level` を持つ。
- **処理・単位の列はコードが埋める**: LLM には書かせず、API のキーで引く(簡易 = データフロー → タスク、詳細 = 段階1の処理 → 段階7の単位)。LLM の入力を小さく保つため、要件定義書は md、外部設計書は画面(UI 仕様の本文を除く)と API の行だけ。
- **ID**: 生成のたびに並び順で振る(下流から参照されないので引き継がない)。
- **保存**: `generated_documents` の `doc_type="test_spec"`(Alembic は要らない)。`DOC_TYPES_BY_MODE` には入れない。
- **生成の経路**: 今の `POST /generate` を使う(`start_from="test_spec"`)。簡易は4文書と同じトランザクション(失敗すれば組ごと戻す)。テスト仕様書だけのときは自己診断も設計レビューも流さない。
- **詳細の前提**: 段階1・段階7 が承認済みで古くない。違えば 409 `TEST_SPEC_UPSTREAM_NOT_READY`。
- **読み出し**: 専用の `GET /projects/{id}/test-spec`。文書の一覧には出さない(タブは Phase 57)。
- **検証の重要度**: Must にテストが無い・存在しない要件 / API は major、存在しない画面・異常系の無い API は minor。
- **pytest の収集を避ける**: `Test` で始まるクラス(`TestSpecModel` など)に `__test__ = False`、行や方針の型は `SpecCase`・`SpecPolicy`、ID の関数は `case_id`(テストのモジュールに import すると pytest がテストとして集めるため)。
- 作業中に決めたこと(実 Gemini の確認から。[56-3](./Phase-56-3.md)): 生成の規則に「日本語で書く」を足した。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-56-1.md`](./Phase-56-1.md) | model・必要なテストの一覧・API → 処理 → 単位・md・検証 | あり | なし |
| [`Phase-56-2.md`](./Phase-56-2.md) | 生成(両モード)・読み出しの API・偽 LLM・UI の型 | あり | 56-1 |
| [`Phase-56-3.md`](./Phase-56-3.md) | dev の DB と実 Gemini での確認・docs | なし(確認と docs だけ。#13・#15 の対象外) | 56-2 |

## サンプルコード一覧

- `textbook/samples/backend/`: 新規 `app/documents/test_spec/`(`__init__`・`model`・`links`・`obligations`・`assemble`・`markdown`・`validation`・`drafting`)・`tests/fixtures/spec_documents.py`・`tests/unit/test_test_spec_{obligations,model,validation,markdown,drafting,generation}.py`。更新 `app/repositories/generated_document.py`・`app/services/errors.py`・`app/schemas/document.py`・`app/services/design_stage_service.py`・`app/services/doc_generator_service.py`・`app/api/routes/projects.py`・`app/ai/llm/fake.py`・`tests/fixtures/external_design.py`・`tests/unit/test_doc_generation_start.py`・`test_doc_generator_service.py`・`test_review_sendback.py`
- `textbook/samples/frontend/`: 更新 `src/features/documents/api/documentsApi.ts`・`regenerationOps.ts`・`components/DocumentTabs.tsx`・`__tests__/regenerationOps.test.ts`

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| [56-1](./Phase-56-1.md) | `app/documents/test_spec/`(`model`・`obligations`・`links`・`assemble`・`markdown`・`validation`) | 必要なテストを決め、下書きから model を組み、md と検証の指摘を出す | エラー欄ごとの異常・`{id}` のセキュリティ・本文の境界・NFR・Must / ID の付番・対象と要件 ID の正規化・処理と単位 / 章立て・設計に無い・対応表 / 5つの指摘・写しが空・古い |
| [56-2](./Phase-56-2.md) | `drafting.py`・`doc_generator_service.py`・`projects.py`・`fake.py` | 両モードで生成し、版に入力の版を写し、`GET /test-spec` で返す | 簡易で5つ目ができる・自己診断に渡らない・失敗で組ごと戻る・古い / 詳細の 409・偽 LLM の契約(major 0)・処理と単位 |
| [56-3](./Phase-56-3.md) | (docs) | dev の DB で必要なテストの件数、実 Gemini で形と検証 | (使い捨てのスクリプト) |

## 写経順序(#23)

章番号順。各章の「この章で作成・更新したファイル」の表の順に写す。

実 import 監査(#15。全 import 文を読んで確かめた):

- 56-1: `model.py` は `typing`・`pydantic` と `app.documents.ids.seq_id`。`links.py` は `app.detailed_design.api_list.trigger_key`・`function_list.FunctionListModel`・`plan.PlanModel`・`procedure_doc.plan_units`・`app.documents.implementation_plan.model.ImplementationPlanModel`・`internal_design.model.InternalDesignModel`(以前の Phase)。`obligations.py` は `app.documents.external_design.model`(`BODY_METHODS`・`NO_BODY`・`ExternalDesignModel`)・`requirements.model.RequirementsModel` と同じ章の `model`。`assemble.py` は `api_list`(`endpoint_key`・`parse_trigger`)・`requirement_trace.normalize_req_id`・`external_design.assemble.split_ids`・`external_design.model`・`requirements.model` と同じ章の `links`・`model`。`markdown.py` は `app.detailed_design.document.markdown.md_table`・`app.documents.external_design.markdown.ids_cell` と同じ章の `model`。`validation.py` は `app.documents.issues`(`DocumentIssue`・`IssueLevel`)と同じ章の `assemble.api_key`・`model`。`__init__.py` は同じ章のモジュールだけ(`drafting` は re-export しない)。フィクスチャ `spec_documents.py` の 56-1 の分は `external_design.model`・`requirements.model`・`test_spec`(`CaseDraft`・`SpecPolicy`・`TestSpecDraft`)。
- 56-2: `drafting.py` は `langchain_core.messages`・`pydantic` と `app.documents.external_design.model`・`revision`(`NONE_TEXT`・`rows_text`)・56-1 の `assemble`・`model`・`obligations`。`doc_generator_service.py` の追記は `app.detailed_design.function_list.FunctionListModel`・`plan`(`PLAN_STAGE`・`PlanModel`)・`stages`(`doc_key`・`stage_key`)・56-1 の `test_spec`・同じ章の `drafting`・`repositories.generated_document.TEST_SPEC`・`schemas.document.TestSpecRead`・`services.errors.TestSpecUpstreamNotReadyError`(すべて同じ章の中で先に書く)。`fake.py` は同じ章の `drafting`。フィクスチャ `spec_documents.py` の 56-2 の分(`Viewpoint`・`drafting`)と `external_design.py`(`spec_output`・`TestSpecGenerationOutput`)も同じ章。
- 前方 import は無い。章が作成・更新するファイルは、その章のテストが少なくとも1度 import する(`design_stage_service.py` は `tests/fixtures/fake_llm_flow.py` 経由で `test_test_spec_generation.py` が、`DocumentTabs.tsx` は既存の `DocumentTabs.test.tsx` が import する)。

## 検証結果

- 章ごとの部分テスト: 56-1 `pytest tests/unit -k test_spec`(23件)、56-2 `test_test_spec_drafting.py`・`test_test_spec_generation.py`(10件)と `-k "doc_generator or generation or document"`、すべて成功。
- Phase 完了時の全体テスト(#18): devex-api 1244 件成功(8件は既定で除外の統合テスト)。devex-ui は `tsc --noEmit` 0・eslint 0・`src/features/documents` のテスト 68 件成功(全体は触った範囲が型と表示名だけなので流していない)。
- `ruff check` 成功(`ruff format` は使わない)。pyright: `app` 全体でエラー 0。
- dev の DB と実 Gemini: [56-3](./Phase-56-3.md)。
- `samples_check.py`(`--api-since HEAD --ui-since HEAD`): 不一致 0 件・作り忘れ 0 件(一致 652 / 並び順のみ差 8 / 例外 5)。「samples のみ」2件は以前からの `change-impact-demo` のルート。`link_check.py`: 切れ 0 件。

## 未消化の申し送り(#37)

Phase 55 から引き継いだもの:

- **Phase 57〜59 の未確定事項**: [51-5](../Phase-51/Phase-51-5.md)「未確定事項」(Phase 56 の分はこの Phase で決めた)。
- **「AI に提案を求める」・判定がログインの方法だけでセキュリティを埋めた・初期入力だけで MVP の範囲が対象外になった**: 差し戻しと聞き直しは Phase 54 で作った。効果は Phase 58 で確かめる。
- **テスト仕様書の中身の正しさ**: Phase 58(正解例と比べる)。この Phase では形と検証の件数だけを見た。
- **実装手順書に固有の欠陥のうち、決定的に調べられないもの**: PR-2・PR-4・PR-6・PR-7・PR-8。レビューの対象外のまま(51-5「範囲の外」)。Phase 58 で残りを数える。
- **プロンプトキャッシュ**: 入れていない。回のキャッシュのトークンを Phase 58 の測定で見て決める。
- **本番の手順**: `ANTHROPIC_API_KEY` の設定と superuser の昇格、`langchain-anthropic` の追加でイメージの作り直し、Phase 54 の Alembic 3本(Phase 59 の `OPERATIONS.md`)。この Phase は Alembic を足していない。
- **依存の更新**: `langchain-anthropic` の追加で `langchain-core` が 1.6.10 に上がった(Phase 52)。
- **生成のモデルと Gemini の無料枠**(51-1 の (f)): ステージ8の範囲の外。この Phase で、簡易モードの生成は1回につき構造化出力が5回になった(無料枠の RPD を1回分多く使う)。
- **devex-ui の「開発用」メニュー**: ステージ8の完了時に、ユーザーが外すかを決める。
- **画面の確認**(ユーザー。#37 の運用注記のとおり Phase 58・59 でまとめてよい): Phase 53 のパネルの長さ・対象の推定の当たり、Phase 54 のチップ・「採用 n(未対応 m)」・前の回で採用した指摘・「AI: 直った」・再生成のダイアログ・「採用した指摘で段階を作り直す」・「チャットで聞き直す」・各段階のバッジの強調・承認の知らせ、Phase 55 の手順書の「未定義・要決定の一覧」。
- **再生成の失敗を画面で知らせていない**(Phase 53 の完了後の調整から)。
- **dev の DB の事故の後始末**(Phase 54): ほかのプロジェクトの変更の影響の印は戻らない。
- **段階の作り直しの後に承認できない**(Phase 54): 差し戻しで作り直した段階の検証のエラーの見せ方は未検討。
- **「直ったか」の判定の精度**・**前の回で採用した指摘が積み上がる**・**段階の写しの大きさ**・**聞き直しのあとの再生成は利用者が押す**(Phase 54): Phase 58 で判定の精度を見てから決める。
- **スキーマのファイルを作る単位を、計画の生成で作らせていない**・**テストのファイルの指示の効果**・**依存の判定の除外が広すぎないか**(Phase 55): Phase 58 で確かめる。
- **段階4 の層の選択**(Phase 55 の完了後の調整): 今のデータの行は画面で「(構成図に無い)」のまま。段階4を作り直すか、層を選び直すと直る。
- 持ち越し: **DFD のデータストアの書き漏れ**(49-2 から)・**補いの文字の当たり**(Phase 48 から)・**画面の文の変更は、その画面のすべての処理へ届く**(49-4 から)・**改名の後に下流の参照を直して承認すると広がる**(Phase 43 から)。
- 持ち越し(触るときに直す): **`test_chat_service.py` の pyright の指摘4件**(Phase 40 から)・**並列のテストのタイムアウト**(Phase 44 から)・**偽 LLM の外部設計書の GET に DF が無い**(Phase 45 から)。

この Phase で生まれたもの:

- **テスト仕様書の画面**(Phase 57): プレビューのタブか段階8の隣か、検証の指摘・「古い」の出し方、詳細設計モードの「テスト仕様書を作る」ボタン(`POST /generate {start_from: "test_spec"}`)、詳細設計書の zip への同梱。生成の進み具合の表示は、今は4文書だけを並べている(テスト仕様書を作っている間も4文書が「生成完了」のまま)。
- **要件が API に結ばれていれば「テストがある」とみなす**: 見本の「FR-007(コピー)のテストが無い」は、実物(86a37228)では FR-007 が文書の一覧の API の要件にも入っているため、その API のテストで埋まって指摘されない。要件の中身(コピー・ダウンロード)ごとのテストの有無は決定的には見えない。Phase 58 の正解例で、この見落としを数える。
- **「設計に無い」の当たり**: 実 Gemini で詳細1件に9件・簡易1件に2件(上限値・他人のリソースのステータス・レート制限の値)。Phase 54 のレビューの指摘(持ち主の確認など)と同じものを、レビューの指摘から辿れるようにするかは Phase 57・58 で決める(見本の最後の段落)。
- **「日本語で書く」の効果**: 規則を足したあと、実 Gemini では流していない(簡易の1回目で方針の「対象」の一部が英語だった)。Phase 58 で確かめる。
- **簡易モードの再生成の時間と無料枠**: テスト仕様書の分(実測 約10秒・1回)が毎回増える。重ければ「テスト仕様書だけ作り直さない」起点を足すかを Phase 57 で検討する。
- **セッションの区切りの記録**: Phase 56 は1セッションで行った(計画モードで調査 → 着手時の質問1回(4問)→ 計画の確認中の質問「テストパターンの戦略」→ 追加の質問1回 → 計画の承認 → 56-1・56-2 の実装とテスト → dev の DB と実 Gemini 2回 → samples・教材・docs・記録)。

この Phase で解決したもの:

- **Phase 56 の未確定事項**(51-5): model の形・生成の入力・版と陳腐化・簡易モードの置き場を、着手時の相談と [56-1](./Phase-56-1.md)・[56-2](./Phase-56-2.md) で決めた。

## 後続 Phase での改訂

- Phase 59: `error_statuses` を `app/detailed_design/api_list.py` へ移した(簡易の手順書の検証と共有。パッケージの re-export は残した)。必要なテストの一覧に、本文の `…_id`・Must の画面ごとの操作・Must の機能要件ごと(API に結ばれていても)・失敗の要件を足した。「API・画面に結ばれていない Must の要件」の行は要件ごとの行にまとめた([59-4](../Phase-59/Phase-59-4.md)・[59-5](../Phase-59/Phase-59-5.md))。

## Phase 完了チェック(#22)

設問は Phase の要点の要約(回答は求めない)。

1. どのテストを作るかを LLM に任せず、コードが「必要なテストの一覧」を決めるのはなぜか。一覧を検証に使わないのはなぜか。
2. 処理・単位の列を LLM に書かせず、API のキーで引くのはなぜか。簡易と詳細で引く元が違うのはなぜか。
3. テスト仕様書を `DOC_TYPES_BY_MODE` に入れないのはなぜか。入れると何が起きるか。
4. 「古い」を、ステージ7の変更の影響の印ではなく、生成時の入力の版の写しで判定するのはなぜか。
5. 詳細設計モードで、段階1・段階7 が「承認済みで古くない」ことを前提にするのはなぜか。

## 次のフェーズ

Phase 57: テスト仕様書の画面と出力([51-5](../Phase-51/Phase-51-5.md))。プレビュー・ダウンロード・詳細設計書の zip への同梱・決定的な検証の指摘の表示。未確定事項は画面の置き場(5つ目の文書のタブか、段階8の隣か)と、検証の指摘の出し方。
