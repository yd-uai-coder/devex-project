// 更新：Phase-62-2
"use client";

import Link from "next/link";
// Phase-62-2：更新
// import { H1, H4, Text, XStack, YStack } from "tamagui";
// ↓↓
import { H1, H4, XStack, YStack } from "tamagui";
import { Column } from "@/components/ui/primitives/Column";
// Phase-62-2：更新
// import { MENU_TREE } from "@/lib/menu-tree";
// ↓↓
import { MenuEntry } from "@/components/layout/MenuEntry";
import { useMenuTree } from "@/components/layout/useMenuTree";
import { menuItemKey, type MenuGroup } from "@/lib/menu-tree";
import menuStyles from "@/components/layout/Menu.module.css";

// Phase-62-2：更新
// function menuGroupColumns() {
//   return MENU_TREE.map((group) => (
// ↓↓
function menuGroupColumns(tree: MenuGroup[]) {
  return tree.map((group) => (
    <Column key={group.label}>
      {/* Phase-62-2：更新(子を持たないリンクのグループ(TOP)は、見出しをリンクにする)
      <H4>{group.label}</H4>
          ↓↓ */}
      <H4>
        {group.href !== undefined ? (
          <Link href={group.href} className={menuStyles.navLink}>
            {group.label}
          </Link>
        ) : (
          group.label
        )}
      </H4>
      <YStack gap="$1.5">
        {group.children.map((item) => (
          // Phase-62-2：更新
          // <Text key={item.href} fontSize="$3" color="$color11">
          //   <Link href={item.href} className={menuStyles.navLink}>
          //     {item.label}
          //   </Link>
          // </Text>
          // ↓↓
          <MenuEntry key={menuItemKey(item)} item={item} fontSize="$3" />
        ))}
      </YStack>
    </Column>
  ));
}

export function NotFoundContent() {
  // Phase-62-2:追記
  const tree = useMenuTree();

  return (
    <YStack gap="$6" paddingVertical="$6">
      <H1>指定のページは存在しません</H1>
      <XStack flexDirection="column" $md={{ flexDirection: "row" }} gap="$4">
        {/* Phase-62-2：更新
        {menuGroupColumns()}
            ↓↓ */}
        {menuGroupColumns(tree)}
      </XStack>
    </YStack>
  );
}
