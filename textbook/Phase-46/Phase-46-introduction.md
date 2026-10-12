# Phase 46 導入: 簡易モードの変更の影響

## 目的

ステージ7(変更影響分析・変更管理)の5つ目の実装 Phase。Phase 42〜44 で詳細設計モードの変更の影響(要素のグラフ → 差分 → 印 → 画面)を作り、[Phase 45](../Phase-45/Phase-45-introduction.md) で簡易ドキュメントモードの内部設計書・実装計画書も model にした。ただ簡易モードは、記録(`record_document_change` が詳細設計モードだけ)・要素(段階7の計画からしか単位を作らない)・画面(`mayHaveImpact` とパネルが簡易モードを外す)のどれでも影響の仕組みの外にあった。文書を再生成すると段階8は丸ごと「古い」になり、どの単位の手順書を見直すかが分からなかった(ベースライン S8: 全8単位が古い、N4: 単位の手順書を見落とす。[41-1](../Phase-41/Phase-41-1.md))。

この Phase で、4文書の版の model の差分から段階8の単位の手順書に印を付け(46-1・46-2)、Phase 44 の画面の部品で見せる(46-3)。確定した仕様は [`docs/external_design.md`](../../docs/external_design.md) 2.10節「簡易ドキュメントモードの影響(Phase 46 で確定)」と、[`docs/internal_design.md`](../../docs/internal_design.md) 3.3節「Phase 46 で実装した部分」に足した。

## パイプライン上の位置づけ・前提

```
[Phase 45]  4文書の版ごとの model(DF の ID はトリガーで、タスクのキーはタスク名で引き継ぐ)
        │
        ▼
[46-1]  SimpleModels → build_simple_elements(df:・task:・unit: …)
        trace の軸 = 処理・DF・文書のタスク
        │
        ▼
[46-2]  record_document_change(簡易モードも)→ design_stages.impact(段階8)
        承認を止める 409・確認済み・GET /design-stages/impact はそのまま
        │
        ▼
[46-3]  mayHaveImpact(簡易モードは記録した印があるとき)・ChangeImpactPanel を簡易モードでも
        │
        ▼
[Phase 47〜]  ヒアリングの側面(47)・段階3・5 の書き落とし(48)・効果測定(49)
```

- **前提として読むもの**:
  - [41-2](../Phase-41/Phase-41-2.md)(決定1・7)・[41-5](../Phase-41/Phase-41-5.md)(Phase 46 のスコープと未確定事項)。
  - [Phase 42](../Phase-42/Phase-42-introduction.md)(要素とたどり方)・[Phase 43](../Phase-43/Phase-43-introduction.md)(写しと印の記録)・[Phase 44](../Phase-44/Phase-44-introduction.md)(画面)。
  - [Phase 45](../Phase-45/Phase-45-introduction.md)(内部設計書・実装計画書の model)・[Phase 31](../Phase-31/Phase-31-introduction.md)(簡易モードの段階8の参照の規則)。
- **この Phase を始めた時点の状態**: Phase 45 までコミット済み(外側のリポジトリ・devex-api・devex-ui)。Phase 45 の実 LLM での生成の確認は終わり、調整は無かった。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(AI が devex-api・devex-ui に実装し、`textbook/samples/` も同じ内容で作った)。

E2E: この Phase では流さない。既存の E2E(`devex-flow.spec.ts`)は文書を1回生成して段階8を生成するまでで、段階8を承認した後の再生成を通らないので印は付かない。偽 LLM の契約テスト(`test_fake_llm_simple_procedure.py`)で、同じ版の切り替えでは印が付かないことを確かめた。ステージ7の E2E は Phase 50 で既存を含めて全部流す。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 46 開始時」を参照。すべて推奨どおり。

1. **Phase 45 の実 LLM での生成の確認**: 終わった・調整なし。
2. **自動実装モード**: on。
3. **単位の影響のたどり方(41-5 の未確定事項)**: 処理(DF)を軸。DF を詳細設計モードの処理(F-xx)に当て、WBS の依存の連鎖とモジュールの共有からは広げない。

Claude の判断(計画の承認で確定、または実装中):

- **文書のタスクも軸に含める**(簡易モードでは要件をタスクが直接持つため。N4。[46-1](./Phase-46-1.md))。
- **要素の組み立ては別モジュール `impact/simple.py`**。文書の要素と入れ物は詳細設計モードと共有する(#17。[46-1](./Phase-46-1.md))。
- **単位の参照は段階8と同じ規則**(`normalize_plan`・`simple_unit_refs`・`module_layer`。[46-1](./Phase-46-1.md))。
- **内部設計書 3.3 の API 行は要素にしない**(API は外部設計書 2.6 の行。[46-1](./Phase-46-1.md))。
- **pending の印は簡易モードでは出さない**(段階8の下流が無い。[46-2](./Phase-46-2.md)・[46-3](./Phase-46-3.md))。
- **model の無い以前の版との切り替えでは印を付けない**(Phase 43 と同じ。[46-2](./Phase-46-2.md))。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-46-1.md`](./Phase-46-1.md) | 簡易モードの要素とたどり方(純粋関数) | あり(API) | なし(Phase 42・45) |
| [`Phase-46-2.md`](./Phase-46-2.md) | 印の記録(サービス) | あり(API) | 46-1 |
| [`Phase-46-3.md`](./Phase-46-3.md) | 簡易モードの影響の画面 | あり(UI) | 46-2(記録した印) |

## サンプルコード一覧

`textbook/samples/backend/` 配下:

- 46-1: `app/detailed_design/impact/{elements,trace,simple,__init__}.py`
- 46-2: `app/services/{design_stage_service,doc_generator_service}.py`
- テスト: `tests/unit/test_impact_simple.py`(新規)、`tests/fixtures/change_impact.py`、`tests/unit/test_{design_stage_impact,fake_llm_simple_procedure}.py`

`textbook/samples/frontend/src/features/detailed-design/` 配下:

- 46-3: `impactOps.ts`・`components/DetailedDesignPageContent.tsx`・`test-utils/stageFixtures.ts`・`__tests__/impactOps.test.ts`・`components/__tests__/DetailedDesignPageContent.test.tsx`

マイグレーションは無い(`design_stages.impact` は Phase 43 からある列)。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| [46-1](./Phase-46-1.md) | `impact/simple.py`・`trace.py` | 4文書と段階8の model から要素と参照を作り、DF とタスクを軸にたどる | 純粋関数(スタブ不要)。S8・N4 相当、モジュール・WBS の依存から広げない、前後の版の差分と印 |
| [46-2](./Phase-46-2.md) | `design_stage_service.py` | 文書の版の切り替えで、簡易モードも段階8に印を記録する | DB はインメモリ SQLite。記録・承認を止める・API、偽 LLM の契約 |
| [46-3](./Phase-46-3.md) | `impactOps.ts`・`DetailedDesignPageContent.tsx` | 簡易モードでも影響を取り、パネルを出す | 純粋関数(スタブ不要)とストアを置いた描画 |

## 写経順序(#23)

章番号順。各章の中は「この章で作成・更新したファイル」の表の順(#30。依存されるファイルが上、テストは末尾)。

実 import 監査(#15。全 import 文を読んで確かめた):

- 46-1: `elements.py` は import を足していない(名前を変えただけ)。`trace.py` は既存の `elements.DOCUMENT_STAGE` を読む。`simple.py` は既存の `api_list.trigger_key`・`data_model.table_key`・`plan(PlanModel, normalize_plan)`・`procedure_doc(ProcedureDocModel, plan_units)`・`simple_procedure.internal_design(SimpleDesignBook, book_from_model, module_layer)`・`simple_procedure.refs.simple_unit_refs`・4文書の `model` と、同じ章の `elements`(`ElementBuilder`・`add_document_elements`・`parse_model`・`row_body`)を読む。`__init__.py` は同じ章の `simple` を読む。`change_impact.py`(フィクスチャ)は import を足していない。テストは同じ章のフィクスチャとパッケージの名前を読む。
- 46-2: `design_stage_service.py` は 46-1 の `Element`・`SimpleModels`・`build_simple_elements` を読み、`STAGE_INPUTS` の import を消した(`stage_inputs(mode)` を使う)。`doc_generator_service.py` は docstring だけ。テストは 46-1 のフィクスチャ(`create_simple_impact_project`・`simple_impact_documents`)と既存の `blocking_marks` を読む。
- 46-3: `impactOps.ts`・`DetailedDesignPageContent.tsx` は import を足していない。テストは同じ章の `makeSimpleImpact` と `@testing-library/react` の `within` を読む。
- 前方 import は無い。章が作成・更新するファイルは、その章のテストが少なくとも1度 import する(`elements.py`・`trace.py` はパッケージ経由で `test_impact_simple.py`、`doc_generator_service.py` は `test_design_stage_impact.py`(`restore_version`)、`DetailedDesignPageContent.tsx` は自身のテスト)。

## 検証結果

- devex-api: 部分テスト(各章の「テスト観点」のコマンド)成功、`ruff check`・pyright(触ったファイル)0件。Phase 完了時の全体テスト(#18): 1036 件成功(Phase 45 の 1019 件 + 新規17件)。
- devex-ui: `vitest run src/features/detailed-design --maxWorkers=4` 330 件成功、`tsc --noEmit`・`npm run lint`(既存の警告1件だけ)・`npm run build` 成功。全体テスト: 775 件成功(`--maxWorkers=4`。並列を絞らないとタイムアウトで落ちる揺れは Phase 44 から同じ)。
- `samples_check.py`(`--api-since HEAD --ui-since HEAD`): 不一致 0 件・作り忘れ 0 件(一致 561 / 並び順のみ差 8 / 例外 5)。`link_check.py`: 切れ 0 件。
- 実画面: 確かめていない(#37 の運用注記。「未消化の申し送り」に手順を書いた)。

## 未消化の申し送り(#37)

Phase 45 から引き継いだもの(未解決のまま):

- **持ち越し(Phase 22 から)**: 段階6が開いていないときの、05 の詳細バッジ / ER の主キーの NULL の表示。
- **E2E を CI で流すか**: 未定([`retrospective-memo.md`](../retrospective-memo.md) に候補として記録済み)。#36 のまま。
- **コミュニケーション図**: 後回し([25-5](../Phase-25/Phase-25-5.md))。
- **「AI に提案を求める」**: ステージ8との境界として申し送る。
- **段階8の生成の入力の大きさ・判定の LLM の入力の大きさ**: 問題になれば測る。
- **生成済みの簡易モードのプロジェクト**: Phase 31 より前に生成した文書では段階8の単位が空。再生成で使える。
- **既存のプロジェクトの会話の順**(Phase 35 から): 直さない。
- **`test_chat_service.py` の pyright の指摘4件**(Phase 40 から): 触るときに `isinstance` で絞る。
- **ステージ7の計画に入れたもの**: L2・L5・L6・L14 と判定のゆらぎ → Phase 47・49 / 段階3の CRUD の下書きと DFD の食い違い・段階5の分岐の行の書き落とし → Phase 48。
- **Phase 47〜50 の未確定事項**: [41-5](../Phase-41/Phase-41-5.md)「未確定事項」。
- **共有のモジュールの中で「どれを直すか」**: 示さない。効果測定では見落としとして数え続ける。
- **devex-ui の「開発用」メニュー**: ステージ7の完了時に、ユーザーが前と同じく外すかを決める。
- **共有の画面を通って別の処理に届く**(Phase 42 から): 止めるかは Phase 49 の数字で決める。簡易モードでも同じ規則(要件 → 画面 → 別の API → 別の DF。[46-1](./Phase-46-1.md))。
- **テーブルの変更は、そのテーブルを読み書きする全処理に届く**(Phase 42 から): Phase 49 で数える。簡易モードは DF の本文に名前が出るテーブルで同じ。
- **文書の要素(要件・画面・API)からの影響は、まだ生成物で確かめていない**(Phase 42 から): Phase 49 で、測定用に文書の model を用意して測る。
- **改名の後に下流の参照を直して承認すると、内容の変更として広がる**(Phase 43 から): 過剰かどうかは Phase 49 で数える。
- **ER 以外の段階の外の図の変更は差分に入らない**(Phase 43 から): DFD の線が効いているかを Phase 49 で見る。
- **「段階Nで直す」の推定は名前の照合**(Phase 44 から): 当たる割合は Phase 49 の効果測定で見るか、画面確認で外れが目立てば直す。
- **影響の取得は段階の一覧のたびに1回**(Phase 44 から): 重く感じたら、生成のポーリング中は取らないなどで減らす。
- **並列のテストのタイムアウト**(Phase 44 から): devex-ui の全体テストは `--maxWorkers=4` で流すと安定する。
- **以前の版の段階8の手順書**(Phase 45 から): キーが単位の ID のまま。キーで引けない手順書は要素にならず、印も付かない(作り直した手順書から付く)。
- **偽 LLM の外部設計書の GET に DF が無い**(Phase 45 から): プレビューに中程度の指摘が1件出る(E2E の検証対象ではない)。

この Phase で生まれたもの:

- **画面確認(ユーザー。Phase 49・50 でまとめてよい)**: 簡易モードのプロジェクトで、文書を生成 → 段階8を生成・承認 → 要件を変えるヒアリングの後に文書を再生成(または文書の画面で前の版に戻す)→ 実装手順書の画面の上に「変更の影響」パネルが出て、出どころ(要件定義書・内部設計書など)と、単位の一覧の行の印が出ること。確認済みにすると段階8を承認し直せること。
- **再生成の言い回しの揺れも「内容の変更」になる**: 実 LLM の再生成で、意味の変わらないタスク・DF の書き直しも差分になり、印が増えうる(偽 LLM は同じ出力なので0件)。Phase 49 の効果測定(S8・N4)で、実際の再生成の過剰を数える。
- **model の無い版との切り替え**: Phase 45 より前に生成した版から再生成した最初の1回は印が付かない(段階8は今までどおり丸ごと「古い」)。
- **セッションの区切りの記録**: Phase 46 は1セッションで行った(計画モードで質問3問 → 46-1 → 46-2 → 46-3 → 全体テスト → samples → 教材)。

この Phase で解決したもの:

- **実 LLM での生成の確認(ユーザー)**(Phase 45 から)→ 終わった・調整なし(この Phase の「着手時の相談で決めたこと」1)。
- **Phase 46 への入力**(Phase 45 から。差分の起点は DF の ID・タスクのキー)→ 要素のキー `df:DF-1`・`task:U-001`([46-1](./Phase-46-1.md))。
- 41-5 の Phase 46 の未確定事項(単位の影響のたどり方)→ 処理(DF)を軸 + 文書のタスク([46-1](./Phase-46-1.md))。

## 完了後の調整

(まだ無い)

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

設問は Phase の要点の要約(回答は求めない)。

1. 簡易モードで処理別データフロー(DF)を「処理の代わり」にすると、要件・テーブルの変更はどの道で単位の手順書に届くか。
2. 簡易モードでは、なぜ実装計画書のタスクも軸に含めるのか。詳細設計モードの段階7のタスクが軸にならないのはなぜか。
3. WBS の依存(`depends_on`)とモジュールの共有から広げないのはなぜか(ベースライン S8 との関係)。
4. 生成で4文書を作り終えてから1文書ずつ差分を取るのはなぜか。印の出どころとの関係は。
5. 簡易モードで pending の印を出さず、`mayHaveImpact` も「古い」だけでは影響を取らないのはなぜか。

## 次のフェーズ

**Phase 47**: ヒアリングの側面(L2 バックアップ・L5 ログに本文を残さない・L6 不正利用・L14 削除)と判定のゆらぎ。着手時に自動実装モード(#21)と [41-5](../Phase-41/Phase-41-5.md) の Phase 47 の未確定事項(観点の `done_when` を側面の単位に分けるか追いの問いを足すか・規模ごとに側面の必須を変えるか・ゆらぎを何回の測定で測るか)を決める。
