// 作成：Phase-69-3
// 設計書・テスト仕様書の生成の失敗の記録(devex-api app/schemas/project.py の GenerationFailureRead)と、
// それを画面ごとに出すかの判断。記録は次の生成を受け付けるまで残るので、開き直しても知らせを出せる。

export type GenerationFailure = {
  reason_code: string;
  message: string;
  // 作り直そうとした文書(上流から。テスト仕様書は "test_spec")
  targets: string[];
  failed_at: string;
};

// 記録のうち、その画面が知らせる分。`target` を渡すと、その文書を作り直そうとした失敗だけを返す
// (詳細設計画面のテスト仕様書は、設計書だけの再生成の失敗を出さない)。
export function failureFor(
  failure: GenerationFailure | null | undefined,
  target?: string,
): GenerationFailure | null {
  if (!failure) return null;
  if (target !== undefined && !failure.targets.includes(target)) return null;
  return failure;
}

// 知らせの見出し(いつ失敗したか)
export function failureHeading(failure: GenerationFailure): string {
  return `前回の生成は失敗しました(${new Date(failure.failed_at).toLocaleString("ja-JP")})`;
}
