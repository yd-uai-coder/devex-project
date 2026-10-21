// 作成：Phase-98-1
import type {
  AdoptionRead,
  ConfirmationItemRead,
  ConfirmationKind,
  ConfirmationStatus,
  Opportunity,
} from "@/features/confirmations/api/types";

// 確認事項の一覧の画面の純粋な変換(絞り込み・分け方・採用率の文・確認のダイアログの要否)。

export const KIND_LABEL: Record<ConfirmationKind, string> = {
  requirement: "推測の要件",
  user: "推測の利用者",
  point: "未決の観点",
};

export const STATUS_LABEL: Record<ConfirmationStatus, string> = {
  unconfirmed: "未確認",
  confirmed: "確認済み",
  rejected: "却下",
};

// 決める機会の選択肢(devex-api の OPPORTUNITY_LABEL と同じ並び)
export const OPPORTUNITY_OPTIONS: { value: Opportunity; label: string }[] = [
  { value: "next_meeting", label: "次の打ち合わせ" },
  { value: "email", label: "メール" },
  { value: "implementation", label: "実装中" },
  { value: "none", label: "決めない" },
];

export type KindFilter = ConfirmationKind | "all";
export type StatusFilter = ConfirmationStatus | "all";

export type ConfirmationFilter = { kind: KindFilter; status: StatusFilter };

// 既定は未確認だけ(決めることが残っている項目から見る)
export const DEFAULT_FILTER: ConfirmationFilter = { kind: "all", status: "unconfirmed" };

// 今の一覧にある項目と、状態を決めた後に一覧から消えた項目(決めた記録)に分ける
export function splitByPresence(items: ConfirmationItemRead[]): {
  present: ConfirmationItemRead[];
  gone: ConfirmationItemRead[];
} {
  return {
    present: items.filter((item) => item.present),
    gone: items.filter((item) => !item.present),
  };
}

export function filterItems(items: ConfirmationItemRead[], filter: ConfirmationFilter): ConfirmationItemRead[] {
  return items.filter(
    (item) =>
      (filter.kind === "all" || item.kind === filter.kind) &&
      (filter.status === "all" || item.status === filter.status),
  );
}

// 種類ごとの未確認の件数の文(見出しに出す)。今の一覧の項目だけ数える
export function unconfirmedCountsText(items: ConfirmationItemRead[]): string {
  const kinds: ConfirmationKind[] = ["requirement", "user", "point"];
  return kinds
    .map((kind) => {
      const count = items.filter((i) => i.present && i.kind === kind && i.status === "unconfirmed").length;
      return `${KIND_LABEL[kind]} ${count}`;
    })
    .join(" / ");
}

// 推測の採用率の文。分母(確認済み + 却下)が0なら率は「─」
export function adoptionText(adoption: AdoptionRead): string {
  const rate = adoption.rate === null ? "─" : `${Math.round(adoption.rate * 100)}%`;
  return `推測の採用率: ${rate}(確認済み ${adoption.confirmed} / 却下 ${adoption.rejected}・未確認 ${adoption.unconfirmed})`;
}

// 確認済みにすると採用にして合意を記録する項目か(推測の要件・推測の利用者を確認済みにするとき)。
// このときだけ確認のダイアログを挟む(文書が変わり、合意の記録は追記型で戻せないため)
export function needsAdoptConfirm(item: ConfirmationItemRead, status: ConfirmationStatus): boolean {
  return status === "confirmed" && item.present && item.status !== "confirmed" && item.kind !== "point";
}
