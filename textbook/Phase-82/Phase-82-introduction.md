# Phase 82 導入: CR(変更要求)の API(ステージ11)

## 目的

ステージ11(合意と変更の一巡)の2つ目の実装 Phase。[80-4](../Phase-80/Phase-80-4.md) の Phase 82 として、[Phase 81](../Phase-81/Phase-81-introduction.md) の合意済みの版(束)を基準にした変更要求(CR)を API に作る([外部設計書](../../docs/external_design.md) 2.14節、[内部設計書](../../docs/internal_design.md) 3.2節⑯⑰・3.3節 11項)。CR の項目・状態の遷移と時系列・合意の記録までで、予測(83)・説明書(84)・反映(85)・検証(86)・画面(87)はこの後。

- CR と時系列の表・リポジトリ ── [82-1](./Phase-82-1.md)
- 状態の遷移の表と CR のサービス ── [82-2](./Phase-82-2.md)
- CR の API ── [82-3](./Phase-82-3.md)

## パイプライン上の位置づけ・前提

```
開発者「B-1 を基準に、FR-001 の変更を CR にする」(画面は Phase 87)
   │
   ▼ POST /projects/{id}/change-requests {title, content, background_*, target_requirement_ids,
   │                                       adds_requirement, baseline_number?}            ──[82-3]
   ChangeRequestService.create                                                            ──[82-2]
     ├ 詳細設計モードでない → 409 / 束が無い → 409 CR_BASELINE_MISSING
     └ 対象を基準の束の要件定義書の写しで確かめる(無い ID・対象が空 → 422 CR_TARGET_UNKNOWN)
   ▼ ChangeRequestRepository.create(番号 = 最大 + 1、時系列の最初の行)                  ──[82-1]
   change_requests(CR-1, draft) + change_request_events(create)
   │
   ├ PATCH /{number}         下書き・説明済みで直す(説明済みは下書きに戻る)
   ├ POST /{number}/explain  下書き → 説明済み
   ├ POST /{number}/decision 説明済み → 合意 / 却下(合意の記録。束と同じ項目)
   ├ POST /{number}/withdraw 下書き・説明済み → 取り下げ
   ├ POST /{number}/copy     却下 → 新しい番号の下書き(元は却下のまま)
   └ GET  /{number}          詳細(時系列・重なり・写しの元と先・できる操作)
        │
        ▼ Phase 83: 基準の束から要素を作り、対象の要件から影響を予測する
```

- **前提として読むもの**: [80-1](../Phase-80/Phase-80-1.md)(決定5 の状態と、CR の対象の考え方)・[80-4](../Phase-80/Phase-80-4.md)(Phase 82 の未確定事項)・[81-3](../Phase-81/Phase-81-3.md)(束の作り方と写しの形)・[外部設計書](../../docs/external_design.md) 2.14節。
- **今の仕組み**: 束(`baselines`・`baseline_items`)は直せず消せない。要件定義書の写しの model は `rows`(`id`・`kind`・`text` …)を持つ。CR に当たるものは無い。
- **この Phase を始めた時点の状態**: devex-api の HEAD は `b145704`(Phase 81)、外側のリポジトリは `409b0e4`。外側には CLAUDE.md の更新(別セッション)と Phase 81 の q_a の追記が未コミットで残っていて、この Phase はその上に重ねた。alembic の head は `d28026a1521b`。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(本体 + samples)。

E2E: この Phase では流さない(画面を変えないため。ステージ11 の E2E は Phase 89 で既存を含めて全部流す)。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 82 開始時」を参照。計画モードで1回(4問)聞いた。

| # | 問い | 決定 |
|---|---|---|
| 1 | 自動実装モード | on(推奨どおり) |
| 2 | 却下した CR を下書きへ戻せるか | **推奨と違う**: 戻せるが、却下の前の状態と却下の理由は残す。「却下した CR の写しを下書きにして変更を加える」形(推奨は「戻せない。出し直しは新しい CR」) |
| 3 | ID の無い新しい要件の対象の持ち方 | 既存の ID の一覧 + 「新しい要件を足す」の印(推奨どおり) |
| 4 | 同じ要件を対象にする進行中の CR | 作れるが、重なりを示す(推奨どおり) |

決定2の読み方(Claude の判断。計画の承認で確定): 却下した CR に「写して下書きにする」操作を置き、**新しい番号の CR** を作る(`derived_from_id` で元を指す)。元の CR は却下と合意の記録のまま変えず、詳細に写しの先を出す。推奨(新しい CR を作る)との違いは、中身を写す操作と、元と先を互いにたどれることにある。

Claude の判断(計画の承認で確定、または作業中):

- 取り下げは合意の前(下書き・説明済み)だけ。理由は任意で時系列に残す。
- 「説明済み」にする条件はこの Phase では置かない(説明書の出力を条件にするかは Phase 84 で決める)。
- 背景の出どころの種類は `meeting`/`email`/`document`/`other`、日付は日の単位(任意)。
- 直せるのは下書き・説明済み。説明済みで直すと下書きに戻る。合意の後は 409。
- 基準の束は作成のときに番号で選ぶ(省けば最新)。後から変えない。
- 時系列は別の表(⑰)にした(同じ状態を2回通っても日時が消えないため。Phase 85・86 で参照を足しやすい)。
- 合意の記録の項目(相手・メモ・理由)は共有のスキーマ `AgreementNotes` に抜き出し、束の `BaselineCreate` もこれを継ぐ(#17。今の消費者 = CR の判断)。
- 反映済み・検証済みへの遷移は表にだけ持ち、API は Phase 85・86 で足す。
- テンプレートから取り込むものは無し。
- **作業中**: 重なりの候補を読むリポジトリのメソッドは、計画の `active_with_targets` でなく、状態で絞る汎用の `list_by_statuses` にした(対象の突き合わせは純粋関数 `overlaps` が行う)。
- **作業中**: CR と一緒に読む基準の束は、写し(md・model)を読まない。対象を直すときだけ、サービスが写し付きで読み直す(`_baseline_with_items`)。
- **作業中**: 元の CR の時系列にも、写した先を1行(`copied`。状態は却下のまま)足した。

推奨と違った選択は1件(決定2。「戻せない」→「写して出し直す」。推奨より、元と先をたどれる形を求める向き)。計画の差し戻しは無し。#39 の材料。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-82-1.md`](./Phase-82-1.md) | CR と時系列の表・リポジトリ | あり(本体 4 + マイグレーション 1 + テスト 1) | Phase 81(`baselines` の表) |
| [`Phase-82-2.md`](./Phase-82-2.md) | 状態の遷移の表と CR のサービス | あり(本体 7 + テスト 2) | 82-1(表・リポジトリ)・Phase 81(`BaselineService`・`BaselineCreate`) |
| [`Phase-82-3.md`](./Phase-82-3.md) | CR の API | あり(本体 2 + テスト 2) | 82-2(スキーマ・サービス) |

## サンプルコード一覧

`textbook/samples/backend/` の新規・更新:

- 82-1: `app/models/change_request.py`(新規)・`app/models/project.py`・`app/models/__init__.py`・`alembic/versions/e1cfb47f1d13_add_change_requests.py`(新規)・`app/repositories/change_request.py`(新規)・`tests/unit/test_change_request_repository.py`(新規)
- 82-2: `app/change_requests/states.py`(新規)・`app/change_requests/__init__.py`(新規)・`app/schemas/agreement.py`(新規)・`app/schemas/baseline.py`・`app/schemas/change_request.py`(新規)・`app/services/errors.py`・`app/services/change_request_service.py`(新規)・`tests/unit/test_change_request_states.py`(新規)・`tests/unit/test_change_request_service.py`(新規)
- 82-3: `app/api/routes/change_requests.py`(新規)・`app/api/routes/__init__.py`・`tests/unit/test_change_requests_api.py`(新規)・`tests/integration/test_change_requests_flow.py`(新規)
- ミラーしないもの(#21 の共通): 無し(インフラ・設定ファイルは変えていない)。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| [82-1](./Phase-82-1.md) | `ChangeRequest`・`ChangeRequestEvent`・`Project.change_requests`・マイグレーション・`ChangeRequestRepository` | CR(項目・状態・合意の記録)と時系列を永続化する | 番号がプロジェクトごと・項目と最初の時系列・遷移の行と状態がそろう・絞り込み・番号の重複は DB が止める |
| [82-2](./Phase-82-2.md) | `states.py`(遷移の表)・`AgreementNotes`・CR のスキーマ・4つの例外・`ChangeRequestService` | 遷移の可否を表で決め、作成・更新・説明・判断・取り下げ・写しを行い、詳細に重なりと写しの元と先を添える | 許す / 許さない遷移・作成の条件・説明済みの直し・判断の記録・写し・重なり・本文の検証 |
| [82-3](./Phase-82-3.md) | 8つのルート・ルーターの登録 | サービスを API にする | ルートで一巡・404 / 409 / 422 の応答・CASCADE・他人のプロジェクト |

## 写経順序(#23)

章番号順(82-1 → 82-2 → 82-3)。各章の表の順(依存順。#30)に写す。

- 82-1 のマイグレーションを写したら、`alembic upgrade head` を流してから API を動かす(ORM に2つの表が増えるため)。
- 82-2 の `schemas/baseline.py` の更新は、`schemas/agreement.py` を先に写す(継承の元)。

実 import 監査(#15。全 import 文を読んで確かめた):

- 82-1: `models/change_request.py` → `sqlalchemy`・`Base`・`PortableJSON`(既存)、`Baseline`・`Project`(`TYPE_CHECKING` のみ。既存)。`models/project.py` → `ChangeRequest`(`TYPE_CHECKING` のみ。この章)。`models/__init__.py` → `ChangeRequest`・`ChangeRequestEvent`(この章)。`repositories/change_request.py` → `ChangeRequest`・`ChangeRequestEvent`(この章)・`CRUDRepository`(既存)。テスト → この章のものと `Baseline`・`BaselineRepository`(Phase 81)・`Project`・`User`。
- 82-2: `change_requests/states.py` → 標準ライブラリだけ。`change_requests/__init__.py` → `states`(この章)。`schemas/agreement.py` → `pydantic` だけ。`schemas/baseline.py` → `AgreementNotes`(この章。表で先に置く)。`schemas/change_request.py` → `app.change_requests` の6つ・`AgreementNotes`・`MEMO_MAX`・`REASON_MAX`(この章)、`ChangeRequest`(`TYPE_CHECKING` のみ。82-1)。`errors.py` → 新しい import は無い。`change_request_service.py` → `app.change_requests` の11個・CR のスキーマ・4つの例外(この章)、`ChangeRequest`・`ChangeRequestRepository`(82-1)、`Baseline`・`BaselineRepository`・`BaselineService`(Phase 81)、`Project`・`DesignStagesNotAvailableError`(既存)。テスト → この章のものと `create_impact_project`(既存の fixture)・`BaselineCreate`・`BaselineService`・`BaselineNotFoundError`(Phase 81)。
- 82-3: `routes/change_requests.py` → `CurrentProjectDep`・`CurrentUserDep`・`SessionDep`(既存)・CR のスキーマ・`ChangeRequestService`・`ChangeRequestView`(82-2)。`routes/__init__.py` → `change_requests.router`(この章)。テスト → この章のルート・`api_router`、82-2 のスキーマ・例外、Phase 81 の `BaselineCreate`・`BaselineService`、既存の fixture。integration → `AsyncSessionLocal`・`create_access_token`・`Project`・`User`・`GeneratedDocumentRepository`(既存)・`ChangeRequest`・`ChangeRequestEvent`(82-1)。

前方 import は無い。各章が作成・更新した本体のファイルは、その章のテストが import する(`models/project.py`・`models/__init__.py` はリポジトリのテストが ORM の関係を通して読み、マイグレーションは往復の実行で確かめた。`schemas/baseline.py` は 82-2 のサービスのテストが import する)。

## 検証結果

- 章ごとの部分テスト: 82-1 は新しいテスト(5件)、82-2 は遷移のテスト(21件)・サービスのテスト(12件)と束のサービスのテスト(9件。束の本文の検証もそのまま通った)、82-3 は新しいテスト(3件)と integration(2件)。すべて成功。新しいテストは 41件(5・21 + 12・3。パラメータ化を含む)と integration 2件。
- Phase 完了時の全体テスト(#18): devex-api **1541 件成功**(29 件は integration で除外)。integration **29 件成功**(既存を含む全部。実際の PostgreSQL と Redis。この Phase で2件増えた)。devex-ui は変えていないので流していない。
- `ruff check`(app・tests・alembic)成功(`ruff format` は使わない)。`uvx pyright`(変えたファイルとテスト 18本): 0 件。
- マイグレーション: リビジョン ID の衝突なし・head は1つ(`e1cfb47f1d13`)。dev の DB で `upgrade head` → `downgrade d28026a1521b` → `upgrade head` の往復が通った。`alembic check` でモデルとの差が無い。
- `samples_check.py`(`--api-since HEAD`): 一致 828・並び順のみ差 8・例外 5、「samples のみ」「本体のみ」0件。
- `link_check.py`: リンク切れ 0 件。
- 実 LLM: 呼んでいない(費用 0)。

## 未消化の申し送り(#37)

[Phase 81](../Phase-81/Phase-81-introduction.md#未消化の申し送り37) から引き継いだもの。

**ステージ11 の中で扱うもの**:
- **`gemini-3.1-flash-lite` の終了(2027-05-07 以降)** → Phase 88。その時点の後継のモデルを確かめて、カタログを入れ替える。
- **`devex-api/postgres-init/01-create-test-db.sh` の構文の誤り**(新しいボリュームで、テストの DB が作られない)→ Phase 88。テンプレートで直した形(標準入力から渡す)を取り込む。
- **文書の側の要素の確認**: 今の再生成の印は、画面と API に付かない([80-2](../Phase-80/Phase-80-2.md))→ Phase 86。
- **止まった段階の生成と束**(Phase 81)→ Phase 88 の画面確認。
- **一覧の応答の大きさ**(Phase 81)→ Phase 88。
- **Phase 83〜89 の未確定事項**: [80-4](../Phase-80/Phase-80-4.md)「未確定事項」(81・82 の分は解決)。

**この Phase で生まれたもの**(ステージ11 の中で扱う):
- **「説明済み」の条件** → Phase 84。説明書の出力を条件にするか(今は手で遷移できる)。
- **反映済み・検証済みの API** → Phase 85・86。遷移の表(`apply`・`verify`)はある。時系列に版・再生成・レビューの参照を足す。
- **CR の列の追加** → Phase 83(予測の保存)・85(反映した版)・86(結んだレビュー)。説明書の要約の持ち方は Phase 84。
- **新しい要件を足す CR の予測の起点** → Phase 83(`adds_requirement` だけの CR は、対象の ID が空になる)。
- **写しの元の基準の束**: 写しは元の CR の基準の束をそのまま使う。却下の後に新しい束を作っても、写しは古い束を基準にする。基準を変えたいときは新しい CR を作る。運用で困るかを Phase 87 の画面で確かめる。
- **下書きの中の直しは時系列に残さない**: 「いつ何を直したか」が要るとステージ12(行単位の変更の履歴)で分かったら、そこで扱う。

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
- `tagmerge.py` の手直し(ステージ10 の振り返り)。この Phase は `tagmerge.py` を使わず、更新した5ファイルに手でタグを付けた(どれも import 文・ファイル冒頭のヘッダー・ブロック全体の置き換えで、手当てが要る形だったため)。

**ユーザーが決めるもの**:
- **開発環境の後始末**: 確認用の利用者・プロジェクト、DB の事故の後の複製(振り返り 8節)。
- **この Phase の未コミット**: 外側のリポジトリ(Phase 81 の後の CLAUDE.md・q_a の分を含む)と devex-api の変更。コミットはユーザーが行う(#35)。devex-api のタグは `phase-82`(`phase-81` もまだ無い)。

**セッションの区切りの記録**: Phase 82 は1セッションで行った。計画モードで調査(エージェントは使わず直接)→ 質問1回(4問)→ 計画の承認 → 82-1〜82-3 の実装 → 全体テストと integration → samples → docs → 教材。

**この Phase で解決したもの**:
- **80-4 の Phase 82 の未確定事項**(却下の後・取り下げの範囲・説明済みの条件・背景の種類と日付・ID の無い新しい要件・同じ要件の CR): 着手時の相談と [82-2](./Phase-82-2.md)。説明済みの条件は Phase 84 へ送った(上の「この Phase で生まれたもの」)。

## 後続 Phase での改訂

- **Phase 83**: CR の対象を、要件 ID の一覧(`target_requirement_ids`)から、要件 ID と変更の種類(内容の変更 / 削除)の組の一覧(`targets`)に変えた。`normalize_targets` は `app/change_requests/targets.py` へ移し、整えるのはスキーマにした。経緯は [83-1](../Phase-83/Phase-83-1.md) と [`q_a.md`](../q_a.md)「Phase 83 開始時」の CR。
- **Phase 95**: CR の中身の直しは、説明済みから下書きに戻るときだけでなく、下書きのままでも値の変わった項目があれば時系列に「直した」の行を足す(`refs.fields` に直した項目の名前)。経緯は [95-3](../Phase-95/Phase-95-3.md) と [`q_a.md`](../q_a.md)「Phase 95 開始時」。

## Phase 完了チェック(#22)

設問は Phase の要点の要約(回答は求めない)。

1. 却下した CR を「下書きに戻す」遷移にせず、新しい番号の CR に写す形にしたのはなぜか。元の CR に残るものと、写しに渡らないものは何か。
2. 遷移ごとの日時を CR の列でなく、時系列の表の行にしたのはなぜか。説明済み → 下書き → 説明済み と進んだとき、何が残るか。
3. 対象の要件 ID を、今の要件定義書でなく基準の束の写しで確かめるのはなぜか。ID の無い新しい要件は、どう持つか。
4. 遷移の可否を純粋な表(`TRANSITIONS`)にしたことで、サービスとテストはどう変わったか。反映済み・検証済みの行を、API より先に表に置いたのはなぜか。
5. 合意の記録の項目を `AgreementNotes` に抜き出したとき、日時の項目を基底に入れなかったのはなぜか(#17 の判定の一問も)。

## 次のフェーズ

**Phase 83**: CR に結ぶ影響の予測。基準の束の写し(文書の model と段階の `approved_model`)から `build_elements(DesignModels.from_dicts(...))` で要素を作り、CR の対象の要件を `impact_of(elements, Change("req:<ID>"))` に渡して、見直しが要る要素(文書の側の画面・API も)の一覧を返す API。着手時に、自動実装モード(#21)と [80-4](../Phase-80/Phase-80-4.md) の Phase 83 の未確定事項(変更の種類の写し方・新しい要件の CR の予測・予測を合意の時点で保存するか)を決める。新しい要件の CR は、この Phase の `adds_requirement` で見分けられる。
