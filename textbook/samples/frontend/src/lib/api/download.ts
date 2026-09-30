// 作成：Phase-12-5｜更新：Phase-13-5
// 写経レベル: 定型 ── documentsApi.ts の parseFilename と DocumentMarkdownView.tsx の保存処理をそのまま移しただけ。
// ファイルのダウンロードに共通する部品(文書の .md ダウンロードと UML 図の出力で共有する)。

// Content-Disposition: attachment; filename="..."; filename*=UTF-8''...
// のfilename*(RFC 5987、UTF-8パーセントエンコード)を優先して取り出す
// (devex-api app/api/responses.py content_dispositionが両方を含めて返す)。
export function parseFilename(header: string | null): string | null {
  if (!header) return null;
  const utf8Match = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match) return decodeURIComponent(utf8Match[1]);
  const asciiMatch = header.match(/filename="([^"]+)"/i);
  return asciiMatch ? asciiMatch[1] : null;
}

// Phase-13-5：更新(zip のようなバイナリも保存できるよう、Blob も受け取る)
// // 文字列をファイルとして保存させる(一時的な <a download> をクリックする)。
// export function saveFile(filename: string, content: string, mimeType: string): void {
//   const blob = new Blob([content], { type: mimeType });
// ↓↓
// 文字列または Blob をファイルとして保存させる(一時的な <a download> をクリックする)。
// Blob はそのまま使う(mimeType は文字列から Blob を作るときだけ使う)。
export function saveFile(filename: string, content: string | Blob, mimeType: string): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = filename;
  window.document.body.appendChild(link);
  link.click();
  window.document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
