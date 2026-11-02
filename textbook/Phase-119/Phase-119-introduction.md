# Phase 119 導入: ステージ11〜14 と Phase 118 の本番への反映と本番での確認

## 目的

ステージ11〜14(合意と変更。Phase 80〜117)と Phase 118(TOP・使い方ガイド)を、1回で本番へ出して確かめる。CLAUDE.md #37 の運用注記(ステージ11完了後)のとおり、反映はまとめて行うことにしていた。ステージ15 をスコープから外したので(2026-10-29)、ステージ14 の後のこの Phase で出す。新しい機能は作らない。

- 手順は [`OPERATIONS.md`](../../devex-api/OPERATIONS.md) 10.8節(2026-10-31 に書き上げた)。
- 本番: https://devex.uandi-tech.com/

## パイプライン上の位置づけ・前提

```
ステージ11〜14(Phase 80〜117)→ 振り返り → Phase 118(TOP・GUIDE)→ 画面確認・調整
  119 ── 反映の前の確かめ(全テスト・lint・全 E2E ×2・コミットの並び・head)   ──[119-1](AI)
         本番への反映(10.8 手順1〜6。API を先に、UI を後に)                 ──[119-2](ユーザー、AI は確かめと記録)
         本番での確認(手順7・8)・本番確認後の調整・記録の更新              ──[119-3](ユーザー + AI)
  └→ 振り返り(#39 の本番の指摘をステージ11〜14 の分埋める。別セッション #18)
```

- **この Phase を始めた時点の状態**: 外側は `966bb7f`、devex-api は `stage11-15` の `6f1a339`(origin/main `cd5b1a9` から30件先)、devex-ui は `main` の `b9fb09c`(origin/main から14件先)。どれもコミット済み。
- **前提として読むもの**: 10.8節(増えるもの・手順・確認の表・ロールバック)、[Phase 79](../Phase-79/Phase-79-introduction.md) の「本番での確認の記録」「本番確認後の調整」(前回のまとめた反映の前例)。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**。本体の変更は、反映の前の確かめと本番確認後の調整で出たものだけ。

E2E: **この Phase で既存を含めて全部流す**(Phase 118 の申し送り)。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 119 開始時」を参照。計画モードで1回(3問)聞いた。

| # | 問い | 決定 |
|---|---|---|
| 1 | 自動実装モード | on(推奨どおり) |
| 2 | 反映の前の全 E2E | 3100番で2回(推奨どおり) |
| 3 | Phase 118 の公開ページの本番での確認 | AI がヘッドレスで確かめる(GET だけ。推奨どおり)。ログインが要る行はユーザー |

推奨と違った選択は 0件 / 3問。#39 の材料。

## 章一覧

| 章 | トピック | 依存 | 実装ファイル |
|---|---|---|---|
| [119-1](./Phase-119-1.md) | 反映の前の確かめ | 無し | `tests/unit/test_material_change_requests.py`(docstring の折り返し) |
| [119-2](./Phase-119-2.md) | 本番への反映 | 119-1 | 無し(#13/#15 の対象外) |
| [119-3](./Phase-119-3.md) | 本番での確認と記録 | 119-2 | 本番確認後の調整があれば |

## サンプルコード一覧

- 119-1: [`backend/tests/unit/test_material_change_requests.py`](../samples/backend/tests/unit/test_material_change_requests.py)(整形だけ。タグなし)
- 119-3(本番確認後の調整): [`frontend/src/components/layout/Header.tsx`](../samples/frontend/src/components/layout/Header.tsx)(ユーザーが本体を直した分。`Phase-119(本番確認後の調整)` のタグ)

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 作るもの | 責務 | テスト観点 |
|---|---|---|---|
| 119-1 | 確かめの記録 | 出す版が CI と同じ検査・全 E2E を通る | SUT = 両リポジトリ全体、ドライバ = pytest / Vitest / Playwright、スタブ = 偽の LLM・Google |
| 119-2 | 反映の記録 | 10.8 手順1〜6 を順に、止める条件を確かめながら | ── |
| 119-3 | 確認の記録 | 10.8 手順7・8、指摘の調整 | SUT = 本番、ドライバ = Playwright(AI)・手(ユーザー)、スタブ不要 |

## 写経順序(#23)

章番号順。実 import 監査(#15): 119-1 の変更は docstring だけで、import は変わらない。

## 検証結果

[119-1](./Phase-119-1.md) のとおり。devex-api のユニット 1978件・ruff 0件、devex-ui のユニット 1482件・tsc 0件・eslint エラー0・build 成功、全 E2E 16件を2回、`samples_check` 不一致 0・本体のみ 0、`link_check` 切れ 0。

## 未消化の申し送り(#37)

[Phase 118](../Phase-118/Phase-118-introduction.md#未消化の申し送り37) から引き継いだもの。

**この Phase で解決したもの**:
- **本番への反映と本番での確認**(ステージ11〜14 と Phase 118)→ **済み**(2026-11-02。指摘 0。[119-2](./Phase-119-2.md)・[119-3](./Phase-119-3.md))。

**ユーザーが決めるもの(タグ)**:
- **タグ**(ユーザー): どちらのリポジトリにも `phase-100` 以降が無い(最後は `phase-99`)。10.8 手順6 は `phase-118` を確かめる。最低限の案(コミットはメッセージから対応を取った):

  ```bash
  # devex-api
  git tag phase-112 7239a17; git tag phase-113 cab23e4; git tag phase-114 5170e7e
  git tag phase-115 5574538; git tag phase-117 bb08388; git tag phase-119 de1a5c8
  # devex-ui
  git tag phase-112 1cac005; git tag phase-116 3e820ae; git tag phase-117 b142507; git tag phase-118 b9fb09c
  ```

  `phase-100`〜`phase-111` も付けるかはユーザーが決める。

**Phase 119 の範囲の外**:
- **本番の暗号の鍵**: 開発環境は `ENCRYPTION_KEY` が無く、マイページで API キーを登録できない(本番は鍵がある前提)。
- **違いの種類の揺れ**・**題材の段階2〜8 が古い**・**使われ方を見て決める**もの・**LLM の案の下書きは両端に寄る**・振り返り 6節の残り5件・生成の質の候補4件(Phase 117 のまま)。

**持ち越し**(触るときに直す。中身は [振り返り](../retrospectives/project-retrospective.md) 8節):
- Phase 118 の一覧のまま(pyright の指摘・並列のテストのタイムアウト ── **(この Phase)** pytest と並べて流した Vitest で13件が時間切れ、単独の `--maxWorkers=4` では全部成功・`DfdEditorTabs` のまれな失敗・Google の公開鍵・`ListCard`・英語の refresh の文・`streamChat.test.ts` の警告・stage11 の `measure.py`・CR の流れの部品の寄せ・`StrayProcedureTable` の重なり・共有リンクの画面の `POST /auth/refresh` の 401)。
- **`tagmerge.py` の手直し**(P104・P109・P113・P115・P116・P118 の CSS の2件)。

**ユーザーが決めるもの**:
- **開発環境の後始末**: Phase 117・118 の分(題材の B-5〜B-7 など、撮影用の利用者とその2つのプロジェクト、E2E の利用者)。この Phase の全 E2E 2回で、E2E の利用者とプロジェクトがさらに増えた。
- **未コミット**: この Phase の分(外側だけ。devex-api の直しは `de1a5c8` でコミット済み)。devex-api の手元は `stage11-15` のまま(`git switch main && git pull` で戻す)。コミットはユーザーが行う(#35)。

**この Phase で生まれたもの**:
- **lint の1件**(Phase 115 のテストの docstring)→ **済み**([119-1](./Phase-119-1.md))。CI の `ruff check` を手元で流していなかったので、Phase 115 から見逃していた。
- **3100番の古いサーバー**: 前の作業の `next start -p 3100` が残っていた → 止めた。
- **セッションの区切りの記録**: Phase 119 は1セッションで行った(ユーザーの反映の間、2026-10-31〜11-02 で止めた)。
  1. 計画モードで調査(調べるエージェントは使わず、直接読んだ)・質問1回(3問)・計画の承認
  2. 119-1(全テスト・lint の直し・全 E2E 2回・確かめ)・教材
  3. (ユーザーの反映)
  4. 計画モードで振り返りの進め方を質問1回(4問)。#18 により、振り返りは別のセッションにした
  5. 公開ページの本番での確認・記録・docs の「反映済み」

## 本番での確認の記録

2026-11-02、[`OPERATIONS.md`](../../devex-api/OPERATIONS.md) 10.8節の手順で、ステージ11〜14 と Phase 118 をまとめて本番へ反映した(ユーザー)。

- **反映**: devex-api は PR #10(`stage11-15` → `main`、`a045944`)。devex-ui は `main` を push(Vercel)。詳細は [119-2](./Phase-119-2.md)。
- **本番での確認**: ユーザーの分(ステージ11〜14 の4つの表・Phase 118 の入口・手順8・費用)は**問題なし**。AI の分(Phase 118 の公開ページ。ヘッドレス・GET だけ)も問題なし(14ページ × 2つの幅で 200・壊れた画像 0・はみ出し 0)。詳細は [119-3](./Phase-119-3.md)。
- **指摘**: 0。

## 本番確認後の調整

- **Header と Footer の調整**(ユーザーが本体を直した。devex-ui `0a2d805`「HeaderとFooterの調整(リンク・文字色)」、2026-11-02): `Header.tsx` 1行・`Footer.tsx` 2行。ユーザーの判断で、好みの調整として扱い、本番での確認の指摘には数えない([q_a](../q_a.md)「Phase 119 完了後」)。samples は、[`Header.tsx`](../samples/frontend/src/components/layout/Header.tsx) に tagmerge で `Phase-119(本番確認後の調整)` のタグを付けて当てた。`Footer.tsx` は samples に無い(テンプレート由来で、これまでの Phase が触っていない)ので写さない。`samples_check`: 不一致 0。

## Phase 完了チェック(#22)

設問は Phase の要点の要約である(回答は求めない)。

1. 4つのステージと Phase 118 を1回で出すとき、API を先に、UI を後に出すのはなぜか。逆にすると何が起きるか。
2. 反映の前に、CI と同じ `ruff check` を手元で流したのはなぜか。手順のどこで止まるのを防いだか。
3. マイグレーション24本のうち、データを書き換えるもの(`be106e6426be`・`75d414ded7cb`)は本番で何をするか。本番に CR・束が無いとき、影響はどうなるか。
4. ロールバックの第一の手を「マイグレーションを戻さずコードだけを戻す」にしているのはなぜか。
5. 本番での確認を AI とユーザーで分けた境目は何か(ログイン・データの書き込み・費用)。

## 後続 Phase での改訂

(まだ無い)

## 次のフェーズ

**プロジェクト完了の振り返り**(別セッション。#18)。2026-11-02 に、進め方を次のように決めた([q_a](../q_a.md)「Phase 119 完了後」)。
- 対象は Phase 80〜119(ステージ11〜14・Phase 118・119)。ゴール4 を判定する。
- 置き場は [`project-retrospective.md`](../retrospectives/project-retrospective.md) に足す(表題を「Phase 0〜119」に)。
- handoff は v3 を新しく作る(`appendix/cl-development-handoff-v3.md`。v2 は残す)。
- この Phase の申し送りを、前回の 8節の形で閉じる。
- #39 の本番の指摘(ステージ11〜14 は 0)は、この Phase で 11.1 の表に埋めた。

**済み**(2026-11-02): [`project-retrospective.md`](../retrospectives/project-retrospective.md) 11〜19節(ゴール4 は達成。この Phase の申し送りは17節で閉じた)と [handoff v3](../../appendix/cl-development-handoff-v3.md)。プロジェクトは完了として閉じた。
