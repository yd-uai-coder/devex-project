// 作成：Phase-25-5
// 段階5の手順(番号付きの表)から、シーケンス図のモデルを導く純粋関数。
// 図は表の別の見え方で、正本は手順の表のまま(図は直さない。直すのは表)。
// 表に無い情報(呼び出しの入れ子・戻り)は規則で推測し、推測できないところは指摘にする。
import type { ModuleSource, ProcedureSource, ProcedureStep } from "./procedureDocModel";

export type MessageKind = "call" | "async" | "return";

// 図の参加者(ライフライン)。id は Mermaid の別名に使う(パスの「/」を避けるため)。
export type Participant = { id: string; name: string };

// stepId は手順ID(F-07#2)。表に無く推測した戻りは derived = true で、どの呼び出しの戻りかを stepId に持つ。
export type SequenceMessage = {
  type: "message";
  stepId: string;
  from: string;
  to: string;
  kind: MessageKind;
  label: string;
  derived: boolean;
};
export type SequenceNote = { type: "note"; stepId: string; over: string[]; text: string };
export type SequenceEvent = SequenceMessage | SequenceNote;
export type SequenceIssue = { stepId: string; message: string };

export type Sequence = {
  procedureId: string;
  participants: Participant[];
  events: SequenceEvent[];
  issues: SequenceIssue[];
};

const ROUTE_SEP = " → ";
const BRANCH_REF = /([0-9]+[a-z]*)\s*へ/g;

function parseRoute(route: string): [string, string] | null {
  const [from, to] = route.split(ROUTE_SEP).map((s) => s.trim());
  return from && to && from !== "—" ? [from, to] : null;
}

// 表の関数の欄の「→ 詳細: L-01」(06 への紐づけの表示)を除いた、関数名だけ。
function callName(call: string): string {
  const name = call.split(ROUTE_SEP)[0].trim();
  return name === "—" ? "" : name;
}

const isBranch = (step: ProcedureStep) => /^[0-9]+[a-z]+$/.test(step.no);

// 手順をシーケンスに変える。呼び出しの入れ子は、呼び出し中の参加者の積み上げ(スタック)で推測する。
// - 呼び出し元がスタックの途中にいれば、その上にいる参加者は戻ったとみなし、戻りを推測で足す。
// - 呼び出し先がスタックの下(呼び出し元の呼び出し元)にいれば、その行は戻りとみなして描き、指摘する
//   (戻りを呼び出しとして書いている。例: services/ai_service.py → frontend)。
// - 呼び出し元が呼び出し中でなければ、入れ子を推測できないと指摘し、新しい流れとして描く。
// - 呼び出し先が呼び出し元の依存先(段階4)に無ければ指摘する(外部の役者は除く)。
export function toSequence(procedure: ProcedureSource, modules: Record<string, ModuleSource>): Sequence {
  const participants: Participant[] = [];
  const idOf = new Map<string, string>();
  const ensure = (name: string) => {
    if (!idOf.has(name)) {
      const id = `P${participants.length + 1}`;
      idOf.set(name, id);
      participants.push({ id, name });
    }
    return idOf.get(name)!;
  };

  const events: SequenceEvent[] = [];
  const issues: SequenceIssue[] = [];
  const numbers = new Set(procedure.steps.map((s) => s.no));
  // 呼び出し中の参加者と、その呼び出しの手順ID・結果(戻りのラベルにする)
  const stack: { name: string; stepId: string; result: string }[] = [];
  let lastMain: string[] = [];

  const popUntil = (name: string) => {
    while (stack.length > 1 && stack[stack.length - 1].name !== name) {
      const done = stack.pop()!;
      const back = stack[stack.length - 1];
      events.push({
        type: "message",
        stepId: done.stepId,
        from: ensure(done.name),
        to: ensure(back.name),
        kind: "return",
        label: done.result,
        derived: true,
      });
    }
  };

  for (const step of procedure.steps) {
    const stepId = `${procedure.id}#${step.no}`;
    for (const match of step.branch.matchAll(BRANCH_REF)) {
      if (!numbers.has(match[1])) issues.push({ stepId, message: `分岐「${match[0]}」の行が無い` });
    }
    if (isBranch(step)) {
      events.push({ type: "note", stepId, over: lastMain, text: `${step.action} → ${step.result}` });
      continue;
    }
    const route = parseRoute(step.route);
    if (!route) {
      issues.push({ stepId, message: "呼び出し元・呼び出し先が無い" });
      continue;
    }
    const [caller, callee] = route;
    const label = [callName(step.call), step.data && `(${step.data})`].filter(Boolean).join("");
    const inStack = (name: string) => stack.some((s) => s.name === name);

    if (stack.length === 0) {
      stack.push({ name: caller, stepId, result: "" });
    } else if (!inStack(caller)) {
      issues.push({ stepId, message: `呼び出し元 ${caller} が呼び出し中でない(入れ子を推測できない)` });
      popUntil(stack[0].name);
      stack.length = 0;
      stack.push({ name: caller, stepId, result: "" });
    } else {
      popUntil(caller);
    }

    if (step.kind === "return" || (callee !== caller && inStack(callee))) {
      if (step.kind !== "return") {
        issues.push({ stepId, message: `呼び出し先 ${callee} は呼び出し元の側にいる。戻りを呼び出しとして書いているので、戻りとして描いた` });
      }
      // 呼び出し先まで戻る。最後の戻りに、この行のデータを載せる
      while (stack.length > 1 && stack[stack.length - 2].name !== callee) popUntil(stack[stack.length - 2].name);
      const done = stack.length > 1 ? stack.pop()! : stack[0];
      events.push({
        type: "message",
        stepId,
        from: ensure(done.name),
        to: ensure(callee),
        kind: "return",
        label: step.data || step.result,
        derived: false,
      });
      lastMain = [ensure(done.name), ensure(callee)];
      continue;
    }

    const deps = modules[caller]?.dependsOn;
    if (deps && callee.includes("/") && !deps.includes(callee)) {
      issues.push({ stepId, message: `呼び出し先 ${callee} が、呼び出し元 ${caller} の依存先(段階4)に無い` });
    }
    events.push({
      type: "message",
      stepId,
      from: ensure(caller),
      to: ensure(callee),
      kind: step.kind === "async" ? "async" : "call",
      label: label || step.action,
      derived: false,
    });
    lastMain = [ensure(caller), ensure(callee)];
    if (step.kind !== "async") stack.push({ name: callee, stepId, result: step.result });
  }
  if (stack.length > 0) popUntil(stack[0].name);
  return { procedureId: procedure.id, participants, events, issues };
}

// 参加者 from から、呼び出し(戻り以外)をたどって届く参加者。SUT から見たスタブの候補になる。
export function reachableCallees(sequence: Sequence, from: string): string[] {
  const edges = new Map<string, Set<string>>();
  for (const e of sequence.events) {
    if (e.type !== "message" || e.kind === "return") continue;
    if (!edges.has(e.from)) edges.set(e.from, new Set());
    edges.get(e.from)!.add(e.to);
  }
  const seen = new Set<string>();
  const queue = [from];
  while (queue.length) {
    for (const next of edges.get(queue.shift()!) ?? []) {
      if (next !== from && !seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return sequence.participants.filter((p) => seen.has(p.id)).map((p) => p.id);
}

// テスト観点の SUT(関数名か「メソッド パス」)を、図の参加者に対応させる。
// 関数名ならそれを呼ぶ矢印の先、トリガー(POST /api/…)なら最初の呼び出しの先。
export function sutParticipant(sequence: Sequence, sut: string, trigger: string): string | null {
  const name = sut.trim();
  const firstCall = sequence.events.find((e): e is SequenceMessage => e.type === "message" && e.kind !== "return");
  if (name === trigger) return firstCall?.to ?? null;
  const hit = sequence.events.find(
    (e): e is SequenceMessage => e.type === "message" && e.kind !== "return" && e.label.split("(")[0] === name,
  );
  return hit?.to ?? null;
}

const ARROW: Record<MessageKind, string> = { call: "->>", async: "-)", return: "-->>" };

// Mermaid で意味を持つ文字(「#」は文字参照、「;」は文の区切り)を外す。
const safe = (text: string) => text.replace(/[;#]/g, " ");

// Mermaid の sequenceDiagram のテキスト(md と AI 向けの版に入れる)。番号は手順ID の「#」の後ろ。
export function toMermaid(sequence: Sequence): string {
  const lines = ["sequenceDiagram"];
  for (const p of sequence.participants) lines.push(`  participant ${p.id} as ${p.name}`);
  for (const e of sequence.events) {
    if (e.type === "note") {
      lines.push(`  Note over ${e.over.join(",")}: ${e.stepId.split("#")[1]} ${safe(e.text)}`);
      continue;
    }
    const no = e.stepId.split("#")[1];
    const prefix = e.derived ? `(${no} の戻り) ` : `${no}: `;
    lines.push(`  ${e.from}${ARROW[e.kind]}${e.to}: ${prefix}${safe(e.label)}`.trimEnd());
  }
  return lines.join("\n");
}

// ファイルのパスを、テスト観点の文章と突き合わせるための形にする(services/ai_service.py → aiservice)。
function looseName(path: string): string {
  const base = path.split("/").pop() ?? path;
  return base.replace(/\.[a-z]+$/, "").replace(/[_-]/g, "").toLowerCase();
}

// 手順書のスタブの欄が、図から導いた候補(SUT から呼ぶ先)の外のモジュールを挙げていないかを調べる。
// 挙げていれば、手順に無い依存をテストで差し替えようとしている(手順か観点のどちらかが足りない)。
// 候補なのにスタブに無いものは、本物を使う(結合テストなど)ので指摘しない。
export function stubsOutsideSequence(stubText: string, candidates: string[], modulePaths: string[]): string[] {
  const text = stubText.replace(/[_-]/g, "").toLowerCase();
  const allowed = new Set(candidates.map(looseName));
  return modulePaths.filter((path) => {
    const name = looseName(path);
    return name.length > 0 && text.includes(name) && !allowed.has(name);
  });
}
