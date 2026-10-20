# Phase 87 導入: CR の画面(ステージ11)

## 目的

ステージ11(合意と変更の一巡)の7つ目の Phase。[80-4](../Phase-80/Phase-80-4.md) の Phase 87 として、Phase 81〜86 で一巡した CR の API に画面(SCR-010)を付ける。画面で行うのは次のとおり。
- 受付から合意・反映・検証までを、画面で通す。
- 反映済みの CR を段階の生成に渡す(詳細設計画面から)。
- 受付からの記録をたどる。

合意済みの版(束)の画面・説明書のプレビューと要約の確認・小さな修正は Phase 88。

- API・型・純粋関数・ストア(と、束の要件の行の小さな API)── [87-1](./Phase-87-1.md)
- 一覧と作成 ── [87-2](./Phase-87-2.md)
- 詳細(内容・操作・影響・たどる記録)── [87-3](./Phase-87-3.md)
- 検証と SCR-008 からの反映 ── [87-4](./Phase-87-4.md)

## パイプライン上の位置づけ・前提

```
SCR-005 / SCR-008 の見出し「変更要求(CR)」(詳細設計モードだけ)                       ──[87-2]
   ▼
/projects/{id}/change-requests  一覧・作成(基準の束 → 束の要件 → 対象ごとの種類と案)   ──[87-2]
   │   GET .../baselines/{n}/requirements(この Phase で足した)                         ──[87-1]
   ▼
/projects/{id}/change-requests/{番号}                                                    ──[87-3]
   見出し: 状態・説明済み・合意/却下(記録のダイアログ)・取り下げ・写し・説明書(.md)
   ├ 内容      対象(合意済みの文と案)・合意の記録・重なり・写し・直す
   ├ 影響      予測(段階ごと)・比較(予測の外/予測だけ/一致)・[文書へ反映] → 反映済み
   ├ 検証      印の3つの状態 →(?stage=N)SCR-008・文書の側の確認・レビューを結ぶ・[検証済み] ──[87-4]
   └ たどる記録 時系列の行と指す先(版・残っているか・モデル・レビュー・束)
SCR-008「変更の影響」: 反映済みの CR を選ぶ(初期値は印の出どころ cr:N)                  ──[87-4]
   → 再生成の候補(段階5・6・8)/「段階N を CR-M で作り直す」に cr_number
```

- **前提として読むもの**:
  - CR の API と決定: [Phase 82](../Phase-82/Phase-82-introduction.md)〜[Phase 86](../Phase-86/Phase-86-introduction.md) の introduction(とくに「未消化の申し送り」の画面の項目)。
  - 外部設計書 2.14節。
  - devex-ui の既存の型:
    - ストア: `documents-store.ts`・`detailed-design-store.ts`
    - 「変更の影響」のパネル: `ChangeImpactPanel.tsx`・`RegenerationTargets.tsx`。[Phase 44](../Phase-44/Phase-44-introduction.md)
    - 生成の完了待ち: `useGenerationPolling`
- **この Phase を始めた時点の状態**: devex-api の HEAD は `fd7078e`(Phase 86)、devex-ui は `1a83ff7`、外側のリポジトリは `39eb3f5`。alembic の head は `483d9e531ba0`(この Phase でマイグレーションは足していない)。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(本体 + samples)。

E2E: この Phase では流さない。CR の流れの E2E は、Phase 89 で既存を含めて全部流す(80-4)。画面確認も Phase 89 にまとめる(#37 の運用注記。下の申し送り)。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 87 開始時」を参照。計画モードで1回(4問)聞いた。

| # | 問い | 決定 |
|---|---|---|
| 1 | 自動実装モード | on(推奨どおり) |
| 2 | 画面の置き場所 | 新しいページにする(一覧と作成・CR ごとの詳細)。SCR-005・SCR-008 の見出しからリンクする(推奨どおり) |
| 3 | 反映済みの CR を段階の生成に渡す操作の置き場所 | SCR-008 の「変更の影響」に CR を選ぶ欄を置く。初期値は印の出どころの CR。文書への反映は CR の詳細のボタン(推奨どおり) |
| 4 | CR の詳細の時系列 | たどる記録だけで出す(推奨どおり) |

Claude の判断(計画の承認で確定、または作業中):

- 詳細は4つのタブ(内容・影響・検証・たどる記録)にする。見出しのボタンは `allowed_actions` から作り、`apply` はボタンにしない。説明書はダウンロードだけを置く(プレビューは Phase 88)。
- 作成のフォームは、基準の束(既定は最新)と、その束の要件から選ぶ対象(種類と案。削除では案の欄を出さない)で作る。束が無ければ作成を止める。
- devex-api に `GET /projects/{id}/baselines/{number}/requirements` を足す。束の詳細は全段階の写しを含んで重いため。CR の対象の確かめと読み方を共通にする(#17)。マイグレーションは無し。
- タブの中身(予測・比較・検証・記録・レビューの候補)は、タブを開いたときに読む。
- 詳細設計画面は `?stage=N` で段階を選んで開く(ページの `searchParams` から渡す)。
- テンプレートから取り込むものは無し。
- **作業中**: タブは既存の `LayoutTabs` でなく、選んだタブだけを描くボタンの列にした。`LayoutTabs` は中身を関数の部品で受け取るので、親が描き直すと部品が作り直され、編集中のフォームの入力が消えるため([87-3](./Phase-87-3.md))。
- **作業中**: ダイアログの確かめのボタンの名前を、見出しのボタンやダイアログの題と違うものにした(「記録する」「取り下げを確定する」「検証を記録する」)。同じ名前だと、読み上げとテストで見分けられないため。
- **作業中**: 「変更の影響」が CR の一覧を読むようになったので、詳細設計画面の既存のテストの準備に、CR のストアの `fetchList` の差し替えを足した。

推奨と違った選択は0件。計画の差し戻しは無し。#39 の材料。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-87-1.md`](./Phase-87-1.md) | API・型・純粋関数・ストア | あり(api 本体 4 + テスト 1、ui 本体 6 + テスト 5) | Phase 82〜86 の API |
| [`Phase-87-2.md`](./Phase-87-2.md) | 一覧と作成 | あり(本体 7 + テスト 5) | 87-1 |
| [`Phase-87-3.md`](./Phase-87-3.md) | 詳細(内容・操作・影響・たどる記録) | あり(本体 8 + テスト 7。テストの共通の準備を含む) | 87-1・87-2(`ChangeRequestForm`・`StatusBadge`) |
| [`Phase-87-4.md`](./Phase-87-4.md) | 検証と SCR-008 からの反映 | あり(本体 11 + テスト 8) | 87-1(`crNumber`・`stagesMarkedBy`・`designStageHref`)・87-3(`ChangeRequestDetailContent`) |

## サンプルコード一覧

`textbook/samples/` の新規・更新(本体の `src/app/(pages)/(protected)/...` は samples では `src/app/...`):

- 87-1:
  - `backend/`: `app/schemas/baseline.py`・`app/services/baseline_service.py`・`app/services/change_request_service.py`・`app/api/routes/baselines.py`・`tests/unit/test_baseline_service.py`
  - `frontend/src/features/`:
    - `change-requests/`(すべて新規): `api/types.ts`・`api/changeRequestsApi.ts`・`changeRequestOps.ts`・`change-requests-store.ts`・`test-utils/changeRequestFixtures.ts`・`api/__tests__/changeRequestsApi.test.ts`・`__tests__/changeRequestOps.test.ts`・`__tests__/change-requests-store.test.ts`
    - 既存の更新: `hearing/api/hearingApi.ts`・`detailed-design/api/designStagesApi.ts`・`detailed-design/api/__tests__/designStagesApi.test.ts`
- 87-2:
  - `frontend/src/features/change-requests/components/`(すべて新規): `StatusBadge.tsx`・`ChangeRequestList.tsx`・`ChangeRequestForm.tsx`・`ChangeRequestsPageContent.tsx`・`__tests__/ChangeRequestForm.test.tsx`・`__tests__/ChangeRequestsPageContent.test.tsx`
  - ルート(新規): `app/projects/[id]/change-requests/page.tsx`・`__tests__/page.test.tsx`
  - 既存の更新: `documents/components/DocumentsPageContent.tsx`・`detailed-design/components/DetailedDesignPageContent.tsx`(と、それぞれのテスト)
- 87-3:
  - `frontend/src/features/change-requests/`(新規): `components/` の `DecisionDialog.tsx`・`ChangeRequestActions.tsx`・`ContentTab.tsx`・`ImpactTab.tsx`・`TraceTab.tsx`・`ChangeRequestDetailContent.tsx`、`test-utils/renderWithStore.tsx`、それぞれのテスト
  - ルート(新規): `app/projects/[id]/change-requests/[number]/page.tsx`・`__tests__/page.test.tsx`
  - 更新: `changeRequestOps.ts`
- 87-4:
  - `frontend/src/features/change-requests/`:
    - 新規: `components/VerificationTab.tsx`・`components/CrReflectionSection.tsx`・`hooks/useAppliedChangeRequests.ts`・`components/__tests__/VerificationTab.test.tsx`
    - 更新: `changeRequestOps.ts`・`components/ChangeRequestDetailContent.tsx`
  - `frontend/src/features/detailed-design/`(更新): `labels.ts`・`detailed-design-store.ts`・`components/RegenerationTargets.tsx`・`components/ChangeImpactPanel.tsx`・`components/DetailedDesignPageContent.tsx`
  - ルート(更新): `app/projects/[id]/detailed-design/page.tsx`
  - それぞれのテスト
- ミラーしないもの(#21 の共通): 無し(インフラ・設定ファイルは変えていない)。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| [87-1](./Phase-87-1.md) | `changeRequestsApi.ts`・`changeRequestOps.ts`・`change-requests-store.ts`・`baseline_service.py` | CR の API を呼び、画面だけが持つ変換をまとめ、一覧・詳細・タブ・操作の状態を持つ | 本文とパス・ボタンの絞り込み・フォームの整え・比較の順・印の出どころ・タブの読み込みと捨て方・文書への反映 |
| [87-2](./Phase-87-2.md) | `ChangeRequestForm.tsx`・`ChangeRequestsPageContent.tsx` | 基準の束の要件から対象を選んで CR を作り、一覧から詳細へ移る | 送る前の確かめ・種類と案・束が無いとき・作った後の移動・リンクの出し分け |
| [87-3](./Phase-87-3.md) | `ChangeRequestActions.tsx`・`ImpactTab.tsx`・`TraceTab.tsx`・`ChangeRequestDetailContent.tsx` | 状態の操作と記録のダイアログ、予測・比較・文書への反映、たどる記録をタブで出す | ボタンの出し分け・合意の記録の本文・反映のボタン・比較の順・指す先・完了待ち |
| [87-4](./Phase-87-4.md) | `VerificationTab.tsx`・`CrReflectionSection.tsx`・`ChangeImpactPanel.tsx` | 検証の確かめと操作、SCR-008 から段階の生成に CR を渡す | 3つの状態とリンク・文書の側・レビュー・検証・CR の初期値と渡し先・`?stage=N` |

## 写経順序(#23)

章番号順(87-1 → 87-2 → 87-3 → 87-4)。各章の表の順(依存順。#30)に写す。

- 87-1 は devex-api の小さな API を先に写す(作成のフォームが読むため)。
- 複数の章にまたがるファイルは、samples のタグの章の分だけを写す。対象: `changeRequestOps.ts`(87-1・87-3・87-4)・`ChangeRequestDetailContent.tsx` とそのテスト(87-3・87-4)・`DetailedDesignPageContent.tsx` とそのテスト(87-2・87-4)。
- 87-3 の `ChangeRequestDetailContent.tsx` は、検証のタブ(`VerificationTab` の import・タブの行・描く所)を写さない(87-4 で足す)。

実 import 監査(#15。全 import 文を読んで確かめた):

- 87-1:
  - `changeRequestOps.ts` → `api/types.ts`(この章)・`detailed-design/api/types.DesignImpactRead`・`detailed-design/labels.STAGE_TITLES`(既存)。
  - ストア → API(この章)・`hearingApi.triggerGeneration`(この章で `crNumber`)・`lib/api`・`lib/generation-failure`(既存)。
  - devex-api の `baselines.py` → `BaselineRequirementRead`(この章)。`baseline_service.py` → `explanation.REQUIREMENTS_KEY`(84-2)。`change_request_service.py` → `baseline_requirement_rows`(この章)。
  - テスト → この章のもの。ただし `changeRequestOps.test.ts` の `defaultReflectionCr` は 87-4 のタグの分。
- 87-2:
  - `StatusBadge` → `STATUS_TONE`(87-1)・`tableStyles`(既存)。`ChangeRequestList` → `StatusBadge`(この章)・`changeRequestHref`(87-1)。
  - `ChangeRequestForm` → 選択肢と対象の関数(87-1)。ページの本体 → ストア・`emptyForm`・`toCreateBody`(87-1)・フォームと一覧(この章)。
  - テスト → この章のものと 87-1 の部品(`changeRequestFixtures`)。
- 87-3:
  - `DecisionDialog` → `nowLocalInput`・`localInputToIso`(87-1)・`ConfirmDialog`(既存)。`ChangeRequestActions` → `downloadExplanation`・`headerActions`(87-1)・`DecisionDialog`(この章)・`saveFile`(既存)。
  - `ContentTab` → `ChangeRequestForm`(87-2)・`formFromChangeRequest`・`toUpdateBody`(87-1)。
  - `ImpactTab` → `comparisonGroups`・`groupByStage`・`stageLabel`・`canReflectDocuments`・`isApplied`(87-1)・`failureHeading`(既存)。
  - `TraceTab` → `statusLabel`(この章)・`GATE_LABEL`(既存)。`ChangeRequestDetailContent` → この章の部品・`StatusBadge`(87-2)・`useGenerationPolling`(既存)。`VerificationTab` は 87-4 のタグの分。
  - テスト → この章のものと `renderWithStore`(この章)。
- 87-4:
  - `VerificationTab` → `designStageHref`・`stageLabel`(87-1)。`CrReflectionSection` → `PARTIAL_STAGES`(この章)・`stagesMarkedBy`・`changeRequestHref`(87-1)・詳細設計のストアの `generate` の `crNumber`(この章)。
  - `useAppliedChangeRequests` → ストア(87-1)。`ChangeImpactPanel` → `defaultReflectionCr`・`CrReflectionSection`・`useAppliedChangeRequests`(この章)。
  - `page.tsx` → `stageParam`(この章)。テスト → この章のものと 87-1 の `makeChangeRequest`。

前方 import は無い。各章が作成・更新した本体のファイルは、その章のテストが import する。`CrReflectionSection`・`useAppliedChangeRequests` は、`ChangeImpactPanel.test.tsx` が描く部品を通して読み込む。

## 検証結果

- 章ごとの部分テストは、すべて成功した。
  - 87-1: devex-api の束のテストと CR のサービスのテスト 28件、devex-ui の API・純粋関数・ストア。
  - 87-2: CR の画面のテスト 36件と、文書の画面のテスト。
  - 87-3: 部品のテスト 31件。
  - 87-4: CR の画面のテスト 62件、詳細設計の画面・パネル・ストア・ラベルのテスト。
- Phase 完了時の全体テスト(#18):
  - devex-api: **1624 件成功**(32 件は integration で除外。Phase 86 から1件増えた ── 束の要件の行のルート)。integration は流していない(DB の表は変えておらず、足したのは読むだけの API のため)。
  - devex-ui: **174 ファイル・1127 件成功**(`--maxWorkers=4`)。
- 型と lint:
  - devex-api: `ruff check`(app・tests・alembic)成功(`ruff format` は使わない)。`uvx pyright`(変えたファイル): 0 件。
  - devex-ui: `npx tsc --noEmit` 成功。`npm run lint` は、既存の警告1件(`streamChat.test.ts`)だけ。`npm run build` 成功(新しい2つのルートは動的)。
- `samples_check.py`(`--api-since HEAD --ui-since HEAD`): 一致 891・並び順のみ差 8・例外 5、「samples のみ」「本体のみ」0件。
- `link_check.py`: リンク切れ 0 件。
- 実 LLM: 呼んでいない(費用 0)。
- 画面を開いての確認: していない。下の申し送り「画面確認」に積んだ。

## 未消化の申し送り(#37)

[Phase 86](../Phase-86/Phase-86-introduction.md#未消化の申し送り37) から引き継いだもの。

**ステージ11 の中で扱うもの**:
- **`gemini-3.1-flash-lite` の終了(2027-05-07 以降)** → Phase 88。その時点の後継のモデルを確かめて、カタログを入れ替える。
- **`devex-api/postgres-init/01-create-test-db.sh` の構文の誤り**(新しいボリュームで、テストの DB が作られない)→ Phase 88。テンプレートで直した形(標準入力から渡す)を取り込む。
- **止まった段階の生成と束**(Phase 81)→ Phase 88 の画面確認。
- **一覧の応答の大きさ**(Phase 81)→ Phase 88。
- **Phase 88・89 の未確定事項**: [80-4](../Phase-80/Phase-80-4.md)「未確定事項」(81〜87 の分は解決)。
- **写しの元の基準の束**: 写しは元の CR の基準の束をそのまま使う。運用で困るかを画面確認(Phase 89)で確かめる。
- **下書きの中の直しは時系列に残さない**: 必要ならステージ12(行単位の変更の履歴)で扱う。
- **予測・説明書の応答の大きさ**: タブを開いたときに読むようにした(この Phase)。画面で重いと分かったら、Phase 88・89 で絞り方を決める。
- **説明書のプレビューと要約の確認の画面** → Phase 88。照合で合わない所の印の出し方、元の文と直した文の並べ方、「古い」の表示。CR の詳細には、今はダウンロードのボタンだけがある。
- **要約の質** → Phase 89 の効果測定で、実 LLM で1回作って確かめるか(費用の見積もりを出す)。
- **要約を直した人**: 記録していない(確かめた人だけ)。画面で要ると分かったら Phase 88 で列を足す。
- **要約の生成の回数の上限**: 置いていない(文書の生成と同じ)。既定のキーで使われすぎると分かったら決める。
- **文書の版の応答に CR を出すか**: 今は出していない(たどる記録で読める)。SCR-005 の版の履歴に要るかを Phase 88 で決める。
- **反映を実 LLM で通すか** → Phase 89(80-4 の未確定事項のまま)。今は偽の LLM でしか通していない。
- **束の作成で CR を選ぶ画面と、合意の記録の初期値** → Phase 88。選んだ CR の合意の記録(相手・メモ・理由)を初期値にする。束の応答に、入れた CR の番号を出すか(今は CR の側の `included_baseline_number` とたどる記録だけ)。
- **段階の承認で付く印の漏れ** → Phase 89 の効果測定。CR を渡して作り直した段階を承認したときに、新しく生まれた要素から先の印は CR に結ばれない(ユーザー決定で結ばない)。「実際だけ」と検証の漏れの数で確かめる。
- **反映の後の CR の流れの部品**: `tests/fixtures/change_requests.py`(Phase 86)。85-2〜85-4 のテストの中の同じ手順は、触るときに寄せる(#17)。

**この Phase で生まれたもの**(ステージ11 の中で扱う):
- **画面確認**(#37 の運用注記で Phase 89 にまとめる): CR の一覧・作成・詳細の4つのタブ、文書への反映と完了待ち、SCR-008 の CR を選ぶ欄と段階の作り直し、`?stage=N`、検証のタブ。偽の LLM で、受付から検証・たどる記録までを1回通す。確かめるのは次のとおり。
  - 見た目と文言。
  - 狭い画面での表の横幅。
  - ダイアログの中の入力。
  - レビューを外す操作が要るか(Phase 86 から)。
  - 写しの元の束で困るか。
- **CR の流れの E2E** → Phase 89(80-4)。束は API で作るか、Phase 88 の画面で作るか、を Phase 89 の着手時に決める。
- **反映の完了待ちの範囲**: 完了待ちは CR の詳細の画面だけが持つ。生成中に一覧や別の画面へ移って戻ると、反映のボタンを押すまで待ち直さない(押すと 409 を待ちに変える)。詳細を開いたときにプロジェクトの生成中を読むかは、画面確認で決める。
- **CR を選ぶ欄の初期値**: 反映済みの CR のうち、未確認の印の出どころにある最初の CR。CR が2つ以上同時に反映済みのときの扱いを、画面確認で確かめる。

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
- devex-ui の並列のテストのタイムアウト(Phase 44)。この Phase の全体テストは `--maxWorkers=4` で流した
- 偽 LLM の外部設計書の GET に DF が無い(Phase 45)
- `DfdEditorTabs` のテストのまれな失敗(Phase 77)
- Google の公開鍵を毎回取りに行く(Phase 74)
- `ListCard` の入れ物(Phase 79。テンプレートでは直した)
- 英語のままの refresh の失敗の文(Phase 79)
- `tagmerge.py` の手直し(ステージ10 の振り返り)。この Phase では、次のものを手で直した。
  - JSX の子の位置に `//` のタグを入れた所(`DocumentsPageContent.tsx`・`ChangeImpactPanel.tsx`・`RegenerationTargets.tsx`・`DetailedDesignPageContent.tsx`・`detailed-design/page.tsx`)。`{/* */}` に直した。
  - 閉じ括弧の前にタグを置いた所(テスト2本)。
  - import の変更(ブロックの頭のタグにまとめた)。
- `streamChat.test.ts` の lint の警告(使っていない変数。既存)。

**ユーザーが決めるもの**:
- **開発環境の後始末**: 確認用の利用者・プロジェクト、DB の事故の後の複製(振り返り 8節)。
- **この Phase の未コミット**: 外側のリポジトリ・devex-api・devex-ui の変更。コミットはユーザーが行う(#35)。タグは devex-api・devex-ui とも `phase-87`。

**セッションの区切りの記録**: Phase 87 は2セッションで行った。
- 1つ目: 計画 → 87-1〜87-4 の実装 → 全体テスト → samples の反映の途中。
- 2つ目(日付が変わって再開): docs → q_a → 教材。

**この Phase で解決したもの**:
- **80-4 の Phase 87 の未確定事項**(画面の置き場所とナビゲーション): 着手時の相談と [87-2](./Phase-87-2.md)。
- **変更の種類と案の画面の入力**(Phase 83・84 から): [87-2](./Phase-87-2.md) の作成のフォーム。
- **反映のボタンと比較の画面**(Phase 85 から): [87-3](./Phase-87-3.md) の影響のタブと [87-4](./Phase-87-4.md) の SCR-008 の欄。
- **検証の画面・レビューを結ぶ画面**(Phase 86 から): [87-4](./Phase-87-4.md) の検証のタブ。
- **たどる記録の画面**(Phase 86 から): [87-3](./Phase-87-3.md)。たどる記録だけで出す(ユーザー決定)。

## 後続 Phase での改訂

- Phase 88 完了後の調整: CR の作成のフォームを、CR の一覧のページから、合意済みの版の中身から移る作成のページ(`/projects/{id}/baselines/{番号}/change-requests/new`)へ移した。基準の束は選ばず、移る元の版に固定する([87-2](./Phase-87-2.md) の基準の束の選択は撤回)。経緯は [Phase 88 の introduction](../Phase-88/Phase-88-introduction.md#phase-完了後の調整) と [`q_a.md`](../q_a.md)「Phase 88 完了後の調整」。
- Phase 89 完了後の調整: CR の詳細を開いたとき、プロジェクトが生成中なら反映の完了を待ち直す(`resumeReflection`。使われていなかった `setReflecting` を置き換えた)。経緯は [Phase 89 の introduction](../Phase-89/Phase-89-introduction.md#phase-完了後の調整) と [`q_a.md`](../q_a.md)「Phase 89 完了後の調整」。

## Phase 完了チェック(#22)

設問は Phase の要点の要約(回答は求めない)。

1. 反映済みの CR を段階の生成に渡す操作を、CR の詳細でなく SCR-008 の「変更の影響」に置いたのはなぜか。初期値を印の出どころから決められるのはなぜか。
2. 段階5・6・8 では、CR を渡す先を「段階の作り直し」でなく「再生成の候補」にしたのはなぜか。
3. タブの中身(予測・比較・検証・記録)を、詳細と一緒に読まず、タブを開いたときに読み、操作の後に捨てるのはなぜか。
4. 既存の `LayoutTabs` を使うと、編集中のフォームの入力が消えるのはなぜか(部品の作り直し)。
5. 作成のフォームのために、束の詳細でなく要件の行だけを返す API を足したのはなぜか。CR の対象の確かめと読み方を共通にしたのはなぜか(#17)。

## 次のフェーズ

**Phase 88**: 合意済みの版と説明書の画面・小さな修正。束の一覧・中身・作成(検証済みの CR を選ぶ、合意の記録の初期値)、説明書のプレビューと要約の確認、`postgres-init` の修正、モデルのカタログの見直し。着手時に、自動実装モード(#21)と [80-4](../Phase-80/Phase-80-4.md) の Phase 88 の未確定事項(要約の確認の画面・モデルのカタログの後継)と、この Phase の申し送りを決める。
