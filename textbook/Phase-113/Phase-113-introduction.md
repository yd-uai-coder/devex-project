# Phase 113 導入: 資料 API と束の鮮度

## 目的

ステージ14(変更の取り込み)の土台を作る。

- **資料**: 議事録・メール・資料を、プロジェクトの途中から本文の貼り付けか txt / md / pdf で足す入口(表と API)。作成時の添付資料とは別に持ち、ヒアリングの根拠に混ぜない。Phase 114 の違いの取り出しが、この本文と最新の束を比べる。
- **束の鮮度**: 「束が古い」(後の束がある・束の後に反映した CR がある・束を作った時点で段階が古かった)の判定を1つの純粋関数にし、束ごとの API と、束の一覧・中身の「新しいか」で返す。取り込み(114)・CR の作成と共有リンクの作成・規模の表(115)・画面(116)が使う(ステージ13 の振り返り 18.3「古い束を基準にした説明」の入力。Phase 111 の決定5)。

## パイプライン上の位置づけ・前提

```
[Phase 81・91]  束(凍結した写し)・合意の記録(要素ごと・追記だけ・seq つき)
[Phase 101]     規模の集計: 古いまま写した段階は「少なく出ることがある」と注記
[Phase 112]     競合: 合意の記録から、束の後に CR が書き換えた要素(changed_after。文を変えない反映は数えない)
        ▼
[113-1 資料(API)]   materials の表・貼り付け / ファイル(extract_text を共有)・上限・一覧 / 読む / 消す
[113-2 束の鮮度]     freshness(後の束・changed_after・outdated_stages)・GET .../freshness・束の fresh
[113-3 docs]         外部設計 2.17・内部設計 3.2 / 3.3・実装計画 4.1
        ▼
[Phase 114]  資料1件と最新の束の写しから、違いを取り出す(古い束なら知らせる)
```

- **前提として読むもの**: [111-1](../Phase-111/Phase-111-1.md)(決定2・4・5)、[111-4](../Phase-111/Phase-111-4.md) の Phase 113 の行と未確定事項、[Phase 112 導入](../Phase-112/Phase-112-introduction.md)(`changed_after`)、[外部設計書](../../docs/external_design.md) 2.17節。
- **この Phase を始めた時点の状態**:
  - ユーザーの指示は「Phase114を開始する」だったが、Phase 113 が済んでいなかった(`textbook/Phase-113` が無く、本体の最新は Phase 112)。計画モードで確かめ、Phase 113 から始めた(着手時の決定0)。
  - 外側のリポジトリは `ae3431e`(Phase 112)、devex-api は `7239a17`、devex-ui は `1cac005`。どれも未コミットの変更なし。開発 DB は `c4e8a1f7b2d6`。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(着手時の決定4)。本体(`devex-api`)と samples に同じ内容を書いた。devex-ui は変えていない(画面は Phase 116)。

E2E: この Phase では流さない。ステージ14 の E2E は、Phase 117 で既存を含めて全部流す(#36)。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 113 開始時」。質問は計画モードで2回(1問 + 4問)。すべて推奨どおり。

0. **着手の順**: Phase 113 から始める(113 と 114 をまとめない。114 だけ先にしない)。Phase 114 は次のセッション(#18)。
1. **上限**: 本文は20,000文字を超えたら断る(貼り付けも、ファイルから取り出した本文も切り詰めない)。ファイルは txt / md / pdf の2MB まで(API 全体のリクエストの上限に合わせる)。1プロジェクト50件まで。
2. **資料の削除**: 違い(114)は資料と一緒に消す(CASCADE)。CR は残す。
3. **鮮度の形と API**: 束ごとに返す(`GET .../baselines/{number}/freshness`)。束の一覧・中身に `fresh` を足す。画面は 116。
4. **自動実装モードと分け方**: on・3章(資料・鮮度・docs)。

ほかに、111-4 の「どの Phase も」の項: テンプレートから取り込むものは無い。簡易ドキュメントモードは、資料が束と比べるためのものなので、詳細設計モードだけにした(`require_detailed`。CR と同じ)。

**推奨と違った選択は0件**。計画の差し戻しも無い。#39 の材料。

Claude の判断:
- 本文を取り出せなかったファイル(UTF-8 でない・PDF を読めない・空)は、資料にしない(422 `MATERIAL_UNREADABLE`)。表に「状態」の列を置かない。違いを取り出したかの状態は 114 で違いの表の側に持つ。
- 合意の記録を始める前の束(ステージ12 より前)は、束の後の CR を判定できないので `tracked` = false にし、古いとは言わない。
- 合意の記録から `RecordFact` を作る処理(`AgreementService.record_facts`)と、束の写しの段階の状態(`baseline_stage_states`)・承認のままでない段階の規則(`scale.outdated_stages`)を、競合・規模の集計と共有した(#17。駆動する消費者 = 鮮度)。拡張子の解決(`file_type_of`)も作成時の添付資料と共有した(駆動する消費者 = 資料のサービス)。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-113-1.md`](./Phase-113-1.md) | 資料(API): 表・本文の取り出しの共有・上限・API | `material.py`(モデル・リポジトリ・スキーマ)・`material_service.py`・`routes/materials.py`・マイグレーション ほか | なし |
| [`Phase-113-2.md`](./Phase-113-2.md) | 束の鮮度: 純粋関数・記録と段階の状態の共有・API | `app/change_requests/freshness.py` ほか | なし(113-1 と触るファイルは重ならない) |
| [`Phase-113-3.md`](./Phase-113-3.md) | docs への反映と後の Phase への前提 | なし(実装のファイルを作らない章。#13・#15・#12 の対象外) | 113-1・113-2 |

## サンプルコード一覧

新規(10):
- 113-1: [`material.py`(モデル)](../samples/backend/app/models/material.py)・[`material.py`(リポジトリ)](../samples/backend/app/repositories/material.py)・[`material.py`(スキーマ)](../samples/backend/app/schemas/material.py)・[`material_service.py`](../samples/backend/app/services/material_service.py)・[`routes/materials.py`](../samples/backend/app/api/routes/materials.py)・[マイグレーション `e7d2b9a4c103`](../samples/backend/alembic/versions/e7d2b9a4c103_add_materials.py)・テスト2本([`test_material_service.py`](../samples/backend/tests/unit/test_material_service.py)・[`test_materials_flow.py`](../samples/backend/tests/integration/test_materials_flow.py))
- 113-2: [`freshness.py`](../samples/backend/app/change_requests/freshness.py)・[`test_baseline_freshness.py`](../samples/backend/tests/unit/test_baseline_freshness.py)

更新: backend 16(各章の表)。#29 のタグは `Phase-113-1`・`113-2`。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 作成・更新するファイル | 責務(1行) | テスト観点 |
|---|---|---|---|
| 113-1 | `intake_file_processor.py`・`project.py` | 本文の取り出しと拡張子の解決を、作成時の添付資料と資料で共有する | `max_chars=None` は切り詰めない・添付資料は今までどおり |
| 113-1 | `models/material.py`・`models/project.py`・`models/__init__.py`・マイグレーション | 資料の表(本文は切り詰めない・CASCADE) | 作って `Project.materials` から引ける |
| 113-1 | `repositories/material.py` | 一覧は本文を読まず文字数だけ数える・プロジェクトの中の1件 | 新しい順・`length` |
| 113-1 | `schemas/material.py` | 種類・題(1〜200)・日付・本文(空でない)の検査 | 空白だけの題と本文・知らない種類は弾く |
| 113-1 | `material_service.py`・`errors.py` | 上限(数・長さ・大きさ・形式)を、取り出しの前後の正しい順で確かめる | 断ったら行を作らない・PDF を読む AI を無駄に呼ばない・モード |
| 113-1 | `routes/materials.py`・`routes/__init__.py` | 貼り付け・ファイル・一覧・1件・削除 | ほかのプロジェクトは404・削除の CASCADE |
| 113-2 | `freshness.py`・`scale.py`・`change_requests/__init__.py` | 束の3つの「古い」を返す純粋関数・段階の規則の共有 | 文を変えない反映と束に入れた CR は数えない・判定できない束 |
| 113-2 | `agreement_service.py`・`change_request_service.py` | 合意の記録 → `RecordFact` を1か所に(競合と共有) | 既存の競合のテストが通る |
| 113-2 | `repositories/baseline.py`・`baseline_service.py` | 鮮度のサービス(記録と番号を1回だけ読む)・写しの段階の状態 | 反映の後の束は古く、新しい束は新しい |
| 113-2 | `schemas/baseline.py`・`routes/baselines.py` | 鮮度の応答と束の `fresh` | 古い束と最新の束・404 |

## 写経順序(#23)

章番号順(113-1 → 113-2 → 113-3)。各章の表は依存順(#30)。

実 import 監査(#15): 各章の終わりの本体の写し(章ごとの写しの手順)で、各ファイルの import を読んだ。前方 import は無い(113-1 のファイルは `freshness`・`record_facts` を使わず、113-2 のファイルは資料のモジュールを使わない)。各章のテストが、その章の全ファイルを import する(マイグレーションは Phase 117 の往復で確かめる。ルーターの登録は統合テストが通す)。

## 検証結果

- devex-api:
  - ユニット全体 `uv run pytest`: 1940 件が通った。
  - 統合テスト(専用の DB): `test_materials_flow.py`・`test_baselines_flow.py`・`test_change_requests_flow.py` の 15 件が通った。
  - `ruff check`: 0 件。`uvx pyright`(触ったファイルと新しいテスト): 0 件。
  - マイグレーション: 単一の head で ID の衝突なしを確かめ、開発 DB を `e7d2b9a4c103` に上げた(往復は Phase 117)。
  - 開発 DB の題材(トレンド追跡アプリ)の束 B-1〜B-6 の鮮度を API で読んだ(結果は [113-2](./Phase-113-2.md) の表。B-6 は CR-6 の反映の後で古い)。資料の一覧は空(200)。実 LLM は使っていない。
- devex-ui: 変更なし。
- `textbook/tools/samples_check.py --api-since HEAD --ui-since HEAD`: 不一致 0・本体のみ 0(一致 1088 / 並び順のみ差 8 / 例外 5)。
- `textbook/tools/link_check.py`: リンク切れ 0 件。
- E2E: 流していない(Phase 117)。

## 未消化の申し送り(#37)

[Phase 112](../Phase-112/Phase-112-introduction.md#未消化の申し送り37) から引き継いだもの。

**ステージ14 の中で扱うもの**(行き先は [111-4](../Phase-111/Phase-111-4.md)):
- **古い束を基準にした説明**(P110・18.3)→ 判定はこの Phase でできた([113-2](./Phase-113-2.md))。知らせ・規模の表の鮮度は Phase 115、画面は 116。
- **開発環境での画面確認**: Phase 112 の画面(影響のタブの「反映で変わった所」・確認事項からのリンク・競合の知らせ)。ユーザーの確認は Phase 117 の開発環境での画面確認でまとめて行う(#37 の運用注記)。この Phase は画面を足していない。
- **合意済みの内容の中の食い違い**: 題材の外部設計書 2.4・2.6 に CR-6 の後も「TOP10」が残る。Phase 117 で B-7 を作る前に決める。
- **前 → 後を残す前の反映**(P112): 題材の CR-6 など。Phase 117 で題材を使うときに気にする。

**ステージ14 の範囲の外**:
- **本番への反映と本番での確認**: ステージ15 の完了時に、[`OPERATIONS.md`](../../devex-api/OPERATIONS.md) 10.8節で行う。マイグレーション `c4e8a1f7b2d6`(P112)と `e7d2b9a4c103`(この Phase)は、Phase 117 で 10.8節のステージ14 の分に足す。
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
- **(この Phase で生まれた)** `tagmerge.py` が、クラスの docstring の1行の変更を、別の位置(`errors.py` の `# Phase-24:追記` の行)にも当てた。手で直した(`FileTooLargeError`)。同じ1行の docstring が無いのに当たった原因は調べていない

**ユーザーが決めるもの**:
- **開発環境の後始末**: 題材「トレンド追跡アプリ」の B-5・B-6・CR-5・CR-6 と CR-6 の共有リンク(期限 2026-11-08)、E2E の捨てのプロジェクト(Phase 112 で「予約の CR」に CR-2・CR-3 を足した)。
- **タグ**: devex-api `phase-101`〜`phase-106`・`phase-110`、devex-ui `phase-107`〜`phase-110`(振り返り 18.1 の Q8)。Phase 112 の `phase-112`(両方)は、コミットは済んでいるがタグはまだ無い(2026-10-27 に確かめた)。この Phase は devex-api に `phase-113`(devex-ui は変更なし)。
- **未コミット**: Phase 112 の分は `ae3431e` 等でコミット済み。この Phase の分(外側・devex-api)。コミットはユーザーが行う(#35)。

**この Phase で生まれたもの**:
- **資料の画面の置き場**: Phase 116 で決める([111-4](../Phase-111/Phase-111-4.md) の Phase 116 の未確定事項)。API は `/projects/{id}/materials`。
- **判定できない束**: `tracked` = false の束(題材の B-1・B-2)の見せ方は Phase 116 で決める。
- **セッションの区切りの記録**: Phase 113 は1セッションで行った。
  1. 計画モードで、指示の Phase 114 の前提(113)が無いことを確かめ、着手の順を聞いた(1問)。Phase 113 の未確定事項を4問。計画の承認(エージェントは使わず直接調べた)。
  2. 113-1(資料)→ 113-2(鮮度)。章ごとに本体の写しを取った。開発 DB を上げ、題材の束の鮮度を API で読んだ。
  3. samples(`tagmerge.py`。章ごとに。`errors.py` の1か所を手で直した)→ docs → 教材・q_a。

**この Phase で解決したもの**:
- **束が古いかの判定が無い**(P110・18.3 の判定の部分)→ [113-2](./Phase-113-2.md)。
- **議事録・メール・資料の入口が無い**(Phase 111 の決定4)→ [113-1](./Phase-113-1.md)。

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

設問は Phase の要点の要約である(回答は求めない)。

1. 資料を作成時の添付資料と別の表にし、ヒアリングの根拠(チャットの履歴)に入れないのはなぜか。本文の取り出しの関数は、どこを共有し、どこを分けたか。
2. 資料の本文を切り詰めず、長すぎれば断るのはなぜか。Phase 114 の「引用が資料に文字どおりあるか」の検査とどうつながるか。
3. 束の「古い」を3つ(後の束・束の後の CR・古かった段階)に分けたのはなぜか。それぞれ、どの比べ方(違いの取り出し・CR の案・規模)を誤らせるか。
4. 束の後の CR を、版でなく合意の記録で、競合と同じ `changed_after` で判定するのはなぜか。束に入れた CR と、文を変えなかった反映が数えられない理由は何か。
5. 合意の記録を始める前の束を「古い」と言わず「判定できない」としたのはなぜか。

## 次のフェーズ

**Phase 114**: 違いの取り出し API。着手時に、[111-4](../Phase-111/Phase-111-4.md) の Phase 114 の未確定事項(比べる範囲・プロンプトに渡す形・引用の検査の規則・確かめる点の持ち方・やり直し・モデル)を決める。資料の本文は `Material.body`、比べる相手は最新の束で、取り込みの前に `BaselineService.freshness` で古いかを見る([113-3](./Phase-113-3.md) の前提)。
