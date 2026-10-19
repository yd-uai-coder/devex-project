// 更新：Phase-79(本番確認後の調整)
// CL開発以前のスターターテンプレート由来のファイル(CLAUDE.md #29)。Phase 79 の本番確認後の調整で初めて samples に載せた
// (全文。タグの無い部分はテンプレートのまま)。
"use client";

import type { CSSProperties, ReactNode } from "react";
import { Children, isValidElement } from "react";
import { YStack } from "tamagui";
import styles from "./LayoutGrid.module.css";

export type LayoutGridColumns = {
  /** モバイル(768px未満)での1行あたりのセル数 */
  base?: number;
  /** PC(768px以上、Tamaguiの$mdブレークポイントと同じ768px)での1行あたりのセル数 */
  md?: number;
};

export type LayoutGridProps = {
  children: ReactNode;
  /** 1行あたりのセル数。既定は{ base: 2, md: 4 } */
  columns?: LayoutGridColumns;
  /** 各セルの横縦比 width/height(既定1) */
  aspectRatio?: number;
};

// grid-template-columnsはブレークポイントごとに異なる値を取る必要があるが、Tamaguiの
// レスポンシブprop($md等)は`styled()`のvariants経由でしか機能せず、任意の数値を取る
// 計算式全体を動的に差し替えることはできない。そのためグリッドコンテナ自体は
// (元の実装と同じく)CSS Moduleで組み、列数の実値だけをCSS変数(--layout-grid-*)経由で
// propsから橋渡ししている(RadioGroupWithLabel.module.cssの「propsが届かない箇所は
// CSS Moduleへ」という既存パターンの延長)。`columns`propのキー名(`base`/`md`)は、
// このプロジェクト全体で768pxブレークポイントの上書きに使われているTamaguiの
// `$md={{...}}`という命名に揃えており、見た目の書き味だけをTamaguiのレスポンシブprop
// に近づけている。
// Phase-79(本番確認後の調整):追記
// グリッドの入れ物はTamaguiのYStackでなく素のdivにする。YStackには`.is_View`
// (display:flex)が付き、本番ビルドではTamaguiの<style>がCSS Moduleの<link>より後ろに
// 入るため、同じ詳細度の`.grid`のdisplay:gridが負けて縦1列になる(開発では順が逆で
// 再現しない)。divならTamaguiのクラスが付かず、読み込み順に左右されない。
export function LayoutGrid({
  children,
  columns,
  aspectRatio = 1,
}: LayoutGridProps) {
  const mobileColumns = columns?.base ?? 2;
  const desktopColumns = columns?.md ?? 4;
  const cells = Children.toArray(children).filter(isValidElement);

  return (
    // Phase-79(本番確認後の調整)：更新
    // <YStack
    //   gap="$1"
    //   className={styles.grid}
    // ↓↓
    <div
      className={styles.grid}
      style={
        {
          "--layout-grid-mobile-columns": mobileColumns,
          "--layout-grid-desktop-columns": desktopColumns,
        } as CSSProperties
      }
    >
      {cells.map((cell, index) => (
        // 各セルの縦横比はLayoutGrid側で一括管理するため、childrenの中身(呼び出し側の
        // Card等)を直接のグリッドアイテムにするのではなく、aspectRatioを持つ
        // プレーンなラッパー(themeは持たせない、1枚のdiv)で1段包む。CSSセレクタ
        // (`.grid > *`)で子要素へ一括適用する方式は、theme propを持つ子がTamagui内部で
        // `<span style="display:contents">`にラップされることがあり(AppShellのFooter調査
        // で実際に確認済み)、セレクタがそのラップ用spanにマッチして効かなくなる恐れが
        // あるため採用していない。中身は`width="100%" height="100%"`でこのラッパーに
        // 追従させる想定(LayoutCarouselSlideと同じ「フレームは呼び出し側の中身を包む」設計)。
        <YStack key={index} aspectRatio={aspectRatio} width="100%">
          {cell}
        </YStack>
      ))}
    {/* Phase-79(本番確認後の調整)：更新 */}
    {/* </YStack> */}
    {/* ↓↓ */}
    </div>
  );
}
