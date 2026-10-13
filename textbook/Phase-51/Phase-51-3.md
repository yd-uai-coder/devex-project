# Phase-51-3: 見本 ── レビュー結果・テスト仕様書(md)と画面のデモ

## この章の目的

[51-2](./Phase-51-2.md) で決めた形(区切りごとのレビュー・自動とボタン・未レビューの印・指摘の採否・採用した指摘からの再生成の指示・観点を未決に戻す再ヒアリング・オン・オフと失敗時の自己診断)を、実装の前に見本で確かめる。md の見本はレビュー結果とテスト仕様書の中身を、画面のデモは操作の流れ(区切りを流す → 指摘を採否 → 差し戻し)を示す。新しい種類の画面なので、操作の流れを先に見せる([総括の振り返り](../appendix/overall-retrospective.md) 11.6 の所見。[41-3](../Phase-41/Phase-41-3.md) と同じ)。

自動実装モード: on([introduction](./Phase-51-introduction.md) 参照)。

## この章で作成・更新したファイル

md の見本(samples の対象外):

| パス | 中身 |
|---|---|
| [`appendix/design-review-sample/README.md`](../../appendix/design-review-sample/README.md) | 示し方の規則と、例4つ(詳細の要件・外部の後 / 段階6の後 / 簡易の4文書の後 / オフ・失敗のとき) |
| [`appendix/design-review-sample/test-spec.md`](../../appendix/design-review-sample/test-spec.md) | テスト仕様書の見本(方針・結合テスト14件・総合テスト6件・要件との対応) |

画面のデモ(devex-ui 本体と samples に同じ内容。#30 の依存順):

| ファイル | 責務 |
|---|---|
| [`src/features/design-review/demo/reviewModel.ts`](../samples/frontend/src/features/design-review/demo/reviewModel.ts) | 指摘・区切り・観点の型と、オンの判定・区切りの状態・未レビューの知らせ・指摘の並びと数・再生成の指示・観点を未決に戻す・聞き直しの問いかけの純粋関数 |
| [`src/features/design-review/demo/demoData.ts`](../samples/frontend/src/features/design-review/demo/demoData.ts) | 仮データ(51-1 の (e) の Sonnet の指摘を縮めたもの。詳細9件・簡易4件と観点の表) |
| [`src/features/design-review/demo/DesignReviewDemoPageContent.tsx`](../samples/frontend/src/features/design-review/demo/DesignReviewDemoPageContent.tsx) | デモ画面(アカウントと設定・モードと区切り・指摘・差し戻し) |
| [`src/app/design-review-demo/page.tsx`](../samples/frontend/src/app/design-review-demo/page.tsx) | ルート `/design-review-demo`(本体は `src/app/(pages)/` 配下) |
| [`src/lib/menu-tree.ts`](../samples/frontend/src/lib/menu-tree.ts) | メニューの「開発用」にデモを足す |
| [`src/features/design-review/demo/__tests__/reviewModel.test.ts`](../samples/frontend/src/features/design-review/demo/__tests__/reviewModel.test.ts) | 純粋関数のテスト |
| [`src/features/design-review/demo/__tests__/DesignReviewDemoPageContent.test.tsx`](../samples/frontend/src/features/design-review/demo/__tests__/DesignReviewDemoPageContent.test.tsx) | 画面の操作のテスト |
| [`src/app/design-review-demo/__tests__/page.test.tsx`](../samples/frontend/src/app/design-review-demo/__tests__/page.test.tsx) | ルートのテスト |
| [`src/components/layout/__tests__/Menu.test.tsx`](../samples/frontend/src/components/layout/__tests__/Menu.test.tsx) | メニューの「開発用」のリンクのテストを足す |

本体のメニューは、ステージ7の完了時に「開発用」の群ごと外されていた([Phase 50-3](../Phase-50/Phase-50-3.md))。この章でデモ1つだけの群として足し直した。

## md の見本の要点

- **示し方の規則**の表(役割・区切り・未レビューの印・入力・指摘の項目・採否・差し戻し・オン・オフ・失敗・対象外)を先に置き、例はその規則の当てはめにした。
- **例1(詳細の要件・外部の後、自動)**: 指摘5件に採用・却下・保留を付けた形。採用した設計の指摘2件だけが再生成の指示に入り、採用したヒアリングの指摘(セキュリティ)は観点を「未決」に戻す。保留の指摘(不正利用)は観点を変えない。
- **例2(段階6の後、ボタン)**: 詳細設計書の最重要2件(projects に持ち主が無い・生成文書の保存先が無い)。直しは今の部分再生成の単位。段階を承認し直すと区切りは「未レビュー」に戻る。
- **例3(簡易の4文書の後)**: もともと「未決」の観点(体制・期間)の指摘を採用しても状態は変わらず、問いかけだけが出る。
- **例4**: オフ・superuser 以外・使えないとき・上限に達したときに何が出るか。
- **テスト仕様書**: 結合テスト(API ごとに正常・異常・境界・セキュリティ)と総合テスト(画面の流れ・非機能)の表、要件 → テストの対応表。設計に無いことは期待結果に「設計に無い」と印を付け、レビューの指摘から辿れるようにする。単体テストは書かない(手順書のテスト観点のまま)。

## デモの要点

### `reviewModel.ts`(意味モデルと純粋関数)

```ts
// src/features/design-review/demo/reviewModel.ts(抜粋)
export type Finding = {
  id: string; gate: string; level: Level; cause: Cause; targets: string[];
  pointKey?: string;   // 原因がヒアリングのとき、戻す観点のキー
  problem: string; evidence: string; reason: string; suggestion: string;
};
export type Gate = { key: string; mode: Mode; label: string; trigger: "auto" | "button"; documents: string[] };

export function reviewEnabled(user: { isSuperuser: boolean; reviewSetting: boolean }): boolean {
  return user.isSuperuser && user.reviewSetting;
}
```

- `GATES`: 簡易は「4文書の生成の後」(自動)、詳細は「要件・外部の生成の後」(自動)・「段階6の承認の後」「段階7の承認の後」(ボタン)。区切りごとに渡す文書(上流を含む)を持つ。
- `gateStatus(ready, reviewed, failed)`: 文書がまだ無い / 未レビュー / レビュー済み / 失敗。`unreviewedNotice` は、そろっているのにレビューしていない(または失敗した)区切りを挙げる文を返す(手順書の生成のときの知らせ。止めない)。
- `regenerationFindings`・`regenerationInstruction`: 採用した設計・不整合の指摘だけを、重要度の順に「対象: 問題 → 改善案」で並べ、「指摘に無い部分は変えないでください」を先頭に付ける。ヒアリングの指摘は入れない(聞き直してから再生成する)。
- `reopenPoints`: 採用したヒアリングの指摘の観点を `open` に戻す。もともと `open` の観点は「戻した」に数えない。`rehearingQuestions` は観点ごとに問題をまとめた最初の問いかけ。

### `demoData.ts`

51-1 の追加測定 (e) で Sonnet が返した指摘(`runs/gates_sonnet/`)を縮め、引用(evidence)と観点のキーを足した。詳細は区切りごとに 5件・3件・1件、簡易は4件。観点の表は detailed-3・simple-2 の一部。

### `DesignReviewDemoPageContent.tsx`

上から「アカウントと設定(superuser / 一般ユーザー・レビューを使う)→ モードとレビューの区切り(表・承認・レビューする・使えない状態にする・手順書を生成する)→ 指摘(重要度の順、採用・却下・保留)→ 差し戻し(再生成の指示・ヒアリングの観点・聞き直し)」。自動の区切りは、生成済み・レビュー済みとして始める。段階6・7 は「承認する」で文書がそろい、未レビューになる。使えない状態でレビューすると失敗(自己診断に切り替え)になり、「もう一度レビュー」で流し直せる。一般ユーザーにすると設定は押せず、区切りは「オフ(自己診断)」で、指摘と差し戻しは出ない。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `reviewModel.test.ts` | `reviewEnabled`・`gatesOf`・`gateStatus`・`unreviewedNotice`・`sortFindings`・`decisionCounts`・`regenerationFindings`・`regenerationInstruction`・`reopenPoints`・`rehearingQuestions` | Vitest | スタブ不要 ── 純粋関数で、仮データ(`demoData.ts`)を入力にする |
| `DesignReviewDemoPageContent.test.tsx` | `DesignReviewDemoPageContent` | Testing Library(クリック) | スタブ不要 ── サーバーと通信しない |
| `page.test.tsx` | `DesignReviewDemoPage` | Testing Library | 画面の本体をモック(ルートが本体を描くことだけを確かめる) |
| `Menu.test.tsx`(足した1件) | `Menu` | Testing Library(クリック) | スタブ不要 |

- **オンの判定**: superuser かつ設定がオンのときだけ。superuser でなければ設定がオンでも動かない。
- **区切り**: 簡易は自動の1つ、詳細は自動1つとボタン2つ。状態の遷移(文書がまだ無い → 未レビュー → レビュー済み、失敗)。知らせは文書の無い区切りを数えない。
- **指摘**: 重要度の順。判断していない指摘は未判断として数える。
- **差し戻し**: 再生成の指示には、採用した設計・不整合の指摘だけが入る(ヒアリング・却下・保留は入らない)。採用したヒアリングの指摘は観点を未決に戻し、もともと未決の観点は戻したことにしない。問いかけは観点ごとにまとめる。
- **画面**: 段階6を承認 → 未レビュー → 手順書の生成で知らせ → レビューで指摘が増える。使えないときは失敗 → 流し直せる。採用で再生成の指示と観点が変わる。一般ユーザーは切り替えられずオフ。簡易は1区切りで、未決の観点は戻さない。
- 実行: `npx vitest run src/features/design-review "src/app/(pages)/design-review-demo" src/components/layout`(20件成功)。
