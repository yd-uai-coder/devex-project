// 作成：Phase-118-1｜更新：Phase-118(完了後の調整3)
"use client";

// Phase-118(完了後の調整3):追記 ── react.useRef, ./GuidePageToc.GuidePageToc
import { useRef, type ReactNode } from "react";
import Image from "next/image";
import { H1, H2, H3, Paragraph, YStack } from "tamagui";
import { GUIDE_PAGES, type GuideSlug } from "../guide-flow";
import { GuideFlowBand } from "./GuideFlowBand";
import { GuidePageToc } from "./GuidePageToc";
import { GuidePager } from "./GuidePager";
import styles from "./guide.module.css";

// 手順のまとまり。id はページ内の目次のアンカー
export type GuideProcedure = { id: string; title: string; steps: ReactNode[]; note?: ReactNode };

// 画面の見方のスクリーンショット(public/guide/ に置く。既定は 1280×800 で撮る)
export type GuideScreen = {
  src: string;
  alt: string;
  caption: string;
  notes?: ReactNode[];
  width?: number;
  height?: number;
};

export type GuidePageLayoutProps = {
  slug: GuideSlug;
  // この機能でできること(2〜3文)
  intro: ReactNode;
  scenes: ReactNode[];
  prerequisites: ReactNode[];
  procedures: GuideProcedure[];
  screens: GuideScreen[];
  tips: ReactNode[];
  // 共通の型に収まらない補足(用語の表など)。コツ・注意の後に置く
  children?: ReactNode;
};

// 手順のまとまりがこの数以上なら、手順の頭にページ内の目次を出す
const TOC_MIN_PROCEDURES = 3;

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <YStack gap="$3" render="section" aria-labelledby={id}>
      <H2 id={id} fontSize="$7">
        {title}
      </H2>
      {children}
    </YStack>
  );
}

function BulletList({ items }: { items: ReactNode[] }) {
  return (
    <ul className={styles.list}>
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

// 使い方のページの共通の型: 流れの帯 → できること → 使う場面 → 前提 → 手順 → 画面の見方 → コツ・注意 → 次に読む。
// 読み手が迷わないよう、どのページも同じ順に並べる(空の節は出さない)。
export function GuidePageLayout({
  slug,
  intro,
  scenes,
  prerequisites,
  procedures,
  screens,
  tips,
  children,
}: GuidePageLayoutProps) {
  const page = GUIDE_PAGES[slug];
  // Phase-118(完了後の調整3):追記
  const articleRef = useRef<HTMLElement>(null);

  return (
    <YStack gap="$5" paddingVertical="$4">
      <GuideFlowBand current={slug} />
      {/* Phase-118(完了後の調整3)：更新 */}
      {/* <article className={styles.article}> */}
      {/*   <YStack gap="$3"> */}
      {/*     <H1 fontSize="$9">{page.title}</H1> */}
      {/*     <Paragraph color="$color12" lineHeight="$6"> */}
      {/*       {intro} */}
      {/*     </Paragraph> */}
      {/*   </YStack> */}
      {/* ↓↓ */}
      {/* PC 幅は本文の右にこのページの目次を置く(スマホ幅は本文だけ) */}
      <div className={styles.pageLayout}>
        <article ref={articleRef} className={styles.article}>
          <YStack gap="$3">
            <H1 fontSize="$9">{page.title}</H1>
            <Paragraph color="$color12" lineHeight="$6">
              {intro}
            </Paragraph>
          </YStack>

          {/* Phase-118(完了後の調整3)：更新 */}
          {/* {scenes.length > 0 ? ( */}
          {/* <Section id="guide-scenes" title="使う場面"> */}
          {/*   <BulletList items={scenes} /> */}
          {/* </Section> */}
          {/* ) : null} */}
          {/* ↓↓ */}
          {scenes.length > 0 ? (
            <Section id="guide-scenes" title="使う場面">
              <BulletList items={scenes} />
            </Section>
          ) : null}

          {/* Phase-118(完了後の調整3)：更新 */}
          {/* {prerequisites.length > 0 ? ( */}
          {/* <Section id="guide-prerequisites" title="前提"> */}
          {/*   <BulletList items={prerequisites} /> */}
          {/* </Section> */}
          {/* ) : null} */}
          {/* ↓↓ */}
          {prerequisites.length > 0 ? (
            <Section id="guide-prerequisites" title="前提">
              <BulletList items={prerequisites} />
            </Section>
          ) : null}

          {/* Phase-118(完了後の調整3)：更新 */}
          {/* {procedures.length > 0 ? ( */}
          {/* <Section id="guide-procedures" title="手順"> */}
          {/*   {procedures.length >= TOC_MIN_PROCEDURES ? ( */}
          {/*     <nav aria-label="手順の目次"> */}
          {/*       <ol className={styles.toc}> */}
          {/*         {procedures.map((procedure) => ( */}
          {/*           <li key={procedure.id}> */}
          {/*             <a href={`#${procedure.id}`}>{procedure.title}</a> */}
          {/*           </li> */}
          {/*         ))} */}
          {/*       </ol> */}
          {/*     </nav> */}
          {/*   ) : null} */}
          {/*   {procedures.map((procedure) => ( */}
          {/*     <YStack key={procedure.id} gap="$2" id={procedure.id}> */}
          {/*       <H3 fontSize="$6">{procedure.title}</H3> */}
          {/*       <ol className={styles.list}> */}
          {/*         {procedure.steps.map((step, index) => ( */}
          {/*           <li key={index}>{step}</li> */}
          {/*         ))} */}
          {/*       </ol> */}
          {/*       {procedure.note ? <Paragraph color="$color11">{procedure.note}</Paragraph> : null} */}
          {/*     </YStack> */}
          {/*   ))} */}
          {/* </Section> */}
          {/* ) : null} */}
          {/* ↓↓ */}
          {procedures.length > 0 ? (
            <Section id="guide-procedures" title="手順">
              {procedures.length >= TOC_MIN_PROCEDURES ? (
                <nav aria-label="手順の目次" className={styles.inlineToc}>
                  <ol className={styles.toc}>
                    {procedures.map((procedure) => (
                      <li key={procedure.id}>
                        <a href={`#${procedure.id}`}>{procedure.title}</a>
                      </li>
                    ))}
                  </ol>
                </nav>
              ) : null}
              {procedures.map((procedure) => (
                <YStack key={procedure.id} gap="$2" id={procedure.id} data-toc-title={procedure.title}>
                  <H3 fontSize="$6">{procedure.title}</H3>
                  <ol className={styles.list}>
                    {procedure.steps.map((step, index) => (
                      <li key={index}>{step}</li>
                    ))}
                  </ol>
                  {procedure.note ? <Paragraph color="$color11">{procedure.note}</Paragraph> : null}
                </YStack>
              ))}
            </Section>
          ) : null}

          {/* Phase-118(完了後の調整3)：更新 */}
          {/* {screens.length > 0 ? ( */}
          {/* <Section id="guide-screens" title="画面の見方"> */}
          {/*   {screens.map((screen) => ( */}
          {/*     <figure key={screen.src} className={styles.figure}> */}
          {/*       <Image */}
          {/*         src={screen.src} */}
          {/*         alt={screen.alt} */}
          {/*         width={screen.width ?? 1280} */}
          {/*         height={screen.height ?? 800} */}
          {/*         sizes="(min-width: 960px) 880px, 100vw" */}
          {/*       /> */}
          {/*       <figcaption className={styles.figcaption}>{screen.caption}</figcaption> */}
          {/*       {screen.notes ? <BulletList items={screen.notes} /> : null} */}
          {/*     </figure> */}
          {/*   ))} */}
          {/* </Section> */}
          {/* ) : null} */}
          {/* ↓↓ */}
          {screens.length > 0 ? (
            <Section id="guide-screens" title="画面の見方">
              <div className={styles.screens}>
                {screens.map((screen) => (
                  // 説明を先に読み、その画面を下で見る。画面ごとに区切って、説明と画像の組を分かりやすくする
                  <figure key={screen.src} className={styles.figure}>
                    <figcaption className={styles.figcaption}>{screen.caption}</figcaption>
                    {screen.notes ? <BulletList items={screen.notes} /> : null}
                    <Image
                      src={screen.src}
                      alt={screen.alt}
                      width={screen.width ?? 1280}
                      height={screen.height ?? 800}
                      sizes="(min-width: 960px) 880px, 100vw"
                    />
                  </figure>
                ))}
              </div>
            </Section>
          ) : null}

          {/* Phase-118(完了後の調整3)：更新 */}
          {/* {tips.length > 0 ? ( */}
          {/* <Section id="guide-tips" title="うまく使うコツ・注意"> */}
          {/*   <BulletList items={tips} /> */}
          {/* </Section> */}
          {/* ) : null} */}
          {/* ↓↓ */}
          {tips.length > 0 ? (
            <Section id="guide-tips" title="うまく使うコツ・注意">
              <BulletList items={tips} />
            </Section>
          ) : null}

          {/* Phase-118(完了後の調整3)：更新 */}
          {/* {children} */}
          {/* ↓↓ */}
          {children}

          {/* Phase-118(完了後の調整3)：更新 */}
          {/* <GuidePager current={slug} /> */}
          {/* </article> */}
          {/* ↓↓ */}
          <GuidePager current={slug} />
        </article>
        <GuidePageToc articleRef={articleRef} />
      </div>
    </YStack>
  );
}
