// 作成：Phase-25-2｜更新：Phase-25-5
"use client";

// Phase-25-5:追記 ── ./SequenceSection.SequenceSection
import { useMemo, useState, type CSSProperties } from "react";
import { Button, H2, H3, Paragraph, Text, XStack, YStack } from "tamagui";
import { BADGE, CELL, HEAD, MONO, TABLE } from "@/features/detailed-design/components/tableStyles";
import { saveFile } from "@/lib/api/download";
import { DEMO_CONTEXT, DEMO_FINDINGS, DEMO_SOURCES, DEMO_UNITS } from "./demoData";
import { SequenceSection } from "./SequenceSection";
import {
  KIND_LABEL,
  SEVERITIES,
  SEVERITY_LABEL,
  SOURCE_LABEL,
  countBySeverity,
  expandRef,
  findingsOf,
  refLabel,
  sortFindings,
  sortUnitsByDependency,
  toAiMarkdown,
  toUnitMarkdown,
  unresolvedRefs,
  type DesignRef,
  type Finding,
  type Severity,
  type Unit,
} from "./procedureDocModel";

// 実装手順書(段階8)の画面の見せ方を、仮データで確かめるデモページ。バックエンドとは通信しない。
// 単位の一覧(依存順)・全体の未定義の一覧・単位の詳細(参照の展開・AI 向けのコピー)を並べる。

// 1回に生成できる単位の数(段階5・6と同じ上限)
const GENERATE_LIMIT = 5;

const SEVERITY_COLOR: Record<Severity, string> = {
  critical: "var(--red10)",
  major: "var(--orange10)",
  minor: "var(--color10)",
};
const PRE: CSSProperties = {
  ...MONO,
  whiteSpace: "pre-wrap",
  margin: 0,
  padding: 8,
  background: "var(--color2)",
  borderRadius: 4,
  color: "var(--color)",
};
const SELECTED_BG = "var(--yellow4, #fdf3c4)";

const refKey = (ref: DesignRef) => `${ref.kind}:${ref.key}`;

function SeverityCounts({ findings }: { findings: Finding[] }) {
  const counts = countBySeverity(findings);
  if (findings.length === 0) return <Text fontSize="$2">なし</Text>;
  return (
    <XStack gap="$2" flexWrap="wrap">
      {SEVERITIES.filter((s) => counts[s] > 0).map((s) => (
        <span key={s} style={{ color: SEVERITY_COLOR[s], fontSize: 12, whiteSpace: "nowrap" }}>
          {SEVERITY_LABEL[s]} {counts[s]}
        </span>
      ))}
    </XStack>
  );
}

function FindingTable({
  findings,
  showUnit,
  onAction,
}: {
  findings: Finding[];
  showUnit: boolean;
  onAction: (message: string) => void;
}) {
  if (findings.length === 0) return <Text fontSize="$2">未定義・要決定はありません。</Text>;
  const head = ["重要度", "出どころ", ...(showUnit ? ["単位"] : []), "対象", "内容", "操作"];
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={TABLE} aria-label={showUnit ? "全体の未定義・要決定" : "この単位の未定義・要決定"}>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} style={HEAD}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortFindings(findings).map((f, i) => (
            <tr key={`${f.unitId}-${f.target}-${i}`}>
              <td style={{ ...CELL, color: SEVERITY_COLOR[f.severity], whiteSpace: "nowrap" }}>
                {SEVERITY_LABEL[f.severity]}
              </td>
              <td style={{ ...CELL, whiteSpace: "nowrap" }}>{SOURCE_LABEL[f.source]}</td>
              {showUnit && <td style={{ ...CELL, ...MONO, whiteSpace: "nowrap" }}>{f.unitId ?? "全体"}</td>}
              <td style={CELL}>{f.target}</td>
              <td style={CELL}>{f.message}</td>
              <td style={CELL}>
                <XStack gap="$1" flexWrap="wrap">
                  <Button size="$2" onPress={() => onAction(`(デモ)段階${f.stage}の画面へ移り、「${f.target}」を直します。`)}>
                    {`段階${f.stage}で直す`}
                  </Button>
                  <Button size="$2" chromeless onPress={() => onAction(`(デモ)「${f.message}」について、AI に案を求めます。`)}>
                    AI に提案を求める
                  </Button>
                </XStack>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UnitList({
  units,
  selectedId,
  checked,
  onSelect,
  onToggle,
}: {
  units: Unit[];
  selectedId: string;
  checked: Set<string>;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
}) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={TABLE} aria-label="単位の一覧">
        <thead>
          <tr>
            {["生成", "単位", "種別", "タスク", "処理", "依存", "手順書", "未定義"].map((h) => (
              <th key={h} style={HEAD}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {units.map((unit) => (
            <tr key={unit.id} style={{ background: unit.id === selectedId ? SELECTED_BG : undefined }}>
              <td style={CELL}>
                {unit.detail ? null : (
                  <input
                    type="checkbox"
                    aria-label={`${unit.id} を生成する`}
                    checked={checked.has(unit.id)}
                    onChange={() => onToggle(unit.id)}
                  />
                )}
              </td>
              <td style={CELL}>
                <button
                  type="button"
                  style={{ ...BADGE, cursor: "pointer" }}
                  aria-label={`${unit.id} を開く`}
                  onClick={() => onSelect(unit.id)}
                >
                  {unit.id}
                </button>
              </td>
              <td style={{ ...CELL, whiteSpace: "nowrap" }}>{KIND_LABEL[unit.kind]}</td>
              <td style={CELL}>{unit.title}</td>
              <td style={{ ...CELL, ...MONO }}>{unit.functionIds.join(", ") || "—"}</td>
              <td style={{ ...CELL, ...MONO }}>{unit.dependsOn.join(", ") || "—"}</td>
              <td style={{ ...CELL, whiteSpace: "nowrap" }}>{unit.detail ? "生成済" : "未生成"}</td>
              <td style={CELL}>{unit.detail ? <SeverityCounts findings={findingsOf(DEMO_FINDINGS, unit.id)} /> : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UnitDetailView({ unit, onAction }: { unit: Unit; onAction: (message: string) => void }) {
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);
  const findings = findingsOf(DEMO_FINDINGS, unit.id);
  const d = unit.detail;

  if (!d) {
    return (
      <YStack gap="$2" aria-label="単位の詳細">
        <H3>
          {unit.id} {unit.title}
        </H3>
        <Paragraph>この単位の手順書はまだ生成していません。一覧で選んで生成します(1回に{GENERATE_LIMIT}件まで)。</Paragraph>
      </YStack>
    );
  }

  const missing = new Set(unresolvedRefs(d.refs, DEMO_SOURCES).map(refKey));
  const toggle = (key: string) =>
    setOpened((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const copyForAi = async () => {
    await navigator.clipboard.writeText(toAiMarkdown(unit, findings, DEMO_SOURCES, DEMO_CONTEXT));
    setCopied(
      findings.length > 0
        ? `コピーしました。未定義・要決定が ${findings.length} 件残っています(最重要 ${countBySeverity(findings).critical} 件)。`
        : "コピーしました。",
    );
  };

  return (
    <YStack gap="$3" aria-label="単位の詳細">
      <YStack gap="$1">
        <H3>
          {unit.id} {unit.title}
        </H3>
        <Text fontSize="$2" color="$color10">
          種別: {KIND_LABEL[unit.kind]} / {unit.milestone} / 依存: {unit.dependsOn.join(", ") || "なし"}
        </Text>
      </YStack>

      <XStack gap="$2" flexWrap="wrap" alignItems="center">
        <Button size="$3" theme="blue" onPress={copyForAi}>
          AI 向けにコピー
        </Button>
        <Button
          size="$3"
          onPress={() => saveFile(`${unit.id}.md`, toUnitMarkdown(unit, findings, DEMO_SOURCES), "text/markdown")}
        >
          md をダウンロード
        </Button>
        {copied && (
          <Text fontSize="$2" role="status" color={findings.length > 0 ? "$orange10" : "$color"}>
            {copied}
          </Text>
        )}
      </XStack>

      <YStack gap="$1">
        <Text fontWeight="700">目的</Text>
        <Paragraph>{d.purpose}</Paragraph>
      </YStack>

      <YStack gap="$1">
        <Text fontWeight="700">対象の処理・参照する設計(押すと中身を展開)</Text>
        <XStack gap="$1" flexWrap="wrap">
          {d.refs.map((ref) => {
            const key = refKey(ref);
            const isMissing = missing.has(key);
            return (
              <button
                key={key}
                type="button"
                aria-pressed={opened.has(key)}
                disabled={isMissing}
                onClick={() => toggle(key)}
                style={{
                  ...BADGE,
                  cursor: isMissing ? "default" : "pointer",
                  ...(isMissing ? { color: "var(--red10)", borderColor: "var(--red8)", background: "var(--red2)" } : {}),
                }}
              >
                {refLabel(ref, DEMO_SOURCES)}
                {isMissing ? "(設計に無い)" : ""}
              </button>
            );
          })}
        </XStack>
        {d.refs
          .filter((ref) => opened.has(refKey(ref)))
          .map((ref) => (
            <pre key={refKey(ref)} style={PRE} aria-label={`${refLabel(ref, DEMO_SOURCES)} の中身`}>
              {expandRef(ref, DEMO_SOURCES)}
            </pre>
          ))}
      </YStack>

      {/* Phase-25-5:追記 */}
      {d.refs
        .filter((ref) => ref.kind === "procedure" && DEMO_SOURCES.procedures[ref.key])
        .map((ref) => (
          <SequenceSection
            key={ref.key}
            procedure={DEMO_SOURCES.procedures[ref.key]}
            sources={DEMO_SOURCES}
            unitFiles={d.files.map((f) => f.path)}
            tests={d.tests}
          />
        ))}

      <YStack gap="$1">
        <Text fontWeight="700">作成・変更するファイル(依存順)</Text>
        <div style={{ overflowX: "auto" }}>
          <table style={TABLE} aria-label="作成・変更するファイル">
            <thead>
              <tr>
                {["ファイル", "責務", "根拠"].map((h) => (
                  <th key={h} style={HEAD}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.files.map((f) => (
                <tr key={f.path}>
                  <td style={{ ...CELL, ...MONO }}>{f.path}</td>
                  <td style={CELL}>{f.responsibility}</td>
                  <td style={CELL}>{f.basis}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </YStack>

      <YStack gap="$1">
        <Text fontWeight="700">実装の要点(設計に書いていないことだけ)</Text>
        <ul style={{ margin: 0, paddingLeft: "1.5em", fontSize: 14, color: "var(--color)" }}>
          {d.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </YStack>

      <YStack gap="$1">
        <Text fontWeight="700">テスト観点</Text>
        <div style={{ overflowX: "auto" }}>
          <table style={TABLE} aria-label="テスト観点">
            <thead>
              <tr>
                {["#", "観点", "SUT", "ドライバ", "スタブ"].map((h) => (
                  <th key={h} style={HEAD}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.tests.map((t) => (
                <tr key={t.id}>
                  <td style={{ ...CELL, ...MONO }}>{t.id}</td>
                  <td style={CELL}>{t.viewpoint}</td>
                  <td style={{ ...CELL, ...MONO }}>{t.sut}</td>
                  <td style={CELL}>{t.driver}</td>
                  <td style={CELL}>{t.stub}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {d.gwt.length > 0 && (
          <ul style={{ margin: 0, paddingLeft: "1.5em", fontSize: 13, color: "var(--color)" }}>
            {d.gwt.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        )}
      </YStack>

      <YStack gap="$1">
        <Text fontWeight="700">確認方法</Text>
        <ul style={{ margin: 0, paddingLeft: "1.5em", fontSize: 14, color: "var(--color)" }}>
          {d.verify.map((v) => (
            <li key={v}>{v}</li>
          ))}
        </ul>
      </YStack>

      <YStack gap="$1">
        <Text fontWeight="700">未定義・要決定</Text>
        <FindingTable findings={findings} showUnit={false} onAction={onAction} />
      </YStack>
    </YStack>
  );
}

export function ImplementationProcedureDemoPageContent() {
  const { order, issues } = useMemo(() => sortUnitsByDependency(DEMO_UNITS), []);
  const [selectedId, setSelectedId] = useState("M-03-T01");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Severity | "all">("all");
  const [notice, setNotice] = useState<string | null>(null);

  const selected = order.find((u) => u.id === selectedId) ?? order[0];
  const generated = DEMO_UNITS.filter((u) => u.detail).map((u) => u.id);
  const allFindings = DEMO_FINDINGS.filter((f) => f.unitId === null || generated.includes(f.unitId));
  const shown = filter === "all" ? allFindings : allFindings.filter((f) => f.severity === filter);
  const counts = countBySeverity(allFindings);

  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < GENERATE_LIMIT) next.add(id);
      return next;
    });

  return (
    <YStack gap="$5" padding="$4" maxWidth={1200} width="100%" marginHorizontal="auto">
      <YStack gap="$2">
        <H2>実装手順書(段階8)デモ</H2>
        <Paragraph color="$color10">
          ステージ5で作る実装手順書の見せ方を、仮データで確かめるページです。題材はゴール3で Devex
          自身を題材に生成した段階1〜7で、appendix/implementation-procedure-sample/ の見本と同じ中身です。サーバーとは通信しません。
        </Paragraph>
      </YStack>

      {notice && (
        <XStack gap="$2" alignItems="center" role="status">
          <Text fontSize="$2" color="$blue10">
            {notice}
          </Text>
          <Button size="$1" chromeless onPress={() => setNotice(null)}>
            閉じる
          </Button>
        </XStack>
      )}

      <YStack gap="$2">
        <H3>単位の一覧(依存順)</H3>
        {issues.map((issue) => (
          <Text key={issue} color="$red10" fontSize="$2">
            {issue}
          </Text>
        ))}
        <UnitList units={order} selectedId={selected.id} checked={checked} onSelect={setSelectedId} onToggle={toggle} />
        <XStack gap="$2" alignItems="center" flexWrap="wrap">
          <Button
            size="$3"
            theme="green"
            disabled={checked.size === 0}
            opacity={checked.size === 0 ? 0.5 : 1}
            onPress={() => setNotice(`(デモ)${[...checked].join(", ")} の手順書を生成します。`)}
          >
            {`選んだ単位を生成する(${checked.size}/${GENERATE_LIMIT})`}
          </Button>
          <Text fontSize="$2" color="$color10">
            1回に{GENERATE_LIMIT}件まで。概要・前提・一覧・完了条件は生成せずに組み立てます。
          </Text>
        </XStack>
      </YStack>

      <YStack gap="$2">
        <H3>未定義・要決定(実装可能性チェック)</H3>
        <Paragraph fontSize="$2" color="$color10">
          「検証」は設計の ID・パス・依存先の突き合わせ、「AI」は手順書を生成する LLM の指摘です。対象の段階で直すと、その段階は差し戻され、手順書は「古い」になります。
        </Paragraph>
        <XStack gap="$2" flexWrap="wrap">
          <Button size="$2" theme={filter === "all" ? "blue" : undefined} onPress={() => setFilter("all")}>
            {`すべて(${allFindings.length})`}
          </Button>
          {SEVERITIES.map((s) => (
            <Button key={s} size="$2" theme={filter === s ? "blue" : undefined} onPress={() => setFilter(s)}>
              {`${SEVERITY_LABEL[s]}(${counts[s]})`}
            </Button>
          ))}
        </XStack>
        <FindingTable findings={shown} showUnit onAction={setNotice} />
      </YStack>

      <UnitDetailView key={selected.id} unit={selected} onAction={setNotice} />
    </YStack>
  );
}
