// 更新：Phase-62-2,118-2
// Phase-118-2：削除
// "use client";
//
// Phase-62-2：更新
// import Link from "next/link";
// import { Card, H1, H2, H3, Paragraph, Text, YStack } from "tamagui";
// ↓↓
// Phase-62-2：更新
// import { MENU_TREE } from "@/lib/menu-tree";
// import menuStyles from "@/components/layout/Menu.module.css";
// ↓↓
// Phase-118-2:追記 ── next.Metadata, @/features/top/components/TopPageContent.TopPageContent
// Phase-118-2：削除 ── tamagui.Card, tamagui.H1, tamagui.H2, tamagui.H3, tamagui.Paragraph, tamagui.YStack, @/components/ui/media/Hero.Hero, @/components/ui/layout-blocks/LayoutGrid.LayoutGrid, @/components/layout/MenuEntry.MenuEntry, @/components/layout/useMenuTree.useMenuTree, @/lib/menu-tree.menuItemKey, @/lib/menu-tree.MenuGroup
import type { Metadata } from "next";
import { TopPageContent } from "@/features/top/components/TopPageContent";

// Phase-118-2：更新
// const HERO_IMAGE = "https://dummyimage.com/1200x800/b3e687/ffffff&text=Devex";
//
// // トップページ自身へのリンクのグループ(TOP)はカードにしない
// function menuGroupCards(tree: MenuGroup[]) {
//   return tree.filter((group) => group.href !== "/").map((group, index) => (
//     <Card
//       key={group.label}
//       theme={index % 2 === 0 ? "green" : "blue"}
//       backgroundColor="$color4"
//       borderWidth={1}
//       borderColor="$borderColor"
//       borderRadius="$5"
//       width="100%"
//       height="100%"
//       padding="$4"
//       gap="$4"
//     >
//       <H3 fontSize="$8" fontWeight="700" color="$color11">
//         {group.label}
//       </H3>
//       <YStack gap="$3">
//         {group.children.map((item) => (
//           <MenuEntry key={menuItemKey(item)} item={item} fontSize="$5" />
//         ))}
//       </YStack>
//     </Card>
//   ));
// }
// ↓↓
// TOP ページ。何のアプリか・何ができるかを伝え、使い方は使い方ガイド(/guide)へ誘導する
export const metadata: Metadata = {
  title: "Devex ── クライアントとの合意を、設計から実装・テストまでつなぐ",
  description:
    "AI のヒアリングから要件定義・設計・実装手順・テストを作り、合意済みの版と変更要求で、仕様変更の影響・クライアントとの合意・反映・再検証までを管理します。",
};

export default function Home() {
  // Phase-62-2:追記
  // Phase-118-2：更新
  // const tree = useMenuTree();
  //
  // return (
  //   <YStack gap="$8" paddingVertical="$4">
  //     <Hero mode="imageRight" imageSrc={HERO_IMAGE} imageAlt="Devex">
  //       <YStack gap="$3">
  //         <H1>Devex</H1>
  //         <Paragraph color="$color11">
  //           AIとの対話ヒアリングから、要件定義書・外部設計書・内部設計書・実装計画書の4種類のドキュメントを自動生成するアプリケーションです。プロジェクトを作成し、チャットでヒアリングに答えるだけで設計書一式が仕上がります。
  //         </Paragraph>
  //       </YStack>
  //     </Hero>
  //
  //     <YStack gap="$4">
  //       <H2>はじめる</H2>
  //       <LayoutGrid columns={{ base: 1, md: 3 }} aspectRatio={1/ 1}>
  //         {menuGroupCards(tree)}
  //       </LayoutGrid>
  //     </YStack>
  //   </YStack>
  // );
  // ↓↓
  return <TopPageContent />;
}
