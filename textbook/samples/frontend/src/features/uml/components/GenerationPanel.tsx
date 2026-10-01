// 作成：Phase-11-4｜更新：Phase-15-8
// 写経レベル: コア ── 個別生成と一括生成(最大5件)、ER 部分図、旧形式の内部設計書の検知という生成対象の選び方。
"use client";

// Phase-15-8:追記 ── ConfirmDialog, UmlDiagramRead・UmlGenerateRequest(型), diagramTitle
// Phase-15-8：更新 ── 生成ボタン5か所の onPress の generate(projectId, …) を requestGenerate(…) に
//   置き換えた(承認済みの図が対象に含まれていれば、確認ダイアログを挟む。気づき#6)。JSX の属性の中には
//   タグを書けないため、ここにまとめて記す。

import { useState } from "react";
import Link from "next/link";
import { Button, H3, Input, Text, XStack, YStack } from "tamagui";
import { CheckboxWithLabel } from "@/components/ui/form/CheckboxWithLabel";
import { ConfirmDialog } from "@/components/ui/layout-blocks/ConfirmDialog";
import type { UmlDiagramRead, UmlGenerateRequest } from "@/features/uml/api/types";
import { diagramTitle } from "@/features/uml/labels";
import { isGenerating, useUmlStore } from "@/features/uml/uml-store";

// バックエンドの上限値(app/services/uml_generation_service.py)。
// 1回の生成指示で渡せる対象の数と、ER を1枚(全体図)で生成できるテーブル数。
export const MAX_SUBJECTS_PER_REQUEST = 5;
export const ER_WHOLE_DIAGRAM_TABLE_LIMIT = 30;

// Phase-15-8:追記
// 生成の対象のうち、承認済み(approved / exported)の図。再生成すると AI の出力で意味モデルを
// 置き換えるため、承認はやり直しになる(下書きへ戻る。気づき#6)。component・ER 全体図は
// 対象の指定(subjects)が空のとき subject が空文字の図になる。
export function approvedTargets(
  diagrams: UmlDiagramRead[],
  request: UmlGenerateRequest,
): UmlDiagramRead[] {
  const subjects = request.subjects?.length ? request.subjects.map((s) => s.subject) : [""];
  return diagrams.filter(
    (d) =>
      d.notation === request.notation &&
      subjects.includes(d.subject) &&
      (d.status === "approved" || d.status === "exported"),
  );
}

export function GenerationPanel({ projectId }: { projectId: string }) {
  const candidates = useUmlStore((s) => s.candidates);
  const diagrams = useUmlStore((s) => s.diagrams);
  const submitting = useUmlStore((s) => s.submitting);
  const generateError = useUmlStore((s) => s.generateError);
  const generate = useUmlStore((s) => s.generate);

  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [groupName, setGroupName] = useState("");
  // Phase-15-8:追記
  // 承認済みの図を再生成する前の確認(確認の対象になった生成の指示を持っておく)
  const [pending, setPending] = useState<UmlGenerateRequest | null>(null);

  if (!candidates) return null;

  // Phase-15-8:追記
  // 承認済みの図が対象に含まれていれば、確認してから生成する
  const requestGenerate = (request: UmlGenerateRequest) => {
    if (approvedTargets(diagrams, request).length > 0) {
      setPending(request);
      return;
    }
    void generate(projectId, request);
  };

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
            onPress={() => requestGenerate({ notation: "component", subjects: [] })}
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
                  requestGenerate({
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
              onPress={() => requestGenerate({ notation: "er", subjects: [{ subject: "" }] })}
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
                    requestGenerate({ notation: "dfd", subjects: [{ subject: candidate.title }] })
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
                  requestGenerate({
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

      {/* Phase-15-8:追記 */}
      <ConfirmDialog
        open={pending !== null}
        title="承認済みの図を再生成しますか"
        description={`次の図は承認済みです。再生成すると下書きに戻り、承認がやり直しになります: ${
          pending
            ? approvedTargets(diagrams, pending)
                .map((d) => diagramTitle(d))
                .join("、")
            : ""
        }`}
        confirmLabel="再生成する"
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (pending) void generate(projectId, pending);
          setPending(null);
        }}
      />
    </YStack>
  );
}
