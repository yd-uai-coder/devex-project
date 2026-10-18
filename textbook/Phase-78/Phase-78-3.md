# Phase-78-3: 押せないボタンの見た目

## この章の目的

`StyledButton`(緑のボタンの共通部品)は、押せないとき(`disabled`)も見た目が変わらず、承認できない段階の「承認する」などが押せるボタンと同じに見えていた。押せないときは薄く(不透明度 0.5)して見分けられるようにする。Phase 69 から申し送ってきた項目で、Phase 76・77 の偽の Google のボタン・連携のダイアログの「連携する」・解除のボタンもこれで変わる。

自動実装モード: on([introduction](./Phase-78-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`src/components/ui/primitives/StyledButton.tsx`](../samples/frontend/src/components/ui/primitives/StyledButton.tsx) | 更新(samples には新規) | `disabled` なら `opacity` 0.5 |
| [`src/components/ui/primitives/__tests__/StyledButton.test.tsx`](../samples/frontend/src/components/ui/primitives/__tests__/StyledButton.test.tsx) | 新規 | 押せないとき・押せるとき・呼ぶ側の上書き |

`StyledButton.tsx` はテンプレート由来で、samples にまだ無かった。#29 のとおり「作成」を省き、`更新：Phase-78-3` のヘッダーで置いた。

## 1. 押せないときの不透明度

```tsx
// src/components/ui/primitives/StyledButton.tsx(抜粋)
const DISABLED_OPACITY = 0.5;

export function StyledButton({ ..., disabled, ...props }: ButtonProps) {
  return (
    <Button ...
      disabled={disabled}
      opacity={disabled ? DISABLED_OPACITY : undefined}
      {...props}
    />
  );
}
```

- **Tamagui の Button は見た目を変えない**: `disabled` は `pointerEvents: "none"` と `aria-disabled` を付けるだけ。押せなくはなるが、色はそのまま。
- **0.5 にした**: 詳細設計の `DesignDocumentBar`(`DISABLED_OPACITY = 0.5`)や、素の `Button` にその場で付けている所(0.5〜0.6)に合わせた。
- **`{...props}` の前に置く**: 呼ぶ側が `opacity` を渡せば、そちらが勝つ。`disabledStyle`(Tamagui の疑似スタイル)も使えるが、ほかの画面のやり方と同じく値で渡す形にした(テストで inline style として確かめられる)。
- **素の `Button` のその場の指定は触らない**: `RequirementsSummaryPanel` などは `StyledButton` でなく、今は見た目に困っていない。直す消費者がいないので、まとめない(#17 の (b))。
- **使う所**: 38 ファイル。テーマが gray・red の押せないボタン(詳細設計の「このタブの未生成を生成する(0件)」など)も薄くなる。スナップショットのテストは無く、既存のテストは変えずに通った。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `StyledButton.test.tsx`(新規) | `StyledButton` | React Testing Library(`toHaveStyle`) | スタブ不要 ── 表示だけで、外部の依存を呼ばないため |

- 押せないときは `opacity: 0.5` / 押せるときは付かない / `disabled` で `opacity` を渡すと、渡した値になる。
- 作成・更新したファイルは、この章のテストが import する。前方 import は無い。
- 画面での見え方(ダークモード・色ごとの薄さ)は、Phase 79 の画面確認で見る。
