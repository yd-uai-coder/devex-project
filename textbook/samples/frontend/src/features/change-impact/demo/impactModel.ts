// 作成：Phase-41-3
// 変更の影響範囲の意味モデルと純粋関数(デモ用)。
//
// 設計の要素(要件・画面・API・処理・段階2〜8 の行)と、要素どうしの参照(ID の辺)から、
// ある要素を変えたときに見直しが要る要素を求める。たどり方は「処理を軸」にする:
// 変更が届く処理(F-xx)を決め、その処理に属する要素だけを示す。共有されるモジュールからは広げない。
// 改名のように参照の文字列だけが変わる変更は、直接の参照元だけに伝える。理由は辺の種類から文にする
// (LLM は使わない)。

export type ElementKind =
  | "requirement"
  | "screen"
  | "api"
  | "function"
  | "summary"
  | "table"
  | "crud"
  | "module"
  | "procedure"
  | "logic"
  | "task"
  | "crosscutting"
  | "unit";

// 参照の種類。A が B を参照する(A は B に依存する)。
export type EdgeKind =
  | "requirement" // 要件ID を持つ
  | "screen" // 関連画面
  | "trigger" // API のトリガー
  | "function" // 処理に属する
  | "table" // テーブルを読み書きする
  | "depends" // モジュールの依存先
  | "calls" // 手順の呼び出し先
  | "placed" // 処理ロジックの置き場
  | "called_by" // 処理ロジックを呼ぶ手順
  | "unit" // 作業単位の手順書
  | "covers"; // 横断事項の対象のモジュールを含む

export type Ref = { to: string; edge: EdgeKind };

// stage: 0 = 文書(要件定義書・外部設計書)、1〜8 = 詳細設計の段階
export type DesignElement = {
  key: string;
  kind: ElementKind;
  stage: number;
  label: string;
  refs: Ref[];
};

export type ChangeKind = "content" | "rename";

export type Change = {
  id: string;
  title: string;
  key: string;
  kind: ChangeKind;
  before: string;
  after: string;
};

export type ImpactItem = {
  key: string;
  // 変わった要素からこの要素までの道(先頭が変わった要素)
  path: string[];
  reason: string;
};

export type StageMark = { stage: number; outdated: boolean; open: number; reviewed: number };

export type RegenerationTarget = { stage: number; key: string };

export const STAGE_LABEL: Record<number, string> = {
  0: "文書",
  1: "段階1 機能一覧",
  2: "段階2 データフロー",
  3: "段階3 データモデル",
  4: "段階4 ソフトウェア構造",
  5: "段階5 主要処理の手順",
  6: "段階6 処理ロジック",
  7: "段階7 横断事項・実装計画",
  8: "段階8 実装手順書",
};

export const CHANGE_KIND_LABEL: Record<ChangeKind, string> = {
  content: "内容の変更",
  rename: "改名(参照だけが変わる)",
};

const EDGE_REASON: Record<EdgeKind, string> = {
  requirement: "この要件を持つ",
  screen: "この画面に関わる",
  trigger: "この API で起動する",
  function: "この処理に属する",
  table: "このテーブルを読み書きする",
  depends: "このモジュールに依存する",
  calls: "このモジュールを呼ぶ",
  placed: "このモジュールに置く",
  called_by: "この手順から呼ばれる",
  unit: "この作業単位の手順書",
  covers: "この横断事項の対象のモジュールを含む",
};

// 処理への道をたどるときに通ってよい要素(文書の要素)
const TOWARD_FUNCTION: ReadonlySet<ElementKind> = new Set(["requirement", "screen", "api"]);
// 処理に属する要素の、さらに先で示す要素(手順を呼ぶ処理ロジック・作業単位の手順書)
const FOLLOW_OWN: ReadonlySet<ElementKind> = new Set(["logic", "unit"]);

type Back = { from: string; edge: EdgeKind };

function backIndex(elements: readonly DesignElement[]): Map<string, Back[]> {
  const index = new Map<string, Back[]>();
  for (const e of elements) {
    for (const r of e.refs) {
      const list = index.get(r.to) ?? [];
      list.push({ from: e.key, edge: r.edge });
      index.set(r.to, list);
    }
  }
  return index;
}

export function elementMap(elements: readonly DesignElement[]): Map<string, DesignElement> {
  return new Map(elements.map((e) => [e.key, e]));
}

/** 変更から、見直しが要る要素を求める。同じ要素に複数の道があれば短い方を残す。 */
export function impactOf(elements: readonly DesignElement[], change: Change): ImpactItem[] {
  const byKey = elementMap(elements);
  const back = backIndex(elements);
  const found = new Map<string, ImpactItem>();
  const add = (path: string[], reason: string) => {
    const key = path[path.length - 1];
    if (key === change.key) return;
    const prev = found.get(key);
    if (prev && prev.path.length <= path.length) return;
    found.set(key, { key, path, reason });
  };
  const kindOf = (key: string) => byKey.get(key)?.kind;

  const direct = back.get(change.key) ?? [];
  for (const b of direct) add([change.key, b.from], EDGE_REASON[b.edge]);
  if (change.kind === "rename") return sortItems([...found.values()], byKey);

  // 横断事項は処理を持たないので、その先の手順書まで示す
  for (const b of direct) {
    if (kindOf(b.from) !== "crosscutting") continue;
    for (const u of back.get(b.from) ?? []) add([change.key, b.from, u.from], EDGE_REASON[u.edge]);
  }

  // 変更が届く処理(文書の要素だけを通る)
  const functions = new Map<string, { path: string[]; reason: string }>();
  if (kindOf(change.key) === "function") functions.set(change.key, { path: [change.key], reason: "" });
  const queue: string[][] = [[change.key]];
  while (queue.length > 0) {
    const path = queue.shift() as string[];
    for (const b of back.get(path[path.length - 1]) ?? []) {
      if (path.includes(b.from)) continue;
      const kind = kindOf(b.from);
      if (kind === "function" && !functions.has(b.from)) {
        functions.set(b.from, { path: [...path, b.from], reason: EDGE_REASON[b.edge] });
      } else if (kind && TOWARD_FUNCTION.has(kind)) {
        queue.push([...path, b.from]);
      }
    }
  }
  // テーブル・モジュールの変更は、それを使う CRUD・手順の処理に届く
  for (const b of direct) {
    const user = byKey.get(b.from);
    if (!user || (user.kind !== "crud" && user.kind !== "procedure")) continue;
    for (const r of user.refs) {
      if (r.edge === "function" && !functions.has(r.to)) {
        functions.set(r.to, { path: [change.key, b.from, r.to], reason: "変わった要素を使う処理" });
      }
    }
  }

  for (const [fn, { path, reason }] of functions) {
    if (fn !== change.key) add(path, reason);
    for (const own of back.get(fn) ?? []) {
      if (kindOf(own.from) === "module") continue;
      add([...path, own.from], EDGE_REASON[own.edge]);
      for (const next of back.get(own.from) ?? []) {
        const kind = kindOf(next.from);
        if (kind && FOLLOW_OWN.has(kind)) add([...path, own.from, next.from], EDGE_REASON[next.edge]);
      }
    }
  }
  return sortItems([...found.values()], byKey);
}

function sortItems(items: ImpactItem[], byKey: Map<string, DesignElement>): ImpactItem[] {
  return items.sort(
    (a, b) => (byKey.get(a.key)?.stage ?? 0) - (byKey.get(b.key)?.stage ?? 0) || a.key.localeCompare(b.key),
  );
}

/** 今の仕組み(段階単位)で「古い」になる段階。文書の変更は全段階、段階 N の変更は N より後ろの全段階。 */
export function outdatedStages(sourceStage: number): number[] {
  const all = [1, 2, 3, 4, 5, 6, 7, 8];
  return sourceStage === 0 ? all : all.filter((s) => s > sourceStage);
}

/** 段階ごとの印の数。段階の「古い」は今の仕組みのまま残し、その中の見直しが要る要素を数える。 */
export function stageMarks(
  elements: readonly DesignElement[],
  change: Change,
  items: readonly ImpactItem[],
  reviewed: ReadonlySet<string>,
): StageMark[] {
  const byKey = elementMap(elements);
  const source = byKey.get(change.key)?.stage ?? 0;
  const outdated = new Set(outdatedStages(source));
  return [1, 2, 3, 4, 5, 6, 7, 8].map((stage) => {
    const keys = items.filter((i) => byKey.get(i.key)?.stage === stage).map((i) => i.key);
    const done = keys.filter((k) => reviewed.has(k)).length;
    return { stage, outdated: outdated.has(stage), open: keys.length - done, reviewed: done };
  });
}

/** 古い段階を承認し直せるか(見直しが要る要素がすべて確認済み)。 */
export function canReapprove(mark: StageMark): boolean {
  return mark.outdated && mark.open === 0;
}

/** 再生成の候補: 部分再生成できる段階(5 手順・6 処理ロジック・8 単位の手順書)の要素。自動では再生成しない。 */
export function regenerationTargets(
  elements: readonly DesignElement[],
  items: readonly ImpactItem[],
): RegenerationTarget[] {
  const byKey = elementMap(elements);
  return items.flatMap((i) => {
    const stage = byKey.get(i.key)?.stage ?? 0;
    return stage === 5 || stage === 6 || stage === 8 ? [{ stage, key: i.key }] : [];
  });
}

/** 道を表示用の文にする(要素のラベルでなくキーで並べる)。 */
export function pathText(path: readonly string[]): string {
  return path.join(" → ");
}
