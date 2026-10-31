// 作成：Phase-118-4｜更新：Phase-118-5,118(完了後の調整),118(完了後の調整2),118(完了後の調整3)
// Phase-118-5:追記 ── ../AgreementGuide.AgreementGuide, ../ForClientsGuide.ForClientsGuide, ../GlossaryGuide.FAQ, ../GlossaryGuide.GLOSSARY, ../GlossaryGuide.GlossaryGuide, ../ImplementationGuide.ImplementationGuide, ../MaterialsGuide.MaterialsGuide, ../ReviewGuide.ReviewGuide
// Phase-118(完了後の調整2):追記 ── @testing-library/react.within, ../../documents.GUIDE_DOCUMENTS, ../ModesGuide.ModesGuide
import type { ComponentType } from "react";
import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import { GUIDE_DOCUMENTS } from "../../documents";
import { GUIDE_PAGES, type GuideSlug } from "../../guide-flow";
import { renderGuide } from "../../test-utils/renderGuide";
import { AgreementGuide } from "../AgreementGuide";
import { DetailedDesignGuide } from "../DetailedDesignGuide";
import { DocumentsGuide } from "../DocumentsGuide";
import { ForClientsGuide } from "../ForClientsGuide";
import { GettingStartedGuide } from "../GettingStartedGuide";
import { FAQ, GLOSSARY, GlossaryGuide } from "../GlossaryGuide";
import { HearingGuide } from "../HearingGuide";
import { ImplementationGuide } from "../ImplementationGuide";
import { MaterialsGuide } from "../MaterialsGuide";
import { ModesGuide } from "../ModesGuide";
import { ProjectsGuide } from "../ProjectsGuide";
import { ReviewGuide } from "../ReviewGuide";
import { guideScreen } from "../screens";

// ページごとに: 本文の部品・最初の画像の代替テキスト・手順の見出しの1つ
const PAGES: [GuideSlug, ComponentType, string, string][] = [
  ["getting-started", GettingStartedGuide, "ユーザー登録の画面", "登録してログインする"],
  ["projects", ProjectsGuide, "ダッシュボードの画面", "プロジェクトを作る"],
  ["hearing", HearingGuide, "ヒアリングのチャットと観点の表", "完了して設計書を生成する"],
  ["documents", DocumentsGuide, "ドキュメントプレビューの画面", "前の版に戻す"],
  ["detailed-design", DetailedDesignGuide, "段階1 機能一覧の画面", "図を直して出力する"],
  // Phase-118-5:追記
  ["implementation", ImplementationGuide, "簡易ドキュメントモードの実装手順書", "指摘を読んで設計へ戻す"],
  // Phase-118(完了後の調整)：更新
  // ["review", ReviewGuide, "変更の影響のパネル", "採用した指摘を直す"],
  // ↓↓
  ["review", ReviewGuide, "AI 設計レビューの指摘の一覧", "採用した指摘を直す"],
  ["agreement", AgreementGuide, "合意済みの版 B-1 の画面", "設計へ反映する"],
  ["materials", MaterialsGuide, "資料の違いの一覧", "CR の下書きにする"],
];

describe("使い方のページ", () => {
  it.each(PAGES)("%s: 共通の型で出し、流れの帯で今の段を示し、画像は public/guide を指す", (slug, Page, alt, procedure) => {
    renderGuide(<Page />);

    expect(screen.getByRole("heading", { level: 1, name: GUIDE_PAGES[slug].title })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: procedure })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "次に読む" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: alt }).getAttribute("src")).toContain("guide");
    const current = screen.getByRole("navigation", { name: "使い方の流れ" }).querySelector('[aria-current="page"]');
    expect(current).toHaveAttribute("href", `/guide/${slug}`);
  });
});

// Phase-118-5:追記
describe("手順の多いページ・流れの外のページ", () => {
  it("合意と変更管理は、手順のページ内の目次を出す", () => {
    renderGuide(<AgreementGuide />);

    expect(screen.getByRole("navigation", { name: "手順の目次" })).toBeInTheDocument();
    // Phase-118(完了後の調整3)：更新
    // expect(screen.getByRole("link", { name: "変更要求(CR)を作る" })).toHaveAttribute("href", "#create-cr");
    // ↓↓
    const inline = screen.getByRole("navigation", { name: "手順の目次" });
    expect(within(inline).getByRole("link", { name: "変更要求(CR)を作る" })).toHaveAttribute("href", "#create-cr");
  });

  it("クライアントの方へは、合意と変更管理の段を印にし、スマホ幅の画像を持つ", () => {
    renderGuide(<ForClientsGuide />);

    expect(screen.getByRole("heading", { level: 1, name: "クライアントの方へ" })).toBeInTheDocument();
    const band = screen.getByRole("navigation", { name: "使い方の流れ" });
    expect(band.querySelector('[data-branch="true"]')).toHaveAttribute("href", "/guide/agreement");
    expect(screen.getByRole("img", { name: "スマートフォンで開いた共有リンク" })).toHaveAttribute("width", "390");
    expect(screen.getByRole("link", { name: /^← 前へ/ })).toHaveAttribute("href", "/guide/agreement");
  });

  it("用語集は、用語の表とよくある質問を出し、共通の型の空の節は出さない", () => {
    renderGuide(<GlossaryGuide />);

    expect(screen.getAllByRole("row")).toHaveLength(GLOSSARY.length + 1);
    expect(screen.getByRole("rowheader", { name: "変更要求(CR)" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(FAQ.length);
    expect(screen.queryByRole("heading", { name: "手順" })).toBeNull();
  });
});

// Phase-118(完了後の調整2):追記
describe("2つのモードと作る文書", () => {
  it("分岐図・文書の一覧・文書の説明・選び方を出し、表の文書から説明へ移れる", () => {
    renderGuide(<ModesGuide />);

    expect(screen.getByRole("heading", { level: 1, name: "2つのモードと作る文書" })).toBeInTheDocument();
    expect(screen.getByRole("figure", { name: "2つのモードの分かれ目" })).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "モードごとに作る文書" });
    expect(within(table).getAllByRole("row")).toHaveLength(GUIDE_DOCUMENTS.length + 1);
    expect(within(table).getByRole("link", { name: "詳細設計書" })).toHaveAttribute("href", "#doc-detailed_design");
    expect(document.getElementById("doc-detailed_design")).not.toBeNull();
    expect(screen.getByRole("heading", { level: 2, name: "どちらを選ぶか" })).toBeInTheDocument();
    const current = screen.getByRole("navigation", { name: "使い方の流れ" }).querySelector('[aria-current="page"]');
    expect(current).toHaveAttribute("href", "/guide/modes");
  });
});

describe("guideScreen", () => {
  it("名前から public/guide の WebP を指し、大きさは渡したときだけ持つ", () => {
    expect(guideScreen("dashboard", "代替", "説明")).toEqual({
      src: "/guide/dashboard.webp",
      alt: "代替",
      caption: "説明",
      notes: undefined,
    });
    expect(guideScreen("share-mobile", "a", "c", undefined, { width: 390, height: 844 })).toMatchObject({
      width: 390,
      height: 844,
    });
  });
});
