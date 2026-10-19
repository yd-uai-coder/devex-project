# Phase 34 導入: 観点の表(ステージ6)

## 目的

ヒアリングの完了判定(5条件を LLM が判定する)を、**観点の表**で置き換える。観点は機能面の10と、IPA の非機能要求グレードの6大項目。規模(個人・小規模 / 社内 / 公開サービス)で必須を切り替え、**必須の観点がすべて未決以外になったら完了**とする。この判定は LLM でなくコードが行う。LLM は、発言から観点ごとの状態・決めたこと・根拠を返すだけにする。チャット画面には観点の表を置く。

方針は [Phase 33-2](../Phase-33/Phase-33-2.md) 決定1・3・6・8、計画は [33-5](../Phase-33/Phase-33-5.md) の Phase 34。

## パイプライン上の位置づけ・前提

```
[34-1 観点の定義と hearing_points]  app/hearing/points.py(定義・必須・完了・取り込み)+ テーブル
        ▼
[34-2 判定の置き換えと API]  judge_points(LLM は状態と根拠だけ)→ コードで完了 → 返信 / まとめ
                              GET /projects/{id}/hearing-points、偽 LLM
        ▼
[34-3 チャット画面の観点の表]  HearingPointsPanel(広い画面は右、狭い画面は上に畳む)
        ▼
Phase 35 選択肢カード(観点の表の「AI の提案を採用」を、カードの選択でコードが記録する)
```

- 前提として読むもの:
  - 見本の観点の表(観点の定義・状態・題材の表)
  - [ベースライン](../Phase-33/Phase-33-1.md) の所見2〜4(未達のまま「十分」、非機能が聞かれない)
  - 今の判定の流れ: `stream_reply` は返信の前に判定し、十分ならまとめを返し、足りなければ不足を返信の LLM に渡す(ゴール3後の調整。[外部設計書](../../docs/external_design.md) 2.3節)。この Phase はこの流れを保ったまま、判定の中身を差し替える。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(AI が本体へ実装し、`textbook/samples/` も同じ内容で作る)。

E2E: この Phase では流さない。チャットの判定が変わるので既存の E2E(ヒアリング → 生成)が壊れうるが、偽 LLM は「利用者の発話3回で十分」を保つようにした([34-2](./Phase-34-2.md))。ステージ6の E2E は Phase 40 で既存を含めて全部流す。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 34 開始時」を参照。

1. **自動実装モード**: on(推奨どおり)。
2. **根拠の持ち方**: `chat_histories` の id(推奨どおり)。LLM には発言に番号を付けて見せ、返った番号をコードが id に直す。画面は「初期入力 / 発言N」で出す。
3. **発言の回数の下限(3回)**: 外す(推奨どおり)。
4. **パネルの置き場**: 広い画面はチャットの右、狭い画面はチャットの上に畳める表(推奨どおり)。

Claude の判断(計画の承認で確定。[33-5](../Phase-33/Phase-33-5.md) の残りの未確定事項):

- **判定の LLM の出力**: 観点ごとの状態・決めたこと・根拠の番号と、規模。返らなかった観点は前の状態のまま。根拠の無い「決定」は取り込まない([34-1](./Phase-34-1.md))。
- **規模が未決の間の必須**: 「個人・小規模」の列で数える。規模は `projects.hearing_scale` に持つ。
- **`hearing_check` の summary**: 十分になったときのまとめは、表からコードで組み立てる(LLM を呼ばない)。`hearing_check` の形は変えない。
- **判定に失敗したとき**: 表は前のまま残し、`hearing_check` を消す。「表があって判定が無い」を「表が直近の発言を反映していない」と読む(計画では判定の時刻で比べる案だったが、実装で単純な方に変えた。[34-2](./Phase-34-2.md))。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-34-1.md`](./Phase-34-1.md) | 観点の定義(コード)・完了の判定・判定の取り込み(純粋関数)と `hearing_points` | あり(BE) | なし |
| [`Phase-34-2.md`](./Phase-34-2.md) | 判定の置き換え(`judge_points`)・返信の分岐・`GET /hearing-points`・偽 LLM | あり(BE) | 34-1 |
| [`Phase-34-3.md`](./Phase-34-3.md) | チャット画面の観点の表のパネル | あり(FE) | 34-2 |

## サンプルコード一覧

- 34-1(`textbook/samples/backend/`): `app/hearing/points.py`・`app/hearing/__init__.py`・`app/models/hearing_point.py`・`app/models/project.py`・`app/models/__init__.py`・`app/repositories/hearing_point.py`・`alembic/versions/a1b2c3d4e5f7_add_hearing_points.py`、テスト `test_hearing_points.py`・`test_hearing_point_repository.py`
- 34-2(同): `app/schemas/hearing.py`・`app/services/chat_service.py`・`app/api/routes/projects.py`・`app/ai/llm/fake.py`、テスト `test_chat_service.py`・`test_chat_stream_errors.py`・`test_fake_llm_e2e.py`・`tests/integration/test_projects_flow.py`
- 34-3(`textbook/samples/frontend/`): `src/features/hearing/api/hearingApi.ts`・`hearing-store.ts`・`components/HearingPointsPanel.tsx`・`components/ChatPageContent.tsx`、テスト `__tests__/hearing-store.test.ts`・`components/__tests__/HearingPointsPanel.test.tsx`・`components/__tests__/ChatPageContent.test.tsx`

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 作成・更新するファイル | 責務1行 | テスト観点 |
|---|---|---|---|
| [34-1](./Phase-34-1.md) | `app/hearing/points.py`・`__init__.py` | 観点の定義と、必須・完了・取り込み・まとめ・発言の番号付け(純粋) | 規模ごとの必須の数、未決の規模は個人・小規模、対象外も完了、根拠の無い決定を捨てる、まとめの並び |
| | `app/models/hearing_point.py`・`project.py`・`models/__init__.py`・alembic | 観点の状態の行と規模の列 | (リポジトリのテストで読む) |
| | `app/repositories/hearing_point.py` | キーで突き合わせて保存 | 16行の追加、キーでの更新 |
| [34-2](./Phase-34-2.md) | `app/schemas/hearing.py` | 判定の LLM の出力と、観点の表の API の形 | (サービス・偽 LLM のテストで読む) |
| | `app/services/chat_service.py` | 判定 → 取り込み → コードで完了 → 返信 / まとめ、観点の表の表示 | 番号 → id、プロンプトの中身、規模、十分・不足・失敗の分岐、`legacy`・`stale` |
| | `app/api/routes/projects.py` | `GET /hearing-points` | ルートを直接呼ぶテスト、統合テスト |
| | `app/ai/llm/fake.py` | 偽 LLM の判定 | 発話3回で十分になる契約 |
| [34-3](./Phase-34-3.md) | `hearingApi.ts`・`hearing-store.ts` | 観点の表の型・取得と取り直し | 取る順・失敗・別のプロジェクト |
| | `HearingPointsPanel.tsx`・`ChatPageContent.tsx` | 表のパネルと置き場 | 件数・行・注記・畳む、狭い / 広い画面 |

## 写経順序(#23)

章番号順(34-1 → 34-2 → 34-3)。各章の「この章で作成・更新したファイル」の表の順に写す。

実 import 監査(#15):

- 34-1: `app/hearing/points.py` は標準ライブラリだけを読む。`app/hearing/__init__.py` は `points.py`(同じ章)を読む。`app/models/hearing_point.py` は既存の `app.core.database`(`Base`・`PortableJSON`)と、`TYPE_CHECKING` の下で `app.models.project` を読む。`project.py` の追加は `TYPE_CHECKING` の下の `HearingPoint`(同じ章の先の行)だけ。`app/repositories/hearing_point.py` は `app.hearing.PointState`・`app.models.hearing_point`(同じ章)と既存の `app.repositories.base` を読む。alembic は外部ライブラリだけ。テストは同じ章の作成物と既存の `app.models.user`・`app.models.project` を読む。
- 34-2: `app/schemas/hearing.py` は `app.hearing`(34-1)の型を読む。`chat_service.py` は `app.hearing`・`app.models.hearing_point`・`app.repositories.hearing_point`(34-1)と `app.schemas.hearing`(同じ章の先の行)を読む。`projects.py` は `HearingPointsRead`(同じ章)を読む。`fake.py` は `app.hearing.POINT_DEFS`(34-1)と `app.schemas.hearing`(同じ章)を読む。テストは `app.hearing`・`app.repositories.hearing_point`(34-1)、`app.schemas.hearing`・`get_hearing_points`・`_POINTS_JUDGE_PROMPT`(同じ章)を読む。
- 34-3: `hearingApi.ts` は新しい import を足していない。`hearing-store.ts` は `getHearingPoints`・`HearingPointsView`(同じ章の先の行)を読む。`HearingPointsPanel.tsx` は `hearingApi.ts` の型(同じ章)と既存の `tableStyles`(Phase 17・21)を読む。`ChatPageContent.tsx` は `HearingPointsPanel`(同じ章)と tamagui の `useMedia` を読む。
- 前方 import は無い。章が作成・更新するファイルは、その章のテストが少なくとも1度 import する(34-1 のモデル・alembic 以外のモデルの変更はリポジトリのテストが、alembic はマイグレーションの往復で確かめた。34-2 の `projects.py` は `test_chat_service.py` が `get_hearing_points` を import する)。

## 検証結果

- 部分テスト: devex-api の 34-1・34-2 のテスト 59 件成功(1回目)。ruff check・pyright(変更したファイル)成功。devex-ui の `src/features/hearing` 100 件成功、`tsc --noEmit`・eslint 成功(既存の警告1件のみ)。
- マイグレーション: ローカルの開発 DB で `upgrade head` → `downgrade -1` → `upgrade head` を確かめた。
- 統合テスト: `test_projects_flow.py` を専用の DB(`docker-compose.test.yml`)で流し、4 件成功。
- Phase 完了時の全体テスト(#18): devex-api 825 件成功、devex-ui 657 件成功(`--maxWorkers=4`。Phase 33 の 644 件 + この Phase の 13 件)、`npm run build` 成功(いずれも1回目)。
- `samples_check.py`(`--api-since HEAD --ui-since HEAD`): 不一致 0 件・作り忘れ 0 件(一致 477 / 並び順のみ差 8 / 例外 5)。`link_check.py`: 切れ 0 件(3306 件)。

## 未消化の申し送り(#37)

Phase 33 から引き継いだもの:

- **持ち越し(Phase 22 から)**:
  - 段階6が開いていないときの、05 の詳細バッジ
  - ER の主キーの NULL の表示
- **E2E を CI で流すか**: 未定([`retrospective-memo.md`](../retrospective-memo.md) に候補として記録済み)。#36 のまま続ける。
- **コミュニケーション図**: 後回し([25-5](../Phase-25/Phase-25-5.md))。
- **「段階Nで直す」の移動先での強調**: 段階5は手順・処理を開くが、段階3・4・7は段階を開くだけ。必要なら各パネルに `focus` を読ませる。
- **「AI に提案を求める」**: ステージ8(AI 設計レビュー・再ヒアリング)との境界として申し送る。
- **段階8の生成の入力の大きさ**(Phase 29 から): 問題になれば測る。
- **生成済みの簡易モードのプロジェクト**: Phase 31 より前に生成した文書では、段階8の単位が空になる。文書を再生成すると使える。
- **WBS の書式の守られ方**: ベースライン(33-1)の簡易モードでも、WBS は書式どおりに解析できた。
- **DF の ID の振り直し**: ステージ6の要件ID でも同じ問題が起きうるので、Phase 36 の未確定事項に入れた([33-5](../Phase-33/Phase-33-5.md))。
- **ベースラインで見つけた、ステージ6の範囲の外の課題**([Phase 33](../Phase-33/Phase-33-introduction.md)): 段階3の CRUD 図の下書きと DFD の書き込みの線の食い違い、段階5の分岐の行の書き落とし、簡易モードの内部設計書の書き落とし。
- **Phase 35〜40 の未確定事項**: [33-5](../Phase-33/Phase-33-5.md)「未確定事項」。

この Phase で解決したもの:

- **Phase 34 の未確定事項**([33-5](../Phase-33/Phase-33-5.md)): 上の「着手時の相談で決めたこと」で決めた。

この Phase で生まれたもの:

- **画面確認(Phase 39・40 でまとめて行う。#37 の運用注記)**: チャット画面の観点の表(広い画面で右、狭い画面で上に畳む。1024px の前後で置き場所が変わる)、実 LLM での表の埋まり方(根拠の番号が正しく返るか、`adopted` と `decided` の使い分け)、必須がそろったときのまとめの読みやすさ。
- **実 LLM の判定の質**: 判定の LLM が規模を返さない・根拠の番号を返さない場合、観点が決まらないまま進む(安全側)。Phase 39 の効果測定で、聞けた事実の数と合わせて確かめる。足りなければプロンプトを直す。
- **判定の LLM の入力の大きさ**: 判定のたびに観点の表(16行)をプロンプトに足した。会話が長くなると入力が増えるので、問題になれば測る。
- **E2E の文言**: 十分になったときのチャットのまとめが、偽 LLM の要約の文から、表の箇条書き(「- 規模: 個人・小規模」…)に変わった。E2E がまとめの文言を見ていないかは Phase 40 で確かめる(`e2e/` に要約の文言の検索は見当たらなかった)。
- **セッションの区切りの記録**: Phase 34 は1セッションで行った(計画モードで質問1回 → 34-1 → 34-2 → 34-3 → samples → 教材)。全体テストは Phase 完了時の1回だけ。

## 後続 Phase での改訂

- [Phase 35](../Phase-35/Phase-35-introduction.md): 返信の生成を `stream_reply` から `_compose_reply` に切り出し、本文と選択肢カードの構造化出力の1回にした(トークンごとに流さず、`invoke_with_retry` を通る)。返信の前に、カードの回答を「AI の提案を採用」として表に記録する。`chat_histories` に `cards` の列を足した。

## Phase 完了チェック(#22)

1. 判定の LLM に「十分かどうか」を聞かず、観点ごとの状態と根拠だけを返させるのはなぜか。ベースラインで起きたこと(未達のまま「十分」)と結びつけて説明できるか。
2. 根拠の発言が無い「決定」を取り込まない規則は、どの層(純粋関数・サービス・LLM のプロンプト)に置いたか。プロンプトだけに頼らない理由は何か。
3. 規模が決まるまで「個人・小規模」の列で数えるのは、どんな問いの順につながるか(返信の LLM に渡す観点と合わせて)。
4. 判定に失敗したとき、観点の表と完了判定(`hearing_check`)はそれぞれどうなるか。画面はその状態をどう読むか。
5. `test_chat_service.py` で、LLM をスタブにしてもテストの意味があるのはなぜか。スタブの判定とコードの完了判定の役割の分け方から説明できるか。

## 次のフェーズ

**Phase 35**: 選択肢カード(場面で問う構造化した問い・SSE のカードのイベント・カードの UI・選択の送信と「採用」の記録)。着手時に自動実装モード(#21)と [33-5](../Phase-33/Phase-33-5.md) の Phase 35 の未確定事項を決める。
