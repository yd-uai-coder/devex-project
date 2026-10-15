# Phase 51 導入: ステージ8(AI設計レビュー + テスト設計)着手 ── 要件定義フェーズ

## 目的

ステージ7(変更影響分析・変更管理、Phase 41〜50)の完了後、次のステージとして「AI設計レビュー + テスト設計」を始める。構想は [ロードマップ](../../appendix/devex_roadmap.md) のステージ8にある。Phase 51 は、[Phase 41](../Phase-41/Phase-41-introduction.md) と同じく、実装に入る前の要件定義フェーズとして次を行う。

- 今の自己診断とレビューの方式を、欠陥を仕込んだ生成物で測る(ベースライン。モデルの選定を含む。[51-1](./Phase-51-1.md))
- スコープの確認と仕様診断(#28)・決定と、Phase 50 の申し送りの1件ずつの判断([51-2](./Phase-51-2.md))
- レビュー結果・テスト仕様書の見本(md)と、画面のデモ([51-3](./Phase-51-3.md))
- 決定事項の `docs/*.md` への反映([51-4](./Phase-51-4.md))
- ステージ8の実装計画(Phase 52〜59 の一覧・成果物・依存・未確定事項)([51-5](./Phase-51-5.md))

本体機能(レビューの LLM・指摘の保存・画面・差し戻し・テスト仕様書)の実装は Phase 52 以降で行う。

## パイプライン上の位置づけ・前提

```
[51-1 ベースライン]  stage7-effect の生成物 + 仕込み5件 ── 正解表を先に書く ── 方式を3回ずつ
        │ (c) 今の自己診断 → (d)(d') 指示と入力を変える → (a) Sonnet・Haiku → (e) 下流の文書・区切りごと
        │ 所見: 見落としの原因はモデルの格。区切りごとが一番当たる。手順書はレビューにならない
        ▼
[51-2 診断と決定]  モデルの振り分け・区切り(自動とボタン)・採否と差し戻し・再ヒアリング・オン・オフ・テスト仕様書 …
        ▼
[51-3 見本]  appendix/design-review-sample/(レビュー結果・テスト仕様書の md)+ devex-ui /design-review-demo
        ▼
[51-4 docs]  requirements Could / external 2.11 / internal 3.3-8 / implementation_plan 4.1 ステージ8
        ▼
[51-5 計画]  52 土台 → 53 画面 → 54 差し戻し → 55 手順書の検証 → 56 テスト仕様書 → 57 その画面 → 58 効果測定 → 59 E2E・デプロイ
```

- **前提として読むもの**:
  - [`appendix/devex_roadmap.md`](../../appendix/devex_roadmap.md) のステージ8(生成とレビューのモデルを分ける・再ヒアリング・テスト設計・品質評価)
  - [総括の振り返り](../appendix/overall-retrospective.md) 12節(ステージ7の振り返り。12.3 の申し送りの棚卸し)
  - [Phase 50](../Phase-50/Phase-50-introduction.md)「未消化の申し送り」(次のステージの入力7件)
- **今の仕組み**: 生成の後の自己診断は `devex-api/backend/app/services/doc_generator_service.py` の `_self_diagnose`(生成と同じ LLM・4行の指示・自由文をチャットに出す)。決定的な検証は `app/documents/*/validation.py`(文書)と `app/detailed_design/validation.py`(段階・手順書)。詳細は [51-1](./Phase-51-1.md)「調べて分かったこと」。
- **この Phase を始めた時点の状態**: ステージ7の振り返り(外側のリポジトリ)は未コミット。この Phase はその上に重ねた。devex-api の `.env` には `GOOGLE_API_KEY` だけがあり、測定の途中でユーザーが `ANTHROPIC_API_KEY` を足した。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(AI が本体へ実装し、`textbook/samples/` も同じ内容で作る)。この Phase で本体に入れたのは、devex-api の seed の superuser([51-2](./Phase-51-2.md))と、devex-ui のデモページ([51-3](./Phase-51-3.md))だけ。

E2E: この Phase では流さない(画面の流れを変えないため)。ステージ8の E2E は Phase 59 で既存を含めて全部流す([51-5](./Phase-51-5.md))。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 51 開始時」以降を参照。

1. **今の文書生成をどう変える想定か**: 生成は今のモデルのまま、レビューは別のモデルが構造化した指摘だけを返し、設計は書き換えない。差し戻しは人が指摘を選ぶ(自動のループにしない)。
2. **レビューのモデル**: ユーザーは「判定モデルで要件に合うかを見て、高度な推論が要るものだけ強いモデルへ振り分ける」段階式を提案した。Claude は、振り分けを判定モデルに任せると見落としが黙って落ちることを挙げ、決定的な検証 / 安いモデル / 強いモデル(文書をまたぐ検査は常に)の3層を提案し、51-1 で比べることにした。測定の結果、段階式は原則やめた([51-2](./Phase-51-2.md) 決定1)。
3. **自動実装モード**: on。**題材**: stage7-effect の生成物。**回数**: 各方式3回。**比べるもの**: 正解表と今の自己診断。
4. **測定の進め方**: (d) を作って一旦検証を挟む → (d') で出力の形の影響を切り分ける → (a) は Sonnet 5.5 から(ユーザーが鍵を足した)→ Haiku 4.5 も → (e) 下流の文書と区切りごと。

仕様診断の決定(11項目と申し送り)は [51-2](./Phase-51-2.md)。推奨と違った選択は5つ(モデルは Sonnet と Haiku を振り分ける・いつ流すかはデータを見て「要件・外部だけ自動」・失敗時は自己診断に切り替える・1日の回数上限を設ける・テスト仕様書はレビューせず決定的な検証だけ)。

Claude の判断(計画の承認で確定、または作業中):

- 正解表はどの方式も流す前に書き、後から書き換えない([Phase 49](../Phase-49/Phase-49-introduction.md) と同じ)。見る観点は文書の種類と節から一般的に書き、正解表から逆算しない。
- Claude は devex-api の依存を変えず、測定のスクリプトだけ `uv run --with langchain-anthropic` で呼んだ。
- (e) では、詳細設計の段階の決定的な検証を、図の要約を渡さずに流し、見かけの指摘(「図がまだ無い」)を除いて渡した。
- デモはデータを Sonnet の実際の指摘から作り、引用(evidence)と観点のキーを足した。
- 「開発用」メニューを、このデモのために足し直した(ステージ7の完了時に外していた。[51-3](./Phase-51-3.md))。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-51-1.md`](./Phase-51-1.md) | ベースライン: 今の自己診断とレビューの方式を測る(モデルの選定・区切りごとの効果を含む) | あり(`appendix/stage8-baseline/`。使い捨てのスクリプトと結果。samples の対象外) | なし |
| [`Phase-51-2.md`](./Phase-51-2.md) | スコープの確認と仕様診断(#28)・決定・申し送りの判断。seed の superuser | あり(devex-api の seed とそのテスト) | 51-1 |
| [`Phase-51-3.md`](./Phase-51-3.md) | レビュー結果・テスト仕様書の見本(md)と画面のデモ `/design-review-demo` | あり(md の見本・devex-ui 本体と samples) | 51-2 |
| [`Phase-51-4.md`](./Phase-51-4.md) | `docs/*.md`・README・ロードマップへの反映 | `docs/` 配下ほか(文書のため #13/#15/#30 の対象外) | 51-2, 51-3 |
| [`Phase-51-5.md`](./Phase-51-5.md) | ステージ8の実装計画(Phase 52〜59) | なし(計画の文書) | 51-2〜51-4 |

51-2 の決定2(いつ流すか)は、51-1 の追加測定 (e) の結果を見てから決めた(番号は章の内容の順)。

## サンプルコード一覧

- [51-2](./Phase-51-2.md)(`textbook/samples/backend/` 配下): `scripts/seed.py`(superuser を足す)・`tests/unit/test_seed_users.py`
- [51-3](./Phase-51-3.md)(`textbook/samples/frontend/src/` 配下):
  - `features/design-review/demo/reviewModel.ts`(意味モデルと純粋関数)
  - `features/design-review/demo/demoData.ts`(仮データ)
  - `features/design-review/demo/DesignReviewDemoPageContent.tsx`(デモ画面)
  - `app/design-review-demo/page.tsx`(ルート)、`lib/menu-tree.ts`(メニューへの追加)
  - 上記の `__tests__/` 配下のテストと、`components/layout/__tests__/Menu.test.tsx`(メニューのテストの追加)

md の見本は [`appendix/design-review-sample/`](../../appendix/design-review-sample/README.md)、ベースラインは [`appendix/stage8-baseline/`](../../appendix/stage8-baseline/README.md)(どちらも samples の対象外)。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| [51-1](./Phase-51-1.md) | `appendix/stage8-baseline/`(`review.py`・`truth.md`・`truth-e.md`) | 題材にレビューの方式を流し、正解表と比べて当たり・見落とし・費用を数える | なし(使い捨ての測定) |
| [51-2](./Phase-51-2.md) | `scripts/seed.py`・`tests/unit/test_seed_users.py` | 一般ユーザーと superuser を冪等に作る | 2人とも作られ superuser だけ昇格する・2回流しても2人のまま(`uv run pytest tests/unit/test_seed_users.py`) |
| [51-3](./Phase-51-3.md) | `reviewModel.ts`・`demoData.ts`・`DesignReviewDemoPageContent.tsx`・`page.tsx`・`menu-tree.ts` | レビューの区切り・指摘の採否・差し戻し(再生成の指示と再ヒアリング)・オン・オフの見せ方の見本 | オンの判定・区切りの状態と知らせ・指摘の並びと数・再生成の指示に入る指摘・観点を未決に戻す・画面の操作(`npx vitest run src/features/design-review "src/app/(pages)/design-review-demo" src/components/layout`) |
| [51-4](./Phase-51-4.md) | `docs/*.md`・`README.md`・ロードマップ | 決定事項の反映 | なし(文書の目視レビュー) |
| [51-5](./Phase-51-5.md) | なし | Phase 52〜59 の区切りと未確定事項 | なし(文書の目視レビュー) |

## 写経順序(#23)

章番号順。写経の対象になるファイルは [51-2](./Phase-51-2.md) と [51-3](./Phase-51-3.md) にある。各章の「この章で作成・更新したファイル」の表の順に写す。

実 import 監査(#15):

- `scripts/seed.py` は既存の `UserService`・`UserAlreadyExistsError` などを読む(新しい import は無い)。`test_seed_users.py` は `scripts.seed`(同じ章)と既存の `User`・`UserRepository` を読む。
- `reviewModel.ts` は何も import しない。`demoData.ts` は `./reviewModel` の型(`Finding`・`HearingPoint`・`Mode`)だけを読む。
- `DesignReviewDemoPageContent.tsx` は `./demoData`・`./reviewModel`(同じ章)と、既存の `@/features/detailed-design/components/tableStyles`(`BADGE`・`CELL`・`HEAD`・`MONO`・`TABLE`)を読む。
- `page.tsx` は `DesignReviewDemoPageContent`(同じ章)を読む。`menu-tree.ts` は新しい import を足していない。
- 前方 import は無い。章が作成・更新するファイルは、その章のテストが少なくとも1度 import する([51-2](./Phase-51-2.md)・[51-3](./Phase-51-3.md)「テスト観点」)。

## 検証結果

- 51-1: `review.py` で 8方式(自己診断・構造化・自由文・Sonnet・Haiku・全文書1回・区切りごと)を各3回流し、`results.md` に判定を書いた。Anthropic の費用は合計 約 $3.0(flash-lite の方式は無料枠)。`ruff check` 成功(長い指示の文の E501 と、外から流す import の並び I001 は除く)。
- 51-2: devex-api の seed のテスト 4件成功(`test_seed_users.py` 2件・`test_seed_prompt_templates.py` 2件)、`ruff check` 成功。
- 51-3: devex-ui のデモ・ルート・メニューのテスト 20件成功、`tsc --noEmit`・eslint・`npm run build` 成功(`tsc` は1回目、ステージ7の完了時に外したデモのルートの古い型ファイルで1件落ち、ビルドで作り直した後は成功)。
- Phase 完了時の全体テスト(#18): devex-ui 792 件成功(`--maxWorkers=4`、1回目)、devex-api 1066 件成功(8件は既定で除外の統合テスト)。
- `samples_check.py`(`--api-since HEAD --ui-since HEAD`): 不一致 0 件・作り忘れ 0 件(一致 572 / 並び順のみ差 8 / 例外 5)。「samples のみ」2件は、ステージ7の完了時にユーザーが本体から外した `change-impact-demo` のルート(この Phase の前からある)。`link_check.py`: 切れ 0 件。

## 未消化の申し送り(#37)

Phase 50 から引き継いだもの([51-2](./Phase-51-2.md) で1件ずつ判断した):

- ステージ8の計画に入れたもの: **「AI に提案を求める」**(→ Phase 54 の差し戻し)・**判定がログインの方法だけでセキュリティを埋めた**・**初期入力だけで MVP の範囲が対象外になった**(→ Phase 52〜54 のレビューと再ヒアリングで拾い、Phase 58 で確かめる)。
- 持ち越し: **DFD のデータストアの書き漏れ**(49-2 から。51-1 の (e) で、レビューは6回とも当てた ── チャット・生成が履歴・参考資料を読まない型。仕組みの側の直しは持ち越す)・**補いの文字の当たり**(Phase 48 から)・**画面の文の変更は、その画面のすべての処理へ届く**(49-4 から)・**改名の後に下流の参照を直して承認すると広がる**(Phase 43 から)。
- 持ち越し(触るときに直す): **`test_chat_service.py` の pyright の指摘4件**(Phase 40 から)・**並列のテストのタイムアウト**(Phase 44 から。devex-ui の全体テストは `--maxWorkers=4`)・**偽 LLM の外部設計書の GET に DF が無い**(Phase 45 から)。

この Phase で生まれたもの:

- **Phase 52〜59 の未確定事項**: [51-5](./Phase-51-5.md)「未確定事項」。
- **Judge(狭い判定のモデル)の使い道**: 直ったかの確認・測定の採点の自動化・指摘の検証。組み込みの段階で検討する(ユーザーの判断。直ったかの確認は Phase 54 でシャドーモード)。
- **テスト仕様書の中身の正しさ**: レビューを適用しないので、期待結果と設計の食い違い・境界値の取り方・認可のテストの抜けは見ない(51-2 の決定)。Phase 58 の効果測定で、テスト仕様書の正解例に対して決定的な検証がどこまで拾うかを数え、足りなければ見直す。
- **実装手順書に固有の欠陥**: レビューでは当たらない(51-1 の (e))。決定的な検証を Phase 55 で強める。テスト観点が正常系だけ、は決定的には調べにくく、残る。
- **要件の「書かれていないこと」**: Sonnet でも、アクセス制御の要件がヒアリングで落ちたこと(D-NAT-1)は、API の側の穴としてしか言わない。再ヒアリングの指示(観点の表の読ませ方)を Phase 52 で詰め、Phase 58 で確かめる。
- **生成のモデルと Gemini の無料枠**(51-1 の追加測定 (f)): 3.8 Flash は簡易モードの欠陥の型をほぼすべて直したが、無料枠の RPD 20・1回 3〜10 分で使えない。生成は flash-lite のまま。有料枠にするときは、文書の生成だけ 3.8 Flash にする役割ごとのモデル・タイムアウトの延長・429/503 で落とす仕組みを検討する(ステージ8の範囲の外)。あわせて、今の本体は混雑(503・504)を待たずに失敗にし、`LLM_TIMEOUT_SECONDS` 30秒は混雑時の flash-lite でも切れうる(測定の前日に「OK」の一言で 48秒・504)。
- **devex-ui の「開発用」メニュー**: このデモのために足し直した。ステージ8の完了時に、ユーザーが前と同じく外すかを決める。
- **ステージ7の振り返りの未コミット**: この Phase の前からある外側のリポジトリの変更(振り返り・handoff v2 など)。コミットはユーザーが行う。
- **セッションの区切りの記録**: Phase 51 は1セッション(途中で文脈の要約を1回挟んだ)で行った(計画モードで方針の提示と差し戻し2回 → 51-1 (c) → (d) → 検証の区切り → (d') → Judge の検討 → (a) Sonnet(鍵の追加・クレジットの追加を待つ)→ Haiku → 費用の試算 → ChatGPT 案への所感 → seed の superuser → 51-2 の診断(質問3回)→ (e)(鍵の差し替えを待つ)→ 決定2 → 51-3 → 51-4 → 51-5 → 教材)。

この Phase で解決したもの: なし(申し送りは計画に入れたか、持ち越した)。

## 後続 Phase での改訂

- Phase 58 の完了後: [51-5](./Phase-51-5.md) の計画に Phase 59(Phase 58 の申し送りの解決)を差し込み、旧 Phase 59(統合/E2E・デプロイ)を 60 へ送った(ユーザー決定)。この introduction の「Phase 59」は送る前の番号。

## Phase 完了チェック(#22)

設問は Phase の要点の要約(回答は求めない)。

1. 今の自己診断の見落としが「指示と入力」でなく「モデルの格」によると言えるのはなぜか。(c)→(d)→(d')→(a) の順に、何を1つずつ変えたかから説明できるか。
2. 判定モデルで振り分ける段階式を採らなかったのはなぜか。安いモデルが文書をまたぐ矛盾を一度も当てなかったことと、入力の大きさ(費用)から説明できるか。
3. 全文書をまとめて1回でレビューするより、承認の区切りごとの方が当たるのはなぜか。上流の欠陥の当たり(9.0 → 6.3 → 7.7)から説明できるか。それでも段階6・7 をボタンにしたのはなぜか。
4. 実装手順書をレビューの対象にせず、決定的な検証を強めることにしたのはなぜか。手順書に固有の欠陥のうち、機械で調べられるものと、調べにくいものを分けられるか。
5. 正解表をどの方式も流す前に書き、見る観点を正解表から逆算しなかったのはなぜか。

## 次のフェーズ

**Phase 52**: レビューの土台(レビューの LLM・入力・構造化出力・回と指摘の保存・オン・オフと上限・失敗時の自己診断・文書の生成の後の自動レビュー)。着手時に自動実装モード(#21)と [51-5](./Phase-51-5.md) の未確定事項を決める。
