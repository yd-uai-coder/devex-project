// 作成：Phase-118-1｜更新：Phase-118(完了後の調整2)
"use client";

import Link from "next/link";
import { H1, H2, Paragraph, Text, YStack } from "tamagui";
import { StyledCard } from "@/components/ui/primitives/StyledCard";
import { GUIDE_FLOW, GUIDE_PAGES, guideHref, type GuideSlug } from "../guide-flow";
import { GuideFlowDiagram } from "./GuideFlowDiagram";
import styles from "./guide.module.css";

// 目的別の入口(やりたいこと → 最初に読むページ)
const ENTRANCES: { want: string; slugs: GuideSlug[] }[] = [
  { want: "まず試したい", slugs: ["getting-started"] },
  // Phase-118(完了後の調整2):追記
  { want: "どちらのモードにするか迷う", slugs: ["modes"] },
  { want: "設計書がほしい", slugs: ["hearing", "documents"] },
  { want: "しっかり設計したい", slugs: ["detailed-design"] },
  { want: "仕様変更をクライアントと合意したい", slugs: ["agreement"] },
  { want: "共有リンクを受け取った", slugs: ["for-clients"] },
];

// 流れの外のページ(目次の最後に並べる)
const OTHER_PAGES: GuideSlug[] = ["for-clients", "glossary"];

function PageCard({ slug, number }: { slug: GuideSlug; number?: number }) {
  const page = GUIDE_PAGES[slug];
  return (
    <StyledCard gap="$2">
      <Text fontWeight="700" fontSize="$5">
        <Link href={guideHref(slug)} className={styles.textLink}>
          {number ? `${number}. ` : ""}
          {page.title}
        </Link>
      </Text>
      <Text color="$color11" fontSize="$3" lineHeight="$3">
        {page.summary}
      </Text>
    </StyledCard>
  );
}

// 使い方ガイドの目次(/guide)。全体の流れ図・目的別の入口・ページの一覧
export function GuideIndexContent() {
  return (
    <YStack gap="$7" paddingVertical="$4" maxWidth={1080}>
      <YStack gap="$3">
        <H1 fontSize="$9">使い方ガイド</H1>
        <Paragraph color="$color12" lineHeight="$6">
          Devex の使い方を、機能ごとのページで説明します。各ページは利用の流れの順につながっていて、上の帯で今どの段かが分かり、下の「次へ」で順に読み進められます。どのページも「できること → 使う場面 → 前提 → 手順 → 画面の見方 → コツ・注意」の順に書いています。ボタンやタブの名前は、画面の表記どおりです。
        </Paragraph>
        <Paragraph color="$color11">ログインしなくても読めます。</Paragraph>
      </YStack>

      <YStack gap="$3" render="section" aria-labelledby="guide-entrances">
        <H2 id="guide-entrances" fontSize="$7">
          目的から探す
        </H2>
        <div className={styles.cards} data-columns="3">
          {ENTRANCES.map((entrance) => (
            <StyledCard key={entrance.want} gap="$2">
              <Text fontWeight="700">{entrance.want}</Text>
              <Text color="$color11">
                {entrance.slugs.map((slug, index) => (
                  <span key={slug}>
                    {index > 0 ? "・" : null}
                    <Link href={guideHref(slug)} className={styles.textLink}>
                      {GUIDE_PAGES[slug].title} →
                    </Link>
                  </span>
                ))}
              </Text>
            </StyledCard>
          ))}
        </div>
      </YStack>

      <YStack gap="$3" render="section" aria-labelledby="guide-flow">
        <H2 id="guide-flow" fontSize="$7">
          全体の流れ
        </H2>
        <Paragraph color="$color11">各段を押すと、その段の使い方のページを開きます。</Paragraph>
        <GuideFlowDiagram />
      </YStack>

      <YStack gap="$3" render="section" aria-labelledby="guide-pages">
        <H2 id="guide-pages" fontSize="$7">
          ページの一覧(流れの順)
        </H2>
        <div className={styles.cards} data-columns="3">
          {GUIDE_FLOW.map((slug, index) => (
            <PageCard key={slug} slug={slug} number={index + 1} />
          ))}
        </div>
        <H2 fontSize="$6">そのほか</H2>
        <div className={styles.cards} data-columns="3">
          {OTHER_PAGES.map((slug) => (
            <PageCard key={slug} slug={slug} />
          ))}
        </div>
      </YStack>
    </YStack>
  );
}
