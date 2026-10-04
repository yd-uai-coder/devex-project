# Phase-20-7: 段階5の作業領域と、段階 → パネルの登録(FE)

## この章の目的

20-5・20-6 の部品を組み合わせて、段階5の作業領域(`ProcedurePanel`)を作り、段階 → パネルの対応表に登録する。上から、手順を書く処理の選択・下書きの生成・索引・処理 × モジュールの関与表・処理ごとの手順(タブ)・保存・検証の結果の順に並べる。見せ方は Phase 14 のデモ(索引・関与表・タブ)に合わせた。

学習モード([introduction](./Phase-20-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-ui/src/features/detailed-design/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`components/ProcedurePanel.tsx`](../samples/frontend/src/features/detailed-design/components/ProcedurePanel.tsx) | 新規 | **コア** | 処理の選択、2通りの生成(まとめて・タブごと)と作り直しの確認、索引、関与表、タブと手順の表、保存、検証の結果 |
| [`components/StageWorkArea.tsx`](../samples/frontend/src/features/detailed-design/components/StageWorkArea.tsx) | 更新 | 定型 | `STAGE_PANELS[5] = ProcedurePanel` |
| ── ここからテスト ── | | | |
| [`components/__tests__/ProcedurePanel.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/ProcedurePanel.test.tsx) | 新規 | **コア** | 選択の保存と「保存するまで生成できない」、まとめての生成、索引・関与表・タブと1処理の作り直し、関与表へのすぐの反映と外すときの確認、6件以上、生成中、失敗・検証の結果 |
| [`components/__tests__/StageWorkArea.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/StageWorkArea.test.tsx) | 更新 | 定型 | 開いた段階5には手順のパネルを出し、登録の無い段階6は準備中 |

## 要点の抜粋

```tsx
// components/ProcedurePanel.tsx(抜粋)
const functionList = toFunctionList(stage1Model);                       // 段階1(承認済み)
const modulePaths = toModuleList(stage4Model).modules.map((r) => r.path.trim());   // 段階4(承認済み)
const saved = toProcedures(stage.model);
const pending = pendingFunctionIds(saved);                               // 生成は保存した内容から
const canGenerate = stage.is_open && !generating && !requestingGeneration && !dirty;

// まとめて: 手順の無い処理(5件まで)。本文なし → バックエンドが同じ規則で対象を決める
<StyledButton disabled={!canGenerate || pending.length === 0 || tooMany}
  onPress={() => void generate(projectId, stage.stage)}>
  {`手順の無い処理の下書きを生成する(${pending.length}件)`}
</StyledButton>

// タブごと: その処理だけ。手順があれば確認ダイアログを出してから
onPress={() => savedCurrent.steps.length > 0
  ? setConfirming(savedCurrent.function_id)
  : regenerate(savedCurrent.function_id)}          // generate(projectId, 5, [functionId])
```

```tsx
// components/StageWorkArea.tsx
const STAGE_PANELS = { 1: FunctionListPanel, 2: DataFlowPanel, 3: DataModelPanel, 4: StructurePanel, 5: ProcedurePanel };
```

## 設計判断

### 2通りの生成の出し分け

| ボタン | 対象 | 確認 | 押せないとき |
|---|---|---|---|
| 「手順の無い処理の下書きを生成する(N件)」 | 保存した選択のうち手順の無い処理 | なし(手直しを失わない) | 保存していない編集がある / 0件 / 6件以上 |
| 「この処理の手順を作り直す」(タブ) | そのタブの処理だけ | あり(その処理の手直しが失われる。選定理由と他の処理は残る) | 保存していない編集がある |
| 「この処理の下書きを生成する」(タブ、手順が無いとき) | そのタブの処理だけ | なし | 同上 |

6件以上の未生成をまとめて生成できないとき(1回の上限は5件。20-3)は、理由を出してタブごとの生成へ案内する。上限で一部だけ生成する案もあるが、どれが生成されたかが分かりにくいので採らなかった。

生成はどれも保存した内容を使う(バックエンドは保存した `model` から対象を決める)。保存していない編集がある間は、どのボタンも押せない。段階2の「グループを選んで保存 → 生成」と同じ形である。

### タブと索引・関与表の元

- タブは編集中の選択(保存前を含む)から作る。選んだばかりの処理のタブには「保存すると、この処理の下書きを生成できます」と出す。
- 索引と関与表も編集中の内容から導く(20-5)。手順を編集すると、すぐに関与表に反映する。
- 生成中は手順の表を出さず「手順: 生成中」と出す(他の段階と同じ)。

### 手順のある処理を外すときの確認

処理の選択を外すと、その処理の行ごと(手順を含めて)消える。手順がある処理を外すときだけ確認を出す(`window.confirm`)。保存するまでは元に戻せるが、外した直後にタブが消えるので、気づかずに保存するのを防ぐ。

### 段階6の入口は作らない

索引の「紐づく06の項目」の列と、手順の「詳細」のバッジは、段階6(Phase 21)で足す。段階6の項目は (モジュール, 関数) を持ち、手順の (`callee`, `call`) との一致から導く(着手時の決定3)ので、この画面の `model` は変えずに足せる。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `ProcedurePanel` | render と操作(Testing Library) | 段階のストアの `save`・`generate`・`fetchStages`(API を呼ばずに、渡された値を見る)。`window.confirm`。手順の表(`ProcedureStepTable`)と `procedureOps` は本物を使う | 選択の保存(機能一覧の順)と「保存するまで生成できない」、まとめての生成は対象の指定なし、タブの作り直しは確認してから `["F-01"]`、承認済みなら「段階の承認はやり直し」、編集が関与表にすぐ出ること、外すときの確認、6件以上の案内とタブごとの生成、生成中・失敗・検証の結果 |
| `StageWorkArea`(段階5の登録) | 同上 | パネルは本物 | 開いた段階5に手順のパネル。登録の無い段階6は「準備中」 |

## 動作確認(実施済み)

```bash
cd devex-ui
npx vitest run src/features/detailed-design/components/__tests__/ProcedurePanel.test.tsx src/features/detailed-design/components/__tests__/StageWorkArea.test.tsx
# 16 passed
```
