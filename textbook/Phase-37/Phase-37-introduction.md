# Phase 37 導入: 外部設計書のモデル化(ステージ6)

## 目的

外部設計書を、LLM が自由に書く Markdown から「構造化出力 → 意味モデル(model)→ md を組み立てる」形に変える。画面・API・外部連携を行にし、各行に関係する要件ID(Phase 36 の `FR-001` など)を持たせる。画面ID(`SCR-001`)は再生成しても引き継ぐ。検証で「画面も API も無い Must の機能要件」「本文の欄が空の POST・PUT・PATCH」などを指摘し、プレビューに出す。ベースライン([33-1](../Phase-33/Phase-33-1.md))で多かった「API のメソッド・パス・本文が外部設計書に無い」(分類 B)を検証で拾えるようにし、Phase 38(要件 → 処理・作業単位)の入力をそろえる。

方針は [Phase 33-2](../Phase-33/Phase-33-2.md) 決定11、計画は [33-5](../Phase-33/Phase-33-5.md) の Phase 37。形の見本は [`appendix/structured-requirements-sample/external_design.md`](../../appendix/structured-requirements-sample/external_design.md)。

## パイプライン上の位置づけ・前提

```
[37-1 model と純粋関数]  app/documents/external_design(model・画面ID の引き継ぎ・md・検証)
                         + 共通化: app/documents/ids.py(採番)・issues.py(指摘の型)
        ▼
[37-2 生成の構造化と API]  要件定義書の md + 前の版の画面 → 構造化出力 → model → md
                           要件定義書の model から要件ID を写す・文書の応答に行数と指摘・偽 LLM
        ▼
[37-3 プレビューのパネル]  ExternalDesignSummaryPanel(画面・API・外部連携の件数と指摘)
        ▼
Phase 38 要件 → 処理・作業単位(段階1の req_ids は、外部設計書の 2.6 の「要件」の欄も参考にできる)
```

- 前提として読むもの:
  - [Phase 36 の introduction](../Phase-36/Phase-36-introduction.md)(要件定義書の model・要件ID の引き継ぎ・生成時点の写し)
  - [見本の外部設計書](../../appendix/structured-requirements-sample/external_design.md)(2.2・2.4・2.6 の行と検証の例)
  - [外部設計書](../../docs/external_design.md) 2.9節「外部設計書(両モード)」と、[内部設計書](../../docs/internal_design.md) 3.3節「6. ヒアリングと上流の構造化」
- 外部設計書の md を読む後続: 詳細設計モードの段階1(機能一覧の下書きと `MISSING_API`)・段階7、簡易モードの内部設計書の生成と段階8(`extract_api_endpoints`)、自己診断。どれも md を読むので、見出しと 2.6 の列名を変えないことがこの Phase の前提になる。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(AI が本体へ実装し、`textbook/samples/` も同じ内容で作る)。

E2E: この Phase では流さない。外部設計書のプレビューの上にパネルが増え、md が表の形に変わった。偽 LLM の外部設計書にも「E2E Fake」の文字を入れたので、既存の E2E(タブに「E2E Fake」が見える)は壊れにくい。Phase 40 で既存を含めて全部流して確かめる。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 37 開始時」を参照。4つとも推奨どおり。

1. **自動実装モード**: on。
2. **画面ID**: 前の版を引き継ぐ。AI には仮の画面ID を書かせ(前の版と同じ画面なら前の版の ID)、コードが前の版に在る ID だけを残し、それ以外は次の番号に振り直す。API の関連画面も同じ対応表で付け替える。消えた ID は使い回さない([37-1](./Phase-37-1.md))。
3. **2.3 の UI 仕様の粒度**: 画面の行ごとに本文を持たせ、md は `### SCR-001: 画面名` の小見出しで組み立てる([37-1](./Phase-37-1.md))。
4. **検証**: 仕様どおり・警告だけ。中程度 = 画面も API も無い Must の機能要件 / 本文の欄が空の POST・PUT・PATCH。軽微 = 要件定義書に無い要件ID / 要件の無い画面・API / 一覧に無い画面ID の参照。プレビューに件数と指摘を出す([37-1](./Phase-37-1.md)・[37-3](./Phase-37-3.md))。

Claude の判断(計画の承認で確定。[33-5](../Phase-33/Phase-33-5.md) の残りの未確定事項):

- **段階1が読む 2.6 との関係**: 見出し(2.1〜2.6)と 2.6 の列名「メソッド/パス/概要/関連画面」を保ち、後ろに「要件/本文/応答/エラー」を足す。`extract_api_endpoints` は列を名前で探すので変えない([37-1](./Phase-37-1.md))。
- **本文の節**: 2.1 システム構成・2.2 の画面遷移(テキスト図)・2.5 データ入出力は文字列。2.4 外部連携は行。
- **生成の入力**: 要件定義書の md(今と同じ)と前の版の画面。会話は渡さない([37-2](./Phase-37-2.md))。
- **要件の照合**: 同じ生成の要件定義書の model から、要件ID と Must の機能要件ID を外部設計書の model に写す(Phase 36 の観点の状態の写しと同じ考え方)。
- **付録**: 「要件との対応」(Must の機能要件ごとの画面・API)。
- **失敗**: 今と同じく生成全体の失敗(自由な md への退避なし)。
- **model の置き場**: `generated_documents.model` を共用(列もマイグレーションも増やさない)。
- **共通化**(#17): 採番(`app/documents/ids.py`)と指摘の型(`app/documents/issues.py`、応答は `DocumentIssueRead`)を要件定義書と共有し、FE の指摘の一覧を `DocumentIssueList` に切り出す。いずれも外部設計書が2つ目の消費者。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-37-1.md`](./Phase-37-1.md) | 外部設計書の model・画面ID の引き継ぎ・API の整え・md・検証、採番と指摘の型の共通化 | あり(BE) | なし |
| [`Phase-37-2.md`](./Phase-37-2.md) | 生成の構造化出力・要件ID の写し・文書の応答の要約・偽 LLM と既存テストの追従 | あり(BE) | 37-1 |
| [`Phase-37-3.md`](./Phase-37-3.md) | プレビューの外部設計書のパネル・指摘の一覧の共通化 | あり(FE) | 37-2 |

## サンプルコード一覧

- 37-1(`textbook/samples/backend/`): `app/documents/ids.py`・`app/documents/issues.py`・`app/documents/requirements/`(`model.py`・`assemble.py`・`validation.py`・`__init__.py`)・`app/documents/external_design/`(`model.py`・`assemble.py`・`validation.py`・`markdown.py`・`__init__.py`)・`app/models/generated_document.py`、テスト `test_external_design_doc.py`
- 37-2(同): `app/documents/external_design/drafting.py`・`app/detailed_design/api_list.py`・`app/schemas/document.py`・`app/services/doc_generator_service.py`・`app/ai/llm/fake.py`、テスト `tests/fixtures/external_design.py`・`test_doc_generator_service.py`・`test_project_mode.py`・`test_doc_generation_guard.py`・`test_external_api_list.py`・`test_fake_llm_e2e.py`・`test_fake_llm_simple_procedure.py`・`test_fake_llm_detailed_design.py`・`tests/integration/test_projects_flow.py`
- 37-3(`textbook/samples/frontend/`): `src/features/documents/api/documentsApi.ts`・`components/DocumentIssueList.tsx`・`components/RequirementsSummaryPanel.tsx`・`components/ExternalDesignSummaryPanel.tsx`・`components/DocumentMarkdownView.tsx`、テスト `components/__tests__/DocumentIssueList.test.tsx`・`components/__tests__/ExternalDesignSummaryPanel.test.tsx`

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 作成・更新するファイル | 責務1行 | テスト観点 |
|---|---|---|---|
| [37-1](./Phase-37-1.md) | `app/documents/ids.py`・`issues.py`・`requirements/`(共通化) | 前の版を引き継ぐ採番・指摘の型を共有する(挙動は変えない) | 引き継ぎと使い回さない番号、既存の要件定義書のテストがそのまま通る |
| | `app/documents/external_design/`(`model`・`assemble`・`validation`・`markdown`) | 画面・API・外部連携の行、画面ID の引き継ぎと参照の付け替え、md、検証(純粋) | 付け替え、形の違う API・同じ API、見出しと列、2.6 が `extract_api_endpoints` で読める、検証の各コード |
| [37-2](./Phase-37-2.md) | `drafting.py`・`doc_generator_service.py` | 要件定義書の md + 前の版の画面 → 構造化出力 → model → md | 入力は要件定義書だけ、要件ID の写し、画面ID の引き継ぎ、連鎖構成 |
| | `schemas/document.py` | 文書の応答の行数と指摘 | 外部設計書だけに付く |
| | `fake.py`・既存のテスト | 偽 LLM の外部設計書を構造化出力に | 「E2E Fake」、段階1・段階8が指摘0件のまま |
| [37-3](./Phase-37-3.md) | `documentsApi.ts`・`DocumentIssueList.tsx`・`ExternalDesignSummaryPanel.tsx` | 件数と指摘を出す(読むだけ) | 件数・指摘・指摘なし・以前の版・ほかの文書 |
| | `RequirementsSummaryPanel.tsx`・`DocumentMarkdownView.tsx` | 共通の部品へ置き換え・パネルの配置 | 既存のテストがそのまま通る |

## 写経順序(#23)

章番号順(37-1 → 37-2 → 37-3)。各章の「この章で作成・更新したファイル」の表の順に写す。

実 import 監査(#15):

- 37-1: `ids.py`・`issues.py` は標準ライブラリだけ。`requirements/model.py` は `ids.py`(同じ章の先の行)、`requirements/assemble.py` は `ids.py` の `carry_over_ids`・`initial_next_seq`(同じ章)、`requirements/validation.py` は `issues.py`(同じ章)を読む。`external_design/model.py` は `ids.seq_id`(同じ章)と `app.documents.requirements.model.Priority`(Phase 36-1)を読む。`external_design/assemble.py` は `model.py`・`ids.py`(同じ章)・`app.documents.requirements.model`(`PRIORITIES`・`Priority`・`RequirementsModel`、Phase 36-1)・`app.detailed_design.api_list`(`HTTP_METHODS`・`endpoint_key`、Phase 16-1)を読む。`external_design/validation.py` は `model.py`・`issues.py`(同じ章)、`external_design/markdown.py` は `model.py`・`validation.covered_by`(同じ章の先の行)と `md_table`(Phase 22-3)を読む。テストは同じ章の作成物と `app.documents.requirements`(Phase 36-1)・`extract_api_endpoints`(Phase 16-1)を読む。
- 37-2: `drafting.py` は `external_design/assemble.py`・`model.py`(37-1)を読む。`schemas/document.py` は新しい import 無し。`doc_generator_service.py` は `app.documents.external_design`(37-1)・`drafting.py`(同じ章の先の行)・`app.documents.issues`(37-1)・`schemas/document.py` の `DocumentIssueRead`・`ExternalDesignSummaryRead`(同じ章の先の行)を読む。`fake.py` は `drafting.py` の `ExternalDesignGenerationOutput`・`GeneratedApi`・`GeneratedScreen`(同じ章の先の行)を読む。`api_list.py` は docstring だけ。`tests/fixtures/external_design.py` は `fake.py`・`drafting.py`(同じ章)・`app.documents.external_design`(37-1)・`tests/fixtures/requirements.py`(Phase 36-2)を読む。テストは同じ章と 37-1 の作成物を読む。
- 37-3: `documentsApi.ts` は新しい import 無し。`DocumentIssueList.tsx` は tamagui と `documentsApi.ts` の `DocumentIssueRead`(同じ章の先の行)を読む。`RequirementsSummaryPanel.tsx`・`ExternalDesignSummaryPanel.tsx` は `DocumentIssueList.tsx`(同じ章の先の行)を読む。`DocumentMarkdownView.tsx` は `ExternalDesignSummaryPanel.tsx`(同じ章の先の行)を読む。
- 前方 import は無い。章が作成・更新するファイルは、その章のテストが少なくとも1度 import する(37-1 の要件定義書の4ファイルは既存の `test_requirements_doc.py`、`generated_document.py` はコメントだけで既存のリポジトリのテストが読む。37-2 の `api_list.py` は `test_external_api_list.py`、`schemas/document.py` は `test_doc_generator_service.py` が `document_read` 経由で使う。37-3 の `RequirementsSummaryPanel.tsx`・`DocumentMarkdownView.tsx`・`documentsApi.ts` は既存のテストが読む)。

## 検証結果

- 部分テスト: devex-api の `-k "doc or document or external or requirements or fake or design_stage or function_list or simple or project or api_list"` 393 件成功。ruff check(全体)・pyright(変更したファイル)成功。devex-ui の `src/features/documents` 49 件成功、`tsc --noEmit`・eslint 成功。
- マイグレーション: 無し(`generated_documents.model` を共用)。
- 統合テスト: `test_projects_flow.py` を専用の DB(`docker-compose.test.yml`)で流し、5 件成功。
- Phase 完了時の全体テスト(#18): devex-api 907 件成功、devex-ui 703 件成功(`--maxWorkers=4`。この Phase で 7 件増)、`npm run build` 成功(いずれも1回目)。
- `samples_check.py`(`--api-since HEAD --ui-since HEAD`): 不一致 0 件・作り忘れ 0 件(一致 512 / 並び順のみ差 8 / 例外 5)。`link_check.py`: 切れ 0 件。

## 未消化の申し送り(#37)

Phase 36 から引き継いだもの:

- **持ち越し(Phase 22 から)**:
  - 段階6が開いていないときの、05 の詳細バッジ
  - ER の主キーの NULL の表示
- **E2E を CI で流すか**: 未定([`retrospective-memo.md`](../retrospective-memo.md) に候補として記録済み)。#36 のまま続ける。
- **コミュニケーション図**: 後回し([25-5](../Phase-25/Phase-25-5.md))。
- **「段階Nで直す」の移動先での強調**: 段階5は手順・処理を開くが、段階3・4・7は段階を開くだけ。必要なら各パネルに `focus` を読ませる。
- **「AI に提案を求める」**: ステージ8(AI 設計レビュー・再ヒアリング)との境界として申し送る。
- **段階8の生成の入力の大きさ**(Phase 29 から): 問題になれば測る。
- **生成済みの簡易モードのプロジェクト**: Phase 31 より前に生成した文書では、段階8の単位が空になる。文書を再生成すると使える。
- **WBS の書式の守られ方**: ベースライン(33-1)の簡易モードでも、WBS は書式どおりに解析できた。
- **ベースラインで見つけた、ステージ6の範囲の外の課題**([Phase 33](../Phase-33/Phase-33-introduction.md)): 段階3の CRUD 図の下書きと DFD の書き込みの線の食い違い、段階5の分岐の行の書き落とし、簡易モードの内部設計書の書き落とし。
- **Phase 38〜40 の未確定事項**: [33-5](../Phase-33/Phase-33-5.md)「未確定事項」。
- **画面確認(Phase 39・40 でまとめて行う。#37 の運用注記)**: Phase 34 の分 ── チャット画面の観点の表(広い画面で右、狭い画面で上に畳む)、実 LLM での表の埋まり方、必須がそろったときのまとめの読みやすさ。Phase 35 の分 ── カードの見た目、カードごとの送信と下の送信ボタンの使い分け、狭い画面でのカード、送信した発言の改行。Phase 36 の分 ── 要件定義書のタブの要約のパネル(件数・指摘・推測の要件と「採用にする」)、md の表の読みやすさ(1.4〜1.6 と付録)、狭い画面でのパネル。
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

この Phase で解決したもの:

- **Phase 37 の未確定事項**([33-5](../Phase-33/Phase-33-5.md)): 上の「着手時の相談で決めたこと」で決めた。

この Phase で生まれたもの:

- **画面確認(Phase 39・40 でまとめて行う)**: 外部設計書のタブのパネル(件数と指摘)、md の表の読みやすさ(2.6 は8列になった。狭い画面での横の広がり)、2.3 の UI 仕様の小見出し、付録「要件との対応」。
- **実 LLM の外部設計書の質**: 要件ID の付き方(要件定義書に無い ID を作らないか)、Must の機能要件の抜け、POST・PUT・PATCH の本文の欄、仮の画面ID が再生成で前の版の ID になるか、API の数(「すべて書く」が守られるか)。Phase 39 で見る。ベースラインの分類 B(API の本文が無い)は `API_BODY_MISSING` の件数で数えられる。
- **構造化出力の大きさ**: 外部設計書は本文の節と画面ごとの UI 仕様も1回の構造化出力で返すので、出力が大きい。実 LLM で途中で切れる(トークンの上限)なら、UI 仕様を別の呼び出しに分けるかを Phase 39 で決める。
- **段階1と要件ID**: 2.6 の「要件」の欄は md に出るので、Phase 38 の段階1の `req_ids` の下書きで参考にできる(使うかは Phase 38 で決める)。
- **セッションの区切りの記録**: Phase 37 は2セッションで行った(計画モードで質問1回 → 37-1 → 37-2 の途中で利用の上限 → 再開して 37-2 の残り → 37-3 → samples → 教材)。全体テストは Phase 完了時の1回だけ。

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

1. 画面ID を AI の仮の ID から振り直すとき、API の行の関連画面も同じ対応表で付け替えるのはなぜか。要件ID の `prev_id` と違い、仮の ID が「前の版の ID」と「参照のキー」を兼ねる理由を説明できるか。
2. 2.6 の列名を以前のままにし、列を後ろに足したのはなぜか。どの後続(関数と段階)が 2.6 を読むかを挙げられるか。
3. 外部設計書の検証が、今の要件定義書でなく model に写した要件ID(`known_req_ids`・`must_fr_ids`)を読むのはなぜか。Phase 36 の観点の状態の写しと同じ考え方で説明できるか。
4. 採番(`ids.py`)と指摘の型(`issues.py`)を共通化したのはなぜか。#17 の判定の一問(「この共通化を今駆動している消費者は何か」)にどう答えるか。
5. 偽 LLM の外部設計書を `ainvoke` の固定の md から構造化出力に替えたとき、段階1・段階8のテストはどう合わせたか。固定の md を使い続けると何を確かめ損なうか。

## 次のフェーズ

**Phase 38**: 要件 → 処理・作業単位(段階1の `req_ids` の下書き・編集・検証、簡易モードの WBS の「要件」欄と `parse_wbs`、手順書と詳細設計書の追跡表)。Phase 36 の要件ID と、この Phase の外部設計書の「要件」の欄を使う。着手時に自動実装モード(#21)と [33-5](../Phase-33/Phase-33-5.md) の Phase 38 の未確定事項を決める。
