// 作成：Phase-23-6｜更新：Phase-26-5
// 写経レベル: 定型 ── 表の入力欄の並びが大半。
"use client";

// Phase-26-5：更新 ── import の TASK_AREAS・TaskArea を UNIT_KINDS・UnitKind に替え、UNIT_KIND_LABELS・milestoneFunctions・moveTask・taskId を足した
import { Paragraph, Text, XStack, YStack } from "tamagui";
import { StyledButton } from "@/components/ui/primitives/StyledButton";
import {
  PRIORITIES,
  UNIT_KINDS,
  type PlanModel,
  type Priority,
  type UnitKind,
} from "@/features/detailed-design/api/types";
import { ListInput } from "@/features/detailed-design/components/ListInput";
import {
  CELL,
  HEAD,
  INPUT,
  MONO,
  OPTION,
  TABLE,
} from "@/features/detailed-design/components/tableStyles";
import { UNIT_KIND_LABELS } from "@/features/detailed-design/labels";
import {
  addCrossCutting,
  addMilestone,
  addRisk,
  addTask,
  milestoneFunctions,
  milestoneId,
  missingTopics,
  moveMilestone,
  moveTask,
  removeCrossCutting,
  removeMilestone,
  removeRisk,
  removeTask,
  taskId,
  updateCrossCutting,
  updateMilestone,
  updateRisk,
  updateTask,
} from "@/features/detailed-design/planOps";

// 段階7の表(横断事項・マイルストーンとタスク・リスク)。どれも編集した PlanModel 全体を onChange で
// 呼び出し元(PlanPanel)へ返し、保存は呼び出し元が行う(段階4の ModuleListTable と同じ形。Phase 23)。
type TableProps = {
  model: PlanModel;
  disabled: boolean;
  onChange: (model: PlanModel) => void;
};

// 07 横断事項の表(項目 / 方針 / 関わるファイル(例))。既定の項目のうち行の無いものは、ボタンで足せる。
export function CrossCuttingTable({ model, disabled, onChange }: TableProps) {
  const missing = missingTopics(model);
  return (
    <YStack gap="$2">
      <Text fontWeight="700">07 横断事項</Text>
      <Paragraph color="$color11" fontSize="$2">
        全処理に共通する実装の方針です。詳細設計書の07章になります。関わるファイルは例として「,」で区切って書きます(段階4のモジュール一覧のパスや設定のファイル。検証はしません)。
      </Paragraph>
      {model.crosscutting.length === 0 ? (
        <Text color="$color11">横断事項はまだありません。</Text>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={TABLE}>
            <thead>
              <tr>
                <th style={HEAD}>項目</th>
                <th style={HEAD}>方針</th>
                <th style={HEAD}>関わるファイル(例)</th>
                <th style={HEAD} />
              </tr>
            </thead>
            <tbody>
              {model.crosscutting.map((row, index) => {
                const label = row.topic.trim() || `横断事項の${index + 1}行目`;
                const update = (patch: Parameters<typeof updateCrossCutting>[2]) =>
                  onChange(updateCrossCutting(model, index, patch));
                return (
                  <tr key={index}>
                    <td style={{ ...CELL, minWidth: 140 }}>
                      <input
                        style={INPUT}
                        aria-label={`${label} の項目`}
                        value={row.topic}
                        disabled={disabled}
                        onChange={(e) => update({ topic: e.target.value })}
                      />
                    </td>
                    <td style={{ ...CELL, minWidth: 320 }}>
                      <textarea
                        style={INPUT}
                        rows={2}
                        aria-label={`${label} の方針`}
                        value={row.policy}
                        disabled={disabled}
                        onChange={(e) => update({ policy: e.target.value })}
                      />
                    </td>
                    <td style={{ ...CELL, minWidth: 220 }}>
                      <ListInput
                        style={{ ...INPUT, ...MONO }}
                        label={`${label} の関わるファイル`}
                        items={row.modules}
                        disabled={disabled}
                        onChange={(modules) => update({ modules })}
                      />
                    </td>
                    <td style={CELL}>
                      <button
                        type="button"
                        aria-label={`${label} を削除`}
                        disabled={disabled}
                        onClick={() => onChange(removeCrossCutting(model, index))}
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
      <XStack gap="$2" flexWrap="wrap">
        <StyledButton theme="gray" disabled={disabled} onPress={() => onChange(addCrossCutting(model))}>
          項目を追加
        </StyledButton>
        {missing.map((topic) => (
          <StyledButton
            key={topic}
            theme="gray"
            disabled={disabled}
            onPress={() => onChange(addCrossCutting(model, topic))}
          >
            {`「${topic}」を追加`}
          </StyledButton>
        ))}
      </XStack>
    </YStack>
  );
}

// Phase-26-5：更新(コメント: 処理を導くことと、単位の ID の振り直し)
// マイルストーンの一覧。マイルストーンごとに、名前・優先度・ゴールと、タスク(作業単位)の表を持つ。
// 番号(M-01…)と単位の ID(M-01-T01…)は並び順から振るので、上下に動かすと振り直される
// (依存先の ID も付け替わる)。マイルストーンの処理は、タスクの処理から導いて見せるだけにする。
export function MilestoneList({ model, disabled, onChange }: TableProps) {
  return (
    <YStack gap="$3">
      <Text fontWeight="700">マイルストーン</Text>
      <Paragraph color="$color11" fontSize="$2">
        {/* Phase-26-5：更新
        動くものを段階的に増やす順に並べます。処理は段階1の処理ID を「,」で区切ります。ファイルは作成・変更するファイルの例で、環境・設定のファイル(Dockerfile など)も書けます(検証はしません)。どのマイルストーンにも入らない処理は、検証で警告されます。
        ↓↓ */}
        動くものを段階的に増やす順に並べます。タスクは実装手順書の作業単位です。処理を動くようにするタスクは「機能」にして、バックエンド・フロントエンド・テストを1つにまとめます(原則1処理)。処理の無い準備・デプロイは「基盤」にします。処理・依存・ファイルは「,」で区切ります。依存には、先に終わっている必要がある前の単位の ID を書きます。モジュールは段階4のモジュール一覧のパスで、検証されます。Dockerfile などは環境・設定のファイルの欄に書きます(例として扱い、検証しません)。
      </Paragraph>
      {model.milestones.length === 0 ? (
        <Text color="$color11">マイルストーンはまだありません。</Text>
      ) : null}
      {model.milestones.map((milestone, index) => {
        const id = milestoneId(index);
        const update = (patch: Parameters<typeof updateMilestone>[2]) =>
          onChange(updateMilestone(model, index, patch));
        return (
          <YStack
            key={index}
            gap="$2"
            padding="$3"
            borderWidth={1}
            borderColor="$borderColor"
            borderRadius="$4"
            aria-label={`${id} のマイルストーン`}
          >
            <XStack gap="$2" alignItems="center" flexWrap="wrap">
              <span style={{ ...MONO, fontWeight: 700 }}>{id}</span>
              <input
                style={{ ...INPUT, width: 260 }}
                aria-label={`${id} の名前`}
                value={milestone.name}
                disabled={disabled}
                onChange={(e) => update({ name: e.target.value })}
              />
              <select
                style={{ ...INPUT, width: 100 }}
                aria-label={`${id} の優先度`}
                value={milestone.priority}
                disabled={disabled}
                onChange={(e) => update({ priority: e.target.value as Priority })}
              >
                {PRIORITIES.map((priority) => (
                  <option key={priority} value={priority} style={OPTION}>
                    {priority}
                  </option>
                ))}
              </select>
              <button
                type="button"
                aria-label={`${id} を上へ`}
                disabled={disabled || index === 0}
                onClick={() => onChange(moveMilestone(model, index, -1))}
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={`${id} を下へ`}
                disabled={disabled || index === model.milestones.length - 1}
                onClick={() => onChange(moveMilestone(model, index, 1))}
              >
                ↓
              </button>
              <button
                type="button"
                aria-label={`${id} を削除`}
                disabled={disabled}
                onClick={() => onChange(removeMilestone(model, index))}
              >
                削除
              </button>
            </XStack>
            <label style={{ fontSize: 12 }}>
              ゴール
              <input
                style={INPUT}
                aria-label={`${id} のゴール`}
                value={milestone.goal}
                disabled={disabled}
                onChange={(e) => update({ goal: e.target.value })}
              />
            </label>
            {/* Phase-26-5：更新(処理はタスクから導いて見せるだけにした)
            <label style={{ fontSize: 12 }}>
              動くようにする処理
              <ListInput
                style={{ ...INPUT, ...MONO }}
                label={`${id} の処理`}
                items={milestone.function_ids}
                disabled={disabled}
                onChange={(function_ids) => update({ function_ids })}
              />
            </label>
            ↓↓ */}
            <Text fontSize="$2" color="$color11" aria-label={`${id} の処理`}>
              {`動くようにする処理: ${milestoneFunctions(milestone).join(", ") || "なし"}`}
            </Text>
            <TaskTable model={model} milestone={index} disabled={disabled} onChange={onChange} />
          </YStack>
        );
      })}
      <YStack alignItems="flex-start">
        <StyledButton theme="gray" disabled={disabled} onPress={() => onChange(addMilestone(model))}>
          マイルストーンを追加
        </StyledButton>
      </YStack>
    </YStack>
  );
}

// Phase-26-5：更新
// // マイルストーン1つのタスクの表(区分 / タスク / 作成・変更するファイル(例) / 処理)。
// function TaskTable({
//   model,
//   milestone,
//   disabled,
//   onChange,
// }: TableProps & { milestone: number }) {
//   const id = milestoneId(milestone);
//   const tasks = model.milestones[milestone].tasks;
//   return (
//     <YStack gap="$2">
//       {tasks.length === 0 ? (
//         <Text color="$color11" fontSize="$2">
//           タスクはまだありません。
//         </Text>
//       ) : (
//         <div style={{ overflowX: "auto" }}>
//           <table style={TABLE} aria-label={`${id} のタスク`}>
//             <thead>
//               <tr>
//                 <th style={HEAD}>区分</th>
//                 <th style={HEAD}>タスク</th>
//                 <th style={HEAD}>作成・変更するファイル(例)</th>
//                 <th style={HEAD}>処理</th>
//                 <th style={HEAD} />
//               </tr>
//             </thead>
//             <tbody>
//               {tasks.map((task, index) => {
//                 const label = `${id} のタスク${index + 1}`;
//                 const update = (patch: Parameters<typeof updateTask>[3]) =>
//                   onChange(updateTask(model, milestone, index, patch));
//                 return (
//                   <tr key={index}>
//                     <td style={{ ...CELL, minWidth: 120 }}>
//                       <select
//                         style={INPUT}
//                         aria-label={`${label} の区分`}
//                         value={task.area}
//                         disabled={disabled}
//                         onChange={(e) => update({ area: e.target.value as TaskArea })}
//                       >
//                         {TASK_AREAS.map((area) => (
//                           <option key={area} value={area} style={OPTION}>
//                             {area}
//                           </option>
//                         ))}
//                       </select>
//                     </td>
//                     <td style={{ ...CELL, minWidth: 260 }}>
//                       <input
//                         style={INPUT}
//                         aria-label={`${label} の内容`}
//                         value={task.title}
//                         disabled={disabled}
//                         onChange={(e) => update({ title: e.target.value })}
//                       />
//                     </td>
//                     <td style={{ ...CELL, minWidth: 220 }}>
//                       <ListInput
//                         style={{ ...INPUT, ...MONO }}
//                         label={`${label} のファイル`}
//                         items={task.modules}
//                         disabled={disabled}
//                         onChange={(modules) => update({ modules })}
//                       />
//                     </td>
//                     <td style={{ ...CELL, minWidth: 120 }}>
//                       <ListInput
//                         style={{ ...INPUT, ...MONO }}
//                         label={`${label} の処理`}
//                         items={task.function_ids}
//                         disabled={disabled}
//                         onChange={(function_ids) => update({ function_ids })}
//                       />
//                     </td>
//                     <td style={CELL}>
//                       <button
//                         type="button"
//                         aria-label={`${label} を削除`}
//                         disabled={disabled}
//                         onClick={() => onChange(removeTask(model, milestone, index))}
//                       >
//                         削除
//                       </button>
//                     </td>
//                   </tr>
//                 );
//               })}
//             </tbody>
//           </table>
//         </div>
//       )}
//       <YStack alignItems="flex-start">
//         <StyledButton
//           theme="gray"
//           size="$2"
//           disabled={disabled}
//           onPress={() => onChange(addTask(model, milestone))}
//         >
//           {`${id} にタスクを追加`}
//         </StyledButton>
//       </YStack>
//     </YStack>
//   );
// }
// ↓↓
// マイルストーン1つのタスク(作業単位)の表(ID / 種別 / タスク / 処理 / 依存 / モジュール /
// 環境・設定のファイル(例))。行は上下に動かせる(マイルストーンの中だけ)。
function TaskTable({
  model,
  milestone,
  disabled,
  onChange,
}: TableProps & { milestone: number }) {
  const id = milestoneId(milestone);
  const tasks = model.milestones[milestone].tasks;
  return (
    <YStack gap="$2">
      {tasks.length === 0 ? (
        <Text color="$color11" fontSize="$2">
          タスクはまだありません。
        </Text>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={TABLE} aria-label={`${id} のタスク`}>
            <thead>
              <tr>
                <th style={HEAD}>ID</th>
                <th style={HEAD}>種別</th>
                <th style={HEAD}>タスク</th>
                <th style={HEAD}>処理</th>
                <th style={HEAD}>依存</th>
                <th style={HEAD}>モジュール</th>
                <th style={HEAD}>環境・設定のファイル(例)</th>
                <th style={HEAD} />
              </tr>
            </thead>
            <tbody>
              {tasks.map((task, index) => {
                const label = taskId(milestone, index);
                const update = (patch: Parameters<typeof updateTask>[3]) =>
                  onChange(updateTask(model, milestone, index, patch));
                return (
                  <tr key={index}>
                    <td style={{ ...CELL, ...MONO, whiteSpace: "nowrap" }}>{label}</td>
                    <td style={{ ...CELL, minWidth: 90 }}>
                      <select
                        style={INPUT}
                        aria-label={`${label} の種別`}
                        value={task.kind}
                        disabled={disabled}
                        onChange={(e) => update({ kind: e.target.value as UnitKind })}
                      >
                        {UNIT_KINDS.map((kind) => (
                          <option key={kind} value={kind} style={OPTION}>
                            {UNIT_KIND_LABELS[kind]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={{ ...CELL, minWidth: 240 }}>
                      <input
                        style={INPUT}
                        aria-label={`${label} の内容`}
                        value={task.title}
                        disabled={disabled}
                        onChange={(e) => update({ title: e.target.value })}
                      />
                    </td>
                    <td style={{ ...CELL, minWidth: 100 }}>
                      <ListInput
                        style={{ ...INPUT, ...MONO }}
                        label={`${label} の処理`}
                        items={task.function_ids}
                        disabled={disabled}
                        onChange={(function_ids) => update({ function_ids })}
                      />
                    </td>
                    <td style={{ ...CELL, minWidth: 110 }}>
                      <ListInput
                        style={{ ...INPUT, ...MONO }}
                        label={`${label} の依存`}
                        items={task.depends_on}
                        disabled={disabled}
                        onChange={(depends_on) => update({ depends_on })}
                      />
                    </td>
                    <td style={{ ...CELL, minWidth: 220 }}>
                      <ListInput
                        style={{ ...INPUT, ...MONO }}
                        label={`${label} のモジュール`}
                        items={task.modules}
                        disabled={disabled}
                        onChange={(modules) => update({ modules })}
                      />
                    </td>
                    <td style={{ ...CELL, minWidth: 180 }}>
                      <ListInput
                        style={{ ...INPUT, ...MONO }}
                        label={`${label} の環境・設定のファイル`}
                        items={task.config_files}
                        disabled={disabled}
                        onChange={(config_files) => update({ config_files })}
                      />
                    </td>
                    <td style={{ ...CELL, whiteSpace: "nowrap" }}>
                      <button
                        type="button"
                        aria-label={`${label} を上へ`}
                        disabled={disabled || index === 0}
                        onClick={() => onChange(moveTask(model, milestone, index, -1))}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label={`${label} を下へ`}
                        disabled={disabled || index === tasks.length - 1}
                        onClick={() => onChange(moveTask(model, milestone, index, 1))}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        aria-label={`${label} を削除`}
                        disabled={disabled}
                        onClick={() => onChange(removeTask(model, milestone, index))}
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
          size="$2"
          disabled={disabled}
          onPress={() => onChange(addTask(model, milestone))}
        >
          {`${id} にタスクを追加`}
        </StyledButton>
      </YStack>
    </YStack>
  );
}

// ── ここから Phase-23-6 の作成分 ──
// 想定リスクと対策の表。
export function RiskTable({ model, disabled, onChange }: TableProps) {
  return (
    <YStack gap="$2">
      <Text fontWeight="700">想定リスクと対策</Text>
      {model.risks.length === 0 ? (
        <Text color="$color11">リスクはまだありません。</Text>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={TABLE}>
            <thead>
              <tr>
                <th style={HEAD}>リスク</th>
                <th style={HEAD}>対策</th>
                <th style={HEAD} />
              </tr>
            </thead>
            <tbody>
              {model.risks.map((row, index) => {
                const label = `リスク${index + 1}`;
                const update = (patch: Parameters<typeof updateRisk>[2]) =>
                  onChange(updateRisk(model, index, patch));
                return (
                  <tr key={index}>
                    <td style={{ ...CELL, minWidth: 260 }}>
                      <input
                        style={INPUT}
                        aria-label={`${label} の内容`}
                        value={row.risk}
                        disabled={disabled}
                        onChange={(e) => update({ risk: e.target.value })}
                      />
                    </td>
                    <td style={{ ...CELL, minWidth: 320 }}>
                      <input
                        style={INPUT}
                        aria-label={`${label} の対策`}
                        value={row.mitigation}
                        disabled={disabled}
                        onChange={(e) => update({ mitigation: e.target.value })}
                      />
                    </td>
                    <td style={CELL}>
                      <button
                        type="button"
                        aria-label={`${label} を削除`}
                        disabled={disabled}
                        onClick={() => onChange(removeRisk(model, index))}
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
        <StyledButton theme="gray" disabled={disabled} onPress={() => onChange(addRisk(model))}>
          リスクを追加
        </StyledButton>
      </YStack>
    </YStack>
  );
}
