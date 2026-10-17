// 作成：Phase-15-7｜更新：Phase-16-6,18-9,22-6,23-6,27-3,28-3,30-4,30-7,31-5,44-2,46-3,53-4,53-5,53(完了後の調整),54-1,57-3,57(完了後の調整),64-4,69-3
// 写経レベル: 定型
// Phase-16-6:追記 ── ../../test-utils/stageFixtures.makeFunctionList
// Phase-44-2:追記 ── ../../test-utils/stageFixtures.makeImpact
// Phase-46-3:追記 ── ../../test-utils/stageFixtures.makeSimpleImpact, @testing-library/react.within
// Phase-53-4:追記 ── @/features/design-review/review-store.useReviewStore, @/features/design-review/test-utils/reviewFixtures(finding, gate, run, user)
// Phase-53-5:追記 ── @testing-library/react.waitFor, ../../test-utils/stageFixtures.makeLogics
// Phase-57-3:追記 ── @testing-library/react.act, @/features/documents/test-spec-store.useTestSpecStore, @/features/documents/test-utils/testSpecFixtures.makeTestSpec
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { DetailedDesignPageContent } from "../DetailedDesignPageContent";
import { useDetailedDesignStore } from "@/features/detailed-design/detailed-design-store";
import { useReviewStore } from "@/features/design-review/review-store";
import { useTestSpecStore } from "@/features/documents/test-spec-store";
import { makeTestSpec } from "@/features/documents/test-utils/testSpecFixtures";
import { finding, gate, run, user as reviewUser } from "@/features/design-review/test-utils/reviewFixtures";
// Phase-28-3：更新
// import { makeFunctionList, makeStages } from "../../test-utils/stageFixtures";
// ↓↓
// Phase-64-4:追記
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";
import {
  makeFunctionList,
  makeImpact,
  makeLogics,
  makePlan,
  makeProcedureDoc,
  makeSimpleImpact,
  makeStages,
} from "../../test-utils/stageFixtures";

// Phase-64-4:追記
// 削除した後の遷移(router.push)と、完了の知らせ(toast)を差し替える
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@tamagui/toast", () => ({ useToastController: () => ({ show: vi.fn() }) }));

function renderContent() {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <DetailedDesignPageContent projectId="p1" />
    </TamaguiProvider>,
  );
}

describe("DetailedDesignPageContent", () => {
  beforeEach(() => {
    // Phase-53-4:追記
    // レビューのパネルは API を呼ばない(ユーザーが無ければパネルを出さない)
    useReviewStore.setState({
      me: null,
      gates: [],
      fetchMe: vi.fn().mockResolvedValue(undefined),
      fetchGates: vi.fn().mockResolvedValue(undefined),
      runReview: vi.fn().mockResolvedValue(true),
    });
    useDetailedDesignStore.setState({
      projectId: "p1",
      // Phase-16-6：更新
      // stages: makeStages({ 1: { state: "reviewing", version: 1 } }),
      // ↓↓
      stages: makeStages({
        1: { state: "reviewing", version: 1, model: makeFunctionList() },
      }),
      selectedStage: 1,
      status: "success",
      error: null,
      actionError: null,
      approving: false,
      fetchStages: vi.fn().mockResolvedValue(undefined),
      selectStage: vi.fn(),
      approve: vi.fn().mockResolvedValue(undefined),
    });
    // Phase-57-3:追記
    useTestSpecStore.setState({
      testSpec: null,
      status: "success",
      generating: false,
      generateError: null,
      // Phase-69-3:追記
      generationFailure: null,
      fetchTestSpec: vi.fn().mockResolvedValue(undefined),
      generate: vi.fn().mockResolvedValue(undefined),
    });
  });

  it("マウント時にfetchStages(projectId)を呼び、ステッパーと選んだ段階を表示する", () => {
    renderContent();

    expect(useDetailedDesignStore.getState().fetchStages).toHaveBeenCalledWith(
      "p1",
    );
    expect(
      screen.getByRole("navigation", { name: "段階" }),
    ).toBeInTheDocument();
    expect(screen.getByText("段階1 機能一覧")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "← ドキュメントに戻る" }),
    ).toHaveAttribute("href", "/projects/p1/documents");
  // Phase-64-4:追記
  });

  it("「ドキュメントに戻る」の右の「削除」は確認してから削除し、ダッシュボードへ戻る", async () => {
    const user = userEvent.setup();
    const stub = stubFetch();
    push.mockReset();
    renderContent();

    await user.click(screen.getByRole("button", { name: "削除" }));
    // この画面はプロジェクトの名前を読み込まないので「このプロジェクト」と書く
    expect(screen.getByText(/^このプロジェクトと、そのチャット・文書/)).toBeInTheDocument();
    expect(stub.requests).toHaveLength(0);
    await user.click(screen.getByLabelText("削除する"));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
    expect(stub.requests.map((r) => r.init?.method)).toEqual(["DELETE"]);
    stub.restore();
  });

  // Phase-22-6:追記
  it("詳細設計書のダウンロードを上部に出す", () => {
    renderContent();

    expect(
      // Phase-23-6：更新
      // screen.getByRole("button", { name: "詳細設計書をダウンロード(.zip)" }),
      // ↓↓
      // Phase-30-4：更新
      // screen.getByRole("button", { name: "詳細設計書と実装計画をダウンロード(.zip)" }),
      // ↓↓
      // Phase-30-7：更新
      // screen.getByRole("button", { name: "詳細設計書・実装計画・実装手順書をダウンロード(.zip)" }),
      // ↓↓
      screen.getByRole("button", { name: "詳細設計書・実装計画をダウンロード(.zip)" }),
    ).toBeInTheDocument();
    // Phase-23-6：更新
    // expect(screen.getByRole("status")).toHaveTextContent("6 件が未承認");
    // ↓↓
    // Phase-30-4：更新
    // expect(screen.getByRole("status")).toHaveTextContent("7 件が未承認");
    // ↓↓
    // Phase-30-7：更新
    // expect(screen.getByRole("status")).toHaveTextContent("8 件が未承認");
    // ↓↓
    expect(screen.getByRole("button", { name: "実装手順書をダウンロード(.zip)" })).toBeInTheDocument();
    expect(screen.getAllByRole("status")[0]).toHaveTextContent("段階1・2・3・4・5・6・7が未承認です。");
  });

  it("承認ボタンでapprove(projectId, 段階)を呼ぶ", async () => {
    const user = userEvent.setup();
    renderContent();

    await user.click(screen.getByRole("button", { name: "承認する" }));

    expect(useDetailedDesignStore.getState().approve).toHaveBeenCalledWith(
      "p1",
      1,
    );
  });

  it("取得に失敗したらエラーを表示する", () => {
    useDetailedDesignStore.setState({
      status: "error",
      stages: [],
      error: "詳細設計モードではありません",
    });

    renderContent();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "詳細設計モードではありません",
    );
  });

  // Phase-18-9:追記
  // ダイアログ内のボタンは jsdom ではロールのクエリで「隠れている」扱いになるため、aria-label で取る
  it("承認できたら完了のダイアログを出し、「次の段階へ進む」で次の段階を選ぶ", async () => {
    const user = userEvent.setup();
    useDetailedDesignStore.setState({ approve: vi.fn().mockResolvedValue(true) });
    renderContent();

    await user.click(screen.getByRole("button", { name: "承認する" }));

    expect(await screen.findByText("段階1-機能一覧を承認しました。")).toBeInTheDocument();
    expect(screen.getByLabelText("閉じる")).toBeInTheDocument();
    await user.click(screen.getByLabelText("次の段階へ進む"));
    expect(useDetailedDesignStore.getState().selectStage).toHaveBeenCalledWith(2);
  });

  it("承認できなかったときはダイアログを出さない", async () => {
    const user = userEvent.setup();
    renderContent();
    await user.click(screen.getByRole("button", { name: "承認する" }));
    expect(screen.queryByText(/を承認しました。/)).not.toBeInTheDocument();
  });

  // Phase-27-3：更新
  // it("段階7の承認では次の段階が無いので、「閉じる」だけを出す", async () => {
  // ↓↓
  it("段階8の承認では次の段階が無いので、「閉じる」だけを出す", async () => {
    const user = userEvent.setup();
    useDetailedDesignStore.setState({
      stages: makeStages({
        // Phase-27-3：更新
        // 7: { is_open: true, missing_inputs: [], state: "reviewing", version: 1, model: { x: 1 } },
        // ↓↓
        8: { is_open: true, missing_inputs: [], state: "reviewing", version: 1, model: { units: [] } },
      }),
      // Phase-27-3：更新
      // selectedStage: 7,
      // ↓↓
      selectedStage: 8,
      approve: vi.fn().mockResolvedValue(true),
    });
    renderContent();

    await user.click(screen.getByRole("button", { name: "承認する" }));

    // Phase-23-6：更新
    // expect(await screen.findByText("段階7-実装計画を承認しました。")).toBeInTheDocument();
    // ↓↓
    // Phase-27-3：更新
    // expect(await screen.findByText("段階7-横断事項と実装計画を承認しました。")).toBeInTheDocument();
    // ↓↓
    expect(await screen.findByText("段階8-実装手順書を承認しました。")).toBeInTheDocument();
    expect(screen.queryByLabelText("次の段階へ進む")).not.toBeInTheDocument();
    await user.click(screen.getByLabelText("閉じる"));
    expect(useDetailedDesignStore.getState().selectStage).not.toHaveBeenCalled();
  });

  // Phase-28-3:追記
  // 段階8: makeProcedureDoc は最重要の AI の指摘を1件持つ
  function selectStage8(model: Record<string, unknown>) {
    useDetailedDesignStore.setState({
      stages: makeStages({
        7: { state: "approved", model: makePlan() },
        8: { is_open: true, missing_inputs: [], state: "reviewing", version: 1, model },
      }),
      selectedStage: 8,
      approve: vi.fn().mockResolvedValue(false),
    });
  }

  it("段階8で最重要が残っていれば確かめ、「このまま承認する」で承認する", async () => {
    const user = userEvent.setup();
    selectStage8(makeProcedureDoc());
    renderContent();

    await user.click(screen.getByRole("button", { name: "承認する" }));

    expect(
      await screen.findByText(/最重要の未定義・要決定が 1 件残っています/),
    ).toBeInTheDocument();
    expect(useDetailedDesignStore.getState().approve).not.toHaveBeenCalled();
    await user.click(screen.getByLabelText("このまま承認する"));
    expect(useDetailedDesignStore.getState().approve).toHaveBeenCalledWith("p1", 8);
  });

  it("確認を取り消すと承認しない", async () => {
    const user = userEvent.setup();
    selectStage8(makeProcedureDoc());
    renderContent();

    await user.click(screen.getByRole("button", { name: "承認する" }));
    await user.click(await screen.findByLabelText("キャンセル"));

    expect(useDetailedDesignStore.getState().approve).not.toHaveBeenCalled();
  });

  // Phase-31-5:追記
  it("簡易モードは見出しを「実装手順書」にし、段階8だけのステッパーで開く", () => {
    useDetailedDesignStore.setState({
      stages: makeStages({ 8: { mode: "simple", is_open: true, missing_inputs: [] } }).slice(7),
      selectedStage: 8,
    });

    renderContent();

    expect(screen.getByRole("heading", { name: "実装手順書" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "詳細設計書・実装計画をダウンロード(.zip)" })).not.toBeInTheDocument();
  });

  // Phase-44-2:追記
  it("変更の影響があれば、作業領域の上に「変更の影響」パネルを出す", () => {
    useDetailedDesignStore.setState({ impact: makeImpact(), impactError: null });
    renderContent();
    expect(screen.getByRole("region", { name: "変更の影響" })).toBeInTheDocument();

    useDetailedDesignStore.setState({ impact: null });
  });

  // Phase-46-3:追記
  it("簡易モードでも、文書の変更から届いた段階8の単位の印をパネルと単位の行に出す", () => {
    useDetailedDesignStore.setState({
      stages: makeStages({
        8: {
          mode: "simple",
          is_open: true,
          missing_inputs: [],
          state: "outdated",
          approved_version: 1,
          impact_open: 1,
          plan: makePlan(),
          model: makeProcedureDoc(),
        },
      }).slice(7),
      selectedStage: 8,
      impact: makeSimpleImpact(),
      impactError: null,
    });

    renderContent();

    const panel = screen.getByRole("region", { name: "変更の影響" });
    expect(within(panel).getAllByText("内部設計書").length).toBeGreaterThan(0);
    expect(within(panel).getByRole("link", { name: /文書を開く/ })).toHaveAttribute(
      "href",
      "/projects/p1/documents",
    );
    expect(within(panel).getAllByText("M-01-T02 の手順書").length).toBeGreaterThan(0);

    useDetailedDesignStore.setState({ impact: null });
  });

  // Phase-53-5:追記
  it("段階6を承認したら、レビューがオンなら承認のダイアログから段階6の区切りのレビューを流せる", async () => {
    const u = userEvent.setup();
    useReviewStore.setState({ me: reviewUser() });
    useDetailedDesignStore.setState({
      stages: makeStages({
        6: { is_open: true, missing_inputs: [], state: "reviewing", version: 1, model: makeLogics() },
      }),
      selectedStage: 6,
      approve: vi.fn().mockResolvedValue(true),
    });
    renderContent();

    await u.click(screen.getByRole("button", { name: "承認する" }));
    expect(await screen.findByText(/段階6-処理ロジックの詳細\(任意\)を承認しました。/)).toBeInTheDocument();
    await u.click(screen.getByLabelText("段階6の承認の後のレビューをする"));

    expect(useReviewStore.getState().runReview).toHaveBeenCalledWith("p1", "stage6");
    await waitFor(() => expect(screen.queryByText(/を承認しました。/)).not.toBeInTheDocument());
  });

  // Phase-54-1:追記
  it("段階6を承認したとき、採用したまま直していない指摘があれば知らせる", async () => {
    const u = userEvent.setup();
    useReviewStore.setState({
      me: reviewUser(),
      gates: [
        gate({
          gate: "stage6",
          status: "reviewed",
          run: run({ gate: "stage6", findings: [finding({ decision: "adopted", followup: "unaddressed" })] }),
        }),
      ],
    });
    useDetailedDesignStore.setState({
      stages: makeStages({
        6: { is_open: true, missing_inputs: [], state: "reviewing", version: 1, model: makeLogics() },
      }),
      selectedStage: 6,
      approve: vi.fn().mockResolvedValue(true),
    });
    renderContent();

    await u.click(screen.getByRole("button", { name: "承認する" }));
    expect(
      await screen.findByText(/採用したまま直していない指摘があります\(段階6の承認の後 1件\)。/),
    ).toBeInTheDocument();
    useReviewStore.setState({ gates: [] });
  });

  it("レビューがオフなら、承認のダイアログにレビューの操作を出さない", async () => {
    const u = userEvent.setup();
    useReviewStore.setState({ me: reviewUser({ review_enabled: false, review_effective: false }) });
    useDetailedDesignStore.setState({
      stages: makeStages({
        6: { is_open: true, missing_inputs: [], state: "reviewing", version: 1, model: makeLogics() },
      }),
      selectedStage: 6,
      approve: vi.fn().mockResolvedValue(true),
    });
    renderContent();

    await u.click(screen.getByRole("button", { name: "承認する" }));
    expect(await screen.findByText(/段階6-処理ロジックの詳細\(任意\)を承認しました。/)).toBeInTheDocument();
    expect(screen.queryByLabelText("段階6の承認の後のレビューをする")).not.toBeInTheDocument();
  });

  // Phase-53-4:追記
  it("レビューのパネルを置き、指摘の対象から段階の表へ移る", async () => {
    const u = userEvent.setup();
    useReviewStore.setState({
      me: reviewUser(),
      gates: [gate({ status: "reviewed", run: run({ findings: [finding({ targets: ["F-01", "SCR-004"] })] }) })],
    });
    useDetailedDesignStore.setState({ jumpTo: vi.fn() });
    renderContent();

    expect(useReviewStore.getState().fetchGates).toHaveBeenCalledWith("p1");
    // Phase-53(完了後の調整):追記
    await u.click(screen.getByRole("button", { name: "文書の生成の後の指摘を開く" }));
    await u.click(screen.getByRole("button", { name: "F-01" }));
    expect(useDetailedDesignStore.getState().jumpTo).toHaveBeenCalledWith(1, "F-01");
    expect(screen.queryByRole("button", { name: "SCR-004" })).not.toBeInTheDocument();
  });

  // Phase-57-3:追記
  it("詳細設計モードは、ステッパーのテスト仕様書の行で作業領域にテスト仕様書を出す(前提の段階が未承認なら作れない)", async () => {
    const user = userEvent.setup();
    renderContent();

    expect(useTestSpecStore.getState().fetchTestSpec).toHaveBeenCalledWith("p1");
    expect(screen.getByLabelText("テスト仕様書の同梱")).toHaveTextContent("まだ無い");
    // Phase-57(完了後の調整)：更新
    // await user.click(screen.getByRole("button", { name: "テスト仕様書(未作成)" }));
    // ↓↓
    await user.click(screen.getByRole("button", { name: "テスト仕様書(結合・総合)(未作成)" }));

    // Phase-57(完了後の調整)：更新
    // expect(screen.getByRole("heading", { name: "テスト仕様書" })).toBeInTheDocument();
    // ↓↓
    expect(screen.getByRole("heading", { level: 3, name: "テスト仕様書(結合・総合)" })).toBeInTheDocument();
    expect(screen.queryByText("段階1 機能一覧")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "テスト仕様書を作る" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText(/段階1・7が承認されていません/)).toBeInTheDocument();

    // 段階を選ぶと段階の作業領域に戻る
    await user.click(screen.getByRole("button", { name: /^段階1 / }));
    expect(useDetailedDesignStore.getState().selectStage).toHaveBeenCalledWith(1);
    expect(screen.getByText("段階1 機能一覧")).toBeInTheDocument();
  });

  it("段階1・7 が承認済みなら作れ、できたテスト仕様書は件数・検証の結果を出す", async () => {
    const user = userEvent.setup();
    useDetailedDesignStore.setState({
      stages: makeStages({ 1: { state: "approved" }, 7: { state: "approved" } }),
    });
    renderContent();
    // Phase-57(完了後の調整)：更新
    // await user.click(screen.getByRole("button", { name: "テスト仕様書(未作成)" }));
    // ↓↓
    await user.click(screen.getByRole("button", { name: "テスト仕様書(結合・総合)(未作成)" }));

    await user.click(screen.getByRole("button", { name: "テスト仕様書を作る" }));
    expect(useTestSpecStore.getState().generate).toHaveBeenCalledWith("p1");

    act(() => useTestSpecStore.setState({ testSpec: makeTestSpec() }));
    // Phase-57(完了後の調整)：更新
    // expect(screen.getByRole("button", { name: "テスト仕様書(作成済み)" })).toBeInTheDocument();
    // ↓↓
    expect(screen.getByRole("button", { name: "テスト仕様書(結合・総合)(作成済み)" })).toBeInTheDocument();
    expect(screen.getByLabelText("テストの件数")).toHaveTextContent("結合 12 件・総合 5 件");
    expect(screen.getByRole("table", { name: "テスト仕様書の検証の結果" })).toBeInTheDocument();
    expect(screen.getByLabelText("テスト仕様書の同梱")).toHaveTextContent("test_spec.md");
  });

  // Phase-69-3:追記
  it("テスト仕様書の直近の作成が失敗していれば、ステッパーの行とパネルで知らせる", async () => {
    const user = userEvent.setup();
    useTestSpecStore.setState({
      testSpec: makeTestSpec(),
      generationFailure: {
        reason_code: "QUOTA_EXCEEDED",
        message: "本日の利用上限に達しました。時間をおいて再度お試しください。",
        targets: ["test_spec"],
        failed_at: "2026-10-17T06:00:00Z",
      },
    });
    renderContent();

    await user.click(screen.getByRole("button", { name: "テスト仕様書(結合・総合)(前回の作成に失敗)" }));

    expect(screen.getByRole("alert", { name: "生成の失敗" })).toHaveTextContent("本日の利用上限に達しました。");
  });

  it("段階7 を承認したダイアログから、テスト仕様書へ移れる", async () => {
    const user = userEvent.setup();
    useDetailedDesignStore.setState({
      stages: makeStages({
        7: { is_open: true, missing_inputs: [], state: "reviewing", version: 1, model: makePlan() },
      }),
      selectedStage: 7,
      approve: vi.fn().mockResolvedValue(true),
    });
    renderContent();

    await user.click(screen.getByRole("button", { name: "承認する" }));
    expect(await screen.findByText(/テスト仕様書を作れます。/)).toBeInTheDocument();
    await user.click(screen.getByLabelText("テスト仕様書を開く"));

    // Phase-57(完了後の調整)：更新
    // expect(screen.getByRole("heading", { name: "テスト仕様書" })).toBeInTheDocument();
    // ↓↓
    expect(screen.getByRole("heading", { level: 3, name: "テスト仕様書(結合・総合)" })).toBeInTheDocument();
  });

  it("簡易モードはテスト仕様書の行を出さない(プレビューのタブに出す)", () => {
    useDetailedDesignStore.setState({
      stages: makeStages({ 8: { mode: "simple", is_open: true, missing_inputs: [] } }).filter((s) => s.stage === 8),
      selectedStage: 8,
    });
    renderContent();

    expect(screen.queryByRole("button", { name: /^テスト仕様書/ })).not.toBeInTheDocument();
    expect(useTestSpecStore.getState().fetchTestSpec).not.toHaveBeenCalled();
  });
});
