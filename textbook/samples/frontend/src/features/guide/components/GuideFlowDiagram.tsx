// 作成：Phase-118-1
"use client";

import Link from "next/link";
import { PRODUCT_FLOW, guideHref } from "../guide-flow";
import styles from "./guide.module.css";

// Devex の全体の流れ図(ヒアリング → … → 反映・再検証)。TOP と GUIDE の目次で共有する。
// 各段は、その段の使い方のページへのリンク。
export function GuideFlowDiagram() {
  return (
    <ol className={styles.flow} aria-label="Devex の全体の流れ">
      {PRODUCT_FLOW.map((step) => (
        <li key={step.label} className={styles.flowStep}>
          <Link href={guideHref(step.slug)}>
            <span className={styles.flowLabel}>{step.label}</span>
            <span className={styles.flowCaption}>{step.caption}</span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
