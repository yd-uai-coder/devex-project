// 作成：Phase-118-1
"use client";

import Link from "next/link";
import { H2, Text, YStack } from "tamagui";
import { GUIDE_INDEX_HREF, GUIDE_PAGES, guideHref, prevNext, type GuideSlug } from "../guide-flow";
import styles from "./guide.module.css";

// 各ページの下の「次に読む」。流れの順の前へ / 次へと、関係の深いページ・目次へのリンク
export function GuidePager({ current }: { current: GuideSlug }) {
  const { prev, next } = prevNext(current);
  const related = GUIDE_PAGES[current].related.map((slug) => GUIDE_PAGES[slug]);

  return (
    <YStack gap="$3" render="section" aria-labelledby="guide-next">
      <H2 id="guide-next" fontSize="$7">
        次に読む
      </H2>
      <div className={styles.pager}>
        {prev ? (
          <Link href={guideHref(prev.slug)} className={styles.pagerLink} rel="prev">
            <span className={styles.pagerHint}>← 前へ</span>
            <span>{prev.title}</span>
          </Link>
        ) : null}
        {next ? (
          <Link href={guideHref(next.slug)} className={`${styles.pagerLink} ${styles.pagerNext}`} rel="next">
            <span className={styles.pagerHint}>次へ →</span>
            <span>{next.title}</span>
          </Link>
        ) : null}
      </div>
      {related.length > 0 ? (
        <Text color="$color11">
          あわせて読む:{" "}
          {related.map((page, index) => (
            <span key={page.slug}>
              {index > 0 ? "・" : null}
              <Link href={guideHref(page.slug)} className={styles.textLink}>
                {page.title}
              </Link>
            </span>
          ))}
          {" ／ "}
          <Link href={GUIDE_INDEX_HREF} className={styles.textLink}>
            目次へ戻る
          </Link>
        </Text>
      ) : null}
    </YStack>
  );
}
