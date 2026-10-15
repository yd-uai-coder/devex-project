# Phase 60 導入: 統合/E2E・デプロイでの確認(ステージ8)

## 目的

ステージ8(AI 設計レビュー + テスト設計)の最後の Phase。Phase 52〜59 で作った設計レビュー(自動のレビュー・区切り・採否・差し戻し・聞き直し・「直ったか」)・実装手順書の検証・テスト仕様書を通しで確かめ、本番に出す準備をする。新しい機能は作らない([Phase 50](../Phase-50/Phase-50-introduction.md) と同じ型)。

- **偽 LLM の契約テスト**: 偽 LLM の出力が、レビュー → 採用 → 差し戻し → 流れ直し → 「直ったか」→ 聞き直しと、詳細設計モードの段階の区切り・テスト仕様書を通ることを、ブラウザを使わない単体テストで固定する(60-1)。
- **E2E**: 簡易モードの spec に、superuser がレビューをオンにして指摘を採用する流れとテスト仕様書のタブを足し、既存を含めた全 E2E を流す(60-2)。
- **「開発用」メニュー**: ステージ6・7 の完了時と同じく外す(60-3)。
- **デプロイ**: 本番をステージ8の版へ更新する手順(鍵の設定・superuser の昇格を含む)を `OPERATIONS.md` 10.5節に書き、マイグレーションの往復を確かめる(60-4)。

計画は [51-5](../Phase-51/Phase-51-5.md) の Phase 60。

## パイプライン上の位置づけ・前提

```
[60-1 契約テスト(BE、ブラウザ無し)]
  E2eFakeLLM ─▶ 簡易: 生成 → 自動のレビュー(指摘2件)→ 採用 → 差し戻しで再生成 → 流れ直し
              → 追跡「変更あり」→ 「直ったか」fixed → 予約札で二度目は0件 → 聞き直し
              詳細: 段階1〜7 承認 → 段階6・7 の区切り → 起点 test_spec でテスト仕様書
[60-2 E2E(ブラウザ)]
  Playwright ─▶ devex-ui ─▶ devex-api(E2E_FAKE_LLM=true)
    devex-flow.spec.ts: 一般の利用者にパネル無し → DB で superuser に → オン → レビューする → 2件を採用
    全 E2E(4件)
[60-3 「開発用」メニューを外す(FE)]
[60-4 デプロイ(手順書のみ)]
  OPERATIONS.md 10.5: バックアップ → 鍵 → stage8→main の PR → 5本のマイグレーション → superuser の昇格
                      → UI → 本番での確認(Claude の見込み 約 $0.6・最大 約 $1.2)
   │
[60-5 docs・README]
```

- **前提として読むもの**:
  - [Phase 50](../Phase-50/Phase-50-introduction.md): 偽 LLM の契約テスト・全 E2E・本番反映の手順の型。
  - [Phase 59 の introduction](../Phase-59/Phase-59-introduction.md)「未消化の申し送り」: この Phase が回収する申し送り(画面確認・E2E・本番の手順・再レビュー)。
  - [Phase 52](../Phase-52/Phase-52-introduction.md)(レビューの土台・実効値)・[Phase 53](../Phase-53/Phase-53-introduction.md)(区切りとパネル)・[Phase 54](../Phase-54/Phase-54-introduction.md)(追跡・差し戻し・聞き直し・「直ったか」)・[Phase 56](../Phase-56/Phase-56-introduction.md)(テスト仕様書)。
- **この Phase を始めた時点の状態**:
  - E2E は Phase 50 から流していなかった(#36)。
  - 本番は 10.4 の版(alembic の head `e5f6a7b8c9d1`)。devex-api のステージ8のコミット(Phase 51〜59)は手元の `stage7` ブランチに積んであり、origin へは未 push。devex-ui の `main` は origin より5コミット進んでいる。
  - Phase 59 は3つのリポジトリともコミット済み。Phase 59 の完了後の調整は無かった。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(AI が本体へ実装し、`textbook/samples/` も同じ内容で作った)。

E2E: **この Phase で既存を含めた全 E2E を流す**(#36)。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 60 開始時」を参照。すべて推奨どおり。

| # | 問い | 決定 |
|---|---|---|
| 1 | Phase 59 の完了後の調整・自動実装モード | 調整なし・on |
| 2 | E2E の範囲 | 既存を流して直したうえで、**簡易の spec にレビューを足す**(採否の先は契約テスト) |
| 3 | 本番での確認で Claude をどこまで流すか | **簡易1本 + 詳細1本 + 聞き直しの通し**(見込み 約 $0.6・最大 約 $1.2)。反映と確認は手順書を書いてユーザーが行う |
| 4 | 「開発用」メニュー | 外す(デモのページとコードは残す) |

Claude の判断(計画の承認で確定、または実装中):

- 契約テストは偽 LLM を変えず、テストの中で包む(修正指示を受けたときだけ外部設計書の行を変える。[60-1](./Phase-60-1.md))。
- E2E の superuser は DB を直接更新して作る(seed の superuser を使わない。[60-2](./Phase-60-2.md))。
- E2E では生成の後にオンにして「レビューする」で流す(自動の経路は契約テスト)。
- マイグレーションの往復は dev の DB の複製でだけ行い、行き先のリビジョンを指定した(Phase 54 の事故を踏まえて)。
- インフラの文書(`OPERATIONS.md`)は samples に写さない(#21)。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-60-1.md`](./Phase-60-1.md) | 偽 LLM の契約テスト(設計レビュー・テスト仕様書) | あり(BE のテスト) | なし |
| [`Phase-60-2.md`](./Phase-60-2.md) | E2E(設計レビューの流れ)と全 E2E の実行 | あり(FE の E2E) | 60-1(採否の先を契約テストに任せる) |
| [`Phase-60-3.md`](./Phase-60-3.md) | 「開発用」メニューを外す | あり(FE) | なし |
| [`Phase-60-4.md`](./Phase-60-4.md) | 本番反映の手順(`OPERATIONS.md` 10.5)とマイグレーションの往復 | `OPERATIONS.md`(インフラの文書のため #13/#15/#30 の対象外) | 60-1〜60-3(テストが通ってから出す) |
| [`Phase-60-5.md`](./Phase-60-5.md) | `docs/*.md`・README への反映 | `docs/` 配下・`README.md`(文書のため #13/#15/#30 の対象外) | 60-1〜60-4 |

## サンプルコード一覧

- `textbook/samples/backend/`:
  - 新規(60-1、テスト): `tests/unit/test_fake_llm_design_review.py`
- `textbook/samples/frontend/`:
  - 更新(60-2): `e2e/helpers.ts`・`e2e/devex-flow.spec.ts`
  - 更新(60-3): `src/lib/menu-tree.ts`・`src/components/layout/__tests__/Menu.test.tsx`

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| [60-1](./Phase-60-1.md) | `test_fake_llm_design_review.py` | 偽 LLM の出力がレビュー・採否・差し戻し・聞き直し・「直ったか」・テスト仕様書の経路を通ることを固定する | 自動のレビューの指摘2件と順・テスト仕様書を渡さない・ヒアリングの指摘は再生成に 409・差し戻しで行が変わり「変更あり」→ fixed・二度目は0件・聞き直しで open・オフは自己診断・段階6・7 の区切り |
| [60-2](./Phase-60-2.md) | `helpers.ts` | 登録したメールを返し、DB で superuser にする | (spec が使う) |
| | `devex-flow.spec.ts` | 画面でレビューをオンにし、指摘を採用する。テスト仕様書のタブ | 一般の利用者にパネル無し・オフの文・未レビュー → レビュー済み・指摘2件・採用の件数と聞き直しのボタン・全 E2E が通る |
| [60-3](./Phase-60-3.md) | `menu-tree.ts`・`Menu.test.tsx` | メニューの「開発用」を外す | 「開発用」とデモのリンクが無い |
| [60-4](./Phase-60-4.md) | `OPERATIONS.md` | ステージ8の版への更新・鍵・superuser・確認・ロールバックの手順 | なし(マイグレーションの往復を DB の複製で確かめる) |
| [60-5](./Phase-60-5.md) | `docs/implementation_plan.md`・`README.md` | 完了と達成範囲の反映 | なし(文書の目視レビュー) |

## 写経順序(#23)

章番号順。各章の「この章で作成・更新したファイル」の表の順に写す。60-2 は `helpers.ts` を先に(`devex-flow.spec.ts` が `promoteToSuperuser` を import する)。

実 import 監査(#15。全 import 文を読んで確かめた):

- 60-1: `test_fake_llm_design_review.py`(新規)が読む名前 ── `tests.fixtures.fake_llm_flow.create_fake_detailed_project`・`generate_and_approve_stages_1_to_7`(Phase 50-1)、`tests.fixtures.fake_redis.FakeRedis`(Phase 59-3 で更新)、`app.ai.llm.fake.E2eFakeLLM`、`app.documents.external_design.drafting.ExternalDesignGenerationOutput`、`app.documents.test_spec.validate_test_spec`(Phase 56)、`app.models.project.Project`・`app.models.user.User`、`app.repositories.chat_history.ChatHistoryRepository`、`app.repositories.generated_document.TEST_SPEC`(Phase 56)、`app.repositories.review.ReviewRunRepository`(Phase 52)、`app.review.INSTRUCTION_HEAD`(Phase 54)、`app.services.chat_service.ChatService`、`app.services.doc_generator_service.DocGeneratorService`、`app.services.errors.SendbackFindingInvalidError`(Phase 54)、`app.services.fix_check_service.FixCheckService`(Phase 54)、`app.services.project.ProjectService`、`app.services.review_service.ReviewService`(Phase 52)、`app.services.test_spec_state.current_test_spec`(Phase 57)── はすべて以前の Phase にある。
- 60-2: `devex-flow.spec.ts` が読む `promoteToSuperuser` は同じ章の `helpers.ts` で作る(表で先に置いた)。`helpers.ts` が読む `node:child_process` は Node の標準。
- 60-3: import の変更は無い。

前方 import は無い。章が作成・更新するファイルは、その章のテストが少なくとも1度 import する:

- 60-1: テスト自身。
- 60-2: `helpers.ts` は両方の spec、spec 自身は Playwright が流す。
- 60-3: `menu-tree.ts` は `Menu.test.tsx`(メニューの部品経由)。

## 検証結果

- 部分テスト: 章ごとに、変更した範囲のテストと `ruff check`(ruff format は使わない)・`uvx pyright`(60-1 のテスト。0件)。
- E2E(全 spec): 足す前に3件とも成功。足した流れは spec の誤り1つ(スイッチの `check()`)を直して通った。全体ではダウンロードの名前の期待を1つ直し、登録のレート制限の鍵を消して、最後に全 E2E 4件が成功([60-2](./Phase-60-2.md)「全 E2E で見つかったこと」)。開発用の backend を `E2E_FAKE_LLM=true` で起動し直して流し、終わってから通常の設定に戻した。
- マイグレーションの往復: 開発環境の DB の複製で、5本の downgrade → upgrade を2往復した([60-4](./Phase-60-4.md))。
- Phase 完了時の全体テスト(#18): devex-api ユニット全体 **1270 件成功**(Phase 59 の 1267 件 + 3 件)、`ruff check`(全体)成功。devex-ui: 全体 **888 件成功**(`vitest run --maxWorkers=4` を単独で。件数は Phase 57 と同じ ── 置き換えた1件)、`tsc --noEmit` 成功、eslint はエラー0(以前からある警告1件だけ)。
- 統合テスト: 8 件成功(専用の DB)。
- `samples_check.py`(`--api-since HEAD --ui-since HEAD`): 不一致 0 件・作り忘れ 0 件(一致 665 / 並び順のみ差 8 / 例外 5。「samples のみ」2件は以前からの `change-impact-demo` のルート)。`link_check.py`: 切れ 0 件。
- 実 LLM: 流していない(費用 0)。

## 未消化の申し送り(#37)

Phase 59 から引き継いだもの:

- **本番への反映と本番での確認**(ユーザー): [`OPERATIONS.md`](../../devex-api/OPERATIONS.md) 10.5節の手順で行い、確認の表の結果と Anthropic の実際の費用を記録する。積んであった次の項目は、10.5節の確認の表に移した ── 画面の確認(Phase 53 のパネルの長さ・対象の推定の当たり、Phase 54 のチップ・「採用 n(未対応 m)」・前の回で採用した指摘・「AI: 直った」・再生成のダイアログ・「採用した指摘で段階を作り直す」・「チャットで聞き直す」・各段階のバッジの強調・承認の知らせ、Phase 55 の手順書の「未定義・要決定の一覧」、Phase 57 のテスト仕様書の画面一式、Phase 59 の参照のエラー欄・`NO_ERROR_TEST`・値のカード)、**聞き直しの後の再レビュー**(Phase 59)、**レビューの出力の上限**(Phase 58)、**新しい題材での documents の区切り**(Phase 58)。
- **生成のモデルと Gemini の無料枠**(51-1 の (f)): ステージ8の範囲の外。
- **再生成の失敗を画面で知らせていない**(Phase 53 から)。テスト仕様書の作り直しも同じ。
- **dev の DB の事故の後始末**(Phase 54): ほかのプロジェクトの変更の影響の印は戻らない。
- **段階の作り直しの後に承認できない**(Phase 54): エラーが出たときの見せ方は未検討のまま。
- **実装手順書に固有の欠陥のうち、決定的に調べられないもの**: マイルストーンのゴールと単位の食い違い(PR-7)。
- **段階4 の層の選択**(Phase 55 の完了後の調整): 今のデータの行は画面で「(構成図に無い)」のまま。
- **zip の HTML**(Phase 57): テスト仕様書は md だけ。
- **詳細設計モードのテスト仕様書を生成中に画面を開き直す**(Phase 57): 生成中の表示は出ない。
- **段階6 の区切りを 51-1 の題材で直した指示で流していない**(Phase 58)。
- **flash-lite の判定の要約の文字化け**(Phase 58): Phase 59 では出なかった。
- **カードで選ぶと観点の要約が置き換わる**(Phase 59)。
- **値のカードが論点の一部しか値にしない**(Phase 59)。
- **要件ごとのテストの書き方が浅い**(Phase 59)。
- **変更のきっかけを列挙する再生成の設計**(Phase 59)。
- **dev の DB の複製のプロジェクト5つ**(Phase 59): 確認用に残した。不要ならユーザーが消す。
- 持ち越し: **DFD のデータストアの書き漏れ**(49-2 から)・**補いの文字の当たり**(Phase 48 から)・**画面の文の変更は、その画面のすべての処理へ届く**(49-4 から)・**改名の後に下流の参照を直して承認すると広がる**(Phase 43 から)。
- 持ち越し(触るときに直す): **`test_chat_service.py` の pyright の指摘4件**(Phase 40 から)・**並列のテストのタイムアウト**(Phase 44 から。この Phase の devex-ui の全体テストは単独で流して全件成功)・**偽 LLM の外部設計書の GET に DF が無い**(Phase 45 から)。

この Phase で生まれたもの:

- **全 E2E を1時間に2回流すと、登録のレート制限に当たる**([60-2](./Phase-60-2.md)): 全 E2E は4人を登録し、登録は IP ごとに1時間10回まで。流し直すときは dev の Redis の `rate_limit:register_ip:3600:172.22.0.1` を消す。E2E のオーバーレイ(`docker-compose.e2e.yml`)で上限を上げるかは、E2E を CI で流すか(`retrospective-memo.md` の候補)と合わせて決める。
- **E2E の superuser の昇格は dev の docker compose の DB に依存する**([60-2](./Phase-60-2.md)): E2E を CI で流すなら、昇格の仕方を合わせて見直す。
- **セッションの区切りの記録**: Phase 60 は1セッションで行った(計画モードで調査 → 質問1回(4問)→ 計画の承認 → 60-1 の契約テスト(包みを足して3回直す)→ 60-2 の全 E2E(足す前に1回、足した流れを1回直して、全部を3回 ── 名前の期待とレート制限)→ 60-3 → 60-4 のマイグレーションの往復と 10.5節 → docs → 全体テスト・統合テスト → 教材)。

この Phase で解決したもの:

- **Phase 60 の未確定事項**([51-5](../Phase-51/Phase-51-5.md)): 本番の鍵と superuser の手順(10.5節の 3・5・6)、本番での確認の範囲(着手時の決定3)、「開発用」メニュー(外した。[60-3](./Phase-60-3.md))。
- **本番の手順**(Phase 52 から): `ANTHROPIC_API_KEY`・superuser の昇格・`langchain-anthropic`・Alembic 5本を 10.5節に書いた([60-4](./Phase-60-4.md))。
- **依存の更新**(Phase 52 から): `langchain-core` 1.6.10 で全体テスト・E2E が通ることを確かめ、10.5節に書いた。
- **devex-ui の「開発用」メニュー**(Phase 51 から): [60-3](./Phase-60-3.md)。
- **E2E のタブ・ステッパーの行の数**(Phase 57 から): 数を数える期待は無く、壊れていなかった。テスト仕様書のタブを E2E に足した([60-2](./Phase-60-2.md))。
- **既存を含めた全 E2E**(51-5): 流して、壊れた期待は無かった。レビューの流れを足した([60-2](./Phase-60-2.md))。

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

設問は Phase の要点の要約(回答は求めない)。

1. 偽 LLM のまま差し戻しで再生成すると、追跡が「対象が変わっていない」になり「直ったか」が判定されないのはなぜか。それが正しい動きと言えるのはなぜか。
2. 契約テストで、偽 LLM を変えずにテストの中で包んだのはなぜか。包みの分岐に `## 修正指示` の見出しではなく指示の文の頭を使ったのはなぜか。
3. E2E で superuser を DB の直接の更新で作り、生成の後にオンにしてボタンでレビューを流したのはなぜか。自動の経路はどこで確かめているか。
4. ステージ8の更新で、鍵を入れ忘れても本番が壊れないのはなぜか。それでも鍵の有無を確かめる手順を置いたのはなぜか。
5. ロールバックしてもテスト仕様書の行が画面に出ないのはなぜか。もう一度更新するとどうなるか。

## 次のフェーズ

ステージ8はこの Phase で終わる。次は、ステージ8の完了として、振り返り(#10、[`overall-retrospective.md`](../appendix/overall-retrospective.md)。#25 の「→ Devex 仕様への示唆」と #39 の AI の提案の精度を含む)と decision digest(#24)をまとめる。#18 により、別のセッションで行う。本番への反映と確認は、ユーザーが [`OPERATIONS.md`](../../devex-api/OPERATIONS.md) 10.5節の手順で行う。
