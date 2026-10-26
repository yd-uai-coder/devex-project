// 作成：Phase-87-1｜更新：Phase-87-4,88-2,88(完了後の調整),98-2,99(完了後の調整),107-1,107-2,107-4,107-5,109-2,110(完了後の調整),112-2,112-4
// SUT: changeRequestOps(CR の画面の純粋な変換)
// ドライバ: vitest のテスト関数
// スタブ不要 ── 対象が純粋(副作用なし)で外部依存を呼ばないため
  // Phase-87-4:追記
  // Phase-88(完了後の調整):追記
  // Phase-88-2:追記
  // Phase-88-2:追記
// Phase-88-2：更新
// import { makeChangeRequest, makeComparison, makeImpact } from "../test-utils/changeRequestFixtures";
// ↓↓
// Phase-88(完了後の調整):追記
// Phase-98-2:追記 ── ../changeRequestOps.ORIGIN_KIND_LABEL, ../changeRequestOps.addOrigin, ../changeRequestOps.originLabel, ../changeRequestOps.removeOrigin
// Phase-99(完了後の調整):追記 ── ../changeRequestOps.verifyBannerText
// Phase-107-1:追記 ── ../changeRequestOps.scaleCell, ../changeRequestOps.scaleColumns, ../changeRequestOps.scaleComparisonBasis, ../changeRequestOps.scaleRemarkLines, ../test-utils/changeRequestFixtures.makeExplanation, ../test-utils/changeRequestFixtures.makeScale
// Phase-107-2:追記 ── ../changeRequestOps.addOption, ../changeRequestOps.decidedOptionLabel, ../changeRequestOps.optionsFormFromCr, ../changeRequestOps.optionsProblems, ../changeRequestOps.removeOption, ../changeRequestOps.toOptionsBody, ../changeRequestOps.toggleOptionTarget, ../changeRequestOps.updateOption, ../test-utils/changeRequestFixtures.makeOptions
// Phase-107-4:追記 ── ../changeRequestOps.activeShareLink, ../changeRequestOps.canShare, ../changeRequestOps.shareDaysProblem, ../changeRequestOps.shareUrl, ../test-utils/changeRequestFixtures.makeShareLink
// Phase-107-5:追記 ── ../changeRequestOps.commentAuthor, ../changeRequestOps.commentedOnOlderVersion, ../test-utils/changeRequestFixtures.makeComment
// Phase-109-2:追記 ── ../changeRequestOps.changeRequestLabel
// Phase-110(完了後の調整):追記 ── ../changeRequestOps.draftStaleNotice
// Phase-112-2:追記 ── ../changeRequestOps.changeRequestHref, ../changeRequestOps.detailTabOf, ../changeRequestOps.reflectionGroups, ../changeRequestOps.restoreReasonLabel, ../test-utils/changeRequestFixtures.makeReflection
// Phase-112-4:追記 ── ../changeRequestOps.conflictNoticeLine, ../changeRequestOps.uncheckedConflicts, ../test-utils/changeRequestFixtures.makeConflict
import { describe, expect, it } from "vitest";
import {
  ORIGIN_KIND_LABEL,
  activeShareLink,
  addOption,
  addOrigin,
  addTarget,
  canReflectDocuments,
  canReflectStages,
  canShare,
  conflictNoticeLine,
  commentAuthor,
  commentedOnOlderVersion,
  comparisonGroups,
  crNumbersInImpact,
  decidedOptionLabel,
  defaultReflectionCr,
  changeRequestHref,
  changeRequestLabel,
  designStageHref,
  detailTabOf,
  draftStaleNotice,
  emptyForm,
  formFromChangeRequest,
  formProblems,
  groupByStage,
  headerActions,
  isApplied,
  isDetailedModeOnly,
  reflectionGroups,
  restoreReasonLabel,
  uncheckedConflicts,
  localInputToIso,
  markSegments,
  nowLocalInput,
  optionsFormFromCr,
  optionsProblems,
  originLabel,
  removeOption,
  removeOrigin,
  removeTarget,
  scaleCell,
  scaleColumns,
  scaleComparisonBasis,
  scaleRemarkLines,
  setTargetKind,
  shareDaysProblem,
  shareUrl,
  setTargetProposal,
  stageLabel,
  stagesMarkedBy,
  summaryOutputNote,
  toCreateBody,
  toOptionsBody,
  toUpdateBody,
  toggleOptionTarget,
  updateOption,
  verifyBannerText,
} from "../changeRequestOps";
import {
  makeChangeRequest,
  makeComment,
  makeComparison,
  makeConflict,
  makeExplanation,
  makeImpact,
  makeOptions,
  makeReflection,
  makeScale,
  makeShareLink,
  makeSummary,
} from "../test-utils/changeRequestFixtures";
import type { DesignImpactRead } from "@/features/detailed-design/api/types";
import { ApiError } from "@/lib/api/client";

const mark = (key: string, sources: string[], reviewed = false) => ({
  key,
  label: key,
  stage: 1,
  path: [],
  reason: "",
  sources,
  reviewed,
  pending: false,
});

describe("changeRequestOps", () => {
  it("見出しのボタンは許された操作のうち、見出しに置くものだけを表の順に返す", () => {
    expect(headerActions(["edit", "explain", "withdraw"])).toEqual(["explain", "withdraw"]);
    expect(headerActions(["apply", "verify"])).toEqual([]);
    expect(headerActions(["copy"])).toEqual(["copy"]);
  });

  it("反映できる状態と、比較・検証を出す状態", () => {
    expect(canReflectDocuments("agreed")).toBe(true);
    expect(canReflectDocuments("applied")).toBe(true);
    expect(canReflectDocuments("explained")).toBe(false);
    expect(canReflectStages("agreed")).toBe(false);
    expect(canReflectStages("applied")).toBe(true);
    expect(isApplied("verified")).toBe(true);
    expect(isApplied("agreed")).toBe(false);
  });

  it("対象は同じ要件を2回足さず、削除にすると案を消す", () => {
    let targets = addTarget([], "FR-001");
    targets = addTarget(targets, "FR-001");
    targets = addTarget(targets, "FR-002");
    targets = setTargetProposal(targets, "FR-001", "新しい文");
    expect(targets.map((t) => t.requirement_id)).toEqual(["FR-001", "FR-002"]);

    targets = setTargetKind(targets, "FR-001", "delete");
    expect(targets[0]).toEqual({ requirement_id: "FR-001", kind: "delete", proposed_text: "" });

    expect(removeTarget(targets, "FR-001").map((t) => t.requirement_id)).toEqual(["FR-002"]);
  });

  it("送る前の確かめ(タイトル・内容・対象か新しい要件)", () => {
    expect(formProblems(emptyForm())).toHaveLength(3);
    const form = { ...emptyForm(), title: "t", content: "c", adds_requirement: true };
    expect(formProblems(form)).toEqual([]);
  });

  it("本文は空白を除き、日付の空は null、削除の案は空にする。基準の束は作成だけ", () => {
    const form = {
      ...emptyForm(2),
      title: " t ",
      content: " c ",
      targets: [
        { requirement_id: "FR-001", kind: "content" as const, proposed_text: " 案 " },
        { requirement_id: "FR-002", kind: "delete" as const, proposed_text: "残り" },
      ],
    };

    const update = toUpdateBody(form);
    expect(update.title).toBe("t");
    expect(update.background_date).toBeNull();
    expect(update.targets.map((t) => t.proposed_text)).toEqual(["案", ""]);
    expect("baseline_number" in update).toBe(false);
    expect(toCreateBody(form).baseline_number).toBe(2);
    expect("baseline_number" in toCreateBody(emptyForm())).toBe(false);
  });

  it("CR からフォームを作る(往復で同じ本文)", () => {
    const cr = makeChangeRequest();
    const form = formFromChangeRequest(cr);
    expect(form.baseline_number).toBe(1);
    expect(toUpdateBody(form).targets).toEqual([
      { requirement_id: "FR-005", kind: "content", proposed_text: "5件まで添付できる" },
    ]);
  });

  // Phase-98-2:追記
  it("起点は同じ要素を2回入れず、新しい要件を足すときだけ送る", () => {
    const origins = addOrigin(addOrigin(addOrigin([], "screen:SCR-004"), "req:FR-001"), "screen:SCR-004");
    expect(origins).toEqual(["screen:SCR-004", "req:FR-001"]);
    expect(removeOrigin(origins, "screen:SCR-004")).toEqual(["req:FR-001"]);
    expect(addOrigin(origins, "")).toBe(origins);

    const form = { ...emptyForm(), title: "t", content: "c", adds_requirement: true, origins };
    expect(toUpdateBody(form).origins).toEqual(["screen:SCR-004", "req:FR-001"]);
    // 「新しい要件を足す」を外したら、選んでいた起点は送らない(サーバーは起点だけ残ると断る)
    expect(toUpdateBody({ ...form, adds_requirement: false }).origins).toEqual([]);
    expect(ORIGIN_KIND_LABEL.screen).toBe("画面");
    // Phase-109-2:追記
    expect(ORIGIN_KIND_LABEL.function).toBe("処理");
  });

  it("CR の起点はキーでフォームへ写し、表示名はキーから引く", () => {
    const origins = [{ key: "screen:SCR-004", label: "SCR-004 チャットヒアリング画面" }];
    const cr = makeChangeRequest({ adds_requirement: true, origins });
    expect(formFromChangeRequest(cr).origins).toEqual(["screen:SCR-004"]);
    expect(originLabel(origins, "screen:SCR-004")).toBe("SCR-004 チャットヒアリング画面");
    expect(originLabel(origins, "api:GET /x")).toBe("api:GET /x");
  });

  it("datetime-local の値と ISO 文字列", () => {
    expect(nowLocalInput(new Date(2026, 9, 19, 9, 5))).toBe("2026-10-19T09:05");
    expect(localInputToIso("2026-10-19T09:05")).toBe(new Date(2026, 9, 19, 9, 5).toISOString());
    expect(localInputToIso("")).toBeNull();
    expect(localInputToIso("x")).toBeNull();
  });

  it("予測は段階の順にまとめ、段階0は文書の側と呼ぶ", () => {
    const groups = groupByStage([...makeImpact().items].reverse());
    expect(groups.map((g) => g.stage)).toEqual([0, 1]);
    expect(stageLabel(0)).toBe("文書の側(画面・API)");
    expect(stageLabel(3)).toBe("段階3 データモデル");
  });

  it("比較は予測の外 → 予測だけ → 一致の順", () => {
    const groups = comparisonGroups(makeComparison().items);
    expect(groups.map((g) => [g.status, g.items.length])).toEqual([
      ["actual_only", 1],
      ["predicted_only", 1],
      ["matched", 1],
    ]);
  });

  it("未確認の印の出どころから CR の番号と段階を読む", () => {
    const impact: DesignImpactRead = {
      stages: [
        { stage: 1, changes: [], marks: [mark("F-01", ["doc:requirements", "cr:2"]), mark("F-02", ["cr:5"], true)], open: 1, reviewed: 1 },
        { stage: 3, changes: [], marks: [mark("T-01", ["cr:1"])], open: 1, reviewed: 0 },
      ],
      regeneration_targets: [],
    };
    expect(crNumbersInImpact(impact)).toEqual([1, 2]);
    expect(crNumbersInImpact(null)).toEqual([]);
    expect(stagesMarkedBy(impact, 2)).toEqual([1]);
    expect(stagesMarkedBy(impact, 5)).toEqual([]);
    expect(designStageHref("p1", 3)).toBe("/projects/p1/detailed-design?stage=3");
    // Phase-109-2:追記
    expect(changeRequestLabel(4)).toBe("CR-4");
    // Phase-87-4:追記
    // 段階の生成に渡す CR の初期値は、反映済みの CR のうち印の出どころにある最初のもの
    expect(defaultReflectionCr([2, 7], impact)).toBe(2);
    expect(defaultReflectionCr([7], impact)).toBeNull();
  });
});

// Phase-88-2:追記
describe("説明書と要約", () => {
  it("照合で合わない要件 ID・数字だけに印を付け、ほかの文はつなげる", () => {
    const segments = markSegments("FR-005 と FR-099 の上限を3件から5件に。影響は7件(E2E は除く)。", ["FR-099"], ["7"]);

    expect(segments.filter((s) => s.mark !== null)).toEqual([
      { text: "FR-099", mark: "id" },
      { text: "7", mark: "number" },
    ]);
    expect(segments.map((s) => s.text).join("")).toBe("FR-005 と FR-099 の上限を3件から5件に。影響は7件(E2E は除く)。");
    // 要件 ID の中の数字・英字に続く数字は、数字として印を付けない
    expect(markSegments("FR-007 と E2E7", [], ["007", "7"])).toEqual([{ text: "FR-007 と E2E7", mark: null }]);
  });

  it("要約が出力に載るかを、状態ごとに説明する", () => {
    expect(summaryOutputNote(null)).toContain("5節だけ");
    expect(summaryOutputNote(makeSummary({ state: "confirmed" }))).toContain("要約が載ります");
    expect(summaryOutputNote(makeSummary({ state: "unconfirmed" }))).toContain("載りません");
    expect(summaryOutputNote(makeSummary({ state: "stale" }))).toContain("確かめ直すまで");
  });
});

// Phase-107-1:追記
describe("変更の規模", () => {
  const uncountable = { code: "no_stage", label: "要る段階が束に無い", detail: "段階7" };

  it("案の無い CR は1列、案のある CR の合意の前は案ごとの列にする", () => {
    expect(scaleColumns(makeExplanation()).map((c) => c.title)).toEqual(["この変更"]);
    const explanation = makeExplanation({
      option_scales: [
        { number: 1, label: "案1", name: "一緒に", recommended: true, scale: makeScale() },
        { number: 2, label: "案2", name: "先に", recommended: false, scale: makeScale() },
      ],
    });

    expect(scaleColumns(explanation).map((c) => [c.title, c.recommended])).toEqual([
      ["案1 一緒に", true],
      ["案2 先に", false],
    ]);
  });

  // Phase-110(完了後の調整):追記
  it("下書きが古い知らせは、取り込んでいない下書きだけに出す", () => {
    expect(draftStaleNotice({ stale: true, status: "unconfirmed" })).toBe(true);
    expect(draftStaleNotice({ stale: true, status: "adopted" })).toBe(false);
    expect(draftStaleNotice({ stale: false, status: "unconfirmed" })).toBe(false);
  });

  it("数えられない数を0件と書かない", () => {
    expect(scaleCell(0)).toBe("0件");
    expect(scaleCell(null)).toBe("数えられない");
  });

  it("同じ列の同じ理由は種類をまとめ、列が複数なら列の名前を頭に付ける", () => {
    const scale = makeScale({
      unit: { count: null, uncountable: [uncountable] },
      file: { count: null, uncountable: [uncountable] },
      test: { notes: [{ code: "stale", label: "古いまま写した段階から数えた", detail: "" }] },
    });

    expect(scaleRemarkLines(scaleColumns(makeExplanation({ scale })))).toEqual([
      { text: "作業単位・ファイルは数えられない: 要る段階が束に無い(段階7)", uncountable: true },
      { text: "テスト: 古いまま写した段階から数えた", uncountable: false },
      { text: "APIは数えられない: 要る文書が束に無い(外部設計書)", uncountable: true },
    ]);
    const two = scaleColumns(
      makeExplanation({
        option_scales: [
          { number: 1, label: "案1", name: "一緒に", recommended: false, scale: makeScale() },
          { number: 2, label: "案2", name: "先に", recommended: false, scale: makeScale() },
        ],
      }),
    );
    expect(scaleRemarkLines(two).map((l) => l.text)).toEqual([
      "案1 一緒に ── APIは数えられない: 要る文書が束に無い(外部設計書)",
      "案2 先に ── APIは数えられない: 要る文書が束に無い(外部設計書)",
    ]);
  });

  it("反映の後の実際の数え方を、種類の数え方ごとに書く", () => {
    const row = { kind: "screen" as const, label: "画面", predicted: 1, actual: 1 };
    expect(scaleComparisonBasis({ ...row, basis: "document_checks" })).toContain("文書の側の確認");
    expect(scaleComparisonBasis({ ...row, basis: "marks" })).toContain("印から");
  });
});

// Phase-107-2:追記
describe("選択肢(案)", () => {
  const cr = makeChangeRequest();
  const target = cr.targets[0];

  it("CR の案をフォームにし、案が無ければ空にする", () => {
    expect(optionsFormFromCr(null)).toEqual({ items: [], recommended: null, reason: "" });
    const form = optionsFormFromCr(makeOptions());
    expect(form.items.map((o) => o.name)).toEqual(["5件まで", "上限なし"]);
    expect(form.items[0].targets).toEqual([{ requirement_id: "FR-005", kind: "content", proposed_text: "5件まで添付できる" }]);
    expect(form.recommended).toBe(1);
  });

  it("初めて足すと2つ並べ、3つまでしか足さない", () => {
    const two = addOption({ items: [], recommended: null, reason: "" });
    expect(two.items).toHaveLength(2);
    const three = addOption(two);
    expect(addOption(three).items).toHaveLength(3);
  });

  it("消した案の後ろのおすすめは番号を詰め、消した案のおすすめは外す", () => {
    const form = { ...optionsFormFromCr(makeOptions()), recommended: 2 };
    expect(removeOption(form, 0).recommended).toBe(1);
    expect(removeOption(form, 1).recommended).toBeNull();
  });

  it("対象を入れると CR の種類と案を写し、外すと消す", () => {
    const option = { name: "a", targets: [], outcome: "b" };
    const on = toggleOptionTarget(option, target, true);
    expect(on.targets).toEqual([{ requirement_id: "FR-005", kind: "content", proposed_text: "5件まで添付できる" }]);
    expect(toggleOptionTarget(on, target, false).targets).toEqual([]);
    expect(updateOption({ items: [option], recommended: null, reason: "" }, 0, { name: "c" }).items[0].name).toBe("c");
  });

  it("案の数・名前と結果・重なり・対象・おすすめの規則を確かめる", () => {
    const ok = optionsFormFromCr(makeOptions());
    expect(optionsProblems(ok, cr.targets, false)).toEqual([]);
    expect(optionsProblems({ items: [], recommended: null, reason: "" }, cr.targets, false)).toEqual([]);
    expect(optionsProblems({ ...ok, items: ok.items.slice(0, 1), recommended: null, reason: "" }, cr.targets, false)).toEqual([
      "案は2〜3件にしてください",
    ]);
    const bad = {
      items: [
        { name: "同じ", targets: [{ requirement_id: "FR-099", kind: "content" as const, proposed_text: "" }], outcome: "x" },
        { name: "同じ", targets: [], outcome: "" },
      ],
      recommended: 1,
      reason: "",
    };
    expect(optionsProblems(bad, cr.targets, false)).toEqual([
      "案1の対象が CR の対象にありません: FR-099",
      "案2に名前と結果を書いてください",
      "案2の名前がほかの案と重なっています",
      "案2で変える要件を選んでください",
      "おすすめの理由を書いてください",
    ]);
    // 新しい要件を足す CR は、変える要件の無い案を持てる
    const noTargets = { ...ok, items: ok.items.map((o) => ({ ...o, targets: [] })) };
    expect(optionsProblems(noTargets, cr.targets, true)).toEqual([]);
    expect(optionsProblems({ ...ok, recommended: null }, cr.targets, false)).toEqual([
      "おすすめの案を選ばずに理由は書けません",
    ]);
  });

  it("送る本文は前後の空白を除き、削除の案を空にする。案が無ければ空の案で送る", () => {
    const form = {
      items: [
        { name: " a ", targets: [{ requirement_id: "FR-005", kind: "delete" as const, proposed_text: "x" }], outcome: " b " },
        { name: "c", targets: [], outcome: "d" },
      ],
      recommended: 1,
      reason: " r ",
    };
    expect(toOptionsBody(form)).toEqual({
      items: [
        { name: "a", targets: [{ requirement_id: "FR-005", kind: "delete", proposed_text: "" }], outcome: "b" },
        { name: "c", targets: [], outcome: "d" },
      ],
      recommended: 1,
      reason: "r",
    });
    expect(toOptionsBody({ items: [], recommended: null, reason: "" })).toEqual({ items: [], recommended: null, reason: "" });
  });

  it("合意で選んだ案を、名前つきで出す", () => {
    const decision = {
      counterpart: null,
      decided_at: "2026-10-19T01:00:00Z",
      memo: "",
      reason: "r",
      recorded_by: "u1",
      option: 2,
      source: "share_link",
      source_label: "共有リンク",
      fingerprint: "f1",
    };
    expect(decidedOptionLabel(makeChangeRequest({ options: makeOptions(), decision }))).toBe("案2 上限なし");
    expect(decidedOptionLabel(makeChangeRequest({ options: null, decision }))).toBe("案2");
    expect(decidedOptionLabel(makeChangeRequest())).toBe("");
  });
});

// Phase-107-4:追記
describe("共有リンク", () => {
  it("作れるのは下書きと説明済みだけ", () => {
    expect(canShare("draft")).toBe(true);
    expect(canShare("explained")).toBe(true);
    expect(canShare("agreed")).toBe(false);
  });

  it("応答のパスに今の origin を付けて URL にする", () => {
    expect(shareUrl("/share/abc", "https://devex.example.com/")).toBe("https://devex.example.com/share/abc");
    expect(shareUrl("/share/abc", "http://localhost:3000")).toBe("http://localhost:3000/share/abc");
  });

  it("期限は1〜90日の整数だけを受ける", () => {
    expect(shareDaysProblem("14")).toBeNull();
    expect(shareDaysProblem("90")).toBeNull();
    for (const bad of ["", "0", "91", "1.5", "x"]) expect(shareDaysProblem(bad)).not.toBeNull();
  });

  it("今使えるリンクは、取り消し・期限切れでないもの", () => {
    const revoked = makeShareLink({ id: "a", state: "revoked" });
    const paused = makeShareLink({ id: "b", state: "paused" });
    expect(activeShareLink([revoked, makeShareLink({ id: "c", state: "expired" })])).toBeNull();
    expect(activeShareLink([revoked, paused])?.id).toBe("b");
  });
});

// Phase-107-5:追記
describe("コメント", () => {
  it("書き手はクライアントの名前か開発者の返信", () => {
    expect(commentAuthor(makeComment())).toBe("佐藤(クライアント)");
    expect(commentAuthor(makeComment({ from_developer: true, author_name: "" }))).toBe("開発者(返信)");
  });

  it("今の説明書と指紋が違うコメントだけを、前の版を見たものとする", () => {
    expect(commentedOnOlderVersion(makeComment({ fingerprint: "a" }), "b")).toBe(true);
    expect(commentedOnOlderVersion(makeComment({ fingerprint: "a" }), "a")).toBe(false);
    expect(commentedOnOlderVersion(makeComment({ fingerprint: "a" }), null)).toBe(false);
  });
});

// Phase-88(完了後の調整):追記
describe("モード", () => {
  it("簡易モードで断られた 409 だけを見分ける", () => {
    expect(isDetailedModeOnly(new ApiError(409, "m", "DESIGN_STAGES_NOT_AVAILABLE"))).toBe(true);
    expect(isDetailedModeOnly(new ApiError(409, "m", "DOC_GENERATION_IN_PROGRESS"))).toBe(false);
    expect(isDetailedModeOnly(new Error("x"))).toBe(false);
  });
});
// Phase-99(完了後の調整):追記
describe("詳細設計の画面の CR の帯", () => {
  it("未確認の印・文書の側・未承認の段階の数を1行にする", () => {
    expect(verifyBannerText({ open_marks: 3, open_documents: 0, pending_stages: [1, 4] })).toBe(
      "未確認の印 3 / 文書の側 0 / 未承認の段階 2",
    );
  });
});

// Phase-112-2:追記
describe("詳細のタブと反映の前 → 後", () => {
  it("CR の詳細の URL に、開くタブと目立たせる要素のキーを付ける", () => {
    expect(changeRequestHref("p1", 3)).toBe("/projects/p1/change-requests/3");
    expect(changeRequestHref("p1", 3, { tab: "impact", focus: "req:FR-001" })).toBe(
      "/projects/p1/change-requests/3?tab=impact&focus=req%3AFR-001",
    );
  });

  it("URL の値から開くタブを決める(知らない値・無ければ内容)", () => {
    expect(detailTabOf("impact")).toBe("impact");
    expect(detailTabOf("unknown")).toBe("content");
    expect(detailTabOf(undefined)).toBe("content");
  });

  it("前 → 後を、CR の対象 → 予測 → 範囲の外 → 戻した、に分ける(空の見出しは出さない)", () => {
    const groups = reflectionGroups(makeReflection().changes);

    expect(groups.map((g) => [g.key, g.changes.map((c) => c.key)])).toEqual([
      ["target", ["req:FR-005"]],
      ["outside", ["screen:SCR-004"]],
      ["restored", ["req:FR-002"]],
    ]);
    expect(groups[1].title).toBe("範囲の外(予測に無い所)");
  });

  it("戻した理由を文にする", () => {
    expect(restoreReasonLabel("changed")).toBe("LLM が書き換えたのを戻した");
    expect(restoreReasonLabel("dropped")).toBe("LLM が落としたのを戻した");
    expect(restoreReasonLabel(null)).toBe("");
  });
});

// Phase-112-4:追記
describe("重なる CR の競合", () => {
  it("未確認の競合だけを数え、知らせの1行にする(無ければ null)", () => {
    const cr = makeChangeRequest({
      conflicts: [makeConflict(), makeConflict({ requirement_id: "FR-006", by: ["CR-2", "CR-4"], checked: false }), makeConflict({ requirement_id: "FR-007", checked: true })],
    });

    expect(uncheckedConflicts(cr).map((c) => c.requirement_id)).toEqual(["FR-005", "FR-006"]);
    expect(conflictNoticeLine(cr)).toBe(
      "対象の要件が、基準の束の後にほかの CR の反映で変わっています: FR-005(CR-2 が先に変えた)、FR-006(CR-2・CR-4 が先に変えた)。案が先の変更を消さないか、今の文と見比べてください。",
    );
    expect(conflictNoticeLine(makeChangeRequest())).toBeNull();
  });
});
