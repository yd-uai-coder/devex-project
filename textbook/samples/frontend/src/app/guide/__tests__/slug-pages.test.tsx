// 作成：Phase-118-4｜更新：Phase-118-5,118(完了後の調整2)
// Phase-118-5:追記 ── ../agreement/page.AgreementGuidePage, ../agreement/page.metadata, ../for-clients/page.ForClientsGuidePage, ../for-clients/page.metadata, ../glossary/page.GlossaryGuidePage, ../glossary/page.metadata, ../implementation/page.ImplementationGuidePage, ../implementation/page.metadata, ../materials/page.MaterialsGuidePage, ../materials/page.metadata, ../review/page.ReviewGuidePage, ../review/page.metadata
// Phase-118(完了後の調整2):追記 ── ../modes/page.ModesGuidePage, ../modes/page.metadata
import type { Metadata } from "next";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { GUIDE_PAGES, type GuideSlug } from "@/features/guide/guide-flow";
import AgreementGuidePage, { metadata as agreement } from "../agreement/page";
import DetailedDesignGuidePage, { metadata as detailedDesign } from "../detailed-design/page";
import DocumentsGuidePage, { metadata as documents } from "../documents/page";
import ForClientsGuidePage, { metadata as forClients } from "../for-clients/page";
import GettingStartedGuidePage, { metadata as gettingStarted } from "../getting-started/page";
import GlossaryGuidePage, { metadata as glossary } from "../glossary/page";
import HearingGuidePage, { metadata as hearing } from "../hearing/page";
import ImplementationGuidePage, { metadata as implementation } from "../implementation/page";
import MaterialsGuidePage, { metadata as materials } from "../materials/page";
import ModesGuidePage, { metadata as modes } from "../modes/page";
import ProjectsGuidePage, { metadata as projects } from "../projects/page";
import ReviewGuidePage, { metadata as review } from "../review/page";

vi.mock("@/features/guide/pages/GettingStartedGuide", () => ({ GettingStartedGuide: () => <div>guide getting-started</div> }));
// Phase-118(完了後の調整2):追記
vi.mock("@/features/guide/pages/ModesGuide", () => ({ ModesGuide: () => <div>guide modes</div> }));
vi.mock("@/features/guide/pages/ProjectsGuide", () => ({ ProjectsGuide: () => <div>guide projects</div> }));
vi.mock("@/features/guide/pages/HearingGuide", () => ({ HearingGuide: () => <div>guide hearing</div> }));
vi.mock("@/features/guide/pages/DocumentsGuide", () => ({ DocumentsGuide: () => <div>guide documents</div> }));
vi.mock("@/features/guide/pages/DetailedDesignGuide", () => ({ DetailedDesignGuide: () => <div>guide detailed-design</div> }));
// Phase-118-5:追記
vi.mock("@/features/guide/pages/ImplementationGuide", () => ({ ImplementationGuide: () => <div>guide implementation</div> }));
vi.mock("@/features/guide/pages/ReviewGuide", () => ({ ReviewGuide: () => <div>guide review</div> }));
vi.mock("@/features/guide/pages/AgreementGuide", () => ({ AgreementGuide: () => <div>guide agreement</div> }));
vi.mock("@/features/guide/pages/MaterialsGuide", () => ({ MaterialsGuide: () => <div>guide materials</div> }));
vi.mock("@/features/guide/pages/ForClientsGuide", () => ({ ForClientsGuide: () => <div>guide for-clients</div> }));
vi.mock("@/features/guide/pages/GlossaryGuide", () => ({ GlossaryGuide: () => <div>guide glossary</div> }));

const ROUTES: [GuideSlug, () => React.ReactElement, Metadata][] = [
  ["getting-started", GettingStartedGuidePage, gettingStarted],
  // Phase-118(完了後の調整2):追記
  ["modes", ModesGuidePage, modes],
  ["projects", ProjectsGuidePage, projects],
  ["hearing", HearingGuidePage, hearing],
  ["documents", DocumentsGuidePage, documents],
  ["detailed-design", DetailedDesignGuidePage, detailedDesign],
  // Phase-118-5:追記
  ["implementation", ImplementationGuidePage, implementation],
  ["review", ReviewGuidePage, review],
  ["agreement", AgreementGuidePage, agreement],
  ["materials", MaterialsGuidePage, materials],
  ["for-clients", ForClientsGuidePage, forClients],
  ["glossary", GlossaryGuidePage, glossary],
];

describe("使い方ガイドの各ページ(ルート)", () => {
  // Phase-118-5:追記
  it("ページの定義のすべての slug にルートがある(リンク切れの番人)", () => {
    expect(ROUTES.map(([slug]) => slug).sort()).toEqual((Object.keys(GUIDE_PAGES) as GuideSlug[]).sort());
  });

  it.each(ROUTES)("%s: ログインを求めずに本文を出し、題と説明はページの定義から", (slug, Page, metadata) => {
    render(<Page />);

    expect(screen.getByText(`guide ${slug}`)).toBeInTheDocument();
    expect(metadata.title).toBe(`${GUIDE_PAGES[slug].title} | 使い方ガイド | Devex`);
    expect(metadata.description).toBe(GUIDE_PAGES[slug].summary);
  });
});
