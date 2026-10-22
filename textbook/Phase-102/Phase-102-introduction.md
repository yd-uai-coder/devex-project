# Phase 102 導入: 選択肢つきの説明 API(ステージ13)

## 目的

ステージ13(説明とすり合わせ)の2つ目の実装 Phase。[100-4](../Phase-100/Phase-100-4.md) の Phase 102 にあたる。

クライアントが説明書だけで判断するには、「この変更をするか・しないか」だけでなく、「どう進めるか」を選べるとよい。ステージ6 のヒアリングでは、AI の問いに選択肢カード(選択肢ごとの結果とおすすめ)を付けて、利用者が選ぶ形にした。この Phase では、同じ形を CR に移す(決定2。[100-1](../Phase-100/Phase-100-1.md))。

- CR に2〜3の案を持たせる。案ごとに、変える要件(CR の対象のうちのどれか)と変更後の文・結果を持ち、規模は案ごとに数える ── [102-1](./Phase-102-1.md)
- 案を API で保存し、合意では案を選ぶ。選んだ案の対象を CR の対象にし、反映はその案で行う ── [102-2](./Phase-102-2.md)
- 説明書に「選択肢」の節を入れ、規模の表を種類 × 案にして、案を手間で比べられるようにする ── [102-3](./Phase-102-3.md)
- LLM に案の下書きを作らせ、照合を見て開発者が取り込む ── [102-4](./Phase-102-4.md)

画面(案の編集・下書き・規模の表)は Phase 107。共有リンク(Phase 103・104)では、クライアントがこの説明書を読み、案を選んで合意する。

## パイプライン上の位置づけ・前提

```
CR(対象の要件・新しい要件の起点)+ 案(options: 案ごとの対象の部分集合・変更後の文・結果・おすすめ)
   │                                   ▲ 取り込む(adopt。案を直す更新と同じ経路)──[102-4]
   │                                   │
   │                         LLM の下書き(説明書の md だけを入力。未確認 / 取り込み済み・照合)
   │ predict_from_snapshots(CR の対象 = すべての案を合わせた範囲)
   │ option_scales ──[102-1]── 案ごとに predict_from_snapshots + predicted_scale(Phase 101)
   ▼
build_explanation ──[102-3]── 1 内容 / 2 対象 / 3 選択肢 / 4 規模(種類 × 案)/ 5 影響 / 6 確かめたい点
   │
   ▼ 合意(option = 選んだ案の番号)──[102-2]
CR の対象 := 選んだ案の対象(前の対象は時系列の refs)・decision_option
   │ 予測の保存・反映の指示(「合意した案」の1行)・比較・検証は、今までどおり CR の対象で
   ▼
反映
```

- **前提として読むもの**: [100-1](../Phase-100/Phase-100-1.md)(決定2)・[100-4](../Phase-100/Phase-100-4.md)(Phase 102 の未確定事項)・[Phase 101](../Phase-101/Phase-101-introduction.md)(規模と説明書の節)・[Phase 84](../Phase-84/Phase-84-introduction.md)(説明書と要約。下書きは要約と同じ考え)・[Phase 35](../Phase-35/Phase-35-introduction.md)(選択肢カード)。
- **今の仕組み**:
  - CR の対象は `targets`(要件 ID・種類・変更後の案)。予測の保存(合意・却下の時点)・書き換えてよい要素・反映の指示・比較・検証・重なりは、どれもこの `targets` を読む。
  - 説明書は5節(Phase 101)。要約は説明書の md の指紋で「古い」を決めるので、md が変わると以前の要約はすべて古くなる。
  - 要約の LLM は、利用者の生成の用途で解決し、説明書の md だけを渡す。
- **この Phase を始めた時点の状態**: 外側のリポジトリは `a3d10ad`(Phase 101 までコミット済み)。devex-api は `stage11-15` ブランチの `0d51a45`(Phase 101。タグ `phase-101` はまだ無い)、devex-ui は `main` の `511c5e6`(`tableStyles.ts` だけ未コミット。ユーザーの編集)。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(本体 + samples)。この Phase で変えるのは devex-api だけ。

E2E: この Phase では流さない。ステージ13 の E2E は Phase 110 で既存を含めて全部流す(#36)。案の無い CR の説明書は変わらず、応答は項目を足すだけで、devex-ui は変えない(画面は Phase 107)。E2E の偽 LLM には下書きの出力を足した(102-4)。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 102 開始時」を参照する。計画モードで2回(4問・1問)聞いた。

| # | 問い | 決定 |
|---|---|---|
| 1 | 自動実装モード | on(推奨どおり) |
| 2 | 案の持ち方・案ごとの対象 | CR の JSON の列 `options`(0件か2〜3件)。案ごとに CR の対象の部分集合と、対象ごとの種類・変更後の案。規模は案の対象で数える。合意で選んだ案の対象を CR の対象にする(推奨どおり) |
| 3 | LLM の下書き | 要約と同じく CR ごとに1行の表。照合は CR の対象に無い要件 ID と、説明書に無い数字。「取り込む」で案に写し、取り込んだ案は開発者が書いた案と同じ扱い。モデルは要約と同じ生成の用途(推奨どおり) |
| 4 | 結果の欄 | 1つの自由記述(選択肢カードと同じ)(推奨どおり) |
| 5 | 案のある CR の説明書 | 3 選択肢 / 4 規模(種類 × 案の表)/ 5 影響(すべての案を合わせた範囲)/ 6 確かめたい点。案の無い CR は5節のまま。合意の後は今の規模の表に戻す(推奨どおり) |

Claude の判断(計画の承認で確定、または実装中):

- 案は0件か2〜3件。名前は重ねない。どの案も対象を1つ以上持つ(新しい要件を足す CR は0件でもよい)。新しい要件の印と起点は CR に1つで、どの案にも共通。
- おすすめは案の番号と理由(どちらも任意。番号があれば理由は必須)。案は位置の番号(案1〜3)で呼ぶ。案を直すと、ほかの項目と同じく説明済みは下書きに戻る。
- 合意: 案のある CR では案の選択を必須に、案の無い CR・却下で選んだら 422 `CR_OPTION_INVALID`。番号を `decision_option` に残す。
- 反映の指示に「合意した案: 名前(結果)」の1行。たどる記録の合意の行に選んだ案。却下した CR の写しは案も写す。
- 案の規則は、案だけで決まるもの(スキーマで 422)と、CR の対象が要るもの(サービスで `CR_OPTION_INVALID`)に分けた。対象を減らして案が外れたら、更新を断る。
- 下書きの照合のうち、案の規則と CR の対象に合わないものは取り込みを止め、説明書に無い要件 ID・数字は知らせるだけ(要約と同じく人が判断する)。下書きは直さず、取り込んだ後の案を直す。取り込みは案を直す更新(`update`)をそのまま通す。
- 下書きは合意・却下の後は作れない。回数の上限は付けない(要約と同じ)。
- 下書きの表は 102-4 で使うが、マイグレーションを1本にするため 102-2 で作った。
- 2節の空の変更後の案は、案のある CR の合意の前だけ「(3節の案を参照)」にした。規模の表には内訳を入れない(手間の比較が目的。内訳は合意の後の規模の表で読める)。
- テンプレートから取り込むものは無い。

推奨と違った選択は0件。計画の差し戻しは無し。#39 の材料。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-102-1.md`](./Phase-102-1.md) | 案の形と案ごとの規模(純粋関数) | あり(本体 2 + テスト 1。新規 2) | Phase 101(規模)・83(予測) |
| [`Phase-102-2.md`](./Phase-102-2.md) | 案の保存・合意で選ぶ案・反映(API) | あり(本体 11 + テスト 4。新規 3) | 102-1 |
| [`Phase-102-3.md`](./Phase-102-3.md) | 説明書の選択肢の節 | あり(本体 3 + テスト 3) | 102-1・102-2 |
| [`Phase-102-4.md`](./Phase-102-4.md) | 案の LLM の下書き | あり(本体 8 + テスト 5。新規 3) | 102-1〜102-3 |

## サンプルコード一覧

すべて `textbook/samples/backend/`。

- 102-1: `app/change_requests/options.py`・`tests/unit/test_change_request_options.py`(新規)、`app/change_requests/__init__.py`(更新)。
- 102-2: `alembic/versions/a7c3e5d91f20_add_change_request_options.py`・`app/models/change_request_option_draft.py`・`tests/unit/test_change_request_option_service.py`(新規)、`app/models/__init__.py`・`app/models/change_request.py`・`app/repositories/change_request.py`・`app/change_requests/explanation.py`・`instruction.py`・`trace.py`・`app/services/errors.py`・`app/schemas/change_request.py`・`app/services/change_request_service.py`、`tests/unit/test_change_request_service.py`・`test_change_request_instruction.py`・`test_change_requests_api.py`(更新)。
- 102-3: `app/change_requests/explanation.py`・`summary.py`・`app/schemas/change_request.py`、`tests/unit/test_change_request_explanation.py`・`test_change_request_summary.py`・`test_change_requests_api.py`(更新)。
- 102-4: `app/change_requests/option_drafting.py`・`app/repositories/change_request_option_draft.py`・`tests/unit/test_change_request_option_drafting.py`(新規)、`app/change_requests/__init__.py`・`app/services/errors.py`・`app/schemas/change_request.py`・`app/services/change_request_service.py`・`app/api/routes/change_requests.py`・`app/ai/llm/fake.py`、`tests/unit/test_change_request_option_service.py`・`test_change_requests_api.py`・`test_fake_llm_e2e.py`・`tests/integration/test_change_requests_flow.py`(更新)。
- ミラーしないもの(#21 の共通): 無し(インフラ・設定ファイルは変えていない)。
- 更新したファイルは `tagmerge.py` で当てた。複数の章が触るファイル(`__init__.py`・`explanation.py`・スキーマ・`errors.py`・サービス・`test_change_requests_api.py`)は、主な章を既定にして当て、ほかの章の分のタグ(import の追記の行・クラス・メソッド・テストの行)と docstring の記録の行を手で直した(道具の「要手当て」の範囲。振り返り 17.7)。新規の `test_change_request_option_service.py` は 102-2 で作り、102-4 の分を `追記` のタグで足した。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 作成・更新するファイル | 責務(1行) | テスト観点 |
|---|---|---|---|
| 102-1 | `options.py` | 案の型・規則・CR の対象との照らし合わせ・保存の形・案ごとの規模 | 規則(数・名前・結果・おすすめ)・CR の対象の外・往復・案ごとの規模の違い・起点の無い案 |
| 102-1 | `__init__.py` | 案の名前を re-export | (各テストが import する) |
| 102-2 | マイグレーション・`models/change_request.py`・`change_request_option_draft.py` | 案と選んだ番号の列、下書きの表 | (サービスのテストと統合テストが通す) |
| 102-2 | `schemas/change_request.py` | 案の入力(規則は 422)・合意の `option`・詳細の `options` | 規則の 422・詳細の番号と呼び名 |
| 102-2 | `change_request_service.py`・`errors.py` | 作成・更新で案を確かめる、合意で選んだ案の対象を CR の対象にする、写し | 選ばない・無い番号・却下で選ぶの 422、対象の差し替えと前の対象の記録、保存した予測の対象 |
| 102-2 | `explanation.py`(Facts)・`instruction.py`・`trace.py` | 反映の指示とたどる記録に選んだ案 | 合意した案の1行・合意の行のメモ |
| 102-3 | `explanation.py`・`summary.py`・スキーマ | 選択肢の節・種類 × 案の規模・節の番号の送り・`option_scales` | 6節の並び・表・合意の後・案が無いときの md が同じ |
| 102-4 | `option_drafting.py` | 下書きの入力・構造化出力・案への変換・照合 | 入力は説明書だけ・切り方・照合の2段 |
| 102-4 | リポジトリ・サービス・ルート・`errors.py`・`fake.py` | 下書きを作る・読む・取り込む(更新と同じ経路) | 404・未確認・取り込みで案と下書きに戻る・作り直し・取り込めない下書き・合意の後は作れない・偽 LLM の契約 |

## 写経順序(#23)

章番号順。各章の「作成・更新したファイル」表は依存順に並べた(#30)。

実 import 監査(#15)として、各ファイルの全 import 文を読んだ。import 先のモジュールとシンボルの誕生章が、そのファイルの章以下であることを確かめた。

- `options.py`(102-1)→ `prediction.predict_from_snapshots`(Phase 83)、`scale.Scale`・`predicted_scale`(Phase 101)、`targets.Target`・`normalize_targets`・`targets_from_json`・`targets_to_json`(Phase 83・84)。
- `__init__.py`(102-1・102-4)→ 102-1 で `options` の名前、102-4 で `option_drafting` の名前。
- `models/change_request_option_draft.py`(102-2)→ `app.core.database`(既存)。`models/__init__.py`(102-2)→ 同じ章のモデル。
- `explanation.py`(102-2・102-3)→ 102-2 で `options.ChangeOptions`(102-1)、102-3 で `OptionScale`・`option_label`・`option_scales`(102-1)。
- `instruction.py`(102-2)→ `options.option_label`(102-1)。`trace.py`(102-2)→ import の追加なし。
- `schemas/change_request.py`(102-2〜102-4)→ 102-2 で `pydantic.model_validator` と `ChangeOptions`・`normalize_options`・`option_label`・`options_from_json`・`options_from_rows`・上限の定数(102-1)、102-3 で `OptionScale`(102-1)、102-4 で `OPTION_DRAFT_STATUS_LABEL`・`OptionDraftCheck`・`OptionDraftStatus`(102-4)と `ChangeRequestOptionDraft`(102-2。型だけ)。
- `change_request_service.py`(102-2・102-4)→ 102-2 で `ChangeOptions`・`option_label`・`option_target_problems`・`options_from_json`・`options_to_json`(102-1)と `ChangeRequestOptionInvalidError`(102-2)、102-4 で `option_drafting` の名前(102-4)・`normalize_options`(102-1)・`ChangeRequestOptionDraft`(102-2)・`ChangeRequestOptionDraftRepository`・`ChangeRequestOptionDraftNotFoundError`(102-4)・`ChangeRequestOptionsIn`(102-2)・`invoke_structured`(既存)。
- `option_drafting.py`(102-4)→ `explanation.Explanation`・`check_summary`(Phase 84)、`options` の名前(102-1)、`summary.MAX_EXPLANATION_CHARS`(Phase 84)、`targets.Target`・`TargetKind`(既存)。`repositories/change_request_option_draft.py`(102-4)→ 下書きのモデル(102-2)。`routes/change_requests.py`(102-4)→ `OptionDraftRead`・`OptionDraftView`(102-4)。`fake.py`(102-4)→ `option_drafting` の出力の型(102-4)。
- テスト: `test_change_request_options.py`(102-1)→ 102-1 の名前と既存の fixture。`test_change_request_option_service.py` の 102-2 の分は 102-2 までの名前だけ(下書きの import と `_draft_llm` 以降は 102-4 の `追記`)。`test_change_requests_api.py` は、102-2 の `test_option_routes` の中の説明書の確かめを 102-3 の `追記` にし、下書きのルートの import とテストを 102-4 の `追記` にした。

各章のテストは、その章で作成・更新した全ファイルを少なくとも1度 import する(#15)。102-2 の下書きのモデル・`models/__init__.py`・リポジトリ・`trace.py`・`explanation.py` は、サービスのテストが `app.models`・`app.change_requests` とサービスを通して import する。

## 検証結果

- ユニット: 章ごとに、章のテストと CR のテスト(`-k change_request`)を流した。
- devex-api: `ruff check`(app・tests): 通った。`pyright`(触ったファイル): 0 件。`ruff format` は使っていない。
- 全体テスト: devex-api はユニット 1808 件・統合 40 件(専用のテスト DB)がすべて通った。devex-ui は変えていない。
- マイグレーション: 開発 DB で heads が1つ・ID が重ならないことを確かめ、`a7c3e5d91f20` を upgrade → downgrade → upgrade した。
- 開発 DB(読み取りだけ): Phase 101 のコード(`0d51a45`)とこの Phase のコードで、開発 DB のすべての CR(17件)の説明書の出力の sha256 を比べ、すべて同じだった(案の無い CR の md は変わらず、要約は古くならない)。
- `textbook/tools/samples_check.py --api-since 0d51a45 --ui-since phase-99`: 不一致 0・本体のみ 0(一致 1005 / 並び順のみ差 8 / 例外 5)。devex-api にタグ `phase-101` が無いので、Phase 101 のコミットを渡した。
- `textbook/tools/link_check.py`: リンク切れ 0 件。
- 実 LLM: 使っていない(費用 0)。
- E2E: 流していない(Phase 110 で全部流す)。

## 未消化の申し送り(#37)

[Phase 101](../Phase-101/Phase-101-introduction.md#未消化の申し送り37) から引き継いだもの。

**ステージ13 の中で扱うもの**(行き先は [100-4](../Phase-100/Phase-100-4.md)):
- **規模・要約・選択肢の画面**(P101・この Phase)→ Phase 107。CR の詳細に規模の表、比較のタブに予測と実際の数、説明書のタブに `needs_reconfirm` の知らせ。この Phase の分: 案の編集(名前・案ごとの対象の選び方と変更後の文・結果・おすすめ)、LLM の下書きの作成・照合の表示・取り込み、合意の欄の案の選択(案のある CR で必須)、説明書のタブの `option_scales`。`CR_OPTION_INVALID`・`CR_OPTION_DRAFT_NOT_FOUND` のエラーの文。
- **共有リンクで案を選ぶ**(この Phase で生まれたもの)→ Phase 104・108。クライアントの合意の記録に選んだ案を入れるときは、この Phase の `decide` の `option` と同じ規則(選んだ案の対象を CR の対象にする)を通す。
- **CR で書き換えた行の確認事項の状態**(P99)→ Phase 106・109。
- **外部連携のサービス名の言い換えで残る重複**(P99)→ Phase 105。
- **名称を言い換える偽の LLM**(振り返り 17.6)→ Phase 105。
- **段階2・3・7 の処理 ID の参照の切れ**(P99)→ Phase 106・109。
- **推測の利用者のキーが名前**(P94)→ Phase 105。
- **起点に選べる要素の種類**(P96)・**束の一覧の入れた CR**(P88)・**巡回で消えた版の戻しの履歴**(P95)・**生成で作り直したまま DFD・データ辞書だけを直した承認**(P99)→ Phase 106・109。
- **束の段階が古いと、予測が少なく出る**(P100)→ 束を作り直すかは開発者の運用で、Phase 110 の新しい CR の前に決める(残す)。
- **Phase 110 の新しい CR の題材**: 選択肢が自然に2つ以上ある変更(100-4)。下書きを実 LLM で作るなら、費用の見積もりを計画に出す。

**ステージ13 の範囲の外**:
- **使い勝手(主に UI)の見直し**: ステージ13 の後に回す。
- **本番への反映と本番での確認**: ステージ15 の完了時に、[`OPERATIONS.md`](../../devex-api/OPERATIONS.md) 10.8節で行う。この Phase のマイグレーション `a7c3e5d91f20`(列2つと表1つを足すだけ。既存の行は NULL)も 10.8節に入れる(Phase 110)。Phase 101 の説明書の md の変化で、以前の要約がすべて「古い」になることも 10.8節に書く(Phase 110。この Phase では md は変わらない)。
- **要約・選択肢の下書きの生成の回数の上限**: 使われ方を見て決める。
- 振り返り 6節の残り5件・生成の質の候補4件(Phase 100 と同じ)。

**持ち越し**(触るときに直す。中身は [振り返り](../retrospectives/project-retrospective.md) 8節):
- `test_chat_service.py` などの pyright の指摘(Phase 40)
- devex-ui の並列のテストのタイムアウト(Phase 44)
- 偽 LLM の外部設計書の GET に DF が無い(Phase 45。Phase 105 で直せる)
- `DfdEditorTabs` のテストのまれな失敗(Phase 77)
- Google の公開鍵を毎回取りに行く(Phase 74)
- `ListCard` の入れ物(Phase 79。テンプレートでは直した)
- 英語のままの refresh の失敗の文(Phase 79)
- `streamChat.test.ts` の lint の警告(既存)
- `appendix/measurements/stage11/measure.py` の `ruff check` の指摘(Phase 80 から)
- 反映の後の CR の流れの部品・束の写しの取り出し(#17。触るときに寄せる)
- `tagmerge.py` の、複数の章が触るファイルの章の振り分け(振り返り 17.7)。この Phase でも6ファイルで手で直した。1つのファイルを3つの章が触ると、import の追記の行を章ごとに分ける手間が大きい。

**ユーザーが決めるもの**:
- **開発環境の後始末**: 確認用の利用者・プロジェクト。「トレンド追跡アプリ」は Phase 110 の効果測定の題材なので残す(この Phase では読むだけ)。
- **この Phase の未コミット**: 外側のリポジトリ(教材・docs・samples)・devex-api(開発 DB はマイグレーション済み)。devex-ui の `tableStyles.ts`(始める前から)。devex-api のタグ `phase-101` も未作成。コミットはユーザーが行う(#35)。

**この Phase で解決したもの**:
- **選択肢つきの説明**(位置付け・決定2)→ [102-1](./Phase-102-1.md)〜[102-4](./Phase-102-4.md)。画面は Phase 107。
- Phase 102 の未確定事項 → 「着手時の相談で決めたこと」。

**この Phase で生まれたもの**:
- 上の「共有リンクで案を選ぶ」(Phase 104・108)と、画面の分(Phase 107)。
- **セッションの区切りの記録**: Phase 102 は1セッションで行った。
  1. 計画モードで調査(エージェントは使わず直接読んだ)・質問2回(4問・1問)・計画の承認
  2. 102-1 の実装とテスト
  3. 102-2 の実装とテスト(マイグレーションを含む)
  4. 102-3 の実装とテスト(説明書の試し出しで見た目を確かめた)
  5. 102-4 の実装とテスト(偽 LLM・統合テストを含む)
  6. 開発 DB の確かめ(Phase 101 のコードとの説明書の比較・マイグレーションの往復)・全体テスト(devex-api のユニット・統合)
  7. samples(`tagmerge.py`。複数の章が触るファイルのタグは手で直した)
  8. docs・教材

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

設問は Phase の要点の要約である(回答は求めない)。

1. 合意で選んだ案の対象を CR の対象に差し替えると、反映の側(予測の保存・書き換えてよい要素・比較・検証)を変えずに済むのはなぜか。前の対象はどこに残るか。
2. 案の対象を CR の対象の部分集合に限ったのはなぜか。説明書の影響の一覧が「すべての案を合わせた範囲」になるのはなぜか。
3. 案の無い CR の説明書の md を1文字も変えないことが、なぜ大事か。どう確かめたか。
4. 下書きの照合で、取り込みを止めるものと知らせるだけのものを分けたのはなぜか。
5. 下書きの取り込みを、案を直す更新(`update`)と同じ経路にしたことで、何がそろうか。

## 次のフェーズ

**Phase 103**: 共有リンク API(閲覧)。着手時に、[100-4](../Phase-100/Phase-100-4.md) の Phase 103 の未確定事項(トークンの長さ・保存の形・期限の既定値と延長・CR ごとに複数のリンクを持てるか・公開の入口の回数の上限と応答の区別・「前回から変わった点」の材料・下書きに戻ったときのリンクの扱い)を決める。共有リンクで見せる説明書は、この Phase の選択肢の節と案ごとの規模を含む。
