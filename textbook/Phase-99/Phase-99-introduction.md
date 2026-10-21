# Phase 99 導入: 効果測定・統合/E2E・画面確認(ステージ12 の最後)

## 目的

ステージ12(合意の精度)の最後の Phase。[90-4](../Phase-90/Phase-90-4.md) の Phase 99 として、Phase 91〜98 で作った合意の記録・保護・確認事項・要素の履歴・段階の承認の印・起点・画面を、[ベースライン](../../appendix/measurements/stage12-baseline.md)と同じ題材と表で測り直し、マイルストーン13 を満たしたかを判定する。

- 決定的な再現と実 LLM の流れで効果を測る ── [99-1](./Phase-99-1.md)
- ステージ12 の E2E を足し、既存を含めて全部流す(#36)── [99-2](./Phase-99-2.md)
- マイグレーションの往復と、`OPERATIONS.md` 10.8節のステージ12 の分 ── [99-3](./Phase-99-3.md)
- 開発環境での画面確認と実 LLM の流れ ── [99-4](./Phase-99-4.md)

本番への反映は、この Phase では行わない(ステージ15 の完了時。#37 の運用注記)。

## パイプライン上の位置づけ・前提

```
ステージ12(Phase 90〜99)
  90 仕様診断・ベースライン(トレンド追跡アプリ。CR なしの再生成で 12行が推測へ戻った)
  91〜96 API(合意の記録・保護・確認事項・履歴・承認の印・起点)
  97〜98 画面(合意の状態・確認事項・CR の手直し)
  99 ── 効果測定(同じ題材・同じ表 + 保護の再現)          ──[99-1]
        合意の精度の E2E + 既存の全 E2E                     ──[99-2]
        マイグレーションの往復・10.8節(ステージ12 の分)     ──[99-3]
        画面確認・実 LLM の流れ                               ──[99-4]
        └ 画面確認の指摘と使い勝手の追加要求 → Phase 完了後の調整
  └→ ステージ13〜15 → ステージ15 の完了時に本番へ(10.8節)
```

- **前提として読むもの**: [ベースライン](../../appendix/measurements/stage12-baseline.md)・[90-2](../Phase-90/Phase-90-2.md)、保護([Phase 92](../Phase-92/Phase-92-introduction.md)・[93](../Phase-93/Phase-93-introduction.md))、確認事項([Phase 94](../Phase-94/Phase-94-introduction.md)・[98](../Phase-98/Phase-98-introduction.md))、前のステージの最後の Phase([Phase 89](../Phase-89/Phase-89-introduction.md)。E2E の流し方・往復・手順の形)。
- **この Phase を始めた時点の状態**: Phase 98 は未コミットだった(外側・devex-api `stage11-15`・devex-ui `main`)。alembic の head は `ee299cd210b8`。題材は v9(保護の前の版。「合意と違う」4件)、合意の記録 18件(B-3 からの移行)、段階1〜8 は承認済み、CR-1〜3。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(本体 + samples)。測定・E2E・往復の章では、本体のコードは変えない。画面確認の指摘は「Phase 完了後の調整」で直した。

E2E: **この Phase で既存を含めて全部流す**。合意の精度の spec を1本足す([99-2](./Phase-99-2.md))。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 99 開始時」を参照。計画モードで1回(4問)聞いた。

| # | 問い | 決定 |
|---|---|---|
| 1 | 自動実装モードと本体の扱い | on・本体は変えない(推奨どおり) |
| 2 | 実 LLM の題材と範囲 | トレンド追跡アプリの続き(推奨どおり。見込み 約 $0.05) |
| 3 | ステージ12 の E2E | spec を1本足して全部流す(推奨どおり) |
| 4 | CR-4 の題材 | FR-003 の TOP10 → TOP20(推奨どおり) |

推奨と違った選択は0件。画面確認の後の相談は「Phase 完了後の調整」に書く(推奨と違った選択1件・再提案1件)。#39 の材料。

Claude の判断:
- 測定のスクリプトは、ベースラインの `measure.py` の読み出しと、本体の純粋関数を import して使う(#17)。
- 実 LLM の流れの初めに B-4 で合意し直す。ステージ12 より前に反映した CR-3 が合意に入っておらず、保護が CR-3 の変更を戻してしまうため(決定的な再現で分かった)。
- 測定のスクリプトと `OPERATIONS.md` は samples に写さない(#21)。

## 章一覧

| 章 | トピック | 依存 | 実装ファイル |
|---|---|---|---|
| [99-1](./Phase-99-1.md) | 効果測定(決定的な再現と実 LLM の流れ) | Phase 91〜98 | 無し(`appendix/` の測定のスクリプトだけ。#13/#15 の対象外) |
| [99-2](./Phase-99-2.md) | 合意の精度の E2E と全 E2E | Phase 97・98 | `e2e/agreement-flow.spec.ts` |
| [99-3](./Phase-99-3.md) | マイグレーションの往復と 10.8節 | Phase 91・92・94・96 のマイグレーション | 無し(インフラの文書。#13/#15 の対象外) |
| [99-4](./Phase-99-4.md) | 開発環境での画面確認と実 LLM の流れ | 99-1〜99-3 | 無し(確認の記録) |

## サンプルコード一覧

- 99-2: [`frontend/e2e/agreement-flow.spec.ts`](../samples/frontend/e2e/agreement-flow.spec.ts)(新規)
- Phase 完了後の調整: 下の「作成・更新したファイル」の表。
- samples に写さないもの: [`appendix/measurements/stage12/effect.py`](../../appendix/measurements/stage12/effect.py)(測定)・[`devex-api/OPERATIONS.md`](../../devex-api/OPERATIONS.md)(インフラの文書)。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 作るもの | 責務 | テスト観点 |
|---|---|---|---|
| 99-1 | `effect.py` | 保護を当て直す決定的な再現と、実 LLM の版ごとの表 | 2回流して同じ出力。マイルストーン13 の2つを判定できる |
| 99-2 | `agreement-flow.spec.ts` | 合意 → 再生成 → 確認事項で採用 → 履歴を画面で通す | SUT = 画面 + API、ドライバ = Playwright、スタブ = 偽の LLM |
| 99-3 | 10.8節 | ステージ12 の分(5本・確認の表・ロールバック) | 複製 DB の2往復で、既存の表の行の数が変わらず、head が戻る |
| 99-4 | 画面確認の記録 | Phase 97・98 の項目と実 LLM の流れ | 人が見る |

## 写経順序(#23)

章番号順。本体のファイルを作るのは 99-2 の spec と、Phase 完了後の調整だけである。調整の表は依存順に並べた(#30)。

実 import 監査(#15): 調整で足した import は次のとおり。
- `ConfirmationTable.tsx` → `next/link`、`rowLock`(同じ調整)。
- `ChangeRequestVerifyBanner.tsx` → 既存の `getChangeRequestVerification`・`useAppliedChangeRequests`、`verifyBannerText`(同じ調整)。
- `ChangeRequestVerifyDialog.tsx` → 既存の `StyledButton`・CR のストア・`VerificationTab`。
- `DetailedDesignPageContent.tsx` → 帯・モーダル(同じ調整)、既存の CR のストア・`useAppliedChangeRequests`。
- `confirmation_service.py` → `ConfirmationItemSettledError`(同じ調整)。

どれも、表の上側か以前の Phase にある。各テストは、調整で作成・更新したファイルを少なくとも1度 import する。

## 検証結果

- 99-1: `effect.py report` を2回流して同じ出力。`ruff check` は通った。
- 99-2: 新しい spec は、spec の側の誤り2つを直して通った。全 E2E は **11件成功** を2回。
- 99-3: 複製 DB で5本の downgrade → upgrade を2往復し、既存の表の行の数は変わらなかった。
- Phase 完了後の調整の後:
  - devex-api: ユニット 1756件・統合 39件がすべて通った。`ruff check` と `pyright`(触ったファイル)も通った。
  - devex-ui: ユニット 1227件がすべて通った(`--maxWorkers=4`)。`tsc`・`build` も通り、`lint` は既存の警告1件だけ。
  - 全 E2E は **11件成功** を2回(2回目の調整まで)。3回目の調整の後は、ユーザーが画面を使っていたので流していない(未消化の申し送り)。
  - 段階1 の表の幅は、確認用のプロジェクトを Playwright で撮って確かめた。
  - `samples_check.py --api-since stage11-15 --ui-since HEAD`: 不一致 0・本体のみ 0(一致 993)。
  - `link_check.py`: 0件。
  - samples の TS/TSX は、TypeScript の構文木で、構文の誤りと JSX の中の `//` のタグを確かめた(この Phase の分は 0)。

## 未消化の申し送り(#37)

[Phase 98](../Phase-98/Phase-98-introduction.md#未消化の申し送り37) から引き継いだもの。

**ステージ13 以降へ送るもの**(この Phase で生まれたものを含む):
- **外部連携のサービス名の言い換えで、重複した行が残る**(この Phase で生まれた。99-1 の A の v6): 合意済みの「X API」は戻るが、名前の変わった行は未合意の新しい行として残る。重複を除く規則は、画面(同じ名前)にしか無い。ステージ12 のプロンプトの後は、言い換え自体が起きていない(v10〜v12)。
- **CR で書き換えた行の確認事項の状態**(この Phase で生まれた): CR の反映で行が「推測」に戻っても、確認事項は前の「確認済み」のまま出る。もう一度採用するには「未確認に戻す」を挟む必要がある。
- **段階2・3・7 の処理 ID の参照の切れ**(この Phase の調整で生まれた): 段階1 の ID が変わると、処理概要表・CRUD 図・単位の処理にも消えた ID が残りうる。段階5 と同じ一覧が要るかを、使い方を見て決める。段階1 の引き継ぎの改善で起きにくくはなった。
- **生成で作り直したまま、段階の外の DFD・データ辞書だけを直して承認すると、前の段階へ印が行かない**(この Phase の調整で生まれた。知られた限界。docs に記載)。
- **巡回で消えた版の戻しは履歴に出ない**(Phase 95)。この Phase の流れでは、戻しの記録は残っている版(v10〜v12)の分で足りた。
- **起点に選べる要素の種類**(Phase 96)・**推測の利用者のキーが名前**(Phase 94)・**要約の生成の回数の上限**・**束の一覧の入れた CR**: 使われ方を見て決める。
- 規模の集計と選択肢つきの説明(ステージ13)。
- 振り返り 6節の残り5件・生成の質の候補4件(Phase 90 と同じ)。
- **使い勝手の見直し**: ユーザーは、Stage 9・10 と同じく、使い勝手(主に UI)を通して見て、後から直しを頼む可能性があると伝えた。

**ステージ12 の範囲の外**:
- **本番への反映と本番での確認**: ステージ15 の完了時に、[`OPERATIONS.md`](../../devex-api/OPERATIONS.md) 10.8節で行う(ステージ12 の分はこの Phase で足した)。

**持ち越し**(触るときに直す。中身は [振り返り](../retrospectives/project-retrospective.md) 8節):
- `test_chat_service.py` などの pyright の指摘(Phase 40)
- devex-ui の並列のテストのタイムアウト(Phase 44。全体は `--maxWorkers=4` で通る)
- 偽 LLM の外部設計書の GET に DF が無い(Phase 45)
- `DfdEditorTabs` のテストのまれな失敗(Phase 77)
- Google の公開鍵を毎回取りに行く(Phase 74)
- `ListCard` の入れ物(Phase 79。テンプレートでは直した)
- 英語のままの refresh の失敗の文(Phase 79)
- `streamChat.test.ts` の lint の警告(既存)
- `appendix/measurements/stage11/measure.py` の `ruff check` の指摘(Phase 80 から)
- 反映の後の CR の流れの部品・束の写しの取り出し(#17。触るときに寄せる)
- `tagmerge.py` は JSX の中のタグを `//` で入れる(手で `{/* */}` に直した。この Phase では TypeScript の構文木で確かめる一時的なスクリプトを使った)

- **3回目の調整の後の全 E2E**: 流していない(backend を一時的に偽の LLM にするため、ユーザーが画面を使っていない時に流す)。

**ユーザーが決めるもの**:
- **`tableStyles.ts` の `CELL` の `minWidth:"80px"`**: Claude の変更ではない本体の編集(2026-10-20 22:49)。残すなら samples に写す。
- **開発環境の後始末**: 確認用の利用者・プロジェクト。E2E が作ったものと、この Phase で幅の確認に作った「画面確認(段階の表)」(`check-layout-…@example.com`)がある。「トレンド追跡アプリ」は CR-4 が反映済み(未検証)のまま。
- **この Phase の未コミット**: Phase 98 の分と合わせて、外側のリポジトリ・devex-api・devex-ui。コミットはユーザーが行う(#35)。タグは devex-api・devex-ui とも `phase-99`。
- **ステージ12 の振り返り**: 別のセッションで行う(#18)。#39 の「本番での確認の指摘」はステージ15 の反映の後。

**この Phase で解決したもの**:
- **影響が広がる変更の実 LLM での比較**(P89 から)→ [99-1](./Phase-99-1.md)。CR-4 の予測と、段階の承認で結んだ印 40件。
- **外部連携の言い換え**(Phase 91 から)→ [99-1](./Phase-99-1.md)。プロンプトの後は起きていない。重複の規則は上の申し送り。
- **画面確認で決める項目**(Phase 97・98)→ [99-4](./Phase-99-4.md) と下の調整。
- **Phase 99 の未確定事項**(90-4)→ 「着手時の相談で決めたこと」。

**セッションの区切りの記録**: Phase 99 は1セッションで行った。
1. 計画(4問)
2. 99-1(A)・99-2・99-3
3. ユーザーの実 LLM の流れと画面確認(書き出しは取れなかった)
4. 測定の組み直し(質問2問)と1回目の指摘の修正
5. 2回目の画面確認と追加要求(質問3問)と、その修正
6. samples・教材
7. 段階5 が承認できない報告(質問2問)と、その修正(日をまたいだ。途中で Claude のシェルの安全確認が止まり、一度ターンが切れた)

## Phase 完了後の調整

画面確認の指摘3件と、使い勝手の追加要求2件、段階5 が承認できない不具合(3回目)を直した(#38 の通常の工程)。仕様の変更は #40 の CR として [`q_a.md`](../q_a.md)「Phase 99 の画面確認の後の調整」に残し、docs に反映した。マイグレーションは無い。

| 指摘・要求 | 対応 |
|---|---|
| 段階1 の種別・機能グループのセレクトが狭い(1回目・2回目) | 機能一覧の列の最小の幅を配分し直した(種別 120・機能グループ 200。名称 130・トリガー 170・関連画面 80 に詰めた)。手順の表の種別にも最小の幅。2回目は、確認用のプロジェクトを撮り、切れていたのが機能グループだと確かめてから直した |
| 確認事項で、消えて別の表へ移るものと残るものがあり、移ったものは状態を変えられない | **1つの表にまとめた**(ユーザーが再提案から選んだ)。消えた行は状態の欄に理由を出す。採用して合意した要件・利用者は「確認済み(採用して合意)」と変更要求へのリンクを2段で出す。API も、消えた項目の状態の変更を 409 `CONFIRMATION_ITEM_SETTLED` で断る |
| CR の検証に届くまでの移動が多い(追加要求) | 詳細設計の画面に「変更要求の検証」の帯を置き、「検証する」で検証のタブと同じ中身をモーダルで開く(推奨どおり)。段階の承認の完了のダイアログにも「CR-n を検証する」 |
| 段階を進めるたびに前の段階に見直しが出る(追加要求) | **生成で作り直したまま承認したときは、前の段階へ印を送らない**(推奨は「前への印を参考にする」)。人が直して保存した後の承認は今までどおり |

| 段階5 で「処理 F-04 が、機能一覧にありません」が消えず承認できない(3回目) | 原因は2つ。段階1 の作り直しで、API でない処理が名称の言い換え(「トップページ表示」→「トップページ表示処理」)で新しい ID になった。段階5 には消えた処理の手順を外す手段が無かった。段階5 に「機能一覧に無い処理の手順」の一覧(付け替えるか消す)を置き、段階1 は名称で当たらないときに同じ種別・関連画面かトリガーで ID を引き継ぐようにした(どちらも推奨どおり) |

推奨と違った選択は1件(前への印)、再提案が1件(確認事項)。

### 作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`backend/app/services/errors.py`](../samples/backend/app/services/errors.py) | 更新 | `ConfirmationItemSettledError`(409) |
| [`backend/app/services/confirmation_service.py`](../samples/backend/app/services/confirmation_service.py) | 更新 | 今の一覧に無い項目の状態の変更を断る(メモ・決める機会は変えられる) |
| [`backend/app/api/routes/confirmations.py`](../samples/backend/app/api/routes/confirmations.py) | 更新 | docstring に 409 |
| [`backend/app/services/design_stage_service.py`](../samples/backend/app/services/design_stage_service.py) | 更新 | `approve` が `regenerated` なら `min_target` を渡す。`_record_stage_change`・`_record_impact` が前の段階に届く印を飛ばす |
| [`frontend/src/features/confirmations/confirmationOps.ts`](../samples/frontend/src/features/confirmations/confirmationOps.ts) | 更新 | `splitByPresence` を `rowLock` に置き換えた |
| [`frontend/src/features/confirmations/components/ConfirmationTable.tsx`](../samples/frontend/src/features/confirmations/components/ConfirmationTable.tsx) | 更新 | 行ごとの `rowLock`。理由と変更要求へのリンク(2段)。メモはどの行も書ける |
| [`frontend/src/features/confirmations/components/ConfirmationsPageContent.tsx`](../samples/frontend/src/features/confirmations/components/ConfirmationsPageContent.tsx) | 更新 | 「決めた記録」の節をやめ、1つの表 |
| [`frontend/src/features/detailed-design/components/FunctionListPanel.tsx`](../samples/frontend/src/features/detailed-design/components/FunctionListPanel.tsx) | 更新 | 列の最小の幅 |
| [`frontend/src/features/detailed-design/components/ProcedureStepTable.tsx`](../samples/frontend/src/features/detailed-design/components/ProcedureStepTable.tsx) | 更新 | 種別の列の最小の幅 |
| [`frontend/src/features/change-requests/changeRequestOps.ts`](../samples/frontend/src/features/change-requests/changeRequestOps.ts) | 更新 | `verifyBannerText` |
| [`frontend/src/features/change-requests/components/VerificationTab.tsx`](../samples/frontend/src/features/change-requests/components/VerificationTab.tsx) | 更新 | `onStageLink`(モーダルでは段階へのリンクで画面を移らない) |
| [`frontend/src/features/change-requests/components/ChangeRequestVerifyDialog.tsx`](../samples/frontend/src/features/change-requests/components/ChangeRequestVerifyDialog.tsx) | 新規 | 検証のモーダル(中身は `VerificationTab`) |
| [`frontend/src/features/change-requests/components/ChangeRequestVerifyBanner.tsx`](../samples/frontend/src/features/change-requests/components/ChangeRequestVerifyBanner.tsx) | 新規 | 反映済みの CR ごとの帯 |
| [`frontend/src/features/detailed-design/components/DetailedDesignPageContent.tsx`](../samples/frontend/src/features/detailed-design/components/DetailedDesignPageContent.tsx) | 更新 | 帯・モーダル・承認の完了のダイアログの「CR-n を検証する」 |
| [`backend/app/detailed_design/function_list.py`](../samples/backend/app/detailed_design/function_list.py) | 更新 | `merge_draft` の2段目の突き合わせ(`_fallback_match`) |
| [`frontend/src/features/detailed-design/procedureOps.ts`](../samples/frontend/src/features/detailed-design/procedureOps.ts) | 更新 | `strayProcedures`・`reassignTargets`・`reassignProcedure`・`removeProcedureAt`・`removeStrayProcedures` |
| [`frontend/src/features/detailed-design/components/StrayProcedureTable.tsx`](../samples/frontend/src/features/detailed-design/components/StrayProcedureTable.tsx) | 新規 | 段階5 の機能一覧に無い処理の手順の一覧 |
| [`frontend/src/features/detailed-design/components/ProcedurePanel.tsx`](../samples/frontend/src/features/detailed-design/components/ProcedurePanel.tsx) | 更新 | 一覧を「手順を書く処理」の下に置く |
| [`frontend/e2e/agreement-flow.spec.ts`](../samples/frontend/e2e/agreement-flow.spec.ts) | 更新 | 消えた項目を、状態の絞り込みで同じ表に確かめる |
| テスト(devex-api) | 更新 | `test_confirmation_service.py`・`test_design_stage_impact.py`・`test_function_list.py` |
| テスト(devex-ui) | 新規・更新 | 帯とモーダルのテスト(新規)、`confirmationOps`・確認事項のページ・`FunctionListPanel`・`ProcedureStepTable`・`changeRequestOps`・詳細設計のページ・`procedureOps`・`ProcedurePanel` のテスト(更新)、`StrayProcedureTable` のテスト(新規) |

samples のタグは `Phase-99(完了後の調整)`。

### 要点

- **戻せないのは、文書と合意の記録が先に済んでいるから**: 推測の要件・利用者を確認済みにすると、行を採用にして合意を記録する(追記だけ)。確認事項の状態だけを戻すと、文書と食い違う。合意を変えるのは CR の役割なので、戻せないことと、その理由・行き先を画面に出した。API でも断る(画面が古いまま押した場合に備える)。
- **「生成したまま」は段階の状態で決める**: 生成の結果は `regenerated`、人の保存は `reviewing` になる。承認のときの状態で判定できるので、写しや列を足さずに済む(マイグレーションは無い)。
- **モーダルは検証のタブをそのまま使う**: 検証の中身(印の状態・文書の側・未承認の段階・検証済みにする)は1か所だけにする。モーダルで変わるのは、段階へのリンクの扱いだけである。

### テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_confirmation_service.py`(追記) | `ConfirmationService.update` の 409 とメモ | pytest | SQLite のセッション(本物のリポジトリ) |
| `test_design_stage_impact.py`(追記) | `approve` の印の記録(人が直した承認は前へも送る / 生成したままは送らない) | pytest | SQLite。段階4 の fixture は段階ごとの検証を通らないので、検証だけを `monkeypatch` で外す |
| `confirmationOps.test.ts`(更新) | `rowLock`・消えた項目も含めた絞り込み | vitest | スタブ不要 ── 純粋関数のため |
| `ConfirmationsPageContent.test.tsx`(更新) | 1つの表・消えた行の理由と2段のリンク・メモ | Testing Library | `fetch`(`stubFetch`) |
| `FunctionListPanel.test.tsx`・`ProcedureStepTable.test.tsx`(追記) | 列の最小の幅 | Testing Library | 既存のとおり |
| `changeRequestOps.test.ts`(追記) | `verifyBannerText` | vitest | スタブ不要 |
| `ChangeRequestVerifyBanner.test.tsx`(新規) | 反映済みの CR だけの帯・数・「検証する」 | Testing Library | ストアの関数(`vi.fn`)と `fetch`(`stubFetch`) |
| `ChangeRequestVerifyDialog.test.tsx`(新規) | 詳細を読む・検証のタブ・段階へのリンクで選んで閉じる・「閉じる」 | Testing Library | ストアの関数(`vi.fn`) |
| `test_function_list.py`(追記) | `merge_draft` の2段目(画面・トリガーで引き継ぐ・候補が2つなら引き継がない・名称で当たる行を先に取らない) | pytest | スタブ不要 ── 純粋関数のため |
| `procedureOps.test.ts`(追記) | 機能一覧に無い手順の5つの関数 | vitest | スタブ不要 ── 純粋関数のため |
| `StrayProcedureTable.test.tsx`(新規) | 付け替え・消す・すべて消す・無ければ出さない | Testing Library | `onChange`(`vi.fn`) |
| `ProcedurePanel.test.tsx`(追記) | 迷子の手順があるときだけ一覧が出て、消すと保存できる | Testing Library | 既存のとおり |
| `DetailedDesignPageContent.test.tsx`(追記) | 帯と、承認の完了のダイアログからモーダル | Testing Library | ストア・`fetch`(`stubFetch`) |

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

設問は Phase の要点の要約である(回答は求めない)。

1. ベースラインで「LLM の揺れは小さい」と見たのに、決定的な再現では利用者と外部連携が毎回戻されたのはなぜか(ベースラインが何を比べていなかったか)。
2. 実 LLM の流れの初めに B-4 を作らないと、保護は何をしてしまったか。ステージ12 より前のデータと、合意の記録の関係から説明せよ。
3. CR を渡さない再生成 v12 で FR-003 を戻したことは、なぜ「CR の変更が残った」ことの証拠になるのか。
4. 確認事項で、採用して合意した項目の状態を戻せないのはなぜか。画面と API の両方で止めるのはなぜか。
5. 生成で作り直したまま承認したときだけ、前の段階へ印を送らないのはなぜか。人が直した承認では送るのはなぜか。

## 次のフェーズ

**ステージ12 の振り返り**(別のセッション。#18・#10・#39)。その後、**ステージ13** の要件確認フェーズ。入力は、この Phase の申し送り(ステージ13 以降へ送るもの)・[位置付け](../../appendix/devex_project_positioning.md) 12章・ユーザーの使い勝手の見直し。
