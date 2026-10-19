# Phase 55 導入: 実装手順書の決定的な検証の強化

## 目的

ステージ8の測定 (e)(`results.md`)で、Sonnet のレビューは実装手順書に固有の欠陥を 8件中 1〜2件しか拾えず、今の実装可能性チェックも何も出していなかった。[51-2](../Phase-51/Phase-51-2.md) で「手順書はレビューせず、決定的な検証を強める」と決めた。この Phase では、機械で調べられる3つを段階8の検証に足す(両モード)。

- 判定の部品(純粋関数)── [55-1](./Phase-55-1.md)
- 実装可能性チェックへの組み込み・生成の指示・偽 LLM ── [55-2](./Phase-55-2.md)
- 題材と dev の DB での確認・docs ── [55-3](./Phase-55-3.md)

## パイプライン上の位置づけ・前提

```
段階7(簡易は実装計画書の WBS)の単位 ──┐
手順書(段階8の model)のファイル ───────┼─→ unit_files ─┬─ late_dependencies ─→ DEPENDENCY_BUILT_LATER(中程度)
モジュール一覧(段階4 / 内部設計書)────┤               ├─ has_test_file ─────→ NO_TEST_FILE(軽微)
テーブル(段階3の CRUD 図 / 内部設計書 3.2)┘               └─ table_coverage ────→ NO_SCHEMA_UNIT(最重要)/ TABLE_WITHOUT_UNIT(軽微)
                                                         └→ 「未定義・要決定の一覧」に「検証」として出る(画面は変えない)
```

- **前提として読むもの**: [51-5](../Phase-51/Phase-51-5.md) の Phase 55 の未確定事項、正解表 `truth-e.md` の実装手順書(PR-1〜8)、[`docs/internal_design.md`](../../docs/internal_design.md) 3.3節「5. 実装手順書」の実装可能性チェック。
- **今の仕組み**: 段階8の検証 `validate_procedure_doc` は、詳細設計モードでは手順書・段階3〜6 の参照、簡易モードでは WBS と内部設計書の書き落としを見る(Phase 27・29・31)。単位の依存の順は段階7の `depends_on` だけを見ていた(`FORWARD_DEPENDENCY`)。
- **この Phase を始めた時点の状態**: Phase 54 までコミット済み。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(AI が devex-api 本体へ実装し、`textbook/samples/` も同じ内容で作る)。

E2E: この Phase では流さない([51-5](../Phase-51/Phase-51-5.md) のとおり Phase 59)。E2E の偽 LLM の実装計画と手順書に、マイグレーションとテストのファイルを足した(新しい検証で警告が出ないように)。画面は変えていない。

実 LLM: 呼んでいない(費用 $0)。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 55 開始時」を参照。すべて推奨どおり。

1. **自動実装モード**: on。
2. **テーブルを作る単位の判定**: パス + テーブル名。どの単位にもスキーマのファイルが無ければ最重要1件、あればテーブルごとに、スキーマのファイルのパス・責務に名前の出ないテーブルを軽微で。
3. **重要度**: 正解表どおり(テーブル = 最重要、依存先が後 = 中程度、テストのファイル = 軽微)。
4. **テストのファイルの判定**: 種類 `test` か、パスがテストの形。

Claude の判断(計画の承認で確定、または作業中):

- **依存先の判定に使う情報**(51-5 の未確定事項): 詳細は段階4、簡易は内部設計書のモジュール一覧の `depends_on`。行の作り手は、その行のファイルを最初に作る単位。
- **直す先**: 依存とテーブルは段階7 / 実装計画書、テストのファイルは手順書(段階8)。スキーマのファイルが無いときは、モジュール一覧にスキーマの行が無ければ段階4 / 内部設計書。
- **生成の指示に1行**(テストのファイルを files に入れる)。効果は Phase 58。
- **章の分け方**: 計画では検証ごとに3章だったが、判定の部品(55-1)と組み込み(55-2)に分けた。検証ごとに分けると、検証の組み込み(`validation.py`)が後の章の部品を import する(前方 import。#15)ため。
- 作業中に決めたこと(dev の DB の誤検知から。[55-3](./Phase-55-3.md)): **基盤の単位のファイルの依存は見ない** / **依存先を作る単位か後の単位が依存する側のファイルも変更するなら見ない** / **`*` だけに当たる依存先は行を指さない** / **テーブル名の出ないスキーマのファイルは全テーブルを作るとみなす** / **単位が無ければ足さない**。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-55-1.md`](./Phase-55-1.md) | 判定の部品(単位が作るファイルの網羅と順序) | あり | なし |
| [`Phase-55-2.md`](./Phase-55-2.md) | 実装可能性チェックへの組み込み | あり | 55-1 |
| [`Phase-55-3.md`](./Phase-55-3.md) | 題材と dev の DB での確認・docs | なし(確認と docs だけ。#13・#15 の対象外) | 55-2 |

## サンプルコード一覧

- `textbook/samples/backend/`: 新規 `app/detailed_design/procedure_coverage.py`・`tests/unit/test_procedure_coverage.py`。更新 `app/detailed_design/validation.py`・`procedure_doc_drafting.py`・`app/ai/llm/fake.py`・`tests/fixtures/detailed_design.py`・`simple_procedure.py`・`tests/unit/test_procedure_doc_validation.py`・`test_simple_procedure_validation.py`・`test_procedure_doc_drafting.py`・`test_simple_wbs.py`・`test_detailed_design_plan_document.py`
- `textbook/samples/frontend/`: なし

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| [55-1](./Phase-55-1.md) | `app/detailed_design/procedure_coverage.py` | 単位が作るファイルを集め、依存の順・テストのファイル・スキーマのファイルを判定する | 後の単位 / 前・同じ単位・除くもの・判定表・単数形・まとめたファイル |
| [55-2](./Phase-55-2.md) | `app/detailed_design/validation.py`・`procedure_doc_drafting.py`・`fake.py` | 4つの指摘を両モードで重要度・直す先つきで出す | コードごとの出る / 出ない・直す先(段階 / 文書)・既存のスモークが0件のまま |
| [55-3](./Phase-55-3.md) | (docs) | 題材で正解表の3件、dev の DB で誤検知 | (使い捨てのスクリプト) |

## 写経順序(#23)

章番号順。各章の「この章で作成・更新したファイル」の表の順に写す。

実 import 監査(#15。全 import 文を読んで確かめた):

- 55-1: `procedure_coverage.py` は `collections.abc`・`dataclasses` と、`app.detailed_design.procedure_doc`(`PlanUnit`・`UnitFileKind`・`UnitProcedure`。Phase 27・28)・`app.detailed_design.structure`(`ModuleRow`・`module_ref_matches`・`path_variants`。Phase 19・26)。テストは同じ章の `procedure_coverage` と、`app.detailed_design.plan.PlanTask`・`procedure_doc`(`PlanUnit`・`UnitFile`・`UnitProcedure`)・`structure.ModuleRow`(以前の Phase)。
- 55-2: `validation.py` の追記は 55-1 の `procedure_coverage`(`RowOf`・`has_test_file`・`is_schema_path`・`late_dependencies`・`table_coverage`・`unit_files`)と、`app.detailed_design.simple_procedure.module_layer`(Phase 31)・`structure.ModuleRow`(Phase 19)。`procedure_doc_drafting.py`・`fake.py`・フィクスチャは import を変えていない。
- 前方 import は無い。章が作成・更新するファイルは、その章のテストが少なくとも1度 import する(`fake.py` は `test_fake_llm_simple_procedure.py`、フィクスチャは各テストが通る)。

## 検証結果

- 章ごとの部分テスト: 55-1 `test_procedure_coverage.py` 28件、55-2 `test_procedure_doc_validation.py`・`test_simple_procedure_validation.py`(計29件)と `tests/unit -k "procedure or wbs or plan_document"`、すべて成功。
- Phase 完了時の全体テスト(#18): devex-api 1208 件成功(8件は既定で除外の統合テスト)。devex-ui は触っていないので流していない。
- `ruff check` 成功(`ruff format` は使わない)。pyright: `app` 全体でエラー 0。
- 題材(simple-2)で正解表の PR-1・PR-3・PR-5 がすべて当たった。dev の DB(28 プロジェクト)の誤検知を3つの形で除いた([55-3](./Phase-55-3.md))。
- 実 LLM: 呼んでいない。
- `samples_check.py`(`--api-since HEAD --ui-since HEAD`): 不一致 0 件・作り忘れ 0 件(一致 637 / 並び順のみ差 8 / 例外 5)。「samples のみ」2件は以前からの `change-impact-demo` のルート。`link_check.py`: 切れ 0 件。

## 未消化の申し送り(#37)

Phase 54 から引き継いだもの:

- **Phase 56〜59 の未確定事項**: [51-5](../Phase-51/Phase-51-5.md)「未確定事項」(Phase 55 の分はこの Phase で決めた)。
- **「AI に提案を求める」・判定がログインの方法だけでセキュリティを埋めた・初期入力だけで MVP の範囲が対象外になった**: 差し戻しと聞き直しは Phase 54 で作った。効果は Phase 58 で確かめる。
- **テスト仕様書の中身の正しさ**: Phase 56・58。
- **実装手順書に固有の欠陥のうち、決定的に調べられないもの**: PR-2(テスト観点が正常系だけ)・PR-4(テストの期待と要件の食い違い)・PR-6(要件の失敗の扱いの抜け)・PR-7(マイルストーンのゴールと単位の食い違い)・PR-8(層の規則に合わないファイル)。レビューの対象外のまま(51-5「範囲の外」)。Phase 58 で残りを数える。
- **プロンプトキャッシュ**: 入れていない。回のキャッシュのトークンを Phase 58 の測定で見て決める。
- **本番の手順**: `ANTHROPIC_API_KEY` の設定と superuser の昇格、`langchain-anthropic` の追加でイメージの作り直し、Phase 54 の Alembic 3本(Phase 59 の `OPERATIONS.md`)。
- **依存の更新**: `langchain-anthropic` の追加で `langchain-core` が 1.6.10 に上がった(Phase 52)。
- **生成のモデルと Gemini の無料枠**(51-1 の (f)): ステージ8の範囲の外。
- **devex-ui の「開発用」メニュー**: ステージ8の完了時に、ユーザーが外すかを決める。
- **画面の確認**(ユーザー。#37 の運用注記のとおり Phase 58・59 でまとめてよい): Phase 53 のパネルの長さ・対象の推定の当たり、Phase 54 のチップ・「採用 n(未対応 m)」・前の回で採用した指摘・「AI: 直った」・再生成のダイアログ・「採用した指摘で段階を作り直す」・「チャットで聞き直す」・各段階のバッジの強調・承認の知らせ。この Phase の指摘は、手順書の「未定義・要決定の一覧」に出る(画面は変えていない)。
- **再生成の失敗を画面で知らせていない**(Phase 53 の完了後の調整から)。
- **dev の DB の事故の後始末**(Phase 54): ほかのプロジェクトの変更の影響の印は戻らない(段階を直して承認し直すと、また記録される)。
- **段階の作り直しの後に承認できない**(Phase 54): 差し戻しで作り直した段階の検証のエラーの見せ方は未検討。
- **「直ったか」の判定の精度**・**前の回で採用した指摘が積み上がる**・**段階の写しの大きさ**・**聞き直しのあとの再生成は利用者が押す**(Phase 54): Phase 58 で判定の精度を見てから決める。
- 持ち越し: **DFD のデータストアの書き漏れ**(49-2 から)・**補いの文字の当たり**(Phase 48 から)・**画面の文の変更は、その画面のすべての処理へ届く**(49-4 から)・**改名の後に下流の参照を直して承認すると広がる**(Phase 43 から)。
- 持ち越し(触るときに直す): **`test_chat_service.py` の pyright の指摘4件**(Phase 40 から)・**並列のテストのタイムアウト**(Phase 44 から)・**偽 LLM の外部設計書の GET に DF が無い**(Phase 45 から)。

この Phase で生まれたもの:

- **スキーマのファイルを作る単位を、計画の生成で作らせていない**: dev の DB の 28 プロジェクト中 16 で `NO_SCHEMA_UNIT`(最重要)が出る。実装計画書・段階7 の生成の指示に「テーブルのモデル・マイグレーションを作る単位を置く」を足すかは、Phase 58 の測定で件数を見てから決める(生成の指示を変えると、今のステージ7までの測定と比べにくくなる)。
- **テストのファイルの指示の効果**: 手順書の生成の指示に1行足したが、実 LLM では確かめていない(dev の DB の 78件は指示を足す前の生成物)。Phase 58 で確かめる。
- **依存の判定の除外が広すぎないか**: 「後の単位で依存する側のファイルも変更する」場合を除いたので、依存する側を後で書き換える計画は、最初の単位の時点で依存先が無くても指摘しない。dev の DB では誤検知が 12件減り、題材の2件は残った。Phase 58 の正解表で見落としが無いかを確かめる。
- **セッションの区切りの記録**: Phase 55 は1セッションで行った(計画モードで調査 → 着手時の質問1回(4問)→ 計画の承認 → 実装とテスト → 題材と dev の DB の確認・誤検知を除く → samples・教材・docs・記録)。

この Phase で解決したもの:

- **実装手順書に固有の欠陥**(Phase 53 から。決定的に調べられる分): PR-1・PR-3・PR-5 を [55-2](./Phase-55-2.md) の検証で出す([55-3](./Phase-55-3.md) で題材に当たることを確かめた)。
- **Phase 55 の未確定事項**(51-5): 重要度・依存先の判定に使う情報・テストのファイルの判定を、着手時の相談と [55-1](./Phase-55-1.md) で決めた。

## 完了後の調整

### 段階4の「層が構成図の層にありません」(2026-10-15)

- **相談**: 段階4の検証で `app/api/routes/auth.py の層「ルーター(api/routes)」が、構成図の層にありません。` が全モジュールに出る。ユーザーの見立ては「構成図には api/routes があるのに、パスに app/ が無いため」で、「構成図のモジュールを app で括る」か「部分一致にする」で直したい、という相談。
- **原因**(dev の DB の `06f93618`・`86a37228` で確かめた): 検証はパスでなく**層の欄**を構成図の**層(レーン名)**`入口`・`ユースケース`・`外部連携`・`永続化`と比べている。下書きの AI が、層の欄に構成図の**箱の名前**`ルーター(api/routes)` を書いていた(入力が `- ルーター(api/routes)(層: 入口)` の形で、箱と層を取り違えた)。2案はどちらも効かない(パスは比べていない・`ルーター(api/routes)` と `入口` には共通部分が無い)ため、代案から選んでもらった。
- **決定**(ユーザー。推奨どおり): 検証と下書きの両方で直す。
  - `app/detailed_design/structure.py`: `component_element_layers`(箱の名前 → 層)・`resolve_layer`。`merge_modules` が層の欄の箱の名前を箱の層に置き換える(`element_layers` を受け取る)。
  - `validation.py`: `ComponentDiagramSummary.element_layers`。層の欄が箱の名前なら箱の層で照合する。残る警告の文に構成図の層の一覧を添える。
  - `design_stage_service.py`・`design_stage_generation_service.py`: 箱 → 層を要約と組み立てに渡す。
  - `structure_drafting.py`: 入力を `- 箱「…」 / 層: … / 責務: …` に、規則に「箱の名前ではなく層の値」を足した。
- **確認**: devex-api 1211 件成功(`test_structure.py` に3件)・ruff・pyright 0。dev の DB の2プロジェクトで段階4の指摘が0件になった(層の欄は `ルーター(api/routes)` のまま)。実 LLM は呼んでいない(下書きの効果は次に段階4を生成したときに分かる)。samples は `# Phase-55(完了後の調整)` のタグで反映。
- **残り**: 画面のモジュール一覧の層の選択(devex-ui)は構成図の層だけを候補にしているため、今のデータの行は「(構成図に無い)」と表示されたまま。段階4を作り直すか、層を選び直すと直る(画面は変えていない)。

## 後続 Phase での改訂

- Phase 59: 簡易モードに `NO_ERROR_TEST`(軽微・手順書。機能の単位の API のエラー欄のステータスがテスト観点に無い。`error_test_gap`)を足した。`NO_SCHEMA_UNIT` を減らすため、段階4・段階7 の生成の指示にモデルとスキーマの単位を足した(判定は変えていない)([59-1](../Phase-59/Phase-59-1.md)・[59-4](../Phase-59/Phase-59-4.md))。

## Phase 完了チェック(#22)

設問は Phase の要点の要約(回答は求めない)。

1. 依存の順の判定で、モジュール一覧の行の「作り手」を、その行のファイルを最初に作る単位とするのはなぜか。手順書がまだ無い単位はどう扱われるか。
2. 基盤の単位のファイルと、後の単位でつなぎ直すファイルの依存を見ないのはなぜか。見ると何が起きたか。
3. スキーマのファイルを層の名前でなくパスで見るのはなぜか。題材で層を見ると何を誤るか。
4. `NO_SCHEMA_UNIT` の直す先を、モジュール一覧にスキーマの行があるかで段階4と段階7に分けるのはなぜか。
5. テーブル名の出ないスキーマのファイルがあれば、テーブルごとの指摘を出さないのはなぜか。

## 次のフェーズ

Phase 56: テスト仕様書の model と生成([51-5](../Phase-51/Phase-51-5.md))。テスト仕様書の model(構造化出力 → model → md)・生成(簡易は4文書の後、詳細は段階7の後)・決定的な検証(Must の要件にテストが無い・存在しない要件 ID や API を指す・異常系が0件の API)。
