# Phase-25-3: `docs/*.md` への反映

## この章の目的

[25-1](./Phase-25-1.md)(仕様診断の決定)と [25-5](./Phase-25-5.md)(シーケンス図の判断)で決めたことを、devex の仕様書4点と README・作成方針へ反映する。文書の更新だけなので、#13(全ファイル解説)・#15(全ファイル import)・#30(依存順ソート)の対象外である。

自動実装モード: on([introduction](./Phase-25-introduction.md) 参照)。

## この章で更新したファイル

| ファイル | 更新内容 |
|---|---|
| [`docs/requirements.md`](../../docs/requirements.md) | 1.4節 Could have に「実装手順書 + 実装可能性チェック(ステージ5)」を追加(作業単位・設計の参照・2層のチェック・設計の側で直す・AI 向けの版・シーケンス図・簡易モード) |
| [`docs/external_design.md`](../../docs/external_design.md) | 2.7節「シーケンス図: 当面は作らない」に撤回の blockquote(読み取り専用のシーケンス図を作る)。2.8節「実装手順書 + 実装可能性チェック(ステージ5)」を新設(設計を書き写さない・段階7の縦割りの単位・SCR-008 の段階8の作業領域・シーケンス図・出力・テストの範囲・簡易モード) |
| [`docs/internal_design.md`](../../docs/internal_design.md) | 3.2節⑩: `stage` を 1〜8 にする予定を追記。3.3節4.「段階7」: 層の横割り・ファイルは例、を改める blockquote(実装は Phase 26)。3.3節「5. 実装手順書(ステージ5)」を新設(段階8・正本と参照・2層のチェック・生成・シーケンス図・出力・簡易モード) |
| [`docs/implementation_plan.md`](../../docs/implementation_plan.md) | 4.1節: 「4ステージ」→「5ステージ」。「ステージ5」を新設(目的・方針・暫定の Phase 25〜32・マイルストーン6)。Phase ごとの詳細は [`Phase-25-4.md`](./Phase-25-4.md) |
| [`README.md`](../../README.md) | ステージ表のステージ5の状態を「着手(Phase 25〜32 予定)」に。ステージ5を実装計画書に書き写したことを追記 |
| [`appendix/devex_implementation_procedure_guideline.md`](../../appendix/devex_implementation_procedure_guideline.md) | 21章(未決事項)に、Phase 25 で決定済みの印と決定の要約 |

## 設計判断

### 撤回・改訂は消さずに blockquote で残す

2.7節のシーケンス図の注記と、3.3節の段階7の「検証しない」は、元の文を残したまま直後に `> **[Phase 25 で確定 ── 〈…〉]**` を置いた(#12)。段階7の改訂は、決定は Phase 25、実装は Phase 26 であることを明記した。

### ステージ5も Could have 階層

ステージ3・4と同じく、`docs/requirements.md` 上では Could have に置いた([Phase 14-3](../Phase-14/Phase-14-3.md) と同じ判断)。

### Phase 26 以降に回した詳細

段階8の model の形・API・マイグレーション、段階7の model の変更(区分を種別に・依存・ファイルの欄の分離)、段階5の行の種別の欄は、「各実装 Phase で確定」とするにとどめた。要件定義フェーズで決めたのは方針(単位の作り方・置き場・チェックの2層・生成の量・出力・シーケンス図の作り方)までである。

## テスト観点

スタブ不要 ── 本章は文書の更新のみで、実装ファイルを作成しないため(SUT/ドライバ/スタブという区分自体が適用対象外)。
