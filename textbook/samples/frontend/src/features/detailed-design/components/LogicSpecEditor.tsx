// 作成：Phase-21-6
// 写経レベル: 定型 ── 仕様の表と擬似フローの入力欄。呼ばれる手順のバッジは押せるときだけ button にする。
"use client";

import { Paragraph, Text, XStack, YStack } from "tamagui";
import { StyledButton } from "@/components/ui/primitives/StyledButton";
import type { LogicModel, LogicRow } from "@/features/detailed-design/api/types";
import {
  BADGE,
  CELL,
  HEAD,
  INPUT,
  MONO,
  TABLE,
} from "@/features/detailed-design/components/tableStyles";
import {
  addPseudoStep,
  keyOf,
  removePseudoStep,
  subToText,
  textToSub,
  updateLogic,
  updatePseudoStep,
} from "@/features/detailed-design/logicOps";

// 仕様の表の行(見出し・欄・等幅で出すか)。並びは 06 の見本(デモの LogicSpec)と同じ。
type SpecField = keyof Omit<LogicRow, "module" | "function" | "pseudo">;
const SPEC_ROWS: { field: SpecField; label: string; mono?: boolean }[] = [
  { field: "signature", label: "シグネチャ", mono: true },
  { field: "args", label: "引数" },
  { field: "returns", label: "戻り値" },
  { field: "raises", label: "例外" },
  { field: "pre", label: "事前条件" },
  { field: "post", label: "事後条件" },
];

// 段階6の、1つの関数の詳細(シグネチャ/引数/戻り値/例外/事前条件/事後条件の表と、番号付きの擬似
// フロー)。見出しの下に「呼ばれる手順」のバッジを置く(段階5の手順から導いた手順ID)。編集した内容は
// onChange で呼び出し元(LogicPanel)へ返し、保存は呼び出し元が行う。onStepPress を渡すと、バッジを
// 押して段階5のその手順へ移れる(Phase 21)。擬似フローの下位の箇条は1行1箇条で書く。
export function LogicSpecEditor({
  model,
  logicKey,
  logicId,
  stepIds,
  disabled,
  onChange,
  onStepPress,
}: {
  model: LogicModel;
  logicKey: string;
  logicId: string;
  stepIds: string[]; // この関数を呼ぶ手順の手順ID
  disabled: boolean;
  onChange: (model: LogicModel) => void;
  onStepPress?: (stepId: string) => void;
}) {
  const row = model.logics.find((item) => keyOf(item) === logicKey);
  if (!row) return null;

  return (
    <YStack gap="$2">
      <Text fontWeight="700">
        {logicId} <span style={MONO}>{row.function}</span>
        <span style={{ ...MONO, color: "var(--color11)" }}>({row.module})</span>
      </Text>
      <XStack gap="$1" alignItems="center" flexWrap="wrap">
        <Text color="$color11" fontSize="$2">
          呼ばれる手順:
        </Text>
        {stepIds.length === 0 ? (
          <Text color="$red10" fontSize="$2">
            段階5にこの関数を呼ぶ手順がありません
          </Text>
        ) : (
          stepIds.map((id) =>
            onStepPress ? (
              <button
                key={id}
                type="button"
                style={{ ...BADGE, cursor: "pointer" }}
                aria-label={`手順 ${id} へ移る`}
                onClick={() => onStepPress(id)}
              >
                {id}
              </button>
            ) : (
              <span key={id} style={BADGE}>
                {id}
              </span>
            ),
          )
        )}
      </XStack>

      <div style={{ overflowX: "auto" }}>
        <table style={TABLE} aria-label={`${logicId} の仕様`}>
          <tbody>
            {SPEC_ROWS.map(({ field, label, mono }) => (
              <tr key={field}>
                <th style={{ ...HEAD, width: 100 }}>{label}</th>
                <td style={CELL}>
                  <textarea
                    style={{ ...INPUT, ...(mono ? MONO : {}), minHeight: 32, resize: "vertical" }}
                    aria-label={`${logicId} の${label}`}
                    value={row[field]}
                    disabled={disabled}
                    onChange={(e) => onChange(updateLogic(model, logicKey, { [field]: e.target.value }))}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Text fontWeight="700">擬似フロー</Text>
      {row.pseudo.length === 0 ? (
        <Text color="$color11">擬似フローはまだありません。下書きを生成するか、段を足してください。</Text>
      ) : (
        <ol style={{ margin: 0, paddingLeft: 24, color: "var(--color)" }}>
          {row.pseudo.map((step, index) => (
            // 段は位置で扱う(段の番号は並び順そのもので、段に固有の鍵が無い)
            <li key={index} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  style={INPUT}
                  aria-label={`${logicId} の擬似フロー ${index + 1}`}
                  value={step.text}
                  disabled={disabled}
                  onChange={(e) =>
                    onChange(updatePseudoStep(model, logicKey, index, { text: e.target.value }))
                  }
                />
                <button
                  type="button"
                  aria-label={`${logicId} の擬似フロー ${index + 1} を削除`}
                  disabled={disabled}
                  onClick={() => onChange(removePseudoStep(model, logicKey, index))}
                >
                  削除
                </button>
              </div>
              <textarea
                style={{ ...INPUT, marginTop: 4, minHeight: 32, resize: "vertical", fontSize: 12 }}
                aria-label={`${logicId} の擬似フロー ${index + 1} の箇条`}
                placeholder="条件の分かれ目・細かい手順(1行に1つ)"
                value={subToText(step.sub)}
                disabled={disabled}
                onChange={(e) =>
                  onChange(
                    updatePseudoStep(model, logicKey, index, { sub: textToSub(e.target.value) }),
                  )
                }
              />
            </li>
          ))}
        </ol>
      )}
      <YStack alignItems="flex-start">
        <StyledButton
          theme="gray"
          disabled={disabled}
          onPress={() => onChange(addPseudoStep(model, logicKey))}
        >
          段を足す
        </StyledButton>
      </YStack>
      <Paragraph color="$color11" fontSize="$2">
        L-ID は並び順から振ります。05 の手順とは、モジュールと関数の名前でつながります。
      </Paragraph>
    </YStack>
  );
}
