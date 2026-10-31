// 作成：Phase-118-1
"use client";

import { useState } from "react";
import Link from "next/link";
import { GUIDE_BRANCH_FROM, GUIDE_FLOW, GUIDE_PAGES, flowPosition, guideHref, type GuideSlug } from "../guide-flow";
import styles from "./guide.module.css";

// 各ページの上の流れの帯。利用の流れの全段を並べ、今のページの段を強調する(押すとその段へ)。
// スマホ幅では「段 N / 全 M: 名前」の1行にたたみ、押すと全段を開く。
// 流れの外のページ(クライアントの方へ)は、分岐元の段を強調する。
export function GuideFlowBand({ current }: { current: GuideSlug }) {
  const [open, setOpen] = useState(false);
  const position = flowPosition(current);
  const branchFrom = GUIDE_BRANCH_FROM[current];
  const summary = position
    ? `段 ${position.index} / 全 ${position.total}: ${GUIDE_PAGES[GUIDE_FLOW[position.index - 1]].short}`
    : GUIDE_PAGES[current].short;

  return (
    <nav aria-label="使い方の流れ" className={styles.band} data-open={open}>
      <button
        type="button"
        className={styles.bandToggle}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span>{summary}</span>
        <span aria-hidden>{open ? "▲" : "▼"}</span>
      </button>
      <ol className={styles.bandList}>
        {GUIDE_FLOW.map((slug, index) => (
          <li key={slug} className={styles.bandItem}>
            <Link
              href={guideHref(slug)}
              aria-current={slug === current ? "page" : undefined}
              data-branch={slug === branchFrom ? "true" : undefined}
            >
              <span className={styles.bandNumber}>{index + 1}</span>
              {GUIDE_PAGES[slug].short}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
