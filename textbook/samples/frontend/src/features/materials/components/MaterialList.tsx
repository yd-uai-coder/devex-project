// 作成：Phase-116-2
"use client";

import Link from "next/link";
import { Text } from "tamagui";
import { CELL, HEAD, LINK, TABLE } from "@/features/detailed-design/components/tableStyles";
import type { MaterialSummaryRead } from "@/features/materials/api/types";
import { MATERIAL_KIND_LABEL, MATERIAL_SOURCE_LABEL, materialHref } from "@/features/materials/materialOps";

// 資料の一覧(足した順の新しい方から。サーバーの並びのまま)。題から資料のページ(本文・違いの一覧)へ移る
export function MaterialList({ projectId, items }: { projectId: string; items: MaterialSummaryRead[] }) {
  if (items.length === 0) {
    return <Text color="$color11">資料はまだありません。</Text>;
  }
  return (
    <table style={TABLE} aria-label="資料の一覧">
      <thead>
        <tr>
          <th style={HEAD}>題</th>
          <th style={HEAD}>種類</th>
          <th style={HEAD}>日付</th>
          <th style={HEAD}>本文</th>
          <th style={HEAD}>足した日時</th>
        </tr>
      </thead>
      <tbody>
        {items.map((material) => (
          <tr key={material.id}>
            <td style={CELL}>
              <Link href={materialHref(projectId, material.id)} style={LINK}>
                {material.title}
              </Link>
            </td>
            <td style={{ ...CELL, whiteSpace: "nowrap" }}>{MATERIAL_KIND_LABEL[material.kind]}</td>
            <td style={{ ...CELL, whiteSpace: "nowrap" }}>{material.material_date}</td>
            <td style={CELL}>
              {material.filename
                ? `${MATERIAL_SOURCE_LABEL[material.source]}(${material.filename})`
                : MATERIAL_SOURCE_LABEL[material.source]}
              {`・${material.length}文字`}
            </td>
            <td style={{ ...CELL, whiteSpace: "nowrap" }}>{new Date(material.created_at).toLocaleString("ja-JP")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
