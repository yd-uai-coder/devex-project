# Phase 33 導入: ステージ6(ヒアリング改良 + 上流の構造化)着手 ── 要件定義フェーズ

## 目的

ステージ5(実装手順書 + 実装可能性チェック、Phase 25〜32)の完了後、次のステージとして「ヒアリング改良 + 上流の構造化」を始める。構想は [ロードマップ](../../appendix/devex_roadmap.md) のステージ6にある。Phase 33 は、[Phase 25](../Phase-25/Phase-25-introduction.md) と同じく、実装に入る前の要件定義フェーズとして次を行う。

- 今の Devex を実際の LLM で段階8まで動かし、未定義を「ヒアリングで聞くべきだった項目」までさかのぼって分類する(ベースライン。[33-1](./Phase-33-1.md))
- スコープの確認と仕様診断(#28)・決定([33-2](./Phase-33-2.md))
- 構造化した要件定義の見本(md)と、画面のデモ([33-3](./Phase-33-3.md))
- 決定事項の `docs/*.md` への反映([33-4](./Phase-33-4.md))
- ステージ6の実装計画(Phase 34〜40 の一覧・成果物・依存・未確定事項)([33-5](./Phase-33-5.md))

本体機能(観点の表・選択肢カード・2文書のモデル化・要件からの追跡)の実装は Phase 34 以降で行う。

## パイプライン上の位置づけ・前提

```
[33-1 ベースライン]  ローカルの devex-api(実 LLM)── ペルソナ(利用者の役)── 両モード → 段階8 → 未定義の分類
        │ 所見: 3回で完了・非機能は聞かれない・技術スタックの創作・要件の推測が6〜7割
        ▼
[33-2 診断と決定]   観点の表(新テーブル)・2文書のモデル化・IPA 6大項目と規模・段階1の req_ids・カード …
        ▼
[33-3 見本]  appendix/structured-requirements-sample/(md)+ devex-ui /hearing-points-demo
        ▼
[33-4 docs]  requirements 1.4 / external 2.9 / internal ⑪・3.3-6 / implementation_plan 4.1 ステージ6
        ▼
[33-5 計画]  Phase 34 観点の表 → 35 カード → 36 要件定義書 → 37 外部設計書 → 38 追跡 → 39 効果測定 → 40 E2E・デプロイ
```

- 前提として読むもの:
  - [`appendix/devex_roadmap.md`](../../appendix/devex_roadmap.md) のステージ6(観点の状態・出どころ・非機能要求グレード・問い方・要件ID・効果の測り方)
  - [総括の振り返り](../appendix/overall-retrospective.md) 9節(ステージ5の振り返り。9.3「手順書を作ると、設計の穴が見える」と 9.4 の AI 所見「2モードの粒度を表に」)
  - [Phase 32](../Phase-32/Phase-32-introduction.md)「未消化の申し送り」(出力の未定義の分類)
- ヒアリングの今の仕組み: 5条件の完了判定(`devex-api/backend/app/services/chat_service.py`)、Markdown の要件定義書・外部設計書(`doc_generator_service.py`)、生成後の自己診断。詳細は [33-2](./Phase-33-2.md)「調べて分かったこと」。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(AI が本体へ実装し、`textbook/samples/` も同じ内容で作る)。この Phase で本体に入れたのは、devex-ui のデモページだけ。

E2E: この Phase では流さない(画面の流れを変えないため)。ステージ6の E2E は Phase 40 で既存を含めて全部流す([33-5](./Phase-33-5.md))。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 33 開始時」を参照。

1. **自動実装モード**: on(推奨どおり)。
2. **ものさしの材料**: ローカルで実 LLM を回す(推奨どおり)。効果測定のベースラインも兼ねる。
3. **見本**: md の見本と画面のデモの両方(推奨どおり)。

Claude の判断(計画の承認で確定):

- 診断の前にベースラインを取る(Phase 25 の「診断 → 見本」と順が違う。診断がベースラインを入力にするため)。
- 利用者の役は、ゴール3の発言を順に送るのでなく、ペルソナ([`persona.md`](../../appendix/stage6-baseline/persona.md))で1回ずつ答える。改良の後に同じペルソナで流せば、「聞かれたかどうか」の差がそのまま出る。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-33-1.md`](./Phase-33-1.md) | ベースライン: 実 LLM の段階8と未定義の分類(ものさし) | あり(`appendix/stage6-baseline/`。生成物と使い捨てのスクリプト。samples の対象外) | なし |
| [`Phase-33-2.md`](./Phase-33-2.md) | スコープの確認と仕様診断(#28)・決定 | なし(設計討議) | 33-1 |
| [`Phase-33-3.md`](./Phase-33-3.md) | 構造化した要件定義の見本(md)と画面のデモ `/hearing-points-demo` | あり(md の見本・devex-ui 本体と samples) | 33-2 |
| [`Phase-33-4.md`](./Phase-33-4.md) | `docs/*.md`・README・ロードマップへの反映 | `docs/` 配下ほか(文書のため #13/#15/#30 の対象外) | 33-2, 33-3 |
| [`Phase-33-5.md`](./Phase-33-5.md) | ステージ6の実装計画(Phase 34〜40) | なし(計画の文書) | 33-2〜33-4 |

## サンプルコード一覧

すべて [33-3](./Phase-33-3.md) の作成物(`textbook/samples/frontend/src/` 配下)。

- `features/hearing-points/demo/hearingPointsModel.ts`(意味モデルと純粋関数)
- `features/hearing-points/demo/demoData.ts`(仮データ)
- `features/hearing-points/demo/HearingPointsDemoPageContent.tsx`(デモ画面)
- `app/hearing-points-demo/page.tsx`(ルート)、`lib/menu-tree.ts`(メニューへの追加)
- 上記の `__tests__/` 配下のテスト

md の見本は [`appendix/structured-requirements-sample/`](../../appendix/structured-requirements-sample/README.md)、ベースラインは [`appendix/stage6-baseline/`](../../appendix/stage6-baseline/README.md)(どちらも samples の対象外)。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| [33-1](./Phase-33-1.md) | `appendix/stage6-baseline/`(`drive.py`・`persona.md`) | 今の Devex の未定義と、聞けた事実・要件の出どころを数える | なし(生成物の分類) |
| [33-2](./Phase-33-2.md) | なし | スコープと作り方の決定 | なし(設計討議) |
| [33-3](./Phase-33-3.md) | `hearingPointsModel.ts`・`demoData.ts`・`HearingPointsDemoPageContent.tsx`・`page.tsx`・`menu-tree.ts` | 観点の表・カード・出どころ・追跡の見せ方の見本 | 規模と必須・完了の判定(対象外を含む)・カードの答えの状態・出どころの数え方・追跡の指摘・画面の操作(`npx vitest run src/features/hearing-points "src/app/(pages)/hearing-points-demo" src/components/layout`) |
| [33-4](./Phase-33-4.md) | `docs/*.md`・`README.md`・ロードマップ | 決定事項の反映 | なし(文書の目視レビュー) |
| [33-5](./Phase-33-5.md) | なし | Phase 34〜40 の区切りと未確定事項 | なし(文書の目視レビュー) |

## 写経順序(#23)

写経の対象になるファイルは [33-3](./Phase-33-3.md) にだけある。章の「この章で作成・更新したファイル」の画面のデモの表の順に写す。

実 import 監査(#15):

- `hearingPointsModel.ts` は何も import しない。
- `demoData.ts` は `./hearingPointsModel` の型(`FunctionRow`・`PointState`・`QuestionCard`・`Requirement`・`UnitRow`)だけを読む。どれも同じ章の先の行で作る。
- `HearingPointsDemoPageContent.tsx` は `./demoData`・`./hearingPointsModel`(同じ章)と、既存の `@/features/detailed-design/components/tableStyles`(`BADGE`・`CELL`・`HEAD`・`INPUT`・`TABLE`。Phase 17・21 で作った既存のもの)を読む。
- `page.tsx` は `HearingPointsDemoPageContent`(同じ章)を読む。`menu-tree.ts` は新しい import を足していない。
- 前方 import は無い。章が作成・更新するファイルは、その章のテストが少なくとも1度 import する([33-3](./Phase-33-3.md)「テスト観点」)。

## 検証結果

- 33-1: ローカルの devex-api(`main` = ステージ5の版)を、実 LLM(`gemini-3.5-flash-lite`)で両モードとも段階8の承認と zip まで流した。段階3で検証のエラー(`DFD_WRITE_MISSING`)が出たので、画面で人がする最小の修正をして進めた([README](../../appendix/stage6-baseline/README.md)「人の操作」)。
- devex-ui: デモ・ルート・layout のテスト 19 件成功(1回目)、`tsc --noEmit`・eslint・`npm run build` 成功。
- Phase 完了時の全体テスト(#18): devex-ui 644 件成功(`--maxWorkers=4`、1回目。Phase 32 の 627 件 + この Phase の 17 件)。devex-api は変更なし。
- `samples_check.py`(`--api-since HEAD --ui-since HEAD`): 不一致 0 件・作り忘れ 0 件(一致 468 / 並び順のみ差 8 / 例外 5)。`link_check.py`: 切れ 0 件(3232 件)。appendix の新しい md(対象外)も同じ方法で確かめ、切れ 0 件。

## 未消化の申し送り(#37)

Phase 32 から引き継いだもの:

- **持ち越し(Phase 22 から)**:
  - 段階6が開いていないときの、05 の詳細バッジ
  - ER の主キーの NULL の表示
- **E2E を CI で流すか**: 未定([`retrospective-memo.md`](../retrospective-memo.md) に候補として記録済み)。#36 のまま続ける(ステージ5の振り返り)。
- **コミュニケーション図**: 後回し([25-5](../Phase-25/Phase-25-5.md))。
- **「段階Nで直す」の移動先での強調**: 段階5は手順・処理を開くが、段階3・4・7は段階を開くだけ。必要なら各パネルに `focus` を読ませる。
- **「AI に提案を求める」**: ステージ8(AI 設計レビュー・再ヒアリング)との境界として申し送る。
- **段階8の生成の入力の大きさ**(Phase 29 から): 問題になれば測る。ベースライン(33-1)でも、1回5単位の生成は15秒ほどで、問題は出なかった。
- **生成済みの簡易モードのプロジェクト**: Phase 31 より前に生成した文書では、段階8の単位が空になる。文書を再生成すると使える。
- **WBS の書式の守られ方**: ベースライン(33-1)の簡易モードでも、WBS は書式どおりに解析できた(12単位)。
- **DF の ID の振り直し**: 内部設計書の再生成で `DF-<n>` が振り直されうる。ステージ6の要件ID でも同じ問題が起きうるので、Phase 36 の未確定事項に入れた([33-5](./Phase-33-5.md))。
- **セッションの区切りの記録**(#18 の見直しの材料): Phase 25〜32 はそれぞれ1セッション。

この Phase で解決したもの:

- **出力の未定義の分類**(Phase 25 から): [33-1](./Phase-33-1.md) で、実 LLM の段階8の未定義を4つの原因(ヒアリング漏れ・上流文書の書き落とし・設計段階の不足・生成の誤り)に分けた。手順書の出力に分類を足すことはしない(33-2 決定10)。

この Phase で生まれたもの:

- **ベースラインで見つけた、ステージ6の範囲の外の課題**:
  - 段階3の CRUD 図の下書きが、DFD の書き込みの線と食い違う(検証 `DFD_WRITE_MISSING` が4件出て、人が直した)。下書きのプロンプトか、DFD からの導出で防げないか。
  - 段階5の手順の分岐の行の書き落とし(`MISSING_BRANCH_TARGET` が15件)。
  - 簡易モードの内部設計書の書き落とし(処理(DF)の無い機能の単位など。33-1 の分類 B)。内部設計書のモデル化はステージ6の範囲の外(33-2)。
- **Phase 34〜40 の未確定事項**: [33-5](./Phase-33-5.md)「未確定事項」。
- **セッションの区切りの記録**: Phase 33 は1セッションで行った(計画 → 33-1 ベースライン(実 LLM の実行を含む)→ 33-2 診断(質問3回)→ 33-3 見本とデモ → 33-4 docs → 33-5 計画)。最初に計画モードに1回入った。全体テストは Phase 完了時の1回だけ。

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

1. ベースラインで、未定義のうちヒアリングが原因のものが少なかった(詳細4件・簡易1件)のに、ヒアリングの改良が要ると言えるのはなぜか。実装可能性チェックが何を見て、何を見ないかから説明できるか。
2. 完了の判定を LLM に任せず、観点の表からコードで決めると、ベースラインで起きた「未達と書いた条件を聞かないまま十分」はどう防げるか。
3. 必須の観点を広めに取っても利用者の負担が大きくならないのはなぜか。「対象外」の状態の役割から説明できるか。
4. 要件の出どころを「ユーザー / 採用 / 推測」の3つにしたのはなぜか。カードの選択と自由な答えが、それぞれどの出どころになるか。
5. 効果測定を E2E・デプロイの前の Phase に置いたのはなぜか。

## 次のフェーズ

**Phase 34**: 観点の表(`hearing_points`・観点の定義と規模の表・観点ごとの判定と決定的な完了判定・チャット画面の観点の表・既存プロジェクトの扱い)。着手時に自動実装モード(#21)と [33-5](./Phase-33-5.md) の未確定事項を決める。
