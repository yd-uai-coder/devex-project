// 作成：Phase-19-6
// 写経レベル: コア ── 行をパスで引かずに位置で扱い、層の選択肢を構成図から作る。
import type { ModuleListModel, ModuleRow } from "@/features/detailed-design/api/types";
import type { ComponentSemanticModel } from "@/features/uml/api/types";

// 段階4(ソフトウェア構造)のモジュール一覧の編集操作(純粋関数)。どれも新しいモデルを返し、引数は
// 変えない。行はパスで引かず並びの位置で扱う(パスは人が書き換える欄で、重複も検証のエラーとして
// 一旦は許すため。Phase 19)。

// 保存されている model(形の保証の無い JSON)を、編集できる形にそろえる。
export function toModuleList(model: Record<string, unknown> | null): ModuleListModel {
  const strings = (value: unknown) => (Array.isArray(value) ? value.map(String) : []);
  const modules = Array.isArray(model?.modules)
    ? (model.modules as Partial<ModuleRow>[]).map(
        (row): ModuleRow => ({
          path: String(row.path ?? ""),
          layer: String(row.layer ?? ""),
          responsibility: String(row.responsibility ?? ""),
          depends_on: strings(row.depends_on),
          functions: strings(row.functions),
          all_functions: Boolean(row.all_functions),
        }),
      )
    : [];
  return { modules };
}

// 下書きの内容があるか(作り直しの確認を出すかの判定。バックエンドの _has_draft と同じ)。
export function hasModuleDraft(model: ModuleListModel): boolean {
  return model.modules.length > 0;
}

// 構成図の層(要素の layer)を、要素の並びの初出順に返す(空・未設定は除く。バックエンドの
// component_layers と同じ)。モジュール一覧の「層」の選択肢になる。
export function componentLayers(model: ComponentSemanticModel | null): string[] {
  const layers: string[] = [];
  for (const element of model?.elements ?? []) {
    const layer = (element.layer ?? "").trim();
    if (layer && !layers.includes(layer)) layers.push(layer);
  }
  return layers;
}

// 末尾に空の行を足す。層は構成図の先頭の層にしておく(人が選び直す)。
export function addModule(model: ModuleListModel, layers: string[]): ModuleListModel {
  const row: ModuleRow = {
    path: "",
    layer: layers[0] ?? "",
    responsibility: "",
    depends_on: [],
    functions: [],
    all_functions: false,
  };
  return { modules: [...model.modules, row] };
}

export function updateModule(
  model: ModuleListModel,
  index: number,
  patch: Partial<ModuleRow>,
): ModuleListModel {
  return {
    modules: model.modules.map((row, i) => (i === index ? { ...row, ...patch } : row)),
  };
}

export function removeModule(model: ModuleListModel, index: number): ModuleListModel {
  return { modules: model.modules.filter((_, i) => i !== index) };
}

// 依存先・関わる処理の入力欄(「a, b」)と配列の相互変換。「,」「、」と改行で区切る。
export function listToText(items: string[]): string {
  return items.join(", ");
}

export function textToList(text: string): string[] {
  return text
    .split(/[,、\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// 2回以上現れるパス(前後の空白を除いて比べる。空のパスは数えない)。表で重複を示すのに使う。
export function duplicatePaths(model: ModuleListModel): Set<string> {
  const seen = new Set<string>();
  const duplicated = new Set<string>();
  for (const row of model.modules) {
    const path = row.path.trim();
    if (!path) continue;
    if (seen.has(path)) duplicated.add(path);
    seen.add(path);
  }
  return duplicated;
}
