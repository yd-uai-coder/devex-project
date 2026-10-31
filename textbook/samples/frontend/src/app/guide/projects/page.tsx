// 作成：Phase-118-4
import type { Metadata } from "next";
import { GUIDE_PAGES } from "@/features/guide/guide-flow";
import { ProjectsGuide } from "@/features/guide/pages/ProjectsGuide";

// 使い方ガイド: プロジェクト(ログインは要らない)
export const metadata: Metadata = {
  title: `${GUIDE_PAGES["projects"].title} | 使い方ガイド | Devex`,
  description: GUIDE_PAGES["projects"].summary,
};

export default function ProjectsGuidePage() {
  return <ProjectsGuide />;
}
