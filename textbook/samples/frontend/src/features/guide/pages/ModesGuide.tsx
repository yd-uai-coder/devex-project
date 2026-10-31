// 作成：Phase-118(完了後の調整2)
"use client";

import Link from "next/link";
import { H2, H3, Paragraph, Text, YStack } from "tamagui";
import { StyledCard } from "@/components/ui/primitives/StyledCard";
import { GuideModeBranch } from "../components/GuideModeBranch";
import { GuidePageLayout } from "../components/GuidePageLayout";
import styles from "../components/guide.module.css";
import {
  DETAILED_ONLY_FEATURES,
  GUIDE_DOCUMENTS,
  MODE_NAMES,
  MODE_QUESTIONS,
  type GuideDocument,
} from "../documents";
import { GUIDE_PAGES, guideHref } from "../guide-flow";

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <YStack gap="$3" render="section" aria-labelledby={id}>
      <H2 id={id} fontSize="$7">
        {title}
      </H2>
      {children}
    </YStack>
  );
}

// 一覧表の1つのモードのセル(作らないモードは「─」)
function MadeCell({ made }: { made: string | null }) {
  return made ? (
    <td>
      <span aria-label="作る">○</span> {made}
    </td>
  ) : (
    <td className={styles.mark}>
      <span aria-label="作らない">─</span>
    </td>
  );
}

function DocumentCard({ document }: { document: GuideDocument }) {
  return (
    <StyledCard gap="$2" aria-label={document.name}>
      <H3 fontSize="$6">{document.name}</H3>
      <Text color="$color11">{document.purpose}</Text>
      <ul className={styles.list}>
        {document.contents.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <Paragraph color="$color12" lineHeight="$5">
        {document.use}
      </Paragraph>
      <Text color="$color11" fontSize="$3">{`形式: ${document.format}`}</Text>
      <Text fontSize="$3">
        <Link href={guideHref(document.guide)} className={styles.textLink}>
          {`使い方: ${GUIDE_PAGES[document.guide].title} →`}
        </Link>
      </Text>
    </StyledCard>
  );
}

// 使い方: 2つのモードと作る文書(分岐図・文書の一覧・文書の説明・詳細だけの機能・選び方)
export function ModesGuide() {
  return (
    <GuidePageLayout
      slug="modes"
      intro="Devex には「簡易ドキュメントモード」と「詳細設計モード」があり、プロジェクトを作るときに選びます(後から変えられません)。どちらもヒアリングから始まり、要件定義書と外部設計書までは同じです。その後、残りの設計を一括で作るか、段階ごとに承認しながら作るかが分かれます。このページでは、どちらでも作る文書・片方だけの文書と、その中身を説明します。"
      scenes={[]}
      prerequisites={[]}
      procedures={[]}
      screens={[]}
      tips={[]}
    >
      <Section id="guide-branch" title="分かれ目">
        <GuideModeBranch />
      </Section>

      <Section id="guide-documents-table" title="作る文書の一覧">
        <div className={styles.tableWrap}>
          <table className={styles.table} aria-label="モードごとに作る文書">
            <thead>
              <tr>
                <th scope="col">文書</th>
                <th scope="col">{MODE_NAMES.simple}</th>
                <th scope="col">{MODE_NAMES.detailed}</th>
              </tr>
            </thead>
            <tbody>
              {GUIDE_DOCUMENTS.map((document) => (
                <tr key={document.id}>
                  <th scope="row">
                    <a href={`#doc-${document.id}`} className={styles.textLink}>
                      {document.name}
                    </a>
                  </th>
                  <MadeCell made={document.made.simple} />
                  <MadeCell made={document.made.detailed} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="guide-documents" title="文書の説明">
        <div className={styles.cards}>
          {GUIDE_DOCUMENTS.map((document) => (
            <div key={document.id} id={`doc-${document.id}`}>
              <DocumentCard document={document} />
            </div>
          ))}
        </div>
      </Section>

      <Section id="guide-detailed-only" title="詳細設計モードだけで使える機能">
        <ul className={styles.list}>
          {DETAILED_ONLY_FEATURES.map((feature) => (
            <li key={feature.name}>
              {feature.name}(
              <Link href={guideHref(feature.guide)} className={styles.textLink}>
                {GUIDE_PAGES[feature.guide].title}
              </Link>
              )
            </li>
          ))}
        </ul>
      </Section>

      <Section id="guide-choose" title="どちらを選ぶか">
        <div className={styles.tableWrap}>
          <table className={styles.table} aria-label="モードの選び方">
            <thead>
              <tr>
                <th scope="col">こんなとき</th>
                <th scope="col">おすすめ</th>
              </tr>
            </thead>
            <tbody>
              {MODE_QUESTIONS.map((item) => (
                <tr key={item.question}>
                  <td>{item.question}</td>
                  <td>{MODE_NAMES[item.mode]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className={styles.list}>
          <li>モードはプロジェクトの作成後に変えられません。迷ったら、同じ内容で両方のプロジェクトを作って比べてもかまいません。</li>
          <li>簡易ドキュメントモードでも、テスト仕様書・実装手順書・設計レビュー・変更の影響は使えます。</li>
          <li>クライアントとの合意と変更の記録が要るなら、詳細設計モードを選びます。</li>
        </ul>
      </Section>
    </GuidePageLayout>
  );
}
