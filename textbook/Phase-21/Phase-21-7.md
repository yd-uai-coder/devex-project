# Phase-21-7: 段階6の作業領域(選択・生成・逆引き・タブ・飛ばす)と、段階 → パネルの登録(FE)

## この章の目的

21-5・21-6 の部品を組み合わせて、段階6の作業領域(`LogicPanel`)を作り、段階 → パネルの対応表に登録する。上から、詳細を書く関数の選択(段階5の手順が呼ぶ関数)・下書きの生成・逆引き・関数ごとの詳細(タブ)・保存と「段階6を飛ばす」・検証の結果の順に並べる。「飛ばす」は、0件を保存して承認を始める(着手時の決定1)。

自動実装モード: on([introduction](./Phase-21-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-ui/src/features/detailed-design/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`components/LogicPanel.tsx`](../samples/frontend/src/features/detailed-design/components/LogicPanel.tsx) | 新規 | **コア** | 関数の選択(候補と呼ばれなくなった関数)、2通りの生成(まとめて・タブごと)と作り直しの確認、逆引き、タブと詳細、保存、飛ばす(確認 → 0件を保存 → `onApprove`)、検証の結果。21-8 で段階またぎを足す |
| [`components/StageWorkArea.tsx`](../samples/frontend/src/features/detailed-design/components/StageWorkArea.tsx) | 更新 | 定型 | `STAGE_PANELS[6] = LogicPanel`、`StagePanelProps.onApprove?` を足してパネルへ渡す |
| ── ここからテスト ── | | | |
| [`components/__tests__/LogicPanel.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/LogicPanel.test.tsx) | 新規 | **コア** | 候補と選択の保存、まとめての生成、逆引き・タブと1関数の作り直し、飛ばす(保存の成否で承認を始めるか)、飛ばした後の表示、呼ばれなくなった関数と検証の結果 |
| [`components/__tests__/StageWorkArea.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/StageWorkArea.test.tsx) | 更新 | 定型 | 開いた段階6には処理ロジックのパネルを出し、飛ばすから承認を始められる。登録の無い例を段階7にした |

## 要点の抜粋

```tsx
// components/LogicPanel.tsx(抜粋)
const procedures = toProcedures(stage5Model);            // 段階5(承認済み)
const candidates = logicCandidates(procedures);          // 選べる関数
const saved = toLogics(stage.model);
const pending = pendingLogics(saved);                    // 生成は保存した内容から
const skipped = stage.state === "approved" && saved.logics.length === 0 && stage.version !== null;
// 段階5を直して呼ばれなくなった関数も、外せるように選択の一覧に残す
const orphans = draft.logics.filter((row) => !candidates.some((c) => keyOf(c) === keyOf(row)));

// まとめて: 本文なし → バックエンドが同じ規則(下書きの無い関数)で対象を決める
generate(projectId, stage.stage);
// タブごと: その関数だけ
generate(projectId, stage.stage, undefined, [target]);

// 飛ばす: 確認ダイアログ → 0件を保存 → 保存できたら承認を始める(完了ダイアログは画面が出す)
const skip = async () => {
  setConfirmingSkip(false);
  if (await save(projectId, stage.stage, { logics: [] })) onApprove?.();
};
```

```tsx
// components/StageWorkArea.tsx
type StagePanelProps = { projectId; stage; onDirtyChange; onApprove?: () => void };
const STAGE_PANELS = { 1: ..., 5: ProcedurePanel, 6: LogicPanel };
<Panel ... onDirtyChange={setDirty} onApprove={onApprove} />
```

## 設計判断

### 「飛ばす」は保存してから、画面の承認の流れに乗せる

飛ばすボタンはパネルの中にあるが、承認と完了ダイアログ(「段階6-処理ロジックの詳細を承認しました。」→「次の段階へ進む」。Phase 18)は画面(`DetailedDesignPageContent`)が持つ。そこで `StagePanelProps` に任意の `onApprove` を足し、`StageWorkArea` が自分の `onApprove` をそのまま渡すようにした。

- 保存してから承認する: 承認されるのは保存済みの版だから(承認ボタンが「保存してから承認してください」と止めるのと同じ理由)。保存に失敗したら承認を始めない。
- 承認はストアの `approve` が段階の一覧から今の版を読むので、保存の後に取り直した版で承認される。
- 他の段階のパネルは `onApprove` を受け取っても使わない(任意の引数なので、既存のパネルは変えなくてよい)。

確認ダイアログでは、選んだ関数があるときだけ「選んだ関数とその詳細は消えます」と添える。飛ばして承認した段階は「段階6は飛ばしました(06 章は「省略」になります)」と出し、飛ばすボタンを押せなくする。関数を選び直して保存すれば、段階6は「レビュー中」に戻って作業を続けられる。

### 候補と「呼ばれなくなった関数」を同じ一覧に並べる

選択の一覧は、段階5の候補(呼ぶ手順のバッジつき)と、選んだのに候補に無い関数(「呼ぶ手順がありません」)を並べる。後者は検証のエラー `UNCALLED_LOGIC` の対象で、人が外すか段階5を直すまで承認できない。一覧から消してしまうと、外す手段が無くなる。

### 段階5の作業領域と同じ形にそろえる

生成の2通り(まとめて・タブごと)、作り直しの確認、保存していない編集がある間は生成できない、生成中は詳細を出さない、は段階5(Phase 20-7)と同じにした。段階をまたいで操作の約束がそろっていると、画面の説明が少なくて済む。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `LogicPanel` | render と操作 | ストアの `save`・`generate`・`fetchStages`、`onApprove`(飛ばす操作の承認の開始を受け取る) | 1関数の詳細(`LogicSpecEditor`)と編集操作(`logicOps`)は本物を使う。候補のバッジ、保存するまで生成できない、生成の対象(本文なし/1関数)、逆引きとタブ、飛ばす(保存 → `onApprove`、保存に失敗したら呼ばない)、飛ばした後の表示、呼ばれなくなった関数の印と検証の結果 |
| `StageWorkArea`(段階6) | render と操作 | ストアの `save`、`onApprove` | 段階6のパネルが出ること、飛ばすから `onApprove` まで届くこと(`StagePanelProps.onApprove` の受け渡し) |

## 動作確認(実施済み)

```bash
cd devex-ui
npx vitest run src/features/detailed-design/components/__tests__/LogicPanel.test.tsx src/features/detailed-design/components/__tests__/StageWorkArea.test.tsx
# 20 passed(21-8 の追記分を含めた件数。21-7 の時点では 17 件)
```

## 画面確認後の修正(上下の保存バー・処理ごとのタブ・二重タブ)

ユーザーが画面を確認して、2点を指摘した。

1. 関数にチェックを付けた後、保存しないと生成できない。しかし保存ボタンが最下部にしかなく、スクロールが要る。→ 保存の操作を作業領域の先頭(状態表示の直下)にも置く。段階1〜5のパネルも同じにする。
2. 候補の関数が多いと、全部にチェックを付ける手間がかかり、どこまで生成したかも見えにくい。→ 段階5の処理ごとのタブで候補と詳細を切り替え、共通の関数の印・生成済の表示・タブ単位の一括選択と生成を足す。詳細は 処理 → 関数 の二重のタブにする。

| ファイル(`devex-ui/src/features/detailed-design/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`components/StageSaveBar.tsx`](../samples/frontend/src/features/detailed-design/components/StageSaveBar.tsx) | 新規 | 定型 | 保存ボタン・未保存の案内・前後のボタン(`leading`・`trailing`)。各パネルの上下に置く |
| [`components/FunctionListPanel.tsx`](../samples/frontend/src/features/detailed-design/components/FunctionListPanel.tsx)・[`DataFlowPanel.tsx`](../samples/frontend/src/features/detailed-design/components/DataFlowPanel.tsx)・[`DataModelPanel.tsx`](../samples/frontend/src/features/detailed-design/components/DataModelPanel.tsx)・[`StructurePanel.tsx`](../samples/frontend/src/features/detailed-design/components/StructurePanel.tsx)・[`ProcedurePanel.tsx`](../samples/frontend/src/features/detailed-design/components/ProcedurePanel.tsx) | 更新 | 定型 | 保存の操作を `StageSaveBar` にして、先頭にも置く(段階1は「処理を追加」を下の `leading` に) |
| [`components/LogicPanel.tsx`](../samples/frontend/src/features/detailed-design/components/LogicPanel.tsx) | 更新 | **コア** | 上下の保存バー(`trailing` に飛ばすボタン)、処理ごとの外側のタブ、候補の行の共通の印・他の処理の手順のバッジ・状態のラベル、タブ単位の選択と生成、詳細の二重タブ、呼ばれなくなった関数のタブ |
| ── ここからテスト ── | | | |
| [`components/__tests__/StageSaveBar.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/StageSaveBar.test.tsx) | 新規 | 定型 | 保存できる条件、保存中の文言、前後のボタンの並び |
| [`components/__tests__/LogicPanel.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/LogicPanel.test.tsx) | 更新 | **コア** | 処理のタブと共通の印・状態、タブの一括選択、タブの生成(5件まで・残りの案内)、上下の保存、共通の関数へ移ってきたときのタブ、呼ばれなくなった関数のタブ |
| 段階1〜5のパネルと `StageWorkArea` のテスト | 更新 | 定型 | 保存ボタンが2つになったので先頭を取る(`getAllByRole(...)[0]`) |

```tsx
// components/LogicPanel.tsx(画面確認後の修正。抜粋)
const tabs = candidatesByProcedure(procedures);                 // 外側のタブ = 段階5の処理
const tabCandidates = /* 外側で選んだ処理の候補(呼ばれなくなった関数のタブなら orphans) */;
const tabPending = pendingInTab(saved, tabCandidates);           // 生成は保存した内容から
const tabTargets = tabPending.slice(0, MAX_LOGIC_TARGETS);       // 1回5件まで。残りはもう一度押す
const innerKeys = draft.logics.map(keyOf).filter((key) => tabKeys.has(key));   // 内側のタブ(全体の並び順)

<StageSaveBar ... trailing={skipButton} />                       // 先頭と最下部の両方
<StyledButton onPress={() => setDraft((m) => selectAll(m, candidates, tabCandidates))}>
  このタブの未選択をすべて選ぶ(N件)</StyledButton>
<StyledButton onPress={() => generate(projectId, 6, undefined, tabTargets)}>
  このタブの未生成を生成する(N件)</StyledButton>
```

### 設計判断

- **保存バーは1つの部品を上下に置く**: 同じ部品なので、上下で挙動がずれない。図のエディタ(DFD・ER・構成図)の保存は、エディタの中に保存ボタンがあるので対象外。「保存して生成する」ボタンを足す案もあったが、「生成は保存した内容を使う」という規則が見えにくくなるので採らなかった。上部に保存があれば往復はほぼ無くなる。
- **外側のタブは候補と詳細で共通**: 処理のタブを1列だけ置き、候補のチェックリストと詳細の両方を切り替える。同じ処理の話が上下でずれないようにするため。逆引き表は全体のまま(06 は関数を単位にした文書で、処理ごとにまとめるのは画面のナビゲーションの都合)。
- **タブの生成は先頭の5件**: トークンを使うのはチェックではなく生成なので、1回の生成を5件までにする上限(21-3)はそのまま。タブの未生成が6件以上なら先頭の5件を生成し、「残り M 件はもう一度押してください」と添える。
- **状態のラベル**: 選んだ関数に「生成済」(下書きあり)か「未生成」を出す。未選択には何も出さない。他の処理の手順のバッジは色を落とし、`title` に「他の処理の手順」と出す。
- **段階5から移ってきたとき**(21-8): 外側はその関数を最初に呼ぶ処理のタブ、内側はその関数のタブを開いて強調する。

テスト観点: `LogicPanel` の SUT・ドライバ・スタブは本章の表と同じ(ストアの `save`・`generate` と `onApprove` がスタブ)。`StageSaveBar` は render と操作がドライバで、`onSave` がスタブ。段階1〜6のパネル・`StageWorkArea`・`StageSaveBar` のテストは合わせて 62 passed。

### 画面確認後の修正(2回目): タブの生成ボタンの出し分けと、段階全体の生成ボタンの削除

2回目の画面確認で、ユーザーがタブの生成ボタンの調整を依頼した。あわせて、ユーザーが手で要素の配置換えと削除を行った(段階全体の「詳細の無い関数の下書きを生成する」を削除し、逆引き表をタブのボタンの下へ移した)。生成は処理のタブ単位だけになった。

| タブの状態 | ボタン | 見た目 | 押したとき |
|---|---|---|---|
| チェック済みの未生成があり、保存していない編集がある | 「生成前に保存する」 | 緑・押せる | 他の「保存する」と同じ保存 |
| 未生成があり、保存済み | 「このタブの未生成を生成する(N件)」 | 緑・押せる | タブの未生成の先頭5件を生成(残りの案内つき) |
| 未生成が無い | 「このタブの未生成を生成する(0件)」 | グレー・押せない | ― |

- 「未生成がある」は編集中の内容から判定する(チェックを付けた直後に「生成前に保存する」が出るように)。生成の対象は、これまでどおり保存した内容から取る。
- 保存していないと生成できない理由を、押せないボタンではなく「次にやること」のボタンで示した。上部の保存バーと合わせて、チェック → 保存 → 生成がタブの中で完結する。
- 削除した全体の生成ボタンにあった `pending`・`tooMany` と、`pendingLogics` の import は使わなくなったので消した(samples では削除のタグで示す)。`pendingLogics` 自体は `logicOps.ts` に残している(テストと、BE の `pending_logic_keys` との対応のため)。

テスト(`LogicPanel.test.tsx`): チェックすると「生成前に保存する」になり押すと保存すること、保存済みならタブの生成が本文の `logics` で呼ばれること、全部生成済み・チェックの無いタブは (0件) で押せないこと。FE 全体 602件が成功。

### 画面確認後の修正(3回目): 保存・生成の後もタブの位置を保つ

「生成前に保存する」「このタブの未生成を生成する(N件)」を押すと、外側のタブが一番前の処理に戻っていた。原因は、`StageWorkArea` がパネルを `key={version-generation_status}` で作り直していることである。保存すると版が、生成すると生成の状態が変わり、パネルの中の状態(開いていたタブ)が初期値に戻る。パネルを作り直すこと自体は、編集中の内容をサーバーの内容に戻すための意図した動き(Phase 16〜)なので変えない。

- ストアに `tabs: Record<string, string | null>` と `setTab(key, value)` を足した。鍵は段階と場所で決める(`"6:outer"`・`"6:inner"`・`"5:procedure"`)。
- `LogicPanel` は外側・内側のタブを、`ProcedurePanel` は処理のタブを、選ぶたびに `setTab` で覚える。作られたときは、段階をまたいで移ってきた(`focus` がある)ならそちらを優先し、無ければ覚えていたタブから始める。初期値は `useDetailedDesignStore.getState()` で一度だけ読む(購読しないので、タブを選ぶたびに描画し直さない)。
- 別のプロジェクトを開いたとき(`fetchStages` で `projectId` が変わったとき)は `tabs` を消す。段階を選び直したときは消さない(戻ってきたときに同じタブが開いていた方が作業を続けやすい)。
- 段階5の作り直し(タブごとの生成)にも同じ問題があったので、`ProcedurePanel` にも入れた。

テスト: パネルを unmount して版を上げて render し直すと、同じタブが開いている(`LogicPanel`・`ProcedurePanel`)。`setTab` が覚えて、別のプロジェクトで消える(ストア)。FE 全体 605件が成功。
