# Phase 106 導入: 段階の参照の切れと、合意の周りの残り(API)(ステージ13)

## 目的

ステージ13(説明とすり合わせ)の6つ目の実装 Phase。[100-4](../Phase-100/Phase-100-4.md) の Phase 106 にあたる。

Phase 100 で、ユーザーは「使われ方を見て決める」としていた残りをステージ13 に入れた([100-1](../Phase-100/Phase-100-1.md))。Phase 105 で名前の揺れ(外部連携・推測の利用者)を直したので、この Phase では残りの API の側を片づける。画面は Phase 107〜109 で作る。

- 段階7 の再生成で機能一覧に無い処理 ID を捨て、言い換えた段階1 に対して段階2・3・4・7 の参照が切れないことを確かめる ── [106-1](./Phase-106-1.md)
- CR の反映で文が変わった要件の確認事項を、未確認に戻す ── [106-2](./Phase-106-2.md)
- 生成で作り直したまま DFD・データ辞書だけを直した承認でも、前の段階へ印を送る ── [106-3](./Phase-106-3.md)
- 巡回で消えた版の戻しを、要素の履歴に残す ── [106-4](./Phase-106-4.md)
- 新しい要件の予測の起点に段階1 の処理を足し、束の応答に入れた CR を出す ── [106-5](./Phase-106-5.md)

## パイプライン上の位置づけ・前提

```
段階1 を作り直す ──(ID は引き継ぐ。消えた ID だけが切れる)
   段階2・3・4 の再生成: 機能一覧に無い ID を捨てる(既存)
   段階7 の再生成: drop_unknown_functions ──[106-1]
   人が保存した行の切れ: 検証の UNKNOWN_FUNCTION → 一覧で付け替え・削除(Phase 109)

CR の反映(要件定義書の再生成) ─▶ 合意の更新 ─▶ 確認事項の reopen(文が変わった対象)──[106-2]
DFD・データ辞書・ER・構成図の保存 ─▶ mark_edited(regenerated も reviewing)──[106-3]
版の巡回で消す ─▶ protection を pruned_protections へ写す ─▶ 要素の履歴 ──[106-4]
新しい要件の起点: 要件・画面・API + 段階1 の処理 ──[106-5]
束の応答: + included_change_requests ──[106-5]
```

- **前提として読むもの**: [100-4](../Phase-100/Phase-100-4.md)(Phase 106 の未確定事項)・[Phase 99](../Phase-99/Phase-99-introduction.md)(段階5 の機能一覧に無い手順・確認事項の状態・DFD だけの承認)・[Phase 96](../Phase-96/Phase-96-introduction.md)(起点)・[Phase 95](../Phase-95/Phase-95-introduction.md)(要素の履歴)・[Phase 88](../Phase-88/Phase-88-introduction.md)(束の一覧)・[Phase 105](../Phase-105/Phase-105-introduction.md)(言い換えの規則)。
- **今の仕組み**(調べて分かったこと):
  - 段階2・3・4 の再生成は、組み立てで機能一覧に無い ID を捨てる。段階7 は AI の出力を素通しにしていた。段階2 の処理概要表と段階3 の CRUD 図の画面は、機能一覧の処理だけを行にするので、切れた行は見えず手で直せない。段階4・7 は自由入力で直せる。
  - 確認事項の記録は CR の反映で触られず、文が変わって推測に戻った行も「確認済み」のまま出た。
  - `mark_edited` は承認済みの段階だけを差し戻し、`regenerated` の段階は変えなかった。
  - 版の巡回(文書の種類ごと3つ)は `protection` のある版も消し、戻しの記録も消えた。
  - 起点の種類は要件・画面・API。束の行には CR への関係が無い。
- **この Phase を始めた時点の状態**: 外側のリポジトリは `1da37ba`、devex-api は `stage11-15` ブランチの `6209bd7`(どちらもコミットの題は Phase 106 の題だが、中身は Phase 105)。devex-api のタグ `phase-101`〜`phase-105` はまだ無い。devex-ui は `main` の `511c5e6`。alembic の head は `e8f2a4b6c913`。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(本体 + samples)。変えるのは devex-api だけ(devex-ui は変えない)。

E2E: この Phase では流さない。画面は変えず、API の応答は項目を足すだけ(確認事項の `changed_by_change_request_number`・束の `included_change_requests`・起点の候補の `function`)。Phase 110 で全部流す(#36)。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 106 開始時」を参照する。計画モードで2回(4問・3問)聞いた。

| # | 問い | 決定 |
|---|---|---|
| 1 | 自動実装モード | on(推奨どおり) |
| 2 | 段階2・3・7 の機能一覧に無い処理 | 段階5 と同じ「付け替えと削除」。この Phase は段階7 の再生成の直しと言い換えのテスト。一覧と操作は Phase 109 の画面の純粋関数(API は増やさない)(推奨どおり) |
| 3 | 確認事項を戻す時点 | CR の反映の時点。文が変わった対象の要件の確認済みを未確認に戻し、CR の番号を残す。共有リンクで合意した CR も同じ(推奨どおり) |
| 4 | 起点の種類 | 段階1 の処理を足す(推奨どおり) |
| 5 | DFD・データ辞書の直しの判定 | 保存の記録(`regenerated` も `reviewing` へ)(推奨どおり) |
| 6 | 巡回で消えた版の戻し | 消すときに小さな表へ写す(推奨どおり) |
| 7 | 束の一覧の入れた CR | 束の応答に足す(推奨どおり) |

Claude の判断(計画の承認で確定、または実装中):

- 段階7 の直しは `normalize_plan` に入れず、別の関数 `drop_unknown_functions` にした(簡易モードの作業単位も `normalize_plan` を使い、そちらには機能一覧が無いため)。
- 実装中: 確認事項の戻しの対象から、反映で消えた行を除いた(消えた行の項目は一覧に出ず、戻すと見えない未確認になるだけのため)。却下の記録も戻さない。
- 確認事項の戻しは `DocGeneratorService` から `ConfirmationRepository` を直接使う(`ConfirmationService` は `DocGeneratorService` を使うので、逆に呼ぶと循環 import になる)。
- 状態を決め直すと CR の番号を消す。メモだけの保存では消さない。
- 巡回の写しは CR の番号を持たない(巡回で消えるのは CR を反映していない版だけ)。表を足す前に消えた分は戻らない。
- 束の応答の入れた CR は、ORM の行から作ったスキーマに `with_included` で足す(束の行に CR への関係が無いため)。
- 起点の処理の説明書の名前・反映の指示は、表示名から作る今の形のまま(コードの変更なし)。
- テンプレートから取り込むものは無い。

推奨と違った選択は0件。計画の差し戻しは無し。#39 の材料。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-106-1.md`](./Phase-106-1.md) | 段階の参照の切れ(段階7 の再生成・言い換えでの確かめ) | あり(本体 3 + テスト 3) | なし |
| [`Phase-106-2.md`](./Phase-106-2.md) | CR の反映で確認事項を未確認に戻す | あり(本体 6 + マイグレーション 1 + テスト 4。新規 1) | なし |
| [`Phase-106-3.md`](./Phase-106-3.md) | DFD・データ辞書だけを直した承認の印 | あり(本体 1 + テスト 2) | なし |
| [`Phase-106-4.md`](./Phase-106-4.md) | 巡回で消えた版の戻しの履歴 | あり(本体 4 + マイグレーション 1 + テスト 1。新規 2) | 106-2(マイグレーションの順) |
| [`Phase-106-5.md`](./Phase-106-5.md) | 起点の種類と、束に入れた CR | あり(本体 8 + テスト 3) | なし |

## サンプルコード一覧

`textbook/samples/backend/`。

- 106-1: `app/detailed_design/plan.py`・`__init__.py`、`app/services/design_stage_generation_service.py`、`tests/unit/test_plan.py`・`test_design_stage_plan_generation.py`・`test_paraphrase.py`(更新)。
- 106-2: `alembic/versions/f3b7d9a2c514_add_confirmation_changed_by_change_request.py`(新規)、`app/confirmations/items.py`・`__init__.py`、`app/models/confirmation.py`、`app/repositories/confirmation.py`、`app/schemas/confirmation.py`、`app/services/doc_generator_service.py`、`tests/unit/test_confirmation_items.py`・`test_confirmation_repository.py`・`test_confirmation_service.py`・`test_change_request_reflection.py`(更新)。
- 106-3: `app/services/design_stage_service.py`、`tests/unit/test_design_stage_reopen.py`・`test_design_stage_impact.py`(更新)。
- 106-4: `app/models/pruned_protection.py`・`alembic/versions/a9c2e4f6b318_add_pruned_protections.py`(新規)、`app/models/__init__.py`、`app/repositories/generated_document.py`、`app/services/agreement_service.py`、`tests/unit/test_agreement_history_service.py`(更新)。
- 106-5: `app/change_requests/prediction.py`、`app/models/change_request.py`、`app/schemas/change_request.py`・`baseline.py`、`app/repositories/change_request.py`、`app/services/baseline_service.py`・`change_request_service.py`、`app/api/routes/baselines.py`、`tests/unit/test_change_request_prediction.py`・`test_change_request_origins.py`・`test_change_request_trace.py`(更新)。
- 更新したファイルは `tagmerge.py` で当てた。どのファイルも1つの章だけが触るので、章の振り分けは要らなかった(章の終わりごとに本体の形を保存し、ファイルごとの章を確かめた。後から入れた `ruff` の行の長さの直しは整形なので、元の章に含めた)。docstring の記録の行(25ファイル)は道具の案を元に手で書き、道具が「samples とずれている」として当てなかった docstring 3か所(`generated_document.py`・`design_stage_service.py`・`test_design_stage_reopen.py`)は手で直した。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 作成・更新するファイル | 責務(1行) | テスト観点 |
|---|---|---|---|
| 106-1 | `plan.py`・`__init__.py` | 機能一覧に無い処理 ID を計画から外す | 外す・タスクとキーは残す・元は変えない |
| 106-1 | `design_stage_generation_service.py` | 段階7 の再生成で外す | AI が書いた機能一覧に無い ID が残らない |
| 106-1 | `test_paraphrase.py` | 言い換えた段階1 に対する後の段階の参照 | 切れない・消した処理は切れる |
| 106-2 | `confirmations/items.py`・`__init__.py` | 文が変わった対象の要件のキー | 対象だけ・同じ文・新しい行・消えた行 |
| 106-2 | `models/confirmation.py`・マイグレーション・`repositories/confirmation.py` | 確認済みを戻し、CR の番号を残す | 確認済みだけ・メモが残る・決め直すと消える |
| 106-2 | `schemas/confirmation.py`・`doc_generator_service.py` | 反映で戻し、一覧に番号を出す | 対象だけ戻る・共有リンクの合意でも戻る |
| 106-3 | `design_stage_service.py` | 段階の外の保存で、生成のままの段階もレビュー中に | データ辞書で段階2・構成図で段階4 の承認の印 |
| 106-4 | `models/pruned_protection.py`・`__init__.py`・マイグレーション | 巡回で消えた版の戻しの写し | `alembic check`・往復 |
| 106-4 | `repositories/generated_document.py`・`agreement_service.py` | 消す前に写し、履歴で合わせて読む | 戻しのある版だけ写る・履歴に出る |
| 106-5 | `prediction.py` ほか docstring 4ファイル | 起点に段階1 の処理 | 候補・予測の項目・説明書の名前・書き換えてよい要素に入らない |
| 106-5 | `repositories/change_request.py`・`schemas/baseline.py`・`baseline_service.py`・`routes/baselines.py` | 束の応答に入れた CR | 作成・一覧・中身・入れていない束は空 |

## 写経順序(#23)

章番号順。各章の「作成・更新したファイル」表は依存順に並べた(#30)。マイグレーションは 106-2(`f3b7d9a2c514`)→ 106-4(`a9c2e4f6b318`)の順に積む。

実 import 監査(#15)として、各ファイルの全 import 文を読んだ。import 先のモジュールとシンボルの誕生章が、そのファイルの章以下であることを確かめた。

- `plan.py`(106-1)→ `Iterable`(既存の import)。`__init__.py`(106-1)→ `drop_unknown_functions`(106-1)。`design_stage_generation_service.py`(106-1)→ `drop_unknown_functions`(106-1)。
- `confirmations/items.py`(106-2)→ import を足していない。`__init__.py`(106-2)→ `changed_requirement_keys`(106-2)。`models/confirmation.py`(106-2)→ `Integer`(SQLAlchemy)。`repositories/confirmation.py`(106-2)→ `Sequence`(標準)。`doc_generator_service.py`(106-2)→ `changed_requirement_keys`(106-2)・`ChangeRequest`・`ConfirmationRepository`・`targets_from_json`(既存)。
- `design_stage_service.py`(106-3)→ import を足していない。
- `models/pruned_protection.py`(106-4)→ SQLAlchemy・`Base`・`PortableJSON`(既存)。`models/__init__.py`・`repositories/generated_document.py`(106-4)→ `PrunedProtection`(106-4)。`agreement_service.py`(106-4)→ import を足していない。
- `schemas/baseline.py`(106-5)→ `Self`(標準)。`routes/baselines.py`・`baseline_service.py`・`repositories/change_request.py`(106-5)→ import を足していない。
- テスト: `test_paraphrase.py`(106-1)→ `app.detailed_design` の既存の名前。`test_plan.py`(106-1)→ `drop_unknown_functions`(106-1)。`test_change_request_reflection.py`(106-2)→ `ConfirmationItem`・`ConfirmationRepository`・`SharedDecisionCreate`・`ShareLinkCreate`・`ShareLinkService`(既存)。`test_confirmation_items.py`(106-2)→ `changed_requirement_keys`(106-2)。`test_design_stage_reopen.py`(106-3)→ `DesignStageRepository`(既存)。`test_agreement_history_service.py`(106-4)→ `PrunedProtection`(106-4)・`MAX_VERSIONS_PER_DOC_TYPE`(既存)。`test_change_request_trace.py`(106-5)→ `get_baseline`・`list_baselines`(既存)。

各章のテストは、その章で作成・更新した全ファイルを少なくとも1度 import する(#15)。106-1 の `plan.py`・`__init__.py` は `test_plan.py`、生成のサービスは `test_design_stage_plan_generation.py`。106-2 のモデル・リポジトリは `test_confirmation_repository.py`、スキーマは `test_confirmation_service.py`、`doc_generator_service.py` と `items.py` は `test_change_request_reflection.py`・`test_confirmation_items.py`。106-3 は `test_design_stage_reopen.py`・`test_design_stage_impact.py`。106-4 のモデル・リポジトリ・サービスは `test_agreement_history_service.py`。106-5 の `prediction.py` は `test_change_request_prediction.py`、モデル・スキーマ・サービス・ルートは `test_change_request_origins.py`・`test_change_request_trace.py` が通す。マイグレーションは `alembic check` と往復で確かめた(テストは import しない)。

## 検証結果

- ユニット: 章ごとに章のテストと、関わるテスト(確認事項・束・起点・履歴・段階の生成と差し戻し)を流した。
- devex-api: `ruff check`(app・tests): 通った。`pyright`(触ったファイル): 0 件。`ruff format` は使っていない(import の並びだけ `ruff check --select I --fix`)。
- 全体テスト: devex-api はユニット 1892 件・統合 42 件(専用のテスト DB)がすべて通った。devex-ui は変えていないので流していない。
- マイグレーション: リビジョン ID の重なりが無く head が1つであることを確かめてから、開発 DB に `alembic upgrade head`(`e8f2a4b6c913` → `f3b7d9a2c514` → `a9c2e4f6b318`)。`e8f2a4b6c913` への downgrade と upgrade の往復、`alembic check`(差分なし)も通った。
- 開発 DB の md: この Phase は文書・説明書の md を作る規則を変えていない(起点の種類を足しただけで、今の CR の起点は要件・画面・API だけなので、予測と説明書は変わらない)。そのため sha256 の比べ直しはしていない。
- `textbook/tools/samples_check.py --api-since 6209bd7 --ui-since phase-99`: 不一致 0・本体のみ 0(一致 1027 / 並び順のみ差 8 / 例外 5)。
- `textbook/tools/link_check.py`: リンク切れ 0 件。
- 実 LLM: 使っていない(費用 0)。E2E: 流していない(Phase 110)。

## 未消化の申し送り(#37)

[Phase 105](../Phase-105/Phase-105-introduction.md#未消化の申し送り37) から引き継いだもの。

**ステージ13 の中で扱うもの**(行き先は [100-4](../Phase-100/Phase-100-4.md)):
- **規模・要約・選択肢・共有リンクの画面**(P101〜P104)→ Phase 107。そのまま。
- **クライアントの画面**(P103・P104)→ Phase 108。そのまま。
- **コメントの削除・編集**(P104)→ Phase 107〜109 の画面確認で、要るかを決める。
- **段階2・3・7 の機能一覧に無い処理の一覧**(この Phase で API の側を済ませた)→ Phase 109。段階5 の `StrayProcedureTable` と同じ形(付け替え・削除)で、devex-ui の純粋関数が段階1 の機能一覧と比べる。段階2(処理概要表の行・`dfd_groups` のグループ)・段階3(CRUD のセル)は今は画面に出ないので、一覧が唯一の直し方になる。段階7 は自由入力でも直せる。
- **確認事項の「CR-n で変わった」の表示**(この Phase で API ができた)→ Phase 109。`changed_by_change_request_number` を一覧の行に出し、CR へのリンクを付ける。
- **起点の欄の処理**(この Phase で API ができた)→ Phase 109。起点の候補(`GET .../baselines/{number}/origins`)に `kind = function` が入る。
- **束の一覧の入れた CR**(この Phase で API ができた)→ Phase 109。`includedChangeRequests`(CR の一覧から引く)を、束の応答の `included_change_requests` に切り替える。
- **束の段階が古いと、予測が少なく出る**(P100)→ 束を作り直すかは開発者の運用で、Phase 110 の新しい CR の前に決める(残す)。
- **Phase 110 の新しい CR の題材**: 選択肢が自然に2つ以上ある変更(100-4)。下書きを実 LLM で作るなら、費用の見積もりを計画に出す。E2E に共有リンクの流れの spec を足す(閲覧・コメント・合意。認証なしの入口は、開発用の上限1000回の中で流す)。
- **言い換えの E2E の spec**(P105)→ Phase 110。そのまま。
- **実 LLM が利用者の `prev_id` を書くか**(P105)→ Phase 110 の効果測定。そのまま。

**ステージ13 の範囲の外**:
- **使い勝手(主に UI)の見直し**: ステージ13 の後に回す。
- **本番への反映と本番での確認**: ステージ15 の完了時に、[`OPERATIONS.md`](../../devex-api/OPERATIONS.md) 10.8節で行う。マイグレーション `a7c3e5d91f20`(P102)・`c5d8e2f4a613`(P103)・`d7e1f3a5b802`・`e8f2a4b6c913`(P104)に加えて、この Phase の `f3b7d9a2c514`・`a9c2e4f6b318` を 10.8節に入れる(Phase 110)。Phase 101 の説明書の md の変化で、以前の要約がすべて「古い」になること、本番の `.env` に共有リンクの上限を置かないこと、確認事項の古いキー(`user:<名前>`)の付け直し(P105)も 10.8節に書く(Phase 110)。この Phase の分の確認の表: 巡回で消えた版の戻しは、反映より前に消えた分は戻らない(履歴に出ないのは正常)。
- **要約・選択肢の下書きの生成の回数の上限**: 使われ方を見て決める。
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
- `tagmerge.py` の、複数の章が触るファイルの章の振り分け(振り返り 17.7)と、メソッドの中身を移す変更の扱い(P104)。P105 の「前の章の終わりの形を挟んで2回に分けて当てる」を手順に書くかは振り返りで決める。この Phase は、章の終わりごとに本体の形を保存しておき、ファイルごとにどの章が触ったかを機械的に確かめた(どれも1章だけだった)。この確かめも手順の候補にする。docstring が「samples とずれている」として当たらないもの(3か所)は、samples の docstring に過去の Phase の注記があるため。

**ユーザーが決めるもの**:
- **開発環境の後始末**: 確認用の利用者・プロジェクト。「トレンド追跡アプリ」は Phase 110 の効果測定の題材なので残す(この Phase では触っていない)。
- **この Phase の未コミット**: 外側のリポジトリ(教材・docs・samples・q_a)・devex-api。devex-api のタグ `phase-101`〜`phase-106` も未作成。コミットはユーザーが行う(#35)。
- **前の Phase のコミットの題**: 外側 `1da37ba`・devex-api `6209bd7` の題は Phase 106 の題だが、中身は Phase 105。直すかはユーザーが決める。

**この Phase で解決したもの**:
- **CR で書き換えた行の確認事項の状態**(P99)→ [106-2](./Phase-106-2.md)(API。表示は Phase 109)。
- **段階2・3・7 の処理 ID の参照の切れ**(P99)→ [106-1](./Phase-106-1.md)(段階7 の再生成と言い換えの確かめ。一覧は Phase 109)。
- **生成で作り直したまま、DFD・データ辞書だけを直した承認**(P99)→ [106-3](./Phase-106-3.md)。
- **巡回で消えた版の戻しの履歴**(P95)→ [106-4](./Phase-106-4.md)。
- **起点に選べる要素の種類**(P96)→ [106-5](./Phase-106-5.md)(API。欄は Phase 109)。
- **束の一覧の入れた CR**(P88)→ [106-5](./Phase-106-5.md)(API。画面の切り替えは Phase 109)。
- Phase 106 の未確定事項(100-4)→ 「着手時の相談で決めたこと」。

**この Phase で生まれたもの**:
- 上の Phase 109 の4項目の API の形と、10.8節の確認の表の1行。
- **セッションの区切りの記録**: Phase 106 は2セッションで行った(1セッション目は使用量の上限で 106-5 の途中で止まった)。
  1. 計画モードで調査(調べるエージェント2つを並行で使った)・質問2回(4問・3問)・計画の承認
  2. 106-1〜106-4 の実装とテスト、106-5 の起点と束の入れた CR の実装(1セッション目はここまで)
  3. `ruff` の直し・束の入れた CR のテスト・全体テスト・pyright・開発 DB のマイグレーション(2セッション目)
  4. samples(`tagmerge.py`)
  5. docs・教材

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

設問は Phase の要点の要約である(回答は求めない)。

1. 段階2・3・4 の再生成では切れた ID が残らないのに、段階2・3 の切れが画面で直せなかったのはなぜか。段階7 の直しを `normalize_plan` に入れなかったのはなぜか。
2. CR の反映で確認事項を戻すとき、対象の要件だけを見て、消えた行と却下を除いたのはなぜか。共有リンクで合意した CR でも戻すのはなぜか。
3. DFD・データ辞書の直しを「人が直した」とみなす判定を、版の比較でなく保存の記録にしたのはなぜか。
4. 巡回で消える版を残さず、戻しの記録だけを写したのはなぜか。写しが CR の番号を持たないのはなぜか。
5. 起点に処理を足しても、反映で書き換えてよい要素が変わらないのはなぜか。
