// 作成：Phase-3-4
import type { ReactNode } from "react";

// ネイティブ<fieldset><legend>で複数のチェックボックス等をグルーピングする。
// CheckboxGroupWithLabelは<Label>を1つ持つだけでネイティブのグルーピング要素を
// 使わないため、「言語ごとにフレームワークをグルーピングする」といった入れ子の
// 見出し構造が必要な場面ではこちらを使う(docs/external_design.md 2.3節SCR-004)。
// legendがグループ全体のアクセシブルネームになるため、CheckboxGroupWithLabelの
// aria-labelledby配線のような追加対応は不要(fieldset/legendはHTML標準の紐づけ)。
export function FieldsetGroup({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset style={{ borderRadius: 8, padding: 12, marginBottom: 12 }}>
      <legend style={{ padding: "0 4px", fontWeight: 600 }}>{legend}</legend>
      {children}
    </fieldset>
  );
}
