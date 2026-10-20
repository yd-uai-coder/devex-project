# Phase 92 導入: 要件定義書の保護(ステージ12)

## 目的

ステージ12(合意の精度)の完了の判断基準「合意済みの行が、CR の範囲の外の再生成で変わらない」の中心を作る Phase。[90-4](../Phase-90/Phase-90-4.md) の Phase 92 として、要件定義書の再生成の後に、合意済みの要件の行と利用者と使う場面(1.2)を合意の形にコードで戻す([外部設計書](../../docs/external_design.md) 2.15節、[内部設計書](../../docs/internal_design.md) 3.3節 12項)。合意は [Phase 91](../Phase-91/Phase-91-introduction.md) の記録から読む。外部設計書の保護と、CR の反映での合意の更新は Phase 93。画面は Phase 97。

- 合意の形へ戻す純粋関数 ── [92-1](./Phase-92-1.md)
- 組み立てで上限をかけ直さないこと・プロンプトの印 ── [92-2](./Phase-92-2.md)
- 生成の経路と、戻した要素の記録(版の列)── [92-3](./Phase-92-3.md)

## パイプライン上の位置づけ・前提

```
POST /projects/{id}/generate(CR なし / cr_number)
   │ DocGeneratorService.generate
   ▼
_generate_requirements ──[92-3]── _agreed_elements(詳細設計モードだけ)── AgreementService.current(91)
   │ exempt = CR の対象の req:<ID>
   │ build_requirements_messages(前の版の要件に「合意済み」の印)──[92-2]
   │ LLM(構造化出力)
   │ build_model(agreed_ids: 写す合意済みの行に cap_source を当てない)──[92-2]
   ▼
protect_requirements(書き換え → 戻す / 脱落 → 前の版の位置へ / 同じ文の重複を除く / 1.2)──[92-1]
   ▼
create_version(protection=[{key, reason}])──[92-3]──▶ generated_documents.protection
   ▼
外部設計書の生成・変更影響分析の印(守った要件定義書が入力)
```

- **前提として読むもの**: [90-1](../Phase-90/Phase-90-1.md)(決定2・3)・[90-2](../Phase-90/Phase-90-2.md)(出どころが戻る決定的な経路)・[90-4](../Phase-90/Phase-90-4.md)(Phase 92 の未確定事項)・[91-1](../Phase-91/Phase-91-1.md)(キーと `body_of`)。
- **今の仕組み**: 再生成は LLM に「関係しない行は unchanged」と頼むだけで、`build_model` は unchanged の行を前の版から写すときに、観点の状態で出どころの上限をかけ直す。そのため「採用にする」(観点を変えない)で採用にした行は、観点が未決なら次の再生成で「推測」に戻る。書き換え・脱落はコードで拒まない。
- **この Phase を始めた時点の状態**: 外側のリポジトリは `927774f`。devex-api は `stage11-15` ブランチの `9f865e3`、devex-ui は `main` の `a80821e`(どれも未コミットの変更なし)。alembic の head は `75d414ded7cb`。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(本体 + samples)。

E2E: この Phase では流さない(画面を変えないため。ステージ12 の E2E は Phase 99 で既存を含めて全部流す)。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 92 開始時」を参照。計画モードで2回(4問・2問)聞いた。

| # | 問い | 決定 |
|---|---|---|
| 1 | 自動実装モード | on(推奨どおり) |
| 2 | 戻す範囲 | 行のすべての欄(推奨どおり) |
| 3 | 落ちた行を戻す位置 | 前の版の並び順(推奨どおり) |
| 4 | 言い換えの重複 | 同じ文の新しい行だけ除く(推奨どおり) |
| 5 | 戻した要素の残し方 | 版の列(推奨どおり) |
| 6 | CR の反映での要件の合意の更新 | Phase 93 のまま(推奨どおり) |

Claude の判断(計画の承認で確定):

- **推測の行の合意**(90-4 の未確定事項): 束に入った推測の行も合意済み(Phase 91 で束の全行を記録した)。出どころは推測のまま戻す。
- **免除**は反映する CR の対象の要件(内容の変更・削除)。利用者(1.2)は CR の対象にならないので常に守る。
- **詳細設計モードだけ**。簡易モードは合意を読まない(`AgreementService.current` は簡易モードで例外)。
- **プロンプトは新しい節を作らず**、前の版の要件に印を付ける(節の分け方のテストの対象を増やさない)。
- **戻す関数の置き場**は `app/agreements`(合意のキーに依存。逆向きの依存を作らない)。
- テンプレートから取り込むものは無し。devex-ui は変えない(応答に項目が増えるだけ)。

推奨と違った選択は0件。計画の差し戻しは無し。#39 の材料。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-92-1.md`](./Phase-92-1.md) | 合意の形へ戻す純粋関数 | あり(本体 2 + テスト 1) | Phase 91(`body_of`・`USERS_KEY`) |
| [`Phase-92-2.md`](./Phase-92-2.md) | 組み立てとプロンプト | あり(本体 2 + テスト 1) | なし |
| [`Phase-92-3.md`](./Phase-92-3.md) | 生成の経路と、戻した要素の記録 | あり(本体 4 + マイグレーション 1 + テスト 1) | 92-1・92-2・Phase 91(`AgreementService`) |

## サンプルコード一覧

`textbook/samples/backend/` の新規・更新:

- 92-1: `app/agreements/protection.py`(新規)・`app/agreements/__init__.py`・`tests/unit/test_agreement_protection.py`(新規)
- 92-2: `app/documents/requirements/assemble.py`・`app/documents/requirements/drafting.py`・`tests/unit/test_document_revision.py`
- 92-3: `app/models/generated_document.py`・`alembic/versions/956b403c67fe_add_generated_document_protection.py`(新規)・`app/repositories/generated_document.py`・`app/schemas/document.py`・`app/services/doc_generator_service.py`・`tests/unit/test_requirements_protection_flow.py`(新規)
- ミラーしないもの(#21 の共通): 無し(インフラ・設定ファイルは変えていない)。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 作成・更新するファイル | 責務(1行) | テスト観点 |
|---|---|---|---|
| 92-1 | `app/agreements/protection.py` | 組み立てた model の合意済みの行と 1.2 を合意の形に戻し、戻した要素を返す | 書き換え・脱落の位置・免除・重複・1.2・次の番号・素通し |
| 92-1 | `app/agreements/__init__.py` | re-export | 同上(パッケージから import) |
| 92-2 | `assemble.py` | 写す合意済みの行に上限をかけ直さない | 観点が未決でも採用のまま |
| 92-2 | `drafting.py` | 前の版の要件に合意済みの印・利用者の行・規則の1文 | 印は合意済みの行だけ・印なしは今までどおり |
| 92-3 | `generated_document.py`(model)・マイグレーション | 戻した要素の列 | 往復・`alembic check` |
| 92-3 | `generated_document.py`(repository)・`document.py`(schema) | 版に書く・応答に載せる | 版の `protection` と `RestoredRead` |
| 92-3 | `doc_generator_service.py` | 詳細設計モードで合意を読み、CR の対象を除いて守る | 採用のまま・戻し・CR の対象・簡易モードは NULL |

## 写経順序(#23)

章番号順。各章の「作成・更新したファイル」表は依存順に並べた(#30)。

実 import 監査(#15): 各ファイルの全 import 文を読み、import 先(モジュールとシンボル)の誕生章が、そのファイルの章以下であることを確かめた。

- `app/agreements/protection.py`(92-1)→ `app.agreements.items`(Phase 91 の `USERS_KEY`・`body_of`)・既存の `app.documents.ids.parse_seq_id`・`app.documents.requirements.model`。
- `assemble.py`・`drafting.py`(92-2)→ 既存だけ(`drafting.py` は `UserScene`・`Sequence` を足した。どちらも既存)。
- `app/schemas/document.py`(92-3)→ `app.agreements.RestoreReason`(92-1)。
- `doc_generator_service.py`(92-3)→ `app.agreements` の `USERS_KEY`(91)・`agreed_requirement_ids`・`protect_requirements`・`requirement_key`(92-1)、既存の `targets_from_json`・`UserScene`・`ChangeRequest`、`build_requirements_messages` の `agreed_ids`・`agreed_users` と `build_model` の `agreed_ids`(92-2)。
- テスト: `test_agreement_protection.py`(92-1)→ 92-1 と Phase 91。`test_document_revision.py` の追記(92-2)→ `AGREED_MARK`(92-2)。`test_requirements_protection_flow.py`(92-3)→ `RestoredRead`(92-3)・`AGREED_MARK`(92-2)・既存の fixture。

各章のテストは、その章で作成・更新した全ファイルを少なくとも1度 import する(#15)。92-1 の `__init__.py` はテストがパッケージから import する。92-3 のマイグレーションは import せず、開発 DB の往復と `alembic check` で確かめた(Phase 91 の表のマイグレーションと同じ)。

## 検証結果

- ユニット: 章ごとに章のテストと関係する既存のテスト(生成・CR の反映・採用・版)を流し、Phase の終わりに全体を流した(→ 下の「全体テスト」)。
- `ruff check`(app・tests): 通った。`pyright`(触ったファイル): 0 件。
- 開発 DB: alembic の単一 head(`956b403c67fe`)と ID の衝突が無いことを確かめてから upgrade。downgrade → upgrade の往復、`alembic check` で差なし。既存の版 744件の `protection` は NULL、合意の記録は 118件のまま。「トレンド追跡アプリ」は再生成していない(Phase 99 の題材)。
- `textbook/tools/samples_check.py --api-since stage11-15`: 不一致 0・本体のみ 0(一致 943 / 並び順のみ差 8 / 例外 5)。
- `textbook/tools/link_check.py`: リンク切れ 0 件。
- 全体テスト: ユニット 1666 件・統合 34 件がすべて通った(統合は専用のテスト DB)。
- E2E: 流していない(画面を変えていない。Phase 99)。

## 未消化の申し送り(#37)

[Phase 91](../Phase-91/Phase-91-introduction.md#未消化の申し送り37) から引き継いだもの。

**ステージ12 の中で扱うもの**(行き先は [90-4](../Phase-90/Phase-90-4.md)):
- **CR を渡さない再生成で、合意した行が動く**(P89)→ 要件定義書はこの Phase で守った。外部設計書(画面・API・外部連携)は Phase 93。
- **CR を反映した行が、次の CR なしの再生成で合意の形に戻る**(この Phase で生まれた。決定6)→ Phase 93(CR の反映での合意の更新)。それまでは開発環境だけで起きる。
- **推測の採用率・決める機会**(振り返り 6節)→ Phase 94・98。
- **影響が広がる変更の実 LLM での比較**(P89)→ Phase 99 の効果測定。この Phase の保護も、実 LLM で戻した件数を測る(版の `protection`)。
- **下書きの中の直しは時系列に残さない**(P89)→ Phase 95・98。
- **段階の承認で付く印の漏れ**(P86 の決定)→ Phase 96。
- **新しい要件を足す CR の予測の起点を人が選ぶ形**(P83)→ Phase 96・98。
- **外部連携のキーはサービス名**(Phase 91)→ Phase 93。
- **戻した件数の画面と履歴**: 版の `protection` を Phase 95(履歴)・97(画面)で読む。
- **Phase 93〜99 の未確定事項**: [90-4](../Phase-90/Phase-90-4.md)「未確定事項」。

**ステージ12 の範囲の外**:
- **本番への反映と本番での確認**: ステージ15 の完了時に、[`OPERATIONS.md`](../../devex-api/OPERATIONS.md) 10.8節で行う。Phase 91 の2つのマイグレーションとこの Phase の `956b403c67fe` を、Phase 99 で 10.8節に足す。
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
- **開発環境の後始末**: 確認用の利用者・プロジェクト(開発 DB の束 12・CR 8 など)、DB の事故の後の複製。「トレンド追跡アプリ」は Phase 99 の効果測定の題材の候補なので残しておく。
- **この Phase の未コミット**: 外側のリポジトリ(教材・docs・samples)と devex-api。コミットはユーザーが行う(#35)。

**この Phase で解決したもの**:
- 「採用にする」が再生成で「推測」に戻る([90-2](../Phase-90/Phase-90-2.md))→ [92-2](./Phase-92-2.md)・[92-3](./Phase-92-3.md)。
- 要件定義書の合意済みの行・利用者(1.2)が、CR の範囲の外の再生成で変わる → [92-1](./Phase-92-1.md)・[92-3](./Phase-92-3.md)。
- Phase 92 の未確定事項(戻す範囲・位置・重複・推測の行の合意・戻した件数の残し方)→ 「着手時の相談で決めたこと」。

**この Phase で生まれたもの**:
- 上の「CR を反映した行が、次の CR なしの再生成で合意の形に戻る」(Phase 93 へ)。
- **セッションの区切りの記録**: Phase 92 は1セッションで行った。計画モードで調査(Explore エージェント1つ)・質問2回(4問・2問)・計画の承認 → 92-1〜92-3 の実装 → 開発 DB の移行 → 全体テスト → samples → docs・教材。

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

設問は Phase の要点の要約である(回答は求めない)。

1. プロンプトで「変えない行」と頼むだけでなく、生成の後にコードで戻すのはなぜか。プロンプトの印には、それでも何の効き目があるか。
2. 戻す範囲を文と出どころだけでなく、行のすべての欄にしたのはなぜか。変更影響分析の印とどう関係するか。
3. 「採用にする」で採用にした行が推測に戻らないようにするのに、観点の状態を採用にする方法を取らなかったのはなぜか。
4. 版の `protection` で、NULL と空の一覧を分けたのはなぜか。
5. CR の反映での合意の更新を Phase 93 に残すと、Phase 92 と 93 の間に何が起きるか。

## 次のフェーズ

**Phase 93**: 外部設計書の保護と、CR の反映での合意の更新。画面・API・外部連携を合意の形に戻し、CR の反映では保存した予測の文書の側の要素だけ書き換えを許す。反映した CR の対象と要素の合意を、CR を出どころに更新する。着手時に、[90-4](../Phase-90/Phase-90-4.md) の Phase 93 の未確定事項(合意を更新する時点・予測に無い要素が変わったとき・ID の付け直しの照合)と、外部連携のキー(サービス名の言い換え)を決める。
