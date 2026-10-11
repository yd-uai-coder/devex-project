# Phase 40 導入: 統合/E2E・デプロイでの確認(ステージ6)

## 目的

ステージ6(ヒアリング改良 + 上流の構造化)の最後の Phase。Phase 34〜39 で作った観点の表・選択肢カード・要件定義書と外部設計書の model・要件の追跡を通しで確かめ、本番に出す準備をする。新しい機能は作らない([Phase 32](../Phase-32/Phase-32-introduction.md) と同じ型)。加えて、[Phase 39](../Phase-39/Phase-39-introduction.md) の効果測定で見つけた小さな不具合4つを、本番に出す前に直す。

- **直し**: 問いの二重・規模の制約の出どころ・`API_BODY_MISSING` の誤検知・実装計画書の見出しの重なり(40-1)。
- **偽 LLM の契約テスト**: 偽 LLM の判定・カード・2文書の出力が、サービスの経路(観点の取り込み・完了判定・文書の組み立てと検証・「採用にする」)を通ることを、ブラウザを使わない単体テストで固定する(40-2)。
- **E2E**: 規模のカードを選ぶ操作と「採用にする」を足し、既存を含めた全 E2E を流す(40-3)。
- **デプロイ**: 本番をステージ6の版へ更新する手順を `OPERATIONS.md` 10.3節に書き、マイグレーションの往復を確かめる(40-4)。

計画は [33-5](../Phase-33/Phase-33-5.md) の Phase 40。

## パイプライン上の位置づけ・前提

```
[40-1 直し(BE)]  _has_question / cap_source(kind=) / NO_BODY / _collapse_doubled_headings
   │
[40-2 契約テスト(BE、ブラウザ無し)]
  E2eFakeLLM ─▶ 作成 → 規模のカード → 送信3回(観点の表が十分)→ 4文書(要件定義書・外部設計書の model)→ 採用にする
[40-3 E2E(ブラウザ)]
  Playwright ─▶ devex-ui ─▶ devex-api(E2E_FAKE_LLM=true)
    helpers.completeHearing: 規模のカードを選んで送る → 観点の表の見出し
    devex-flow.spec.ts: 「採用にする」で出どころの件数が変わる / 全 E2E(3件)
[40-4 デプロイ(手順書のみ)]
  OPERATIONS.md 10.3: バックアップ → stage6→main の PR → 3本のマイグレーション → UI → 本番での確認
   │
[40-5 docs・README]
```

- **前提として読むもの**:
  - [Phase 32](../Phase-32/Phase-32-introduction.md): 偽 LLM の契約テスト・全 E2E・本番反映の手順の型。
  - [Phase 39 の introduction](../Phase-39/Phase-39-introduction.md)「未消化の申し送り」: この Phase が回収する申し送り(E2E のカード・「採用にする」・測定で見つけた不具合・画面確認)。
  - [Phase 34](../Phase-34/Phase-34-introduction.md)・[35](../Phase-35/Phase-35-introduction.md)・[36](../Phase-36/Phase-36-introduction.md): 観点の表・カード・要件定義書の出どころ。
- **この Phase を始めた時点の状態**:
  - E2E は Phase 32 から流していなかった(#36)。
  - 本番は 10.2 の版(alembic の head `c9d0e1f2a3b4`)。devex-api のステージ6のコミットは手元の `stage5` ブランチの上にあり、origin へは未 push。devex-ui の `main` は origin より6コミット進んでいる。
  - Phase 39 の変更(devex-api の6ファイル、外側の docs・q_a・samples・Phase-39)は未コミット。この Phase はその上に重ねた。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(AI が本体へ実装し、`textbook/samples/` も同じ内容で作った)。

E2E: **この Phase で既存を含めた全 E2E を流す**(#36)。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 40 開始時」を参照。

1. **自動実装モード**: on(推奨どおり)。
2. **E2E の範囲**: 既存を流して直したうえで、**カードを選んで送る操作と「採用にする」を足す**(推奨どおり)。
3. **Phase 39 の不具合**: 4つとも直す(`API_BODY_MISSING` の誤検知・手順書 index の見出しの二重・`_ensure_question` の問いの二重・規模の CON の出どころ)。
4. **本番反映**: **手順書だけ**作る(推奨どおり)。実際の反映と本番での確認(Phase 34〜39 の画面確認を含む)は、Phase の外でユーザーが行い、結果は後で記録する。

Claude の判断(計画の承認で確定、または実装中):

- 契約テストは新しいファイル `test_fake_llm_hearing_documents.py` に置く(既存の3つは、偽 LLM 単体・段階の経路のテストで、区間が違う)。
- 規模を出どころの上限に数えるのは**制約(CON)の行だけ**(「根拠が規模だけの行」にすると、Phase 36 の懸念 ── 規模はどの要件にも付けられる ── が戻る。[40-1](./Phase-40-1.md))。
- 見出しの重なりは、手順書の index でなく、自由記述の文書の生成の時点で直す(原因は実装計画書の本文。[40-1](./Phase-40-1.md))。
- 偽の外部設計書の API は増やさない(段階1の偽の機能一覧と同じ2つにそろえてあるため。[40-2](./Phase-40-2.md))。
- 規模のカードを選ぶ操作は `helpers.completeHearing` に置き、両モードの spec が通す(#17。[40-3](./Phase-40-3.md))。
- インフラの文書(`OPERATIONS.md`)は samples に写さない(#21)。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-40-1.md`](./Phase-40-1.md) | Phase 39 で見つけた不具合の直し(4つ) | あり(BE) | なし |
| [`Phase-40-2.md`](./Phase-40-2.md) | 偽 LLM の契約テスト(観点・カード・2文書の model) | あり(BE) | 40-1(規模の制約の出どころ) |
| [`Phase-40-3.md`](./Phase-40-3.md) | E2E(規模のカード・「採用にする」)と全 E2E の実行 | あり(FE の E2E) | 40-2(偽 LLM の要件定義書の件数) |
| [`Phase-40-4.md`](./Phase-40-4.md) | 本番反映の手順(`OPERATIONS.md` 10.3)とマイグレーションの往復 | `OPERATIONS.md`(インフラの文書のため #13/#15/#30 の対象外) | 40-1〜40-3(テストが通ってから出す) |
| [`Phase-40-5.md`](./Phase-40-5.md) | `docs/*.md`・README への反映 | `docs/` 配下・`README.md`(文書のため #13/#15/#30 の対象外) | 40-1〜40-4 |

## サンプルコード一覧

- `textbook/samples/backend/`:
  - 更新(40-1): `app/documents/requirements/assemble.py`、`app/documents/external_design/model.py`・`drafting.py`・`validation.py`・`__init__.py`、`app/services/chat_service.py`・`doc_generator_service.py`、テスト `tests/unit/test_requirements_doc.py`・`test_external_design_doc.py`・`test_chat_service.py`・`test_doc_generator_service.py`
  - 更新(40-2): `app/ai/llm/fake.py`
  - 新規(40-2、テスト): `tests/unit/test_fake_llm_hearing_documents.py`
- `textbook/samples/frontend/`:
  - 更新(40-3): `e2e/helpers.ts`、`e2e/devex-flow.spec.ts`

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| [40-1](./Phase-40-1.md) | `chat_service.py` | 「？」が無くても依頼・問いの言い切りなら問いとみなす(`_has_question`) | 「〜教えてください。」に問いを足さない(DB はインメモリ、LLM はスタブ) |
| | `assemble.py` | 制約の行は規模も出どころの上限に数える(`cap_source(kind=)`) | 規模が採用 → 制約は採用・非機能は推測(スタブ不要、純粋) |
| | `external_design/model.py`・`drafting.py`・`validation.py`・`__init__.py` | 本文の要らない API は「なし」(`NO_BODY`) | 「なし」は警告しない、空欄は警告する(スタブ不要、純粋) |
| | `doc_generator_service.py` | 自由記述の文書の見出しの記号の重なりを1つに(`_collapse_doubled_headings`) | 先頭の記号だけ残す、本文の `#` は変えない(スタブ不要、純粋) |
| [40-2](./Phase-40-2.md) | `fake.py`・`test_fake_llm_hearing_documents.py` | 偽 LLM の出力がヒアリングから2文書の model と「採用にする」までを通ることを固定する | 規模のカード → 採用、3回で十分、出どころの件数、外部設計書の指摘0、採用で推測0(インメモリ DB、スタブなし) |
| [40-3](./Phase-40-3.md) | `helpers.ts`・`devex-flow.spec.ts` | 画面で規模のカードを選んで送り、要件を採用にする | カードが回答済み、観点の表の見出し、件数の変化、全 E2E が通る |
| [40-4](./Phase-40-4.md) | `OPERATIONS.md` | ステージ6の版への更新・確認・ロールバックの手順 | なし(マイグレーションの往復を DB の複製で確かめる) |
| [40-5](./Phase-40-5.md) | `docs/*.md`・`README.md` | 完了と達成範囲・直しの反映 | なし(文書の目視レビュー) |

## 写経順序(#23)

章番号順。各章の「この章で作成・更新したファイル」の表の順に写す。

実 import 監査(#15):

- 40-1: `chat_service.py` が新しく使うのは標準の `re`(既存の import)だけ。`doc_generator_service.py` は `re` を足した。`assemble.py` は新しい import 無し。`drafting.py`・`validation.py`・`__init__.py` が読む `app.documents.external_design.model.NO_BODY` は、同じ章で `model.py` に足した。テストが読む `app.documents.external_design.NO_BODY`・`app.services.doc_generator_service._collapse_doubled_headings` も同じ章で足した。
- 40-2: `test_fake_llm_hearing_documents.py` が読む名前 ── `app.hearing.cards_from_json`(Phase 35)・`POINT_DEFS`(Phase 34)、`app.schemas.hearing.CardAnswer`(Phase 35)、`app.services.chat_service.ChatService`・`ReplyCards`(Phase 35)、`app.services.doc_generator_service.DocGeneratorService`・`document_read`(Phase 36)、`app.services.project.ProjectService`(既存)、`app.repositories.chat_history.ChatHistoryRepository`・`app.repositories.generated_document.GeneratedDocumentRepository`(既存)── はすべて以前の Phase にある。`fake.py` に新しい import は無い。
- 40-3: spec が読む `helpers.completeHearing` は既存。

前方 import は無い。章が作成・更新するファイルは、その章のテストが少なくとも1度 import する:

- 40-1: `assemble.py` は `test_requirements_doc.py`、`external_design` の4ファイルは `test_external_design_doc.py`(パッケージ経由)、`chat_service.py` は `test_chat_service.py`、`doc_generator_service.py` は `test_doc_generator_service.py`。
- 40-2: `fake.py` は `test_fake_llm_hearing_documents.py`(と既存の3つの契約テスト)。
- 40-3: `helpers.ts` は2つの spec。

## 検証結果

- 部分テスト: 章ごとに、変更した範囲のテスト(各章の「テスト観点」の最後のコマンド)と `ruff check`(ruff format は使わない)。
- E2E(全 spec): 1回目(直す前)は3件中1件が spec の誤り(strict mode)で落ちた。直してカード・「採用にする」を足した後、3件とも成功([40-3](./Phase-40-3.md)「全 E2E で見つかったこと」)。開発用の backend を `E2E_FAKE_LLM=true` で起動し直して流し、終わってから通常の設定に戻した。
- マイグレーションの往復: 開発環境の DB の複製で、3本の downgrade → upgrade を2往復した([40-4](./Phase-40-4.md))。
- Phase 完了時の全体テスト(#18): devex-api ユニット全体 931 件成功(Phase 39 の 927 件 + 4 件)、`ruff check`(全体)成功。`pyright`(変更したファイル): この Phase の変更による指摘は 0 件。`test_chat_service.py` に以前からある4件(`str | ReplyCards` への `in`、Phase 35 の行)が残る。devex-ui: 全体 711 件成功(`vitest run --maxWorkers=4`)、`tsc --noEmit` 成功、eslint はエラー0(以前からある警告1件だけ)。
- 統合テスト: 8 件成功(専用の DB、レート制限が切れてから1回。下の「統合テストの結果」)。
- `samples_check.py`(`--api-since HEAD --ui-since HEAD`): 不一致 0 件・作り忘れ 0 件。`link_check.py`: 切れ 0 件。

## 未消化の申し送り(#37)

Phase 39 から引き継いだもの:

- **持ち越し(Phase 22 から)**:
  - 段階6が開いていないときの、05 の詳細バッジ
  - ER の主キーの NULL の表示
- **E2E を CI で流すか**: 未定([`retrospective-memo.md`](../retrospective-memo.md) に候補として記録済み)。#36 のまま続ける。この Phase でも、流さない期間(Phase 36〜39)に壊れた期待が1つあった([40-3](./Phase-40-3.md))。
- **コミュニケーション図**: 後回し([25-5](../Phase-25/Phase-25-5.md))。
- **「段階Nで直す」の移動先での強調**: 段階5は手順・処理を開くが、段階3・4・7は段階を開くだけ。必要なら各パネルに `focus` を読ませる。
- **「AI に提案を求める」**: ステージ8(AI 設計レビュー・再ヒアリング)との境界として申し送る。
- **段階8の生成の入力の大きさ**(Phase 29 から): 問題になれば測る。
- **生成済みの簡易モードのプロジェクト**: Phase 31 より前に生成した文書では、段階8の単位が空になる。文書を再生成すると使える。
- **ベースラインで見つけた、ステージ6の範囲の外の課題**([Phase 33](../Phase-33/Phase-33-introduction.md)): 段階3の CRUD 図の下書きと DFD の書き込みの線の食い違い、段階5の分岐の行の書き落とし、簡易モードの内部設計書の書き落とし。
- **判定の LLM の入力の大きさ**: 会話が長くなると入力が増えるので、問題になれば測る。
- **既存のプロジェクトの会話の順**(Phase 35 から): 調整より前に作ったプロジェクトは、同じ送信の発言と返信が同じ時刻のまま残る。直さない(10.3節に記載)。
- **聞かれない潜在の事実**(Phase 39 から): L2(バックアップ)・L5(ログに本文を残さない)・L6(不正利用)・L14(削除)は、どの回も聞かれなかった。観点1つに問いが1つで、可用性・セキュリティの2つ目の側面に届かない。観点の条件に足すか、追いの問いを足すかは、**次のステージの入力**として申し送る(ステージ6の振り返りで決定。[`overall-retrospective.md`](../appendix/overall-retrospective.md) 10節)。
- **判定のゆらぎ**(Phase 39 から): 直前の問いを添えても、自由回答を「採用」にすることが残る。LLM の一時的な出力の乱れも1回あった。
- **セッションの区切りの記録**: Phase 40 は1セッションで行った(計画モードで質問4問 → 40-1 の直し → 40-2 の契約テスト → 40-3 の全 E2E(直す前に1回、直した後に簡易だけ1回、全部を1回)→ 40-4 のマイグレーションの往復 → docs → 教材 → 全体テスト)。

この Phase で解決したもの:

- **E2E の文言**(Phase 34 から): 既存の spec はまとめの文言を見ていないので影響なし。全 E2E で確かめた([40-3](./Phase-40-3.md))。
- **偽 LLM のカードと E2E**(Phase 35 から): `helpers.completeHearing` が規模のカードを選んで送る([40-3](./Phase-40-3.md))。サービスの経路は契約テストで固定([40-2](./Phase-40-2.md))。
- **偽 LLM の要件定義書と E2E**(Phase 36 から): E2E で「採用にする」を押し、件数の変化を確かめる([40-3](./Phase-40-3.md))。
- **規模の CON の出どころ**・**`API_BODY_MISSING` の誤検知**・**手順書の index の見出しの二重**・**`_ensure_question` の問いの二重**(Phase 39 から): 直した([40-1](./Phase-40-1.md))。
- **技術スタックのフォームの値とカードのおすすめ**・**任意の観点のヒアリングの質**(Phase 39 から): 画面確認として 10.3節の確認の表に移した(上の「画面確認」)。
- **画面確認**(Phase 34〜39 の分)・**「採用にする」の取り消し**(Phase 36 から)・**段階1の再生成と人の直した要件**(Phase 38 から): 本番での確認で、すべて問題なし。取り消しと引き継ぎは今は作らない([40-4「本番での確認の記録」](./Phase-40-4.md#本番での確認の記録))。
- **Phase 40 の未確定事項**([33-5](../Phase-33/Phase-33-5.md)): 本番のマイグレーションと既存データ(移さない。10.3節)、本番での確認の範囲(Phase 34〜39 の画面確認を含める。着手時の決定4)。

この Phase で生まれたもの:

- **`test_chat_service.py` の pyright の指摘4件**: 返信の塊(`str | ReplyCards`)に `in` を使う行(Phase 35 から)。テストは通る。触るときに `isinstance` で絞る。

## 統合テストの結果

1回目は、E2E の直後に流したため、ログイン・登録のレート制限(同じ IP 127.0.0.1 で 10回/時。開発用の Redis を共有する)に当たり、8件中2件がログインできずに落ちた(`KeyError: 'access_token'`)。コードの問題ではない。カウンタが切れてから流し直し、8件とも成功した。統合テストは E2E や前の実行の直後に続けて流さない(Phase 38 の注記と同じ)。

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

1. 規模を出どころの上限に数えるのを「根拠の観点が規模だけの行」でなく「制約(CON)の行」にしたのはなぜか。Phase 36 で規模を数えなかった理由と、Phase 39 で規模の決まり方が変わったことから説明できるか。
2. `API_BODY_MISSING` の誤検知を、検証を緩めるのでなく AI に「なし」と書かせて直したのはなぜか。空欄と「なし」が別の意味を持つことから説明できるか。
3. 契約テスト([40-2](./Phase-40-2.md))で、偽の判定が Phase 39 の取り込みの規則(規模と採用は利用者の発言からだけ)を通るのはなぜか。偽物の根拠の選び方から説明できるか。
4. 「採用にする」を E2E で確かめるのに、件数(ユーザー4・採用1・推測1)を直接書いた。偽物を変えたらどこが壊れ、件数の意味はどのテストが守っているか。
5. 10.3節のロールバックで downgrade すると何が消え、何が残るか。カードへの回答が発言の本文に残るのはなぜか。

## 次のフェーズ

ステージ6はこの Phase で終わる。次は、ステージ6の完了として、振り返り(#10、`textbook/appendix/*-retrospective.md`。#25 の「→ Devex 仕様への示唆」を含む)と decision digest(#24)をまとめる。#18 により、別のセッションで行う。本番への反映と確認は、ユーザーが [`OPERATIONS.md`](../../devex-api/OPERATIONS.md) 10.3節の手順で行う。

→ 本番への反映と確認(すべて問題なし)、振り返り([`overall-retrospective.md`](../appendix/overall-retrospective.md) 10節)と decision digest([「Phase 33完了」〜「ステージ6完了後」](../decision-digest.md))は、2026-10-11 に済んだ。
