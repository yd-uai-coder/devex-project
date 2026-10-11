# Phase 42 導入: 要素のグラフと影響のたどり方(詳細設計モード)

## 目的

ステージ7(変更影響分析・変更管理)の最初の実装 Phase。[Phase 41](../Phase-41/Phase-41-introduction.md) で決めた作り方のうち、影響を求める土台を本体に入れる。

- **作業単位の安定キー**: 段階7のタスクに並べ替えで変わらないキーを持たせ、段階8の手順書をそのキーで単位に付ける(42-1)。
- **横断事項の要件ID**: 非機能要件から下流への辺を作るため、横断事項に `req_ids` を足す(42-2)。
- **要素と参照の導出**: 文書の model と段階1〜8 の model から、要素と種類つきの辺を作る(42-3)。
- **影響のたどり方と理由**: 「処理を軸」の規則で見直しが要る要素を求め、道と理由を付ける(42-4)。

承認時の写し・要素の印・確認済み・API は [Phase 43](../Phase-41/Phase-41-5.md)、画面は Phase 44 で作る。この Phase では、影響を求める関数はまだどこからも呼ばれない。

## パイプライン上の位置づけ・前提

```
[42-1 安定キー]  PlanTask.key (U-001…) ── 段階8 UnitProcedure.unit_key ── relabel_units(表示の ID を付け直す)
                 Alembic d4e5f6a7b8c0(既存の段階7・8)
[42-2 横断事項の要件ID]  CrossCuttingRow.req_ids ── 生成(LLM)・検証・画面の列
        │
        ▼
[42-3 要素と参照]  DesignModels.from_dicts(段階1〜8・2文書)── build_elements ── Element(key, kind, stage, refs)
        │
        ▼
[42-4 たどり方]  impact_of(elements, Change(key, kind)) ── ImpactItem(key, path, reason) ── regeneration_targets
        │
        ▼
[Phase 43]  承認時の写しと今の model の差分 → Change → impact_of → 要素の印・確認済み
```

- **前提として読むもの**:
  - [41-2](../Phase-41/Phase-41-2.md)(決定と Claude の判断)・[41-5](../Phase-41/Phase-41-5.md)(Phase 42 のスコープと未確定事項)。
  - [41-1](../Phase-41/Phase-41-1.md)(ベースライン。`measure.py` の `build_detailed`・`function_scoped` がこの Phase の元)。
  - [41-3](../Phase-41/Phase-41-3.md) のデモの `impactModel.ts`(42-4 の規則の元)。
  - [`docs/internal_design.md`](../../docs/internal_design.md) 3.3節「7. 変更影響分析・変更管理」。
- **この Phase を始めた時点の状態**: Phase 41 の変更(外側のリポジトリと devex-ui のデモ)は未コミット。この Phase はその上に重ねた。devex-api は Phase 40 のコミットのまま。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(AI が本体へ実装し、`textbook/samples/` も同じ内容で作った)。

E2E: この Phase では流さない。段階7の保存でキーを振る・段階8の応答の ID を付け直す変更は、既存の画面の流れを変えない(段階8の手順書の表示 ID は並べ替えなければ今までと同じ)。ステージ7の E2E は Phase 50 で既存を含めて全部流す。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 42 開始時」を参照。すべて推奨どおり。

1. **自動実装モード**: on。
2. **安定キーの形**: 連番 `U-001`(`PlanModel.next_unit_seq`。要件ID・画面ID と同じ作り方)。
3. **既存の段階7・8 のデータ**: Alembic の移行(段階7に並び順でキーを振り、段階8を今の `M-xx-Tyy` で突き合わせる)。
4. **横断事項の `req_ids` の下書き**: LLM に付けさせる(要件定義書に無い ID は検証で警告、画面で直せる)。

Claude の判断(計画の承認で確定、または実装中。41-5 の未確定事項の残り):

- **要素のキー**: 既存の ID に種類の接頭辞(`req:FR-001`・`module:<パス>`・`task:U-002` など。[42-3](./Phase-42-3.md))。
- **グラフは読むたびに組む**(保存しない。[42-3](./Phase-42-3.md))。
- **DB 欄の書式の揺れ**: `表名 CRUD` の形の名前だけを取り、段階3 の CRUD・ER に在るテーブルだけを辺にする([42-3](./Phase-42-3.md))。
- **簡易モードの作業単位のキー**: 単位の ID のまま(実装計画書の model 化の Phase 45 で見直す。[42-1](./Phase-42-1.md))。
- **単位の間の `depends_on`**: 表示の ID のまま(範囲の外。[42-1](./Phase-42-1.md))。
- **作り直しでのキーの引き継ぎ**: タスク名が同じ単位は前のキーを引き継ぐ(実装中に判断。[42-1](./Phase-42-1.md))。
- **要件の一覧を横断事項の生成に新しく渡さない**(要件定義書の md に既にある。[42-2](./Phase-42-2.md))。
- **辺の種類 `implements` を足した**(手順書 → 手順・処理ロジック。[42-3](./Phase-42-3.md))。
- **モジュール → テーブルの辺を足し忘れていた**: ベースラインの生成物で確かめたときに見つけて足した([42-4](./Phase-42-4.md))。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-42-1.md`](./Phase-42-1.md) | 作業単位の安定キー | あり(BE・UI・移行) | なし |
| [`Phase-42-2.md`](./Phase-42-2.md) | 横断事項の要件ID | あり(BE・UI) | なし(42-1 と同じファイルを触るので後に置いた) |
| [`Phase-42-3.md`](./Phase-42-3.md) | 要素と参照の導出 | あり(BE) | 42-1(作業単位のキー)・42-2(横断事項の要件ID) |
| [`Phase-42-4.md`](./Phase-42-4.md) | 影響のたどり方と理由 | あり(BE) | 42-3 |

## サンプルコード一覧

`textbook/samples/backend/` 配下:

- 42-1: `app/detailed_design/{plan,procedure_doc,procedure_doc_drafting,validation,__init__}.py`・`procedure_output/source.py`・`app/services/{design_stage_generation_service,design_stage_service}.py`・`alembic/versions/d4e5f6a7b8c0_add_unit_keys.py`
- 42-2: `app/detailed_design/{plan,plan_drafting,validation}.py`
- 42-3: `app/detailed_design/impact/{__init__,elements}.py`
- 42-4: `app/detailed_design/impact/{__init__,trace}.py`
- テスト: `tests/fixtures/{detailed_design,change_impact}.py`・`tests/unit/test_{plan,plan_drafting,procedure_doc,procedure_doc_validation,unit_key_migration,design_stage_plan_generation,design_stage_procedure_doc,impact_elements,impact_trace}.py`

`textbook/samples/frontend/src/features/detailed-design/` 配下:

- 42-1: `api/types.ts`・`planOps.ts`・`procedureDocOps.ts`
- 42-2: `api/types.ts`・`planOps.ts`・`components/PlanTables.tsx`
- テスト: `test-utils/stageFixtures.ts`・`__tests__/{planOps,procedureDocOps}.test.ts`・`components/__tests__/PlanTables.test.tsx`

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| [42-1](./Phase-42-1.md) | `plan.py`・`procedure_doc.py`・サービス2つ・移行・画面の型と操作 | タスクに安定キーを振り、手順書をキーで単位に付ける | 振り方(並び順・重複・古い番号)・並べ替えでキーが動かない・作り直しの引き継ぎ・並べ替えの後も手順書が同じ単位・移行の変換(SUT は純粋関数とサービス。スタブは FakeLLM とインメモリ SQLite) |
| [42-2](./Phase-42-2.md) | `plan.py`・`plan_drafting.py`・`validation.py`・`PlanTables.tsx` | 横断事項に要件ID を持たせ、生成・検証・画面で扱う | 形をそろえる・知らない ID の警告・一覧の無いときは照合しない・表の列(スタブ不要、表は `onChange` の `vi.fn`) |
| [42-3](./Phase-42-3.md) | `impact/elements.py` | model から要素と種類つきの辺を作る | 種類ごとの辺・DB 欄・手順書は単位の処理の関数だけ・キーでの付け直し・形の正しくない入力(スタブ不要) |
| [42-4](./Phase-42-4.md) | `impact/trace.py` | 処理を軸の規則で見直しが要る要素と道・理由を求める | 別の処理へ広げない・改名は直接だけ・非機能要件 → 横断事項 → 手順書・短い道(スタブ不要) |

## 写経順序(#23)

章番号順。各章の中は「この章で作成・更新したファイル」の表の順(#30。依存されるファイルが上、テストは末尾)。

実 import 監査(#15。全 import 文を読んで確かめた):

- 42-1: `plan.py` の新しい import は `collections.Counter` だけ。`procedure_doc_drafting.py`・`procedure_output/source.py`・`validation.py` は `procedure_doc.relabel_units`(同じ章の先の行)を読む。`__init__.py` は同じ章の `plan`・`procedure_doc` の新しい名前を読む。`design_stage_generation_service.py` は `plan.carry_over_unit_keys`・`procedure_doc.relabel_units`、`design_stage_service.py` は `app.detailed_design` の `PLAN_STAGE`(既存)・`PlanModel`(既存)・`ProcedureDocModel`(既存)・`assign_unit_keys`・`relabel_units`(同じ章)を読む。移行ファイルは app を読まない。テストは `plan_model`(既存)・`relabel_units` などこの章までの名前だけを読む。
- 42-2: `plan_drafting.py` は `requirement_trace.normalize_req_id`(Phase 38)を読む。`validation.py` の新しい関数は既存の `index_from_external_design` を使う。`test_plan.py` の `ExternalDesignModel` は Phase 37。
- 42-3: `impact/elements.py` は既存の model と、42-1 の `PlanUnit.key`(`plan_units`)・`unit_refs`・`design_index`(Phase 27)を読む。`impact/__init__.py` は `elements` だけを読む(`trace` の import は 42-4 で足す)。`tests/fixtures/change_impact.py` は何も import しない。
- 42-4: `impact/trace.py` は 42-3 の `elements` を読む。`test_impact_trace.py` は 42-4 で足した `impact` の名前を読む。
- 前方 import は無い。章が作成・更新するファイルは、その章のテストが少なくとも1度 import する(`procedure_output/source.py` は既存の `test_procedure_output_source.py`。各章の「テスト観点」)。

## 検証結果

- devex-api: 部分テスト(各章の「テスト観点」のコマンド)成功、`ruff check` 成功(`ruff format` は使わない)、pyright(`app/detailed_design`・サービス2つ)0件。
- マイグレーションの往復: 開発 DB で `upgrade head` → `downgrade -1` → `upgrade head` 成功。段階7の 12 行すべてにキー、段階8は詳細設計モードの 7 行すべてに `unit_key`、簡易モードの 6 行は変わらない。
- ベースラインの生成物での確かめ: [42-4](./Phase-42-4.md)「ベースラインの生成物での確かめ」(S5・S6・S7・N1。試案と同じ傾向、S6・N1 の見落とし0)。
- devex-ui: `tsc --noEmit`・eslint・`npm run build` 成功。1回目の `npx vitest run src/features/detailed-design` は並列の負荷で7件がタイムアウトし、`--maxWorkers=4` で全件成功(コードの失敗ではない)。`PlanTables.test.tsx` の要件の入力のテストは1回目、`onChange` がスタブで model を変えないため1文字ずつしか入らず落ちた。貼り付けで確かめる形に直した。
- Phase 完了時の全体テスト(#18): devex-api 970 件成功、devex-ui 727 件成功(`--maxWorkers=4`、1回目。Phase 41 の 725 件 + この Phase の 2 件)。
- `samples_check.py`(`--api-since HEAD --ui-since HEAD`): 不一致 0 件・作り忘れ 0 件(一致 527 / 並び順のみ差 8 / 例外 5)。`link_check.py`: 切れ 0 件。

## 未消化の申し送り(#37)

Phase 41 から引き継いだもの(未解決のまま):

- **持ち越し(Phase 22 から)**: 段階6が開いていないときの、05 の詳細バッジ / ER の主キーの NULL の表示。
- **E2E を CI で流すか**: 未定([`retrospective-memo.md`](../retrospective-memo.md) に候補として記録済み)。#36 のまま。
- **コミュニケーション図**: 後回し([25-5](../Phase-25/Phase-25-5.md))。
- **「AI に提案を求める」**: ステージ8との境界として申し送る。
- **段階8の生成の入力の大きさ・判定の LLM の入力の大きさ**: 問題になれば測る。
- **生成済みの簡易モードのプロジェクト**: Phase 31 より前に生成した文書では段階8の単位が空。再生成で使える。
- **既存のプロジェクトの会話の順**(Phase 35 から): 直さない。
- **`test_chat_service.py` の pyright の指摘4件**(Phase 40 から): 触るときに `isinstance` で絞る。
- **ステージ7の計画に入れたもの**: 「段階Nで直す」の移動先での強調 → Phase 44 / 簡易モードの内部設計書の書き落とし → Phase 45 / L2・L5・L6・L14 と判定のゆらぎ → Phase 47・49 / 段階3の CRUD の下書きと DFD の食い違い・段階5の分岐の行の書き落とし → Phase 48。
- **Phase 43〜50 の未確定事項**: [41-5](../Phase-41/Phase-41-5.md)「未確定事項」。
- **共有のモジュールの中で「どれを直すか」**: 示さない。効果測定では見落としとして数え続ける。
- **devex-ui の「開発用」メニュー**: ステージ7の完了時に、ユーザーが前と同じく外すかを決める。

この Phase で生まれたもの:

- **共有の画面を通って別の処理に届く**: 要件の変更は、その要件を持つ画面を共有する別の処理にも届く(試案と同じ挙動。[42-4](./Phase-42-4.md))。止めるかは Phase 49 の数字で決める。
- **テーブルの変更は、そのテーブルを読み書きする全処理に届く**: モジュール → テーブルの辺を足して見落としは消えたが、過剰が少し増えた(S6・N1)。Phase 49 で数える。
- **文書の要素(要件・画面・API)からの影響は、まだ生成物で確かめていない**: stage6-effect に文書の model が無いため。Phase 49 で、測定用に文書の model を用意して測る。
- **影響を求める関数は、まだどこからも呼ばれない**: Phase 43(写しと差分)・44(画面)で使う。
- **セッションの区切りの記録**: Phase 42 は1セッションで行った(計画モードで質問4問 → 42-1 → 42-2 → 42-3 → 42-4 → ベースラインの生成物での確かめ(辺の足し忘れを見つけて直す)→ マイグレーションの往復 → 全体テスト → samples → 教材)。

この Phase で解決したもの:

- 41-5 の Phase 42 の未確定事項(要素のキーの形・グラフの持ち方・`req_ids` の下書き・安定キーの作り方と既存データ・DB 欄の書式)→ この introduction の「着手時の相談で決めたこと」。

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

設問は Phase の要点の要約(回答は求めない)。

1. 手順書の表示の ID を保存し直さず、読むときに付け直すのはなぜか。段階8の版と陳腐化の判定から説明できるか。
2. 横断事項の要件ID を、モジュールと処理から導かず LLM に付けさせたのはなぜか。非機能要件と処理の関係から説明できるか。
3. 処理に属するモジュールを示さず、その先にも広げないのはなぜか。41-1 のグラフ(全部)の過剰から説明できるか。代わりに何を見落とすか。
4. 要素のテストで、最小の fixture(処理1つ)と別に、処理2つの設計を用意したのはなぜか。
5. ベースラインの生成物で流したことで、何が見つかったか。単体テストだけでは見つからなかった理由を説明できるか。

## 次のフェーズ

**Phase 43**: 承認時の写しと要素単位の陳腐化(段階の直前の承認の写し・要素の差分と文書の版の model の差分・見直しの印と「確認済み」・段階の承認し直しとの関係・API)。着手時に自動実装モード(#21)と [41-5](../Phase-41/Phase-41-5.md) の Phase 43 の未確定事項を決める。
