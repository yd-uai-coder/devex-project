// 作成：Phase-25-2｜更新：Phase-25-5
// 実装手順書の見本(appendix/implementation-procedure-sample/)を画面で確かめるデモの意味モデルと純粋関数。
// 手順書は設計を書き写さず ID で参照し、参照先の中身は表示・AI 向けの出力のときにだけ展開する。
// Phase-25-5:追記 ── ./sequenceModel.toMermaid, ./sequenceModel.toSequence
import { toMermaid, toSequence } from "./sequenceModel";

export type Severity = "critical" | "major" | "minor";
export type FindingSource = "check" | "ai";
export type UnitKind = "feature" | "base";

export const SEVERITIES: readonly Severity[] = ["critical", "major", "minor"];
export const SEVERITY_LABEL: Record<Severity, string> = { critical: "最重要", major: "中程度", minor: "軽微" };
export const SOURCE_LABEL: Record<FindingSource, string> = { check: "検証", ai: "AI" };
export const KIND_LABEL: Record<UnitKind, string> = { feature: "機能", base: "基盤" };

// 実装可能性チェックの指摘1件。unitId が null なら全体(単位によらない)の指摘。stage は直す先の段階。
export type Finding = {
  severity: Severity;
  source: FindingSource;
  unitId: string | null;
  target: string;
  message: string;
  stage: number;
};

// 単位が参照する設計の要素。中身は DesignSources から引く(手順書には持たない)。
export type DesignRefKind = "procedure" | "logic" | "module" | "crosscutting" | "environment";
export type DesignRef = { kind: DesignRefKind; key: string };

export type UnitFile = { path: string; responsibility: string; basis: string };
export type TestPoint = { id: string; viewpoint: string; sut: string; driver: string; stub: string };

// 生成済みの単位だけが手順の中身(detail)を持つ。未生成の単位は一覧に載るだけ。
export type UnitDetail = {
  purpose: string;
  refs: DesignRef[];
  files: UnitFile[];
  notes: string[];
  tests: TestPoint[];
  gwt: string[];
  verify: string[];
};

export type Unit = {
  id: string;
  kind: UnitKind;
  milestone: string;
  title: string;
  functionIds: string[];
  dependsOn: string[];
  detail: UnitDetail | null;
};

// Phase-25-5:追記
// 呼び出しの種別。今の段階5には無い欄で、シーケンス図のために足す案(無ければ同期の呼び出しとして読む)。
export type StepKind = "sync" | "async" | "return";

export type ProcedureStep = {
  no: string;
  route: string;
  call: string;
  data: string;
  action: string;
  result: string;
  db: string;
  branch: string;
  // Phase-25-5:追記
  kind?: StepKind;
};
export type ProcedureSource = { id: string; name: string; trigger: string; steps: ProcedureStep[] };
export type LogicSource = {
  id: string;
  fn: string;
  module: string;
  rows: [string, string][];
  pseudo: { text: string; sub: string[] }[];
};
export type ModuleSource = { path: string; layer: string; responsibility: string; dependsOn: string[] };
export type CrosscuttingSource = { topic: string; policy: string };

export type DesignSources = {
  procedures: Record<string, ProcedureSource>;
  logics: Record<string, LogicSource>;
  modules: Record<string, ModuleSource>;
  crosscutting: Record<string, CrosscuttingSource>;
  environment: string;
};

export type ProjectContext = { name: string; scope: string; rules: string[] };

// 単位を依存順(依存される単位が先)に並べる。元の並び(段階7の並び順)を前から見て、依存先がそろった
// 単位から取ることを繰り返す(依存の無い並びは元の順のまま)。
// 一覧に無い単位への依存と、循環は issues に出し、循環した単位は末尾に元の順で付ける。
export function sortUnitsByDependency(units: Unit[]): { order: Unit[]; issues: string[] } {
  const ids = new Set(units.map((u) => u.id));
  const issues: string[] = [];
  const remaining = new Map<string, Set<string>>();
  for (const unit of units) {
    const deps = new Set<string>();
    for (const dep of unit.dependsOn) {
      if (ids.has(dep)) deps.add(dep);
      else issues.push(`${unit.id}: 依存先 ${dep} が単位の一覧に無い`);
    }
    remaining.set(unit.id, deps);
  }
  const order: Unit[] = [];
  const done = new Set<string>();
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const unit of units) {
      if (done.has(unit.id)) continue;
      const deps = remaining.get(unit.id)!;
      if ([...deps].every((d) => done.has(d))) {
        order.push(unit);
        done.add(unit.id);
        progressed = true;
      }
    }
  }
  const cyclic = units.filter((u) => !done.has(u.id));
  if (cyclic.length > 0) {
    issues.push(`依存が循環している: ${cyclic.map((u) => u.id).join(", ")}`);
    order.push(...cyclic);
  }
  return { order, issues };
}

export function findingsOf(findings: Finding[], unitId: string | null): Finding[] {
  return findings.filter((f) => f.unitId === unitId);
}

export function countBySeverity(findings: Finding[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { critical: 0, major: 0, minor: 0 };
  for (const f of findings) counts[f.severity] += 1;
  return counts;
}

// 重要度の順(最重要が先)に並べる。同じ重要度の中では元の順を保つ。
export function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity));
}

export function refLabel(ref: DesignRef, sources: DesignSources): string {
  switch (ref.kind) {
    case "procedure": {
      const p = sources.procedures[ref.key];
      return p ? `段階5 ${p.id} ${p.name}` : `段階5 ${ref.key}`;
    }
    case "logic": {
      const l = sources.logics[ref.key];
      return l ? `段階6 ${l.id} ${l.fn}` : `段階6 ${ref.key}`;
    }
    case "module":
      return `段階4 ${ref.key}`;
    case "crosscutting":
      return `07章 ${ref.key}`;
    case "environment":
      return "段階7 開発環境";
  }
}

// 参照先が設計に無い(ID・パスが一致しない)ものを返す。決定論的なチェックの一部。
export function unresolvedRefs(refs: DesignRef[], sources: DesignSources): DesignRef[] {
  return refs.filter((ref) => {
    switch (ref.kind) {
      case "procedure":
        return !(ref.key in sources.procedures);
      case "logic":
        return !(ref.key in sources.logics);
      case "module":
        return !(ref.key in sources.modules);
      case "crosscutting":
        return !(ref.key in sources.crosscutting);
      case "environment":
        return !sources.environment;
    }
  });
}

// Phase-25-5:追記
// 単位が参照する手順から導いたシーケンス図(Mermaid)。手順の無い単位は空。
function sequenceSection(refs: DesignRef[], sources: DesignSources): string[] {
  return refs
    .filter((r) => r.kind === "procedure" && sources.procedures[r.key])
    .flatMap((r) => {
      const sequence = toSequence(sources.procedures[r.key], sources.modules);
      return [
        `### シーケンス図(段階5 ${r.key} の手順から導出)`,
        "",
        "```mermaid",
        toMermaid(sequence),
        "```",
        "",
        ...sequence.issues.map((i) => `- 検証 ${i.stepId}: ${i.message}`),
        ...(sequence.issues.length ? [""] : []),
      ];
    });
}

const cell = (value: string) => value.replace(/\|/g, "\\|").replace(/\n/g, " ");
const row = (values: string[]) => `| ${values.map(cell).join(" | ")} |`;
const table = (head: string[], rows: string[][]) =>
  [row(head), row(head.map(() => "---")), ...rows.map(row)].join("\n");

// 参照1つを md に展開する(AI 向けの出力・画面の展開で使う)。参照先が無ければ null。
export function expandRef(ref: DesignRef, sources: DesignSources): string | null {
  switch (ref.kind) {
    case "procedure": {
      const p = sources.procedures[ref.key];
      if (!p) return null;
      const steps = p.steps.map((s) => [s.no, s.route, s.call, s.data, s.action, s.result, s.db, s.branch]);
      return [
        `### 段階5 ${p.id} ${p.name}`,
        "",
        `トリガー: ${p.trigger}`,
        "",
        table(["No", "呼び出し元 → 呼び出し先", "関数", "渡すデータ", "処理内容", "結果", "DB 操作", "分岐・例外"], steps),
      ].join("\n");
    }
    case "logic": {
      const l = sources.logics[ref.key];
      if (!l) return null;
      const pseudo = l.pseudo.flatMap((p, i) => [`${i + 1}. ${p.text}`, ...p.sub.map((s) => `    - ${s}`)]);
      return [
        `### 段階6 ${l.id} ${l.fn}(\`${l.module}\`)`,
        "",
        table(["項目", "内容"], l.rows),
        "",
        ...pseudo,
      ].join("\n");
    }
    case "module": {
      const m = sources.modules[ref.key];
      if (!m) return null;
      return `- 段階4 \`${m.path}\`(${m.layer}): ${m.responsibility} 依存先: ${m.dependsOn.join(", ") || "なし"}`;
    }
    case "crosscutting": {
      const c = sources.crosscutting[ref.key];
      return c ? `- 07章 **${c.topic}**: ${c.policy}` : null;
    }
    case "environment":
      return sources.environment ? `- 段階7 開発環境: ${sources.environment}` : null;
  }
}

function findingLines(findings: Finding[]): string[] {
  return sortFindings(findings).map(
    (f) => `- [${SEVERITY_LABEL[f.severity]}][${SOURCE_LABEL[f.source]}] ${f.target}: ${f.message}`,
  );
}

function unitHeader(unit: Unit): string[] {
  return [
    `# ${unit.id} ${unit.title}`,
    "",
    `種別: ${KIND_LABEL[unit.kind]} / マイルストーン: ${unit.milestone} / 処理: ${unit.functionIds.join(", ") || "なし"} / 依存: ${unit.dependsOn.join(", ") || "なし"}`,
  ];
}

function testTable(tests: TestPoint[]): string {
  return table(
    ["#", "観点", "SUT", "ドライバ", "スタブ"],
    tests.map((t) => [t.id, t.viewpoint, t.sut, t.driver, t.stub]),
  );
}

// 人向けの単位の md。参照は ID だけを書き、中身は展開しない。
export function toUnitMarkdown(unit: Unit, findings: Finding[], sources: DesignSources): string {
  const d = unit.detail;
  if (!d) return [...unitHeader(unit), "", "(手順書は未生成)", ""].join("\n");
  return [
    ...unitHeader(unit),
    "",
    "## 目的",
    "",
    d.purpose,
    "",
    "## 対象の処理・参照する設計",
    "",
    ...d.refs.map((r) => `- ${refLabel(r, sources)}`),
    "",
    // Phase-25-5:追記
    ...sequenceSection(d.refs, sources),
    "## 作成・変更するファイル(依存順)",
    "",
    table(["ファイル", "責務", "根拠"], d.files.map((f) => [f.path, f.responsibility, f.basis])),
    "",
    "## 実装の要点(設計に書いていないことだけ)",
    "",
    ...d.notes.map((n) => `- ${n}`),
    "",
    "## テスト観点",
    "",
    testTable(d.tests),
    "",
    ...d.gwt.map((g) => `- ${g}`),
    "",
    "## 確認方法",
    "",
    ...d.verify.map((v) => `- ${v}`),
    "",
    "## 未定義・要決定",
    "",
    ...(findings.length ? findingLines(findings) : ["なし"]),
    "",
  ].join("\n");
}

// AI(Coding Agent)向けの md。人向けと同じ中身に、参照先の設計を展開して添える。
// 未定義が残っていれば先頭で警告する(渡すのを止めはしない)。
export function toAiMarkdown(
  unit: Unit,
  findings: Finding[],
  sources: DesignSources,
  context: ProjectContext,
): string {
  const d = unit.detail;
  if (!d) return "";
  const counts = countBySeverity(findings);
  const warning =
    findings.length > 0
      ? [
          `> ⚠ この単位には「未定義・要決定」が ${findings.length} 件残っています(最重要 ${counts.critical} 件)。決めてから渡すことを勧めます。`,
          "",
        ]
      : [];
  const expanded = d.refs.map((r) => expandRef(r, sources)).filter((s): s is string => s !== null);
  return [
    ...warning,
    "あなたは実装担当者です。以下の設計情報に従って実装してください。",
    "",
    "## プロジェクト概要",
    "",
    `${context.name}: ${context.scope}`,
    "",
    "## 実装ルール",
    "",
    ...context.rules.map((r) => `- ${r}`),
    "",
    "## 今回の実装単位",
    "",
    `${unit.id} ${unit.title}(処理: ${unit.functionIds.join(", ") || "なし"})`,
    "",
    `目的: ${d.purpose}`,
    "",
    `前提: ${unit.dependsOn.length ? `${unit.dependsOn.join(", ")} まで実装済み` : "なし"}`,
    "",
    "## 作成・変更するファイル(依存順)",
    "",
    table(["ファイル", "責務"], d.files.map((f) => [f.path, f.responsibility])),
    "",
    "実装の要点:",
    ...d.notes.map((n) => `- ${n}`),
    "",
    "## 参照する設計",
    "",
    expanded.join("\n\n"),
    "",
    // Phase-25-5:追記
    ...sequenceSection(d.refs, sources),
    "## テスト観点",
    "",
    testTable(d.tests),
    "",
    "## 完了条件",
    "",
    "- この単位のテストが全件成功し、既存のテストが壊れていない。",
    "- lint・型チェックが成功する。",
    ...d.verify.map((v) => `- ${v}`),
    "",
    "## 未定義・要決定(決まるまで、推測で実装しないこと)",
    "",
    ...(findings.length ? findingLines(findings) : ["なし"]),
    "",
    "## 制約",
    "",
    "- 既存の API を変更しない。",
    "- 設計に無いことを推測で決めない。",
    "",
    "まず現在のリポジトリを調査し、既存実装との整合性を確認してください。不整合がある場合は実装せず、問題点を報告してください。",
    "",
  ].join("\n");
}
