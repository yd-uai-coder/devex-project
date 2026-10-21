// tagmerge.py の TS/TSX の補助。devex-ui の typescript で構文木を読む。
//
// 標準入力: {"text": "...", "fileName": "x.tsx", "lines": [0始まりの行番号, ...]}
// 標準出力: {"jsx": [JSX の子の位置にある行番号, ...], "errors": [{"line": 1始まり, "msg": "..."}]}
//
// 行の位置は、その行の最初の空白でない文字(空行なら次の空白でない文字)で決める。
// JSX の子の位置(要素・フラグメントの開きタグと閉じタグの間)では `//` のコメントが本文になるので、
// tagmerge.py はそこにタグを `{/* … */}` で入れる。
const path = require("path");
const ts = require(path.join(__dirname, "../../devex-ui/node_modules/typescript"));

function readStdin() {
  return require("fs").readFileSync(0, "utf8");
}

function isJsxParent(node) {
  return ts.isJsxElement(node) || ts.isJsxFragment(node);
}

// 親 parent から子 child へ下りたときの文脈
function edgeContext(parent, child, current) {
  if (isJsxParent(parent)) {
    if (parent.children.includes(child)) return "jsx";
    if (child === parent.closingElement || child === parent.closingFragment) return "jsx";
  }
  return current;
}

// 中に入ると JS の位置になる節(`{…}` の中・タグの属性の間)
function isJsBoundary(node) {
  return (
    ts.isJsxExpression(node) ||
    ts.isJsxOpeningElement(node) ||
    ts.isJsxSelfClosingElement(node) ||
    ts.isJsxClosingElement(node)
  );
}

function contextAt(sourceFile, pos) {
  let node = sourceFile;
  let context = "js";
  for (;;) {
    let next;
    ts.forEachChild(node, (child) => {
      if (next === undefined && child.getStart(sourceFile) <= pos && pos < child.end) next = child;
    });
    if (next === undefined) return context;
    context = edgeContext(node, next, context);
    if (next.getStart(sourceFile) === pos) return context;
    if (isJsBoundary(next)) context = "js";
    node = next;
  }
}

function main() {
  const { text, fileName, lines } = JSON.parse(readStdin());
  const kind = fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, kind);
  const starts = sourceFile.getLineStarts();
  const jsx = [];
  for (const line of lines) {
    if (line >= starts.length) continue;
    let pos = starts[line];
    while (pos < text.length && /\s/.test(text[pos])) pos++;
    if (pos >= text.length) continue;
    if (contextAt(sourceFile, pos) === "jsx") jsx.push(line);
  }
  const errors = sourceFile.parseDiagnostics.map((d) => ({
    line: sourceFile.getLineAndCharacterOfPosition(d.start).line + 1,
    msg: ts.flattenDiagnosticMessageText(d.messageText, " "),
  }));
  process.stdout.write(JSON.stringify({ jsx, errors }));
}

main();
