# Phase 81 導入: 合意済みの版(束)の API(ステージ11)

## 目的

ステージ11(合意と変更の一巡)の最初の実装 Phase。[80-4](../Phase-80/Phase-80-4.md) の Phase 81 として、合意済みの版(束。B-1, B-2…)を API に作る([外部設計書](../../docs/external_design.md) 2.14節、[内部設計書](../../docs/internal_design.md) 3.2節⑭⑮・3.3節 11項)。CR は「合意済みの版からの差分」なので、基準になる束を先に作る。画面は Phase 88。

- 文書の版に、生成したモデル名を残す ── [81-1](./Phase-81-1.md)
- 束と写しの表・リポジトリ ── [81-2](./Phase-81-2.md)
- 束の作成・一覧・取得の API ── [81-3](./Phase-81-3.md)

## パイプライン上の位置づけ・前提

```
開発者「B-1 として合意を記録する」(画面は Phase 88)
   │
   ▼ POST /projects/{id}/baselines {counterpart, agreed_at, memo, reason}        ──[81-3]
   BaselineService.create
     ├ 詳細設計モードでない → 409 DESIGN_STAGES_NOT_AVAILABLE
     ├ 文書・段階の生成中 → 409
     ├ 要件定義書・外部設計書の表示中の版が無い → 409 BASELINE_DOCUMENTS_MISSING
     └ 写す: 文書3つ(表示中の版の md・model・生成したモデル名 ──[81-1])
             段階1〜8(approved_model と今の状態。写しが無ければ「入っていない」)
   ▼ BaselineRepository.create(番号 = 最大 + 1)                                 ──[81-2]
   baselines(番号・合意の記録) + baseline_items(写し 11 行)
   │
   ├ GET /baselines            新しい順。写しは要約だけ
   └ GET /baselines/{number}   写しの中身付き(Phase 83 の予測が、ここから要素を作る)
```

- **前提として読むもの**: [80-1](../Phase-80/Phase-80-1.md)(決定1・2・8 と Claude の判断)・[80-4](../Phase-80/Phase-80-4.md)(Phase 81 のスコープと未確定事項)・[外部設計書](../../docs/external_design.md) 2.14節。
- **今の仕組み**: 文書の版は種別ごとに直近3件で巡回する(`MAX_VERSIONS_PER_DOC_TYPE`)。段階は1行の中に承認の写し(`approved_model`。1件だけ)を持ち、上書きする。版に、生成したモデルは残らなかった。
- **この Phase を始めた時点の状態**: devex-api の HEAD は `cd5b1a9`、外側のリポジトリは `9c51f2c`。Phase 80 の分(docs・教材・測定)は外側のリポジトリで未コミットで、この Phase はその上に重ねた。alembic の head は `d7e2a9c4f1b3`。devex-api に git のタグ `phase-<N>` はまだ無い(ステージ10 までの分も含めて)。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(本体 + samples)。

E2E: この Phase では流さない(画面を変えないため。ステージ11 の E2E は Phase 89 で既存を含めて全部流す)。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 81 開始時」を参照。計画モードで1回(4問)聞いた。

| # | 問い | 決定 |
|---|---|---|
| 1 | 自動実装モード | on(推奨どおり) |
| 2 | 束を作れる条件 | 要件定義書・外部設計書がそろえば作れる。未承認・古い段階は、その状態を束に残す。生成中だけ 409(推奨どおり) |
| 3 | 作った束を直す・消す | 直せない・消せない。プロジェクトの削除でだけ消える。記録の誤りは新しい束で直す(推奨どおり) |
| 4 | 生成したモデル名の列を足す Phase | この Phase(推奨どおり。Phase 85 では `change_request_id` だけを足す) |

Claude の判断(計画の承認で確定、または作業中):

- テスト仕様書は、表示中の版があれば写す(無ければ「入っていない」)。80-1 の判断どおり。
- 合意の記録: 相手(NULL 可・200字)・合意の日時(必須・タイムゾーン付き。記録した日時と別)・メモ(空でもよい)・理由(必須)。記録した人(`users` への外部キー、SET NULL)と日時は自動。
- 番号はプロジェクトの中の連番(表示は `B-{number}`)。並行して作ったときは一意制約で止める。
- 簡易ドキュメントモードは 409(既存の `DesignStagesNotAvailableError`)。
- テンプレートから取り込むものは無し。
- **作業中**: 写しは文書と段階を1つの表(`key` で見分ける)にした。段階は「最後に承認した中身」(`approved_model`)を写し、今の編集中の `model` は写さない([81-3](./Phase-81-3.md) の2節)。
- **作業中**: `DesignStageService` に公開のメソッド `stage_rows` を1つ足した(束のサービスがプライベートの `_load` を呼ばないため)。
- **作業中**: 応答のスキーマは、記録の項目を基底のクラスにまとめた(`items` の上書きが型の検査を通らないため)。

推奨と違った選択は無し。計画の差し戻しは無し。#39 の材料。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-81-1.md`](./Phase-81-1.md) | 文書の版に、生成したモデル名を残す | あり(本体 4 + マイグレーション 1 + テスト 1) | なし |
| [`Phase-81-2.md`](./Phase-81-2.md) | 束と写しの表・リポジトリ | あり(本体 4 + マイグレーション 1 + テスト 1) | 81-1(マイグレーションの順) |
| [`Phase-81-3.md`](./Phase-81-3.md) | 束の作成・一覧・取得の API | あり(本体 6 + テスト 2) | 81-1(`generated_model`)・81-2(表・`ItemSnapshot`・`BaselineRepository`) |

## サンプルコード一覧

`textbook/samples/backend/` の新規・更新:

- 81-1: `alembic/versions/9dde45561e02_add_generated_model_to_documents.py`(新規)・`app/models/generated_document.py`・`app/repositories/generated_document.py`・`app/schemas/document.py`・`app/services/doc_generator_service.py`・`tests/unit/test_generated_model.py`(新規)
- 81-2: `app/models/baseline.py`(新規)・`app/models/project.py`・`app/models/__init__.py`・`alembic/versions/d28026a1521b_add_baselines.py`(新規)・`app/repositories/baseline.py`(新規)・`tests/unit/test_baseline_repository.py`(新規)
- 81-3: `app/services/errors.py`・`app/services/design_stage_service.py`・`app/schemas/baseline.py`(新規)・`app/services/baseline_service.py`(新規)・`app/api/routes/baselines.py`(新規)・`app/api/routes/__init__.py`・`tests/unit/test_baseline_service.py`(新規)・`tests/integration/test_baselines_flow.py`(新規)
- ミラーしないもの(#21 の共通): 無し(インフラ・設定ファイルは変えていない)。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| [81-1](./Phase-81-1.md) | マイグレーション・`GeneratedDocument`・`create_version`・`GeneratedDocumentRead`・`generate_documents` | 文書の版に、生成したモデル名を残す | 名前を渡した版・渡さない版・生成の全版に既定のモデル名・応答に出る・マイグレーションの往復 |
| [81-2](./Phase-81-2.md) | `Baseline`・`BaselineItem`・`Project.baselines`・マイグレーション・`ItemSnapshot`・`BaselineRepository` | 束(番号・合意の記録)と写し(文書・段階)を永続化する | 番号がプロジェクトごと・記録と写しの保存と並び・新しい順・番号の重複は DB が止める |
| [81-3](./Phase-81-3.md) | 2つの例外・`stage_rows`・スキーマ・`BaselineService`・写しの純粋関数・3つのルート | 条件を確かめて今の文書と段階の承認の写しを凍結し、一覧と中身を返す | 写す中身・凍結・未承認 / 古い段階・テスト仕様書・一覧と取得・3つの条件・本文・他人のプロジェクト・CASCADE |

## 写経順序(#23)

章番号順(81-1 → 81-2 → 81-3)。各章の表の順(依存順。#30)に写す。

- 81-1 と 81-2 のマイグレーションを写したら、`alembic upgrade head` を流してから API を動かす(ORM に `generated_model` の列と2つの表が増えるため)。

実 import 監査(#15。全 import 文を読んで確かめた):

- 81-1: `doc_generator_service.py` → `injected_llm`(既存の `llm_resolver.py`)。モデル・リポジトリ・スキーマ → 新しい import は無い。テスト → `upstream_outputs`・`FakeLLM`・`settings`・`Project`・`User`・`ChatHistoryRepository`・`DOC_TYPES`・`GeneratedDocumentRepository`・`GeneratedDocumentRead`・`DocGeneratorService`(すべて既存)。
- 81-2: `models/baseline.py` → `sqlalchemy`・`Base`・`PortableJSON`(既存)、`Project`(`TYPE_CHECKING` のみ)。`models/project.py` → `Baseline`(`TYPE_CHECKING` のみ。表で先に置く)。`models/__init__.py` → `Baseline`・`BaselineItem`(この章)。`repositories/baseline.py` → `Baseline`・`BaselineItem`(この章)・`CRUDRepository`(既存)。テスト → この章のものと `Project`・`User`。
- 81-3: `errors.py`・`design_stage_service.py` → 新しい import は無い(`stage_rows` は既存の `DesignStage`・`StageView` を使う)。`schemas/baseline.py` → `pydantic` だけ。`baseline_service.py` → `StageView`・`stage_key`(既存の `app.detailed_design`)・`Baseline`・`ItemSnapshot`・`BaselineRepository`(81-2)・`GeneratedDocument`・`DesignStage`・`Project`・`DOC_TYPES_BY_MODE`・`TEST_SPEC`・`GeneratedDocumentRepository`(既存)・`BaselineCreate`・`stage_rows`・2つの例外(この章。表で先に置く)・3つの既存の例外。`routes/baselines.py` → `CurrentProjectDep`・`CurrentUserDep`・`SessionDep`(既存)・スキーマとサービス(この章)。`routes/__init__.py` → `baselines.router`(この章)。テスト → この章のものと `create_impact_project`(既存の fixture)・`GeneratedDocumentRepository`・`DesignStage`。integration → `AsyncSessionLocal`・`create_access_token`・`Project`・`User`・`GeneratedDocumentRepository`(既存)・`Baseline`・`BaselineItem`(81-2)。

前方 import は無い。各章が作成・更新した本体のファイルは、その章のテストが import する(マイグレーションは往復の実行で確かめた)。

## 検証結果

- 章ごとの部分テスト: 81-1 は新しいテストと生成・版のテスト(37件)、81-2 は新しいテスト(4件)、81-3 は新しいテスト(9件)。すべて成功。新しいテストは 15件(2・4・9)と integration 2件。
- Phase 完了時の全体テスト(#18): devex-api **1500 件成功**(27 件は integration で除外)。integration **27 件成功**(既存を含む全部。実際の PostgreSQL と Redis。この Phase で2件増えた)。devex-ui は変えていないので流していない。
- `ruff check`(app・tests・alembic)成功(`ruff format` は使わない)。`uvx pyright`(変えたファイルとテスト 11本): 0 件。
- マイグレーション: リビジョン ID の衝突なし・head は1つ(`d28026a1521b`)。dev の DB で `upgrade head` → `downgrade d7e2a9c4f1b3` → `upgrade head` の往復が通った。`alembic check` でモデルとの差が無い。
- `samples_check.py`(`--api-since HEAD`): 一致 814・並び順のみ差 8・例外 5、「samples のみ」0件。最初は「samples のみ」が2件(`samples/frontend/src/app/change-impact-demo/` の2ファイル)出た。この Phase の前からのずれで、テンプレート由来の不要なファイルの削除で devex-ui から消えたのに samples に残っていた。完了報告の後、ユーザーの決定で samples からも消した(下の「この Phase で解決したもの」)。
- `link_check.py`: リンク切れ 0 件。
- 実 LLM: 呼んでいない(費用 0)。

## 未消化の申し送り(#37)

[Phase 80](../Phase-80/Phase-80-introduction.md#未消化の申し送り37) から引き継いだもの。

**ステージ11 の中で扱うもの**:
- **`gemini-3.1-flash-lite` の終了(2027-05-07 以降)** → Phase 88。その時点の後継のモデルを確かめて、カタログを入れ替える。
- **`devex-api/postgres-init/01-create-test-db.sh` の構文の誤り**(新しいボリュームで、テストの DB が作られない)→ Phase 88。テンプレートで直した形(標準入力から渡す)を取り込む。
- **文書の側の要素の確認**: 今の再生成の印は、画面と API に付かない([80-2](../Phase-80/Phase-80-2.md))→ Phase 86。
- **Phase 82〜89 の未確定事項**: [80-4](../Phase-80/Phase-80-4.md)「未確定事項」(81 の分は解決)。

**ステージ11 の範囲の外**(行き先は [80-1](../Phase-80/Phase-80-1.md) の表):
- 振り返り 6節の残り7件:
  - ステージ12: 推測の採用率・決める機会
  - ステージ15 の前後: 前提作業・戻し方・版の一致
  - ヒアリングを扱うステージ: 認証の対の問い・基本機能の観点
- **生成の質の候補4件**: 再生成のきっかけの残り(Phase 70)・設計に無いテスト(Phase 70)・日本語の名前のデータストア(Phase 71)・語の表の範囲(Phase 71)。生成の質を扱うステージの仕様診断で決める。

**持ち越し**(触るときに直す。中身は [振り返り](../retrospectives/project-retrospective.md) 8節):
- `test_chat_service.py` などの pyright の指摘(Phase 40)
- devex-ui の並列のテストのタイムアウト(Phase 44)
- 偽 LLM の外部設計書の GET に DF が無い(Phase 45)
- `DfdEditorTabs` のテストのまれな失敗(Phase 77)
- Google の公開鍵を毎回取りに行く(Phase 74)
- `ListCard` の入れ物(Phase 79。テンプレートでは直した)
- 英語のままの refresh の失敗の文(Phase 79)
- `tagmerge.py` の手直し(ステージ10 の振り返り)。この Phase でも、import 文・docstring・ファイル冒頭のヘッダー・タグの位置(既存のタグの後ろに追記が入り、既存のタグが別の行を指す形になった `routes/__init__.py`)を手で直した。

**ユーザーが決めるもの**:
- **CLAUDE.md の更新の案**(別のセッションで。#18): 中身は [Phase 80 の申し送り](../Phase-80/Phase-80-introduction.md#未消化の申し送り37)のとおり(ゴールの追加・CR の手順・「all stages complete」の直し)。
- **開発環境の後始末**: 確認用の利用者・プロジェクト、DB の事故の後の複製(振り返り 8節)。
- **この Phase の未コミット**: 外側のリポジトリ(Phase 80 の分を含む)と devex-api の変更。コミットはユーザーが行う(#35)。devex-api のタグは `phase-81`。

**この Phase で生まれたもの**:
- **止まった段階の生成と束**(→ Phase 88 の画面確認): 束の作成は、段階の `generation_status` が `generating` なら 409。止まった生成(15分超)の回収は段階の一覧の GET が行うので、画面で束を作る前に段階の一覧を読む流れなら問題は出ない。Phase 88 で画面の流れを決めるときに確かめる。
- **一覧の応答の大きさ**(→ Phase 88): 一覧は写しの中身を返さないが、DB からは中身ごと読む(`selectinload`)。束が増えて遅さが気になったら、一覧だけ中身の列を読まない形にする(今は入れない)。
- **セッションの区切りの記録**: Phase 81 は1セッションで行った。計画モードで調査(エージェントは使わず直接)→ 質問1回(4問)→ 計画の承認 → 81-1〜81-3 の実装 → 全体テストと integration → samples → docs → 教材。

**この Phase で解決したもの**:
- **samples に残ったデモの画面**(完了報告の後にユーザーが決定): `samples/frontend/src/app/change-impact-demo/` の2ファイルを消した(#21: 本体の削除は samples にも反映する)。[41-3](../Phase-41/Phase-41-3.md) の表のリンクを外し、ファイル名はコード表記で残した。
- **文書の版に生成したモデルを残す**(振り返り 6節): [81-1](./Phase-81-1.md)。
- **80-4 の Phase 81 の未確定事項**(作れる条件・写しの持ち方・番号の振り方・作り直しと削除・生成したモデルの列の Phase): 着手時の相談と [81-2](./Phase-81-2.md)・[81-3](./Phase-81-3.md)。

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

設問は Phase の要点の要約(回答は求めない)。

1. 段階を写すとき、今の `model` ではなく `approved_model` を写すのはなぜか。承認の後に編集した段階や「古い」段階を、束に入れたまま状態だけ残すのはなぜか。
2. 承認したことの無い段階や、無いテスト仕様書にも写しの行を作るのはなぜか。
3. 文書と段階の写しを1つの表にまとめたのはなぜか。Phase 83 の予測が束から要素を作るとき、何がそろっている必要があるか。
4. 束を直せず消せないことにしたのはなぜか。記録の誤りは、どう直すか。
5. 生成したモデル名を、束より先に文書の版の列として足したのはなぜか。渡された LLM(テストの偽物)のモデル名は、何として記録されるか。

## 次のフェーズ

**Phase 82**: CR の API。CR の表(タイトル・内容・背景・対象の要件 ID・基準の束)、6つの状態の遷移と遷移ごとの日時(時系列)、合意の記録(判断・相手・日時・メモ・理由。この Phase の束と同じ項目)。着手時に、自動実装モード(#21)と [80-4](../Phase-80/Phase-80-4.md) の Phase 82 の未確定事項(却下の後に下書きへ戻せるか・取り下げの範囲・説明済みの条件・背景の出どころの種類と日付の粒度・ID の無い新しい要件・同じ要件の CR が2つあるとき)を決める。基準の束は、この Phase の `GET /baselines/{number}` で読む。
