# Phase 32 導入: 統合/E2E・デプロイでの確認(ステージ5)

## 目的

ステージ5(実装手順書 + 実装可能性チェック)の最後の Phase。Phase 26〜31 で作った段階8(両モード)を通しで確かめ、本番に出す準備をする。新しい機能は作らない([Phase 24](../Phase-24/Phase-24-introduction.md) と同じ型)。

- **偽 LLM の契約テスト**: E2E 用の偽 LLM に段階8の手順書(両モード)を登録する。その出力が生成 → 検証 → 承認 → 実装手順書の zip を通ることを、ブラウザを使わない単体テストで固定する(32-1)。
- **E2E**: 両モードの E2E を、段階8の生成まで延ばす。既存を含めた全 E2E を流す(32-2)。
- **デプロイ**: 本番をステージ5の版へ更新する手順を `OPERATIONS.md` 10.2節に書き、マイグレーションの往復を確かめる(32-3)。

## パイプライン上の位置づけ・前提

```
[32-1 契約テスト(BE、ブラウザ無し)]
  E2eFakeLLM ─▶ 詳細設計モード: 段階1〜7 → zip → 段階8(M-01-T01〜T03)の生成 → 承認 → 実装手順書の zip
             ─▶ 簡易モード  : 4文書 → 段階8(M-01-T01・T02)の生成 → 承認 → 実装手順書の zip
[32-2 E2E(ブラウザ)]
  Playwright ─▶ devex-ui ─▶ devex-api(E2E_FAKE_LLM=true)
    helpers.ts: … → generateProcedureDocs(段階8の生成まで)
    detailed-design-flow.spec.ts / devex-flow.spec.ts(2件)= 全 E2E
[32-3 デプロイ(手順書のみ)]
  OPERATIONS.md 10.2: バックアップ → stage5→main の PR → b8c9d0e1f2a3・c9d0e1f2a3b4 → UI → 本番での確認
```

- **前提として読むもの**:
  - [Phase 24](../Phase-24/Phase-24-introduction.md): 偽 LLM の契約テスト・E2E の共通の操作・自動デプロイの順序。
  - [Phase 25-4](../Phase-25/Phase-25-4.md): Phase 32 の範囲(E2E が必要なのは Phase 32 だけ)。
  - [Phase 31](../Phase-31/Phase-31-introduction.md)「未消化の申し送り」: この Phase が回収する申し送り(偽 LLM の段階8、E2E の期待、本番反映の手順)。
- **この Phase を始めた時点の状態**:
  - 偽 LLM は段階8のスキーマを知らず、E2E で段階8を生成すると `NotImplementedError` で失敗した。
  - E2E は Phase 26〜31 の間、流していなかった。
  - 本番は 10.1 の版(devex-api `main` = `efb418e`、head `a5b6c7d8e9f0`)。devex-ui の `main` は origin より5コミット進んでいる(push すると Vercel がすぐデプロイする)。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(AI が本体へ実装し、`textbook/samples/` も同じ内容で作った)。

E2E: **この Phase で既存を含めた全 E2E を流す**(#36)。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 32 開始時」を参照。

1. **自動実装モード**: on(推奨どおり)。
2. **E2E の範囲**: 両モードとも段階8の**生成まで**。承認と zip は、BE の契約テストで両モードとも通す。
3. **本番反映**: **手順書だけ**作る。実際の反映は Phase の外でユーザーが行う。
4. **画面確認**: Phase 27〜31 の画面確認は、本番での確認に含める(推奨どおり)。結果は反映の後に記録する。

Claude の判断(計画の承認で確定):

- 簡易モードの契約テストは、新しいファイル `test_fake_llm_simple_procedure.py` に置く。`test_fake_llm_e2e.py` は DB を使わない偽 LLM 単体のテストなので混ぜない。
- 段階8の生成の操作は `helpers.ts` に置く(#17。消費者は2つの spec)。
- インフラの文書(`OPERATIONS.md`)は samples に写さない(#21)。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-32-1.md`](./Phase-32-1.md) | 偽 LLM の段階8と契約テスト(両モード) | あり(BE) | なし |
| [`Phase-32-2.md`](./Phase-32-2.md) | E2E(段階8の生成)と全 E2E の実行 | あり(FE の E2E) | 32-1(偽 LLM が段階8を返すこと) |
| [`Phase-32-3.md`](./Phase-32-3.md) | 本番反映の手順(`OPERATIONS.md` 10.2)とマイグレーションの往復 | `OPERATIONS.md`(インフラの文書のため #13/#15/#30 の対象外) | 32-1・32-2(テストが通ってから出す) |
| [`Phase-32-4.md`](./Phase-32-4.md) | `docs/*.md` への反映 | `docs/` 配下(文書のため #13/#15/#30 の対象外) | 32-1〜32-3 |

## サンプルコード一覧

- `textbook/samples/backend/`:
  - 更新: `app/ai/llm/fake.py`、`tests/unit/test_fake_llm_detailed_design.py`
  - 新規(テスト): `tests/unit/test_fake_llm_simple_procedure.py`
- `textbook/samples/frontend/`:
  - 更新: `e2e/helpers.ts`、`e2e/detailed-design-flow.spec.ts`、`e2e/devex-flow.spec.ts`

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| [32-1](./Phase-32-1.md) | `fake.py`・`test_fake_llm_detailed_design.py`・`test_fake_llm_simple_procedure.py` | 偽 LLM が段階8を返し、その出力が生成 → 承認 → zip を通ることを固定する | 両モードで検証のエラーが無い、指摘の直す先、zip のファイル(インメモリ DB、スタブなし) |
| [32-2](./Phase-32-2.md) | `helpers.ts`・2つの spec | 両モードの画面で段階8の手順書を生成する | 単位が「生成済」になる、承認前は実装手順書の zip が押せない、全 E2E が通る |
| [32-3](./Phase-32-3.md) | `OPERATIONS.md` | ステージ5の版への更新・確認・ロールバックの手順 | なし(マイグレーションの往復を DB の複製で確かめる) |
| [32-4](./Phase-32-4.md) | `docs/implementation_plan.md` | 完了と達成範囲の反映 | なし(文書の目視レビュー) |

## 写経順序(#23)

章番号順。各章の「この章で作成・更新したファイル」の表の順に写す。

実 import 監査(#15):

- 32-1: `fake.py` が新しく読む `procedure_doc_drafting` の6つの名前(`GeneratedFinding`・`GeneratedSimpleFinding`・`GeneratedTestPoint`・`GeneratedUnitFile`・`ProcedureDocGenerationOutput`・`SimpleProcedureDocGenerationOutput`)は、Phase 28・31 にある。`procedure_doc_drafting` は `fake.py` を読まないので、循環は無い。
- 32-1: `test_fake_llm_simple_procedure.py` は `tests.fixtures.simple_procedure.create_simple_procedure_project`(Phase 31-4)・`doc_generator_service._DOC_TYPE_PROMPTS`(既存)・`DetailedDesignExportService.bundle_procedure`(Phase 30-7)を読む。`test_fake_llm_detailed_design.py` が新しく使う名前は無い(`bundle_procedure` は既存の import のクラスのメソッド)。
- 32-2: spec が読む `helpers.generateProcedureDocs` は、同じ章で `helpers.ts` に足した。

章が作成・更新するファイルは、その章のテストが少なくとも1度 import する。

- `fake.py` は2つの契約テストが import する。
- `helpers.ts` は2つの spec が import する。

## 検証結果

- devex-api: 2つの契約テストは1回目で成功。ユニット全体 808 件成功(Phase 31 完了後の調整の 807 件 + 1 件)、`ruff check`・`pyright`(`uvx pyright`)成功。
- マイグレーションの往復: 開発環境の DB の複製で、2本の downgrade → upgrade を2往復した([32-3](./Phase-32-3.md))。
- devex-ui: 全体 627 件成功(`--maxWorkers=4`。E2E 以外の変更は無い)、`tsc --noEmit` 成功、eslint はエラー0(以前からある警告1件だけ)。
- E2E(全 spec): 1回目は3件中2件が spec の誤りで落ちた。直した後、3件とも成功([32-2](./Phase-32-2.md)「全 E2E で見つかったこと」)。開発用の backend を `E2E_FAKE_LLM=true` で起動し直して流し、終わってから通常の設定に戻した。
- `samples_check.py`(`--api-since HEAD --ui-since HEAD`): 不一致 0 件・作り忘れ 0 件(一致 461 / 並び順のみ差 8 / 例外 5)。`link_check.py`: 切れ 0 件。

## 未消化の申し送り(#37)

Phase 31 から引き継いだもの:

- **持ち越し(Phase 22 から)**:
  - 段階6が開いていないときの、05 の詳細バッジ
  - ER の主キーの NULL の表示
- **E2E を CI で流すか**: 未定([`retrospective-memo.md`](../retrospective-memo.md) に候補として記録済み)。この Phase で、流さない期間に E2E が壊れる例が2つ出た([32-2](./Phase-32-2.md))。ステージ5の振り返りの材料にする。
- **コミュニケーション図**: 後回し([25-5](../Phase-25/Phase-25-5.md))。
- **「段階Nで直す」の移動先での強調**: 段階5は手順・処理を開くが、段階3・4・7は段階を開くだけ。必要なら各パネルに `focus` を読ませる。
- **本番への反映と本番での確認**: ユーザーが [`devex-api/OPERATIONS.md`](../../devex-api/OPERATIONS.md) 10.2節の手順で行い、結果をここに記録する。確認の表には次をまとめた。
  - Phase 27〜30 の画面確認: `UNRESOLVED_CALL` の文言とボタン、実 LLM での段階8の生成、単位の詳細の展開・編集と承認前の確認、段階5の種別の付き方とタブの図、05章の図と Mermaid、`STUB_OUTSIDE_SEQUENCE`、実装手順書の zip、2つのダウンロードのボタン、「AI 向けにコピー」
  - Phase 31 の画面確認: 実 LLM の WBS の書式、SCR-005 の入口と段階8だけの SCR-008(段階1〜7の押せない行)、簡易モードの手順書の生成(未定義の多さ・データモデル・層での展開)、「〇〇書を直す(再生成)」、zip
  - 既存の詳細設計モードのプロジェクトで、段階7がレビュー中に戻り、承認し直せること
- **「AI に提案を求める」**: ステージ8(AI 設計レビュー・再ヒアリング)との境界として申し送る。
- **段階8の生成の入力の大きさ**(Phase 29 で発生): 手順の展開に Mermaid が入り、段階8の下書きのプロンプトが長くなった。問題になれば測る。本番での確認で生成の時間を控える。
- **出力の未定義の分類**: 未定義のうち「本来ヒアリングで聞くべきだった」ものを分類する仕組みは作っていない([25-4](../Phase-25/Phase-25-4.md))。ステージ6の着手時に、出力した `index.md` の未定義の一覧を材料にするかを決める。
- **生成済みの簡易モードのプロジェクト**: Phase 31 より前に生成した文書では、段階8の単位が空になる。文書を再生成すると使える(10.2節に記載)。移行の処理は作っていない。
- **WBS の書式の守られ方**: 実 LLM が書式から外れることが多ければ、解析の許す揺れを広げるか、プロンプトの例を増やす(本番での確認で見る)。
- **DF の ID の振り直し**: 内部設計書の再生成で `DF-<n>` が振り直されうる。文書を1つずつ直す運用が出てきたら見直す。
- **セッションの区切りの記録**(#18 の見直しの材料): Phase 25〜32 はそれぞれ1セッション。全体テストは Phase 完了時だけ。

この Phase で解決したもの:

- **偽 LLM の段階8**(Phase 28 から): [32-1](./Phase-32-1.md)。契約テストは段階1〜8(詳細設計モード)と簡易モードの段階8。
- **E2E の期待の変更**(Phase 30・31 から): [32-2](./Phase-32-2.md) で全 E2E を流し、壊れていた2か所を直した。
- **本番の段階7・段階8の移行と反映の手順**(Phase 26・27 から): [32-3](./Phase-32-3.md)(`OPERATIONS.md` 10.2)。

この Phase で生まれたもの: なし(本番での確認の記録は上の引き継ぎに含めた)。

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

1. 段階8の承認と実装手順書の zip を、E2E でなく BE の契約テストで確かめるのはなぜか。E2E が落ちたときの切り分けと、それぞれのテストが何を確かめているか(画面の操作 / サーバーの経路)から説明できるか。
2. 偽 LLM の段階8の指摘を、0件でも最重要でもなく軽微な1件にしたのはなぜか。
3. 段階8の生成の操作を `helpers.ts` に置き、段階1〜7の操作を詳細設計の spec の中に残したのはなぜか。#17 の「今この共通化を駆動している消費者」から説明できるか。
4. E2E を Phase ごとに流さない運用(#36)で、この Phase に何が起きたか。壊れていた2か所が、いつ・なぜ壊れたのかを説明できるか。
5. 10.2節のロールバックで、downgrade よりバックアップからの復元を考えるべきなのはどんなときか。2本のマイグレーションの downgrade が何を消し、何を戻さないかから説明できるか。

## 次のフェーズ

ステージ5はこの Phase で終わる。次は、ステージ5の完了として、振り返り(#10、`textbook/appendix/*-retrospective.md`。#25 の「→ Devex 仕様への示唆」を含む)と decision digest(#24)をまとめる。#18 により、別のセッションで行う。本番への反映と確認は、ユーザーが 10.2節の手順で行う。
