# Phase 44 導入: 影響の画面

## 目的

ステージ7(変更影響分析・変更管理)の3つ目の実装 Phase。[Phase 43](../Phase-43/Phase-43-introduction.md) で、段階の承認と文書の版の切り替えのときに影響の**印**を記録し、API(`GET /design-stages/impact`・`POST /{stage}/impact/review`)と承認を止める 409 まで作った。ただ devex-ui は変えていなかったので、印は画面に見えず、確認済みにする操作も無かった。この Phase で詳細設計画面(SCR-008)に次のものをつなぐ。

- **型・API・ストア**: 影響の取得、確認済みの切り替え、強調する行、「段階Nで直す」の直す先の推定(44-1)。
- **「変更の影響」パネル**: 作業領域の上に、変わったもの → 段階ごとの影響の一覧。段階の状態の印(44-2)。
- **各段階の表の行の印と「表で見る」**: 段階1〜8 の表の行に印を出し、移った先の行を強調する(44-3)。
- **再生成の候補からの部分再生成**: 段階5・6・8 の候補を段階ごとにまとめて選んで再生成する(44-4)。

devex-api は変えていない。確定した画面の決定は [`docs/external_design.md`](../../docs/external_design.md) 2.10節「画面(Phase 44 で確定)」と [`docs/internal_design.md`](../../docs/internal_design.md) 3.3節「Phase 44 で実装した部分」に足した。

## パイプライン上の位置づけ・前提

```
[Phase 43]  承認・文書の版の切り替え ─▶ design_stages.impact に印
            GET /design-stages/impact(記録した印 + pending の印 + 再生成の候補)
            POST /design-stages/{stage}/impact/review
        │
        ▼
[44-1]  types・designStagesApi ─▶ impactOps(要素のキー・印・部分再生成の引数・直す先の推定)
        ストア: impact / highlight、fetchStages で取得、reviewMarks・regenerate・showInTable・jumpTo
        │
        ├─▶ [44-2] ChangeImpactPanel(変わったもの・段階ごとの印・確認済み・表で見る)・ImpactBadge
        │          ステッパー・作業領域の件数
        ├─▶ [44-3] useStageImpact ─▶ 段階1〜8 の表の行の印と強調
        └─▶ [44-4] RegenerationTargets(段階ごとに選んで部分再生成)
        │
        ▼
[Phase 45〜]  簡易モードの文書の model(45)・簡易モードの影響(46。44 の部品を使う)
```

- **前提として読むもの**:
  - [41-2](../Phase-41/Phase-41-2.md)(決定3・6・8)・[41-5](../Phase-41/Phase-41-5.md)(Phase 44 のスコープと未確定事項)。
  - [43-3](../Phase-43/Phase-43-3.md)(印の記録・承認を止める条件)・[43-4](../Phase-43/Phase-43-4.md)(API の応答の形)。
  - [`docs/external_design.md`](../../docs/external_design.md) 2.10節。
  - 見本のデモ: devex-ui の `/change-impact-demo`(`src/features/change-impact/demo/`。[Phase 41-3](../Phase-41/Phase-41-3.md))。
- **この Phase を始めた時点の状態**: Phase 43 までコミット済み(外側のリポジトリ・devex-api・devex-ui)。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(AI が devex-ui に実装し、`textbook/samples/frontend/` も同じ内容で作った)。

E2E: この Phase では流さない。既存の E2E は段階を初めて承認する流れだけで、印は付かず、パネルも出ない。ステージ7の E2E は Phase 50 で既存を含めて全部流す。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 44 開始時」を参照。すべて推奨どおり。

1. **自動実装モード**: on。
2. **パネルの置き場**: 作業領域の上・全幅(ダウンロードの帯とステッパーの間。全段階を段階ごとにまとめ、折りたためる。未確認の印があれば開いて出す)。選んだ段階の作業領域には件数の1行。
3. **部分再生成の操作**: 段階ごとにまとめて選ぶ(チェックボックス、初めは上限まで全部選ぶ。1段階1回の生成)。
4. **「段階Nで直す」の移動先**: 直す先の文字列から要素を推定して行を強調する(当たらなければ今どおり段階を開くだけ)。

Claude の判断(計画の承認で確定、または実装中):

- **バックエンドは変えない**。再生成の候補のキーから生成の引数は画面で導く([44-1](./Phase-44-1.md))。
- **影響は「ありうる時」だけ取る**(印か承認後の編集がある詳細設計モード。[44-1](./Phase-44-1.md))。
- **文書の要素には印を出さない**(バックエンドが記録しない。文書の変更は「変わったもの」に出し、文書の画面へのリンクを添える。[44-2](./Phase-44-2.md))。
- **pending の印**は「承認すると付く」と薄く出し、確認済みの操作は出さない([44-2](./Phase-44-2.md))。
- **確認済み**は行ごと + 段階ごとの一括。未確認に戻す操作も出す([44-2](./Phase-44-2.md))。
- **承認し直しの止め方はサーバーの 409 だけ**。画面は件数と案内を出す([44-2](./Phase-44-2.md))。
- **強調はストアの `highlight`**(既存の `focus` とは別に持ち、段階を移るまで残す。[44-1](./Phase-44-1.md))。
- **CRUD 図の強調は外枠**(下書きのセルの黄色と見分けるため。実装中に判断。[44-3](./Phase-44-3.md))。
- **再生成しても確認済みにしない**([44-4](./Phase-44-4.md))。
- **`ImpactBadge` は 44-2 で作る**(実装中に判断。計画では 44-3 だったが、パネルが使うので前方 import を避けた)。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-44-1.md`](./Phase-44-1.md) | 型・API・ストア(影響の取得・確認済み・強調・直す先の推定) | あり(UI) | なし(Phase 43 の API) |
| [`Phase-44-2.md`](./Phase-44-2.md) | 「変更の影響」パネルと段階の状態の印 | あり(UI) | 44-1 |
| [`Phase-44-3.md`](./Phase-44-3.md) | 各段階の表の行の印と「表で見る」 | あり(UI) | 44-1・44-2(`ImpactBadge`) |
| [`Phase-44-4.md`](./Phase-44-4.md) | 再生成の候補からの部分再生成 | あり(UI) | 44-1・44-2 |

## サンプルコード一覧

`textbook/samples/frontend/src/features/detailed-design/` 配下:

- 44-1: `api/{types,designStagesApi}.ts`・`impactOps.ts`・`detailed-design-store.ts`
- 44-2: `components/{ImpactBadge,ChangeImpactPanel,StageStepper,StageWorkArea,DetailedDesignPageContent}.tsx`
- 44-3: `hooks/useStageImpact.ts`・`components/{FunctionListPanel,DataFlowPanel,TableDefinitionTable,CrudMatrix,ModuleListTable,ProcedurePanel,LogicPanel,PlanTables,ProcedureDocPanel}.tsx`
- 44-4: `impactOps.ts`・`components/{RegenerationTargets,ChangeImpactPanel}.tsx`
- テスト: `test-utils/stageFixtures.ts`・`__tests__/{impactOps,detailed-design-store}.test.ts`・`components/__tests__/` の `ChangeImpactPanel`(新規)と既存12件

devex-api は変えていない。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| [44-1](./Phase-44-1.md) | `types.ts`・`designStagesApi.ts`・`impactOps.ts`・ストア | 影響の API を呼び、画面が使う状態と操作を持つ | 純粋関数(スタブ不要)/ ストアの要求と状態(スタブはフェッチ) |
| [44-2](./Phase-44-2.md) | `ChangeImpactPanel.tsx`・`ImpactBadge.tsx`・ステッパー・作業領域・ページ | 全段階の影響を見せ、確認済みと「表で見る」を操作する | 出す条件・変わったもの・印の表・操作の引数(スタブはストアの操作) |
| [44-3](./Phase-44-3.md) | `useStageImpact.ts`・段階1〜8 の表 | 表の行に印を出し、移った先の行を強調する | 各表で印と `aria-current`(ストアに影響を置く) |
| [44-4](./Phase-44-4.md) | `RegenerationTargets.tsx`・`impactOps.ts`・パネル | 再生成の候補を段階ごとに選んで部分再生成を呼ぶ | 段階へ移って再生成・押せない条件(スタブはストアの操作) |

## 写経順序(#23)

章番号順。各章の中は「この章で作成・更新したファイル」の表の順(#30。依存されるファイルが上、テストは末尾)。

実 import 監査(#15。全 import 文を読んで確かめた):

- 44-1: `types.ts` は import を持たない。`designStagesApi.ts` はこの章の型(`DesignImpactRead`・`StageImpactRead`)を読む。`impactOps.ts` の 44-1 の分は、この章の型と既存の `crudOps`・`functionListOps`・`logicOps`・`moduleListOps`・`planOps`・`labels`(`DESIGN_DOCUMENT_LABELS`)を読む(上限の定数と `RegenerationTargetRead` の import は 44-4 のタグ付き)。ストアは `designStagesApi` のこの章の関数と `impactOps` の 44-1 の名前を読む。`stageFixtures.ts` の 44-1 の分はこの章の型を読む。テストは `impactOps` の 44-1 の名前と `stageFixtures` の 44-1 の名前を読む。
- 44-2: `ImpactBadge.tsx` は `impactOps`(`MARK_STATUS_LABELS`・`markStatus`。44-1)と既存の `tableStyles` を読む。`ChangeImpactPanel.tsx` の 44-2 の分は、ストア(44-1)・`ImpactBadge`(同じ章)・`impactOps`(44-1)・`labels` を読む(`RegenerationTargets` の import は 44-4 のタグ付き)。ページは `ChangeImpactPanel`(同じ章)を読む。ステッパー・作業領域の新しい import は無い。テストは `makeImpact`・`makeElementChange`(44-1)を読む。
- 44-3: `useStageImpact.ts` はストアの `highlight`(44-1)と `marksByKey`(44-1)を読む。各表は `ImpactBadge`(44-2)・`useStageImpact`(同じ章)・`elementKey`(44-1)を読む。テストは `impactWith`(同じ章)・`makeMark`(44-1)を読む。
- 44-4: `impactOps.ts` の 44-4 の分は既存の `MAX_*_TARGETS` と `RegenerationTargetRead`(44-1)を読む。`RegenerationTargets.tsx` はストア(44-1)・`impactOps` の 44-4 の名前・既存の `procedureDocOps.toggleUnit` を読む。パネルは同じ章の `RegenerationTargets` を読む。
- 前方 import は無い。章が作成・更新するファイルは、その章のテストが少なくとも1度 import する(`types.ts`・`designStagesApi.ts` はストア経由、`ImpactBadge.tsx` はパネルと各表経由、`useStageImpact.ts` は各表経由、`RegenerationTargets.tsx` はパネル経由)。

## 検証結果

- devex-ui: 部分テスト(各章の「テスト観点」のコマンド)成功、`tsc --noEmit`・`npm run lint`(既存の警告1件だけ)・`npm run build` 成功。
- Phase 完了時の全体テスト(#18): devex-ui 763 件成功(Phase 43 時点の 727 件 + この Phase の 36 件。`--maxWorkers=4`)。並列の多い実行では、既存の `UnitProcedureEditor`・`IntakeForm` などのテストが5秒の上限に掛かることがあり(Phase 38・42 と同じ)、1回だけ `DfdEditorTabs` のテストが 50ms で落ちた(単独で5回流して5回とも成功。コードの失敗ではない)。devex-api は変えていないので流していない。
- 実画面の確認: していない。開発 DB にはまだ印の付いたデータが無く、付けるには段階を編集して承認し直す必要がある(ユーザーのデータを変える)ため、操作感の確認と合わせてユーザーに委ねた(41-5 の取り決め)。確かめる手順は「未消化の申し送り」に書いた。
- `samples_check.py`(`--ui-since HEAD --api-since HEAD`): 不一致 0 件・作り忘れ 0 件(一致 541 / 並び順のみ差 8 / 例外 5)。`link_check.py`: 切れ 0 件。

## 未消化の申し送り(#37)

Phase 43 から引き継いだもの(未解決のまま):

- **持ち越し(Phase 22 から)**: 段階6が開いていないときの、05 の詳細バッジ / ER の主キーの NULL の表示。
- **E2E を CI で流すか**: 未定([`retrospective-memo.md`](../retrospective-memo.md) に候補として記録済み)。#36 のまま。
- **コミュニケーション図**: 後回し([25-5](../Phase-25/Phase-25-5.md))。
- **「AI に提案を求める」**: ステージ8との境界として申し送る。
- **段階8の生成の入力の大きさ・判定の LLM の入力の大きさ**: 問題になれば測る。
- **生成済みの簡易モードのプロジェクト**: Phase 31 より前に生成した文書では段階8の単位が空。再生成で使える。
- **既存のプロジェクトの会話の順**(Phase 35 から): 直さない。
- **`test_chat_service.py` の pyright の指摘4件**(Phase 40 から): 触るときに `isinstance` で絞る。
- **ステージ7の計画に入れたもの**: 簡易モードの内部設計書の書き落とし → Phase 45 / L2・L5・L6・L14 と判定のゆらぎ → Phase 47・49 / 段階3の CRUD の下書きと DFD の食い違い・段階5の分岐の行の書き落とし → Phase 48。
- **Phase 45〜50 の未確定事項**: [41-5](../Phase-41/Phase-41-5.md)「未確定事項」。
- **共有のモジュールの中で「どれを直すか」**: 示さない。効果測定では見落としとして数え続ける。
- **devex-ui の「開発用」メニュー**: ステージ7の完了時に、ユーザーが前と同じく外すかを決める。
- **共有の画面を通って別の処理に届く**(Phase 42 から): 止めるかは Phase 49 の数字で決める。
- **テーブルの変更は、そのテーブルを読み書きする全処理に届く**(Phase 42 から): Phase 49 で数える。
- **文書の要素(要件・画面・API)からの影響は、まだ生成物で確かめていない**(Phase 42 から): Phase 49 で、測定用に文書の model を用意して測る。
- **改名の後に下流の参照を直して承認すると、内容の変更として広がる**(Phase 43 から): 過剰かどうかは Phase 49 で数える。
- **ER 以外の段階の外の図(段階2の DFD・データ辞書、段階4の構成図)の変更は差分に入らない**(Phase 43 から): DFD の線が効いているかを Phase 49 で見る。

この Phase で生まれたもの:

- **画面の操作感の確認(ユーザー)**: 新しい種類の画面なので、Phase の直後にユーザーが確かめる(41-5)。手順: 詳細設計モードで段階1〜7 を承認済みのプロジェクトを開き、段階4のモジュールの責務を1つ書き換えて保存 → 作業領域とパネルに「承認すると付く」の印が出る → 段階4を承認 → パネルに未確認の印(段階5〜8)、ステッパーに「見直し N」→「表で見る」で段階の表の行が強調される → 段階5で承認しようとすると 409 の案内 → 確認済みにして承認し直せる → 再生成の候補で段階5を選んで再生成。調整があれば Phase 44 の完了後の調整として扱う(#38)。
- **「段階Nで直す」の推定は名前の照合**: LLM が書く直す先の文字列に、処理ID・テーブル名・パス・関数名・単位の ID・横断事項の項目が含まれていれば当たる。当たる割合は生成物で確かめていない(Phase 49 の効果測定で見るか、画面確認で外れが目立てば直す)。
- **影響の取得は段階の一覧のたびに1回**: 印か承認後の編集がある間は、段階の一覧を取り直すたび(保存・承認・生成のポーリング)に影響も取る。重く感じたら、生成のポーリング中は取らないなどで減らす。
- **並列のテストのタイムアウト**: devex-ui の全体テストは `--maxWorkers=4` で流すと安定する(Phase 38・42・44)。CI で流すなら上限を上げるか並列を絞る。
- **セッションの区切りの記録**: Phase 44 は1セッションで行った(計画モードで質問4問 → 44-1 → 44-2 → 44-3 → 44-4 → 全体テスト → samples → 教材)。途中で調査用のサブエージェントが利用上限で止まり、調査を自分で続けた。

この Phase で解決したもの:

- **「段階Nで直す」の移動先での強調**(ステージ7の計画、Phase 40 から)→ 直す先の推定と行の強調([44-1](./Phase-44-1.md)・[44-3](./Phase-44-3.md))。
- **画面(Phase 44)で決めること**(Phase 43 から: 文書の要素の印の出し方・pending の印の見せ方・確認済みをまとめて選ぶ操作・409 を画面で解く操作)→ この introduction の「着手時の相談で決めたこと」と [44-2](./Phase-44-2.md)。
- 41-5 の Phase 44 の未確定事項(パネルの置き場・表の印の範囲・部分再生成の操作・文書の要素の印)→ 同上。

## 完了後の調整

- **「変更の影響」パネルの絞り込み**(ユーザーの画面確認で「全段階を出すため縦長になる」との指摘。2026-10-12): 初めは選んでいる段階の分だけを出し、段階のボタン・「全段階」・「未確認のみ」で切り替える。着手時の相談で「未確認のみ」は未確認の印だけ(確認済み・承認すると付く印を隠す)、段階の初期値は選んでいる段階に追従、と決めた(どちらも推奨どおり)。[44-2](./Phase-44-2.md)「パネルの構成」。変えたのは `impactOps.ts`(`stageMarkSummary`・`visibleMarks`)・`ChangeImpactPanel.tsx` とそのテスト(samples は `Phase-44(完了後の調整)` のタグ)。detailed-design のテスト 326 件成功(4件追加)。
- **閉じた段階の案内**(ユーザーの画面確認で「段階5を書き換えた後、古いとなった段階1を承認したら、段階3以降の情報が表示されなくなり、前の段階を1つずつ承認すると元に戻る。バグか仕様か」との質問。2026-10-12): 調べた結果は仕様どおり。「古い」段階は承認済みと数えないので後ろの段階が連鎖して閉じ(`derive_states`)、閉じた段階の作業領域は中身を出さない。データは消えていない。開発 DB では段階1の版が 6 → 8 に上がっており(保存が2回)、段階2・4 がそれを入力にしていたので古くなった。段階5の編集だけで段階1が古くなる経路はコードに無く、どの操作で段階1の版が上がったかは特定していない(ユーザーに確認を依頼)。ユーザーの決定で、読み取り専用の表示はせず案内を具体的にした: 閉じた段階に保存した内容があれば「消えていません」と、今承認し直せばよい段階(`labels.ts` の `firstStageToApprove`)・その段階へ移るボタンを出す。変えたのは `labels.ts`・`StageWorkArea.tsx` とそのテスト。detailed-design のテスト 329 件成功(3件追加)。

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

設問は Phase の要点の要約(回答は求めない)。

1. 段階の一覧のたびに影響を取らず、「ありうる時」だけ取るのはなぜか。判定に段階の一覧の何を使っているか。
2. 行の強調を既存の `focus` と別の `highlight` に持つのはなぜか。`focus` が消えるのはいつか。
3. pending の印に「確認済みにする」を出さないのはなぜか。Phase 43 の「記録」の仕組みから説明できるか。
4. 承認し直しを画面で止めず、サーバーの 409 に任せたのはなぜか。自分の段階の中の依存で付いた印から説明できるか。
5. 部分再生成を押すと、先にその段階へ移るのはなぜか。生成の完了を待つ仕組みから説明できるか。

## 次のフェーズ

**Phase 45**: 簡易モードの文書のモデル化(内部設計書・実装計画書の model・検証・段階8が読む解析を model に)。着手時に自動実装モード(#21)と [41-5](../Phase-41/Phase-41-5.md) の Phase 45 の未確定事項を決める。Phase 44 の画面確認の結果、調整があれば先に行う。
