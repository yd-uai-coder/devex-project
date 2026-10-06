# Phase-21-8: 段階をまたぐ移動(05↔06 のバッジ)(FE)

## この章の目的

段階5の手順の表と段階6の詳細を、バッジで行き来できるようにする(着手時の決定2)。段階5の手順のうち段階6に詳細がある行には、処理内容の下に「詳細 L-02 ↓」のバッジを出し、押すと段階6のその関数のタブへ移る。段階6の「呼ばれる手順」のバッジを押すと、段階5のその処理のタブを開いて手順の行を強調する。保存していない編集があるときは、移る前に確かめる。

自動実装モード: on([introduction](./Phase-21-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-ui/src/features/detailed-design/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`components/ProcedureStepTable.tsx`](../samples/frontend/src/features/detailed-design/components/ProcedureStepTable.tsx) | 更新 | **コア** | `detailIds`・`onDetailPress`・`highlightedStep` を受け取り、詳細バッジと行の強調(見える位置へ送る)を出す |
| [`components/ProcedurePanel.tsx`](../samples/frontend/src/features/detailed-design/components/ProcedurePanel.tsx) | 更新 | **コア** | 段階6の詳細から `logicIdsByKey` で L-ID を引く。バッジで段階6へ移る(未保存なら確認)。段階6から移ってきたら、その処理のタブと手順の行から始める |
| [`components/LogicPanel.tsx`](../samples/frontend/src/features/detailed-design/components/LogicPanel.tsx) | 更新 | **コア** | `LogicSpecEditor` に `onStepPress` を渡し、段階5へ移る(未保存なら確認)。段階5から移ってきたら、その関数のタブを開いて枠で強調する |
| ── ここからテスト ── | | | |
| [`components/__tests__/ProcedureStepTable.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/ProcedureStepTable.test.tsx) | 更新 | 定型 | 詳細バッジと押したときの鍵、強調する行の印 |
| [`components/__tests__/ProcedurePanel.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/ProcedurePanel.test.tsx) | 更新 | **コア** | 段階6へ移る(未保存の確認)、段階6から移ってきたときのタブと行、移動先が消えること |
| [`components/__tests__/LogicPanel.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/LogicPanel.test.tsx) | 更新 | **コア** | 段階5へ移る、未保存の確認、段階5から移ってきたときのタブと強調、移動先が消えること |

## 要点の抜粋

```tsx
// components/ProcedurePanel.tsx(抜粋)
const detailIds = logicIdsByKey(toLogics(stage6Model));            // 鍵 → L-ID(段階6の保存済みの内容)
// 段階6から移ってきたとき(focus.target は手順ID F-01#4)は、その処理のタブと手順の行から始める
const [highlighted] = useState(() => (focus?.stage === stage.stage ? focus.target : null));
const [selected, setSelected] = useState(() => (highlighted !== null ? highlighted.split("#")[0] : null));
useEffect(() => { if (focus?.stage === stage.stage) clearFocus(); }, [focus, stage.stage, clearFocus]);
const goToDetail = (key: string) => (dirty ? setLeaving(key) : jumpTo(6, key));   // 未保存なら確認ダイアログ

<ProcedureStepTable ... detailIds={detailIds} onDetailPress={goToDetail} highlightedStep={highlighted} />
```

```tsx
// components/ProcedureStepTable.tsx(手順の行の処理内容の欄)
const key = logicKey(callee, step.call);
const detail = step.is_branch ? undefined : detailIds?.get(key);
{detail ? <button style={BADGE} aria-label={`${id} の詳細 ${detail} へ移る`} onClick={() => onDetailPress?.(key)}>
  詳細 {detail} ↓</button> : null}
// 強調する行: aria-current="true"・背景、useEffect で scrollIntoView({ block: "center" })
```

```tsx
// components/LogicPanel.tsx(抜粋)
const [highlighted] = useState(() => (focus?.stage === stage.stage ? focus.target : null));  // 関数の鍵
const [selected, setSelected] = useState<string | null>(highlighted);
const goToStep = (stepId: string) => (dirty ? setLeaving(stepId) : jumpTo(5, stepId));
<div ref={editor} aria-current={current === highlighted ? "true" : undefined} style={/* 枠 */}>
  <LogicSpecEditor ... onStepPress={goToStep} />
</div>
```

## 設計判断

### 移動先はストアに置き、移動先のパネルが一度だけ読む

段階を切り替えると、作業領域のパネルは別のコンポーネントに入れ替わる(段階5の `ProcedurePanel` → 段階6の `LogicPanel`)。移動元から移動先へ props で渡す道が無いので、21-4 でストアに `focus`(段階と、手順ID または関数の鍵)を置いた。

- 移動先のパネルは、作られたとき(`useState` の初期化)に `focus` を読んで、開くタブと強調する対象を決める。effect で `setState` しないので、描画が1回で済む。
- 読んだら `clearFocus()` で消す。消さないと、ステッパーで段階を選び直したときにまた同じ行へ移ってしまう。
- 強調はパネルの中の状態(`highlighted`)として残す。行を見失わないよう、別のタブを開くまで残る。

### 未保存の編集があれば、移る前に確かめる

段階を切り替えるとパネルは作り直され、編集中の内容は消える(ステッパーで段階を選び直したときと同じ)。バッジは作業の途中で押されやすいので、移動を起こすパネル自身が `ConfirmDialog`(「保存していない編集は失われます。」→「移る」)を出す。保存していなければ、そのまま移る。

### 05 の詳細バッジは、段階6の保存済みの内容から出す

段階5のパネルは、段階の一覧にある段階6の `model` から `logicIdsByKey` で L-ID を引く。段階6が承認済みかどうかは問わない(作業中の段階6へも移れるようにするため)。段階5の `model` には何も足さないので、段階6で関数を選んでも段階5は書き換わらない(21-1 の判断のとおり)。

### 画面確認後の修正: 段階6のどのタブで開くか

21-7 の画面確認後の修正で、段階6は 処理 → 関数 の二重のタブになった。段階5から移ってきたときは、その関数を最初に呼ぶ処理を外側のタブで開き、内側でその関数を開いて強調する(呼ばれなくなった関数なら「呼ばれていない関数」のタブ)。`focus` の target は関数の鍵のまま変えていない。段階5の詳細バッジから移るときは呼び元の処理が分かるので、target に処理ID を足して「押した処理のタブ」で開く案もある。ただ、共通の関数はどのタブでも同じ1件を編集するので、今回は見送った。

### 段階6が開いていないとき

段階5を直して承認し直していないと、段階6は開かない(入力の段階5が承認済みでない)。そのときバッジを押すと、段階6の画面は「この段階はまだ始められません」になる。バッジを出さない案もあるが、段階6の内容(どの関数に詳細があるか)は変わっていないので、05 の表にはそのまま出しておく。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `ProcedureStepTable`(詳細バッジ・強調) | render と操作 | `onChange`・`onDetailPress` | 詳細のある手順にだけバッジが出て、押すと関数の鍵が渡る。強調する行に `aria-current`、分岐の行には付かない |
| `ProcedurePanel`(段階またぎ) | render と操作 | ストアの `save`・`generate`・`fetchStages`。`jumpTo`・`clearFocus` は本物を使い、ストアの `selectedStage`・`focus` を見る | 未保存なら確認してから段階6へ移る。`focus` があるとその処理のタブと手順の行から始まり、`focus` は消える |
| `LogicPanel`(段階またぎ) | 同上 | 同上 | 呼ばれる手順のバッジで段階5へ移る、未保存の確認、`focus` があるとその関数のタブを開いて枠で強調し、`focus` は消える |

`jumpTo`・`clearFocus` をスタブにしないのは、移動先の状態(段階・対象)そのものが確かめたいことだからである。

## 動作確認(実施済み)

```bash
cd devex-ui
npx vitest run src/features/detailed-design/components/__tests__/ProcedureStepTable.test.tsx \
  src/features/detailed-design/components/__tests__/ProcedurePanel.test.tsx \
  src/features/detailed-design/components/__tests__/LogicPanel.test.tsx
# 25 passed
```
