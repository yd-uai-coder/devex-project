# Phase 43 導入: 承認時の写しと要素単位の陳腐化

## 目的

ステージ7(変更影響分析・変更管理)の2つ目の実装 Phase。[Phase 42](../Phase-42/Phase-42-introduction.md) で作った影響のたどり方(`impact_of`)は、まだどこからも呼ばれていなかった。この Phase で「何が変わったか」を取り、影響を段階に**印**として残し、「確認済み」と承認し直しの条件、API までをつなぐ。

- **承認時の写し**: 段階を承認したときの model を写しとして残す(43-1)。
- **要素の差分**: 前と後の要素を突き合わせ、内容の変更・改名・消えた・増えたを求める(43-2)。
- **印の記録と確認済み**: 段階の承認と文書の版の切り替えのときに影響を求めて、届いた段階に印を記録する。他から届いた未確認の印があれば承認し直せない(43-3)。
- **API**: 変更の影響の取得と、印の確認済みの切り替え(43-4)。

画面(作業領域の「変更の影響」パネル・段階の表の印・「表で見る」)は [Phase 44](../Phase-41/Phase-41-5.md) で作る。

## パイプライン上の位置づけ・前提

```
[43-1 写し]  承認 ─▶ design_stages.approved_model(直前の1件)   Alembic e5f6a7b8c9d1
        │
        ▼
[43-2 差分]  build_elements(写し) と build_elements(今) ─▶ diff_elements ─▶ ElementChange ─▶ to_trace_changes ─▶ Change
        │
        ▼
[43-3 印]   Change ─▶ impact_of(42-4)─▶ marks_for ─▶ 届いた段階の design_stages.impact に record
            段階の承認(写しと比べる)/ 文書の生成・復元(前に表示していた版と比べる)
            未確認の印(他から届いたもの)があれば承認は 409、review_marks で確認済みに
        │
        ▼
[43-4 API]  GET /design-stages/impact(記録した印 + 承認前の編集の pending の印 + 再生成の候補)
            POST /design-stages/{stage}/impact/review
        │
        ▼
[Phase 44]  作業領域の「変更の影響」パネル・段階の表の印・再生成の候補から部分再生成へ
```

- **前提として読むもの**:
  - [41-2](../Phase-41/Phase-41-2.md)(決定2・3・9)・[41-5](../Phase-41/Phase-41-5.md)(Phase 43 のスコープと未確定事項)。
  - [42-3](../Phase-42/Phase-42-3.md)(要素のキーと辺)・[42-4](../Phase-42/Phase-42-4.md)(たどり方の規則)。
  - [`docs/external_design.md`](../../docs/external_design.md) 2.10節・[`docs/internal_design.md`](../../docs/internal_design.md) 3.3節「7. 変更影響分析・変更管理」。
- **この Phase を始めた時点の状態**: Phase 42 までコミット済み(外側のリポジトリ・devex-api・devex-ui)。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(AI が本体へ実装し、`textbook/samples/` も同じ内容で作った)。

E2E: この Phase では流さない。既存の E2E は段階を初めて承認する流れだけで、写しが無いので印は付かず、承認を止める条件にも当たらない。ステージ7の E2E は Phase 50 で既存を含めて全部流す。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 43 開始時」を参照。すべて推奨どおり。

1. **自動実装モード**: on。
2. **印をいつ求めて、どこに残すか**: 変わった時に下流へ記録する(段階の承認時と文書の版の切り替え時に求め、届いた段階の行に残す)。承認前の編集は、その場の差分を「承認すると届く印」(pending)として返す。写しが1件だけなので、その場で差分を取る方式では上流を承認し直すと下流の印が消えるため。
3. **承認し直す条件**: 他から届いた印がすべて確認済みでないと承認できない(409)。まとめて確認済みにできる。承認するとその段階の印は消える。
4. **文書の差分の起点**: 直前に表示していた版(再生成・復元で切り替わる時に比べる)。

Claude の判断(計画の承認で確定、または実装中。41-5 の未確定事項の残り):

- **写しの置き場**: `design_stages` の列 `approved_model`、印は列 `impact`(1件だけなので別テーブルにしない。[43-1](./Phase-43-1.md))。
- **写しを撮る時**: 承認時だけ。既存データは承認の後に変わっていない行だけに写しを入れる([43-1](./Phase-43-1.md))。
- **印を記録する先**: 一度でも承認した段階だけ。文書の要素(置き場 0)には付けない([43-3](./Phase-43-3.md))。
- **自分の印は承認を止めない**: 同じ段階の中の依存で自分に付いた印は、次の承認で置き換える([43-3](./Phase-43-3.md))。
- **確認済みの消え方**: 承認で、その段階の印を全部消す。新しい変更が届いたら未確認に戻す([43-3](./Phase-43-3.md))。
- **改名に合わせた参照の書き換えは変わったものに入れない**(実装中に判断。改名なのに使う処理の全部に印が付いたため。[43-2](./Phase-43-2.md))。
- **ER のテーブル定義を写しに添える**(実装中に判断。**計画からの変更**: 計画では「ER は前後とも今のもの」だったが、ベースラインの S6(テーブルに列を足す)で印が0件になったため。[43-2](./Phase-43-2.md)・[43-3](./Phase-43-3.md))。
- **devex-ui は変えない**(型・画面は Phase 44)。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-43-1.md`](./Phase-43-1.md) | 承認時の写し | あり(BE・移行) | なし |
| [`Phase-43-2.md`](./Phase-43-2.md) | 要素の差分 | あり(BE) | なし(42-3 の要素) |
| [`Phase-43-3.md`](./Phase-43-3.md) | 印の記録と確認済み | あり(BE) | 43-1(写し)・43-2(差分) |
| [`Phase-43-4.md`](./Phase-43-4.md) | 変更の影響の API | あり(BE) | 43-3 |

## サンプルコード一覧

`textbook/samples/backend/` 配下:

- 43-1: `alembic/versions/e5f6a7b8c9d1_add_stage_snapshot.py`・`app/models/design_stage.py`・`app/services/design_stage_service.py`
- 43-2: `app/detailed_design/{data_model,__init__}.py`・`app/detailed_design/impact/{elements,diff,__init__}.py`
- 43-3: `app/detailed_design/impact/{marks,__init__}.py`・`app/services/{errors,design_stage_service,doc_generator_service}.py`
- 43-4: `app/schemas/design_stage.py`・`app/services/design_stage_service.py`・`app/api/routes/design_stages.py`
- テスト: `tests/fixtures/change_impact.py`・`tests/unit/test_{stage_snapshot_migration,impact_elements,impact_diff,impact_marks,design_stage_impact}.py`

devex-ui は変えていない。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| [43-1](./Phase-43-1.md) | 移行・`design_stage.py`・サービスの `approve` | 承認したときの model を写しとして残す | 移行の変換(承認済みで未編集だけ)・承認で写しが入り編集では変わらない(SUT は純粋関数とサービス。スタブはインメモリ SQLite) |
| [43-2](./Phase-43-2.md) | `impact/diff.py`・`elements.py` の `body` | 前後の要素から変わったものを求め、たどり方の変更にする | 内容の変更・改名の1対1・参照だけの書き換え・消えた/増えた・下書きの印と導いた辺は変更でない・ER の列(スタブ不要) |
| [43-3](./Phase-43-3.md) | `impact/marks.py`・サービス2つ・`errors.py` | 影響を印として届いた段階に記録し、確認済みと承認の条件を扱う | 印の求め方・記録・確認済み・止める印(スタブ不要)/ 承認・生成・復元での記録・409・確認済みで承認(スタブはインメモリ SQLite と FakeLLM) |
| [43-4](./Phase-43-4.md) | スキーマ・サービス・ルート | 印を API で返し、確認済みを切り替える | 応答の印・件数・再生成の候補・pending の印・簡易モード(スタブはインメモリ SQLite) |

## 写経順序(#23)

章番号順。各章の中は「この章で作成・更新したファイル」の表の順(#30。依存されるファイルが上、テストは末尾)。

実 import 監査(#15。全 import 文を読んで確かめた):

- 43-1: 移行ファイルは app を読まない。`design_stage.py` の新しい import は無い。サービスの `approve` は新しい名前を読まない。テストは `tests.fixtures.detailed_design`(既存)・`DesignStage`・`DesignStageRepository`・`DesignStageService`(既存)を読む。
- 43-2: `elements.py` の新しい import は `json` だけ。`data_model.py` は既存の `ErSemanticModel` を使う。`diff.py` は `elements`(`Element`・`ElementKind`。42-3)と `trace.Change`(42-4)を読む。`impact/__init__.py` は同じ章の `diff` を読む。`test_impact_diff.py` は `app.detailed_design.er_table_definitions`(同じ章)と `impact` のこの章までの名前を読む。
- 43-3: `marks.py` は `diff`(43-2)・`elements`・`trace` を読む。サービスは `impact` の 43-3 までの名前・`er_table_definitions`(43-2)・`stages.STAGE_INPUTS`(既存)・`DesignStageUnreviewedImpactError`(同じ章)を読む。`doc_generator_service.py` は `design_stage_service.DesignStageService`(既存)を読む。`tests/fixtures/change_impact.py` は既存の model・リポジトリを読む。`test_design_stage_impact.py` の 43-3 の分は `ER_SNAPSHOT_KEY`(同じ章)・`tests.fixtures.detailed_design`(`create_stage4_project`・`crud_model`・`er_model`。既存)・`upstream_outputs`・`FakeLLM`・`requirements_output`(既存)を読む。
- 43-4: サービスは `dataclasses.asdict`・`impact.REGENERATION_STAGES`(42-4)・この章のスキーマを読む。ルートはこの章のスキーマを読む。`test_design_stage_impact.py` の 43-4 の分(タグ付き)は、この章のルートの関数と `ImpactReview` を読む。
- 前方 import は無い。章が作成・更新するファイルは、その章のテストが少なくとも1度 import する(`data_model.py` は `app.detailed_design` 経由で `test_impact_diff.py`。各章の「テスト観点」)。

## 検証結果

- devex-api: 部分テスト(各章の「テスト観点」のコマンド)成功、`ruff check` 成功(`ruff format` は使わない)、pyright(`app/detailed_design/impact`・サービス2つ・スキーマ)0件。
- マイグレーションの往復: 開発 DB で `upgrade head` → `downgrade -1` → `upgrade head` 成功。98 行のうち、承認済みで未編集の 85 行すべてに写しが入った(承認の後に編集した行・下書きの行は写し無し)。
- ベースラインの生成物での確かめ: [`appendix/stage6-effect/detailed/stages/`](../../appendix/stage6-effect/README.md) の段階1〜8 で、S5(段階1の処理の変更)と S7(段階4のモジュールの改名)を「写し → 編集 → 承認」の形で流し、記録される印が `impact_of` を直接呼んだ結果と一致した(S5 12件・S7 6件。[42-4](../Phase-42/Phase-42-4.md) の数字と同じ)。S7 は、参照だけの書き換えを変わったものから外す前は、使う処理の全部に印が付いていた(43-2)。スクリプトは残していない。
- Phase 完了時の全体テスト(#18): devex-api 1003 件成功(Phase 42 の 970 件 + この Phase の 33 件)。devex-ui は変えていないので流していない。
- `samples_check.py`(`--api-since HEAD`): 不一致 0 件・作り忘れ 0 件(一致 534 / 並び順のみ差 8 / 例外 5)。`link_check.py`: 切れ 0 件。

## 未消化の申し送り(#37)

Phase 42 から引き継いだもの(未解決のまま):

- **持ち越し(Phase 22 から)**: 段階6が開いていないときの、05 の詳細バッジ / ER の主キーの NULL の表示。
- **E2E を CI で流すか**: 未定([`retrospective-memo.md`](../retrospective-memo.md) に候補として記録済み)。#36 のまま。
- **コミュニケーション図**: 後回し([25-5](../Phase-25/Phase-25-5.md))。
- **「AI に提案を求める」**: ステージ8との境界として申し送る。
- **段階8の生成の入力の大きさ・判定の LLM の入力の大きさ**: 問題になれば測る。
- **生成済みの簡易モードのプロジェクト**: Phase 31 より前に生成した文書では段階8の単位が空。再生成で使える。
- **既存のプロジェクトの会話の順**(Phase 35 から): 直さない。
- **`test_chat_service.py` の pyright の指摘4件**(Phase 40 から): 触るときに `isinstance` で絞る。
- **ステージ7の計画に入れたもの**: 「段階Nで直す」の移動先での強調 → Phase 44 / 簡易モードの内部設計書の書き落とし → Phase 45 / L2・L5・L6・L14 と判定のゆらぎ → Phase 47・49 / 段階3の CRUD の下書きと DFD の食い違い・段階5の分岐の行の書き落とし → Phase 48。
- **Phase 44〜50 の未確定事項**: [41-5](../Phase-41/Phase-41-5.md)「未確定事項」。
- **共有のモジュールの中で「どれを直すか」**: 示さない。効果測定では見落としとして数え続ける。
- **devex-ui の「開発用」メニュー**: ステージ7の完了時に、ユーザーが前と同じく外すかを決める。
- **共有の画面を通って別の処理に届く**(Phase 42 から): 止めるかは Phase 49 の数字で決める。
- **テーブルの変更は、そのテーブルを読み書きする全処理に届く**(Phase 42 から): Phase 49 で数える。この Phase で、段階1の処理にも印が付くことを確かめた([43-3](./Phase-43-3.md))。
- **文書の要素(要件・画面・API)からの影響は、まだ生成物で確かめていない**(Phase 42 から): Phase 49 で、測定用に文書の model を用意して測る。

この Phase で生まれたもの:

- **改名の後に下流の参照を直して承認すると、内容の変更として広がる**: 段階4でモジュールを改名し、段階5の手順の呼び出し先を新しいパスに直して段階5を承認すると、段階5の差分では改名が見えない(改名は段階4の差分)ので、手順の内容の変更として、その処理の手順書などに印が付く。過剰かどうかは Phase 49 で数える。
- **ER 以外の段階の外の図(段階2の DFD・データ辞書、段階4の構成図)の変更は差分に入らない**: 今までどおり段階の「古い」だけで扱う。DFD の線は段階3の CRUD の下書きの元なので、効いているかを Phase 49 で見る。
- **画面(Phase 44)で決めること**: 文書の要素(置き場 0)の印の出し方、pending の印の見せ方、確認済みをまとめて選ぶ操作。新しい 409(`DESIGN_STAGE_UNREVIEWED_IMPACT`)は、Phase 44 までは画面の共通のエラー表示に出るだけで、確認済みにする操作が画面に無い(開発中に段階を承認し直せないときは API で確認済みにする)。
- **セッションの区切りの記録**: Phase 43 は1セッションで行った(計画モードで質問4問 → 43-1 → 43-2 → 43-3 → 43-4 → ER の写し(S6 で気づいて足す)→ マイグレーションの往復 → ベースラインの生成物での確かめ → 全体テスト → samples → 教材)。

この Phase で解決したもの:

- **影響を求める関数は、まだどこからも呼ばれない**(Phase 42 から)→ 段階の承認と文書の版の切り替えから呼ぶ([43-3](./Phase-43-3.md))。
- 41-5 の Phase 43 の未確定事項(写しの置き場・撮る時・確認済みの置き場と消え方・承認し直しの条件・文書の差分の起点)→ この introduction の「着手時の相談で決めたこと」。

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

設問は Phase の要点の要約(回答は求めない)。

1. 写しが1件だけなのに、下流の段階の印が上流の承認し直しで消えないのはなぜか。印を「変わった時に記録する」ことから説明できるか。
2. 要素の差分で辺(`refs`)を比べず、内容(`body`)だけを比べるのはなぜか。手順の行から導くモジュール → テーブルの辺から説明できるか。
3. モジュールの改名で、依存する側のモジュールの依存先の書き換えを「変わったもの」に入れないのはなぜか。入れると何が起きたか。
4. 承認を止める印から、自分の承認で付いた印を外すのはなぜか。
5. ベースラインの S6 で気づいたことは何か。ER が段階の model の外にあることから説明できるか。

## 次のフェーズ

**Phase 44**: 影響の画面(作業領域の「変更の影響」パネル・段階の状態の印・各段階の表の行の印・「表で見る」の強調・再生成の候補から部分再生成へ)。着手時に自動実装モード(#21)と [41-5](../Phase-41/Phase-41-5.md) の Phase 44 の未確定事項を決める。新しい種類の画面なので、操作感は Phase の直後にユーザーが確かめる(41-5)。
