// 作成：Phase-118(完了後の調整2)
// 2つのモードで作る文書の定義(使い方ガイドの「2つのモードと作る文書」が使う)。
// 中身は devex-api の文書の見出しと外部設計書(2.3・2.7・2.8・2.11・2.14 節)に合わせる。
import type { GuideSlug } from "./guide-flow";

export type ModeKey = "simple" | "detailed";

export const MODE_NAMES: Record<ModeKey, string> = {
  simple: "簡易ドキュメントモード",
  detailed: "詳細設計モード",
};

export type DocumentStep = "before" | "branch" | "after" | "change";

// 文書がどのモードで、どう作られるか(作らないモードは null)
export type GuideDocument = {
  id: string;
  name: string;
  // 一覧表とカードの見出しの下の一言(何の文書か)
  purpose: string;
  // 主な中身(章・節)
  contents: string[];
  // 誰が・何に使うか
  use: string;
  // 形式と、見る画面
  format: string;
  made: Record<ModeKey, string | null>;
  // 分岐図の置き場: 分岐の前(共通)/ 分岐(モードごと)/ 合流の後(共通)/ 合意と変更管理
  step: DocumentStep;
  // くわしい使い方のページ
  guide: GuideSlug;
};

export const GUIDE_DOCUMENTS: GuideDocument[] = [
  {
    id: "requirements",
    name: "要件定義書",
    purpose: "何を・誰のために・どこまで作るか",
    contents: [
      "目的・背景、利用者と利用シーン",
      "システム化の範囲(作る / 作らない)",
      "機能要件(FR-001…。MoSCoW の優先度)",
      "非機能要件(NFR-001…)、制約・前提(CON-001…)",
      "要件ごとの出どころ(ユーザーの回答 / AI の提案の採用 / AI の推測)",
    ],
    use: "クライアントと「何を作るか」を合わせる基準。以降の文書・テストは、ここの要件 ID を指します。",
    format: "Markdown。文書の画面の「要件定義」のタブ",
    made: { simple: "ヒアリングの後に生成", detailed: "ヒアリングの後に生成(行ごとに合意の状態が付く)" },
    step: "before",
    guide: "documents",
  },
  {
    id: "external_design",
    name: "外部設計書",
    purpose: "利用者から見える形(画面と API)",
    contents: [
      "システム構成の概要",
      "画面一覧・画面遷移、主要画面の UI",
      "外部システムとの連携、データの入出力",
      "API 一覧(メソッド・パス・応答・エラー)",
    ],
    use: "画面と API の取り決め。設計・実装・テストの入力になります。",
    format: "Markdown。文書の画面の「外部設計」のタブ",
    made: { simple: "ヒアリングの後に生成", detailed: "ヒアリングの後に生成(行ごとに合意の状態が付く)" },
    step: "before",
    guide: "documents",
  },
  {
    id: "internal_design",
    name: "内部設計書",
    purpose: "中の作り(技術・データ・処理)",
    contents: [
      "技術スタックの選定とアーキテクチャの方針",
      "データモデルの定義",
      "処理・モジュールの設計(処理別データフロー DF-1…)",
      "例外処理・エラーハンドリング・ログ",
    ],
    use: "実装する人が、どう作るかをつかむための文書。",
    format: "Markdown。文書の画面の「内部設計」のタブ",
    made: { simple: "4文書として一括で生成", detailed: null },
    step: "branch",
    guide: "documents",
  },
  {
    id: "detailed_design",
    name: "詳細設計書",
    purpose: "内部設計を段階ごとに詳しくしたもの",
    contents: [
      "01 機能(処理)一覧(F-01…)",
      "02 データフロー(DFD・データ辞書・処理概要表)",
      "03 データモデル(ER 図・テーブル定義・CRUD 図)",
      "04 ソフトウェア構造(構成図・モジュール一覧)",
      "05 主要処理の手順(シーケンス図)、06 処理ロジックの詳細(任意)",
      "07 横断事項(認証・トランザクション・例外など)",
    ],
    use: "実務の詳細設計に合わせた構成。段階ごとに人が承認した内容から組み立てます。",
    format: "zip(HTML・Markdown・図)。詳細設計の画面からダウンロード",
    made: { simple: null, detailed: "段階1〜7 を承認しながら組み立てる" },
    step: "branch",
    guide: "detailed-design",
  },
  {
    id: "diagrams",
    name: "設計図",
    purpose: "DFD・ER 図・構成図",
    contents: ["機能グループごとの DFD", "ER 図", "ソフトウェアの構成図"],
    use: "画面で直して承認し、レビューや資料に使います。",
    format: "詳細設計の画面で編集。draw.io・SVG で出力",
    made: { simple: null, detailed: "段階2〜4 で下書きを直して承認" },
    step: "branch",
    guide: "detailed-design",
  },
  {
    id: "implementation_plan",
    name: "実装計画書",
    purpose: "どの順で・どの単位で作るか",
    contents: [
      "フェーズ・マイルストーン",
      "作業単位(WBS。M-01-T01…)と処理の割り当て",
      "開発環境・事前準備",
      "想定リスクと対策",
    ],
    use: "作業を分け、順番と依存を決める文書。実装手順書の単位になります。",
    format: "簡易: Markdown(「実装計画」のタブ)。詳細: 詳細設計書の zip に同梱",
    made: { simple: "4文書として一括で生成", detailed: "段階7 で、詳細設計書をもとに作る" },
    step: "after",
    guide: "implementation",
  },
  {
    id: "test_spec",
    name: "テスト仕様書",
    purpose: "結合テストと総合テストの仕様",
    contents: [
      "テストの方針",
      "結合テスト(API ごとの正常・異常・境界・セキュリティ)",
      "総合テスト(画面の流れ・非機能)",
      "要件 → テストの対応表",
    ],
    use: "要件がどのテストで確かめられるかを示します。",
    format: "Markdown。簡易は「テスト仕様書」のタブ、詳細はステッパーの下の行",
    made: { simple: "4文書と一緒に自動で生成", detailed: "段階1・段階7 を承認した後に作る" },
    step: "after",
    guide: "review",
  },
  {
    id: "implementation_procedure",
    name: "実装手順書",
    purpose: "作業単位ごとの具体的な手順",
    contents: [
      "単位ごとの、作成・変更するファイル(依存順)",
      "参照する設計と確かめ方",
      "未定義・要決定の一覧(実装可能性チェック)",
      "完了条件",
    ],
    use: "人や AI のコーディング支援に渡せる手順。作る過程で設計の不足も見つかります。",
    format: "zip(人向け・AI 向け)。段階8(実装手順書)の画面",
    made: { simple: "4文書をもとに作る", detailed: "段階1〜7 をもとに作る" },
    step: "after",
    guide: "implementation",
  },
  {
    id: "change_explanation",
    name: "変更の説明書",
    purpose: "仕様の変更をクライアントに説明する文書",
    contents: ["変更の内容と背景・対象の要件", "選択肢(案)とおすすめ", "影響の一覧・変更の規模"],
    use: "変更要求(CR)ごとに作り、共有リンクやメールでクライアントに渡します。",
    format: "Markdown・共有リンク。変更要求の「説明書」のタブ",
    made: { simple: null, detailed: "変更要求(CR)ごとに作る" },
    step: "change",
    guide: "agreement",
  },
];

// どちらのモードでも作る文書・片方だけの文書
export function documentsFor(scope: "both" | ModeKey): GuideDocument[] {
  return GUIDE_DOCUMENTS.filter((document) => {
    const simple = document.made.simple !== null;
    const detailed = document.made.detailed !== null;
    if (scope === "both") return simple && detailed;
    return scope === "simple" ? simple && !detailed : detailed && !simple;
  });
}

// 分岐図の1つの置き場の文書(branch は mode で絞る)
export function documentsAt(step: DocumentStep, mode?: ModeKey): GuideDocument[] {
  return GUIDE_DOCUMENTS.filter((document) => document.step === step && (!mode || document.made[mode] !== null));
}

// 詳細設計モードだけで使える機能
export const DETAILED_ONLY_FEATURES: { name: string; guide: GuideSlug }[] = [
  { name: "段階ごとの下書きの確認と承認", guide: "detailed-design" },
  { name: "UML(DFD・ER・構成図)の編集と出力", guide: "detailed-design" },
  { name: "合意済みの版と変更要求(CR)・共有リンク", guide: "agreement" },
  { name: "要件の行ごとの合意と確認事項", guide: "agreement" },
  { name: "資料(議事録・メール)の取り込み", guide: "materials" },
];

// 選び方の問い(当てはまれば、そのモードを勧める)
export const MODE_QUESTIONS: { question: string; mode: ModeKey }[] = [
  { question: "クライアントと仕様を合意しながら進め、変更も記録したい", mode: "detailed" },
  { question: "設計を段階ごとに確かめ、図も直したい", mode: "detailed" },
  { question: "まず設計書一式を手早くほしい(小さめのアプリ・試作)", mode: "simple" },
];
