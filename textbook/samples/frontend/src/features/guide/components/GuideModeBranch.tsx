// 作成：Phase-118(完了後の調整2)
"use client";

import { MODE_NAMES, documentsAt, type GuideDocument, type ModeKey } from "../documents";
import styles from "./guide.module.css";

function names(documents: GuideDocument[]): string {
  return documents.map((document) => document.name).join("・");
}

const LANE_NOTE: Record<ModeKey, string> = {
  simple: "ヒアリングの後に一括で生成します。",
  detailed: "段階1〜7 を、AI の下書きを確かめて承認しながら組み立てます。",
};

// 2つのモードの分岐図。ヒアリング → 共通の文書 → モードごとの文書 → 共通の文書 →(詳細だけ)合意と変更管理。
// 置く文書は documents.ts の step から決める(文書を足しても図を直さなくてよいように)。
export function GuideModeBranch() {
  return (
    <figure className={styles.branch} aria-label="2つのモードの分かれ目">
      <div className={styles.branchNode}>
        <span className={styles.branchLabel}>どちらも同じ</span>
        <div className={styles.branchDocs}>ヒアリング</div>
        <span className={styles.branchNote}>AI の質問に答えて要件を固めます。</span>
      </div>
      <div className={styles.branchNode} data-kind="common">
        <span className={styles.branchLabel}>共通</span>
        <div className={styles.branchDocs}>{names(documentsAt("before"))}</div>
      </div>
      <div className={styles.branchLanes}>
        {(["simple", "detailed"] as ModeKey[]).map((mode) => (
          <div
            key={mode}
            className={styles.branchNode}
            data-kind={mode === "simple" ? "simple" : "lane-detailed"}
            aria-label={MODE_NAMES[mode]}
          >
            <span className={styles.branchLabel}>{MODE_NAMES[mode]}</span>
            <div className={styles.branchDocs}>{names(documentsAt("branch", mode))}</div>
            <span className={styles.branchNote}>{LANE_NOTE[mode]}</span>
          </div>
        ))}
      </div>
      <div className={styles.branchNode} data-kind="common">
        <span className={styles.branchLabel}>共通(作り方はモードで違う)</span>
        <div className={styles.branchDocs}>{names(documentsAt("after"))}</div>
      </div>
      <div className={styles.branchNode} data-kind="detailed">
        <span className={styles.branchLabel}>詳細設計モードだけ ── 合意と変更管理</span>
        <div className={styles.branchDocs}>{names(documentsAt("change"))}</div>
        <span className={styles.branchNote}>合意済みの版を作り、仕様の変更を変更要求(CR)で説明・合意・反映します。</span>
      </div>
    </figure>
  );
}
