// 作成：Phase-17-8
// 写経レベル: コア ── 行ごとに保存し、段階の一覧とエディタのデータ項目を取り直すこと。
"use client";

import { useCallback, useEffect, useState } from "react";
import { Paragraph, Text, XStack, YStack } from "tamagui";
import { StyledButton } from "@/components/ui/primitives/StyledButton";
import { CELL, HEAD, INPUT, MONO, TABLE } from "@/features/detailed-design/components/tableStyles";
import {
  fieldsToText,
  isDuplicateName,
  textToFields,
} from "@/features/detailed-design/dataDictionaryOps";
import { useDetailedDesignStore } from "@/features/detailed-design/detailed-design-store";
import { ApiError } from "@/lib/api/client";
import {
  createDataItem,
  deleteDataItem,
  listDataItems,
  updateDataItem,
} from "@/features/uml/api/umlApi";
import type { DataItemRead } from "@/features/uml/api/types";
import { useUmlEditorStore } from "@/features/uml/uml-editor-store";

const DELETE_CONFIRM =
  "このデータ項目を削除しますか?DFD の線がこの項目を参照していると、DFD の検証でエラーになります。";

// 行ごとの編集中の値(name・フィールドの入力欄の文字列)。新しい行は id が null。
type RowDraft = { id: string | null; name: string; fieldsText: string };

const toDraft = (item: DataItemRead): RowDraft => ({
  id: item.id,
  name: item.name,
  fieldsText: fieldsToText(item.fields),
});

function errorMessage(err: unknown): string {
  if (err instanceof ApiError && err.code === "DATA_ITEM_NAME_CONFLICT") {
    return "同じ名前のデータ項目があります。";
  }
  return err instanceof Error ? err.message : "データ辞書を保存できませんでした。";
}

// 段階2のデータ辞書の表。データ辞書はプロジェクト共通の data_items が正本で(DFD の線が id で参照する)、
// 段階の model には持たない。行ごとに保存・削除し、そのたびに段階の一覧を取り直す(承認済みの段階2は
// バックエンドが差し戻すため)。開いている DFD のエディタのデータ項目も同じ一覧に差し替える
// (線のラベルの名前を合わせるため)。
export function DataDictionaryTable({
  projectId,
  disabled,
}: {
  projectId: string;
  disabled: boolean; // 段階2の下書きを生成中(生成がデータ項目を足すので編集させない)
}) {
  const fetchStages = useDetailedDesignStore((s) => s.fetchStages);
  const [items, setItems] = useState<DataItemRead[] | null>(null);
  const [drafts, setDrafts] = useState<RowDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback((loaded: DataItemRead[]) => {
    setItems(loaded);
    setDrafts(loaded.map(toDraft));
    useUmlEditorStore.setState({ dataItems: loaded });
  }, []);

  const reload = async () => apply(await listDataItems(projectId));

  useEffect(() => {
    if (disabled) return;
    let active = true;
    listDataItems(projectId)
      .then((loaded) => {
        if (active) apply(loaded);
      })
      .catch(() => {
        if (active) setError("データ辞書を読み込めませんでした。");
      });
    return () => {
      active = false;
    };
  }, [disabled, projectId, apply]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await reload();
      await fetchStages(projectId);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const saveRow = (draft: RowDraft) => {
    const original = items?.find((item) => item.id === draft.id);
    const payload = {
      name: draft.name.trim(),
      fields: textToFields(draft.fieldsText, original?.fields ?? []),
    };
    if (isDuplicateName(payload.name, items ?? [], draft.id)) {
      setError("同じ名前のデータ項目があります。");
      return;
    }
    void run(() =>
      draft.id === null
        ? createDataItem(projectId, payload)
        : updateDataItem(projectId, draft.id, payload),
    );
  };

  const isChanged = (draft: RowDraft) => {
    if (draft.id === null) return draft.name.trim().length > 0;
    const original = items?.find((item) => item.id === draft.id);
    return (
      original !== undefined &&
      (original.name !== draft.name || fieldsToText(original.fields) !== draft.fieldsText)
    );
  };

  const patch = (index: number, value: Partial<RowDraft>) =>
    setDrafts((rows) => rows.map((row, i) => (i === index ? { ...row, ...value } : row)));

  return (
    <YStack gap="$2">
      <Text fontWeight="700">データ辞書</Text>
      <Paragraph color="$color11" fontSize="$2">
        DFD の線に流れるデータの名前とフィールドです(プロジェクトの全 DFD で共通)。フィールドは「名前:型」を「,」で区切ります。行ごとに保存します。
      </Paragraph>
      {error ? (
        <Text role="alert" color="$red10">
          {error}
        </Text>
      ) : null}
      {disabled ? (
        // 生成がデータ項目を足すので、終わるまで表を出さない(編集させない)
        <Text role="status" color="$color11">
          生成中
        </Text>
      ) : items === null ? (
        <Text color="$color11">読み込み中...</Text>
      ) : (
        <>
          <div style={{ overflowX: "auto" }}>
            <table style={TABLE}>
              <thead>
                <tr>
                  <th style={HEAD}>名前</th>
                  <th style={HEAD}>フィールド</th>
                  <th style={HEAD} />
                </tr>
              </thead>
              <tbody>
                {drafts.map((draft, index) => {
                  const label = draft.name || "新しいデータ項目";
                  return (
                    <tr key={draft.id ?? `new-${index}`}>
                      <td style={{ ...CELL, minWidth: 140 }}>
                        <input
                          style={INPUT}
                          aria-label={`データ項目「${label}」の名前`}
                          value={draft.name}
                          onChange={(e) => patch(index, { name: e.target.value })}
                        />
                      </td>
                      <td style={{ ...CELL, minWidth: 320 }}>
                        <input
                          style={{ ...INPUT, ...MONO }}
                          aria-label={`データ項目「${label}」のフィールド`}
                          value={draft.fieldsText}
                          onChange={(e) => patch(index, { fieldsText: e.target.value })}
                        />
                      </td>
                      <td style={{ ...CELL, whiteSpace: "nowrap" }}>
                        <button
                          type="button"
                          aria-label={`データ項目「${label}」を保存`}
                          disabled={busy || !isChanged(draft)}
                          onClick={() => saveRow(draft)}
                        >
                          保存
                        </button>{" "}
                        <button
                          type="button"
                          aria-label={`データ項目「${label}」を削除`}
                          disabled={busy}
                          onClick={() => {
                            if (draft.id === null) {
                              setDrafts((rows) => rows.filter((_, i) => i !== index));
                            } else if (window.confirm(DELETE_CONFIRM)) {
                              const id = draft.id;
                              void run(() => deleteDataItem(projectId, id));
                            }
                          }}
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
          <XStack>
            <StyledButton
              size="$3"
              theme="gray"
              disabled={busy}
              onPress={() =>
                setDrafts((rows) => [...rows, { id: null, name: "", fieldsText: "" }])
              }
            >
              データ項目を追加
            </StyledButton>
          </XStack>
        </>
      )}
    </YStack>
  );
}
