# Phase 114 導入: 違いの取り出し API

## 目的

ステージ14(変更の取り込み)の中心の処理を作る。資料1件(Phase 113 の `materials`)と最新の束の合意済みの内容を比べ、違い(追加・変更・削除・確かめる点)を LLM で取り出し、**決定的な検査**(根拠の引用が資料に文字どおりあるか・対象が束の合意の要素のキーか・種類と対象の組み合わせ)で確かめて、違いの表に残す。ベースライン([111-2](../Phase-111/Phase-111-2.md))で分かった足りないもの ── 対象が自由文で CR に結べない・根拠を確かめられない ── をこの Phase で埋める。CR の下書きへのつなぎは Phase 115、画面は 116、効果測定は 117。

## パイプライン上の位置づけ・前提

```
[Phase 91]   合意の要素(agreement_items。req: / users / screen: / api: / integration: のキー)
[Phase 105]  LLM の下書き → 人が確かめる型(案の下書き)
[Phase 113]  資料(materials)・束の鮮度(freshness)
        ▼
[114-1 純粋関数]   合意の要素の一覧・入力・構造化出力・検査・やり直しの重なり(app/materials/)
[114-2 API]        表 ㉗㉘・サービス・取り出し / 一覧 / 捨てる・戻す・偽の LLM の印
[114-3 docs]       外部設計 2.17・内部設計 3.2 / 3.3・実装計画 4.1
        ▼
[Phase 115]  選んだ違いから CR の下書き・古い束の知らせ・規模の表の鮮度
```

- **前提として読むもの**: [111-1](../Phase-111/Phase-111-1.md)(決定1・3・8・10)、[111-4](../Phase-111/Phase-111-4.md) の Phase 114 の未確定事項、[113-3](../Phase-113/Phase-113-3.md) の前提、[外部設計書](../../docs/external_design.md) 2.17節、[測定の正解表](../../appendix/measurements/stage14/answer.md)。
- **この Phase を始めた時点の状態**: 外側のリポジトリは `7f30f35`(Phase 113)、devex-api は `cab23e4`、devex-ui は `1cac005`。どれも未コミットの変更なし。開発 DB は `e7d2b9a4c103`。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(着手時の決定5)。本体(`devex-api`)と samples に同じ内容を書いた。devex-ui は変えていない(画面は Phase 116)。

E2E: この Phase では流さない。偽の LLM の印(114-2)は Phase 117 の E2E のために足した。ステージ14 の E2E は Phase 117 で既存を含めて全部流す。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 114 開始時」。質問は計画モードで2回(4問 + 2問)。すべて推奨どおり。

1. **比べる範囲と形**: 束の合意の要素(要件・利用者と使う場面・画面・API・外部連携)を「キー | 名前 | 中身」の一覧で渡し、対象はこのキーだけ。目的と範囲(1.3)は、キーの無い参考として添える。段階は渡さない。
2. **引用の検査**: NFKC・空白と改行・md の記号を除いて部分一致。正規化後6文字未満と、「…」でつないだ引用は弾く。
3. **確かめる点**: CR にせず、理由つきで閉じる(捨てると同じ状態)。追加は対象なし + 起点(任意)、変更・削除は対象が要る。
4. **やり直し**: 未確認・弾いたを置き換え、CR にした・捨てたは残す(同じ違いは足し直さない)。取り出しの回の記録は資料ごとに1行で上書き。
5. **モードと章**: on・3章。
6. **実 LLM**: セット B を1回(下の検証結果)。

モデルは生成の用途(111-1 の決定8。要約・案の下書きと同じ解決)。同期で1回呼ぶ。

**推奨と違った選択は0件**。計画の承認の後に、実 LLM の結果から起点の規則を広げた(CR。下の「後続 Phase での改訂」ではなく、この Phase の中の直し。[`q_a.md`](../q_a.md) に CR の形で残した。#40)。#39 の材料。

Claude の判断:
- 取り出しの回を別の表(㉗)にした(違いが0件の回も「比べた束と鮮度」を残すため)。回の鮮度は、その時点の値を写す(束の鮮度は後で変わる)。
- 接頭辞の無い対象の ID(`FR-001`)は、補って一つのキーに決まればそのキーとみなす。
- 追加の起点は、合意の要素のどれでもよい(計画では要件・画面・API。実 LLM が `users` に結んだ正しい違いが弾かれたため。CR)。
- エラーコードは CR に合わせて `MATERIAL_BASELINE_MISSING`(計画では `BASELINE_REQUIRED`)。
- CR の番号の列は、CR にする Phase 115 で足す(駆動する消費者が無い。#17)。
- 新しいドメインのパッケージ `app/materials/` を作った(取り込みの純粋関数。CR の側には依存しない)。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-114-1.md`](./Phase-114-1.md) | 違いの取り出しの純粋関数: 一覧・入力・構造化出力・検査・やり直しの重なり | `app/materials/differences.py`・`__init__.py`・テスト | なし |
| [`Phase-114-2.md`](./Phase-114-2.md) | 違いの表・サービス・API・偽の LLM | `material_difference.py`(モデル・リポジトリ・スキーマ)・`material_difference_service.py`・マイグレーション ほか | 114-1 |
| [`Phase-114-3.md`](./Phase-114-3.md) | docs への反映と後の Phase への前提 | なし(実装のファイルを作らない章。#13・#15・#12 の対象外) | 114-1・114-2 |

## サンプルコード一覧

新規(10):
- 114-1: [`differences.py`](../samples/backend/app/materials/differences.py)・[`__init__.py`](../samples/backend/app/materials/__init__.py)・[`test_material_differences.py`](../samples/backend/tests/unit/test_material_differences.py)
- 114-2: [`material_difference.py`(モデル)](../samples/backend/app/models/material_difference.py)・[`material_difference.py`(リポジトリ)](../samples/backend/app/repositories/material_difference.py)・[`material_difference.py`(スキーマ)](../samples/backend/app/schemas/material_difference.py)・[`material_difference_service.py`](../samples/backend/app/services/material_difference_service.py)・[マイグレーション `b8f3d6a2e915`](../samples/backend/alembic/versions/b8f3d6a2e915_add_material_differences.py)・テスト2本([`test_material_difference_service.py`](../samples/backend/tests/unit/test_material_difference_service.py)・[`test_material_differences_flow.py`](../samples/backend/tests/integration/test_material_differences_flow.py))

更新: backend 5(114-2 の表)。#29 のタグは `Phase-114-2`(114-1 は新規だけ)。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 作成・更新するファイル | 責務(1行) | テスト観点 |
|---|---|---|---|
| 114-1 | `materials/differences.py`・`__init__.py` | 束の合意の要素の一覧と資料から LLM の入力を作り、返った違いを決定的に検査し、やり直しの重なりを除く | 引用の揺れ(全角・空白・md の記号)・弾く理由・接頭辞の補い・種類と対象の組み合わせ・重なり |
| 114-2 | `models/material_difference.py`・`material.py`・`models/__init__.py`・マイグレーション | 取り出しの回(資料ごとに1行)と違い1件ずつ(資料に CASCADE) | 資料を消すと両方消える |
| 114-2 | `repositories/material_difference.py` | 違いの一覧・状態での削除・次の並び・回の上書き | やり直しで足したものは残りの後ろ |
| 114-2 | `schemas/material_difference.py` | 応答の形(回の鮮度・今の最新の束)・捨てるの理由 | 理由の無い捨てるは422 |
| 114-2 | `material_difference_service.py`・`errors.py` | 束 → 鮮度 → LLM → 検査 → 置き換え、捨てる / 戻すの状態の規則 | 古い束でも止めない・束が無い409・やり直しで捨てたが残る・状態の409 |
| 114-2 | `routes/materials.py`・`ai/llm/fake.py` | 取り出し・一覧・捨てる / 戻すの API、資料の印から違いを返す偽物 | 生成の用途で解決・ほかのプロジェクトは404 |

## 写経順序(#23)

章番号順(114-1 → 114-2 → 114-3)。各章の表は依存順(#30)。

実 import 監査(#15): 各章の終わりの本体の写し(章ごとの写しの手順)で、各ファイルの import を読んだ。114-1 のファイルは既存のモジュール(`app.agreements.items`・`app.detailed_design.impact.elements`・文書の model)だけを使い、114-2 のファイルは 114-1 の `app.materials` と既存のモジュールを使う。前方 import は無い。114-1 の中で計画の後に直した起点の規則(CR)は、114-1 の写しを取り直して 114-1 の内容にした。各章のテストが、その章の全ファイルを import する(マイグレーションは `alembic check` で差分なしを確かめ、往復は Phase 117。`models/__init__.py` は `app.models.material_difference` の import で通る)。

## 検証結果

- devex-api:
  - ユニット全体 `uv run pytest`: 1956 件が通った(起点の規則を直した後に、触ったテスト16件を流し直した)。
  - 統合テスト(専用の DB): `test_material_differences_flow.py`・`test_materials_flow.py`・`test_baselines_flow.py` の 6 件が通った。
  - `ruff check`: 0 件。`uvx pyright`(触ったファイルと新しいテスト): 0 件。
  - マイグレーション: 単一の head・ID の衝突なしを確かめ、開発 DB を `b8f3d6a2e915` に上げた。`alembic check` で、モデルとの差分なし(往復は Phase 117)。
- 実 LLM(着手時の決定6): 開発 DB の題材(トレンド追跡アプリ。最新の束 B-6 は CR-6 の反映の後で古い)に、測定のセット B の議事録とメールを資料で足し、`MaterialDifferenceService.extract` で取り出した。モデルは利用者の生成の用途の `gemini-3.5-flash-lite`。3回(議事録2回・メール1回)、入力 計5,366・出力 計1,138 トークン、概算 $0.002 未満。
  - 回の記録の鮮度は `fresh` = false(CR-6 が FR-001〜003 を書き換えた)で、止めずに取り出せた。

  | 正解表 | 1回目(議事録・メール) | 2回目(議事録のやり直し。起点の規則を直した後) |
  |---|---|---|
  | H1 要約の追加 | 追加・起点 SCR-001(通った) | 同じ |
  | H2 遷移の変更 | 変更・対象 SCR-001(通った) | 同じ |
  | H3 英語の切り替え | 追加・起点 `users` → **弾いた**(起点の規則。CR で直した) | 追加・起点 SCR-001(通った) |
  | H4 レート制限 | 変更・対象 `api:GET /api/v1/trends`(通った。引用に `**` が残っていた) | ― |
  | H5 外部向け API の未決 | 確かめる点・対象 FR-005(通った) | ― |
  | T1 撤回 | **変更・対象 FR-001 として挙げた**(誤り。引用は文字どおりあるので検査では弾けない) | 挙げなかった |
  | T2 済み・T3 言い換え | 挙げなかった | 挙げなかった |
  | T4 未決 | 確かめる点(未決の指摘) | 同じ |

  対象はすべて合意の要素のキーか「新規 + 起点」に結べ、引用はすべて資料にあった(弾いたのは起点の規則の1件だけ)。撤回(T1)の揺れは決定的な検査の外 ── Phase 117 の効果測定の (4) で数える。資料2件と違いは開発 DB に残した(下の申し送り)。
- devex-ui: 変更なし。
- `textbook/tools/samples_check.py --api-since HEAD --ui-since HEAD`: 不一致 0・本体のみ 0(一致 1098 / 並び順のみ差 8 / 例外 5)。
- `textbook/tools/link_check.py`: リンク切れ 0 件。
- E2E: 流していない(Phase 117)。

## 未消化の申し送り(#37)

[Phase 113](../Phase-113/Phase-113-introduction.md#未消化の申し送り37) から引き継いだもの。

**ステージ14 の中で扱うもの**(行き先は [111-4](../Phase-111/Phase-111-4.md)):
- **古い束を基準にした説明**(P110・18.3)→ 判定は Phase 113、取り込みの回の記録はこの Phase。CR の作成・共有リンクの作成の知らせと規模の表の鮮度は Phase 115、画面は 116。
- **開発環境での画面確認**: Phase 112 の画面(影響のタブの「反映で変わった所」・確認事項からのリンク・競合の知らせ)。ユーザーの確認は Phase 117 の開発環境での画面確認でまとめて行う(#37 の運用注記)。この Phase は画面を足していない。
- **合意済みの内容の中の食い違い**: 題材の外部設計書 2.4・2.6 に CR-6 の後も「TOP10」が残る。Phase 117 で B-7 を作る前に決める。
- **前 → 後を残す前の反映**(P112): 題材の CR-6 など。Phase 117 で題材を使うときに気にする。
- **(この Phase で生まれた)追加の起点と CR の起点**: 起点が利用者と使う場面・外部連携の追加を、CR の新しい要件の起点にどうつなぐか → Phase 115 の未確定事項([111-4](../Phase-111/Phase-111-4.md) に足した)。
- **(この Phase で生まれた)撤回を変更として挙げる揺れ**: 実 LLM の1回目で T1 を変更として挙げた。検査では弾けない → Phase 117 の効果測定の (4) で数え、プロンプトを直すかを決める。

**ステージ14 の範囲の外**:
- **本番への反映と本番での確認**: ステージ15 の完了時に、[`OPERATIONS.md`](../../devex-api/OPERATIONS.md) 10.8節で行う。マイグレーション `c4e8a1f7b2d6`(P112)・`e7d2b9a4c103`(P113)・`b8f3d6a2e915`(この Phase)は、Phase 117 で 10.8節のステージ14 の分に足す。
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
- `tagmerge.py` が、クラスの docstring の1行の変更を別の位置にも当てた(P113。この Phase は既存のファイルへの追記だけで、手での直しは0件)

**ユーザーが決めるもの**:
- **開発環境の後始末**: 題材「トレンド追跡アプリ」の B-5・B-6・CR-5・CR-6 と CR-6 の共有リンク(期限 2026-11-08)、E2E の捨てのプロジェクト(Phase 112 で「予約の CR」に CR-2・CR-3 を足した)。**(この Phase で足した)** 題材の資料2件「定例打ち合わせ 議事録(セット B)」「外部向けの API について(セット B)」と、その違い(B-6 と比べたもの)。Phase 116 の画面の確かめに使える。Phase 117 の効果測定は B-7 で取り出し直す。
- **タグ**: devex-api `phase-101`〜`phase-106`・`phase-110`、devex-ui `phase-107`〜`phase-110`(振り返り 18.1 の Q8)。`phase-112`(両方)・`phase-113`(devex-api)は、コミットは済んでいるがタグはまだ無い。この Phase は devex-api に `phase-114`(devex-ui は変更なし)。
- **未コミット**: この Phase の分(外側・devex-api)。コミットはユーザーが行う(#35)。

**この Phase で生まれたもの**(上の各節に入れたもの以外):
- **セッションの区切りの記録**: Phase 114 は1セッションで行った。
  1. 計画モードで、111-4 の未確定事項と既存の型を読み、6問(4問 + 2問)。計画の承認(エージェントは使わず直接調べた)。
  2. 114-1(純粋関数)→ 114-2(表・サービス・API・偽の LLM)。章ごとに本体の写しを取った。開発 DB を上げ、実 LLM でセット B を取り出し、起点の規則を直して(CR)議事録を取り出し直した。
  3. samples(`tagmerge.py`。手での直し0件)→ docs → 教材・q_a。

**この Phase で解決したもの**:
- **違いを取り出す処理が無い**(Phase 111 の決定3)→ [114-1](./Phase-114-1.md)・[114-2](./Phase-114-2.md)。
- **ベースラインの「対象が自由文」「根拠を確かめられない」**(111-1)→ 合意の要素のキーと引用の検査([114-1](./Phase-114-1.md))。「回ごとに揺れる」は Phase 117 で測る。

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

設問は Phase の要点の要約である(回答は求めない)。

1. LLM に束の md でなく「キー | 名前 | 中身」の一覧を渡すのはなぜか。範囲(1.3)をキーの無い参考として添えたのはなぜか。
2. 引用の検査で、全角・半角・空白・md の記号の違いを同じとみなし、短い引用と「…」でつないだ引用を弾くのはなぜか。それでも弾けない誤り(撤回を変更として挙げる)は何で数えるか。
3. 確かめる点を CR にせず閉じるのはなぜか。追加が対象を持たず起点を持つのはなぜか。
4. やり直しで、未確認と弾いたを置き換え、捨てた違いと同じものを足し直さないのはなぜか。同じかを、内容でなく種類・対象・引用で見るのはなぜか。
5. 古い束と比べても止めず、その時点の鮮度を回の記録に写して残すのはなぜか。

## 次のフェーズ

**Phase 115**: 違いから CR の下書き・古い束の知らせ(API)。着手時に、[111-4](../Phase-111/Phase-111-4.md) の Phase 115 の未確定事項(画面・API・外部連携の違いから CR の対象の要件の行の選び方・起点のつなぎ方・複数の違いの題と内容の組み立て・知らせの出し方・「古くて少ない」の形)を決める。選べる違いは未確認の追加・変更・削除で、CR にした違いは `converted` と CR の番号を持つ([114-3](./Phase-114-3.md) の前提)。
