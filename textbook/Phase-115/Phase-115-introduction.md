# Phase 115 導入: 違いから CR の下書き・古い束の知らせ

## 目的

ステージ14(変更の取り込み)で、資料から取り出した違い(Phase 114)を CR につなぐ。開発者が1つの資料の違いを選ぶと、システムが**決定的に組み立てた CR の下書き**ができ、違いは「CR にした」と CR の番号を持つ。あわせて、ステージ13 の振り返り(18.3・18.4)の入力「古い束を基準にした説明」に答える ── CR の詳細・説明書・共有リンクの作成で**基準の束の鮮度を知らせ**(止めない)、規模の数を「数えた」「古い版から数えた」「数えられない」に分け、説明書の規模の節に「どの束の設計から数えたか」を書く。画面は Phase 116、効果測定・E2E は Phase 117。

## パイプライン上の位置づけ・前提

```
[Phase 82〜]  CR(対象 = 束の要件の行・新しい要件の起点・背景)・説明書・規模(Phase 101)
[Phase 113]  束の鮮度(freshness)
[Phase 114]  資料の違い(合意の要素のキー・引用の検査・未確認 / CR にした / 捨てた)
        ▼
[115-1 純粋関数]  違い → CR の下書き(つながる要件・対象の候補・起点の写し・題と内容と背景)
[115-2 API]      違いと CR の結び(列・マイグレーション)・サービス・POST .../materials/{mid}/change-requests
[115-3 知らせ]    CR の詳細・説明書・共有リンクの作成の基準の束の鮮度、規模の state、説明書の行と注記
[115-4 docs]     外部設計 2.17・内部設計 3.2 / 3.3・実装計画 4.1
        ▼
[Phase 116]  取り込みの画面(資料・違いの一覧・選んで CR へ・知らせ・規模の表の鮮度)
```

- **前提として読むもの**: [111-1](../Phase-111/Phase-111-1.md)(決定3・5)、[111-4](../Phase-111/Phase-111-4.md) の Phase 115 の未確定事項、[114-3](../Phase-114/Phase-114-3.md) の前提、[外部設計書](../../docs/external_design.md) 2.17節。
- **この Phase を始めた時点の状態**: 外側のリポジトリは `b20c141`(Phase 114)、devex-api は `5170e7e`、devex-ui は `1cac005`。どれも未コミットの変更なし。開発 DB は `b8f3d6a2e915`。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(着手時の決定8)。本体(`devex-api`)と samples に同じ内容を書いた。devex-ui は変えていない(画面は Phase 116)。

E2E: この Phase では流さない。ステージ14 の E2E は Phase 117 で既存を含めて全部流す。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 115 開始時」。質問は計画モードで2回(4問 + 4問)。すべて推奨どおり。

1. **API の形**: 1回で下書きを作る(`POST .../materials/{mid}/change-requests`)。直すのは今の CR の編集。
2. **対象の行**: 画面・API・外部連携の違いは、つながる要件を候補として違いの一覧に出し、選んだもの(省けば候補すべて)を対象にする。
3. **起点**: 外部連携の起点はつながる要件へ、利用者と使う場面は起点なし(編集で足す)。
4. **題と内容**: 決定的に組み立てる(題・違いごとの箇条書き・資料からの背景)。
5. **知らせ**: CR の詳細(作成の応答も)と共有リンクの作成の応答に `baseline_freshness`。別の API は作らない。
6. **説明書の md**: 規模の節に基準の束の行を常に、束の後の CR があれば注記。
7. **規模の形**: 種類ごとの数に `state`(counted / stale / uncountable)。
8. **モードと章**: on・4章。

実 LLM は使わない(組み立ては決定的)。開発 DB の題材に CR は作らない(Phase 117 の B-7 と CR の番号を乱さないため。流れは統合テストで確かめた)。

**推奨と違った選択は0件**。計画の承認の後の CR(#40)も0件。#39 の材料。

Claude の判断:
- 1つの CR は1つの資料の未確認の追加・変更・削除から(背景が1つに決まるため)。
- 基準の束は最新の束。違いを取り出した後に束を作り直していたら 409 `MATERIAL_DIFFERENCE_OUTDATED`(取り出し直す)。
- 画面・API・外部連携を消す違いは、要件の削除でなく内容の変更。候補の無い要素の変更は、その要素を起点にした新しい要件。変更後の案は空。
- 違いを CR に結ぶのと CR の作成を1つのトランザクションにするため、`ChangeRequestService.create` から `add_draft`(commit しない)を分けた。
- CR 自身の反映は、その CR の基準の束を古くしたとは言わない(`Freshness.excluding`)。
- 束の後の CR の注記は、合意の前(下書き・説明済み)の説明書だけに出す。
- 内容が CR の上限(20,000字)を超えたら、引用を200字に切り詰める。
- CR から元の資料・違いを引く API は足さない(駆動する消費者が無い。#17)。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-115-1.md`](./Phase-115-1.md) | 違いから CR の下書きを組み立てる純粋関数 | `app/materials/drafting.py`・テスト | なし |
| [`Phase-115-2.md`](./Phase-115-2.md) | 違いと CR の結び・サービス・API | マイグレーション `d5a1c7e3f926`・テスト2本(ほかは更新) | 115-1 |
| [`Phase-115-3.md`](./Phase-115-3.md) | 古い束の知らせと、規模の「古い」の状態 | テスト1本(ほかは更新) | 115-2 |
| [`Phase-115-4.md`](./Phase-115-4.md) | docs への反映と後の Phase への前提 | なし(実装のファイルを作らない章。#13・#15・#12 の対象外) | 115-1〜115-3 |

## サンプルコード一覧

新規(6):
- 115-1: [`drafting.py`](../samples/backend/app/materials/drafting.py)・[`test_material_drafting.py`](../samples/backend/tests/unit/test_material_drafting.py)
- 115-2: [マイグレーション `d5a1c7e3f926`](../samples/backend/alembic/versions/d5a1c7e3f926_add_material_difference_change_request.py)・[`test_material_change_requests.py`](../samples/backend/tests/unit/test_material_change_requests.py)・[`test_material_change_requests_flow.py`](../samples/backend/tests/integration/test_material_change_requests_flow.py)
- 115-3: [`test_change_request_staleness.py`](../samples/backend/tests/unit/test_change_request_staleness.py)

更新: backend 19(各章の表)。#29 のタグは `Phase-115-1`〜`115-3`。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 作成・更新するファイル | 責務(1行) | テスト観点 |
|---|---|---|---|
| 115-1 | `materials/drafting.py`・`__init__.py` | 違いの対象からつながる要件・起点を求め、選んだ違いから CR の下書きを決定的に組み立てる | 候補の求め方・起点の写し・要素の削除は内容の変更・候補の無い要素は新しい要件・題と内容と背景・上限 |
| 115-2 | `models/material_difference.py`・マイグレーション | 違いが CR にしたときの CR を持つ(SET NULL) | 資料を消しても CR が残る |
| 115-2 | `repositories/material_difference.py` | 選んだ違いの読み出し・CR の番号 | ほかの資料の違いは入らない |
| 115-2 | `change_request_service.py`・`schemas/change_request.py`・`routes/change_requests.py` | CR の作成を commit しない `add_draft` に分け、詳細の応答を `from_view` で組む | 今の CR の作成が変わらない |
| 115-2 | `material_difference_service.py`・`schemas/material_difference.py`・`errors.py`・`routes/materials.py` | 状態・束を確かめ、下書きを CR にし、違いを結ぶ。一覧に候補と番号 | 409(状態・束の作り直し)・422・404・やり直しで残る |
| 115-3 | `change_requests/freshness.py`・`scale.py`・`states.py`・`explanation.py`・`__init__.py` | CR 自身を除いた鮮度、規模の state と束の後の CR の注記、説明書の基準の束の行 | 「古い」と「数えられない」の区別・注記は合意の前だけ |
| 115-3 | `baseline_service.py`・`change_request_service.py`・`share_link_service.py`・schemas・routes | CR の詳細・説明書・共有リンクの作成に基準の束の鮮度を返す | 古い束の CR だけが古い、CR 自身は新しい |

## 写経順序(#23)

章番号順(115-1 → 115-2 → 115-3 → 115-4)。各章の表は依存順(#30)。

実 import 監査(#15): 各章の終わりの本体の写し(章ごとの写しの手順)で、各ファイルの import を読んだ。115-1 の `drafting.py` は既存のモジュール(`app.agreements.items`・`app.change_requests.states` / `targets`・`app.detailed_design.impact.elements`・文書の model)と Phase 114 の `app.materials.differences` だけを使う。115-2 のサービスは 115-1 の `app.materials` と、同じ章で足した `ChangeRequestService.add_draft`・`ChangeRequestRead.from_view`・誤りを使う(`schemas/change_request.py` の `ChangeRequestView` は `TYPE_CHECKING` の中)。115-3 のファイルは同じ章の `UNDECIDED_STATUSES`・`ScaleState`・`with_baseline_changes` と、Phase 113 の `Freshness`・`BaselineFreshnessRead` を使う。前方 import は無い。各章のテストが、その章の全ファイルを import する(マイグレーションは `alembic check`。`routes/change_requests.py` の 115-2 の変更は統合テストの CR の取得と 115-3 のテストが通る)。

## 検証結果

- devex-api:
  - ユニット全体 `uv run pytest`: 1978 件が通った。
  - 統合テスト(専用の DB)全体: 48 件が通った(新しい `test_material_change_requests_flow.py` を含む)。
  - `ruff check`: 0 件。`uvx pyright`(触ったファイルと新しいテスト): 0 件。
  - マイグレーション: 単一の head・ID の衝突なしを確かめ、開発 DB を `d5a1c7e3f926` に上げた。`alembic check` で、モデルとの差分なし(往復は Phase 117)。
- 実 LLM: 使っていない(費用 0)。
- devex-ui: 変更なし。
- `textbook/tools/samples_check.py --api-since HEAD --ui-since HEAD`: 不一致 0・本体のみ 0(一致 1104 / 並び順のみ差 8 / 例外 5)。
- `textbook/tools/link_check.py`: リンク切れ 0 件。
- E2E: 流していない(Phase 117)。

## 未消化の申し送り(#37)

[Phase 114](../Phase-114/Phase-114-introduction.md#未消化の申し送り37) から引き継いだもの。

**ステージ14 の中で扱うもの**(行き先は [111-4](../Phase-111/Phase-111-4.md)):
- **古い束を基準にした説明**(P110・18.3)→ 判定は Phase 113、取り込みの回の記録は 114、CR の作成・共有リンクの作成の知らせと規模の表の鮮度はこの Phase。**画面は Phase 116**。
- **開発環境での画面確認**: Phase 112 の画面(影響のタブの「反映で変わった所」・確認事項からのリンク・競合の知らせ)。ユーザーの確認は Phase 117 の開発環境での画面確認でまとめて行う(#37 の運用注記)。この Phase は画面を足していない。
- **合意済みの内容の中の食い違い**: 題材の外部設計書 2.4・2.6 に CR-6 の後も「TOP10」が残る。Phase 117 で B-7 を作る前に決める。
- **前 → 後を残す前の反映**(P112): 題材の CR-6 など。Phase 117 で題材を使うときに気にする。
- **撤回を変更として挙げる揺れ**(P114): 検査では弾けない → Phase 117 の効果測定の (4) で数え、プロンプトを直すかを決める。
- **(この Phase で生まれた)説明書の md の1行の追加**: 規模の節に「B-n の設計から数えました」を足したので、既存の CR の説明書も変わる。確認済みの要約は「確かめ直す」になり、共有リンクでは変わった節として出る。開発環境の題材の CR も同じ。Phase 117 で `OPERATIONS.md` 10.8節に、反映の後に本番の説明済みの CR の要約を確かめ直す手順を足す。

**ステージ14 の範囲の外**:
- **本番への反映と本番での確認**: ステージ15 の完了時に、[`OPERATIONS.md`](../../devex-api/OPERATIONS.md) 10.8節で行う。マイグレーション `c4e8a1f7b2d6`(P112)・`e7d2b9a4c103`(P113)・`b8f3d6a2e915`(P114)・`d5a1c7e3f926`(この Phase)は、Phase 117 で 10.8節のステージ14 の分に足す。
- **使われ方を見て決める**: 要約・案の下書きの回数の上限、実 LLM が利用者の `prev_id` を書くか(P105)、実 LLM の段階1 の処理のまとめ(P110)、取り込みの LLM の回数の上限。
- **LLM の案の下書きは両端に寄る**(18.4): 生成の質の候補として持ち越す。
- 振り返り 6節の残り5件・生成の質の候補4件(Phase 100 と同じ)。

**持ち越し**(触るときに直す。中身は [振り返り](../retrospectives/project-retrospective.md) 8節):
- `test_chat_service.py` などの pyright の指摘(Phase 40)
- devex-ui の並列のテストのタイムアウト(Phase 44)
- 偽 LLM の外部設計書の GET に DF が無い(Phase 45)
- `DfdEditorTabs` のテストのまれな失敗(Phase 77)
- Google の公開鍵を毎回取りに行く(Phase 74)
- `ListCard` の入れ物(Phase 79。テンプレートでは直した)
- 英語のままの refresh の失敗の文(Phase 79)
- `streamChat.test.ts` の lint の警告(既存)
- `appendix/measurements/stage11/measure.py` の `ruff check` の指摘(Phase 80 から)
- 反映の後の CR の流れの部品・束の写しの取り出し(#17。触るときに寄せる)
- `tagmerge.py` のメソッドの中身を移す変更の扱い(P104)と、import 区間の中の名前の無い追記のタグ(P109)。README の「要手当て」に書いた
- 段階5 の `StrayProcedureTable` と `StrayFunctionTable` の重なり(#17)
- ログインの無い共有リンクの画面でも `POST /auth/refresh` が呼ばれて 401 になる(P108・110)
- `tagmerge.py` が、クラスの docstring の1行の変更を別の位置にも当てた(P113)。**(この Phase)** メソッドを2つに分ける変更(`create` → `add_draft`)は、新しいメソッドの頭にタグが付かず、手で `Phase-115-2:追記` の行を足した。関数の呼び出しの引数の末尾への追記(`changed_after,`)も、手でタグを足した(「要手当て」に出た)。

**ユーザーが決めるもの**:
- **開発環境の後始末**: 題材「トレンド追跡アプリ」の B-5・B-6・CR-5・CR-6 と CR-6 の共有リンク(期限 2026-11-08)、E2E の捨てのプロジェクト(Phase 112 で「予約の CR」に CR-2・CR-3 を足した)、題材の資料2件(セット B)とその違い(B-6 と比べたもの。Phase 116 の画面の確かめに使える。Phase 117 の効果測定は B-7 で取り出し直す)。この Phase は開発 DB にデータを足していない(マイグレーションだけ)。
- **タグ**: devex-api `phase-101`〜`phase-106`・`phase-110`、devex-ui `phase-107`〜`phase-110`(振り返り 18.1 の Q8)。`phase-112`(両方)・`phase-113`・`phase-114`(devex-api)は、コミットは済んでいるがタグはまだ無い。この Phase は devex-api に `phase-115`(devex-ui は変更なし)。
- **未コミット**: この Phase の分(外側・devex-api)。コミットはユーザーが行う(#35)。

**この Phase で生まれたもの**(上の各節に入れたもの以外):
- **セッションの区切りの記録**: Phase 115 は1セッションで行った。
  1. 計画モードで、111-4 の未確定事項と既存の型(CR の作成・起点・共有リンク・規模・説明書・鮮度)を読み、8問(4問 + 4問)。計画の承認(エージェントは使わず直接調べた)。
  2. 115-1(純粋関数)→ 115-2(列・サービス・API)→ 115-3(知らせ・規模・説明書)。章ごとに本体の写しを取った。開発 DB を上げた。
  3. samples(`tagmerge.py`。手での直し: docstring の記録の行 12、タグの行 2)→ docs → 教材・q_a。

**この Phase で解決したもの**:
- **追加の起点と CR の起点**(P114)→ [115-1](./Phase-115-1.md) の2(外部連携は要件へ、利用者は起点なし)。
- **違いから CR の下書きが作れない**(111-1 の決定3)→ [115-1](./Phase-115-1.md)・[115-2](./Phase-115-2.md)。
- **CR の作成・共有リンクの作成で古い束を知らせない・「数えられない」と「古くて少ない」が分からない**(18.3・18.4)→ [115-3](./Phase-115-3.md)。画面は Phase 116。

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

設問は Phase の要点の要約である(回答は求めない)。

1. 違いから CR の下書きを LLM でなく決定的に組み立て、作った後は今の CR の編集で直すのはなぜか。
2. 画面・API・外部連携の違いで、つながる要件を候補に出して既定を全部にするのはなぜか。画面を消す違いを要件の削除にしないのはなぜか。
3. 違いを取り出した後に束を作り直していたら CR を作らせないのに、最新の束が古いだけなら止めないのはなぜか。
4. 規模の数に「古い」の状態を足し、「数えられない」と分けるのはなぜか。クライアントの説明書には、それをどう伝えるか。
5. 束の後の CR の注記を、合意の前の説明書だけに出すのはなぜか。CR 自身の反映を除くのはなぜか。

## 次のフェーズ

**Phase 116**: 取り込みの画面。着手時に、[111-4](../Phase-111/Phase-111-4.md) の Phase 116 の未確定事項(資料の画面の置き場・違いの一覧の並びと選び方・束を作り直す画面への案内の文)を決める。API の前提は [115-4](./Phase-115-4.md) の「後の Phase への前提」。
