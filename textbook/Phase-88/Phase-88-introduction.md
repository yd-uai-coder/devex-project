# Phase 88 導入: 合意済みの版と説明書の画面・小さな修正(ステージ11)

## 目的

ステージ11(合意と変更の一巡)の8つ目の Phase。[80-4](../Phase-80/Phase-80-4.md) の Phase 88 として、Phase 81・84 で作った束と説明書の API に画面を付け、Phase 81〜87 から積んできた小さな修正を済ませる。
- 合意済みの版(束)を画面で作り、中身を見る。作成では検証済みの CR を選び、その CR の合意の記録を初期値にする。
- CR の詳細で、変更の説明書のプレビューを見て、任意の要約を確かめる。
- テストの DB の作成・終了するモデル・束の一覧の重さ・版の履歴の CR を直す。

これで、受付から検証、新しい束までが画面で一巡する(確かめるのは Phase 89)。

- 小さな修正(テストの DB・終了するモデル・束の一覧・版の履歴の CR)── [88-1](./Phase-88-1.md)
- 束と説明書の API・型・純粋関数・ストア ── [88-2](./Phase-88-2.md)
- 合意済みの版(束)の画面 ── [88-3](./Phase-88-3.md)
- 説明書のタブ(要約の確認とプレビュー)── [88-4](./Phase-88-4.md)

## パイプライン上の位置づけ・前提

```
SCR-005 / SCR-008 / CR の一覧の見出し「合意済みの版」(詳細設計モードだけ)               ──[88-3]
   ▼
/projects/{id}/baselines  一覧・作成(検証済みの CR → 合意の記録の初期値 / 入る段階)       ──[88-3]
   │   CR の一覧の応答に decision・included_baseline_number(この Phase で移した)           ──[88-2]
   │   束の一覧は写しの中身を DB から読まない                                                ──[88-1]
   ▼
/projects/{id}/baselines/{番号}  合意の記録・入れた CR・写した文書(md)・段階の表           ──[88-3]

/projects/{id}/change-requests/{番号}
   [内容][影響][検証][説明書][たどる記録]
   └ 説明書  要約(作る・元の文と直す欄・印・札・保存・確認)/ 出力のプレビュー・ダウンロード ──[88-4]
SCR-005 の版の履歴: モデル名・「CR-N で反映」                                               ──[88-1]
```

- **前提として読むもの**:
  - 束の API と決定: [Phase 81](../Phase-81/Phase-81-introduction.md)・[Phase 86](../Phase-86/Phase-86-introduction.md)(束に検証済みの CR を入れる)。
  - 説明書と要約の API と決定: [Phase 84](../Phase-84/Phase-84-introduction.md)。
  - CR の画面: [Phase 87](../Phase-87/Phase-87-introduction.md)(ストア・タブ・作成のフォーム・テストの準備)。
  - 外部設計書 2.12節(選べるモデル)・2.14節。
- **この Phase を始めた時点の状態**:
  - devex-api の HEAD は `fd7078e`(Phase 86)、devex-ui は `1a83ff7`、外側のリポジトリは `39eb3f5`。Phase 87 の変更は、3つとも未コミットのまま、その上に積んだ。
  - alembic の head は `483d9e531ba0`。この Phase で `be106e6426be` を足した(データのマイグレーション。表は変えていない)。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(本体 + samples)。

E2E: この Phase では流さない。CR の流れの E2E は、Phase 89 で既存を含めて全部流す(80-4)。画面確認も Phase 89 にまとめる(#37 の運用注記。下の申し送り)。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 88 開始時」を参照。計画モードで1回(4問)聞いた。3問目は、ユーザーが3案の違いを具体的なイメージで求めたので、画面のイメージを並べてもう一度聞いた。

| # | 問い | 決定 |
|---|---|---|
| 1 | 自動実装モード | on(推奨どおり) |
| 2 | 束の画面の置き場所 | 新しいページ(一覧と作成・版ごとの中身)。CR の一覧と SCR-005・SCR-008 の見出しからリンクする(推奨どおり) |
| 3 | 説明書のプレビューと要約の確認の出し方 | CR の詳細の5つ目のタブ。LLM の元の文と直す欄を左右に並べる(推奨どおり。3案を画面のイメージで比べてから選んだ) |
| 4 | 終了する `gemini-3.1-flash-lite` | 今外し、選んでいた利用者の設定はマイグレーションで後継の `gemini-3.5-flash-lite` へ移す(推奨どおり) |

Claude の判断(計画の承認で確定、または作業中):

- モデルの後継は、Context7 で Gemini API の deprecations ページを確かめた(終了は 2027-05-07、推奨の後継は `gemini-3.5-flash-lite`)。過去の版・要約のモデル名は記録なので変えない。downgrade は何もしない。
- 束の一覧は、写しの中身(`content`・`model`)を DB から読まない(申し送り「一覧の応答の大きさ」)。
- 版の履歴の応答に反映した CR の番号を足し、SCR-005 に「CR-N で反映」とモデル名を出す(申し送り「文書の版の応答に CR を出すか」)。
- 束の作成のフォーム: 検証済みでまだ入れていない CR を選ぶ(0件でも作れる)。手で直していない合意の記録の欄だけを、選んだ CR の記録で埋める。開くと段階の一覧を読む(止まった生成の回収と、入る段階の表示)。生成中は作れない。
- 束の中身: 合意の記録・入れた CR・写した文書(開いたときに md を描く)・段階の表。段階の写しの中身は出さない。
- md の描き方を `MarkdownBody` に出し、文書・束・説明書で共通にする(#17)。
- 要約を直した人の列は足さない(画面確認で要ると分かったら決める)。
- テンプレートから取り込んだのは `postgres-init/01-create-test-db.sh` だけ。
- **作業中**: CR の一覧の応答に、合意・却下の記録 `decision` と入れた束の番号 `included_baseline_number` を移した(詳細だけが持っていた)。束の作成のフォームが、入れられる CR を絞り、初期値を作るため。CR ごとに詳細を読むより軽い。応答の項目を足しただけなので、#40 の CR にはしなかった([88-2](./Phase-88-2.md))。
- **作業中**: 束の一覧が中身を読まなくなったので、CR の作成の「最新の束」は、新しい `BaselineRepository.latest` で中身ごと読むようにした([88-1](./Phase-88-1.md))。
- **作業中**: 束の API の包みと型を、CR の feature から `features/baselines/` へ移した(束の画面という2つ目の消費者ができたため。#17)。説明書のダウンロードのボタンを部品にし、見出しと説明書のタブで共通にした。

推奨と違った選択は0件。計画の差し戻しは無し。#39 の材料。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-88-1.md`](./Phase-88-1.md) | 小さな修正(テストの DB・終了するモデル・束の一覧・版の履歴の CR) | あり(api 本体 8 + テスト 5、ui 本体 2 + テスト 1。ほかにインフラ 1) | Phase 81(束)・85(版の CR)・67(カタログ) |
| [`Phase-88-2.md`](./Phase-88-2.md) | 束と説明書の API・型・純粋関数・ストア | あり(api 本体 1 + テスト 2、ui 本体 9 + テスト 11。テストの共通の準備を含む) | Phase 84(説明書)・86(束に CR)・87(CR の画面) |
| [`Phase-88-3.md`](./Phase-88-3.md) | 合意済みの版(束)の画面 | あり(本体 13 + テスト 10。テストの共通の準備を含む) | 88-2 |
| [`Phase-88-4.md`](./Phase-88-4.md) | 説明書のタブ(要約の確認とプレビュー) | あり(本体 5 + テスト 3) | 88-2(`markSegments`・`summaryOutputNote`・ストア)・88-3(`MarkdownBody`) |

## サンプルコード一覧

`textbook/samples/` の新規・更新(本体の `src/app/(pages)/(protected)/...` は samples では `src/app/...`):

- 88-1:
  - `backend/`: `app/ai/llm/catalog.py`・`alembic/versions/be106e6426be_retire_gemini_31_flash_lite.py`(新規)・`app/repositories/baseline.py`・`app/repositories/change_request.py`・`app/services/change_request_service.py`・`app/schemas/document.py`・`app/services/doc_generator_service.py`・`app/api/routes/projects.py`、テスト `test_llm_catalog.py`・`test_llm_settings_service.py`・`test_retire_model_migration.py`(新規)・`test_baseline_service.py`・`test_document_versions.py`
  - `frontend/src/features/documents/`: `api/documentsApi.ts`・`components/VersionHistoryPanel.tsx` とそのテスト
- 88-2:
  - `backend/`: `app/schemas/change_request.py`、テスト `test_change_requests_api.py`・`test_change_request_trace.py`
  - `frontend/src/features/baselines/`(すべて新規): `api/types.ts`・`api/baselinesApi.ts`・`baselineOps.ts`・`baselines-store.ts`・`test-utils/baselineFixtures.ts`・それぞれのテスト
  - `frontend/src/features/change-requests/`(更新): `api/types.ts`・`api/changeRequestsApi.ts`・`changeRequestOps.ts`・`change-requests-store.ts`・`components/ChangeRequestForm.tsx`・`test-utils/` の2つ・それぞれのテスト
- 88-3:
  - `frontend/src/features/documents/components/`: `MarkdownBody.tsx`(新規)・`DocumentMarkdownView.tsx`・`DocumentsPageContent.tsx`
  - `frontend/src/features/baselines/`(新規): `components/` の `BaselineList.tsx`・`BaselineCreateForm.tsx`・`BaselinesPageContent.tsx`・`BaselineDetailContent.tsx`、`test-utils/resetBaselinesStore.ts`、それぞれのテスト
  - ルート(新規): `app/projects/[id]/baselines/page.tsx`・`[number]/page.tsx` とそれぞれのテスト
  - 更新: `change-requests/components/` の `ChangeRequestList.tsx`・`ChangeRequestsPageContent.tsx`・`ContentTab.tsx`、`detailed-design/components/DetailedDesignPageContent.tsx`(と、それぞれのテスト)
- 88-4:
  - `frontend/src/features/change-requests/components/`: `ExplanationDownloadButton.tsx`・`SummaryReview.tsx`・`ExplanationTab.tsx`(新規)・`ChangeRequestActions.tsx`・`ChangeRequestDetailContent.tsx`(更新)、それぞれのテスト
- ミラーしないもの(#21 の共通): `devex-api/postgres-init/01-create-test-db.sh`(インフラのファイル)。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| [88-1](./Phase-88-1.md) | `catalog.py`・`be106e6426be_…py`・`repositories/baseline.py`・`doc_generator_service.py` | 終了するモデルを外して設定を移し、束の一覧を軽くし、版の履歴に反映した CR を出す | カタログの数と後継・移行の表・一覧が中身を読まない・`latest`・版の CR の番号・画面の表示 |
| [88-2](./Phase-88-2.md) | `baselinesApi.ts`・`baselineOps.ts`・`baselines-store.ts`・`changeRequestOps.ts`・`change-requests-store.ts` | 束の API と作成の変換と状態を持ち、説明書と要約の操作をタブの中身として持つ | 一覧の合意の記録と入れた束・パスと本文・入れられる CR・初期値と手で直した欄・作れない理由・入る段階・作成の後の鮮度・印の区切り・状態の文・要約の操作の後にタブだけが変わる |
| [88-3](./Phase-88-3.md) | `BaselineCreateForm.tsx`・`BaselinesPageContent.tsx`・`BaselineDetailContent.tsx`・`MarkdownBody.tsx` | 束を作り、中身を見て、CR と束を行き来する | 初期値と送る本文・手で直した欄・入る段階・生成中・作った後の移動・中身の各節・md は開いたとき・リンク |
| [88-4](./Phase-88-4.md) | `ExplanationTab.tsx`・`SummaryReview.tsx`・`ExplanationDownloadButton.tsx` | 要約を作り・直し・確かめ、出力のプレビューを見る | 札・合わない所の一覧と印・保存と確認の出し分け・出力に載るかの文・プレビュー・ダウンロード・失敗 |

## 写経順序(#23)

章番号順(88-1 → 88-2 → 88-3 → 88-4)。各章の表の順(依存順。#30)に写す。

- 88-1 のマイグレーションは、開発の DB に当てる前に、revision ID が衝突しないことと head が1つであることを確かめる。
- 複数の章にまたがるファイルは、samples のタグの章の分だけを写す。対象: `ChangeRequestsPageContent.test.tsx`(88-2・88-3)。
- 88-2 の CR の型の変更(束の型を外す)は、同じ章の `ChangeRequestForm.tsx`・テストの import 先の変更と一緒に写す(片方だけだと型が通らない)。

実 import 監査(#15。全 import 文を読んで確かめた):

- 88-1:
  - `change_request_service.py` → `BaselineRepository.latest`(この章)。
  - `doc_generator_service.py` → `ChangeRequestRepository`(この章で `numbers_by_id`)。`projects.py` → `change_request_numbers`・`document_read` の引数(この章)。
  - 移行ファイルは app を import しない。`test_retire_model_migration.py` → 移行ファイル(`importlib`)・`find_model`(既存)。
  - `test_document_versions.py` → `tests/fixtures/change_requests.applied_change_request_project`(Phase 86)。
  - `VersionHistoryPanel.tsx` → 型の新しい項目(この章)。
- 88-2:
  - `baselineOps.ts` → CR の型(この章で `decision`・`included_baseline_number`)・`localInputToIso`(87-1)・`STAGE_TITLES`・`STATE_LABELS`・段階の型(既存)。
  - `baselines-store.ts` → `baselinesApi`(この章)・`listDesignStages`(既存)・`useChangeRequestsStore`(87-1)。
  - `change-requests-store.ts` → `baselinesApi`・束の型(この章)・説明書の API(この章)。
  - `ChangeRequestForm.tsx` → 束の型(この章)。テスト → この章のものと `makeBaselineSummary`(この章)。
- 88-3:
  - `ChangeRequestList.tsx`・`ChangeRequestsPageContent.tsx`・`ContentTab.tsx` → `baselineHref`・`baselinesHref`(88-2)。
  - `BaselineCreateForm.tsx` → `applySelection`・`createBlocker`・`stagePreview`・`toCreateBody`(88-2)・`nowLocalInput`(87-1)・`tableStyles`(既存)。
  - `BaselinesPageContent.tsx` → 束のストア(88-2)・フォームと一覧(この章)・CR のストア(87-1)。
  - `BaselineDetailContent.tsx` → `MarkdownBody`(この章)・`StatusBadge`(87-2)・`baselineOps`(88-2)。
  - テスト → この章のものと `resetBaselinesStore`(この章)・`renderWithStore`(87-3)・fixture(88-2・87-1)。
- 88-4:
  - `SummaryReview.tsx` → `markSegments`・`SUMMARY_TONE`(88-2)・`BADGE`・`INPUT`(既存)。
  - `ExplanationTab.tsx` → `summaryOutputNote`・ストアの要約の操作(88-2)・`MarkdownBody`(88-3)・この章の部品。
  - `ChangeRequestActions.tsx`・`ChangeRequestDetailContent.tsx` → この章の部品。テスト → `makeExplanation`・`makeSummary`(88-2)。

前方 import は無い。各章が作成・更新した本体のファイルは、その章のテストが import する。`BaselineList` は `BaselinesPageContent.test.tsx`、`MarkdownBody` は `BaselineDetailContent.test.tsx`・`ExplanationTab.test.tsx`(と既存の `DocumentMarkdownView.test.tsx`)、`SummaryReview`・`ExplanationDownloadButton` は `ExplanationTab.test.tsx` が描く部品を通して読み込む。CR のサービスの `_base_baseline` は、基準の束を省いて CR を作る fixture(`test_document_versions.py` が使う)を通る。

## 検証結果

- 章ごとの部分テストは、すべて成功した。
  - 88-1: devex-api のカタログ・移行・束・版の履歴のテスト、devex-ui の版の履歴。
  - 88-2: devex-api の CR と束のテスト 138件、devex-ui の束と CR の API・純粋関数・ストア。
  - 88-3: 束の画面のテスト 24件と、リンクを足した画面のテスト。
  - 88-4: 説明書のタブ・詳細・見出しのテスト 16件。
- マイグレーション: 使い捨ての DB で、`483d9e531ba0` → 3.1 の行と別のモデルの行を入れる → head(3.1 の行だけが 3.5 になる)→ 1つ下げ → 上げ直し、を確かめた。開発の DB(3.1 の行は無し)は head まで上げた。
- `postgres-init`: 空のボリュームの使い捨てのコンテナ(`postgres:17-alpine`)で走らせ、`app_test` ができることを確かめた。
- Phase 完了時の全体テスト(#18):
  - devex-api: **1626 件成功**(32 件は integration で除外。Phase 87 から2件増えた ── 移行の表と版の履歴の CR)。初回は、カタログの API の数(8)を固定で書いていたテスト1件が落ちたので、`CATALOG` と比べる形に直した。integration は流していない(表は変えておらず、足したのはデータの移行と応答の項目のため)。
  - devex-ui: **183 ファイル・1162 件成功**(`--maxWorkers=4`)。途中の部分テストで、並列のときの時間切れが1度出た(既知の持ち越し。流し直すと成功)。
- 型と lint:
  - devex-api: `ruff check`(app・tests・alembic)成功(`ruff format` は使わない)。`uvx pyright`(変えたファイル): 0 件。
  - devex-ui: `npx tsc --noEmit` 成功。`npm run lint` は、既存の警告1件(`streamChat.test.ts`)だけ。`npm run build` 成功(新しい2つのルートは動的)。
- `samples_check.py`(`--api-since HEAD --ui-since HEAD`): 一致 918・並び順のみ差 8・例外 5、「samples のみ」「本体のみ」0件。
- `link_check.py`: リンク切れ 0 件。
- 実 LLM: 呼んでいない(費用 0)。
- 画面を開いての確認: していない。下の申し送り「画面確認」に積んだ。

## 未消化の申し送り(#37)

[Phase 87](../Phase-87/Phase-87-introduction.md#未消化の申し送り37) から引き継いだもの。

**ステージ11 の中で扱うもの**:
- **Phase 89 の未確定事項**: [80-4](../Phase-80/Phase-80-4.md)「未確定事項」の Phase 89(実 LLM で反映を通すか・E2E の範囲・本番の手順とロールバック)。81〜88 の分は解決。
- **写しの元の基準の束**: 写しは元の CR の基準の束をそのまま使う。運用で困るかを画面確認(Phase 89)で確かめる。
- **下書きの中の直しは時系列に残さない**: 必要ならステージ12(行単位の変更の履歴)で扱う。
- **予測・説明書の応答の大きさ**: タブを開いたときに読む(Phase 87・この Phase)。画面で重いと分かったら、Phase 89 で絞り方を決める。
- **要約の質** → Phase 89 の効果測定で、実 LLM で1回作って確かめるか(費用の見積もりを出す)。
- **要約を直した人**: 記録していない(確かめた人だけ。この Phase でも足さなかった)。画面確認で要ると分かったら列を足す。
- **要約の生成の回数の上限**: 置いていない(文書の生成と同じ)。既定のキーで使われすぎると分かったら決める。
- **反映を実 LLM で通すか** → Phase 89(80-4 の未確定事項のまま)。今は偽の LLM でしか通していない。
- **段階の承認で付く印の漏れ** → Phase 89 の効果測定。CR を渡して作り直した段階を承認したときに、新しく生まれた要素から先の印は CR に結ばれない(ユーザー決定で結ばない)。「実際だけ」と検証の漏れの数で確かめる。
- **反映の後の CR の流れの部品**: `tests/fixtures/change_requests.py`(Phase 86)。85-2〜85-4 のテストの中の同じ手順は、触るときに寄せる(#17)。
- **CR の流れの E2E** → Phase 89(80-4)。束は API で作るか、この Phase の画面で作るか、を Phase 89 の着手時に決める。CR の作成は、束の中身から作成のページへ移って行う(完了後の調整)。
- **反映の完了待ちの範囲**: 完了待ちは CR の詳細の画面だけが持つ。生成中に一覧や別の画面へ移って戻ると、反映のボタンを押すまで待ち直さない(押すと 409 を待ちに変える)。詳細を開いたときにプロジェクトの生成中を読むかは、画面確認で決める。
- **CR を選ぶ欄の初期値**: 反映済みの CR のうち、未確認の印の出どころにある最初の CR。CR が2つ以上同時に反映済みのときの扱いを、画面確認で確かめる。
- **画面確認**(#37 の運用注記で Phase 89 にまとめる): 偽の LLM で、受付から検証・たどる記録・新しい束までを1回通す。
  - Phase 87 の分: CR の一覧・作成・詳細のタブ、文書への反映と完了待ち、SCR-008 の CR を選ぶ欄と段階の作り直し、`?stage=N`、検証のタブ。見た目と文言・狭い画面での表の横幅・ダイアログの中の入力・レビューを外す操作が要るか・写しの元の束で困るか。
  - **この Phase の完了後の調整の分**: 束の中身から作成のページへ移る動線と、基準の版の固定の表示。一覧の番号のリンクの見え方。簡易モードの URL を開いたときの知らせ。
  - **この Phase の分**: 束の一覧・作成(CR を選んだときの初期値・手で直した欄・入る段階の表・生成中の止め方。止まった段階の生成が、フォームを開いたときの段階の一覧の読み込みで回収されるか ── Phase 81 の申し送り)・中身(md を開く・段階の表)、説明書のタブ(左右の列が狭い画面で上下に積まれるか・印の見え方・保存と確認・作り直し・「古い」の札)、版の履歴の「CR-N で反映」、CR と束の間のリンク。

**この Phase で生まれたもの**(ステージ11 の中で扱う):
- **束の段階の写しを読む画面**: 束の中身では、段階の写しの中身(model)を出していない(重いため)。合意した時点の段階を見たい場面が画面確認で出たら、見せ方を決める。
- **全角の数字の印**: 照合はサーバーが全角を半角に直して行うが、画面の文の中の印は半角だけに付く(上の一覧には出る)。画面確認で困るかを見る。
- **束の一覧の入れた CR**: 束の応答には入れた CR を持たせず、CR の一覧の `included_baseline_number` から引いている(Phase 86 の申し送り「束の応答に、入れた CR の番号を出すか」は、出さずに済ませた)。CR が多くなって一覧が重いと分かったら、束の応答に足す。

**ステージ11 の範囲の外**(行き先は [80-1](../Phase-80/Phase-80-1.md) の表):
- 振り返り 6節の残り7件:
  - ステージ12: 推測の採用率・決める機会
  - ステージ15 の前後: 前提作業・戻し方・版の一致
  - ヒアリングを扱うステージ: 認証の対の問い・基本機能の観点
- **生成の質の候補4件**: 再生成のきっかけの残り(Phase 70)・設計に無いテスト(Phase 70)・日本語の名前のデータストア(Phase 71)・語の表の範囲(Phase 71)。
- **新しい要件を足す CR の予測の起点を人が選ぶ形**(Phase 83 で見送った): 必要が分かってから(ステージ12 以降)。
- **規模の集計と選択肢つきの説明**: ステージ13。

**持ち越し**(触るときに直す。中身は [振り返り](../retrospectives/project-retrospective.md) 8節):
- `test_chat_service.py` などの pyright の指摘(Phase 40)
- devex-ui の並列のテストのタイムアウト(Phase 44)。この Phase の全体テストは `--maxWorkers=4` で流した。部分テストで既定の並列のときに1度出た
- 偽 LLM の外部設計書の GET に DF が無い(Phase 45)
- `DfdEditorTabs` のテストのまれな失敗(Phase 77)
- Google の公開鍵を毎回取りに行く(Phase 74)
- `ListCard` の入れ物(Phase 79。テンプレートでは直した)
- 英語のままの refresh の失敗の文(Phase 79)
- `tagmerge.py` の手直し(ステージ10 の振り返り)。この Phase では、次のものを手で直した。
  - JSX の子の位置に `//` のタグを入れた所(`VersionHistoryPanel.tsx`・`DocumentsPageContent.tsx`・`DetailedDesignPageContent.tsx`・`ContentTab.tsx`・`ChangeRequestList.tsx`・`ChangeRequestsPageContent.tsx`・`ChangeRequestActions.tsx`・`ChangeRequestDetailContent.tsx`・`DocumentMarkdownView.tsx`)。`{/* */}` に直した。`DocumentMarkdownView.tsx` にあった Phase 45 の同じ形の誤りも一緒に直した。
  - 削除の範囲が閉じ括弧1つ分ずれた所(`ChangeRequestActions.tsx`・`DocumentMarkdownView.tsx`)。
  - Python の import の変更(ブロックの頭のタグにまとめた)。
  - 複数の章にまたがるテスト(`ChangeRequestsPageContent.test.tsx`)のタグの章。
  - Phase 87 の変更が未コミットのため、tagmerge の旧(本体の HEAD)には Phase 87 の終わりの写しを使った(Phase 88 の始めに作業ツリーを写して残した)。
- `streamChat.test.ts` の lint の警告(使っていない変数。既存)。

**ユーザーが決めるもの**:
- **開発環境の後始末**: 確認用の利用者・プロジェクト、DB の事故の後の複製(振り返り 8節)。
- **この Phase と Phase 87 の未コミット**: 外側のリポジトリ・devex-api・devex-ui の変更。コミットはユーザーが行う(#35)。タグは devex-api・devex-ui とも `phase-87`・`phase-88`。

**セッションの区切りの記録**: Phase 88 は1セッションで行った(計画 → 88-1〜88-4 の実装 → 全体テスト → samples → docs → q_a → 教材 → 画面を見てのユーザーの指摘による完了後の調整)。

**この Phase で解決したもの**:
- **`gemini-3.1-flash-lite` の終了**(Phase 81 から): [88-1](./Phase-88-1.md)。外し、設定を後継へ移した。
- **`postgres-init` の構文の誤り**(Phase 81 から): [88-1](./Phase-88-1.md)。
- **一覧の応答の大きさ**(Phase 81 から): [88-1](./Phase-88-1.md)。一覧は写しの中身を読まない。
- **文書の版の応答に CR を出すか**(Phase 85 から): [88-1](./Phase-88-1.md)。版の履歴に出した。
- **80-4 の Phase 88 の未確定事項**(要約の確認の画面・モデルのカタログの後継・`postgres-init`): 着手時の相談と [88-1](./Phase-88-1.md)・[88-4](./Phase-88-4.md)。
- **説明書のプレビューと要約の確認の画面**(Phase 84 から): [88-4](./Phase-88-4.md)。
- **束の作成で CR を選ぶ画面と、合意の記録の初期値**(Phase 86 から): [88-3](./Phase-88-3.md)。
- **止まった段階の生成と束**(Phase 81 から): [88-2](./Phase-88-2.md)。作成のフォームを開くと段階の一覧を読む。動きは画面確認で確かめる(上の「画面確認」)。

## Phase 完了後の調整

Phase の完了の後、ユーザーが画面を見て修正を求めた(#38 の通常の工程)。Phase 87 の決定(作成のフォームは CR の一覧に置き、基準の束を選ぶ)を変えるので、#40 の CR として [`q_a.md`](../q_a.md)「Phase 88 完了後の調整」に残し、docs に反映した。計画モードで2問を聞き、2問とも推奨どおりになった。

| 指摘 | 対応 |
|---|---|
| 束の一覧で、番号から中身へ移れることが見て分かりにくい | 番号を青い下線のリンクにし、行の末尾に「中身を見る →」を足した。CR の一覧の番号も同じ形にそろえた(`tableStyles` の `LINK`) |
| 束の中身から CR の作成へ移りたい。基準の版は移る元に合わせたい | 束の中身に「この版を基準に変更要求を作る →」を置き、作成のページ `/projects/{id}/baselines/{番号}/change-requests/new` へ移る。基準の版は URL の番号に固定する(ユーザー決定) |
| CR の作成を束の中身からだけにし、基準の版も固定したい | CR の一覧のページから作成のボタンとフォームを外し、「変更要求は、基準にする合意済みの版の中身のページから作ります」と束の一覧へのリンクを出す。`ChangeRequestForm` の基準の束を選ぶ欄は、使う所が無くなったので外した |
| 確認: 簡易モードで `/baselines` を直接開くと作れるが、正しいか | 仕様では正しくない(2.14節「詳細設計モードだけ」)。作成の API は 409 で断っていたが、読む API と画面はモードを見ていなかった。束と CR の読む API も 409 で断り、画面は本体の代わりに「詳細設計モードのプロジェクトだけで使えます」を出す(ユーザー決定) |

### 作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`backend/app/services/baseline_service.py`](../samples/backend/app/services/baseline_service.py) | 更新 | `require_detailed`。作成・`list_for_project`・`get` で使う |
| [`backend/app/services/change_request_service.py`](../samples/backend/app/services/change_request_service.py) | 更新 | 作成・`list_for_project`・`_load` で `require_detailed` |
| [`frontend/src/features/detailed-design/components/tableStyles.ts`](../samples/frontend/src/features/detailed-design/components/tableStyles.ts) | 更新 | `LINK`(表の中のリンクの色と下線) |
| [`frontend/src/features/change-requests/changeRequestOps.ts`](../samples/frontend/src/features/change-requests/changeRequestOps.ts) | 更新 | `isDetailedModeOnly`(409 `DESIGN_STAGES_NOT_AVAILABLE` か) |
| [`frontend/src/features/change-requests/change-requests-store.ts`](../samples/frontend/src/features/change-requests/change-requests-store.ts) | 更新 | `unavailable`(一覧・詳細・束・要件の取得の 409) |
| [`frontend/src/features/baselines/baselineOps.ts`](../samples/frontend/src/features/baselines/baselineOps.ts) | 更新 | `newChangeRequestHref` |
| [`frontend/src/features/baselines/baselines-store.ts`](../samples/frontend/src/features/baselines/baselines-store.ts) | 更新 | `unavailable`(一覧・中身の取得の 409) |
| [`frontend/src/features/change-requests/components/DetailedModeOnlyNotice.tsx`](../samples/frontend/src/features/change-requests/components/DetailedModeOnlyNotice.tsx) | 新規 | 簡易モードの知らせ(見出し・文・文書の画面へのリンク) |
| [`frontend/src/features/change-requests/components/ChangeRequestList.tsx`](../samples/frontend/src/features/change-requests/components/ChangeRequestList.tsx) | 更新 | 番号と基準の版を `LINK` で |
| [`frontend/src/features/change-requests/components/ChangeRequestForm.tsx`](../samples/frontend/src/features/change-requests/components/ChangeRequestForm.tsx) | 更新 | 基準の束を選ぶ欄(`baselines`・`onBaselineChange`)を外す |
| [`frontend/src/features/change-requests/components/ChangeRequestCreateContent.tsx`](../samples/frontend/src/features/change-requests/components/ChangeRequestCreateContent.tsx) | 新規 | 作成のページの本体(基準の版を固定・束の要件を読む・作ったら詳細へ・やめると束へ・束が無い・簡易モード) |
| [`frontend/src/features/change-requests/components/ChangeRequestsPageContent.tsx`](../samples/frontend/src/features/change-requests/components/ChangeRequestsPageContent.tsx) | 更新 | 作成を外し、案内と束の一覧へのリンク。簡易モードの知らせ |
| [`frontend/src/features/change-requests/components/ChangeRequestDetailContent.tsx`](../samples/frontend/src/features/change-requests/components/ChangeRequestDetailContent.tsx) | 更新 | 簡易モードの知らせ |
| [`frontend/src/features/baselines/components/BaselineList.tsx`](../samples/frontend/src/features/baselines/components/BaselineList.tsx) | 更新 | 番号を `LINK` で、「中身を見る →」の列 |
| [`frontend/src/features/baselines/components/BaselinesPageContent.tsx`](../samples/frontend/src/features/baselines/components/BaselinesPageContent.tsx) | 更新 | 簡易モードの知らせ |
| [`frontend/src/features/baselines/components/BaselineDetailContent.tsx`](../samples/frontend/src/features/baselines/components/BaselineDetailContent.tsx) | 更新 | 「この版を基準に変更要求を作る →」・簡易モードの知らせ |
| [`frontend/src/app/projects/[id]/baselines/[number]/change-requests/new/page.tsx`](../samples/frontend/src/app/projects/[id]/baselines/[number]/change-requests/new/page.tsx) | 新規 | ルート(版の番号を数にして渡す) |
| テスト(更新) | 更新 | `test_baseline_service.py`・`test_change_request_service.py`(簡易モードの読み出し)、ストア2つ・`changeRequestOps.test.ts`・`ChangeRequestsPageContent.test.tsx`・`ChangeRequestForm.test.tsx`・`ChangeRequestDetailContent.test.tsx`・`BaselinesPageContent.test.tsx`・`BaselineDetailContent.test.tsx`、テストの準備 `renderWithStore.tsx`・`resetBaselinesStore.ts` |
| [`frontend/src/features/change-requests/components/__tests__/ChangeRequestCreateContent.test.tsx`](../samples/frontend/src/features/change-requests/components/__tests__/ChangeRequestCreateContent.test.tsx)・[`new/__tests__/page.test.tsx`](../samples/frontend/src/app/projects/[id]/baselines/[number]/change-requests/new/__tests__/page.test.tsx) | 新規 | 作成のページとルート |

samples のタグは `Phase-88(完了後の調整)`。`ChangeRequestsPageContent.tsx` とそのテストはほぼ書き換えたので、旧コード全体を1つの「更新」のブロックにした。

### 要点

- **モードの確かめは1つの関数**(#17): `require_detailed(project, what)` を `baseline_service.py` に置き、`ChangeRequestService` からも使う(CR のサービスは束のサービスを読む向きなので、循環しない)。CR ごとの操作と読み出しは、みな `_load` を通るので、そこに1つ置けば、予測・比較・検証・説明書・たどる記録・レビューの候補・反映の受け付けがそろう。バックグラウンドの生成で CR を読む `reflection` は `_load` を通らないが、CR を渡す受け付け(`reflectable`)が先に断る。
- **画面は 409 の `code` で見分ける**(`isDetailedModeOnly`): 404(プロジェクトが無い)の知らせと並べ、本体の代わりに出す。プロジェクトのモードを別に読まないので、判定はサーバーの1か所にある。
- **作成のページは束の一覧から番号の束を探す**: 束の要件の行の API(Phase 87)と、CR の作成のフォームの部品をそのまま使う。基準の版は URL にあり、開き直しても同じ版になる。
- **基準の版を固定する**: API の作成の本文は、基準の束を省くと最新の束のまま(Phase 82)。画面は常に番号を送るので、最新でない版を基準にしても、選び間違いが起きない。

### テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_baseline_service.py`・`test_change_request_service.py`(更新) | `require_detailed` を通る作成・一覧・中身・要件の行、CR の一覧・詳細・説明書 | pytest のテスト関数 | 既存のとおり(SQLite のセッション) |
| `changeRequestOps.test.ts`・ストア2つのテスト(更新) | `isDetailedModeOnly`・`unavailable` | vitest のテスト関数 | 純粋関数はスタブ不要。ストアは `fetch`(`stubFetch`) |
| `ChangeRequestCreateContent.test.tsx`(新規) | `ChangeRequestCreateContent`・`ChangeRequestForm` | Testing Library | ストアの取得・作成(`vi.fn`)と router ── 配線だけを見るため |
| `new/__tests__/page.test.tsx`(新規) | 作成のルート | Testing Library | 本体の部品(`vi.mock`) |
| 画面のテスト(更新) | 一覧・中身・詳細のページの知らせ・リンク・作成へ移るボタン、フォームに基準の欄が無い | Testing Library | 既存のとおり |

- 簡易モード: 束の作成・一覧・中身・要件の行、CR の作成・一覧・詳細・説明書が、みな 409。画面は知らせと文書へのリンクを出し、本体を出さない。
- 作成のページ: 遷移元の版の要件を読む・基準の版の固定の表示と、選ぶ欄が無い・作ると遷移元の版の番号で送り、詳細へ移る・キャンセルで版の中身へ戻る・番号の版が無い。
- リンク: 束の一覧の「中身を見る」、CR の一覧の番号と基準の版、束の中身の作成のボタン、CR の一覧の案内のリンク。

### 検証

- devex-api: **1626 件成功**(テストの件数は変わらない。既存のテストに確かめを足した)。`ruff check`・`pyright`(変えたファイル)成功。
- devex-ui: **1174 件成功**(`--maxWorkers=4`。Phase 88 の終わりから12件増えた)。`tsc` 成功、`lint` は既存の警告1件だけ、`build` 成功(新しいルート `/projects/[id]/baselines/[number]/change-requests/new`)。
- `samples_check.py`: 一致 923・並び順のみ差 8・例外 5、「samples のみ」「本体のみ」0件。`link_check.py`: 0 件。
- 画面の確認は Phase 89(下の申し送り「画面確認」に足した)。

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

設問は Phase の要点の要約(回答は求めない)。

1. 終了するモデルをカタログから外すだけでは足りず、利用者の設定をマイグレーションで移すのはなぜか。過去の版のモデル名を書き換えないのはなぜか。
2. 束の一覧で写しの中身を読まないようにしたとき、CR の作成の「最新の束」を一覧から読めなくなったのはなぜか(非同期のセッションと `defer`)。
3. 合意の記録の初期値を、手で直していない欄だけに入れるのはなぜか。初期値を作るための項目を、CR の詳細でなく一覧の応答に移したのはなぜか。
4. 照合はサーバーが今の文に対して求めるのに、元の文にも印を付けるのはなぜか。保存していない直しがある間に「確認した」を押せないのはなぜか。
5. 要約の操作の後に、CR の詳細やほかのタブを捨てず、説明書のタブだけを置き換えるのはなぜか。

## 次のフェーズ

**Phase 89**: 効果測定・統合/E2E・本番への反映(ステージ11 の最後)。[ベースライン](../../appendix/measurements/stage11-baseline.md)と同じ表の埋め直し、CR の流れの E2E と既存を含めた全 E2E(#36)、マイグレーションの往復、`OPERATIONS.md` の手順、本番での確認と画面確認(Phase 87・88 の分)。着手時に、自動実装モード(#21)と [80-4](../Phase-80/Phase-80-4.md) の Phase 89 の未確定事項(実 LLM で反映を通すか・E2E の範囲・本番の手順とロールバック)と、この Phase の申し送りを決める。実 LLM を使うなら、費用の見積もりの表を出す。
