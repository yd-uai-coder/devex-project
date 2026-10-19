# Phase 38 導入: 要件 → 処理・作業単位(ステージ6)

## 目的

Phase 36・37 で要件定義書と外部設計書に付いた要件ID(`FR-001`)を、下流の処理(詳細設計モードの段階1)と作業単位(段階7・簡易モードの実装計画書の WBS)へつなぐ。段階1の処理に要件ID を持たせ、WBS のタスクに「要件」欄を書かせて読み、処理・作業単位の無い Must の機能要件を指摘する。詳細設計書の 01 と実装手順書に、要件との対応を載せる。ステージ6の目的のうち「要件から作業単位まで追跡できるようにする」([README](../../README.md) のステージ表)を、この Phase で満たす。

方針は [Phase 33-2](../Phase-33/Phase-33-2.md) 決定4・7、計画は [33-5](../Phase-33/Phase-33-5.md) の Phase 38。形の見本は `appendix/structured-requirements-sample/traceability.md`。

## パイプライン上の位置づけ・前提

```
要件定義書(model: FR/NFR/CON の行)── Phase 36
   │ 要件ID の写し(known_req_ids・must_fr_ids)
   ▼
外部設計書(model: 画面・API の行に要件ID)── Phase 37
   │ 2.6 の API の要件ID
   ▼
[38-1 純粋関数]  段階1の処理の req_ids・WBS の「要件」欄・要件の追跡と検証(requirement_trace.py)
   ▼
[38-2 配線]      段階1の下書きが API の要件ID を写す・WBS のプロンプト・
                 手順書の「要件との対応」と NFR/CON の表・詳細設計書 01 の「要件」列・段階8の応答
   ▼
[38-3 画面]      段階1の「要件」の欄・段階8の単位の一覧の「要件」列
   ▼
Phase 39 効果測定(実 LLM で、要件ID の付き方と追跡の指摘を数える)
```

- 前提として読むもの:
  - [Phase 37 の introduction](../Phase-37/Phase-37-introduction.md)(外部設計書の model と、要件定義書の要件ID の写し)
  - [Phase 31 の introduction](../Phase-31/Phase-31-introduction.md)(簡易モードの WBS の決まった書式と `parse_wbs`)
  - [Phase 30 の introduction](../Phase-30/Phase-30-introduction.md)(実装手順書の出力: index・単位の md・AI 向けの版)
  - [外部設計書](../../docs/external_design.md) 2.9節「要件からの追跡」と、[内部設計書](../../docs/internal_design.md) 3.3節「6. ヒアリングと上流の構造化」の「要件 → 処理」

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(AI が本体へ実装し、`textbook/samples/` も同じ内容で作る)。

E2E: この Phase では流さない。段階1の表に列が増え、関連画面の欄の区切りが「/」から「, 」に変わり、手順書の index の節の番号が変わった。偽 LLM の段階1と WBS は指摘0件のまま。Phase 40 で既存を含めて全部流して確かめる。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 38 開始時」を参照。4つとも推奨どおり(3つ目は2案の詳しい比較を見てから選んだ)。

1. **自動実装モード**: on。
2. **段階1の `req_ids` の下書き**: API の処理は、外部設計書の model の 2.6 の同じ API の行から、コードが写す。API でない処理(画面・バッチ)と 2.6 に無い API だけ AI が書く。再生成では下書きを作り直す。編集は関連画面と同じ形の入力欄([38-1](./Phase-38-1.md)・[38-3](./Phase-38-3.md))。
3. **NFR・CON**: 案1。実装手順書の「2. 実装前提・制約」に、要件定義書の model の NFR・CON を「ID・大項目・種類・要件・出どころ」の表でコードが載せる(両モード)。段階7は変えない。横断事項との結び付け(案2)は Phase 39 の結果を見て判断([38-2](./Phase-38-2.md))。
4. **追跡表の置き場**: 手順書 + 詳細設計書。手順書の index に「4. 要件との対応」(要件 → 処理 → 単位)と単位の一覧の「要件」列、詳細設計書の 01 機能一覧に「要件」列([38-2](./Phase-38-2.md))。

Claude の判断(計画の承認で確定。[33-5](../Phase-33/Phase-33-5.md) の残りの未確定事項):

- **要件の照合の入り口**: 段階1は入力の外部設計書の model に写した要件ID と照らす(段階1の入力を増やさない)。段階8と手順書は要件定義書の model を読む。どちらも `StageSources.document_models` で渡す([38-1](./Phase-38-1.md))。
- **WBS の「要件」欄の書式の揺れ**: 「要件」「要件ID」を読み、`FR-001` の形にそろえ(`fr-1` も可)、形の違う値は軽微な指摘([38-1](./Phase-38-1.md))。
- **検証**: 段階1は警告だけ(処理の無い Must の機能要件・要件の無い処理・要件定義書に無い要件ID)。簡易モードの段階8は、単位の無い Must の機能要件(中程度)・要件の無い機能の単位・要件定義書に無い要件ID(軽微)。要件ID の無い文書は再生成の案内1件だけ。詳細設計モードの段階8には足さない([38-1](./Phase-38-1.md))。
- **段階パネルの要件**: 段階7のパネルは段階1を持たないので、要件は段階8の単位の一覧に出す(`DesignStageRead.unit_req_ids`)。

実装中の判断(計画からの変更):

- **追跡の関数の置き場**: 計画の `app/documents/requirements/trace.py` でなく `app/detailed_design/requirement_trace.py` にした。段階1の処理と作業単位を読むので、文書の側から詳細設計を読む向きを作らないため([38-1](./Phase-38-1.md))。
- **関連画面の欄の不具合**: 段階1の関連画面の欄は区切りの「/」を打った瞬間に消えていた。要件の欄を足すにあたり、段階4・7の `ListInput`(「,」区切り)に寄せ、関連画面も同じ欄にした([38-3](./Phase-38-3.md))。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-38-1.md`](./Phase-38-1.md) | 処理と WBS のタスクの要件ID・要件の追跡の純粋関数・段階1と簡易モードの段階8の検証 | あり(BE) | なし |
| [`Phase-38-2.md`](./Phase-38-2.md) | 文書の model の受け渡し・段階1の下書き・WBS のプロンプト・手順書と詳細設計書の出力・段階8の応答・偽 LLM | あり(BE) | 38-1 |
| [`Phase-38-3.md`](./Phase-38-3.md) | 段階1の「要件」の欄・段階8の「要件」列 | あり(FE) | 38-2 |

## サンプルコード一覧

- 38-1(`textbook/samples/backend/`): `app/detailed_design/function_list.py`・`plan.py`・`requirement_trace.py`・`simple_procedure/wbs.py`・`validation.py`、テスト `tests/fixtures/simple_procedure.py`・`tests/fixtures/detailed_design.py`・`test_requirement_trace.py`・`test_function_list.py`・`test_simple_wbs.py`・`test_simple_procedure_validation.py`
- 38-2(同): `app/detailed_design/procedure_basis.py`・`procedure_output/source.py`・`procedure_output/markdown.py`・`procedure_output/html.py`・`document/markdown.py`・`document/html.py`・`drafting.py`・`app/schemas/design_stage.py`・`app/services/design_stage_service.py`・`detailed_design_export_service.py`・`design_stage_generation_service.py`・`doc_generator_service.py`・`app/ai/llm/fake.py`、テスト `tests/fixtures/detailed_design.py`・`tests/fixtures/simple_procedure.py`・`tests/fixtures/external_design.py`・`test_design_stage_generation.py`・`test_detailed_design_document_markdown.py`・`test_procedure_markdown.py`・`test_procedure_html.py`・`test_doc_generator_service.py`・`test_fake_llm_detailed_design.py`・`test_fake_llm_simple_procedure.py`
- 38-3(`textbook/samples/frontend/`): `src/features/detailed-design/api/types.ts`・`functionListOps.ts`・`components/ListInput.tsx`・`components/FunctionListPanel.tsx`・`components/ProcedureDocPanel.tsx`、テスト `test-utils/stageFixtures.ts`・`__tests__/functionListOps.test.ts`・`components/__tests__/FunctionListPanel.test.tsx`・`components/__tests__/ProcedureDocPanel.test.tsx`

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 作成・更新するファイル | 責務1行 | テスト観点 |
|---|---|---|---|
| [38-1](./Phase-38-1.md) | `function_list.py`・`plan.py` | 処理とタスクに要件ID、API の処理は外部設計書から写す | 写し・下書きの値・空白と重複 |
| | `requirement_trace.py` | 要件の索引・単位の要件・要件ごとの処理と単位・NFR と CON(純粋) | 詳細(処理から導く)と簡易(WBS)、Won't を除く、model が無い・壊れた |
| | `wbs.py` | 「要件」欄を読み、形をそろえる | 「要件ID」・全角・小文字・形の違う値 |
| | `validation.py` | 段階1と簡易モードの段階8の要件の追跡 | 各コード・重要度・直す先、要件ID の無い文書は1件だけ |
| [38-2](./Phase-38-2.md) | `procedure_basis.py`・`procedure_output/*` | 単位の要件、index の「要件との対応」と NFR/CON の表 | 6つの節、詳細と簡易の行、AI 向けの「実現する要件」、HTML |
| | `document/*` | 01 の「要件」列 | 列名と値 |
| | `drafting.py`・`design_stage_generation_service.py`・`design_stage_service.py`・`schemas/design_stage.py`・`detailed_design_export_service.py` | model の受け渡し・段階1の写し・段階8の応答 | 写しが下書きに入る、偽 LLM の段階1が指摘0件、`unit_req_ids` |
| | `doc_generator_service.py`・`fake.py`・テストの土台 | WBS の「要件」欄 | 例の WBS が読める、偽 LLM の簡易モードが指摘0件 |
| [38-3](./Phase-38-3.md) | `types.ts`・`functionListOps.ts`・`FunctionListPanel.tsx`・`ListInput.tsx` | 段階1の要件の欄(関連画面も同じ欄に) | 「, 」で続けて打てる、配列で保存 |
| | `ProcedureDocPanel.tsx` | 段階8の単位の要件の列 | 応答の値を出す、無ければ「—」 |

## 写経順序(#23)

章番号順(38-1 → 38-2 → 38-3)。各章の「この章で作成・更新したファイル」の表の順に写す。

実 import 監査(#15):

- 38-1: `function_list.py` は `collections.abc.Mapping` を足しただけ。`plan.py` は新しい import 無し。`requirement_trace.py` は `function_list.FunctionRow`(Phase 16-2)・`procedure_doc.PlanUnit`(Phase 27)・`api_list.endpoint_key`(Phase 16-1)・`app.documents.requirements.model`(`RequirementRow`・`RequirementsModel`・`parse_requirement_id`・`requirement_id`、Phase 36-1)を読む。`wbs.py` は `requirement_trace.normalize_req_id`(同じ章の先の行)、`validation.py` は `requirement_trace` の4つ(同じ章の先の行)を読む。テストは同じ章の作成物と `tests.fixtures.simple_procedure.REQUIREMENTS_MODEL`(同じ章)を読む。
- 38-2: `procedure_basis.py` は `function_list`(`FunctionListModel`・`FunctionRow`、Phase 16-2)・`requirement_trace.unit_req_ids`(38-1)を読む。`procedure_output/source.py` は `requirement_trace`(38-1)と `RequirementRow`(Phase 36-1)、`markdown.py` は `source.REQUIREMENTS_MISSING_TEXT`(同じ章の先の行)と `SOURCE_LABEL`(Phase 36-1)、`html.py` は `markdown.py` の表の見出しと行の関数(同じ章の先の行)を読む。`design_stage_generation_service.py` は `requirement_trace.api_req_ids`(38-1)を読む。他のファイルは新しい import 無し。`tests/fixtures/external_design.py` は `app.documents.requirements`(`build_model`・`render_requirements`・`build_requirements_messages`・`to_draft`、Phase 36)を読む。テストは同じ章と 38-1 の作成物を読む。
- 38-3: `FunctionListPanel.tsx` は `ListInput`(Phase 23-6)を読み、`functionListOps` の `screensToText`・`textToScreens` を読まなくなった(同じ章で削除)。他は新しい import 無し。
- 前方 import は無い。章が作成・更新するファイルは、その章のテストが少なくとも1度 import する(38-1 の `plan.py` は `test_requirement_trace.py`・`test_simple_wbs.py`、`requirement_trace.py` は `test_requirement_trace.py`、`validation.py` は `test_function_list.py`。38-2 の `procedure_basis.py`・`source.py` は `test_procedure_markdown.py` が fixture 経由で、`drafting.py`・`design_stage_generation_service.py` は `test_design_stage_generation.py`、`schemas/design_stage.py`・`design_stage_service.py` は `test_fake_llm_simple_procedure.py`、`detailed_design_export_service.py`・`document/*` は `test_fake_llm_detailed_design.py`・`test_detailed_design_document_markdown.py`、`doc_generator_service.py`・`fake.py` は `test_doc_generator_service.py`・偽 LLM のテスト。38-3 の `ListInput.tsx`・`types.ts` は `FunctionListPanel.test.tsx` が読む)。

## 検証結果

- 部分テスト: devex-api の変更した範囲のテスト、ruff check(全体)・pyright(変更したファイル、0 件)。devex-ui の `src/features/detailed-design` 277 件成功、`tsc --noEmit`・eslint 成功。
- マイグレーション: 無し(要件ID は `design_stages.model`・`generated_documents.model` の JSON に入る。既存の段階1は `req_ids` が空として読む)。
- Phase 完了時の全体テスト(#18): devex-api 920 件成功(この Phase で 13 件増)、devex-ui 704 件成功(`--maxWorkers=4`。1 件増)、`npm run build` 成功。
- 統合テスト: `tests/integration` を専用の DB(`docker-compose.test.yml`)で流し、8 件成功。1回目は1件失敗したが、原因は登録のレート制限(同じ IP で1時間10回。開発用の Redis を共有)で、カウンタが切れてから流し直して全件成功した。統合テストは続けて何度も流さない。
- `samples_check.py`(`--api-since HEAD --ui-since HEAD`): 不一致 0 件・作り忘れ 0 件(一致 514 / 並び順のみ差 8 / 例外 5)。`link_check.py`: 切れ 0 件。

## 未消化の申し送り(#37)

Phase 37 から引き継いだもの:

- **持ち越し(Phase 22 から)**:
  - 段階6が開いていないときの、05 の詳細バッジ
  - ER の主キーの NULL の表示
- **E2E を CI で流すか**: 未定([`retrospective-memo.md`](../retrospective-memo.md) に候補として記録済み)。#36 のまま続ける。
- **コミュニケーション図**: 後回し([25-5](../Phase-25/Phase-25-5.md))。
- **「段階Nで直す」の移動先での強調**: 段階5は手順・処理を開くが、段階3・4・7は段階を開くだけ。必要なら各パネルに `focus` を読ませる。
- **「AI に提案を求める」**: ステージ8(AI 設計レビュー・再ヒアリング)との境界として申し送る。
- **段階8の生成の入力の大きさ**(Phase 29 から): 問題になれば測る。
- **生成済みの簡易モードのプロジェクト**: Phase 31 より前に生成した文書では、段階8の単位が空になる。文書を再生成すると使える。
- **WBS の書式の守られ方**: ベースライン(33-1)の簡易モードでも、WBS は書式どおりに解析できた。この Phase で「要件」欄が増えたので、Phase 39 で実 LLM が欄を書くかも見る。
- **ベースラインで見つけた、ステージ6の範囲の外の課題**([Phase 33](../Phase-33/Phase-33-introduction.md)): 段階3の CRUD 図の下書きと DFD の書き込みの線の食い違い、段階5の分岐の行の書き落とし、簡易モードの内部設計書の書き落とし。
- **Phase 39・40 の未確定事項**: [33-5](../Phase-33/Phase-33-5.md)「未確定事項」。
- **画面確認(Phase 39・40 でまとめて行う。#37 の運用注記)**: Phase 34 の分 ── チャット画面の観点の表(広い画面で右、狭い画面で上に畳む)、実 LLM での表の埋まり方、必須がそろったときのまとめの読みやすさ。Phase 35 の分 ── カードの見た目、カードごとの送信と下の送信ボタンの使い分け、狭い画面でのカード、送信した発言の改行。Phase 36 の分 ── 要件定義書のタブの要約のパネル(件数・指摘・推測の要件と「採用にする」)、md の表の読みやすさ(1.4〜1.6 と付録)、狭い画面でのパネル。Phase 37 の分 ── 外部設計書のタブのパネル(件数と指摘)、md の表の読みやすさ(2.6 は8列。狭い画面での横の広がり)、2.3 の UI 仕様の小見出し、付録「要件との対応」。
- **実 LLM の判定の質**: 判定の LLM が規模・根拠の番号を返さない場合、観点が決まらないまま進む(安全側)。Phase 39 の効果測定で確かめる。
- **判定の LLM の入力の大きさ**: 会話が長くなると入力が増えるので、問題になれば測る。
- **E2E の文言**: 十分になったときのチャットのまとめが表の箇条書きに変わった(Phase 34)。Phase 40 で確かめる。
- **作成時の判定の質**・**任意の観点のヒアリングの質**・**実 LLM のカードの質**・**返信がまとめて表示される体感**(Phase 35 から): Phase 39 の効果測定と実画面で確かめる。
- **既存のプロジェクトの会話の順**(Phase 35 から): 調整より前に作ったプロジェクトは、同じ送信の発言と返信が同じ時刻のまま残る。直さない。
- **偽 LLM のカードと E2E**(Phase 35 から): E2E がカードを選ぶ流れを足すかは Phase 40 で決める。
- **実 LLM の要件定義書の質**(Phase 36 から): 出どころの付き方(上限で直した件数)、`prev_id` が再生成で返るか、観点のキーの付き方、利用者の言っていない技術スタック・数値を「推測」にできているか。Phase 39 の指標③「推測の割合」は `source_counts` で数えられる。
- **要件の文の長さ・粒度**(Phase 36 から): LLM が1行に複数の要件をまとめないかを Phase 39 で見る。
- **「採用にする」の取り消し**(Phase 36 から): 採用を推測に戻す操作は無い。使ってみて要るかを Phase 39・40 で見る。
- **偽 LLM の要件定義書と E2E**(Phase 36 から): 偽 LLM は推測の要件を1つ返す。E2E で「採用にする」を試すかは Phase 40 で決める。
- **実 LLM の外部設計書の質**(Phase 37 から): 要件ID の付き方(要件定義書に無い ID を作らないか)、Must の機能要件の抜け、POST・PUT・PATCH の本文の欄、仮の画面ID が再生成で前の版の ID になるか、API の数(「すべて書く」が守られるか)。Phase 39 で見る。ベースラインの分類 B(API の本文が無い)は `API_BODY_MISSING` の件数で数えられる。
- **構造化出力の大きさ**(Phase 37 から): 外部設計書は本文の節と画面ごとの UI 仕様も1回の構造化出力で返すので、出力が大きい。実 LLM で途中で切れる(トークンの上限)なら、UI 仕様を別の呼び出しに分けるかを Phase 39 で決める。

この Phase で解決したもの:

- **段階1と要件ID**(Phase 37 から): 2.6 の「要件」の欄は、段階1の API の処理の下書きにコードが写す形で使った([38-1](./Phase-38-1.md))。
- **Phase 38 の未確定事項**([33-5](../Phase-33/Phase-33-5.md)): 上の「着手時の相談で決めたこと」で決めた。

この Phase で生まれたもの:

- **画面確認(Phase 39・40 でまとめて行う)**: 段階1の表の「要件」の欄(列が1つ増えた横の広がり)と、関連画面の欄の区切りが「, 」に変わったこと。段階8の単位の一覧の「要件」列。実装手順書の index の「4. 要件との対応」と「非機能要件・制約」の表の読みやすさ。
- **NFR・CON と横断事項の結び付け**(案2): Phase 39 で、実 LLM の段階7の横断事項が要件定義書の NFR を拾えているかを見てから、`CrossCuttingRow.req_ids` を足すかを決める。横断事項の4項目に収まらない NFR(性能・可用性など)をどう扱うかも合わせて決める。
- **実 LLM の要件の追跡の質**: API でない処理(画面・バッチ)に AI が要件ID を付けるか、`UNLINKED_FUNCTION` がどれだけ出るか、簡易モードの WBS の「要件」欄を書くか・Must の機能要件をすべてタスクに入れるか(`MUST_REQUIREMENT_UNPLANNED` の件数)。Phase 39 で見る。
- **段階1の再生成と人の直した要件**: 再生成すると、人が直した `req_ids` は下書きに戻る(機能グループは引き継ぐ)。使ってみて、引き継ぎが要るかを Phase 39・40 で見る。
- **セッションの区切りの記録**: Phase 38 は1セッションで行った(計画モードで質問2回 ── 4問と NFR の比較 → 38-1 → 38-2 → 38-3 → samples → 教材 → 全体テスト)。

## Phase 完了後の調整

Phase 完了後の実画面の確認で出た行き詰まり(#38 の通常の工程)。経緯は [`q_a.md`](../q_a.md) の「Phase 38 完了後 ── 計画に無い手順書」。samples のタグは `38(完了後の調整)`。

- **症状**: 簡易モードで実装手順書を生成した後、内部設計書・実装計画書を再生成すると、WBS の単位が変わる。前の単位(例 M-06-T01)の手順書が段階8に残り、検証のエラー「手順書の単位 M-06-T01 が、実装計画書にありません」で承認できない。実装計画書を再生成しても同じ単位は出ないので、行き詰まる。
- **原因**: 段階8の単位の一覧は今の計画の単位だけを出すため、計画から消えた単位の手順書は画面のどこからも開けず、手順書を消す操作(単位の詳細の中)にも届かなかった。合わない手順書を自動で消さない(Phase 27 の方針)ことと、消す・活かす手段が画面に無いことが重なった。
- **決定(ユーザーの選択)**: 単位の一覧の下に「実装計画書に無い手順書」(詳細設計モードは「段階7に無い手順書」)の表を出し、行ごとに **今の単位へ付け替える**(手順書の無い単位を選ぶ。ID とタスク名だけを変え、中身はそのまま)か **消す**。「すべて消す」も置く。変更は下書きに入り、保存して反映する。再生成で前の単位を引き継がせる案は採らなかった(引き継ぐと再生成しても構造が変わらず、再生成の意味が無い、とユーザー)。自動で消さない方針は保つ。
- **実装**: `procedureDocOps.ts` に `strayProcedures`・`reassignTargets`・`reassignUnit`・`removeUnitAt`・`removeStrayProcedures`(純粋関数。合わないの判定は単位の一覧の「手順書の有無」と同じ ID + タスク名)、新しい部品 `StrayProcedureList.tsx`、`ProcedureDocPanel.tsx` に配置。付け替え先の候補は、その ID の手順書がまだ無い単位だけ(同じ ID が2つになる `DUPLICATE_UNIT` を作らないため)。BE は `UNIT_MISMATCH` の文言を「単位の一覧の下の『〜に無い手順書』で、今の単位へ付け替えるか消してください」に変えただけ(判定・重さは同じ)。
- **検証**: devex-ui の `src/features/detailed-design` 284 件成功(`--maxWorkers=4`。並列が多いと既存の `UnitProcedureEditor` のテストが5秒の上限に掛かることがある)、`tsc --noEmit`・eslint 成功。devex-api の段階8の検証のテスト 36 件成功・ruff 成功。`samples_check.py` 不一致 0 件。実画面の確認はユーザーが行う。

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

1. 段階1の要件の検証が、要件定義書の model でなく外部設計書の model に写した要件ID と照らすのはなぜか。段階1の入力(`STAGE_INPUTS`)と「古い」の判定から説明できるか。
2. API の処理の要件ID をコードが写し、AI に書かせないのはなぜか。再生成で機能グループは前の版を引き継ぐのに、`req_ids` は引き継がないのはなぜか。
3. 詳細設計モードで、作業単位に要件ID を持たせず、単位の処理から導くのはなぜか。簡易モードだけ `PlanTask.req_ids` を使う理由と合わせて説明できるか。
4. 詳細設計モードの段階8に要件の検証を足さなかったのはなぜか。「要件 → 単位」の抜けを、どの段階のどの指摘で見つけられるか。
5. 段階1の関連画面の欄を `ListInput` に寄せたのは、#17 の判定の一問(「この共通化を今駆動している消費者は何か」)にどう答えるからか。
