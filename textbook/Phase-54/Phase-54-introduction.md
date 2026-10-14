# Phase 54 導入: 差し戻し

## 目的

[Phase 53](../Phase-53/Phase-53-introduction.md) までで、AI 設計レビュー(Claude Sonnet)の指摘に採否を付けられるようになったが、採否は記録されるだけだった。この Phase で「採用」を設計へ戻す。

- 採用した指摘が直されたかを決定的に追い、パネル・各段階の表・知らせで見せる(L0 版・L1 行)── [54-1](./Phase-54-1.md)
- 採用した設計・不整合の指摘を、文書の再生成の修正指示にする ── [54-2](./Phase-54-2.md)
- 同じく、段階の作り直しの修正指示にする ── [54-3](./Phase-54-3.md)
- 採用したヒアリングの指摘で、観点を未決に戻してチャットで聞き直す ── [54-4](./Phase-54-4.md)
- 変わった指摘が直ったかを Claude Haiku に判定させて記録する(シャドーモード)── [54-5](./Phase-54-5.md)

## パイプライン上の位置づけ・前提

```
レビューの指摘 ── 採否 ──┬─ 採用(設計・不整合)── 修正指示 ──→ 文書の再生成(54-2)/ 段階の作り直し(54-3)
                        ├─ 採用(ヒアリング)── 観点を未決に戻す + 問いかけ ──→ チャット(54-4)
                        └─ 採用(すべて)── 追跡: 版(L0)→ 行(L1)──→ 「変更あり」── Haiku(L2・記録だけ。54-5)
                                              └→ チップ・バッジ・知らせ・再生成の起点の初期値(54-1)
```

- **前提として読むもの**: [`docs/external_design.md`](../../docs/external_design.md) 2.11節「差し戻し」・「役割」、[`docs/internal_design.md`](../../docs/internal_design.md) 3.3節「8.」、[51-5](../Phase-51/Phase-51-5.md) の Phase 54 の未確定事項、[Phase 53 の introduction](../Phase-53/Phase-53-introduction.md) の申し送り(採用した指摘の追跡の提案)。
- **今の仕組み**: 文書の再生成は前の版の差分にとどめる(`app/documents/revision.py`。Phase 49)。段階の生成は `STAGE_GENERATORS` が段階ごとに LLM を呼ぶ。ヒアリングの観点は毎回 LLM が判定し、根拠の発言のある決定だけを取り込む(`merge_judgement`)。
- **この Phase を始めた時点の状態**: Phase 53(完了後の調整を含む)までコミット済み。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(AI が devex-api・devex-ui 本体へ実装し、`textbook/samples/` も同じ内容で作る)。

E2E: この Phase では流さない([51-5](../Phase-51/Phase-51-5.md) のとおり Phase 59 で既存を含めて全部流す)。再生成の本文・段階の生成の本文・承認のルートの引数が変わったが、どれも省略できる。E2E の偽 LLM には判定の応答(`FixCheckOut`)を足した。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 54 開始時」を参照。すべて推奨どおり。

1. **自動実装モード**: on。
2. **再生成の指示を渡す範囲**: 文書と段階の両方。指示の文はサーバーが `finding_ids` から組み立て、生成のプロンプトに `## 修正指示` の節を足す。
3. **聞き直しの最初の問いかけ**: コードが組み立てる(LLM を呼ばない)。
4. **「直ったか」の判定の使い方**: 記録して、superuser のパネルに小さく出す(追跡の色は変えない。精度は Phase 58)。

Claude の判断(計画の承認で確定、または作業中):

- **段階の写しを回に持たせる**(`review_runs.snapshots`)。Phase 53 の申し送りでは「DB の列は足さない」だったが、段階は承認した写しを1つしか残さず、L1 と L2 に「レビューしたときの段階の内容」が要るため([54-1](./Phase-54-1.md))。
- **対象と行は文字で結ぶ**。結べない・比べられない指摘は「変更あり」にして L2 に回す。
- **差し戻しの後の段階の区切り**(Phase 53 の申し送り): 今のまま。作り直すと区切りは未レビュー(またはそろっていない)になり、承認し直した後のボタンで流す(自動にしない)。
- **判定のモデル**: `claude-haiku-5-5`(設定 `JUDGE_MODEL` で替えられる)。
- **D-NAT-1**: 判定のプロンプトに1規則を足すだけにし、効果は Phase 58 で測る([54-4](./Phase-54-4.md))。
- 作業中に決めたこと: **前の回で採用した指摘を区切りに付けて返す**(再生成の後の自動のレビューで回が替わると、採用した指摘が消えるため。[54-1](./Phase-54-1.md))/ **未決に戻した観点は、聞き直しの後の答えでないと決まり直さない**(`hearing_points.reopened_after`。[54-4](./Phase-54-4.md))/ **判定に足した行も渡す**(実 Haiku の偽の「いいえ」から。[54-5](./Phase-54-5.md))/ 指摘の読み出しを `ReviewService.sendback_findings` にまとめた(文書と段階の生成で共有)。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-54-1.md`](./Phase-54-1.md) | 採用した指摘の追跡と見せ方(api・ui) | あり | なし |
| [`Phase-54-2.md`](./Phase-54-2.md) | 再生成の指示(文書) | あり | 54-1(起点の初期値) |
| [`Phase-54-3.md`](./Phase-54-3.md) | 再生成の指示(段階) | あり | 54-2 |
| [`Phase-54-4.md`](./Phase-54-4.md) | 聞き直し | あり | 54-2(`SendbackFinding`) |
| [`Phase-54-5.md`](./Phase-54-5.md) | 「直ったか」の判定(シャドーモード) | あり | 54-1・54-2 |

## サンプルコード一覧

- `textbook/samples/backend/`: 新規 `app/review/followup.py`・`sendback.py`・`rehearing.py`・`fix_check.py`・`app/services/fix_check_service.py`・Alembic 3本・テスト4本。更新 `app/review/__init__.py`・`app/models/review.py`・`hearing_point.py`・`__init__.py`・`app/repositories/review.py`・`hearing_point.py`・`app/hearing/points.py`・`app/documents/revision.py` と4文書の `drafting.py`・`app/schemas/review.py`・`document.py`・`design_stage.py`・`app/services/review_service.py`・`doc_generator_service.py`・`design_stage_generation_service.py`・`design_stage_service.py`・`chat_service.py`・`errors.py`・`app/api/routes/reviews.py`・`projects.py`・`design_stages.py`・`app/ai/llm/claude.py`・`fake.py`・`app/core/config.py` と既存のテスト5本
- `textbook/samples/frontend/`: 新規 `src/features/detailed-design/sendbackOps.ts`・`components/StageSendbackPanel.tsx`・`src/features/design-review/components/RehearingButton.tsx` とテスト。更新 `src/features/design-review/` の `api/reviewApi.ts`・`model.ts`・`review-store.ts`・`components/FindingTable.tsx`・`ReviewPanel.tsx`・`ReviewFindingBadge.tsx`・`test-utils/reviewFixtures.ts`、`src/features/detailed-design/` の `reviewMarks.ts`・`api/designStagesApi.ts`・`detailed-design-store.ts`・`components/DetailedDesignPageContent.tsx`・`ProcedureDocPanel.tsx`、`src/features/documents/documents-store.ts`・`components/DocumentsPageContent.tsx`、`src/features/hearing/api/hearingApi.ts` とそのテスト

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| [54-1](./Phase-54-1.md) | `app/review/followup.py`・`review_service.py`・`ReviewPanel.tsx` | 版と行で追跡の状態を決め、区切りに付けて返し、画面で見せる | 状態の分岐・段階の写し・前の回の指摘・チップ / 見出し / バッジ / 知らせ |
| [54-2](./Phase-54-2.md) | `app/review/sendback.py`・`drafting.py`・`DocumentsPageContent.tsx` | 指摘から指示の文を作り、関連する文書にだけ渡す | 使える指摘・絞り方・節の形・404 / 409・ダイアログの初期値 |
| [54-3](./Phase-54-3.md) | `design_stage_generation_service.py`・`sendbackOps.ts`・`StageSendbackPanel.tsx` | 段階の生成の全呼び出しに指示を足し、段階と行を推定する | 最後のメッセージの指示・段階の推定・部分再生成の行・行が決まらないとき |
| [54-4](./Phase-54-4.md) | `app/review/rehearing.py`・`chat_service.py`・`RehearingButton.tsx` | 観点を未決に戻して問いかけを出し、前の答えで決まり直さないようにする | 文の形・印・聞き直しの後の答えで決まる・修正中と完了判定・チャットへ移る |
| [54-5](./Phase-54-5.md) | `app/review/fix_check.py`・`fix_check_service.py` | 変わった指摘を Haiku で判定して記録する | 入力の形・版ごとに1回・オフ / キー無し・失敗の記録・生成と承認からの起動 |

## 写経順序(#23)

章番号順。各章の「この章で作成・更新したファイル」の表の順に写す。複数の章で触るファイル(`app/review/__init__.py`・`review_service.py`・`schemas/review.py`・`routes/reviews.py`・`model.ts` など)は、samples ではファイルの主な章のタグで示し、ファイル冒頭の「更新」にすべての章を挙げた。

実 import 監査(#15。全 import 文を読んで確かめた):

- 54-1: `followup.py` は `app.detailed_design.impact.Element`・`app.detailed_design.stages.stage_key`・`app.documents.*.model`・`app.documents.revision` の `*_rows`(以前の Phase)と同じ章の `gates`。`review_service.py` の 54-1 の分は同じ章の `followup` と `app.detailed_design.stages.stage_key`、`DesignStageService.elements_since`(同じ章)。画面は同じ章の `model.ts` と以前の Phase の部品。
- 54-2: `sendback.py` は `app.review.schemas.LEVEL_LABEL`(以前の Phase)。`doc_generator_service.py` は同じ章の `build_instruction`・`findings_for` と、54-3 で `ReviewService.sendback_findings` に移した読み出し(54-2 の時点ではサービスの中の関数。54-3 で移動)。`DocumentsPageContent.tsx` は 54-1 の `regenerationStartFor` と同じ章の `regenerableFindings`。
- 54-3: `design_stage_generation_service.py` は `app.review.build_instruction`(54-2)・`ReviewService`(以前の Phase。`sendback_findings` は同じ章)。`sendbackOps.ts` は `impactOps` の `locateTargetStage`・`resolveFixTarget`・`regenerationArgs`(以前の Phase)。`StageSendbackPanel.tsx` は 54-2 の `regenerableFindings`。
- 54-4: `rehearing.py` は `app.hearing`(以前の Phase)と 54-2 の `SendbackFinding`。`review_service.py` の 54-4 の分は `ChatService`(以前の Phase。`reopen_points` は同じ章)。`RehearingButton.tsx` は `next/navigation` と同じ章のストア。
- 54-5: `fix_check.py` は 54-1 の `Row`・`RowDiff`・`matches` と 54-2 の `SendbackFinding`。`fix_check_service.py` は 54-1 の `followup_state`・`version_keys`・`ReviewService.row_diffs`・`current_versions` と同じ章の `get_judge_llm`・`ReviewFixCheckRepository`。`doc_generator_service.py`・`design_stages.py` の 54-5 の分は同じ章の `FixCheckService`・`run_fix_checks`。
- 前方 import は無い(54-2 の `doc_generator_service.py` の読み出しは 54-3 で移した ── 54-2 の時点の形は 54-3 の章で説明した)。章が作成・更新するファイルは、その章のテストが少なくとも1度 import する(`RehearingButton.tsx`・`FindingTable.tsx` は `ReviewPanel.tsx` を、`errors.py` は各サービスのテストを通る)。

## 検証結果

- 章ごとの部分テスト: 54-1 `test_review_followup.py` 8件・`test_review_service.py` 20件・`test_review_routes.py` 8件、54-2 `test_review_sendback.py`(54-3 の分を含め 7件)・`test_doc_generation_start.py`、54-4 `test_review_rehearing.py` 7件、54-5 `test_review_fix_check.py` 10件と、devex-ui の design-review・detailed-design・documents のテスト、すべて成功。
- Phase 完了時の全体テスト(#18): devex-api 1171 件成功(8件は既定で除外の統合テスト)。devex-ui 859 件のうち、並列で流したときに 5 秒のタイムアウトが 3件(`UnitProcedureEditor`・`IntakeForm`・`projects/new` の page。この Phase で触っていないファイル)。3ファイルを単独で流すと 19件すべて成功(Phase 44 からの申し送りと同じ)。
- `ruff check` 成功(`ruff format` は使わない)。pyright: `app` 全体でエラー 0。`tsc --noEmit` 成功、lint はエラー 0(警告1件は既存の `streamChat.test.ts`)。
- マイグレーション: `5a1c7e93d2b4`(review_runs.snapshots)→ `6b2d8fa4e3c5`(hearing_points.reopened_after)→ `7c3e9ab5f4d6`(review_fix_checks)。dev の DB で upgrade と、この3本の downgrade → upgrade を確かめた。**事故**: 初めに付けたリビジョン ID(`b8c9d0e1f2a3`・`c9d0e1f2a3b4`)が以前の Phase のものと重なり、`upgrade head` が「head が複数」で失敗した。続けて流した `downgrade -3` が既存の3本(Phase 52・53 と Phase 41 の段階の写し)を巻き戻し、dev の DB の `review_runs`・`review_findings`(Phase 53 の確認用のレビューの記録)・`design_stages.impact`(変更の影響の印)・`users.review_enabled` が消えた(バックアップは無い)。ID を付け直して upgrade し直し、段階の承認の写しは移行が承認済みの段階(161件すべて)に作り直した。superuser のレビューの設定はオンに戻した。レビューの記録は下の実 LLM の確認で新しく作った。
- 実 LLM(dev のサーバーで本物の API。確認用のデータ `33fdda56…`(簡易)・`06f93618…`(詳細の複製)):

  | 呼び出し | 入力 / 出力トークン | 結果 | 費用 |
  |---|---|---|---|
  | Sonnet 簡易・文書の区切り(手動) | 10,484 / 5,336 | 12件(最重要 1・ヒアリング 3) | 約 $0.074 |
  | Gemini 外部設計以降の再生成(指摘2件を指示に) | ― | 約20秒 | 無料枠 |
  | Sonnet 再生成の後の自動のレビュー | 11,405 / 4,184 | 8件。前の回の「アカウントを作る手段が無い」「一覧の GET が無い」は消え、作った API の細部の指摘に変わった | 約 $0.065 |
  | Haiku 判定(初め・対象の行だけ)2件 | 3,888 / 192・2,683 / 287 | 2件とも「いいえ」(偽の判定)→ 入力を直した | 約 $0.0009 |
  | Haiku 判定(足した行も渡す)2件 | 5,227 / 131・4,022 / 142 | 2件とも「直った」(`POST /api/v1/users`・`GET /api/v1/menus` を挙げた) | 約 $0.0011 |
  | Sonnet 詳細・段階6(ボタン) | 32,183 / 6,492 | 12件(最重要 2) | 約 $0.129 |
  | Gemini 段階3 の作り直し(指摘1件を指示に) | ― | 約10秒 | 無料枠 |
  | Haiku 判定 1件 | 3,767 / 618 | 「直った」(生成した文書の種別・版・本文の列を足した) | 約 $0.0007 |

  - 計 約 $0.27(計画の見込み 約 $0.25、最大 $0.45 の内)。Haiku 5.5 は入力 $0.10・出力 $0.50 / 1M トークンで、見込み($1/$5 で概算)より1桁安い。
  - 聞き直し: 簡易の「セキュリティ」の指摘で観点が open に戻り、`reopened_after` が付き、プロジェクトは「修正中」、完了判定は「十分でない」、チャットに問いかけが出た。
  - 詳細の段階3 は、作り直した内容に段階の検証のエラーがあり、承認できなかった(生成の質の問題で、差し戻しの仕組みの外)。確認用の複製は段階3 が「作り直し済み・未承認」で、段階4〜8 は「古い」のまま残した。
- `samples_check.py`(`--api-since HEAD --ui-since HEAD`): 不一致 0 件・作り忘れ 0 件(一致 635 / 並び順のみ差 8 / 例外 5)。「samples のみ」2件は以前からの `change-impact-demo` のルート。`link_check.py`: 切れ 0 件。

## 未消化の申し送り(#37)

Phase 53 から引き継いだもの:

- **Phase 55〜59 の未確定事項**: [51-5](../Phase-51/Phase-51-5.md)「未確定事項」(Phase 54 の分はこの Phase で決めた)。
- **「AI に提案を求める」・判定がログインの方法だけでセキュリティを埋めた・初期入力だけで MVP の範囲が対象外になった**: 差し戻しと聞き直しはこの Phase で作った。効果は Phase 58 で確かめる。
- **テスト仕様書の中身の正しさ**・**実装手順書に固有の欠陥**: Phase 55・56・58。
- **プロンプトキャッシュ**: 入れていない。回のキャッシュのトークンを Phase 58 の測定で見て決める。
- **本番の手順**: `ANTHROPIC_API_KEY` の設定と superuser の昇格、`langchain-anthropic` の追加でイメージの作り直し、この Phase の Alembic 3本(Phase 59 の `OPERATIONS.md`)。
- **依存の更新**: `langchain-anthropic` の追加で `langchain-core` が 1.6.10 に上がった(Phase 52)。
- **生成のモデルと Gemini の無料枠**(51-1 の (f)): ステージ8の範囲の外。
- **devex-ui の「開発用」メニュー**: ステージ8の完了時に、ユーザーが外すかを決める。
- **画面の操作感の確認**(ユーザー。Phase 53 の分): パネルの長さ・対象の推定の当たり。この Phase の画面(下)と合わせて確かめてよい。
- **再生成の失敗を画面で知らせていない**(Phase 53 の完了後の調整から)。
- 持ち越し: **DFD のデータストアの書き漏れ**(49-2 から)・**補いの文字の当たり**(Phase 48 から)・**画面の文の変更は、その画面のすべての処理へ届く**(49-4 から)・**改名の後に下流の参照を直して承認すると広がる**(Phase 43 から)。
- 持ち越し(触るときに直す): **`test_chat_service.py` の pyright の指摘4件**(Phase 40 から)・**並列のテストのタイムアウト**(Phase 44 から。この Phase の全体テストでも 3件)・**偽 LLM の外部設計書の GET に DF が無い**(Phase 45 から)。

この Phase で生まれたもの:

- **画面の確認**(ユーザー。#37 の運用注記のとおり Phase 58・59 でまとめてよい): 確認用のデータで、パネルのチップ・「採用 n(未対応 m)」・前の回で採用した指摘・「AI: 直った」、再生成のダイアログの指摘の一覧と起点の初期値、作業領域の「採用した指摘で段階を作り直す」、「チャットで聞き直す」とチャットの問いかけ、各段階のバッジの強調、手順書の生成・段階6・7 の承認の知らせ。
- **dev の DB の事故の後始末**: Phase 53 のレビューの記録と、変更の影響の印が消えた(上の検証結果)。確認用のデータは実 LLM の確認で作り直したが、ほかのプロジェクトの変更の影響の印は戻らない(段階を直して承認し直すと、また記録される)。
- **段階の作り直しの後に承認できない**: 確認用の複製の段階3 は作り直した内容に検証のエラーがあり、未承認のまま。差し戻しで作り直した段階の検証のエラーを、利用者が直してから承認する流れの見せ方(どのエラーが指示と関係するか)は未検討。
- **「直ったか」の判定の精度**: 足した行も渡すと3件とも正しかったが、件数が少ない。Phase 58 で正解表と比べ、記録だけから「いいえ・一部・自信なし は Sonnet で確かめる」へ進めるかを決める。
- **前の回で採用した指摘が積み上がる**: 外すのは利用者の保留・却下だけ。「直った」の指摘を自動で外すかは、判定の精度を見てから決める。
- **段階の写しの大きさ**: `review_runs.snapshots` は段階の区切りの回ごとに段階1〜7 の model を持つ。回が増えたときの大きさは見ていない。
- **聞き直しのあとの再生成は利用者が押す**: 観点が決まっても自動では再生成しない(今の「修正中」の流れと同じ)。
- **セッションの区切りの記録**: Phase 54 は2セッションで行った(1つ目: 計画モードで調査 → 着手時の質問1回(4問)→ 計画の承認 → 54-1〜54-5 の実装とテスト → 全体テスト → マイグレーションの事故と復旧 → 実 LLM の確認。2つ目: samples・教材・記録)。

この Phase で解決したもの:

- **差し戻し**(51-5 の Phase 54): [54-2](./Phase-54-2.md)・[54-3](./Phase-54-3.md)・[54-4](./Phase-54-4.md)。
- **採用した指摘の追跡**(Phase 53 の完了後の提案): [54-1](./Phase-54-1.md)・[54-5](./Phase-54-5.md)。
- **段階の区切りと「古い」**(Phase 53 から): 差し戻しの後も今のまま(作り直すと未レビュー、承認し直した後のボタン)。
- **ヒアリングの判定の見直し**(Phase 52 から): [54-4](./Phase-54-4.md) の判定の規則(効果は Phase 58)。
- **Judge(狭い判定のモデル)の使い道**・`get_judge_llm()`(Phase 52 から): [54-5](./Phase-54-5.md)。

## Phase 完了チェック(#22)

設問は Phase の要点の要約(回答は求めない)。

1. 追跡の L0 で段階の「今の版」を承認した版でなく内容の版で見るのはなぜか。承認していない作り直しはどう数えられるか。
2. 再生成の後に、前の回で採用した指摘を区切りに付けて返すのはなぜか。付けないと何が起きるか。
3. 修正指示を文書ごとに関連する指摘だけに絞るのに、段階の作り直しでは絞らないのはなぜか。
4. 未決に戻した観点に「聞き直しの発言」の印を持たせるのはなぜか。印が無いと、判定の LLM はどう振る舞いうるか。
5. 「直ったか」の判定に、対象の行だけでなく足した行も渡すようにしたのはなぜか。

## 次のフェーズ

Phase 55: 実装手順書の決定的な検証の強化([51-5](../Phase-51/Phase-51-5.md))。実装可能性チェックに、依存先が後の単位で作られる・テスト観点があるのにテストのファイルが無い・テーブルを作る単位が無い、を足す。
