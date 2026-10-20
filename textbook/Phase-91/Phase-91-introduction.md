# Phase 91 導入: 行の合意の記録 API(ステージ12)

## 目的

ステージ12(合意の精度)の最初の実装 Phase。[90-4](../Phase-90/Phase-90-4.md) の Phase 91 として、要素ごとの合意の記録を作る([外部設計書](../../docs/external_design.md) 2.15節、[内部設計書](../../docs/internal_design.md) 3.2節⑳・3.3節 12項)。保護(Phase 92・93)・確認事項(94)・履歴(95)は、どれも「何が合意済みか」を読むので、記録を最初に作る。画面は Phase 97。

- 合意の対象の要素とキー・比べる値・出どころの名前(純粋関数)── [91-1](./Phase-91-1.md)
- 合意の記録の表とリポジトリ ── [91-2](./Phase-91-2.md)
- 束の作成・「採用にする」での記録と、版の巡回 ── [91-3](./Phase-91-3.md)
- 今の合意の一覧 API ── [91-4](./Phase-91-4.md)
- 既存の束からの移行 ── [91-5](./Phase-91-5.md)

## パイプライン上の位置づけ・前提

```
POST /baselines(束 B-n を作る)                     POST .../rows/{id}/adopt(採用にする)
   │ BaselineService.create                             │ DocGeneratorService.adopt_requirement
   │   写しを作る(81-3)                                 │   行の出どころを adopted に(36-2)
   ▼                                                    ▼
AgreementService.record_baseline ──[91-3]──      AgreementService.record_adopt(詳細設計モードだけ)
   │ agreement_items(要件・利用者・画面・API・外部連携) ──[91-1]
   │ removed_keys(今の合意にあって束に無い → 外れた)
   ▼
AgreementRepository.append(連番・同じ日時)──[91-2]──▶ agreement_records(追記だけ)
                                                              │
GET /agreements ──[91-4]── AgreementService.current ◀────────┘ キーごとの最新(外れたを除く)
                                                              ▲
alembic 75d414ded7cb ──[91-5]── 既存の束を番号の順に読んで記録 ┘

GeneratedDocumentRepository.create_version ──[91-3]── 束が写した版を巡回で消さない
```

- **前提として読むもの**: [90-1](../Phase-90/Phase-90-1.md)(決定1・5・6・7、Claude の判断「合意の記録のキーは要素のキー」)・[90-4](../Phase-90/Phase-90-4.md)(Phase 91 のスコープと未確定事項)・[外部設計書](../../docs/external_design.md) 2.15節。
- **今の仕組み**: 合意は束(`baselines`・`baseline_items`)に、文書まるごとの写しとしてあるだけ。「採用にする」は行の出どころを `adopted` に変えるだけで、誰が・いつを残さない。版の巡回(直近3件)は、CR で反映した版だけを除き、束が写した版は消しうる。変更影響分析の要素のキーに、利用者(1.2)と外部連携(2.4)は無い。
- **この Phase を始めた時点の状態**: 外側のリポジトリは `8760261`。Phase 90 の分(docs・教材・測定)は未コミットで、この Phase はその上に重ねた。devex-api は `stage11-15` ブランチの `5406d78`、devex-ui は `main` の `a80821e`(どちらも未コミットの変更なし)。alembic の head は `be106e6426be`。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(本体 + samples)。

E2E: この Phase では流さない(画面を変えないため。ステージ12 の E2E は Phase 99 で既存を含めて全部流す)。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 91 開始時」を参照。計画モードで1回(4問)聞いた。

| # | 問い | 決定 |
|---|---|---|
| 1 | 自動実装モード | on(推奨どおり) |
| 2 | ID の無い要素のキー | 利用者と使う場面(1.2)は全体で1つ(`users`)、外部連携は行ごと(`integration:<サービス名>`)(推奨どおり) |
| 3 | 既存の束からの移行 | **マイグレーションで移行する**(推奨は「移行しない」。範囲を広げる向き) |
| 4 | 合意の取り消し | 持たない(推奨どおり) |

Claude の判断(計画の承認で確定、または作業中):

- 1つの表に追記し、今の合意はキーごとの最新。並びはプロジェクトの中の連番 `seq`。
- 合意した中身は写す(行の model)。版を指すだけにはしない。
- **束の作成では、今の合意にあって束に無い要素に「外れた」記録(中身が NULL)を足す**。CR で消した要件を、Phase 92 の保護が戻さないため。
- 「採用にする」は詳細設計モードのときだけ記録する。ルートに利用者を渡し、記録した人を残す。
- 出どころは種類(`baseline` / `adopt` / `change_request`)と、束・CR への外部キー。CR は Phase 93 で書く。
- テンプレートから取り込むものは無し。devex-ui は変えない(採用の応答は同じ)。
- **作業中**: `require_detailed` を束のサービスから末端のモジュール `app/services/detailed_mode.py` へ移した(合意のサービスは束のサービスから呼ばれ、束のサービスを import すると循環するため。[91-4](./Phase-91-4.md))。
- **作業中**: 比べる値(`body_of`)は行の model で読み直してから作る(移行で写した行は既定値の欄が欠けるため。[91-1](./Phase-91-1.md))。
- **作業中**: 全体テストで見つけた既存の失敗を直した。統合テスト `test_llm_settings_flow.py` のモデルの数(8 → 7)は、Phase 88 の後(Gemini 3.1 Flash-Lite を外した調整)で直し忘れていた。

推奨と違った選択は1件(決定3。範囲を広げる向き)。計画の差し戻しは無し。#39 の材料。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-91-1.md`](./Phase-91-1.md) | 合意の対象の要素(純粋関数) | あり(本体 3 + テスト 1) | なし |
| [`Phase-91-2.md`](./Phase-91-2.md) | 合意の記録の表とリポジトリ | あり(本体 4 + マイグレーション 1 + テスト 1) | 91-1(`AgreedItem`・`AgreementOrigin`) |
| [`Phase-91-3.md`](./Phase-91-3.md) | 束の作成・「採用にする」での記録と、版の巡回 | あり(本体 5 + テスト 2) | 91-1・91-2 |
| [`Phase-91-4.md`](./Phase-91-4.md) | 今の合意の一覧 API | あり(本体 7 + テスト 1) | 91-1〜91-3 |
| [`Phase-91-5.md`](./Phase-91-5.md) | 既存の束からの移行 | あり(マイグレーション 1 + テスト 1) | 91-2(表)・91-1(突き合わせる規則) |

## サンプルコード一覧

`textbook/samples/backend/` の新規・更新:

- 91-1: `app/agreements/items.py`・`app/agreements/origins.py`・`app/agreements/__init__.py`(新規)・`tests/unit/test_agreement_items.py`(新規)
- 91-2: `app/models/agreement.py`(新規)・`app/models/project.py`・`app/models/__init__.py`・`alembic/versions/05c8f8d7cf8b_add_agreement_records.py`(新規)・`app/repositories/agreement.py`(新規)・`tests/unit/test_agreement_repository.py`(新規)
- 91-3: `app/repositories/generated_document.py`・`app/services/agreement_service.py`(新規)・`app/services/baseline_service.py`・`app/services/doc_generator_service.py`・`app/api/routes/projects.py`・`tests/unit/test_agreement_recording.py`(新規)・`tests/unit/test_document_versions.py`
- 91-4: `app/services/detailed_mode.py`(新規)・`app/services/baseline_service.py`・`app/services/change_request_service.py`・`app/schemas/agreement.py`・`app/services/agreement_service.py`・`app/api/routes/agreements.py`(新規)・`app/api/routes/__init__.py`・`tests/integration/test_agreements_flow.py`(新規)
- 91-5: `alembic/versions/75d414ded7cb_backfill_agreement_records.py`(新規)・`tests/unit/test_agreement_migration.py`(新規)
- 既存の直し: `tests/integration/test_llm_settings_flow.py`(タグは `Phase-91(既存の直し)`)
- ミラーしないもの(#21 の共通): 無し(インフラ・設定ファイルは変えていない)。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 作成・更新するファイル | 責務(1行) | テスト観点 |
|---|---|---|---|
| 91-1 | `app/agreements/items.py` | model → 合意の対象の要素(キー・種類・表示名・中身)、比べる値、外れたキー | 文書の順・変更影響分析のキーと body と一致・既定値・外れたキー |
| 91-1 | `app/agreements/origins.py` | 出どころの種類と名前 | `B-n`・`採用にする`・`CR-n`・番号が無いとき |
| 91-2 | `app/models/agreement.py`・マイグレーション | 追記型の記録の表(連番・中身 NULL = 外れた) | 連番の一意制約・往復・`alembic check` |
| 91-2 | `app/repositories/agreement.py` | 1回の合意の追記・記録の一覧・今の合意 | 連番・同じ日時・キーごとの最新・外れたを除く |
| 91-3 | `app/services/agreement_service.py`(記録) | 束・採用から記録を作る(commit は呼ぶ側) | 束の6要素・外れた・採用・簡易モードは記録しない |
| 91-3 | `baseline_service.py`・`doc_generator_service.py`・`projects.py` | 束の作成・採用で記録を呼ぶ。採用のルートに利用者 | 同上(サービスの経路で) |
| 91-3 | `generated_document.py` | 巡回で束が写した版を除く | 上限より多く作っても v1 が残る |
| 91-4 | `detailed_mode.py` | 詳細設計モードの判定(束・CR・合意で共有) | 束・CR の既存のテストが番人 |
| 91-4 | `agreement.py`(スキーマ)・`agreement_service.py`(一覧)・`agreements.py`(ルート) | 今の合意を文書の順で返す | 統合: 一覧・JSONB・CASCADE・409・404・401 |
| 91-5 | 移行のマイグレーション | 既存の束から記録を作る(app を import しない) | app の規則と突き合わせ・束の順・外れた |

## 写経順序(#23)

章番号順。各章の「作成・更新したファイル」表は依存順に並べた(#30)。

実 import 監査(#15): 各ファイルの全 import 文を読み、import 先(モジュールとシンボル)の誕生章が、そのファイルの章以下であることを確かめた。

- `app/agreements/*`(91-1)→ 既存の `app.documents.*.model`・`app.detailed_design.api_list` だけ。
- `app/repositories/agreement.py`(91-2)→ `app.agreements`(91-1)・`app.models.agreement`(91-2)。
- `app/services/agreement_service.py` の 91-3 の分 → `app.agreements.agreement_items`・`removed_keys`(91-1)・`AgreementRepository`(91-2)・既存の `parse_model`。91-4 の分(`AGREED_KINDS`・`require_detailed`)は samples で `Phase-91-4:追記` のタグを付けた。
- `baseline_service.py` の 91-3 の分 → `AgreementService`(91-3)。91-4 の分 → `require_detailed`(91-4 の `detailed_mode`)。
- `app/schemas/agreement.py`(91-4)→ `app.agreements`(91-1)・`app.models.agreement`(91-2)。
- テスト: `test_agreement_items.py`(91-1)→ 91-1 と既存。`test_agreement_recording.py`(91-3)→ `AgreementService`(91-3)まで。`test_agreement_migration.py`(91-5)→ 91-1 と移行ファイル。

各章のテストは、その章で作成・更新した全ファイルを少なくとも1度 import する(#15)。91-2 の `app/models/project.py`・`__init__.py` はリポジトリのテストが `Project` 経由で、91-4 の `change_request_service.py`・`baseline_service.py` の移動分は既存のテストと統合テストが通る。

## 検証結果

- ユニット: 章ごとに章のテストを流し、Phase の終わりに全体を流した(→ 下の「全体テスト」)。
- `ruff check`(app・tests): 通った。`pyright`(触ったファイル): 0 件。
- 開発 DB: alembic の単一 head と ID の衝突を確かめてから upgrade。`alembic check` で差なし。downgrade → upgrade の往復で記録は 118件のまま。トレンド追跡アプリの `GET /agreements` は 18件・出どころ `B-3`。
- `textbook/tools/samples_check.py --api-since stage11-15`: 不一致 0・本体のみ 0(一致 939 / 並び順のみ差 8 / 例外 5)。
- `textbook/tools/link_check.py`: リンク切れ 0 件。
- 全体テスト: ユニット 1648 件・統合 34 件がすべて通った(統合は専用のテスト DB)。1回目は、ユニットで採用のルートのテスト(`test_document_versions.py`。ルートの関数を直接呼ぶ)が利用者の引数の追加で落ち、統合で既存の `test_llm_settings_flow.py`(モデルの数)が落ちた。両方を直して流し直した。
- E2E: 流していない(画面を変えていない。Phase 99)。

## 未消化の申し送り(#37)

[Phase 90](../Phase-90/Phase-90-introduction.md#未消化の申し送り37) から引き継いだもの。

**ステージ12 の中で扱うもの**(行き先は [90-4](../Phase-90/Phase-90-4.md)):
- **CR を渡さない再生成で、合意した行が動く**(P89)→ Phase 92・93。合意の記録はこの Phase で作った。
- **「採用にする」が再生成で消える**([90-2](../Phase-90/Phase-90-2.md))→ Phase 92。この Phase から、採用は合意として記録される(詳細設計モード)。
- **推測の採用率・決める機会**(振り返り 6節)→ Phase 94・98。
- **影響が広がる変更の実 LLM での比較**(P89)→ Phase 99 の効果測定。
- **下書きの中の直しは時系列に残さない**(P89)→ Phase 95・98。
- **段階の承認で付く印の漏れ**(P86 の決定)→ Phase 96。
- **新しい要件を足す CR の予測の起点を人が選ぶ形**(P83)→ Phase 96・98。
- **Phase 92〜99 の未確定事項**: [90-4](../Phase-90/Phase-90-4.md)「未確定事項」。

**ステージ12 の範囲の外**:
- **本番への反映と本番での確認**: ステージ15 の完了時に、[`OPERATIONS.md`](../../devex-api/OPERATIONS.md) 10.8節で行う。この Phase の2つのマイグレーション(`05c8f8d7cf8b`・`75d414ded7cb`)も、Phase 99 で 10.8節に足す。本番には束が無いので、移行は記録を作らない。
- **要約の生成の回数の上限**・**束の一覧の入れた CR**: 使われ方を見て決める(ステージ13 以降)。
- 規模の集計と選択肢つきの説明(ステージ13)。
- 振り返り 6節の残り5件・生成の質の候補4件(Phase 90 と同じ)。

**持ち越し**(触るときに直す。中身は [振り返り](../retrospectives/project-retrospective.md) 8節):
- `test_chat_service.py` などの pyright の指摘(Phase 40)
- devex-ui の並列のテストのタイムアウト(Phase 44)
- 偽 LLM の外部設計書の GET に DF が無い(Phase 45)
- `DfdEditorTabs` のテストのまれな失敗(Phase 77)
- Google の公開鍵を毎回取りに行く(Phase 74)
- `ListCard` の入れ物(Phase 79。テンプレートでは直した)
- 英語のままの refresh の失敗の文(Phase 79)
- `streamChat.test.ts` の lint の警告(使っていない変数。既存)
- `appendix/measurements/stage11/measure.py` の `ruff check` の指摘(行の長さ1件。Phase 80 から)
- 反映の後の CR の流れの部品: `tests/fixtures/change_requests.py`。85-2〜85-4 のテストの中の同じ手順は、触るときに寄せる(#17)。

**ユーザーが決めるもの**:
- **開発環境の後始末**: 確認用の利用者・プロジェクト(開発 DB の束 12・CR 8 など)、DB の事故の後の複製。「トレンド追跡アプリ」は Phase 99 の効果測定の題材の候補なので残しておく(この Phase の移行で、B-3 の 18要素が合意済みになった)。
- **この Phase と Phase 90 の未コミット**: 外側のリポジトリ(Phase 90・91 の教材・docs・samples)と devex-api。コミットはユーザーが行う(#35)。

**この Phase で解決したもの**:
- 「束が指す版も巡回で消さない」(決定6)→ [91-3](./Phase-91-3.md)。
- Phase 91 の未確定事項(記録の持ち方・利用者のキー・中身の形・データ移行・取り消し)→ 「着手時の相談で決めたこと」。

**この Phase で生まれたもの**:
- **外部連携のキーはサービス名**: サービス名を言い換えると、別の要素(前の名前は外れた)になる。Phase 93 の外部設計書の保護で、ID の付け直しの照合(90-4 の Phase 93 の未確定事項)と一緒に扱う。
- **セッションの区切りの記録**: Phase 91 は1セッションで行った。計画モードで調査(Explore エージェント1つ)・質問1回(4問)・計画の承認 → 91-1〜91-5 の実装 → 開発 DB の移行 → samples → 教材 → 全体テスト。

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

設問は Phase の要点の要約である(回答は求めない)。

1. 合意の記録のキーを、要件 ID ではなく変更影響分析の要素のキーにしたのはなぜか。利用者(1.2)と外部連携でキーの粒度を変えたのはなぜか。
2. 今の合意を「キーごとの最新」で求める表で、束から外れた要素を記録しないと、Phase 92 の保護で何が起きるか。
3. 「採用にする」を簡易ドキュメントモードでは記録しないのはなぜか。
4. 比べる値(`body_of`)を、保存した中身をそのまま JSON にせず、行の model で読み直してから作るのはなぜか。
5. 移行のマイグレーションが app のコードを import しないのはなぜか。その代わりに何で正しさを確かめたか。

## 次のフェーズ

**Phase 92**: 要件定義書の保護。合意済みの行には出どころの上限をかけ直さず、組み立ての後に合意の形に戻し、落ちた行を戻す。利用者(1.2)も同じ。着手時に、[90-4](../Phase-90/Phase-90-4.md) の Phase 92 の未確定事項(戻す範囲・戻す位置・言い換えの重複・推測の行の合意・戻した件数の残し方)を決める。
