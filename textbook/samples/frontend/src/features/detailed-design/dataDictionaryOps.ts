// 作成：Phase-17-8
// 写経レベル: 定型 ── フィールドの入力欄の文字列との行き来。
import type { DataItemField } from "@/features/uml/api/types";

// データ辞書の表の編集操作(純粋関数。Phase 17)。フィールドは表の1つの入力欄で
// 「name:型, name2」の形で編集する(型は任意。必須の指定は表では扱わず、元の値を保つ)。

export function fieldsToText(fields: DataItemField[]): string {
  return fields.map((f) => (f.type ? `${f.name}:${f.type}` : f.name)).join(", ");
}

// 入力欄の文字列をフィールドの並びに戻す。空の要素は捨てる。同じ名前のフィールドが元にあれば、
// その必須の指定を引き継ぐ(表で型だけ直したときに required を落とさないため)。
export function textToFields(text: string, previous: DataItemField[] = []): DataItemField[] {
  return text
    .split(/[,、]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => {
      const [rawName, ...rest] = part.split(":");
      const name = rawName.trim();
      const type = rest.join(":").trim();
      const required = previous.find((f) => f.name === name)?.required ?? null;
      return { name, type: type || null, required };
    });
}

// 名前の重複(前後の空白は除いて比べる。バックエンドの一意制約と同じく大小文字は区別する)。
// 保存の前に画面で止める。
export function isDuplicateName(
  name: string,
  items: { id: string; name: string }[],
  selfId: string | null,
): boolean {
  const key = name.trim();
  return items.some((item) => item.id !== selfId && item.name.trim() === key);
}
