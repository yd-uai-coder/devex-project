// 更新：Phase-67(完了後の調整)
// CL開発以前のスターターテンプレート由来のファイル(CLAUDE.md #29)。Phase 67 の完了後の調整で初めて samples に載せた
// (全文。タグの無い部分はテンプレートのまま)。
"use client";
// Phase-67(完了後の調整):更新 ── tamagui.AccordionItemProps を足した
import type { ReactNode } from "react";
import { Accordion, Paragraph, Square, type AccordionItemProps, type FontSizeTokens } from "tamagui";
import { ChevronDown } from "lucide-react";
import { StyledAccordionHeader } from "@/components/ui/primitives/StyledAccordionHeader";

type AccordionInnerProps = {
  value:string,
  title:string,
  title_size?:FontSizeTokens,
  children: ReactNode;
  // Phase-67(完了後の調整):追記
  // 既定の flex={1} は横に並べる(AccordionExclusive)ためのもの。縦に並べるときは
  // flex-basis: 0 で項目の高さが潰れ、見出しが重なるので、呼び出し側で "unset" に替える
  flex?: AccordionItemProps["flex"];
};

export function AccordionInner({
  value,
  title,
  title_size,
  children,
  // Phase-67(完了後の調整):追記
  flex = 1,
}: AccordionInnerProps) {
  return(
    {/* Phase-67(完了後の調整)：更新
       <Accordion.Item value={value} flex={1}>
       ↓↓ */}
    <Accordion.Item value={value} flex={flex}>
      <StyledAccordionHeader>
        {({ open }: { open: boolean }) => (
          <>
            <Paragraph size={title_size}>
              {title}
            </Paragraph>
            <Square transparent transition="quick" rotate={open ? "180deg" : "0deg"}>
              <ChevronDown size={20} color="var(--color)" />
            </Square>
          </>
        )}
      </StyledAccordionHeader>
      <Accordion.HeightAnimator transition="300ms">
        <Accordion.Content
          transition="150ms"
          exitStyle={{ opacity: 0 }}
          borderWidth={1}
          borderTopWidth={0}
          borderColor="$borderColor"
          backgroundColor="$color3"
        >
          {children}
        </Accordion.Content>
      </Accordion.HeightAnimator>
    </Accordion.Item>
  );


}