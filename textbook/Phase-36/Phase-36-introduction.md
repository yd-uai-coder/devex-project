# Phase 36 導入: 要件定義書のモデル化(ステージ6)

## 目的

要件定義書を、LLM が自由に書く Markdown から「構造化出力 → 意味モデル(model)→ md を組み立てる」形に変える。要件を FR(機能)・NFR(非機能)・CON(制約)の行にし、要件ID(`FR-001`)・出どころ(**ユーザー** = 利用者が決めた / **採用** = AI の提案を利用者が採用した / **推測** = AI が補った)・根拠の観点を持たせる。生成の入力に観点の表(Phase 34)を渡し、出どころは観点の状態を上限にコードが直す。ベースライン([33-1](../Phase-33/Phase-33-1.md))で要件定義書の非機能・制約の6〜7割が「利用者の言っていない記述」だった問題を、「推測」として見えるようにし、プレビューで確かめられるようにする。

方針は [Phase 33-2](../Phase-33/Phase-33-2.md) 決定2・8・12、計画は [33-5](../Phase-33/Phase-33-5.md) の Phase 36。形の見本は [`appendix/structured-requirements-sample/requirements.md`](../../appendix/structured-requirements-sample/requirements.md)。

## パイプライン上の位置づけ・前提

```
[36-1 model と純粋関数]  app/documents/requirements(model・ID・出どころの上限・md・検証)
                         + generated_documents.model
        ▼
[36-2 生成の構造化と API]  会話 + 観点の表 + 前の版の要件 → 構造化出力 → model → md
                           文書の応答に要約・「採用にする」の API・手順書の対象外を表に対応・偽 LLM
        ▼
[36-3 プレビューの出どころ]  RequirementsSummaryPanel(件数・指摘・推測の要件と「採用にする」)
        ▼
Phase 37 外部設計書のモデル化(画面・API の行に要件ID を付ける)
```

- 前提として読むもの:
  - [Phase 34 の introduction](../Phase-34/Phase-34-introduction.md)(観点の表・状態・規模)と [Phase 35 の introduction](../Phase-35/Phase-35-introduction.md)(カードの選択 = 「AI の提案を採用」)
  - [見本の要件定義書](../../appendix/structured-requirements-sample/requirements.md)(1.1〜1.6 と付録の形)
  - [外部設計書](../../docs/external_design.md) 2.9節「要件定義書(両モード)」と、[内部設計書](../../docs/internal_design.md) 3.3節「6. ヒアリングと上流の構造化」
- 段階の下書きの「構造化出力 → model」(ステージ4)と同じ考え方: AI には中身だけを書かせ、ID のように揺れると困る値はコードが決める(段階1の処理ID と同じ)。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(AI が本体へ実装し、`textbook/samples/` も同じ内容で作る)。

E2E: この Phase では流さない。要件定義書のプレビューの上に要約のパネルが増え、md が表の形に変わった。既存の E2E は「E2E Fake」の文字が見えることを確かめているだけで、偽 LLM の要件定義書にもその文字が入るので壊れにくい。Phase 40 で既存を含めて全部流して確かめる。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 36 開始時」を参照。4つとも推奨どおり。

1. **自動実装モード**: on。
2. **再生成の要件ID**: 前の版を引き継ぐ。前の版の要件(ID 付き)を LLM に渡し、同じ要件には `prev_id` を返させる。コードが確かめ、新しい要件は種別ごとの次の番号。消えた ID は使い回さない([36-1](./Phase-36-1.md))。
3. **推測の確かめ方**: プレビューで「採用にする」。LLM を呼ばず、同じ版の model と md を書き換える(版を増やさないので、後続の段階は古くならない)。違う内容にしたいときはチャットで答えて再生成する([36-2](./Phase-36-2.md))。
4. **出どころ**: LLM が付け、コードが観点の状態で上限をかける(観点が未決・対象外・無し → 推測、観点が「採用」なのに user → 採用)([36-1](./Phase-36-1.md))。

Claude の判断(計画の承認で確定。[33-5](../Phase-33/Phase-33-5.md) の残りの未確定事項):

- **model の置き場**: `generated_documents.model`(JSON、NULL 可)。版ごとに持つので、復元で model も戻る。
- **生成の入力に観点の表を渡す形**: 「key|名前|状態|決めたこと」の行(先頭に規模)。前の版の要件は「ID|本文」の行。
- **生成に失敗したら**: 今と同じく生成全体の失敗。自由な md への退避はしない。
- **1.4 の解析の互換**: 手順書の対象外(`out_of_scope_lines`)が表の行も読む。以前の箇条書きも読み続ける。
- **検証**: 警告だけ(推測の要件・未決の必須の観点・Must が無い・対象外の観点の要件)。

実装で足した判断:

- **生成した時点の観点の状態を model に写す**: 付録と検証が今の表でなく生成時点の表を読む。「採用にする」で組み立て直しても付録が変わらない([36-1](./Phase-36-1.md))。
- **規模だけでは出どころの上限を上げない**: 規模はほぼ必ず決まるので、どの要件にも付けて「ユーザー」にできてしまうため([36-1](./Phase-36-1.md))。
- **共通化**(#17): 構造化出力の呼び出し(`invoke_structured`)と、観点の表の読み出し(`load_states`・`states_from_rows`・`as_scale`)を、要件定義書の生成という2つ目の消費者のために共通の場所へ移した([36-2](./Phase-36-2.md))。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-36-1.md`](./Phase-36-1.md) | 要件定義書の model・ID の引き継ぎ・出どころの上限・md・検証と `generated_documents.model` | あり(BE) | なし |
| [`Phase-36-2.md`](./Phase-36-2.md) | 生成の構造化出力・観点の表と前の版の入力・要約と「採用にする」の API・手順書の対象外・偽 LLM | あり(BE) | 36-1 |
| [`Phase-36-3.md`](./Phase-36-3.md) | プレビューの出どころのパネル・「採用にする」 | あり(FE) | 36-2 |

## サンプルコード一覧

- 36-1(`textbook/samples/backend/`): `app/hearing/points.py`・`app/hearing/__init__.py`・`app/documents/__init__.py`・`app/documents/requirements/`(`model.py`・`assemble.py`・`markdown.py`・`validation.py`・`__init__.py`)・`app/models/generated_document.py`・`app/repositories/generated_document.py`・`alembic/versions/c3d4e5f6a7b9_add_generated_document_model.py`、テスト `test_requirements_doc.py`・`test_generated_document_repository.py`
- 36-2(同): `app/repositories/hearing_point.py`・`app/services/chat_service.py`・`app/services/llm_retry.py`・`app/services/design_stage_generation_service.py`・`app/documents/requirements/drafting.py`・`app/schemas/document.py`・`app/services/errors.py`・`app/services/doc_generator_service.py`・`app/api/routes/projects.py`・`app/detailed_design/procedure_output/source.py`・`app/ai/llm/fake.py`、テスト `tests/fixtures/fake_llm.py`・`tests/fixtures/requirements.py`・`test_doc_generator_service.py`・`test_project_mode.py`・`test_doc_generation_guard.py`・`test_document_versions.py`・`test_fake_llm_e2e.py`・`test_procedure_output_source.py`・`tests/integration/test_projects_flow.py`
- 36-3(`textbook/samples/frontend/`): `src/features/documents/api/documentsApi.ts`・`documents-store.ts`・`components/RequirementsSummaryPanel.tsx`・`components/DocumentMarkdownView.tsx`、テスト `api/__tests__/documentsApi.test.ts`・`__tests__/documents-store.test.ts`・`components/__tests__/RequirementsSummaryPanel.test.tsx`

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 作成・更新するファイル | 責務1行 | テスト観点 |
|---|---|---|---|
| [36-1](./Phase-36-1.md) | `app/documents/requirements/`(`model`・`assemble`・`markdown`・`validation`)・`app/hearing`(`as_scale`) | 要件の行・ID の引き継ぎ・出どころの上限・md・検証(純粋) | 引き継ぎと使い回さない番号、上限の4パターン、見出しと `**推測**`・付録、検証の各コード |
| | `app/models/generated_document.py`・リポジトリ・alembic | 版ごとに model を JSON で持つ・同じ版の書き換え | 版ごとの model、書き換えで版が増えない |
| [36-2](./Phase-36-2.md) | `drafting.py`・`doc_generator_service.py` | 会話 + 観点の表 + 前の版 → 構造化出力 → model → md | 入力に観点の表と前の版、上限、`prev_id` の引き継ぎ、連鎖構成 |
| | `schemas/document.py`・`errors.py`・`routes/projects.py` | 要約・「採用にする」の API | 要約は要件定義書だけ、採用で件数が変わる、404・409 |
| | `llm_retry.py`・`design_stage_generation_service.py`・`hearing_point.py`・`chat_service.py` | 共通化(挙動は変えない) | 既存のテストがそのまま通る |
| | `procedure_output/source.py`・`fake.py` | 1.4 の表の対象外・偽 LLM の要件定義書 | 表の行、本物のプロンプトから ID を引き継ぐ契約 |
| [36-3](./Phase-36-3.md) | `documentsApi.ts`・`documents-store.ts` | 要約の型・「採用にする」・一覧の置き換え | URL、同じ種別だけ置き換え、失敗の扱い |
| | `RequirementsSummaryPanel.tsx`・`DocumentMarkdownView.tsx` | 件数・指摘・推測の要件と「採用にする」 | 表示、POST、以前の版の案内、ほかの文書は出さない |

## 写経順序(#23)

章番号順(36-1 → 36-2 → 36-3)。各章の「この章で作成・更新したファイル」の表の順に写す。

実 import 監査(#15):

- 36-1: `points.py` は既存の import(`typing.get_args`)だけで `as_scale` を足した。`app/hearing/__init__.py` は `points.py`(同じ章)を読む。`model.py` は pydantic と標準ライブラリ。`assemble.py` は `model.py`(同じ章)と `app.hearing` の `POINT_DEFS`・`PointState`・`Scale`・`is_point_key`(Phase 34)を読む。`markdown.py` は `model.py`(同じ章)・`app.detailed_design.document.markdown.md_table`(Phase 22-3)・`app.hearing` の `POINT_DEFS`・`SCALE_LABEL`・`STATUS_LABEL`・`point_def`(Phase 34)と `as_scale`(同じ章の先の行)を読む。`validation.py` は `model.py` と `app.hearing` の `POINT_DEFS`・`is_required`(Phase 34)・`as_scale`(同じ章)を読む。モデルは既存の `app.core.database.PortableJSON` を足しただけ。リポジトリ・alembic は新しい import 無し(alembic は外部ライブラリだけ)。テストは `app.documents.requirements`(同じ章)と `app.hearing` の `PointState`・`initial_states`(Phase 34)を読む。
- 36-2: `hearing_point.py` は `app.hearing` の `initial_states`・`to_state`(Phase 34)を足した。`chat_service.py` は `app.hearing.as_scale`(36-1)と `hearing_point.states_from_rows`(同じ章の先の行)を読む。`llm_retry.py` は `app.uml.generation.failures.unwrap_structured_result`(既存)を読む。`design_stage_generation_service.py` は `llm_retry.invoke_structured`(同じ章の先の行)を読む。`drafting.py` は `assemble.py`・`model.py`(36-1)と `app.hearing`(Phase 34)を読む。`doc_generator_service.py` は `app.documents.requirements`(36-1)・`drafting.py`・`hearing_point.py`・`llm_retry.py`・`schemas/document.py`・`errors.py`(いずれも同じ章の先の行)と `app.hearing.as_scale`(36-1)を読む。`projects.py` は `doc_generator_service.document_read`(同じ章の先の行)を読む。`fake.py` は `drafting.py`(同じ章の先の行)を読む。`source.py` は新しい import 無し。テストは同じ章と 36-1 の作成物、`tests/fixtures/requirements.py`(同じ章)を読む。
- 36-3: `documentsApi.ts` は新しい import 無し。`documents-store.ts` は `documentsApi.ts` の `adoptRequirement`(同じ章の先の行)を読む。`RequirementsSummaryPanel.tsx` は tamagui・`documentsApi.ts` の型・`documents-store.ts`(同じ章)を読む。`DocumentMarkdownView.tsx` は `RequirementsSummaryPanel.tsx`(同じ章の先の行)を読む。
- 前方 import は無い。章が作成・更新するファイルは、その章のテストが少なくとも1度 import する(36-1 の alembic はマイグレーションの往復で確かめた。36-2 の `llm_retry.py`・`design_stage_generation_service.py`・`chat_service.py` は既存のテストも読む。36-3 の `DocumentMarkdownView.tsx` は既存の `DocumentMarkdownView.test.tsx` が読む)。

## 検証結果

- 部分テスト: devex-api の `-k "chat or hearing or fake or llm_retry or gemini or doc or document or procedure or design_stage or requirements or project"` 509 件成功。ruff check(全体)・pyright(変更したファイル)成功。devex-ui の `src/features/documents` 42 件成功、`tsc --noEmit`・eslint 成功。
- マイグレーション: 開発用 DB で `upgrade head` → `downgrade -1` → `upgrade head` を確かめた(head = `c3d4e5f6a7b9`)。
- 統合テスト: `test_projects_flow.py` を専用の DB(`docker-compose.test.yml`)で流し、5 件成功。
- Phase 完了時の全体テスト(#18): devex-api 893 件成功、devex-ui 696 件成功(`--maxWorkers=4`。この Phase で 7 件増)、`npm run build` 成功(いずれも1回目)。
- `samples_check.py`(`--api-since HEAD --ui-since HEAD`): 不一致 0 件・作り忘れ 0 件(一致 497 / 並び順のみ差 9 / 例外 5)。`link_check.py`: 切れ 0 件。

## 未消化の申し送り(#37)

Phase 35 から引き継いだもの:

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
- **Phase 37〜40 の未確定事項**: [33-5](../Phase-33/Phase-33-5.md)「未確定事項」。
- **画面確認(Phase 39・40 でまとめて行う。#37 の運用注記)**: Phase 34 の分 ── チャット画面の観点の表(広い画面で右、狭い画面で上に畳む)、実 LLM での表の埋まり方、必須がそろったときのまとめの読みやすさ。Phase 35 の分 ── カードの見た目、カードごとの送信と下の送信ボタンの使い分け、狭い画面でのカード、送信した発言の改行。
- **実 LLM の判定の質**: 判定の LLM が規模・根拠の番号を返さない場合、観点が決まらないまま進む(安全側)。Phase 39 の効果測定で確かめる。
- **判定の LLM の入力の大きさ**: 会話が長くなると入力が増えるので、問題になれば測る。
- **E2E の文言**: 十分になったときのチャットのまとめが表の箇条書きに変わった(Phase 34)。Phase 40 で確かめる。
- **作成時の判定の質**・**任意の観点のヒアリングの質**・**実 LLM のカードの質**・**返信がまとめて表示される体感**(Phase 35 から): Phase 39 の効果測定と実画面で確かめる。
- **既存のプロジェクトの会話の順**(Phase 35 から): 調整より前に作ったプロジェクトは、同じ送信の発言と返信が同じ時刻のまま残る。直さない。
- **偽 LLM のカードと E2E**(Phase 35 から): E2E がカードを選ぶ流れを足すかは Phase 40 で決める。

この Phase で解決したもの:

- **DF の ID の振り直し → 要件ID の扱い**(Phase 33 の申し送り): 要件ID は前の版を引き継ぎ、消えた番号は使い回さない([36-1](./Phase-36-1.md))。
- **Phase 36 の未確定事項**([33-5](../Phase-33/Phase-33-5.md)): 上の「着手時の相談で決めたこと」で決めた。

この Phase で生まれたもの:

- **画面確認(Phase 39・40 でまとめて行う)**: 要件定義書のタブの要約のパネル(件数・指摘・推測の要件と「採用にする」)、md の表の読みやすさ(1.4〜1.6 と付録)、狭い画面でのパネル。
- **実 LLM の要件定義書の質**: 出どころの付き方(上限で直した件数)、`prev_id` が再生成で返るか(言い直しで ID が保たれるか)、観点のキーの付き方、利用者の言っていない技術スタック・数値を「推測」にできているか。Phase 39 の効果測定の指標③「推測の割合」は `source_counts` で数えられる。
- **要件の文の長さ・粒度**: 1行1要件にしたが、LLM が1行に複数の要件をまとめないかを Phase 39 で見る。
- **「採用にする」の取り消し**: 採用を推測に戻す操作は無い。必要なら再生成する。使ってみて要るかを Phase 39・40 で見る。
- **偽 LLM の要件定義書と E2E**: 偽 LLM は推測の要件を1つ返す。E2E で「採用にする」を試すかは Phase 40 で決める。
- **セッションの区切りの記録**: Phase 36 は1セッションで行った(計画モードで質問1回 → 36-1 → 36-2 → 36-3 → samples → 教材)。全体テストは Phase 完了時の1回だけ。

## Phase 完了後の調整

Phase 完了後の実画面の確認で出た要望(#38 の通常の工程)。経緯は [`q_a.md`](../q_a.md) の「Phase 36 完了後 ── 出どころの注釈」。samples のタグは `36(完了後の調整)`。

- **出どころの注釈**: 「要件の出どころ: ユーザー 4 / 採用 10 / 推測 1」だけでは分類の意味が分かりにくい。パネルの件数の下に、ユーザー = 初期入力・チャットでの回答より / 採用 = ヒアリングで AI の提案を採用 / 推測 = ドキュメント生成時に AI が推測(未確認)を出す([36-3](./Phase-36-3.md) の `RequirementsSummaryPanel`)。md 冒頭の凡例も同じ言い方にした([36-1](./Phase-36-1.md) の `markdown.py` の `LEGEND`)。
- **文言の判断**: ユーザーの案は「ユーザー: ユーザーの初期入力より」だったが、「ユーザー」には観点が「ユーザーが決定」になったもの、つまりチャットで自分の言葉で答えた内容も入る。そのため「初期入力・チャットでの回答より」にした(ユーザーの選択)。
- **既存の版**: 生成済みの md の凡例は、再生成か「採用にする」で組み立て直したときに新しい言い方になる(移行はしない)。
- **検証**: devex-api の `test_requirements_doc.py` 16 件・devex-ui の `src/features/documents` 43 件成功、ruff・tsc・eslint 成功。`samples_check.py` 不一致 0 件・`link_check.py` 切れ 0 件。実画面の確認はユーザーが行う。

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

1. 要件ID を AI に振らせず、`prev_id` で前の版を指させるのはなぜか。段階1の処理ID の決め方と同じ考え方で説明できるか。消えた ID を使い回さない理由も言えるか。
2. AI が「ユーザー」と書いた要件を、コードが「推測」に下げるのはどんなときか。Phase 34 の「根拠の無い決定は取り込まない」とどう対応するか。規模だけを根拠にした要件を上げない理由も言えるか。
3. 付録と検証が、今の観点の表でなく model に写した「生成した時点の状態」を読むのはなぜか。「採用にする」との関係から説明できるか。
4. 「採用にする」で版を増やさないのはなぜか。詳細設計モードの段階の「古い」の判定(文書の版の指紋)から説明できるか。
5. 1.4 を表にしたことで、どの後続の処理が影響を受け、どう合わせたか。以前に生成した要件定義書はどう扱われるか。

## 次のフェーズ

**Phase 37**: 外部設計書のモデル化(画面・API・外部連携の行と要件ID・本文の節・検証。両モード)。この Phase の要件ID を、画面・API の行の「関係する要件ID」として使う。着手時に自動実装モード(#21)と [33-5](../Phase-33/Phase-33-5.md) の Phase 37 の未確定事項を決める。
