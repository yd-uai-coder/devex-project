// 作成：Phase-13-6
// 写経レベル: コア ── react-markdown が HTML コメントを捨てる前に、アンカーを境に文書を分けて
//   図を差し込む位置を知る、という設計判断(rehype-raw で生の HTML を通さない)。
// 内部設計書の本文を、UML 図のアンカーを境にセグメントへ分ける純粋関数。
//
// アンカーの形式(devex-api app/uml/sync/anchors.py と同じ):
//   <!-- uml:diagram:<diagram_id>:start v=<version> -->
//   (要素表などの本文)
//   <!-- uml:diagram:<diagram_id>:end -->
//
// react-markdown は rehype-raw を入れない限り生の HTML(コメントを含む)を描かない。
// そのためコメントのままでは「どこに図を差し込むか」が分からない。描画の前に本文を分けておき、
// 図のセグメントの位置に SVG を差し込む。生の HTML は通さないので、LLM の出力から XSS に
// つながる経路は増えない(MessageBubble.tsx と同じ方針)。

export type DocumentSegment =
  | { kind: "markdown"; text: string }
  | { kind: "diagram"; diagramId: string; version: number; body: string };

const START_SOURCE = String.raw`<!-- uml:diagram:([0-9A-Za-z-]+):start v=(\d+) -->`;

function endMarker(diagramId: string): string {
  return `<!-- uml:diagram:${diagramId}:end -->`;
}

// 本文をセグメントに分ける。終了コメントが無い開始コメントは、図として扱わず本文に残す
// (react-markdown がコメントを捨てるので、表示には現れない。バックエンドの parse_anchors と同じ扱い)。
export function splitByAnchors(content: string): DocumentSegment[] {
  const segments: DocumentSegment[] = [];
  // g フラグの正規表現は lastIndex を状態として持つので、呼び出しごとに作る
  const start = new RegExp(START_SOURCE, "g");
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = start.exec(content)) !== null) {
    const [startComment, diagramId, version] = match;
    const bodyStart = match.index + startComment.length;
    const end = endMarker(diagramId);
    const endIndex = content.indexOf(end, bodyStart);
    if (endIndex === -1) continue;

    pushMarkdown(segments, content.slice(cursor, match.index));
    segments.push({
      kind: "diagram",
      diagramId,
      version: Number(version),
      body: content.slice(bodyStart, endIndex).trim(),
    });
    cursor = endIndex + end.length;
    start.lastIndex = cursor;
  }
  pushMarkdown(segments, content.slice(cursor));
  return segments;
}

function pushMarkdown(segments: DocumentSegment[], text: string): void {
  if (text.trim() !== "") segments.push({ kind: "markdown", text });
}

// SVG を img の data URI にする(img で読み込んだ SVG はスクリプトを実行しない)。
export function svgDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
