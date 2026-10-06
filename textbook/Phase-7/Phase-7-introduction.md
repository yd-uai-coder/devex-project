# Phase 7 導入: ステージ3(UML設計図パイプライン)着手 ── 設計フェーズ

## 目的

[`docs/implementation_plan.md`](../../docs/implementation_plan.md) 4.1節 ステージ3(UML設計図パイプライン)に着手する。Phase 7はその最初のPhaseであり、[`appendix/stage3-requirements-organization.md`](../../appendix/stage3-requirements-organization.md) 7節の章立て案が定める「設計フェーズ: 仕様診断(#28)・図↔文書対応表(D5)の確定・スパイク(React Flow×Tamagui、レイアウトエンジン移植の見通し)・`docs/`反映」を行う。実装ファイルを作らない[CLAUDE.md](../../CLAUDE.md)「進行のルール」#2の規定に沿う設計フェーズであり、本体機能の実装(意味モデル・CRUD API等)はPhase 8以降で行う。

## 本Phase固有の進行上の特例

このステージ(Stage 3)に限り、ユーザー指示により以下2点が通常のCL運用と異なる:

1. **コードの反映先**: 通常は`textbook/samples/`のみへ作成しユーザーが実プロジェクトへ写経するが、本ステージはClaudeがコードを`devex-api`/`devex-ui`本体へ直接反映する。教材・samplesは通常どおり並行して作成する。
2. **samplesタグの非流用**: `textbook/samples/`側の慣例([CLAUDE.md](../../CLAUDE.md) #29: `# 作成：Phase-7-3`等のヘッダー・タグ)は、`devex-api`/`devex-ui`本体のソースには一切書かない(コメントで触れる場合も平文にとどめる)。

ユーザーはPhaseごとにテストを実行し、結果を確認したうえで次Phaseへの着手を指示する(コミットはユーザー指示があった時点で行う)。

## ブランチ運用

- `devex-api`: `stage2-phase6`をmainへマージ済み(PR#1)。**`stage3`ブランチ**を作成済みで、これ以降のPhaseもこのブランチ上で進める。
- `devex-ui` / このリポジトリ(`devex`本体): ブランチを切らず、Phase 0〜6と同じく`main`直下で進める(`devex`本体はステージ2分をpush済み)。

## パイプライン上の位置づけ・前提

- 前提として読むべきもの: [`appendix/stage3-requirements-organization.md`](../../appendix/stage3-requirements-organization.md)(要件整理・決定事項D1〜D8・章立て案)、[`appendix/uml-review-drawio-requirements-external-design.md`](../../appendix/uml-review-drawio-requirements-external-design.md)(UML文書本体)、[`appendix/requirements-design-uml-mcp-summary.md`](../../appendix/requirements-design-uml-mcp-summary.md)(参考資料)、[`docs/internal_design.md`](../../docs/internal_design.md) 3.2節・3.3節(本Phaseで更新)。
- 決定済み事項(D1〜D8)はすべて前提とし、本Phaseで再検討しない。D5(図↔文書対応表)のみ本Phaseで確定する。
- 別プロジェクトの自作図生成エンジン(`engine.py`)が、Phase 9で移植予定のレイアウトエンジン。

## モード宣言(#21)

自動実装モード: **on**(AI が本体へ実装し、`textbook/samples/` も並行して作った)。

> 旧ルール(学習モード / 納期モード)では、全章を学習モードとした。旧ルールから自動実装モードへ改めた経緯は [`overall-retrospective.md`](../appendix/overall-retrospective.md) を参照。

## 章一覧

| 章 | トピック | ファイル作成 | 旧モード | 依存 |
|---|---|---|---|---|
| [`Phase-7-1.md`](./Phase-7-1.md) | 仕様診断の確定: D5(図↔文書対応表)の確定根拠、Stage3要件の整理 | なし(設計討議) | 学習 | なし |
| [`Phase-7-2.md`](./Phase-7-2.md) | `docs/*.md`への反映(D5確定内容・Stage3スコープの文書化) | `docs/`配下4ファイル(更新。文書ファイルのため#13/#15/#30の対象外) | 学習 | 7-1 |
| [`Phase-7-3.md`](./Phase-7-3.md) | React Flow×Tamaguiスパイク(使い捨て技術検証) | あり(devex-ui本体+samples) | 学習 | なし |
| [`Phase-7-4.md`](./Phase-7-4.md) | レイアウトエンジン移植の見通し(文書化のみ、コードコピーなし) | なし(設計討議) | 学習 | なし |

7-1〜7-4は互いに独立して並行着手可能(7-2は7-1の確定内容を前提にする以外、依存なし)。

## サンプルコード一覧

- `textbook/samples/frontend/src/features/uml/components/UmlPageContent.tsx`(新規、写経レベル: 定型。7-3)
- `textbook/samples/frontend/src/app/projects/[id]/uml/page.tsx`(新規、写経レベル: 定型。7-3)
- 上記2ファイルの`__tests__/`配下のテスト(7-3、写経レベル: 定型)

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| 7-1 | なし | D5対応表の確定・Stage3要件の整理 | なし(設計討議) |
| 7-2 | `docs/requirements.md`・`docs/external_design.md`・`docs/internal_design.md`・`docs/implementation_plan.md`(すべて更新) | Stage3のMust/Should/Could追記、SCR-007、`uml_diagrams`テーブル、D5対応表、ステージ3ロードマップの反映 | なし(文書内容の目視レビューのみ) |
| 7-3 | `src/features/uml/components/UmlPageContent.tsx`(新規)、`app/.../projects/[id]/uml/page.tsx`(新規) | React Flow×Tamagui×Next16×React19の技術検証(使い捨て) | `npx vitest run src/features/uml`、`npx tsc --noEmit`、`npm run build` |
| 7-4 | なし | レイアウトエンジン移植可否の文書化 | なし(設計討議) |

## 写経順序(#23)

章番号順(7-1 → 7-2 → 7-3 → 7-4)。7-3のみdevex-ui本体+samplesへのファイル作成を伴う。

## Phase完了チェック(#22)

1. D5でコンポーネント図・ER図・DFDをすべて`internal_design`に寄せた理由を、devexの`external_design.md`/`internal_design.md`の実際の記載内容に基づいて説明できるか。
2. React Flow×Tamaguiスパイクが「使い捨て」と位置づけられているのはなぜか、Phase 11との役割分担を含めて説明できるか。
3. 移植元エンジンが「移植容易」と評価された根拠(依存関係・自己完結性・ライセンス)を3点挙げられるか。
4. 本Phaseで「コードを直接プロジェクトへ反映する」特例が敷かれた理由と、samplesタグを本体コードに書かない理由を説明できるか。

## 次のフェーズ

**Phase 8**: 意味モデル(Pydantic)・データ辞書(`DataItem`)・`uml_diagrams`・CRUD/validate API(component/ER/DFD)。`devex-api`の`stage3`ブランチで実装する。
