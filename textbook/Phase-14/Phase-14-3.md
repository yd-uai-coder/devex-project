# Phase-14-3: `docs/*.md` への反映・ステージ3の撤回の記録

## この章の目的

[`Phase-14-1.md`](./Phase-14-1.md)・[`Phase-14-2.md`](./Phase-14-2.md) で決めたことを、devex の仕様書4点へ反映する。あわせて、ステージ3を Phase 13 で終えたこと(Phase 13b・旧 Phase 14 の撤回)を、[CLAUDE.md](../../CLAUDE.md) #12 の撤回の blockquote(`で確定 ──`)で記録する。文書の更新だけなので、#13(全ファイル解説)・#15(全ファイル import)・#30(依存順ソート)の対象外である。

自動実装モード: on([introduction](./Phase-14-introduction.md) 参照)。

## この章で更新したファイル

| ファイル | 更新内容 |
|---|---|
| [`docs/requirements.md`](../../docs/requirements.md) | 1.4節 Could have: ステージ3の項目に M9b とアクティビティ図の撤回を追記。「詳細設計モード(ステージ4)」の項目を追加 |
| [`docs/external_design.md`](../../docs/external_design.md) | 2.2節: SCR-008(詳細設計画面)と遷移を追加。2.6節: アクティビティ図と「図の手直しの反映」に撤回を追記。2.7節「詳細設計モード(ステージ4)」を新設(2つのモード、段階表、承認と陳腐化、05・06の見せ方、出力形式、シーケンス図の扱い) |
| [`docs/internal_design.md`](../../docs/internal_design.md) | 3.2節: エンティティ一覧に DesignStage、⑩`design_stages` テーブル(Phase 15 で新設予定)を追加。3.3節: 簡易ドキュメントモードの内部設計書へのモジュール一覧表の追加(Phase 15 予定)、D5 対応表のアクティビティ図と文書チェーンの伝播に撤回を追記、「4. 詳細設計モード」(正本・章構成・ID 体系・紐づけの正本・出力の組み立て・機能グループ・CRUD・簡易ドキュメントモードとの関係)を新設 |
| [`docs/implementation_plan.md`](../../docs/implementation_plan.md) | 4.1節: 「3ステージ」→「4ステージ」。ステージ3に Phase 13b・旧 Phase 14 の撤回とマイルストーン4の達成範囲を追記。「ステージ4: 詳細設計モード」を新設(目的・段階・暫定の Phase 14〜20・マイルストーン5)。Phase ごとの詳細は [`Phase-14-4.md`](./Phase-14-4.md) |

あわせて、[`Phase-13-introduction.md`](../Phase-13/Phase-13-introduction.md) の「後続 Phase への申し送り」(Phase 13b の項目)に撤回の blockquote を付け、「後続 Phase での改訂」節に1行を追加した(#12-3)。

## 設計判断

### 撤回は消さずに blockquote で残す

Phase 13b・旧 Phase 14 の記述は削除せず、元の文の直後に `> **[Phase 14 で確定 ── 〈…しない〉]**` を置いた。#12 の規定どおり、`grep "で確定 ──"` で撤回の一覧を取れるようにするためである。

### ステージ4も Could have 階層

ステージ3と同じく、`docs/requirements.md` 上では Could have に置いた。ステージ番号と全体の優先度(ステージ1 = Must、ステージ2 = Should)の対応を踏襲する([`Phase-7-2.md`](../Phase-7/Phase-7-2.md) と同じ判断)。

### Phase 15 以降に回した詳細

`design_stages` のカラム、`projects.mode` の持ち方、各段階の意味モデルと API は、「Phase 15 で確定」と明記するにとどめた。要件定義フェーズで決めたのは方針(段階・承認と陳腐化・正本・ID 体系・出力形式)までである。

## テスト観点

スタブ不要 ── 本章は文書の更新のみで、実装ファイルを作成しないため(SUT/ドライバ/スタブという区分自体が適用対象外)。
