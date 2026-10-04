// 作成：Phase-23-6
// 写経レベル: コア ── 入力中の文字列を手元に持ち、配列に直した値だけを返す(段階4から切り出し)。
"use client";

import { useState, type CSSProperties } from "react";
import { listToText, textToList } from "@/features/detailed-design/moduleListOps";

// 「,」区切りの入力欄。入力中の文字列(末尾の「, 」など)は手元に持ち、配列に直した値だけを返す。
// 配列から作り直すと、区切りの「,」を打った瞬間に消えて次の項目を書けないため。外から値が変わった
// (行の削除など)ときは、手元の文字列を作り直す。段階4のモジュール一覧(Phase 19)から切り出し、
// 段階7の横断事項・マイルストーン・タスクの表でも使う(Phase 23)。
export function ListInput({
  label,
  items,
  disabled,
  style,
  onChange,
}: {
  label: string;
  items: string[];
  disabled: boolean;
  style: CSSProperties;
  onChange: (items: string[]) => void;
}) {
  const [text, setText] = useState(() => listToText(items));
  const parsed = textToList(text);
  const current =
    parsed.length === items.length && parsed.every((item, i) => item === items[i])
      ? text
      : listToText(items);

  return (
    <input
      style={style}
      aria-label={label}
      value={current}
      disabled={disabled}
      onChange={(e) => {
        setText(e.target.value);
        onChange(textToList(e.target.value));
      }}
    />
  );
}
