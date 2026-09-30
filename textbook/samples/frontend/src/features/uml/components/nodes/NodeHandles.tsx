// 作成：Phase-11-5
// 写経レベル: 定型 ── React Flow の接続点。
"use client";

import { Handle, Position } from "@xyflow/react";

// 全ノード共通の接続点。レーンが左から右へ並ぶ配置(Phase 9)に合わせ、
// 入力を左・出力を右に置く。辺の追加(ドラッグで接続)もこの2点から行う。
// エンジンの直交辺はノードの枠ちょうどで終わり、常に表示した接続点が矢印の先端を隠すため、
// 接続点はノードにマウスを乗せたとき・選択中だけ表示する(src/app/globals.css の .uml-handle)。
export function NodeHandles() {
  return (
    <>
      <Handle type="target" position={Position.Left} className="uml-handle" />
      <Handle type="source" position={Position.Right} className="uml-handle" />
    </>
  );
}
