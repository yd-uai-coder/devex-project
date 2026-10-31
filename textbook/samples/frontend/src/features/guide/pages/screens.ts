// 作成：Phase-118-4
import type { GuideScreen } from "../components/GuidePageLayout";

// 画面の見方のスクリーンショット(public/guide/<name>.webp)。開発環境の撮影用のプロジェクトを
// PC 幅(1280×800)・ライトのテーマで撮った。スマホ幅で撮ったものは大きさを渡す。
export function guideScreen(
  name: string,
  alt: string,
  caption: string,
  notes?: GuideScreen["notes"],
  size?: { width: number; height: number },
): GuideScreen {
  return { src: `/guide/${name}.webp`, alt, caption, notes, ...size };
}
