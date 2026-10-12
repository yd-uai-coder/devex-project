# Phase 50 導入: 統合/E2E・デプロイでの確認(ステージ7)

## 目的

ステージ7(変更影響分析・変更管理)の最後の Phase。Phase 42〜49 で作った要素のグラフ・承認時の写しと印・影響の画面・簡易モードの文書の model と影響・ヒアリングの側面・段階3・5 の直し・差分の再生成を通しで確かめ、本番に出す準備をする。新しい機能は作らない([Phase 40](../Phase-40/Phase-40-introduction.md) と同じ型)。

- **偽 LLM の契約テスト**: 偽 LLM の出力が、写し・差分・印・確認済み・承認し直しと、同じ出力での再生成(印が増えない)、簡易モードの単位の印を通ることを、ブラウザを使わない単体テストで固定する(50-1)。
- **E2E**: 詳細設計モードの E2E に、段階1を直して承認し直し、下流の印を確認済みにして承認し直す流れを足し、既存を含めた全 E2E を流す(50-2)。
- **「開発用」メニュー**: ステージ6の完了時と同じく外す(50-3)。
- **デプロイ**: 本番をステージ7の版へ更新する手順を `OPERATIONS.md` 10.4節に書き、マイグレーションの往復を確かめる(50-4)。

計画は [41-5](../Phase-41/Phase-41-5.md) の Phase 50。

## パイプライン上の位置づけ・前提

```
[50-1 契約テスト(BE、ブラウザ無し)]
  E2eFakeLLM ─▶ 段階1〜8 を承認 → 段階1の F-01 を直す(pending)→ 承認し直す → 下流に印
              → 未確認で 409 → 確認済み → 承認 / 同じ出力の再生成で印 0 / 簡易モードの単位の印
[50-2 E2E(ブラウザ)]
  Playwright ─▶ devex-ui ─▶ devex-api(E2E_FAKE_LLM=true)
    detailed-design-flow.spec.ts: 段階1の概要を直す → パネル → 承認し直す → 段階2の印 → 確認済み → 承認
    全 E2E(3件)
[50-3 「開発用」メニューを外す(FE)]
[50-4 デプロイ(手順書のみ)]
  OPERATIONS.md 10.4: バックアップ → stage7→main の PR → 2本のマイグレーション → UI → 本番での確認
   │
[50-5 docs・README]
```

- **前提として読むもの**:
  - [Phase 40](../Phase-40/Phase-40-introduction.md): 偽 LLM の契約テスト・全 E2E・本番反映の手順の型。
  - [Phase 49 の introduction](../Phase-49/Phase-49-introduction.md)「未消化の申し送り」: この Phase が回収する申し送り(画面確認・E2E)。
  - [Phase 43](../Phase-43/Phase-43-introduction.md)(写しと印・承認の条件)・[Phase 44](../Phase-44/Phase-44-introduction.md)(パネル)・[Phase 46](../Phase-46/Phase-46-introduction.md)(簡易モード)。
- **この Phase を始めた時点の状態**:
  - E2E は Phase 40 から流していなかった(#36)。
  - 本番は 10.3 の版(alembic の head `c3d4e5f6a7b9`)。devex-api のステージ7のコミット(Phase 42〜49)は手元の `stage7` ブランチにあり、origin へは未 push。devex-ui の `main` は origin より5コミット進んでいる。
  - Phase 49 は3つのリポジトリともコミット済み。Phase 49 の完了後の調整は無かった。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(AI が本体へ実装し、`textbook/samples/` も同じ内容で作った)。

E2E: **この Phase で既存を含めた全 E2E を流す**(#36)。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 50 開始時」を参照。すべて推奨どおり。

1. **Phase 49 の完了後の調整・自動実装モード**: 調整なし・on。
2. **E2E の範囲**: 既存を流して直したうえで、**詳細設計モードの spec に変更の影響の流れを足す**(簡易モードは契約テストだけ)。
3. **本番反映**: **手順書だけ**作る。実際の反映と本番での確認(積んである画面確認を含む)は、Phase の外でユーザーが行い、結果は後で記録する。
4. **「開発用」メニュー**: 前と同じく外す。デモのページとコードは残す。

Claude の判断(計画の承認で確定、または実装中):

- 契約テストの段階の手順は、既存の詳細設計モードの契約テストから `tests/fixtures/fake_llm_flow.py` に移して共有する(#17。[50-1](./Phase-50-1.md))。
- 偽 LLM の出力は変えない(そのままで経路を通った)。
- E2E のヘルパー(段階を選ぶ・パネルを開く)は spec の中に置く(消費者が1つ。#17)。
- E2E で気づいたパネルの見え方(直した段階では「この段階に届いた印はありません」)は直さず、本番での確認の表に「困らないか」として足す([50-2](./Phase-50-2.md))。
- インフラの文書(`OPERATIONS.md`)は samples に写さない(#21)。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-50-1.md`](./Phase-50-1.md) | 偽 LLM の契約テスト(変更の影響) | あり(BE のテスト) | なし |
| [`Phase-50-2.md`](./Phase-50-2.md) | E2E(変更の影響の流れ)と全 E2E の実行 | あり(FE の E2E) | 50-1(印の付き方) |
| [`Phase-50-3.md`](./Phase-50-3.md) | 「開発用」メニューを外す | あり(FE) | なし |
| [`Phase-50-4.md`](./Phase-50-4.md) | 本番反映の手順(`OPERATIONS.md` 10.4)とマイグレーションの往復 | `OPERATIONS.md`(インフラの文書のため #13/#15/#30 の対象外) | 50-1〜50-3(テストが通ってから出す) |
| [`Phase-50-5.md`](./Phase-50-5.md) | `docs/*.md`・README への反映 | `docs/` 配下・`README.md`(文書のため #13/#15/#30 の対象外) | 50-1〜50-4 |

## サンプルコード一覧

- `textbook/samples/backend/`:
  - 新規(50-1、テスト): `tests/fixtures/fake_llm_flow.py`・`tests/unit/test_fake_llm_change_impact.py`
  - 更新(50-1、テスト): `tests/unit/test_fake_llm_detailed_design.py`
- `textbook/samples/frontend/`:
  - 更新(50-2): `e2e/detailed-design-flow.spec.ts`
  - 更新(50-3): `src/lib/menu-tree.ts`

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| [50-1](./Phase-50-1.md) | `fake_llm_flow.py`・`test_fake_llm_detailed_design.py` | 偽 LLM で段階1〜7 を画面と同じ順に生成・承認する手順を共有する | 既存の契約テストが変わらず通る(インメモリ DB、スタブなし) |
| | `test_fake_llm_change_impact.py` | 偽 LLM の出力が変更の影響の経路を通ることを固定する | F-01 の印だけが7段階に届く・pending → 記録・未確認で 409 → 確認済みで承認・同じ出力の再生成で印 0・簡易モードのキーの引き継ぎと単位の印 |
| [50-2](./Phase-50-2.md) | `detailed-design-flow.spec.ts` | 画面で段階を直し、印を確認済みにして承認し直す | 「承認すると届く」・未確認 7 → 6・ステッパーの「見直し 1」・承認の理由の文・全 E2E が通る |
| [50-3](./Phase-50-3.md) | `menu-tree.ts` | メニューの「開発用」を外す | 既存のメニューのテストが通る |
| [50-4](./Phase-50-4.md) | `OPERATIONS.md` | ステージ7の版への更新・確認・ロールバックの手順 | なし(マイグレーションの往復を DB の複製で確かめる) |
| [50-5](./Phase-50-5.md) | `docs/implementation_plan.md`・`README.md` | 完了と達成範囲の反映 | なし(文書の目視レビュー) |

## 写経順序(#23)

章番号順。各章の「この章で作成・更新したファイル」の表の順に写す。

実 import 監査(#15):

- 50-1: `fake_llm_flow.py`(新規)が読む名前 ── `tests.fixtures.detailed_design.create_detailed_project`・`tests.fixtures.external_design.e2e_fake_upstream`(Phase 38)、`app.ai.llm.fake.E2eFakeLLM`、`app.detailed_design.has_errors`・`validate_stage`、`app.models.project.Project`、`app.repositories.generated_document.GeneratedDocumentRepository`・`uml_diagram.UmlDiagramRepository`、`app.services.design_stage_generation_service`・`design_stage_service`・`uml_diagram_service` ── はすべて以前の Phase にある(元の契約テストの import をそのまま移した)。`test_fake_llm_detailed_design.py` は同じ章の `fake_llm_flow` を読み、使わなくなった import を外した。`test_fake_llm_change_impact.py` が読む `tests.fixtures.simple_documents.e2e_fake_simple_documents`(Phase 45)・`tests.fixtures.simple_procedure.create_simple_procedure_project`(Phase 31)・`app.schemas.design_stage.DesignImpactRead`・`app.services.errors.DesignStageUnreviewedImpactError`(Phase 43)・`app.services.doc_generator_service.DocGeneratorService` は以前の Phase にある。
- 50-2: spec が読む `helpers.ts` の関数は既存。
- 50-3: import の変更は無い。

前方 import は無い。章が作成・更新するファイルは、その章のテストが少なくとも1度 import する:

- 50-1: `fake_llm_flow.py` は `test_fake_llm_detailed_design.py` と `test_fake_llm_change_impact.py`。
- 50-2: spec 自身(Playwright が流す)。
- 50-3: `menu-tree.ts` は既存の `Menu.test.tsx`(メニューの部品経由)。

## 検証結果

- 部分テスト: 章ごとに、変更した範囲のテスト(各章の「テスト観点」のコマンド)と `ruff check`(ruff format は使わない)・`uvx pyright`(触ったテストのファイル。0件)。
- E2E(全 spec): 足す前に3件とも成功。足した流れは spec の誤り3つを直して通り、最後に全 E2E 3件とも成功([50-2](./Phase-50-2.md)「全 E2E で見つかったこと」)。開発用の backend を `E2E_FAKE_LLM=true` で起動し直して流し、終わってから通常の設定に戻した。
- マイグレーションの往復: 開発環境の DB の複製で、2本の downgrade → upgrade を2往復した([50-4](./Phase-50-4.md))。
- Phase 完了時の全体テスト(#18): devex-api ユニット全体 **1064 件成功**(Phase 49 の 1061 件 + 3 件)、`ruff check`(全体)成功。devex-ui: 全体 **775 件成功**(`vitest run --maxWorkers=4`。件数は Phase 49 と同じ)、`tsc --noEmit` 成功、eslint はエラー0(以前からある警告1件だけ)。
- 統合テスト: 8 件成功(専用の DB)。E2E のレート制限のカウンタはブラウザの IP(172.22.0.1)のもので、統合テストとは別の鍵だった。
- `samples_check.py`(`--api-since HEAD --ui-since HEAD`): 不一致 0 件・作り忘れ 0 件。`link_check.py`: 切れ 0 件。

## 未消化の申し送り(#37)

Phase 49 から引き継いだもの(未解決のまま):

- **持ち越し(Phase 22 から)**: 段階6が開いていないときの、05 の詳細バッジ / ER の主キーの NULL の表示。
- **E2E を CI で流すか**: 未定([`retrospective-memo.md`](../retrospective-memo.md) に候補として記録済み)。#36 のまま。この Phase では、流さない期間(Phase 41〜49)に壊れた期待は無かった。
- **コミュニケーション図**: 後回し([25-5](../Phase-25/Phase-25-5.md))。
- **「AI に提案を求める」**: ステージ8との境界として申し送る。
- **段階8の生成の入力の大きさ・判定の LLM の入力の大きさ**: 問題になれば測る。
- **生成済みの簡易モードのプロジェクト**: Phase 31 より前に生成した文書では段階8の単位が空。再生成で使える。
- **既存のプロジェクトの会話の順**(Phase 35 から): 直さない。
- **`test_chat_service.py` の pyright の指摘4件**(Phase 40 から): 触るときに `isinstance` で絞る。
- **共有のモジュールの中で「どれを直すか」**: 示さない(S1・S4 の `clients/ai.py`)。
- **並列のテストのタイムアウト**(Phase 44 から): devex-ui の全体テストは `--maxWorkers=4` で流すと安定する。
- **以前の版の段階8の手順書**(Phase 45 から): キーが単位の ID のまま。キーで引けない手順書は要素にならず、印も付かない(10.4節に注記)。
- **偽 LLM の外部設計書の GET に DF が無い**(Phase 45 から): プレビューに中程度の指摘が1件出る(E2E の検証対象ではない)。
- **画面確認(ユーザー。本番での確認でまとめて行う)**(Phase 44・46・47・48 から): 10.4節の確認の表に移した ── 詳細設計モードのパネルの操作感・「段階Nで直す」の推定(名前の照合)・影響の取得の重さ(Phase 44)、簡易モードの変更の影響パネル(Phase 46)、ヒアリングの4つの観点の並びと規模ごとの任意・発言の数(Phase 47)、段階3の補ったセルの警告と段階5の分岐の欄(Phase 48)、ログのカードのおすすめの向き(49-2)。結果は本番での確認の後に記録する。
- **model の無い版との切り替え**(Phase 46 から): 最初の1回は印が付かず、差分の再生成も効かない(10.4節に注記)。
- **すでにヒアリングしたプロジェクト**(Phase 47 から)・**既存のプロジェクトの DFD・CRUD・手順**(Phase 48 から): 10.4節に注記。
- **DFD のデータストアの書き漏れ**(49-2 から): 1/3 なので検証には足していない。
- **補いの文字の当たり**(Phase 48 から): 測定では補ったセルが0件で、確かめられなかった。
- **画面の文の変更は、その画面のすべての処理へ届く**(49-4 から): 今の規則のまま。
- **判定がログインの方法だけでセキュリティを埋めた**(49-4 から): `tally.py` は観点の状態だけを数える。
- **初期入力だけで MVP の範囲が対象外になった**(49-4 から)。
- **改名の後に下流の参照を直して承認すると広がる**(Phase 43 から): 直す範囲に入れていない。

この Phase で生まれたもの:

- **直した段階でパネルを開くと何も無いように見える**(50-2): パネルは選んでいる段階に届いた印だけを出すので、直した段階1を選んでいると「この段階に届いた印はありません」と出て、変わったものも「全段階」に切り替えるまで見えない。仕様どおりだが、困らないかを 10.4節の確認の表に足した。
- **往復した後の簡易モードの手順書のキー**(50-4): downgrade → upgrade で、簡易モードの手順書の `unit_key` は戻らない。本番の初めての更新には関係しない(10.4節に注記)。
- **セッションの区切りの記録**: Phase 50 は1セッションで行った(計画モードで質問1回(4問)→ 50-1 の契約テスト → 50-2 の全 E2E(足す前に1回、足した流れを3回直して、全部を1回)→ 50-3 → 50-4 のマイグレーションの往復と 10.4節 → docs → 教材 → 全体テスト・統合テスト)。

この Phase で解決したもの:

- **Phase 50 の未確定事項**([41-5](../Phase-41/Phase-41-5.md)): 本番のマイグレーションと既存データ(移さない。印は空から、写しは承認済みで変わっていない行だけ。10.4節)、本番での確認の範囲(Phase 44〜49 の画面確認を含める。着手時の決定3)。
- **既存を含めた全 E2E**(41-5): 流して、壊れた期待は無かった。変更の影響の流れを足した([50-2](./Phase-50-2.md))。
- **devex-ui の「開発用」メニュー**(Phase 41 から): 外した([50-3](./Phase-50-3.md))。
- **「段階Nで直す」の推定・影響の取得の重さ・発言の数・ログのカード**(Phase 44・47・49 から): 本番での確認の表に移した(上の「画面確認」)。

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

設問は Phase の要点の要約(回答は求めない)。

1. 契約テストで、段階1の「概要」を直すと F-02 には印が届かないのはなぜか。F-01 と F-02 が同じ画面・同じモジュールを共有していることと、「処理を軸」のたどり方から説明できるか。
2. 契約テストでは印が8段階、E2E では7段階に付くのはなぜか。印を記録する段階の条件から説明できるか。
3. 同じ出力での再生成で印が付かないことを確かめるのに、簡易モードの初めの4文書をすべて偽 LLM の出力にそろえたのはなぜか。
4. 移行の後の写しの数を、更新の前に控えた「承認済みで変わっていない行」の数と比べるのはなぜか。開発 DB で 154 → 153 になったのはなぜか。
5. ロールバックして再び更新すると、簡易モードの手順書のキーが戻らないのはなぜか。それでも本番の更新に影響しないのはなぜか。

## 次のフェーズ

ステージ7はこの Phase で終わる。次は、ステージ7の完了として、振り返り(#10、[`overall-retrospective.md`](../appendix/overall-retrospective.md)。#25 の「→ Devex 仕様への示唆」と #39 の AI の提案の精度を含む)と decision digest(#24)をまとめる。#18 により、別のセッションで行う。本番への反映と確認は、ユーザーが [`OPERATIONS.md`](../../devex-api/OPERATIONS.md) 10.4節の手順で行う。
