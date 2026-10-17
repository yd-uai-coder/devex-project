# Phase-69-4: 承認できない理由と、作り直しで渡した指摘を見せる

## この章の目的

段階の承認ボタンは、検証のエラー・生成中・内容が無いときに押せなくなるが、今は理由が出なかった(押せないボタンが見た目では押せるボタンと区別しにくいこともあり、差し戻しの後に「承認できない」と分かりにくかった。[Phase 54](../Phase-54/Phase-54-introduction.md) の申し送り)。この章では、承認ボタンの横に承認できない理由と検証の結果へのリンクを出し、差し戻しで作り直した段階には [69-2](./Phase-69-2.md) で記録した「この作り直しで渡した指摘」を並べる。

自動実装モード: on([introduction](./Phase-69-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`src/features/detailed-design/api/types.ts`](../samples/frontend/src/features/detailed-design/api/types.ts) | 更新 | `GenerationFinding`・`DesignStageRead.generation_findings` |
| [`src/features/detailed-design/labels.ts`](../samples/frontend/src/features/detailed-design/labels.ts) | 更新 | `approveBlocker`(承認できない理由)・`STAGE_ISSUE_LIST_ID` |
| [`src/features/detailed-design/components/StageIssueList.tsx`](../samples/frontend/src/features/detailed-design/components/StageIssueList.tsx) | 更新 | 移り先の `id` |
| [`src/features/detailed-design/components/StageGenerationFindings.tsx`](../samples/frontend/src/features/detailed-design/components/StageGenerationFindings.tsx) | 新規 | 「この作り直しで渡した指摘」 |
| [`src/features/detailed-design/components/StageWorkArea.tsx`](../samples/frontend/src/features/detailed-design/components/StageWorkArea.tsx) | 更新 | 承認の横の理由とリンク・渡した指摘 |
| テスト(下の「テスト観点」) | 新規・更新 | |

## 1. 承認できない理由(`approveBlocker`)

```ts
// src/features/detailed-design/labels.ts(要点)
export const STAGE_ISSUE_LIST_ID = "stage-issue-list";

export function approveBlocker(stage): { message: string; errors: boolean } | null {
  if (!stage.is_open || canApprove(stage) || stage.state === "approved") return null;
  if (stage.generation_status === "generating") return { message: "下書きを生成しています。…", errors: false };
  if (stage.version === null || stage.model === null) return { message: "まだ内容がありません。…", errors: false };
  const count = visibleIssues(stage.issues).filter((i) => i.severity === "error").length;
  if (count > 0) return { message: `検証のエラーが${count}件あるため承認できません。…`, errors: true };
  return null;
}
```

- `canApprove` と同じ条件の裏返しにした(押せない理由を、押せるかの判定と別の規則で作らない)。閉じた段階は、足りない入力を作業領域の上にもう出しているので null。
- 数えるエラーは `hasErrors` と同じ(図の未承認は、承認を押したときに出すので数えない。[Phase 18](../Phase-18/Phase-18-introduction.md))。
- 保存していない編集・未確認の見直しの印の案内(今まであったもの)が出ているときは、そちらを先に出す(同じ場所に1つだけ)。

## 2. 承認の横に出す(`StageWorkArea`)

```tsx
// src/features/detailed-design/components/StageWorkArea.tsx(要点)
<Text role="status" aria-label="承認できない理由" color="$red10">{blocker.message}</Text>
{blocker.errors ? (
  <a href={`#${STAGE_ISSUE_LIST_ID}`}><Text color="$blue10">検証の結果へ</Text></a>
) : null}
```

- 検証の結果は各段階のパネルの下にあり、長い段階では承認ボタンから遠い。ページ内のリンク(`#stage-issue-list`)にしたので、キーボードでも移れる。作業領域には段階を1つずつ出すので、`id` は段階ごとに分けない。
- **見せ方**(着手時の相談。推奨どおり): 承認の横に理由とリンク、渡した指摘の一覧を並べる。エラーの対象と指摘の対象の文字列の一致で「指摘に関係」の印を付ける案は、対象の書き方が揃っていないと外れるので採らなかった。

## 3. 渡した指摘(`StageGenerationFindings`)

```tsx
// src/features/detailed-design/components/StageGenerationFindings.tsx(要点)
<YStack aria-label="この作り直しで渡した指摘">
  <Text fontWeight="700">この作り直しで渡した指摘</Text>
  {findings.map((f) => <Text key={f.id}>{`[${LEVEL_LABEL[f.level]}] 対象: ${f.targets.join("、")} ── ${f.problem}`}</Text>)}
</YStack>
```

- 置き場は `StageWorkArea` の共通の部分(段階のパネルのすぐ下)にした。検証の結果(`StageIssueList`)は8つのパネルがそれぞれ置いているので、そこに足すと8か所を触ることになる。パネルの下に続けて出すので、検証の結果の後に並ぶ。
- 承認した段階には出さない(承認した後は、どの指摘で作り直したかより、承認した内容が大事なため)。

## テスト観点

| テスト | SUT | ドライバ | スタブ | 観点 |
|---|---|---|---|---|
| `labels.test.ts` | `approveBlocker` | vitest | スタブ不要 ── 純粋関数で、段階の値だけから決まるため | エラーの件数とリンクの要否 / 生成中・内容なし / 図の未承認と警告は数えない / 承認できる・承認済み・閉じた段階は null |
| `StageWorkArea.test.tsx` | `StageWorkArea` | render | スタブ不要 ── ストアには段階の値を入れるだけで、承認の関数は `vi.fn` | 作り直した段階のエラーで押せない・理由・`#stage-issue-list` へのリンク・渡した指摘の行 |
| `StageGenerationFindings.test.tsx`(新規) | `StageGenerationFindings` | render | スタブ不要 ── 渡した指摘を出すだけ | 重要度・対象・問題を渡した順に / 無ければ出さない(対象の無い指摘は「対象:」を付けない) |
| `StageIssueList.test.tsx` | `StageIssueList` | render | スタブ不要 | 移り先の `id` |

この章で作成・更新した本体のファイルは、すべて上のテストが import する(`types.ts` は型だけなので、段階の値を通して)。
