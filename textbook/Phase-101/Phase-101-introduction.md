# Phase 101 導入: 変更の規模の集計 API と、説明書のクライアント向けの直し(ステージ13)

## 目的

ステージ13(説明とすり合わせ)の最初の実装 Phase。[100-4](../Phase-100/Phase-100-4.md) の Phase 101 にあたる。

[ベースライン](../../appendix/measurements/stage13-baseline.md)では、CR-4 の説明書が「作業単位0件・テスト0件」と出て、クライアント役は判断できなかった。束 B-4 の段階1 の処理に要件 ID が無く、予測が画面1件で止まったためである。今の説明書は、数えた0件と、たどれずに数えられなかった0件を区別しない。ファイルの数も出さない。

この Phase では、次のことを行う。

- 予測から変更の規模(作業単位・ファイル・テスト・画面・API)を決定的に数える。たどれないときは「数えられない(理由)」を出す ── [101-1](./Phase-101-1.md)
- 説明書をクライアント向けに直す。節の並び替え・各節の読み手向けの1文・規模の節・「合意の前に確かめたい点」の問い・名前を先に。確認済みのまま古くなった要約を知らせる ── [101-2](./Phase-101-2.md)
- API に規模を出す。反映の後の比較に実際の数を並べる ── [101-3](./Phase-101-3.md)

画面(CR の詳細に規模を出すなど)は Phase 107。選択肢(Phase 102)と共有リンク(Phase 103・104)は、この規模と説明書を使う。

## パイプライン上の位置づけ・前提

```
CR(対象の要件・新しい要件の起点)+ 基準の束の写し(文書・段階1〜8・各段階の状態)
   │ predict_from_snapshots(Phase 83・96)
   ▼
Prediction(見直しが要る要素)
   │ predicted_scale ──[101-1]── 作業単位・ファイル・テスト・画面・API / 数えられない理由 / 注記
   ▼
build_explanation ──[101-2]── 1 内容と背景 / 2 対象の要件 / 3 変更の規模 / 4 影響の一覧 / 5 合意の前に確かめたい点
   │
   ▼ GET .../explanation ──[101-3]── scale・summary.needs_reconfirm を足す
反映の後: applied_impact(反映の印)+ 今の段階・今のテスト仕様書
   │ count_scale・compare_scale ──[101-3]
   ▼ GET .../comparison ── scale(予測の数 / 実際の数)
```

- **前提として読むもの**: [100-1](../Phase-100/Phase-100-1.md)(決定1・6)・[100-2](../Phase-100/Phase-100-2.md)(ベースライン。CR-4 の0件の原因)・[100-4](../Phase-100/Phase-100-4.md)(Phase 101 の未確定事項)・[Phase 84](../Phase-84/Phase-84-introduction.md)(説明書の5節と要約)・[Phase 85](../Phase-85/Phase-85-introduction.md)(予測と実際の比較)・[Phase 96](../Phase-96/Phase-96-introduction.md)(新しい要件の予測の起点)。
- **今の仕組み**:
  - 説明書は、CR の値・予測・束の写しから5節を決定的に組み立てる(`app/change_requests/explanation.py`)。5節「影響を受ける作業単位とテストの数」は `affected_units` が数えた。ファイルは数えない。
  - 束の写しは、入っていない文書・段階の状態(`excluded`)は説明書に渡すが、入っている段階が「古い」かどうかは渡していなかった(B-4 の段階はどれも「古い」のまま写されていた)。
  - 作業単位のファイルは、段階8 の検証が `procedure_coverage.unit_files`(手順書のファイル + 段階7 のタスクのモジュール・設定)で集める。
  - 要約の状態は、保存の状態と指紋で「未確認 / 確認済み / 古い」。確認済みで古くなったかは区別しない。
- **この Phase を始めた時点の状態**: 外側のリポジトリは `75d0d56`(Phase 100 までコミット済み)。devex-api は `stage11-15` ブランチの `4d9d49b`、devex-ui は `main` の `511c5e6`(`tableStyles.ts` だけ未コミット。ユーザーの編集)。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(本体 + samples)。この Phase で変えるのは devex-api だけ。

E2E: この Phase では流さない。ステージ13 の E2E は Phase 110 で既存を含めて全部流す(#36)。説明書の md の中身は変わるが、既存の E2E は説明書の文を見ていない。応答は項目を足すだけで、devex-ui は変えない(画面は Phase 107)。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 101 開始時」を参照する。計画モードで2回(4問・2問)聞いた。

| # | 問い | 決定 |
|---|---|---|
| 1 | 自動実装モード | on(推奨どおり) |
| 2 | 「数えられない」の規則 | 種類ごとに判定。要る段階・文書が束に無い / 機能要件(FR)の対象が処理に1つも届かない / 新しい要件の起点が無い なら数えられない。段階が古いだけなら数えて注記(推奨どおり) |
| 3 | 説明書の節の並び | 1 内容と背景 / 2 対象の要件 / 3 変更の規模 / 4 影響の一覧 / 5 合意の前に確かめたい点(推奨どおり。Phase 102 で選択肢を2節の後に入れる) |
| 4 | ファイルの数え方 | パスで重なりを除く。段階8 の手順書の無い作業単位は段階7 から数えて注記(推奨どおり) |
| 5 | 読み手向けの1文 | 各節に決まった1文。規模の節だけ、数えられない種類があれば中身で1文足す(推奨どおり) |
| 6 | 反映の後の実際の数 | 印から数えられるもの(作業単位・ファイル・テスト)。画面・API は文書の側の確認の数(推奨どおり) |

Claude の判断(計画の承認で確定、または実装中):

- 規模は新しいモジュール `app/change_requests/scale.py` に置き、`explanation.affected_units`・`AffectedUnits` を置き換えた(#17。消費者は説明書とスキーマだけ)。
- 機能要件のつながりは「予測で `function` の要素に届いたか」で見る(処理の要件 ID だけでなく、API のトリガーから届いても届いたとみなす)。非機能要件・制約は見ない(横断事項などに届くため)。段階1 が束に無いときは、つながりの理由は出さない(段階の理由と重なるため)。
- 数えられない種類には、古い段階の注記を出さない(開発 DB の CR-3・CR-4 で、理由と注記が重なって読みにくかったため)。同じ理由・注記は種類をまとめて1行にする。
- 応答の今の項目(`units`・`integration_tests`・`system_tests`・`has_test_spec`)は残し、規模から出す。`units` の中身は ID から表示名(`名前(ID)`)になる(devex-ui は件数だけを使う)。
- 比較の実際の数は、今の段階の内容(承認前の下書きも)と、今のテスト仕様書(表示中の版)で数える。
- テンプレートから取り込むものは無い。

推奨と違った選択は0件。計画の差し戻しは無し。#39 の材料。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-101-1.md`](./Phase-101-1.md) | 変更の規模の集計(純粋関数) | あり(本体 2 + テスト 1。新規 2) | Phase 83(予測)・96(起点) |
| [`Phase-101-2.md`](./Phase-101-2.md) | 説明書のクライアント向けの直し | あり(本体 4 + テスト 5) | 101-1 |
| [`Phase-101-3.md`](./Phase-101-3.md) | 規模の API と、反映の後の比較 | あり(本体 3 + テスト 5) | 101-1・101-2 |

## サンプルコード一覧

すべて `textbook/samples/backend/`。

- 101-1: `app/change_requests/scale.py`・`tests/unit/test_change_request_scale.py`(新規)、`app/change_requests/__init__.py`(更新)。
- 101-2: `app/change_requests/summary.py`・`explanation.py`・`__init__.py`・`app/schemas/change_request.py`、`tests/unit/test_change_request_explanation.py`・`test_change_request_summary.py`・`test_change_request_origins.py`・`test_change_request_service.py`・`test_change_requests_api.py`(更新)。
- 101-3: `app/schemas/change_request.py`・`app/services/change_request_service.py`・`app/api/routes/change_requests.py`、`tests/unit/test_change_request_comparison.py`・`test_change_request_service.py`・`test_change_requests_api.py`・`tests/integration/test_change_requests_flow.py`(更新)。
- ミラーしないもの(#21 の共通): 無し(インフラ・設定ファイルは変えていない)。
- 更新したファイルは `tagmerge.py` で当てた。`__init__.py`・スキーマ・テストのうち、2つの章が触るファイルは、当てた章を既定にして、後の章の分のタグを手で直した(道具の「要手当て」の範囲。振り返り 17.7)。`__init__.py` の `__all__` は、samples が Phase ごとの塊に並んでいるので、道具が散らした行を戻し、塊を末尾に足した。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 作成・更新するファイル | 責務(1行) | テスト観点 |
|---|---|---|---|
| 101-1 | `scale.py` | 予測の要素と束の写しから、種類ごとの数・数えられない理由・注記を決定的に出す | 重なり除き・手順書無しの注記・FR が届かない・段階 / 文書が無い・古い段階・起点無し・名前を先に・予測と実際を並べる |
| 101-1 | `__init__.py` | 規模の名前を re-export | (各テストが import する) |
| 101-2 | `summary.py` | 要約のプロンプトを新しい節に合わせ、確認済みのまま古いかを判定 | 確認済み × 指紋の違いだけ真・プロンプトに規模と確かめたい点 |
| 101-2 | `explanation.py` | 節の並び替え・読み手向けの1文・規模の節・問いの形・名前を先に | 節の順と各節の1文・規模の表と理由・問いの文・名前を先に・指紋 |
| 101-2 | `schemas/change_request.py` | 説明書の応答に規模(`scale`)。今の項目は規模から出す | 規模の種類・数・理由の形 |
| 101-3 | `schemas/change_request.py` | 比較の応答に規模の予測と実際、要約に `needs_reconfirm` | 種類の順・出どころ |
| 101-3 | `change_request_service.py`・`routes/change_requests.py` | 説明書に束の段階の状態を渡す。比較で実際の数を今の設計から数える | 反映の後の実際の数・確認済みのまま古い要約 |

## 写経順序(#23)

章番号順。各章の「作成・更新したファイル」表は依存順に並べた(#30)。

実 import 監査(#15)として、各ファイルの全 import 文を読んだ。import 先のモジュールとシンボルの誕生章が、そのファイルの章以下であることを確かめた。

- `scale.py`(101-1)→ `prediction.STAGE_PREFIX`・`Prediction`(Phase 83)、`targets.Target`(83)、`impact.elements.parse_model`・`plan.PlanModel`・`procedure_coverage.unit_files`・`procedure_doc.PlanUnit`・`ProcedureDocModel`・`plan_units`(ステージ4〜5)。
- `__init__.py`(101-1・101-2)→ 101-1 で `scale` の名前、101-2 で `summary.needs_reconfirm` を足し、`AffectedUnits`・`affected_units` を外した。
- `explanation.py`(101-2)→ `scale` の `Scale`・`ScaleCount`・`ScaleRemark`・`display_name`・`predicted_scale`(101-1)。
- `schemas/change_request.py`(101-2・101-3)→ 101-2 で `Scale`・`ScaleCount`・`ScaleKind`・`ScaleRemark`(101-1)、101-3 で `ScaleComparisonRow`(101-1)・`needs_reconfirm`(101-2)。
- `change_request_service.py`(101-3)→ `Scale`・`ScaleComparisonRow`・`ScaleSources`・`compare_scale`・`count_scale`(101-1)、`needs_reconfirm`(101-2)、`prediction.STAGE_PREFIX`・`parse_model`・`PlanModel`・`ProcedureDocModel`(既存)。`routes/change_requests.py`(101-3)→ import の追加なし。
- テスト: `test_change_request_scale.py`(101-1)→ 101-1 の名前と既存の fixture(`ROUTE`・`SERVICE`・`REPOSITORY`)。101-2 のテストは 101-1・101-2 の名前、101-3 のテストは 101-3 までの名前だけを使う(101-2 の `test_change_requests_api.py` の規模の確かめは、101-2 で足したスキーマの `scale`)。

各章のテストは、その章で作成・更新した全ファイルを少なくとも1度 import する(#15)。101-1 の `__init__.py` は `test_change_request_scale.py` が通る。101-2 のスキーマは `test_change_requests_api.py` が、101-3 のサービスとルートは `test_change_request_comparison.py` が通る。

## 検証結果

- ユニット: 章ごとに、章のテストと CR のテスト(`-k change_request`)を流した。
- devex-api: `ruff check`(app・tests): 通った。`pyright`(触ったファイル): 0 件。`ruff format` は使っていない。
- 全体テスト: devex-api はユニット 1769 件・統合 39 件(専用のテスト DB)がすべて通った。devex-ui は変えていないが、CR の feature のテスト(96 件)を `--maxWorkers=4` で流して通った(既定の並列数では5件が失敗し、`--maxWorkers=4` で流し直すと通った。持ち越しの「並列のテストのタイムアウト」と同じ形)。
- 開発 DB(読み取りだけ): [`stage13/measure.py`](../../appendix/measurements/stage13/measure.py) を一時の出力先で流した(ベースラインの JSON は上書きしていない)。CR-3・CR-4 とも、作業単位・ファイル・テストが「数えられない(設計の処理につながらない要件がある(FR-001 / FR-003))」になり、ベースラインの「0件」と区別された。CR-4 の画面は「トップページ(SCR-001)」の1件。5節は未決の観点の問い(CR-3 は1件、CR-4 は2件)と推測の要件の問い。
- `textbook/tools/samples_check.py --api-since phase-99 --ui-since phase-99`: 不一致 0・本体のみ 0(一致 997 / 並び順のみ差 8 / 例外 5)。
- `textbook/tools/link_check.py`: リンク切れ 0 件。
- 実 LLM: 使っていない(費用 0)。
- E2E: 流していない(Phase 110 で全部流す)。

## 未消化の申し送り(#37)

[Phase 100](../Phase-100/Phase-100-introduction.md#未消化の申し送り37) から引き継いだもの。

**ステージ13 の中で扱うもの**(行き先は [100-4](../Phase-100/Phase-100-4.md)):
- **選択肢つきの説明**(位置付け)→ Phase 102・107。規模は案ごとに `predicted_scale` を案の対象で呼ぶ。説明書の選択肢の節は2節の後に入れる(この Phase の決定3)。
- **規模・要約の知らせの画面**(この Phase で生まれたもの)→ Phase 107。CR の詳細に規模の表(数えられない理由・注記)、比較のタブに予測と実際の数、説明書のタブに `needs_reconfirm` の知らせ。今の説明書のタブの1行(作業単位・結合テスト・総合テストの件数)も、規模の表に置き換える。
- **CR で書き換えた行の確認事項の状態**(P99)→ Phase 106・109。
- **外部連携のサービス名の言い換えで残る重複**(P99)→ Phase 105。
- **名称を言い換える偽の LLM**(振り返り 17.6)→ Phase 105。
- **段階2・3・7 の処理 ID の参照の切れ**(P99)→ Phase 106・109。
- **推測の利用者のキーが名前**(P94)→ Phase 105。
- **起点に選べる要素の種類**(P96)・**束の一覧の入れた CR**(P88)・**巡回で消えた版の戻しの履歴**(P95)・**生成で作り直したまま DFD・データ辞書だけを直した承認**(P99)→ Phase 106・109。
- **束の段階が古いと、予測が少なく出る**(P100)→ この Phase で「数えられない」の理由と古い段階の注記で示すようにした。束を作り直すかは開発者の運用で、Phase 110 の新しい CR の前に決める(残す)。

**ステージ13 の範囲の外**:
- **使い勝手(主に UI)の見直し**: ステージ13 の後に回す。
- **本番への反映と本番での確認**: ステージ15 の完了時に、[`OPERATIONS.md`](../../devex-api/OPERATIONS.md) 10.8節で行う。この Phase はマイグレーションなし。説明書の md が変わるので、本番で反映するときに、以前に作った要約がすべて「古い」になることを 10.8節に書く(Phase 110)。
- **要約の生成の回数の上限**: 使われ方を見て決める。
- 振り返り 6節の残り5件・生成の質の候補4件(Phase 100 と同じ)。

**持ち越し**(触るときに直す。中身は [振り返り](../retrospectives/project-retrospective.md) 8節):
- `test_chat_service.py` などの pyright の指摘(Phase 40)
- devex-ui の並列のテストのタイムアウト(Phase 44。この Phase でも既定の並列数で5件が失敗した。`--maxWorkers=4` で通る)
- 偽 LLM の外部設計書の GET に DF が無い(Phase 45。Phase 105 で直せる)
- `DfdEditorTabs` のテストのまれな失敗(Phase 77)
- Google の公開鍵を毎回取りに行く(Phase 74)
- `ListCard` の入れ物(Phase 79。テンプレートでは直した)
- 英語のままの refresh の失敗の文(Phase 79)
- `streamChat.test.ts` の lint の警告(既存)
- `appendix/measurements/stage11/measure.py` の `ruff check` の指摘(Phase 80 から)
- 反映の後の CR の流れの部品・束の写しの取り出し(#17。触るときに寄せる)
- `tagmerge.py` の、複数の章が触るファイルの章の振り分け(振り返り 17.7)。この Phase でも `__init__.py`・スキーマ・テスト3本で手で直した。`__all__` が Phase の塊に並ぶファイルでは、道具が名前を本体の並びの位置に散らす。

**ユーザーが決めるもの**:
- **開発環境の後始末**: 確認用の利用者・プロジェクト。「トレンド追跡アプリ」は Phase 110 の効果測定の題材なので残す(この Phase では読むだけ)。
- **この Phase の未コミット**: 外側のリポジトリ(教材・docs・samples)・devex-api。devex-ui の `tableStyles.ts`(始める前から)。コミットはユーザーが行う(#35)。

**この Phase で解決したもの**:
- **変更の規模の集計**(位置付け・決定1)→ [101-1](./Phase-101-1.md)・[101-3](./Phase-101-3.md)。画面は Phase 107。
- **説明書のクライアント向けの直し**(決定6)→ [101-2](./Phase-101-2.md)。
- **確認済みの要約が古いと、出力に載らないことに気づきにくい**(P100)→ [101-2](./Phase-101-2.md)・[101-3](./Phase-101-3.md) の `needs_reconfirm`。画面は Phase 107。
- Phase 101 の未確定事項 → 「着手時の相談で決めたこと」。

**この Phase で生まれたもの**:
- 上の「規模・要約の知らせの画面」(Phase 107)。
- **セッションの区切りの記録**: Phase 101 は1セッションで行った。
  1. 計画モードで調査(エージェントは使わず直接読んだ)・質問2回(4問・2問)・計画の承認
  2. 101-1 の実装とテスト
  3. 101-2 の実装とテスト(説明書の試し出しで、注記の言い回しと重なりを直した)
  4. 101-3 の実装とテスト
  5. 開発 DB での確かめ(読み取りだけ。数えられない種類の注記を外した)・全体テスト(devex-api のユニット・統合、devex-ui の CR の feature)
  6. samples(`tagmerge.py`。2つの章が触るファイルのタグは手で直した)
  7. docs・教材

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

設問は Phase の要点の要約である(回答は求めない)。

1. CR-4 の説明書が「作業単位0件」でなく「数えられない」になったのは、どの判定によるか。束の段階が「古い」だけでは数えられないにしなかったのはなぜか。
2. 機能要件のつながりを、処理の要件 ID でなく「予測が処理に届いたか」で見るのはなぜか。非機能要件を見ないのはなぜか。
3. ファイルをパスで重なりを除いて数えると、作業単位の数との関係はどうなるか。手順書の無い作業単位を段階7 から数えるときに注記するのはなぜか。
4. 反映の後の実際の数で、画面・API だけ確認の一覧の数を使うのはなぜか。
5. 説明書の md を変えると、以前に作った要約はどうなるか。`needs_reconfirm` は何を知らせるか。

## 次のフェーズ

**Phase 102**: 選択肢つきの説明 API。着手時に、[100-4](../Phase-100/Phase-100-4.md) の Phase 102 の未確定事項(案の持ち方・案ごとに対象の要件を変えられるか・案の無い CR・LLM の下書きの照合とモデル・選んだ案を反映の指示にどう入れるか)を決める。規模は案ごとに `predicted_scale` を案の対象で呼ぶ。
