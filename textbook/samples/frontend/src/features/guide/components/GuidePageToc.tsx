// 作成：Phase-118(完了後の調整3)
"use client";

import { useEffect, useState, type RefObject } from "react";
import styles from "./guide.module.css";

export type TocItem = { id: string; title: string; level: 2 | 3 };

// 本文から目次の項目を集める: 節の見出し(id のある h2)と、手順のまとまり(data-toc-title)。文書の順のまま
export function collectTocItems(root: ParentNode): TocItem[] {
  return Array.from(root.querySelectorAll<HTMLElement>("h2[id], [data-toc-title][id]")).map((element) =>
    element.tagName === "H2"
      ? { id: element.id, title: element.textContent?.trim() ?? "", level: 2 }
      : { id: element.id, title: element.dataset.tocTitle ?? "", level: 3 },
  );
}

// 見ている節: 画面の上端(ヘッダーの下)を越えた最後の見出し。まだどれも越えていなければ最初の見出し
export function currentTocId(items: TocItem[], tops: Record<string, number>, offset: number): string | null {
  let current: string | null = items[0]?.id ?? null;
  for (const item of items) {
    if ((tops[item.id] ?? Infinity) - offset <= 0) current = item.id;
  }
  return current;
}

// ヘッダー(64px)と少しの余白。見出しがこの位置を越えたら、その節を見ているとみなす
const ACTIVE_OFFSET = 96;

// PC 幅の右の余白に置く、このページの目次のカード。スクロールに付いてきて(sticky)、
// 押すとその節へ移り、今見ている節を強調する。スマホ幅では出さない(CSS)。
export function GuidePageToc({ articleRef }: { articleRef: RefObject<HTMLElement | null> }) {
  const [items, setItems] = useState<TocItem[]>([]);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const article = articleRef.current;
    if (!article) return;
    const found = collectTocItems(article);
    setItems(found);

    const update = () => {
      const tops: Record<string, number> = {};
      for (const item of found) {
        const element = document.getElementById(item.id);
        if (element) tops[item.id] = element.getBoundingClientRect().top;
      }
      setActive(currentTocId(found, tops, ACTIVE_OFFSET));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [articleRef]);

  if (items.length === 0) return null;
  return (
    <aside className={styles.pageToc}>
      <nav aria-label="このページの目次" className={styles.pageTocCard}>
        <p className={styles.pageTocTitle}>このページの目次</p>
        <ol className={styles.pageTocList}>
          {items.map((item) => (
            <li key={item.id} data-level={item.level}>
              <a href={`#${item.id}`} aria-current={item.id === active ? "location" : undefined}>
                {item.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </aside>
  );
}
