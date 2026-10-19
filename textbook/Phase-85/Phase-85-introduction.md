# Phase 85 導入: 反映(ステージ11)

## 目的

ステージ11(合意と変更の一巡)の5つ目の実装 Phase。[80-4](../Phase-80/Phase-80-4.md) の Phase 85 として、合意した CR を、設計レビューの採用した指摘(`finding_ids`。Phase 54)と同じ経路で再生成の指示に入れる(`cr_number`)。生成の版(文書の版・段階の下書き)に CR と生成したモデルを残し、文書の再生成が終わったら CR を自動で「反映済み」にする。反映で付いた印を CR に写し、判断の時点で保存した予測([Phase 83](../Phase-83/Phase-83-introduction.md))と並べる([外部設計書](../../docs/external_design.md) 2.14節「反映」、[内部設計書](../../docs/internal_design.md) 3.3節 11項)。

- CR の修正指示と遷移の表 ── [85-1](./Phase-85-1.md)
- 文書への反映 ── [85-2](./Phase-85-2.md)
- 段階への反映 ── [85-3](./Phase-85-3.md)
- 予測と実際の比較 ── [85-4](./Phase-85-4.md)

## パイプライン上の位置づけ・前提

```
CR-1(合意。予測を保存済み ← Phase 83)
   │
   ▼ POST /projects/{id}/generate {start_from: "requirements", cr_number: 1}          ──[85-2]
   受け付け: reflectable(合意・反映済みだけ。テスト仕様書だけは不可)→ generating
   裏の生成: reflection(非 strict)→ 指示 = join_instructions([指摘, build_cr_instruction])  ← 85-1
     要件定義書・外部設計書を作り直す(版に change_request_id・generated_model)
     record_document_change(出どころに cr:1)→ 付いた印
     record_document_apply: agreed → applied、時系列 apply {documents, model}、applied_impact に印
   │
   ├ POST /design-stages/{stage}/generate {cr_number: 1}(反映済みだけ。段階ごと)        ──[85-3]
   │   下書きに generation_change_request_id・generated_model、時系列 apply {stage, version, model}
   │
   ▼ GET .../change-requests/1/comparison                                               ──[85-4]
     compare(保存した予測, applied_impact, 承認した段階)→ 一致 / 予測だけ(文書の側・未承認の段階・
     届かなかった)/ 実際だけ
     Phase 86: 印の確認と検証済み・結んだレビュー・時系列の API
```

- **前提として読むもの**: [80-4](../Phase-80/Phase-80-4.md)(Phase 85 の未確定事項)・[83-3](../Phase-83/Phase-83-3.md)(予測の保存)・[84-3](../Phase-84/Phase-84-3.md)(`facts_of`・`_impact_with_baseline`)。指摘の経路は [`app/review/sendback.py`](../samples/backend/app/review/sendback.py)・`DocGeneratorService.generate`・`DesignStageGenerationService.execute`。印は [`app/detailed_design/impact/marks.py`](../samples/backend/app/detailed_design/impact/marks.py)(Phase 43)。
- **今の仕組み**: 文書の再生成は前の版の差分にとどまり(Phase 70)、表示中の版が切り替わると、前の版との差分から段階に印を付ける(出どころ `doc:<種類>`)。印は一度でも承認した段階にだけ付き、段階を承認すると消える。画面・API(文書の側の要素)には印が付かない([80-2](../Phase-80/Phase-80-2.md))。
- **この Phase を始めた時点の状態**: devex-api の HEAD は `8a25d3e`(Phase 84)、外側のリポジトリは `1f12deb`。alembic の head は `fee4fbc2a00c`。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(本体 + samples)。

E2E: この Phase では流さない(画面を変えないため。ステージ11 の E2E は Phase 89 で既存を含めて全部流す)。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 85 開始時」を参照。計画モードで1回(4問)聞いた。

| # | 問い | 決定 |
|---|---|---|
| 1 | 自動実装モード | on(推奨どおり) |
| 2 | 反映の範囲(再生成の起点) | 文書(要件定義書から)と段階の両方に CR を渡す。段階は開発者が段階ごとに押す(推奨どおり) |
| 3 | 「反映済み」への遷移とやり直し | CR を渡した文書の再生成の成功で自動。反映済みの間もやり直せ、そのたびに時系列に1行(推奨どおり) |
| 4 | 予測と実際の比較の表し方 | 両方を並べる(一致 / 予測だけ / 実際だけ。文書の側は分ける)(推奨どおり) |

Claude の判断(計画の承認で確定、または作業中):

- 本文の項目は **`cr_number`**(仕様の `cr_id` から変えた。CR の API はどこも番号で指し、応答に UUID を出していないため)。計画の承認の前の決定なので #40 の CR ではなく、q_a の「Phase 85 開始時」に記した。
- 受け付けは strict(無ければ 404、文書は合意・反映済み、段階は反映済みでなければ 409 `CR_NOT_REFLECTABLE`)、裏の生成は非 strict(反映できなくなった CR は渡さず、記録もしない)。指摘と同時に渡してよい。テスト仕様書だけの生成には渡せない(作業中に足した)。
- 指示は文書・段階ごとに絞らない(CR は要件が起点)。指摘の指示と空行で並べる。
- 遷移の表の `apply` に `applied → applied` を足す。段階の反映も `apply` の行(補足で段階を示す)。
- 時系列に `refs`(JSON)を足す。Phase 86 でレビューの参照を同じ列に足す。
- 比較は今の `design_stages.impact` でなく、反映のときに付いた印の写し(`change_requests.applied_impact`)で行う(段階の印は承認で消えるため)。印の出どころに `cr:<番号>` を足す(Phase 86 の確認で使う)。
- 段階にも直近の生成の CR とモデル名の列を足す(文書の版の Phase 81 の列と対)。
- 予測だけには理由(文書の側・承認していない段階・差分が届かなかった)を付ける。反映の前の比較は 409 `CR_NOT_APPLIED`。
- CR が合意・反映済みの間も、CR なしの生成は止めない(その印は `cr:` を持たず、比較に入らない)。
- マイグレーションは1本(`f9c9614d5329`)。テンプレートから取り込むものは無し。
- **作業中**: 段階の読み出しで CR を引くのは、サービスでなくリポジトリにした(`DesignStageService` から `ChangeRequestService` を import すると、`BaselineService` を通して循環するため)。
- **作業中**: 段階の承認で付く印を CR に結ぶかは Phase 86 に回した(検証の条件と一緒に決める)。
- **作業中**: 文書の版の応答(`GeneratedDocumentRead`)には CR の番号を出していない(版と CR の結び付きは時系列の `refs` で読める。画面で要ると分かったら Phase 87・88 で足す)。

推奨と違った選択は0件。計画の差し戻しは無し。#39 の材料。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-85-1.md`](./Phase-85-1.md) | CR の修正指示と遷移の表 | あり(本体 3 + テスト 2) | 84-2(`ChangeRequestFacts`)・83-1(`TARGET_KIND_LABEL`) |
| [`Phase-85-2.md`](./Phase-85-2.md) | 文書への反映 | あり(本体 14 + マイグレーション 1 + テスト 2) | 85-1(`build_cr_instruction`・`join_instructions`・渡せる状態) |
| [`Phase-85-3.md`](./Phase-85-3.md) | 段階への反映 | あり(本体 5 + テスト 2) | 85-2(`reflectable`・`reflection`・段階の列) |
| [`Phase-85-4.md`](./Phase-85-4.md) | 予測と実際の比較 | あり(本体 6 + テスト 3) | 85-2(`applied_impact`)・Phase 83(`Prediction`) |

## サンプルコード一覧

`textbook/samples/backend/` の新規・更新:

- 85-1: `app/change_requests/instruction.py`(新規)・`app/change_requests/states.py`・`app/change_requests/__init__.py`・`tests/unit/test_change_request_instruction.py`(新規)・`tests/unit/test_change_request_states.py`
- 85-2: `alembic/versions/f9c9614d5329_add_change_request_reflection.py`(新規)・`app/models/{generated_document,change_request,design_stage}.py`・`app/repositories/{generated_document,change_request}.py`・`app/schemas/document.py`・`app/schemas/change_request.py`・`app/services/errors.py`・`app/detailed_design/impact/marks.py`・`app/detailed_design/impact/__init__.py`・`app/services/design_stage_service.py`・`app/services/change_request_service.py`・`app/services/doc_generator_service.py`・`app/api/routes/projects.py`・`tests/unit/test_change_request_reflection.py`(新規)・`tests/unit/test_doc_generation_start.py`
- 85-3: `app/schemas/design_stage.py`・`app/services/change_request_service.py`・`app/services/design_stage_service.py`・`app/services/design_stage_generation_service.py`・`app/api/routes/design_stages.py`・`tests/unit/test_change_request_stage_reflection.py`(新規)・`tests/unit/test_design_stage_generation.py`
- 85-4: `app/change_requests/comparison.py`(新規)・`app/change_requests/__init__.py`・`app/services/errors.py`・`app/schemas/change_request.py`・`app/services/change_request_service.py`・`app/api/routes/change_requests.py`・`tests/unit/test_change_request_comparison.py`(新規)・`tests/unit/test_change_requests_api.py`・`tests/integration/test_change_requests_flow.py`
- ミラーしないもの(#21 の共通): 無し(インフラ・設定ファイルは変えていない)。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| [85-1](./Phase-85-1.md) | `instruction.py`・`states.py` | CR の値から修正指示の文を作り、指摘の指示と並べる。反映のやり直しと渡せる状態を表に置く | 種類ごとの行・新しい要件・空の指示・やり直しの遷移 |
| [85-2](./Phase-85-2.md) | マイグレーション・`ChangeRequestService`・`DocGeneratorService`・`marks.py` | 文書の再生成に CR を渡し、版に CR を残し、反映済みにし、印を写す | 指示・版・時系列・印の出どころ・写し・やり直し・404/409・非 strict |
| [85-3](./Phase-85-3.md) | `DesignStageGenerationService`・`DesignStageRead` | 段階の生成に反映済みの CR を渡し、下書きに CR とモデル名、時系列に1行 | 指示・応答・時系列・合意だけは 409・CR なしで外れる |
| [85-4](./Phase-85-4.md) | `comparison.py`・比較の API | 保存した予測と反映で付いた印を、一致 / 予測だけ(理由つき)/ 実際だけに分ける | 分類と理由・壊れた写し・反映の前は 409・実際の PostgreSQL |

## 写経順序(#23)

章番号順(85-1 → 85-2 → 85-3 → 85-4)。各章の表の順(依存順。#30)に写す。

- 85-2 はマイグレーションを先に写し、`alembic upgrade head` を流してから API を動かす。段階の2列も 85-2 のマイグレーションで足す(使うのは 85-3)。
- 85-2 の `change_request_service.py` は、反映の部分(`reflectable`・`reflection`・`record_document_apply`・`merge_applied_marks`)だけを写す。`record_stage_apply` は 85-3、比較(`APPLIED_STATUSES`・`ComparisonView`・`comparison`)は 85-4 で写す(samples のタグで分けてある)。
- 85-3 の `design_stage_service.py` は読み出しの部分だけ(85-2 で `record_document_change` を写した後)。

実 import 監査(#15。全 import 文を読んで確かめた):

- 85-1: `instruction.py` → `explanation.ChangeRequestFacts`(84-2)・`targets.TARGET_KIND_LABEL`(83-1)。`__init__.py` → `instruction`・`states` の2つの表(この章)。テスト → この章のものと `Target`(83-1)。
- 85-2: モデル → 既存の `Base`・`PortableJSON`。リポジトリ → モデル(この章)。`marks.py` → 変更なし(関数を足しただけ)。`design_stage_service.py` → `Mark`(既存)。`change_request_service.py` → `DOCUMENT_REFLECTABLE_STATUSES`・`STAGE_REFLECTABLE_STATUSES`・`build_cr_instruction`(85-1)・`DOCUMENT_LABEL`(84-2)・`Mark`(既存)・`ChangeRequestNotReflectableError`(この章、表で先に置く)。`doc_generator_service.py` → `join_instructions`(85-1)・`Mark`・`cr_source`・`ChangeRequestService`・`ChangeRequestNotReflectableError`(この章)。スキーマ → `pydantic.Field`。テスト → この章のものと既存の fixture・`FakeLLM`。
- 85-3: スキーマ → 既存のみ。`design_stage_generation_service.py` → `join_instructions`(85-1)・`ChangeRequestService`(85-2)・`injected_llm`(既存)。`design_stage_service.py` → `ChangeRequest`(Phase 82)・`ChangeRequestRepository`(Phase 82)・`change_request_label`(Phase 82)・`GenerationChangeRequestRead`(この章、表で先に置く)。テスト → この章のものと 85-2 までのもの。
- 85-4: `comparison.py` → `Prediction`(83-2)・`DOCUMENT_STAGE`(既存)。スキーマ → `comparison` の型と表(この章)。サービス → `Comparison`・`applied_marks_from_json`・`compare`(この章)・`DesignStageRepository`(既存)・`ChangeRequestNotAppliedError`(この章)。ルート → `ChangeRequestComparisonRead`(この章)。テスト → この章のものと既存の fixture。

前方 import は無い。各章が作成・更新した本体のファイルは、その章のテストが import する(マイグレーションは往復の実行で確かめた)。

## 検証結果

- 章ごとの部分テスト: 85-1 は 26件、85-2 は CR・文書の生成・段階・印のテスト(484件)、85-3 は段階の生成(31件)と段階の反映(5件)、85-4 は比較と CR のルート(9件)。すべて成功。
- Phase 完了時の全体テスト(#18): devex-api **1604 件成功**(31 件は integration で除外。Phase 84 から 24 件増えた ── 指示 3・遷移 3・文書の反映 10・段階の反映 5・比較 3)。integration **31 件成功**(既存を含む全部。実際の PostgreSQL と Redis。反映と比較の流れの1件を足した)。devex-ui は変えていないので流していない。
- `ruff check`(app・tests・alembic)成功(`ruff format` は使わない)。`uvx pyright`(変えた本体のファイルとテスト): 0 件。
- マイグレーション: リビジョン ID の衝突なし・head は1つ(`f9c9614d5329`)。使い捨ての DB で `upgrade head` → `alembic check`(差なし)→ `downgrade fee4fbc2a00c` → `upgrade head` の往復を確かめ、DB を消した。dev の DB は `upgrade head` だけ。
- `samples_check.py`(`--api-since HEAD`): 一致 848・並び順のみ差 8・例外 5、「samples のみ」「本体のみ」0件。
- `link_check.py`: リンク切れ 0 件。
- 実 LLM: 呼んでいない(費用 0。生成はフェイクで確かめた)。

## 未消化の申し送り(#37)

[Phase 84](../Phase-84/Phase-84-introduction.md#未消化の申し送り37) から引き継いだもの。

**ステージ11 の中で扱うもの**:
- **`gemini-3.1-flash-lite` の終了(2027-05-07 以降)** → Phase 88。その時点の後継のモデルを確かめて、カタログを入れ替える。
- **`devex-api/postgres-init/01-create-test-db.sh` の構文の誤り**(新しいボリュームで、テストの DB が作られない)→ Phase 88。テンプレートで直した形(標準入力から渡す)を取り込む。
- **文書の側の要素の確認**: 今の再生成の印は、画面と API に付かない([80-2](../Phase-80/Phase-80-2.md))→ Phase 86。比較では「予測だけ(文書の側)」と分けて示すようにした([85-4](./Phase-85-4.md))。Phase 86 では、これを検証の確認の項目にするかを決める。
- **止まった段階の生成と束**(Phase 81)→ Phase 88 の画面確認。
- **一覧の応答の大きさ**(Phase 81)→ Phase 88。
- **Phase 86〜89 の未確定事項**: [80-4](../Phase-80/Phase-80-4.md)「未確定事項」(81〜85 の分は解決)。
- **検証済みの API** → Phase 86。遷移の表(`verify`)はある。時系列にレビューの参照(`refs`)を足す。
- **CR の列の追加** → Phase 86(結んだレビュー)。
- **写しの元の基準の束**: 写しは元の CR の基準の束をそのまま使う。運用で困るかを Phase 87 の画面で確かめる。
- **下書きの中の直しは時系列に残さない**: 必要ならステージ12(行単位の変更の履歴)で扱う。
- **変更の種類と案の画面の入力** → Phase 87。対象ごとに種類と案を入れる形(削除では案の欄を出さない)。
- **予測・説明書の応答の大きさ**: 要素は数十〜百程度で、まとめて返している。画面で重いと分かったら、Phase 87・88 で絞り方を決める。
- **説明書のプレビューと要約の確認の画面** → Phase 88。照合で合わない所の印の出し方、元の文と直した文の並べ方、「古い」の表示。
- **要約の質** → Phase 89 の効果測定で、実 LLM で1回作って確かめるか(費用の見積もりを出す)。
- **要約を直した人**: 記録していない(確かめた人だけ)。画面で要ると分かったら Phase 88 で列を足す。
- **要約の生成の回数の上限**: 置いていない(文書の生成と同じ)。既定のキーで使われすぎると分かったら決める。

**この Phase で生まれたもの**(ステージ11 の中で扱う):
- **段階の承認で付く印と CR** → Phase 86。CR を渡して作り直した段階を承認したときの印を CR に結ぶか(出どころに `cr:` を足すか、`applied_impact` に重ねるか)を、検証の条件と一緒に決める。今は文書の反映で付いた印だけが CR に結ばれる([85-3](./Phase-85-3.md))。
- **比較の確認の状態**: 比較の `reviewed` は写しの時点の値(ふつうは未確認)。人が今の印を確かめた状態を比較・検証にどう出すかを Phase 86 で決める([85-4](./Phase-85-4.md))。
- **反映のボタンと比較の画面** → Phase 87。文書の再生成と段階の生成に CR を選ぶ所、比較の3分類の見せ方。`allowed_actions` の `apply` は画面のボタンにしない(再生成で起きる)。
- **文書の版の応答に CR を出すか**: 今は出していない(時系列の `refs` で読める)。画面で要ると分かったら Phase 87・88 で足す。
- **反映を実 LLM で通すか** → Phase 89(80-4 の未確定事項のまま)。今は偽の LLM でしか通していない。

**ステージ11 の範囲の外**(行き先は [80-1](../Phase-80/Phase-80-1.md) の表):
- 振り返り 6節の残り7件:
  - ステージ12: 推測の採用率・決める機会
  - ステージ15 の前後: 前提作業・戻し方・版の一致
  - ヒアリングを扱うステージ: 認証の対の問い・基本機能の観点
- **生成の質の候補4件**: 再生成のきっかけの残り(Phase 70)・設計に無いテスト(Phase 70)・日本語の名前のデータストア(Phase 71)・語の表の範囲(Phase 71)。
- **新しい要件を足す CR の予測の起点を人が選ぶ形**(Phase 83 で見送った): 必要が分かってから(ステージ12 以降)。
- **規模の集計と選択肢つきの説明**: ステージ13。

**持ち越し**(触るときに直す。中身は [振り返り](../retrospectives/project-retrospective.md) 8節):
- `test_chat_service.py` などの pyright の指摘(Phase 40)
- devex-ui の並列のテストのタイムアウト(Phase 44)
- 偽 LLM の外部設計書の GET に DF が無い(Phase 45)
- `DfdEditorTabs` のテストのまれな失敗(Phase 77)
- Google の公開鍵を毎回取りに行く(Phase 74)
- `ListCard` の入れ物(Phase 79。テンプレートでは直した)
- 英語のままの refresh の失敗の文(Phase 79)
- `tagmerge.py` の手直し(ステージ10 の振り返り)。この Phase は `tagmerge.py` で25本に当て、import 文・docstring・ヘッダー・複数の章にまたがるファイルの章の振り分け(`change_request_service.py`・`design_stage_service.py`・`errors.py`・`schemas/change_request.py`・`__init__.py`)を手で直した。docstring の中にタグを差し込んで構文を壊した所が2つあった(`repositories/generated_document.py`・`schemas/design_stage.py`。`samples_check.py` の構文の読みで気づいて直した)。

**ユーザーが決めるもの**:
- **開発環境の後始末**: 確認用の利用者・プロジェクト、DB の事故の後の複製(振り返り 8節)。
- **この Phase の未コミット**: 外側のリポジトリと devex-api の変更。コミットはユーザーが行う(#35)。devex-api のタグは `phase-85`(`phase-81`〜`phase-84` もまだ無ければ、あわせて)。

**セッションの区切りの記録**: Phase 85 は1セッションで行った(計画 → 85-1〜85-4 の実装 → マイグレーションの往復 → 全体テストと integration → samples → docs → 教材)。

**この Phase で解決したもの**:
- **80-4 の Phase 85 の未確定事項**(再生成の起点・CR の内容を修正の指示にする形・やり直し・反映中のほかの生成・比較の表し方): 着手時の相談と [85-1](./Phase-85-1.md)〜[85-4](./Phase-85-4.md)。
- **反映済みの API**(Phase 82 から): 反映済みは CR を渡した文書の再生成で自動で付く([85-2](./Phase-85-2.md))。
- **CR の列の追加 ── 反映した版**(Phase 82 から): 文書の版の `change_request_id`・時系列の `refs`・`applied_impact`([85-2](./Phase-85-2.md))。
- **予測と実際の比較の起点**(Phase 83 から): 保存した予測を基準にした([85-4](./Phase-85-4.md))。

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

設問は Phase の要点の要約(回答は求めない)。

1. 受け付けで確かめた CR を、裏の生成でもう一度読み、反映できなければ黙って外すのはなぜか。裏で例外にすると何が起きるか。
2. 文書の再生成が成功したときに、版の追加・印・CR の遷移と時系列・印の写しを同じトランザクションに入れるのはなぜか。生成が失敗したとき、CR はどの状態に残るか。
3. 比較に今の `design_stages.impact` でなく、反映のときの印の写し(`applied_impact`)を使うのはなぜか。
4. 段階に渡せる CR を「反映済み」だけにしたのはなぜか。印はどこから生まれるか。
5. 「予測だけ」を3つの理由に分けるのはなぜか。分けないと、比較はどう見えるか。
6. 段階の読み出しで CR を引くのに、サービスでなくリポジトリを使ったのはなぜか(import の向き)。

## 次のフェーズ

**Phase 86**: 再検証とたどれる記録。CR に結んだ印がすべて確認済みなら「検証済み」にできる(`verify`)。任意のレビューを CR に結ぶ。受付から検証までの時系列(どの版・どの再生成・どのレビュー)の API。新しい合意済みの版を作る流れ。着手時に、自動実装モード(#21)と [80-4](../Phase-80/Phase-80-4.md) の Phase 86 の未確定事項(文書の側の要素の確認の扱い・検証済みの後の新しい束の既定の記録・レビューを結ぶ条件)と、この Phase の申し送り(段階の承認で付く印と CR・比較の確認の状態)を決める。
