// 作成：Phase-11-4
// 写経レベル: コア ── 個別生成と一括生成(最大5件)、ER 部分図、旧形式の内部設計書の検知という生成対象の選び方。
"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, H3, Input, Text, XStack, YStack } from "tamagui";
import { CheckboxWithLabel } from "@/components/ui/form/CheckboxWithLabel";
import { isGenerating, useUmlStore } from "@/features/uml/uml-store";

// バックエンドの上限値(app/services/uml_generation_service.py)。
// 1回の生成指示で渡せる対象の数と、ER を1枚(全体図)で生成できるテーブル数。
export const MAX_SUBJECTS_PER_REQUEST = 5;
export const ER_WHOLE_DIAGRAM_TABLE_LIMIT = 30;

export function GenerationPanel({ projectId }: { projectId: string }) {
  const candidates = useUmlStore((s) => s.candidates);
  const diagrams = useUmlStore((s) => s.diagrams);
  const submitting = useUmlStore((s) => s.submitting);
  const generateError = useUmlStore((s) => s.generateError);
  const generate = useUmlStore((s) => s.generate);

  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [groupName, setGroupName] = useState("");

  if (!candidates) return null;

  if (candidates.internal_design_version === null) {
    return (
      <YStack gap="$2">
        <H3>設計図を生成する</H3>
        <Text color="$color11">
          内部設計書がまだありません。先にドキュメントを生成してください。
        </Text>
        <Link href={`/projects/${projectId}/documents`}>
          <Text color="$blue10">ドキュメント画面へ</Text>
        </Link>
      </YStack>
    );
  }

  // 生成中は受け付けない(バックエンドも 409 UML_GENERATION_IN_PROGRESS を返す)
  const disabled = submitting || isGenerating(diagrams);
  const erTooLarge = candidates.er_tables.length > ER_WHOLE_DIAGRAM_TABLE_LIMIT;

  const toggle = (list: string[], value: string, checked: boolean) =>
    checked ? [...list, value] : list.filter((v) => v !== value);

  return (
    <YStack gap="$4">
      <H3>設計図を生成する</H3>
      {generateError ? (
        <Text role="alert" color="$color9">
          {generateError}
        </Text>
      ) : null}

      <YStack gap="$2">
        <Text fontWeight="700">コンポーネント図</Text>
        <XStack>
          <Button
            size="$3"
            disabled={disabled}
            onPress={() => generate(projectId, { notation: "component", subjects: [] })}
          >
            コンポーネント図を生成
          </Button>
        </XStack>
      </YStack>

      <YStack gap="$2">
        <Text fontWeight="700">ER図</Text>
        {erTooLarge ? (
          <>
            <Text color="$color11">
              テーブルが{ER_WHOLE_DIAGRAM_TABLE_LIMIT}件を超えるため、対象のテーブルを選び、
              グループ名を付けて部分図として生成します。
            </Text>
            {candidates.er_tables.map((table) => (
              <CheckboxWithLabel
                key={table}
                label={table}
                checked={selectedTables.includes(table)}
                disabled={
                  !selectedTables.includes(table) &&
                  selectedTables.length >= ER_WHOLE_DIAGRAM_TABLE_LIMIT
                }
                onCheckedChange={(checked) =>
                  setSelectedTables((list) => toggle(list, table, checked === true))
                }
              />
            ))}
            <Input
              aria-label="グループ名"
              placeholder="グループ名(例: 認証まわり)"
              value={groupName}
              onChangeText={setGroupName}
            />
            <XStack>
              <Button
                size="$3"
                disabled={disabled || selectedTables.length === 0 || groupName.trim() === ""}
                onPress={() =>
                  generate(projectId, {
                    notation: "er",
                    subjects: [{ subject: groupName.trim(), tables: selectedTables }],
                  })
                }
              >
                ER部分図を生成
              </Button>
            </XStack>
          </>
        ) : (
          <XStack>
            <Button
              size="$3"
              disabled={disabled}
              onPress={() => generate(projectId, { notation: "er", subjects: [{ subject: "" }] })}
            >
              ER図(全体)を生成
            </Button>
          </XStack>
        )}
      </YStack>

      <YStack gap="$2">
        <Text fontWeight="700">データフロー図(処理ごと)</Text>
        {candidates.dfd_subjects.length === 0 ? (
          <Text role="alert" color="$color9">
            内部設計書に「処理別データフロー」節がありません(以前の形式の内部設計書です)。
            データフロー図を生成するには、内部設計書を再生成してください。
          </Text>
        ) : (
          <>
            {candidates.dfd_subjects.map((candidate) => (
              <XStack key={candidate.code} alignItems="center" gap="$3">
                <CheckboxWithLabel
                  label={`${candidate.code}: ${candidate.title}`}
                  checked={selectedSubjects.includes(candidate.title)}
                  disabled={
                    !selectedSubjects.includes(candidate.title) &&
                    selectedSubjects.length >= MAX_SUBJECTS_PER_REQUEST
                  }
                  onCheckedChange={(checked) =>
                    setSelectedSubjects((list) => toggle(list, candidate.title, checked === true))
                  }
                />
                <Button
                  size="$2"
                  disabled={disabled}
                  aria-label={`${candidate.title}を生成`}
                  onPress={() =>
                    generate(projectId, { notation: "dfd", subjects: [{ subject: candidate.title }] })
                  }
                >
                  生成
                </Button>
              </XStack>
            ))}
            <XStack>
              <Button
                size="$3"
                disabled={disabled || selectedSubjects.length === 0}
                onPress={() => {
                  void generate(projectId, {
                    notation: "dfd",
                    subjects: selectedSubjects.map((subject) => ({ subject })),
                  });
                  setSelectedSubjects([]);
                }}
              >
                {`選択した処理をまとめて生成(${selectedSubjects.length}/${MAX_SUBJECTS_PER_REQUEST})`}
              </Button>
            </XStack>
          </>
        )}
        {candidates.dfd_subjects.length === 0 ? (
          <Link href={`/projects/${projectId}/documents`}>
            <Text color="$blue10">ドキュメント画面で再生成する</Text>
          </Link>
        ) : null}
      </YStack>
    </YStack>
  );
}
