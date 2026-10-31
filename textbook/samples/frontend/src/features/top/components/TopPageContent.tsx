// 作成：Phase-118-2｜更新：Phase-118(完了後の調整2)
"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { H1, H2, H3, Paragraph, Text, YStack } from "tamagui";
import { useAuthStore } from "@/components/auth/auth-store";
import { Hero } from "@/components/ui/media/Hero";
import { StyledCard } from "@/components/ui/primitives/StyledCard";
import { GuideFlowDiagram } from "@/features/guide/components/GuideFlowDiagram";
import { GUIDE_FEATURES, GUIDE_INDEX_HREF, guideHref } from "@/features/guide/guide-flow";
import { useHasMounted } from "@/hooks/useHasMounted";
import {
  TOP_CATCH,
  TOP_GETTING_STARTED,
  TOP_LEAD,
  TOP_MODES,
  TOP_NOT_DOING,
  TOP_PRINCIPLES,
  TOP_PROBLEMS,
  TOP_REPOSITORIES,
  TOP_STEPS,
  TOP_TECH_STACK,
} from "../top-content";
import styles from "./top.module.css";

// Hero の画像(GUIDE の撮影と同じ開発環境の画面。変更要求の詳細)
const HERO_IMAGE = "/guide/top-hero.webp";

function Section({ id, title, lead, children }: { id: string; title: string; lead?: string; children: ReactNode }) {
  return (
    <YStack gap="$4" render="section" aria-labelledby={id}>
      <YStack gap="$2">
        <H2 id={id} fontSize="$8">
          {title}
        </H2>
        {lead ? <Paragraph color="$color11">{lead}</Paragraph> : null}
      </YStack>
      {children}
    </YStack>
  );
}

// 「はじめる」の行き先。ログイン中はダッシュボード、それ以外(確認中を含む)は登録
function useStartHref(): string {
  const mounted = useHasMounted();
  const accessToken = useAuthStore((s) => s.accessToken);
  return mounted && accessToken ? "/dashboard" : "/register";
}

// TOP ページ(/)。偶然来た人が「何のアプリか・何ができるか」を掴めるよう、何が・なぜを書き、
// 手順は書かずに使い方ガイドへ誘導する。
export function TopPageContent() {
  const startHref = useStartHref();

  return (
    <YStack gap="$10" paddingVertical="$4" maxWidth={1180}>
      <Hero mode="imageRight" imageSrc={HERO_IMAGE} imageAlt="Devex の変更要求の詳細の画面" height={460}>
        <YStack gap="$4">
          <Text color="$color11" fontWeight="700">
            Devex
          </Text>
          <H1 fontSize="$9" lineHeight="$9">
            {TOP_CATCH}
          </H1>
          {TOP_LEAD.map((line) => (
            <Paragraph key={line} color="$color12" lineHeight="$5">
              {line}
            </Paragraph>
          ))}
          <div className={styles.ctas}>
            <Link href={startHref} className={styles.cta}>
              はじめる
            </Link>
            <Link href={GUIDE_INDEX_HREF} className={styles.ctaSecondary}>
              使い方を見る
            </Link>
          </div>
        </YStack>
      </Hero>

      <Section id="top-problems" title="こんな悩みに">
        <div className={styles.cards}>
          {TOP_PROBLEMS.map((item) => (
            <StyledCard key={item.problem} gap="$2">
              <Text fontWeight="700" color="$color11">
                {item.problem}
              </Text>
              <Text color="$color12" lineHeight="$4">
                → {item.solution}
              </Text>
            </StyledCard>
          ))}
        </div>
      </Section>

      <Section
        id="top-flow"
        title="全体の流れ"
        lead="ヒアリングから設計・実装手順・テストを作り、合意した内容を版として固定します。仕様を変えたいときは、変更要求でクライアントと合意し、反映して確かめ直します。"
      >
        <GuideFlowDiagram />
      </Section>

      <Section id="top-features" title="できること">
        <div className={styles.cards} data-columns="4">
          {GUIDE_FEATURES.map((feature) => (
            <StyledCard key={feature.title} gap="$2" justifyContent="space-between">
              <YStack gap="$2">
                <H3 fontSize="$5" fontWeight="700">
                  {feature.title}
                </H3>
                <Text color="$color11" fontSize="$3" lineHeight="$3">
                  {feature.summary}
                </Text>
              </YStack>
              <Text fontSize="$3">
                <Link
                  href={guideHref(feature.slug)}
                  className={styles.textLink}
                  aria-label={`${feature.title}の使い方`}
                >
                  使い方 →
                </Link>
              </Text>
            </StyledCard>
          ))}
        </div>
      </Section>

      <Section id="top-modes" title="2つのモード" lead="モードはプロジェクトを作るときに選びます(後から変えられません)。">
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col" />
                <th scope="col">簡易ドキュメントモード</th>
                <th scope="col">詳細設計モード</th>
              </tr>
            </thead>
            <tbody>
              {TOP_MODES.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  <td>{row.simple}</td>
                  <td>{row.detailed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Text color="$color11">
          {/* Phase-118(完了後の調整2)：更新 */}
          {/* <Link href={guideHref("projects")} className={styles.textLink}> */}
          {/*   モードの選び方 → */}
          {/* ↓↓ */}
          <Link href={guideHref("modes")} className={styles.textLink}>
            2つのモードと作る文書 →
          </Link>
        </Text>
      </Section>

      <Section id="top-steps" title="はじめるまで4ステップ">
        <div className={styles.cards} data-columns="4">
          {TOP_STEPS.map((step, index) => (
            <StyledCard key={step.title} gap="$2">
              <Text fontWeight="700">{`${index + 1}. ${step.title}`}</Text>
              <Text color="$color11" fontSize="$3" lineHeight="$3">
                {step.body}
              </Text>
            </StyledCard>
          ))}
        </div>
        <Text color="$color11">
          <Link href={guideHref(TOP_GETTING_STARTED)} className={styles.textLink}>
            くわしくは「はじめに」へ →
          </Link>
        </Text>
      </Section>

      <Section id="top-principles" title="大切にしていること">
        <ul className={styles.list}>
          {TOP_PRINCIPLES.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <H3 fontSize="$5">やらないこと</H3>
        <ul className={styles.list}>
          {TOP_NOT_DOING.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Section>

      <Section id="top-about" title="このアプリについて">
        <Paragraph color="$color12" lineHeight="$5">
          Devex は個人開発のポートフォリオです。既定の AI(Gemini)は、回数の上限の中で使えます。自分の API キーを登録した AI の利用料は、キーの持ち主の負担になります。ソースコードと開発の記録は GitHub で公開しています。
        </Paragraph>
        <ul className={styles.list}>
          {TOP_REPOSITORIES.map((repository) => (
            <li key={repository.name}>
              <a href={repository.href} className={styles.textLink} target="_blank" rel="noopener noreferrer">
                {repository.name}
              </a>
              {` ── ${repository.description}`}
            </li>
          ))}
        </ul>
        <Text color="$color11" fontSize="$3">
          {`技術: ${TOP_TECH_STACK}`}
        </Text>
      </Section>
    </YStack>
  );
}
