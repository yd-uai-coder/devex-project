// 作成：Phase-19-6
// 写経レベル: コア ── 「,」区切りの欄を手元の文字列で持ち、構成図に無い層を残して示す。
"use client";

import { useState, type CSSProperties } from "react";
import { Paragraph, Text, YStack } from "tamagui";
import { StyledButton } from "@/components/ui/primitives/StyledButton";
import type { ModuleListModel } from "@/features/detailed-design/api/types";
import {
  CELL,
  HEAD,
  INPUT,
  MONO,
  OPTION,
  TABLE,
} from "@/features/detailed-design/components/tableStyles";
import {
  addModule,
  duplicatePaths,
  listToText,
  removeModule,
  textToList,
  updateModule,
} from "@/features/detailed-design/moduleListOps";

// 段階4のモジュール一覧の表(パス / 層 / 責務 / 主な依存先 / 関わる処理)。編集した内容は onChange で
// 呼び出し元(StructurePanel)へ返し、保存は呼び出し元が行う。層は構成図のレーンから選ぶ(構成図に無い層は
// 「構成図に無い」と添えて残す。検証の警告と同じ)。「全処理」を選んだ行は、関わる処理の欄を使わない
// (Phase 19)。
export function ModuleListTable({
  layers,
  model,
  disabled,
  onChange,
}: {
  layers: string[]; // 構成図(エディタで編集中の内容)の層
  model: ModuleListModel;
  disabled: boolean;
  onChange: (model: ModuleListModel) => void;
}) {
  const duplicated = duplicatePaths(model);

  return (
    <YStack gap="$2">
      <Text fontWeight="700">モジュール一覧</Text>
      <Paragraph color="$color11" fontSize="$2">
        ファイル単位の責務表です。パスは段階5の手順の呼び出し先になります。依存先と関わる処理は「,」で区切ります(依存先は、一覧のモジュールはパスで、外部のライブラリは名前で書きます)。
      </Paragraph>
      {model.modules.length === 0 ? (
        <Text color="$color11">モジュールはまだありません。</Text>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={TABLE}>
            <thead>
              <tr>
                <th style={HEAD}>パス</th>
                <th style={HEAD}>層</th>
                <th style={HEAD}>責務</th>
                <th style={HEAD}>主な依存先</th>
                <th style={HEAD}>関わる処理</th>
                <th style={HEAD} />
              </tr>
            </thead>
            <tbody>
              {model.modules.map((row, index) => {
                const label = row.path.trim() || `${index + 1}行目`;
                const update = (patch: Parameters<typeof updateModule>[2]) =>
                  onChange(updateModule(model, index, patch));
                return (
                  // 行はパスで引かない(パスは書き換える欄で、重複もありうるため)
                  <tr key={index}>
                    <td style={{ ...CELL, minWidth: 240 }}>
                      <input
                        style={{ ...INPUT, ...MONO }}
                        aria-label={`${label} のパス`}
                        value={row.path}
                        disabled={disabled}
                        onChange={(e) => update({ path: e.target.value })}
                      />
                      {duplicated.has(row.path.trim()) ? (
                        <div style={{ fontSize: 11, color: "var(--red10)" }}>パスが重複しています</div>
                      ) : null}
                    </td>
                    <td style={{ ...CELL, minWidth: 110 }}>
                      <select
                        style={INPUT}
                        aria-label={`${label} の層`}
                        value={row.layer}
                        disabled={disabled}
                        onChange={(e) => update({ layer: e.target.value })}
                      >
                        {layers.includes(row.layer) ? null : (
                          <option value={row.layer} style={OPTION}>
                            {row.layer ? `${row.layer}(構成図に無い)` : "(未選択)"}
                          </option>
                        )}
                        {layers.map((layer) => (
                          <option key={layer} value={layer} style={OPTION}>
                            {layer}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={{ ...CELL, minWidth: 220 }}>
                      <input
                        style={INPUT}
                        aria-label={`${label} の責務`}
                        value={row.responsibility}
                        disabled={disabled}
                        onChange={(e) => update({ responsibility: e.target.value })}
                      />
                    </td>
                    <td style={{ ...CELL, minWidth: 200 }}>
                      <ListInput
                        style={{ ...INPUT, ...MONO }}
                        label={`${label} の主な依存先`}
                        items={row.depends_on}
                        disabled={disabled}
                        onChange={(items) => update({ depends_on: items })}
                      />
                    </td>
                    <td style={{ ...CELL, minWidth: 150 }}>
                      <label style={{ display: "flex", gap: 4, alignItems: "center", fontSize: 12 }}>
                        <input
                          type="checkbox"
                          aria-label={`${label} は全処理`}
                          checked={row.all_functions}
                          disabled={disabled}
                          onChange={(e) => update({ all_functions: e.target.checked })}
                        />
                        全処理
                      </label>
                      {row.all_functions ? null : (
                        <ListInput
                          style={{ ...INPUT, ...MONO }}
                          label={`${label} の関わる処理`}
                          items={row.functions}
                          disabled={disabled}
                          onChange={(items) => update({ functions: items })}
                        />
                      )}
                    </td>
                    <td style={CELL}>
                      <button
                        type="button"
                        aria-label={`${label} を削除`}
                        disabled={disabled}
                        onClick={() => onChange(removeModule(model, index))}
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <YStack alignItems="flex-start">
        <StyledButton
          theme="gray"
          disabled={disabled}
          onPress={() => onChange(addModule(model, layers))}
        >
          モジュールを追加
        </StyledButton>
      </YStack>
    </YStack>
  );
}

// 「,」区切りの入力欄。入力中の文字列(末尾の「, 」など)は手元に持ち、配列に直した値だけを返す。
// 配列から作り直すと、区切りの「,」を打った瞬間に消えて次の項目を書けないため。外から値が変わった
// (行の削除など)ときは、手元の文字列を作り直す。
function ListInput({
  label,
  items,
  disabled,
  style,
  onChange,
}: {
  label: string;
  items: string[];
  disabled: boolean;
  style: CSSProperties;
  onChange: (items: string[]) => void;
}) {
  const [text, setText] = useState(() => listToText(items));
  const parsed = textToList(text);
  const current =
    parsed.length === items.length && parsed.every((item, i) => item === items[i])
      ? text
      : listToText(items);

  return (
    <input
      style={style}
      aria-label={label}
      value={current}
      disabled={disabled}
      onChange={(e) => {
        setText(e.target.value);
        onChange(textToList(e.target.value));
      }}
    />
  );
}
