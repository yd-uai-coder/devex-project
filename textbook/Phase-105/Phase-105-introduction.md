# Phase 105 導入: 名称を言い換える偽の LLM と、名前の揺れの直し(ステージ13)

## 目的

ステージ13(説明とすり合わせ)の5つ目の実装 Phase。[100-4](../Phase-100/Phase-100-4.md) の Phase 105 にあたる。

ステージ11・12 では、実 LLM だけが見つける名前の揺れ(版の巡回・段階1 の ID の引き継ぎ)が、2ステージ続けて完了後の調整に回った([振り返り](../retrospectives/overall-retrospective.md) 17.6)。偽の LLM は毎回同じ名前を返すので、名前で同一性を決める照合の弱さがテストに出ない。Phase 100 で、ユーザーは「名称を言い換える偽の LLM」と、その検査の対象(外部連携の重複〈P99〉・推測の利用者のキー〈P94〉)をステージ13 に入れた([100-1](../Phase-100/Phase-100-1.md))。

- 名称を決定的に言い換える規則と、E2E の偽の LLM の言い換えのモード。今の照合の強さをテストで固定する ── [105-1](./Phase-105-1.md)
- 外部連携のサービス名の言い換えで残る重複を、保護で除く ── [105-2](./Phase-105-2.md)
- 推測の利用者に ID を振り、確認事項のキーを名前に頼らない形にする ── [105-3](./Phase-105-3.md)

画面は変えない(確認事項の画面はキーを符号化して渡すだけ)。

## パイプライン上の位置づけ・前提

```
生成の構造化出力 ──paraphrase_*──▶ 言い換えた再生成の出力(単体テスト)──[105-1]
E2eFakeLLM ── 会話に [言い換え] があるプロジェクトだけ ──▶ 再生成で名前を言い換える ──[105-1]
   要件定義書(利用者)→ 外部設計書(画面・外部連携)→ 段階1(処理)

再生成 ─▶ 組み立て ─▶ 保護(protect_*)─▶ 版
   段階1 の処理: トリガー / 名称 → 関連画面(既存。耐える)
   画面: 画面 ID(既存。耐える)
   外部連携: integration:<サービス名> + service_match_key で重複を除く ──[105-2]
   利用者(1.2): U-001 を prev_id → 名前 → 場面で引き継ぐ。合意の比べる値に id は入れない ──[105-3]
確認事項: user:<名前> → user:<ID>(古い記録は一覧で付け直す)──[105-3]
```

- **前提として読むもの**: [100-4](../Phase-100/Phase-100-4.md)(Phase 105 の未確定事項)・[Phase 94](../Phase-94/Phase-94-introduction.md)(確認事項の項目のキー)・[Phase 93](../Phase-93/Phase-93-introduction.md)(外部設計書の保護)・[Phase 99](../Phase-99/Phase-99-introduction.md)(実 LLM で見た言い換えと、段階1 の引き継ぎの調整)。
- **今の仕組み**:
  - E2E の偽の LLM(`app/ai/llm/fake.py`)はステートレスで、プロンプトだけを手がかりに決まった出力を返す。単体テストの偽の LLM(`tests/fixtures/fake_llm.py`)は台本を注入する。
  - 保護(`app/agreements/protection.py`)は、合意済みの要件・画面・API・外部連携をすべての欄で戻す。同じ値の新しい行を除くのは、要件(文)と画面(名前)だけ。
  - 確認事項の推測の利用者のキーは `user:<名前>`(1.2 の行に ID が無い)。
- **この Phase を始めた時点の状態**: 外側のリポジトリは `187a516`(Phase 104 までコミット済み)。devex-api は `stage11-15` ブランチの `2a8ffc6`(Phase 104。タグ `phase-101`〜`phase-104` はまだ無い)、devex-ui は `main` の `511c5e6`(`tableStyles.ts` だけ未コミット。ユーザーの編集)。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(本体 + samples)。変えるのは devex-api と、devex-ui のコメント1か所。

E2E: この Phase では流さない。印の無いプロジェクトの偽の LLM の出力と、既存の API の応答は変えていない(確認事項の利用者のキーの形だけが `user:<ID>` になる。画面はキーを不透明に扱う)。言い換えの E2E の spec は Phase 110 で足し、既存を含めて全部流す(#36)。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 105 開始時」を参照する。計画モードで1回(4問)聞いた。

| # | 問い | 決定 |
|---|---|---|
| 1 | 自動実装モード | on(推奨どおり) |
| 2 | 言い換えのモードの決め方 | 規則は `app/ai/llm/` の純粋関数。単体テストは関数を直接使う。E2E の偽の LLM は、会話にプロジェクトの印(`[言い換え]`)があるときだけ言い換える(既存の spec は変わらない)。言い換えの E2E の spec は Phase 110(推奨どおり) |
| 3 | 推測の利用者のキー | 1.2 の行に ID を振り、前の版の ID を引き継ぐ。キーは `user:<ID>`。古い記録は読むときに付け直す。md に ID は出さない(推奨どおり) |
| 4 | 外部連携の重複の判定 | 正規化した名前(大文字小文字・空白・記号・末尾の「API」を除く)が合意済みの行と同じなら、合意の無い新しい行を除く(推奨どおり) |

Claude の判断(計画の承認で確定、または実装中):

- 言い換えの規則は決定的にした(名前の後ろに「(言い換え)」。サービス名は末尾の「API」を外す・足す)。要件の文は言い換えない(`prev_id` で元から耐える)。
- 偽の LLM は、要件定義書の目的・外部設計書の概要に印を写して下流のプロンプトへ届ける。段階1 は前の版をプロンプトに持たないので、外部設計書の md に言い換えの語があるときに言い換える。
- 実装中: 段階1 は、計画では画面の処理を足して言い換える予定だったが、足さずに今の2つの API の処理の名称を言い換えるだけにした(段階2 以降の偽の出力は `F-01`・`F-02` を前提に固定しているため)。API でない処理の引き継ぎは純粋なテストで確かめた。
- 実装中: 今の照合の強さのテスト(段階1・画面)は、計画では各対象のテストに足す予定だったが、`test_paraphrase.py` にまとめた(言い換えの規則の消費者として読めるように)。
- 利用者の ID の形は、計画の `U-01` でなく、要件・画面と同じ `seq_id` の `U-001` にした。
- ID は文書の model の JSON の中に持ち、ID の無い古い版は `RequirementsModel` の validator が読むときに並び順で振る(DB のマイグレーションは無い)。
- 合意の比べる値(`body_of("users")`)から `id` を除いた(ID を振る前の合意が「合意と違う」にならないように)。
- ID を振る前の確認事項の記録は、`ConfirmationService` が一覧・更新の前に付け直す(一覧の GET は、付け直したときだけ commit する)。
- 確認事項の推測の利用者の重複の除き方を、名前から ID にした。
- 実装中: サービス名の照合の定数を、本体でも `integration_key` の後ろに置いた(samples で、追記のタグが既存の関数に引き継がれないように)。
- テンプレートから取り込むものは無い。

推奨と違った選択は0件。計画の差し戻しは無し。#39 の材料。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-105-1.md`](./Phase-105-1.md) | 言い換えの規則と、E2E の偽の LLM の言い換えのモード | あり(本体 2 + テスト 2。新規 2) | なし |
| [`Phase-105-2.md`](./Phase-105-2.md) | 外部連携の重複を除く | あり(本体 3 + テスト 2) | 105-1(テストが言い換えの規則を使う) |
| [`Phase-105-3.md`](./Phase-105-3.md) | 推測の利用者に ID を振る | あり(本体 11 + UI のコメント 1 + テスト 6) | 105-1・105-2 |

## サンプルコード一覧

`textbook/samples/backend/`(105-3 の UI のコメントだけ `textbook/samples/frontend/`)。

- 105-1: `app/ai/llm/paraphrase.py`・`tests/unit/test_paraphrase.py`(新規)、`app/ai/llm/fake.py`・`tests/unit/test_fake_llm_e2e.py`(更新)。
- 105-2: `app/agreements/items.py`・`protection.py`・`__init__.py`、`tests/unit/test_external_design_protection.py`・`test_external_design_protection_flow.py`(更新)。
- 105-3: `app/documents/requirements/model.py`・`assemble.py`・`__init__.py`・`drafting.py`、`app/ai/llm/fake.py`、`app/agreements/items.py`・`protection.py`、`app/confirmations/items.py`・`__init__.py`、`app/services/doc_generator_service.py`・`confirmation_service.py`、`src/features/confirmations/api/confirmationsApi.ts`、`tests/unit/test_requirements_doc.py`・`test_agreement_protection.py`・`test_requirements_protection_flow.py`・`test_confirmation_items.py`・`test_confirmation_service.py`・`test_fake_llm_e2e.py`(更新)。
- 更新したファイルは `tagmerge.py` で当てた。複数の章が触るファイル(`fake.py`・`test_fake_llm_e2e.py`・`agreements/items.py`・`protection.py`)は、前の章の終わりの形を一時的に作り、旧 → 前の章 → 新の2回に分けて当てた(章の振り分けを手で直さずに済んだ)。`fake.py` は、105-3 の追記の後に続く 105-1 の行に再タグを付けた。`confirmation_service.py` は、`_items` を2つに分けた差分の対応がずれたので、旧の `_items` 全体をコメントアウトする形に手で組み直した。docstring の記録の行(13ファイル)は道具の案のとおり手で書いた。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 作成・更新するファイル | 責務(1行) | テスト観点 |
|---|---|---|---|
| 105-1 | `paraphrase.py` | 名称を決定的に言い換える規則 | 1回だけ足す・外せる・API の付け外し・対象の名前だけ変える |
| 105-1 | `fake.py` | 印のあるプロジェクトだけ、再生成で言い換える | 印の写し・足す要素・言い換え・印なしは同じ |
| 105-2 | `agreements/items.py`・`__init__.py` | サービス名の正規形 | 大文字小文字・空白・記号・全角・末尾の API |
| 105-2 | `protection.py` | 合意済みの外部連携の重複を除く | 言い換えた行を除く・違う名前は残す・合意の無い行どうしは触らない・流れ |
| 105-3 | `model.py`・`assemble.py`・`__init__.py` | 利用者の ID と引き継ぎ | 古い版の番号・prev_id → 名前 → 場面・候補が2つ |
| 105-3 | `drafting.py`・`fake.py` | プロンプトの前の版の利用者と prev_id | プロンプトに ID・偽の LLM が ID を指す |
| 105-3 | `agreements/items.py`・`protection.py` | 比べる値から ID を除き、戻すときに ID を付ける | 古い合意が違うにならない・戻した ID |
| 105-3 | `confirmations/items.py`・`__init__.py`・2つのサービス | キーを ID に、古いキーの付け直し、採用を ID で | 言い換えてもキーが同じ・メモが残る・付け直し |

## 写経順序(#23)

章番号順。各章の「作成・更新したファイル」表は依存順に並べた(#30)。

実 import 監査(#15)として、各ファイルの全 import 文を読んだ。import 先のモジュールとシンボルの誕生章が、そのファイルの章以下であることを確かめた。

- `paraphrase.py`(105-1)→ `app.detailed_design.drafting`・`app.documents.external_design.drafting`・`app.documents.requirements.drafting` の生成の出力(既存)。105-3 で `GeneratedUserScene.prev_id` が増えるが、import する名前は変わらない。
- `fake.py`(105-1・105-3)→ 105-1 で `paraphrase` の5つ(105-1)・`GeneratedIntegration`・`NONE_TEXT`(既存)。105-3 で `base_name`(105-1)。
- `agreements/items.py`(105-2・105-3)→ 105-2 で `re`・`unicodedata`(標準)。105-3 は import を足していない。
- `protection.py`(105-2・105-3)→ 105-2 で `service_match_key`(105-2)。105-3 で `USER_PREFIX`・`number_users`(105-3 の `model.py`)。
- `agreements/__init__.py`(105-2)→ `service_match_key`(105-2)。
- `model.py`(105-3)→ `Sequence`・`Self`・`model_validator`(標準・pydantic)。`assemble.py`(105-3)→ `seq_id`(既存)・`USER_PREFIX`(105-3)。`requirements/__init__.py`(105-3)→ 同じ章の3つ。`drafting.py`(105-3)→ import を足していない(`UserSceneDraft` は既存)。
- `confirmations/items.py`・`__init__.py`(105-3)→ import を足していない・`legacy_user_keys`(105-3)。`confirmation_service.py`(105-3)→ `legacy_user_keys`・`RequirementsModel`(既存)。`doc_generator_service.py`(105-3)→ import を足していない。
- テスト: `test_paraphrase.py`(105-1)→ `paraphrase`(105-1)・`agreement_items`・`protect_external_design`・`merge_draft`・`to_drafts`・見本の fixture(既存)。`test_external_design_protection*.py`(105-2)→ `service_match_key`(105-2)・`paraphrase_service`・`paraphrase_external_design`(105-1)。105-3 のテストは `assign_user_ids`・`number_users`・`UserSceneDraft`・`legacy_user_keys`・`ConfirmationItem`・`paraphrase_requirements`(105-1・105-3・既存)。`test_fake_llm_e2e.py` の 105-1 の分は、105-3 の名前を import しない。

各章のテストは、その章で作成・更新した全ファイルを少なくとも1度 import する(#15)。105-2 の `items.py`・`protection.py`・`__init__.py` は `test_external_design_protection.py` が `app.agreements` から通す。105-3 の `model.py`・`assemble.py`・`__init__.py`・`drafting.py`・`confirmations` は `test_confirmation_items.py`、`agreements` は `test_agreement_protection.py`、2つのサービスは `test_confirmation_service.py`、`fake.py` は `test_fake_llm_e2e.py` が通す。例外: `confirmationsApi.ts` はコメントだけの変更で、動作が変わらないのでテストを足していない。

## 検証結果

- ユニット: 章ごとに章のテストと、関わるテスト(`-k "confirmation or requirements or agreement or protection or paraphrase or fake_llm or function_list or baseline or revision or doc_generator"`)を流した。
- devex-api: `ruff check`(app・tests): 通った。`pyright`(触ったファイル): 0 件。`ruff format` は使っていない(import の並びだけ `ruff check --select I --fix`)。
- 全体テスト: devex-api はユニット 1879 件・統合 42 件(専用のテスト DB)がすべて通った。devex-ui はコメントだけなのでテストを流していない。
- 開発 DB(読み取りだけ): Phase 104 のコード(`2a8ffc6`。一時的な worktree)とこの Phase のコードで、開発 DB の要件定義書のすべての版(245)の md と、詳細設計モードのすべての CR(18件)の説明書の md の sha256 を比べ、すべて同じだった(利用者の ID は md に出ず、要約は古くならない)。確認事項の古いキーの付け直しは、開発 DB では行っていない(一覧を開いたときに動く)。
- マイグレーション: 無い。
- `textbook/tools/samples_check.py --api-since 2a8ffc6 --ui-since phase-99`: 不一致 0・本体のみ 0(一致 1024 / 並び順のみ差 8 / 例外 5)。devex-api にタグ `phase-104` が無いので、Phase 104 のコミットを渡した。
- `textbook/tools/link_check.py`: リンク切れ 0 件。
- 実 LLM: 使っていない(費用 0)。要件定義書のプロンプトに「前の版の利用者」の節と規則の1文を足したが、実 LLM が `prev_id` を書くかは確かめていない(申し送り)。
- E2E: 流していない(Phase 110 で言い換えの spec を足して全部流す)。

## 未消化の申し送り(#37)

[Phase 104](../Phase-104/Phase-104-introduction.md#未消化の申し送り37) から引き継いだもの。

**ステージ13 の中で扱うもの**(行き先は [100-4](../Phase-100/Phase-100-4.md)):
- **規模・要約・選択肢・共有リンクの画面**(P101〜P104)→ Phase 107。P101〜P104 の分はそのまま。
- **クライアントの画面**(P103・P104)→ Phase 108。そのまま。
- **コメントの削除・編集**(P104)→ Phase 107〜109 の画面確認で、要るかを決める。
- **CR で書き換えた行の確認事項の状態**(P99)→ Phase 106・109。確認事項を未確認に戻すとき、推測の利用者は `user:<ID>` のキーで指せる(この Phase)。
- **段階2・3・7 の処理 ID の参照の切れ**(P99)→ Phase 106・109。この Phase の言い換えの規則(`paraphrase_function_list`)で確かめられる。
- **起点に選べる要素の種類**(P96)・**束の一覧の入れた CR**(P88)・**巡回で消えた版の戻しの履歴**(P95)・**生成で作り直したまま DFD・データ辞書だけを直した承認**(P99)→ Phase 106・109。
- **束の段階が古いと、予測が少なく出る**(P100)→ 束を作り直すかは開発者の運用で、Phase 110 の新しい CR の前に決める(残す)。
- **Phase 110 の新しい CR の題材**: 選択肢が自然に2つ以上ある変更(100-4)。下書きを実 LLM で作るなら、費用の見積もりを計画に出す。E2E に共有リンクの流れの spec を足す(閲覧・コメント・合意。認証なしの入口は、開発用の上限1000回の中で流す)。
- **言い換えの E2E の spec**(この Phase で生まれた)→ Phase 110。プロジェクトの概要に `[言い換え]` を書き、合意の後の再生成で、外部連携が1行に戻る・確認事項の推測の利用者のメモが残る・段階1 の処理 ID が変わらないことを画面で通す。
- **実 LLM が利用者の `prev_id` を書くか**(この Phase で生まれた)→ Phase 110 の効果測定で、要件定義書を作り直したときに見る(書かなくても、名前・場面の2段目で引き継ぐ)。

**ステージ13 の範囲の外**:
- **使い勝手(主に UI)の見直し**: ステージ13 の後に回す。
- **本番への反映と本番での確認**: ステージ15 の完了時に、[`OPERATIONS.md`](../../devex-api/OPERATIONS.md) 10.8節で行う。マイグレーション `a7c3e5d91f20`(P102)・`c5d8e2f4a613`(P103)・`d7e1f3a5b802`・`e8f2a4b6c913`(P104)を 10.8節に入れる(Phase 110)。Phase 101 の説明書の md の変化で、以前の要約がすべて「古い」になることも 10.8節に書く(Phase 110)。本番の `.env` では `SHARE_RATE_LIMIT_PER_IP_PER_HOUR`・`SHARE_WRITE_RATE_LIMIT_PER_IP_PER_HOUR` を置かず、既定の60回・20回を使う(10.8節に1行)。この Phase の分は、マイグレーションが無く、確認事項の古いキー(`user:<名前>`)が一覧を開いたときに付け直ることを、10.8節の確認の表に1行足す(Phase 110)。
- **要約・選択肢の下書きの生成の回数の上限**: 使われ方を見て決める。
- 振り返り 6節の残り5件・生成の質の候補4件(Phase 100 と同じ)。

**持ち越し**(触るときに直す。中身は [振り返り](../retrospectives/project-retrospective.md) 8節):
- `test_chat_service.py` などの pyright の指摘(Phase 40)
- devex-ui の並列のテストのタイムアウト(Phase 44)
- 偽 LLM の外部設計書の GET に DF が無い(Phase 45。この Phase は偽の LLM を触ったが、言い換えのモードに関係しないので直していない)
- `DfdEditorTabs` のテストのまれな失敗(Phase 77)
- Google の公開鍵を毎回取りに行く(Phase 74)
- `ListCard` の入れ物(Phase 79。テンプレートでは直した)
- 英語のままの refresh の失敗の文(Phase 79)
- `streamChat.test.ts` の lint の警告(既存)
- `appendix/measurements/stage11/measure.py` の `ruff check` の指摘(Phase 80 から)
- 反映の後の CR の流れの部品・束の写しの取り出し(#17。触るときに寄せる)
- `tagmerge.py` の、複数の章が触るファイルの章の振り分け(振り返り 17.7)と、メソッドの中身を移す変更の扱い(P104)。この Phase では、前の章の終わりの形を一時的に作って2回に分けて当てると、章の振り分けを手で直さずに済んだ(4ファイル)。関数を2つに分ける変更(`confirmation_service.py` の `_items`)は、P104 と同じく対応がずれて手で組み直した。振り返りで、この当て方を道具の手順に書くかを決める。

**ユーザーが決めるもの**:
- **開発環境の後始末**: 確認用の利用者・プロジェクト。「トレンド追跡アプリ」は Phase 110 の効果測定の題材なので残す(この Phase では読むだけ)。
- **この Phase の未コミット**: 外側のリポジトリ(教材・docs・samples・q_a)・devex-api・devex-ui(`confirmationsApi.ts` のコメント。`tableStyles.ts` は始める前から)。devex-api のタグ `phase-101`〜`phase-105` も未作成。コミットはユーザーが行う(#35)。

**この Phase で解決したもの**:
- **名称を言い換える偽の LLM**(振り返り 17.6)→ [105-1](./Phase-105-1.md)。E2E の spec は Phase 110。
- **外部連携のサービス名の言い換えで残る重複**(P99)→ [105-2](./Phase-105-2.md)。
- **推測の利用者のキーが名前**(P94)→ [105-3](./Phase-105-3.md)。
- Phase 105 の未確定事項(100-4)→ 「着手時の相談で決めたこと」。

**この Phase で生まれたもの**:
- 上の「言い換えの E2E の spec」「実 LLM が利用者の `prev_id` を書くか」と、10.8節の確認の表の1行。
- **セッションの区切りの記録**: Phase 105 は1セッションで行った。
  1. 計画モードで調査(エージェントは使わず直接読んだ)・質問1回(4問)・計画の承認
  2. 105-1 の実装とテスト
  3. 105-2 の実装とテスト
  4. 105-3 の実装とテスト(全体テストで、ID が入って期待が変わったテスト8件を直した)
  5. 全体テスト(devex-api のユニット・統合)・pyright・開発 DB の確かめ(md の sha256)
  6. samples(`tagmerge.py` を、前の章の終わりの形を挟んで2回に分けて当てた)
  7. docs・教材

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

設問は Phase の要点の要約である(回答は求めない)。

1. 言い換えのモードを環境変数でなくプロジェクトの印で決めたのはなぜか。ステートレスな偽の LLM は、段階1 のプロンプトでどうやって印と「作り直した」ことを知るか。
2. 要件の文を言い換えの対象にしなかったのはなぜか。言い換えに元から耐える要素と、耐えない要素を分けるものは何か。
3. 外部連携の重複を、同じ要件 ID でなく正規化した名前で判定したのはなぜか。合意のキーそのものを正規形に変えなかったのはなぜか。
4. 利用者の ID を合意の比べる値から除いたのはなぜか。ID を振る前に保存した版・合意・確認事項の記録は、それぞれどうやって ID とつながるか。
5. 推測の利用者の ID の引き継ぎで、場面の候補が2つ以上あるときに新しい ID にするのはなぜか。

## 次のフェーズ

**Phase 106**: 段階の参照の切れと、合意の周りの残り(API)。着手時に、[100-4](../Phase-100/Phase-100-4.md) の Phase 106 の未確定事項(段階2・3・7 の一覧で付け替えと削除のどちらまでできるか・確認事項を未確認に戻す時点とクライアントが共有リンクで合意した案の文の扱い・起点に足す種類・DFD・データ辞書の直しを「人が直した」とみなす判定)を決める。段階2・3・7 の参照の切れは、この Phase の言い換えの規則(`paraphrase_function_list`)で確かめられる。
