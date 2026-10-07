// 作成：Phase-25-5
"use client";

import { useMemo, useState } from "react";
import { Button, Text, XStack, YStack } from "tamagui";
import { CELL, HEAD, MONO, TABLE } from "@/features/detailed-design/components/tableStyles";
import type { DesignSources, ProcedureSource, TestPoint } from "./procedureDocModel";
import {
  reachableCallees,
  stubsOutsideSequence,
  sutParticipant,
  toSequence,
  type Sequence,
  type SequenceEvent,
} from "./sequenceModel";

// 段階5の手順から導いたシーケンス図(読み取り専用)と、手順書の単位との対応。
// - 単位で作るファイルのライフラインを強調する。
// - テスト観点を選ぶと、SUT と、そこから呼ぶ先(スタブの候補)を色で示し、手順書のスタブの欄と突き合わせる。
// 図は表の別の見え方なので、ここでは直さない(直すのは段階5の手順の表)。

const COL_W = 190;
const HEADER_H = 46;
const ROW_H = 34;
const TOP = 16;
const LABEL_CHARS = 26;

const short = (text: string) => (text.length > LABEL_CHARS ? `${text.slice(0, LABEL_CHARS - 1)}…` : text);
const stepNo = (stepId: string) => stepId.split("#")[1];

type Roles = { files: Set<string>; sut: string | null; stubs: Set<string> };

function participantFill(name: string, id: string, roles: Roles): string {
  if (id === roles.sut) return "var(--blue4)";
  if (roles.stubs.has(id)) return "var(--orange4)";
  if (roles.files.has(name)) return "var(--yellow4, #fdf3c4)";
  return "var(--color2)";
}

function EventRow({ event, y, x }: { event: SequenceEvent; y: number; x: (id: string) => number }) {
  if (event.type === "note") {
    const xs = event.over.map(x);
    const left = Math.min(...xs) - COL_W / 2 + 12;
    const width = Math.max(...xs) - Math.min(...xs) + COL_W - 24;
    return (
      <g>
        <title>{`${event.stepId} ${event.text}`}</title>
        <rect x={left} y={y - 12} width={width} height={22} rx={3} fill="var(--color3)" stroke="var(--color8)" />
        <text x={left + 6} y={y + 3} fontSize={11} fill="var(--color)">
          {short(`${stepNo(event.stepId)} ${event.text}`)}
        </text>
      </g>
    );
  }
  const x1 = x(event.from);
  const x2 = x(event.to);
  const dir = x2 >= x1 ? 1 : -1;
  const isReturn = event.kind === "return";
  const label = isReturn && event.derived ? `(${stepNo(event.stepId)} の戻り) ${event.label}` : `${stepNo(event.stepId)}: ${event.label}`;
  return (
    <g>
      <title>{`${event.stepId} ${label}`}</title>
      <line
        x1={x1}
        y1={y}
        x2={x2 - dir * 2}
        y2={y}
        stroke="var(--color11)"
        strokeWidth={1.3}
        strokeDasharray={isReturn ? "5 3" : undefined}
        markerEnd={event.kind === "call" ? "url(#seq-solid)" : "url(#seq-open)"}
      />
      <text x={(x1 + x2) / 2} y={y - 5} fontSize={11} textAnchor="middle" fill="var(--color)" fontStyle={event.derived ? "italic" : undefined}>
        {short(label)}
      </text>
    </g>
  );
}

export function SequenceDiagram({ sequence, roles }: { sequence: Sequence; roles: Roles }) {
  const index = new Map(sequence.participants.map((p, i) => [p.id, i]));
  const x = (id: string) => COL_W / 2 + (index.get(id) ?? 0) * COL_W;
  const width = sequence.participants.length * COL_W;
  const height = TOP + HEADER_H + (sequence.events.length + 1) * ROW_H;
  return (
    <div style={{ overflowX: "auto" }}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`段階5 ${sequence.procedureId} のシーケンス図`}
        style={{ fontFamily: "inherit", display: "block" }}
      >
        <defs>
          <marker id="seq-solid" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--color11)" />
          </marker>
          <marker id="seq-open" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
            <path d="M0,0 L10,5 L0,10" fill="none" stroke="var(--color11)" strokeWidth={1.5} />
          </marker>
        </defs>
        {sequence.participants.map((p) => (
          <g key={p.id} data-participant={p.name}>
            <line x1={x(p.id)} y1={TOP + HEADER_H} x2={x(p.id)} y2={height - 4} stroke="var(--color8)" strokeDasharray="4 4" />
            <rect
              x={x(p.id) - COL_W / 2 + 8}
              y={TOP}
              width={COL_W - 16}
              height={HEADER_H - 8}
              rx={4}
              fill={participantFill(p.name, p.id, roles)}
              stroke={p.id === roles.sut ? "var(--blue9)" : "var(--color8)"}
              strokeWidth={p.id === roles.sut ? 2 : 1}
            />
            <text x={x(p.id)} y={TOP + HEADER_H / 2} fontSize={11} textAnchor="middle" fill="var(--color)" fontFamily={MONO.fontFamily}>
              {short(p.name)}
            </text>
          </g>
        ))}
        {sequence.events.map((event, i) => (
          <EventRow key={`${event.stepId}-${i}`} event={event} y={TOP + HEADER_H + (i + 1) * ROW_H - 8} x={x} />
        ))}
      </svg>
    </div>
  );
}

export function SequenceSection({
  procedure,
  sources,
  unitFiles,
  tests,
}: {
  procedure: ProcedureSource;
  sources: DesignSources;
  unitFiles: string[];
  tests: TestPoint[];
}) {
  const sequence = useMemo(() => toSequence(procedure, sources.modules), [procedure, sources]);
  const [testId, setTestId] = useState<string | null>(null);
  const nameOf = (id: string) => sequence.participants.find((p) => p.id === id)?.name ?? id;
  const modulePaths = Object.keys(sources.modules);

  const rows = tests.map((t) => {
    const sut = sutParticipant(sequence, t.sut, procedure.trigger);
    const candidates = sut ? reachableCallees(sequence, sut) : [];
    const outside = sut ? stubsOutsideSequence(t.stub, candidates.map(nameOf), modulePaths) : [];
    return { test: t, sut, candidates, outside };
  });
  const selected = rows.find((r) => r.test.id === testId) ?? null;
  const roles: Roles = {
    files: new Set(unitFiles),
    sut: selected?.sut ?? null,
    stubs: new Set(selected?.candidates ?? []),
  };

  return (
    <YStack gap="$2" aria-label={`${procedure.id} のシーケンス図`}>
      <Text fontWeight="700">シーケンス図(段階5 {procedure.id} の手順から導出。直すときは手順の表を直す)</Text>
      <XStack gap="$3" flexWrap="wrap">
        <Text fontSize="$2">
          <span style={{ background: "var(--yellow4, #fdf3c4)", padding: "0 4px" }}>黄</span> この単位で作るファイル
        </Text>
        <Text fontSize="$2">
          <span style={{ background: "var(--blue4)", padding: "0 4px" }}>青</span> 選んだテストの SUT
        </Text>
        <Text fontSize="$2">
          <span style={{ background: "var(--orange4)", padding: "0 4px" }}>橙</span> スタブの候補(SUT から呼ぶ先)
        </Text>
        <Text fontSize="$2">破線は戻り、斜体は手順に無く推測した戻り</Text>
      </XStack>
      <SequenceDiagram sequence={sequence} roles={roles} />
      {sequence.issues.length > 0 && (
        <YStack gap="$1" aria-label="図にするときの指摘">
          {sequence.issues.map((issue) => (
            <Text key={`${issue.stepId}-${issue.message}`} fontSize="$2" color="$orange10">
              検証 {issue.stepId}: {issue.message}
            </Text>
          ))}
        </YStack>
      )}
      <div style={{ overflowX: "auto" }}>
        <table style={TABLE} aria-label="テスト観点とスタブの候補">
          <thead>
            <tr>
              {["テスト", "SUT(図の参加者)", "スタブの候補(図から)", "手順書のスタブとの突き合わせ"].map((h) => (
                <th key={h} style={HEAD}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.test.id}>
                <td style={CELL}>
                  <Button
                    size="$2"
                    theme={testId === r.test.id ? "blue" : undefined}
                    onPress={() => setTestId(testId === r.test.id ? null : r.test.id)}
                  >
                    {r.test.id}
                  </Button>
                </td>
                <td style={{ ...CELL, ...MONO }}>{r.sut ? nameOf(r.sut) : "図に無い(画面など)"}</td>
                <td style={{ ...CELL, ...MONO }}>{r.sut ? r.candidates.map(nameOf).join(", ") || "なし" : "—"}</td>
                <td style={CELL}>
                  {r.outside.length > 0 ? (
                    <span style={{ color: "var(--orange10)" }}>
                      スタブに、手順に無い依存がある: {r.outside.join(", ")}
                    </span>
                  ) : r.sut ? (
                    "食い違いなし"
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </YStack>
  );
}
