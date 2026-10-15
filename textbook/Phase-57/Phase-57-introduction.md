# Phase 57 導入: テスト仕様書の画面と出力

## 目的

[Phase 56](../Phase-56/Phase-56-introduction.md) で作ったテスト仕様書(`doc_type="test_spec"`・`GET /projects/{id}/test-spec`)を、画面に出し、詳細設計書の zip に入れる([51-5](../Phase-51/Phase-51-5.md) の Phase 57)。画面では件数・「古い」・決定的な検証の指摘・本文(コピー・ダウンロード・版の履歴)を見られ、詳細設計モードは画面のボタンで作れるようにする。

- 詳細設計書の zip への同梱(古くない版だけ)── [57-1](./Phase-57-1.md)
- 共用のパネルと、簡易モードのプレビューのタブ ── [57-2](./Phase-57-2.md)
- 詳細設計モードの詳細設計画面(ステッパーの行・作るボタン・zip の注記)── [57-3](./Phase-57-3.md)
- dev の DB での確認・docs ── [57-4](./Phase-57-4.md)

## パイプライン上の位置づけ・前提

```
                       ┌─ 簡易: SCR-005 の5つ目のタブ「テスト仕様」 ─┐
GET /test-spec ────────┤                                             ├─ TestSpecPanel(件数・古い・作る/作り直す・検証の結果・本文)
(件数・指摘・古い・     └─ 詳細: SCR-008 のステッパーの段階8の下の行 ─┘
 設計に無い)
POST /generate {start_from: "test_spec"} ← 簡易: 文書の再生成の流れ / 詳細: test-spec-store
GET /design-stages/document(詳細設計書の zip)── 今の版が古くなければ test_spec.md を入れる
```

- **前提として読むもの**: [Phase 56 の introduction](../Phase-56/Phase-56-introduction.md) の「未消化の申し送り」(テスト仕様書の画面)、[51-5](../Phase-51/Phase-51-5.md) の Phase 57 の未確定事項(画面の置き場・検証の指摘の出し方)。
- **今の仕組み**: プレビュー(`DocumentsPageContent` → `DocumentTabs` → `DocumentMarkdownView`)は4文書を `GET /documents` から出す。テスト仕様書は文書の一覧に出ない(Phase 56 で `DOC_TYPES_BY_MODE` に入れなかった)ので、別に取る。詳細設計画面(`DetailedDesignPageContent`)は `StageStepper` と `StageWorkArea`、上部に zip のダウンロード(`DesignDocumentBar`)。
- **この Phase を始めた時点の状態**: Phase 56 までコミット済み。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(AI が devex-api・devex-ui の本体へ実装し、`textbook/samples/` も同じ内容で作る)。

E2E: この Phase では流さない([51-5](../Phase-51/Phase-51-5.md) のとおり Phase 59)。プレビューに5つ目のタブ、詳細設計画面のステッパーに1行増えたので、既存の E2E がタブやステッパーの行の数を見ていれば Phase 59 で直す。

実 LLM: 呼んでいない(Gemini・Anthropic とも。費用 $0)。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 57 開始時」を参照。

1. **自動実装モード**: on(推奨どおり)。
2. **画面の置き場**: 簡易 = プレビュー(SCR-005)のタブ、詳細 = 詳細設計画面(SCR-008)(**推奨と違う**。推奨は両モードともプレビューのタブ)。簡易は4文書と一緒に作り、詳細は段階7の後に作る、という作る時点に置き場を合わせた。部品は共用する。
3. **検証の指摘・「古い」の出し方**: 実装手順書と同じ検証のパネル(重要度の絞り込み + 表)(**推奨と違う**。推奨は4文書の要約パネルと同じ形)。
4. **zip**: 古くない今の版だけ入れる。無い・古いときは入れず、ダウンロードのバーに理由を出す(推奨どおり)。

Claude の判断(計画の承認で確定、または作業中):

- **zip には md だけ**(HTML は入れない)。md → HTML の変換が devex-api に無いため。
- **詳細の置き場はステッパーの段階8の下の行**(段階ではないので承認は無く、状態は 未作成・古い・作成済み)。ストアの `selectedStage` には混ぜず、画面のローカルな状態で切り替える([57-3](./Phase-57-3.md))。
- **段階7 の承認のダイアログから案内**(自動では作らない)。
- **簡易の再生成の進み具合に「テスト仕様」**を並べる。「テスト仕様書だけ作り直さない」起点は足さず、パネルに「作り直す」(`start_from: "test_spec"`)を置いた。
- **表の列は 重要度・対象・内容**(手順書の出どころ・単位・操作はテスト仕様書に無い)。
- 作業中に決めたこと: 「設計に無い」の件数を API に足した(`TestSpecRead.design_gaps`。md の末尾にしか出ていなかったため)。今の版と「古い」の判定は、循環 import を避けて `app/services/test_spec_state.py` に切り出した([57-1](./Phase-57-1.md))。手順書のパネルの絞り込みと色を部品・定数に切り出した([57-2](./Phase-57-2.md))。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-57-1.md`](./Phase-57-1.md) | 今の版と「古い」の共用・詳細設計書の zip への同梱 | あり | なし |
| [`Phase-57-2.md`](./Phase-57-2.md) | 「設計に無い」の件数・API の型とストア・絞り込みの部品・パネル・プレビューのタブ | あり | 57-1 |
| [`Phase-57-3.md`](./Phase-57-3.md) | ステッパーの行・作業領域の切り替え・段階7 のダイアログ・zip の注記 | あり | 57-2 |
| [`Phase-57-4.md`](./Phase-57-4.md) | dev の DB での確認・docs | なし(確認と docs だけ。#13・#15 の対象外) | 57-3 |

## サンプルコード一覧

- `textbook/samples/backend/`: 新規 `app/services/test_spec_state.py`。更新 `app/services/doc_generator_service.py`・`app/services/detailed_design_export_service.py`・`app/documents/test_spec/validation.py`・`__init__.py`・`app/schemas/document.py`・`tests/unit/test_detailed_design_export.py`・`test_test_spec_validation.py`・`test_test_spec_generation.py`
- `textbook/samples/frontend/`: 新規 `src/features/documents/testSpecOps.ts`・`test-spec-store.ts`・`test-utils/testSpecFixtures.ts`・`components/TestSpecIssuePanel.tsx`・`components/TestSpecPanel.tsx`・`src/features/detailed-design/components/FindingLevelFilter.tsx` とそれぞれのテスト。更新 `documentsApi.ts`・`regenerationOps.ts`・`DocumentTabs.tsx`・`DocumentsPageContent.tsx`・`VersionHistoryPanel.tsx`・`detailed-design/labels.ts`・`ProcedureDocPanel.tsx`・`StageStepper.tsx`・`DesignDocumentBar.tsx`・`DetailedDesignPageContent.tsx` とそれぞれのテスト

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| [57-1](./Phase-57-1.md) | `test_spec_state.py`・`detailed_design_export_service.py` | 今の版と「古い」を共用し、古くなければ zip に md を入れる | 入る / 無い / 古い・`get_test_spec` が変わらない |
| [57-2](./Phase-57-2.md) | `testSpecOps.ts`・`test-spec-store.ts`・`FindingLevelFilter.tsx`・`TestSpecPanel.tsx`・`DocumentsPageContent.tsx` | 表示の判断を純粋関数に、取得と生成をストアに、表示をパネルにまとめ、簡易のタブに置く | 状態・件数・指摘の行 / 404 → null・`start_from` / 絞り込み / 古い・未作成・作っている間 / タブ・作り直し・進み具合 |
| [57-3](./Phase-57-3.md) | `StageStepper.tsx`・`DetailedDesignPageContent.tsx`・`DesignDocumentBar.tsx` | 詳細のステッパーに行を足し、作業領域を切り替え、zip の注記を出す | 行の状態と選択・作れない理由・作る・段階7 のダイアログ・簡易は出さない・注記の行 |
| [57-4](./Phase-57-4.md) | (docs) | dev の DB で件数・zip を確かめる | (使い捨てのスクリプト) |

## 写経順序(#23)

章番号順。各章の「この章で作成・更新したファイル」の表の順に写す。

実 import 監査(#15。全 import 文を読んで確かめた):

- 57-1: `test_spec_state.py` は `pydantic.ValidationError`・`sqlalchemy`・`app.detailed_design.plan.PLAN_STAGE`・`stages`(`doc_key`・`stage_key`)・`app.documents.test_spec`(`TestSpecModel`・`is_outdated`)・`models`(`GeneratedDocument`・`Project`)・`repositories.generated_document`(`DOC_TYPES_BY_MODE`・`TEST_SPEC`・`GeneratedDocumentRepository`)・`services.design_stage_service.DesignStageService`(すべて以前の Phase)。`doc_generator_service.py`・`detailed_design_export_service.py` は同じ章の `test_spec_state`。テストは同じ章の `TEST_SPEC_MARKDOWN_NAME`・`current_test_spec`・`spec_inputs` と以前の Phase のもの。
- 57-2: `validation.py` の追記は import なし、`__init__.py`・`doc_generator_service.py` は同じ章の `design_gap_count`。devex-ui は `documentsApi.ts` が既存の `ApiError`、`FindingLevelFilter.tsx` が既存の型と `FINDING_LEVEL_LABELS`、`ProcedureDocPanel.tsx` が同じ章で先に書く `FindingLevelFilter`・`FINDING_LEVEL_COLORS`、`testSpecOps.ts` が同じ章の `TestSpecRead` と以前の Phase の `DesignStageRead`・`FindingLevel`、`test-spec-store.ts` が同じ章の `getTestSpec` と既存の `triggerGeneration`、`VersionHistoryPanel.tsx` が同じ章の `useTestSpecStore`、`TestSpecIssuePanel.tsx`・`TestSpecPanel.tsx`・`DocumentsPageContent.tsx` が同じ章で先に書くファイル。
- 57-3: `StageStepper.tsx` は 57-2 の `testSpecOps`、`DetailedDesignPageContent.tsx` は 57-2 の `TestSpecPanel`・`useTestSpecStore`・`testSpecOps` と既存の `useGenerationPolling`。
- 前方 import は無い。章が作成・更新するファイルは、その章のテストが少なくとも1度 import する(`test_spec_state.py` は `test_detailed_design_export.py` が直接、`schemas/document.py` は `test_test_spec_generation.py` が `get_test_spec` 経由で、`labels.ts` は `FindingLevelFilter.test.tsx` 経由で、`ProcedureDocPanel.tsx` は既存の `ProcedureDocPanel.test.tsx` が import する)。

## 検証結果

- 章ごとの部分テスト: 57-1 `test_detailed_design_export.py`・`test_test_spec_generation.py`(19件)、57-2 `pytest -k "test_spec or export"`(77件)と `vitest src/features/documents`・`FindingLevelFilter`・`ProcedureDocPanel`、57-3 `StageStepper`・`DesignDocumentBar`・`DetailedDesignPageContent`(33件)、すべて成功。
- Phase 完了時の全体テスト(#18): devex-api 1246 件成功(8件は既定で除外の統合テスト)。devex-ui は 887/888(残る1件 `IntakeForm.test.tsx` はこの Phase で触っていないファイルで、単独で流すと成功 ── 既知の並列のタイムアウト。API のテストと同時に流した1回目は負荷で18件がタイムアウトし、その10ファイルも単独ではすべて成功)。
- `ruff check` 成功(`ruff format` は使わない)。pyright: `app` 全体でエラー 0。devex-ui `tsc --noEmit` 0・eslint エラー 0(警告1件は以前からの `streamChat.test.ts`)。
- dev の DB: [57-4](./Phase-57-4.md)。
- `samples_check.py`(`--api-since HEAD --ui-since HEAD`): 不一致 0 件・作り忘れ 0 件(一致 664 / 並び順のみ差 8 / 例外 5)。「samples のみ」2件は以前からの `change-impact-demo` のルート。`link_check.py`: 切れ 0 件。

## 完了後の調整

ユーザーの質問「単体テストは生成対象に含めていない?また、その理由は?」への回答(含めていない。[51-2](../Phase-51/Phase-51-2.md) の決定7・8 で「単体テストは今の手順書のテスト観点のまま」とした)の後、UI の調整の指示があった。経緯は [`q_a.md`](../q_a.md) の「Phase 57 完了後の調整」。

1. 名前を「テスト仕様書(結合・総合)」にした: 文書の見出し(md の H1。両モード共通。`app/documents/test_spec/markdown.py` の `TITLE`)、簡易のタブ(`DocumentTabs.tsx`)、詳細のステッパーの行(`StageStepper.tsx`)。画面の名前は `testSpecOps.ts` の `TEST_SPEC_TITLE` にまとめ、詳細の作業領域の見出し(H3)も同じ名前にそろえた(Claude の判断。すぐ下の md の H1 と食い違わないように)。再生成の進み具合の「テスト仕様」は変えていない。
2. 見出しの下に「※単体テストのテスト観点は実装手順書で個別に確認」(`UNIT_TEST_NOTE`)を md に書く。ダウンロード・zip の md にも載る。

保存済みの版の md は書き換えていない(md は生成時に model から組み立てて保存する)。dev の確認用(33fdda56・86a37228)は、作り直すと新しい見出しと注記になる。

| ファイル | 内容 |
| --- | --- |
| [`app/documents/test_spec/markdown.py`](../samples/backend/app/documents/test_spec/markdown.py) | `TITLE`・`UNIT_TEST_NOTE` |
| [`src/features/documents/testSpecOps.ts`](../samples/frontend/src/features/documents/testSpecOps.ts) | `TEST_SPEC_TITLE` |
| [`src/features/documents/components/DocumentTabs.tsx`](../samples/frontend/src/features/documents/components/DocumentTabs.tsx) | タブの名前 |
| [`src/features/detailed-design/components/StageStepper.tsx`](../samples/frontend/src/features/detailed-design/components/StageStepper.tsx) | 行の名前 |
| [`src/features/detailed-design/components/DetailedDesignPageContent.tsx`](../samples/frontend/src/features/detailed-design/components/DetailedDesignPageContent.tsx) | 作業領域の見出し |
| テスト | `test_test_spec_markdown.py`(見出しと注記)・`testSpecFixtures.ts`・`DocumentTabs.test.tsx`・`TestSpecPanel.test.tsx`・`StageStepper.test.tsx`・`DetailedDesignPageContent.test.tsx` |

確認: `pytest -k "test_spec or export"` 77件・`vitest src/features/documents` と `StageStepper`・`DetailedDesignPageContent` 114件、すべて成功。`samples_check.py` 不一致 0 件。

## 未消化の申し送り(#37)

Phase 56 から引き継いだもの:

- **Phase 58〜59 の未確定事項**: [51-5](../Phase-51/Phase-51-5.md)「未確定事項」(Phase 57 の分はこの Phase で決めた)。
- **「AI に提案を求める」・判定がログインの方法だけでセキュリティを埋めた・初期入力だけで MVP の範囲が対象外になった**: 差し戻しと聞き直しは Phase 54 で作った。効果は Phase 58 で確かめる。
- **テスト仕様書の中身の正しさ**: Phase 58(正解例と比べる)。
- **要件が API に結ばれていれば「テストがある」とみなす**(Phase 56): 要件の中身ごとのテストの有無は決定的には見えない。Phase 58 の正解例で、この見落としを数える。
- **「日本語で書く」の効果**(Phase 56): Phase 58 で確かめる。
- **実装手順書に固有の欠陥のうち、決定的に調べられないもの**: PR-2・PR-4・PR-6・PR-7・PR-8。Phase 58 で残りを数える。
- **プロンプトキャッシュ**: 回のキャッシュのトークンを Phase 58 の測定で見て決める。
- **本番の手順**: `ANTHROPIC_API_KEY` の設定と superuser の昇格、`langchain-anthropic` の追加でイメージの作り直し、Phase 54 の Alembic 3本(Phase 59 の `OPERATIONS.md`)。この Phase は Alembic を足していない。
- **依存の更新**: `langchain-anthropic` の追加で `langchain-core` が 1.6.10 に上がった(Phase 52)。
- **生成のモデルと Gemini の無料枠**(51-1 の (f)): ステージ8の範囲の外。簡易モードの生成は1回につき構造化出力が5回(Phase 56)。
- **devex-ui の「開発用」メニュー**: ステージ8の完了時に、ユーザーが外すかを決める。
- **画面の確認**(ユーザー。#37 の運用注記のとおり Phase 58・59 でまとめてよい): Phase 53 のパネルの長さ・対象の推定の当たり、Phase 54 のチップ・「採用 n(未対応 m)」・前の回で採用した指摘・「AI: 直った」・再生成のダイアログ・「採用した指摘で段階を作り直す」・「チャットで聞き直す」・各段階のバッジの強調・承認の知らせ、Phase 55 の手順書の「未定義・要決定の一覧」、**Phase 57 のテスト仕様書(簡易のタブ・作り直しと進み具合・詳細のステッパーの行・作るボタンと理由・段階7 のダイアログ・検証の結果の表と絞り込み・版の履歴の復元・zip の注記と中身)**。
- **再生成の失敗を画面で知らせていない**(Phase 53 の完了後の調整から)。テスト仕様書の作り直しも同じ(失敗すると「作っています」が消えるだけ)。
- **dev の DB の事故の後始末**(Phase 54): ほかのプロジェクトの変更の影響の印は戻らない。
- **段階の作り直しの後に承認できない**(Phase 54): 差し戻しで作り直した段階の検証のエラーの見せ方は未検討。
- **「直ったか」の判定の精度**・**前の回で採用した指摘が積み上がる**・**段階の写しの大きさ**・**聞き直しのあとの再生成は利用者が押す**(Phase 54): Phase 58 で判定の精度を見てから決める。
- **スキーマのファイルを作る単位を、計画の生成で作らせていない**・**テストのファイルの指示の効果**・**依存の判定の除外が広すぎないか**(Phase 55): Phase 58 で確かめる。
- **段階4 の層の選択**(Phase 55 の完了後の調整): 今のデータの行は画面で「(構成図に無い)」のまま。
- 持ち越し: **DFD のデータストアの書き漏れ**(49-2 から)・**補いの文字の当たり**(Phase 48 から)・**画面の文の変更は、その画面のすべての処理へ届く**(49-4 から)・**改名の後に下流の参照を直して承認すると広がる**(Phase 43 から)。
- 持ち越し(触るときに直す): **`test_chat_service.py` の pyright の指摘4件**(Phase 40 から)・**並列のテストのタイムアウト**(Phase 44 から。この Phase でも `IntakeForm.test.tsx` が全体の実行で1件)・**偽 LLM の外部設計書の GET に DF が無い**(Phase 45 から)。

この Phase で生まれたもの:

- **「設計に無い」とレビューの指摘の結び付け**: Phase 56 の申し送り(見本の最後の段落)。この Phase では件数を画面に出すだけにした。レビューの指摘から辿れるようにするかは Phase 58 の結果で決める。
- **zip の HTML**: テスト仕様書は md だけを入れた。HTML が要れば、model から組む(詳細設計書・実装手順書と同じ形)。
- **詳細設計モードのテスト仕様書を作ったまま生成中に画面を開き直す**: ボタンは押せる(押すと 409 生成中で、その完了を待つ)。生成中の表示は出ない(プロジェクトの状態を読んでいない)。気になれば `fetchProjectMode` と同じく状態を読む。
- **E2E のタブ・ステッパーの行の数**: プレビューのタブ(簡易)とステッパーの行(詳細)が1つずつ増えた。Phase 59 の E2E で数を見ていれば直す。
- **セッションの区切りの記録**: Phase 57 は1セッションで行った(計画モードで調査 → 着手時の質問1回(4問、うち2問が推奨と違う)→ 計画の承認 → 57-1〜57-3 の実装とテスト → dev の DB → samples・教材・docs・記録)。

この Phase で解決したもの:

- **テスト仕様書の画面**(Phase 56 の申し送り): 簡易は [57-2](./Phase-57-2.md)、詳細は [57-3](./Phase-57-3.md)。詳細設計モードの「テスト仕様書を作る」ボタンと zip への同梱([57-1](./Phase-57-1.md))も。
- **生成の進み具合にテスト仕様書が出ない**(Phase 56 の申し送り): 簡易の進み具合に「テスト仕様」を並べた([57-2](./Phase-57-2.md))。
- **簡易モードの再生成の時間と無料枠**(Phase 56 の申し送り): 「テスト仕様書だけ作り直さない」起点は足さないと決めた(introduction の Claude の判断)。
- **Phase 57 の未確定事項**(51-5): 画面の置き場と検証の指摘の出し方を、着手時の相談で決めた。

## Phase 完了チェック(#22)

設問は Phase の要点の要約(回答は求めない)。

1. 詳細設計書の zip に、古いテスト仕様書を入れないのはなぜか。テスト仕様書が無い・古いことを、zip を断る理由にしないのはなぜか。
2. 「今の版と古いか」の判定を、`DocGeneratorService` のメソッドから別のモジュールに移したのはなぜか(import の向き)。
3. テスト仕様書の置き場をモードで分けても、パネルを1つにできるのはなぜか。取得と生成をパネルの外(親)に置いたのはどう効いているか。
4. 簡易モードの作り直しを、テスト仕様書のストアではなく文書の再生成の流れで行うのはなぜか。
5. 詳細設計画面で、テスト仕様書を選んでいる状態をストアの `selectedStage` に混ぜなかったのはなぜか。

## 次のフェーズ

Phase 58: 効果測定([51-5](../Phase-51/Phase-51-5.md))。ベースラインと同じ題材・正解表を、実装した仕組みで測る(区切りごとのレビュー・再ヒアリングで D-NAT-1 が拾えるか・手順書の検証の件数・テスト仕様書の正解例)。Sonnet を回すので、計画に見込みコストの表を載せる。未確定事項は合格の基準・正解表を付け直すか・テスト仕様書の正解例の作り方。
