# Phase 25 導入: ステージ5(実装手順書 + 実装可能性チェック)着手 ── 要件定義フェーズ

## 目的

ステージ4(詳細設計モード、Phase 14〜24)の完了後、次のステージとして「実装手順書 + 実装可能性チェック」を始める。構想は [ロードマップ](../../appendix/devex_roadmap.md) のステージ5と、[作成方針](../../appendix/devex_implementation_procedure_guideline.md) にある。Phase 25 は、[Phase 14](../Phase-14/Phase-14-introduction.md) と同じく、実装に入る前の要件定義フェーズとして次を行う。

- スコープの確認と、作成方針21章の未決事項1〜8・コードを調べて見つけた不足の仕様診断(#28)と決定([25-1](./Phase-25-1.md))
- 実装手順書の見本(md)と、画面のデモ([25-2](./Phase-25-2.md))
- 見本の確認中に出た提案「シーケンス図と手順書の相関」の検討と判断([25-5](./Phase-25-5.md))
- 決定事項の `docs/*.md` への反映([25-3](./Phase-25-3.md))
- ステージ5の実装計画(Phase 26〜32 の一覧・成果物・依存関係)のまとめ([25-4](./Phase-25-4.md))

本体機能(段階7の改修・段階8・手順書の生成・チェック)の実装は Phase 26 以降で行う。

## パイプライン上の位置づけ・前提

- 前提として読むもの:
  - [`appendix/devex_implementation_procedure_guideline.md`](../../appendix/devex_implementation_procedure_guideline.md)(作成方針。手順書の構成・テンプレート・チェック・未決事項)
  - [`appendix/devex_roadmap.md`](../../appendix/devex_roadmap.md)(ステージ5〜10 の構想と順序)
  - [`textbook/appendix/goal3-comparison.md`](../appendix/goal3-comparison.md)(手順書のひな形の候補「作業単位の表」)
  - [`textbook/appendix/overall-retrospective.md`](../appendix/overall-retrospective.md)(教材を手順書のサンプルにする構想、手順書の中身を実装者で変えない)
- ステージ4の資産(段階の承認・陳腐化・生成の状態・段階ごとの検証・部分生成・zip の出力・作業領域の部品)は、段階8として再利用する([25-1](./Phase-25-1.md) 決定2)。
- 手順書は設計を書き写さず、ID で参照する。手順書に固有なのは、ファイル・順序・確かめ方・未定義の4つ(作成方針4章)。

## モード宣言(#21)

自動実装モード: **on**(AI が本体へ実装し、`textbook/samples/` も同じ内容で作る)。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-25-1.md`](./Phase-25-1.md) | スコープの確認と仕様診断(#28)・決定: 段階7の改修・段階8・2層のチェック・生成の量・AI 向けの出力・テストの範囲・簡易モードの扱い | なし(設計討議) | なし |
| [`Phase-25-2.md`](./Phase-25-2.md) | 実装手順書の見本(md)と画面のデモ `/implementation-procedure-demo` | あり(md の見本・devex-ui 本体と samples) | 25-1 |
| [`Phase-25-3.md`](./Phase-25-3.md) | `docs/*.md`・README・作成方針への反映 | `docs/` 配下(文書のため #13/#15/#30 の対象外) | 25-1, 25-2 |
| [`Phase-25-4.md`](./Phase-25-4.md) | ステージ5の実装計画(Phase 26〜32) | なし(計画の文書) | 25-1〜25-3, 25-5 |
| [`Phase-25-5.md`](./Phase-25-5.md) | シーケンス図の判断: 段階5の手順から導く読み取り専用のビュー、手順書との相関(ファイル・テストの SUT とスタブの候補)。コミュニケーション図は後回し | あり(devex-ui 本体と samples・md の見本の更新) | 25-2 |

[25-5](./Phase-25-5.md) は、25-2 の見本の確認中に出た提案を受けて、25-3・25-4 より先に行った(Phase 14-5 と同じく、番号は追加した順)。

## サンプルコード一覧

すべて [25-2](./Phase-25-2.md) の作成物(`textbook/samples/frontend/src/` 配下)。

- `features/implementation-procedure/demo/procedureDocModel.ts`(意味モデルと純粋関数)
- `features/implementation-procedure/demo/demoData.ts`(仮データ)
- `features/implementation-procedure/demo/ImplementationProcedureDemoPageContent.tsx`(デモ画面)
- `app/implementation-procedure-demo/page.tsx`(ルート)、`lib/menu-tree.ts`(メニューへの追加)
- `features/implementation-procedure/demo/sequenceModel.ts`(手順からシーケンスを導く純粋関数)・`SequenceSection.tsx`(図と単位との対応)([25-5](./Phase-25-5.md))
- 上記の `__tests__/` 配下のテスト

md の見本は [`appendix/implementation-procedure-sample/`](../../appendix/implementation-procedure-sample/README.md)(samples の対象外)。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| [25-1](./Phase-25-1.md) | なし | スコープと未決事項の決定 | なし(設計討議) |
| [25-2](./Phase-25-2.md) | `procedureDocModel.ts`・`demoData.ts`・`ImplementationProcedureDemoPageContent.tsx`・`page.tsx`・`menu-tree.ts` | 手順書の形と見せ方の見本 | 依存順の並べ替え・参照の解決と展開・人向けと AI 向けの md・画面の操作(`npx vitest run src/features/implementation-procedure "src/app/(pages)/implementation-procedure-demo" src/components/layout`) |
| [25-5](./Phase-25-5.md) | `sequenceModel.ts`・`SequenceSection.tsx`(新規)、`procedureDocModel.ts`・`ImplementationProcedureDemoPageContent.tsx`(更新) | 手順から導くシーケンス図と、手順書との相関の見本 | 入れ子と戻りの推測・指摘(戻りを呼び出しとして書いた行・無い分岐先・依存先に無い呼び出し)・スタブの候補と食い違い・Mermaid・画面の色分け |
| [25-3](./Phase-25-3.md) | `docs/*.md`・`README.md`・作成方針 | 決定事項の反映 | なし(文書の目視レビュー) |
| [25-4](./Phase-25-4.md) | なし | Phase 26〜32 の区切りと概要 | なし(文書の目視レビュー) |

## 写経順序(#23)

写経の対象になるファイルは [25-2](./Phase-25-2.md) と [25-5](./Phase-25-5.md) にある。25-2 → 25-5 の順で、各章の「この章で作成・更新するファイル」の表の順に写す(25-5 は 25-2 のファイルを更新するため)。

## 検証結果

- devex-ui: デモと layout のテスト 26 件成功(25-2 の時点は 17 件)、`tsc --noEmit`・eslint・`npm run build` 成功。
- Phase 完了時の全体テスト(#18): devex-ui 562 件成功(`--maxWorkers=4`)。1回目は、並列の負荷でデモの画面テスト2件が既定の5秒を超え、既存の `DfdEditorTabs` のテスト1件も落ちた。デモの画面テストの時間の上限を20秒にして、2回目で全件成功した(`DfdEditorTabs` は変えていない。負荷による一時的な失敗と判断)。devex-api は変更なし。
- `samples_check.py`: 不一致 0 件(一致 415 / 並び順のみ差 8 / 例外 5)。`link_check.py`: 切れ 0 件。

## 未消化の申し送り(#37)

Phase 24 から引き継いだもの:

- **持ち越し(Phase 22 から)**:
  - 段階6が開いていないときの、05 の詳細バッジ
  - `call` と `function` の書き方の揺れ → ステージ5では吸収せず、手順書の決定論的チェックで「未解決の参照」の警告として出す([25-1](./Phase-25-1.md) 決定9)。揺れそのものは未解決のまま
  - ER の主キーの NULL の表示
- **段階7の入力の大きさ**: 段階7を改修するとき(Phase 26)に測る([25-4](./Phase-25-4.md))。手順書の生成は単位が参照する箇所だけを渡す([25-1](./Phase-25-1.md) 決定10)。
- **E2E を CI で流すか**: 未定([`retrospective-memo.md`](../retrospective-memo.md) に候補として記録済み)。

この Phase で生まれたもの:

- **既存のプロジェクトの段階7**: 改修前の形(層の横割り)のまま保存されている。読み込み時の互換か、陳腐化させて再生成を促すかを Phase 26 で決める([25-1](./Phase-25-1.md) 決定1の補足)。
- **Phase 26〜31 の未確定事項**: [25-4](./Phase-25-4.md)「未確定事項」(段階7の改修の細部・段階8の model と承認の条件・「AI に提案を求める」の作り方・種別の欄の付け方など)。
- **シーケンス図の本実装**: 段階5の行への種別(同期/非同期/戻り)の追加、手順の表の検証への指摘、SVG(バックエンド)と Mermaid の出力。Phase 29 で行う([25-4](./Phase-25-4.md)・[25-5](./Phase-25-5.md))。
- **コミュニケーション図**: 後回し。シーケンス図を運用してから判断する([25-5](./Phase-25-5.md))。
- **セッションの区切りの記録**(#18 の見直しの材料。振り返りの提案に従って記録する): Phase 25 は1セッションで行った(25-1 診断 → 25-2 見本 → ユーザーの提案による 25-5 シーケンス図の検討と見本 → 25-3 docs → 25-4 計画)。途中で計画モードに2回入った。全体テストは Phase 完了時の2回だけ。ステージの振り返りで #18 を見直すときに使う。

## 後続 Phase での改訂

- [Phase 27](../Phase-27/Phase-27-introduction.md): [25-4](./Phase-25-4.md) で Phase 27 に入れていた「参照の展開」を Phase 28 へ移した(Phase 27 に使う側が無いため。#17)。Phase 27 は参照の導出と解決・決定的な検証・単位の一覧と未定義の一覧まで。

## Phase 完了チェック(#22)

1. 手順書の単位を、手順書の生成時に作り直さず、段階7で縦割りに作る理由を、「単位の区切りは誰の役割か」と「承認」の2点から説明できるか。
2. 手順書が設計を書き写さないことは、デモの型(`DesignRef` と `DesignSources`)のどこに表れているか。人向けと AI 向けの md の違いは何か。
3. 実装可能性チェックの「検証」と「AI」の指摘を、見本の例で1つずつ挙げ、それぞれ何を突き合わせて(何に頼って)出しているか説明できるか。
4. シーケンス図を LLM に生成させたり画面で編集させたりせず、段階5の手順から導く読み取り専用のビューにした理由を説明できるか。図そのものは確実さに何を足し、何を足さないか。
5. 未定義を手順書の上で決めず、設計の側で直すと、段階8の状態はどう変わるか。それが既存の陳腐化の仕組みで実現できる理由を説明できるか。

## 次のフェーズ

**Phase 26**: 段階7の改修(縦割りの単位・ID・依存・ファイルの欄の分離と検証・プロンプト・作業領域・実装計画の出力・既存データの扱い)。着手時に自動実装モード(#21)と [25-4](./Phase-25-4.md) の未確定事項を決める。
