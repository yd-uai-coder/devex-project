# Phase 112 導入: 使い勝手の直し ── 反映の前 → 後と、重なる CR の競合のガード

## 目的

[Phase 111](../Phase-111/Phase-111-introduction.md) のユーザーの画面確認([111-3](../Phase-111/Phase-111-3.md))で出た指摘2件を直す。ステージ14(変更の取り込み)の最初の実装の Phase で、取り込みの画面(Phase 116)を直した部品の上に作るため、先に置いた([111-4](../Phase-111/Phase-111-4.md))。

- **反映の前 → 後**(指摘 #7・#8): CR を文書へ反映したとき、どこが変わったかが分からない。反映の直前の版と作った版を、要素のキーでシステムが比べ(LLM は使わない)、影響のタブに要素ごとの前 → 後を出す。確認事項の「CR-n の反映で文が変わりました →」から、その行へ行ける。
- **重なる CR の競合のガード**(指摘 #3): 同じ要件を対象にする CR の、後から反映した方が先の変更を上書きしうる。基準の束の後にほかの CR の反映で対象の要件が変わっていれば知らせ、反映は「今の文と見比べて確かめた」の印を求める。

## パイプライン上の位置づけ・前提

```
[Phase 82]  同じ要件の CR も作れる。重なりは示すだけ(overlaps)
[Phase 85]  CR を渡した再生成 = 反映。時系列の apply の行に作った版とモデル名
[Phase 91〜97]  合意の記録(agreement_records。要素ごと・追記だけ)・合意の保護(protection)
        ▼
[112-1 前 → 後(API)]  agreement_items × 2版 → body_of で比べる → apply の refs.changes
[112-2 前 → 後(画面)]  影響のタブ「反映で変わった所」・?tab=impact&focus=<キー>
[112-3 競合(API)]  合意の記録: 基準の束より後に、ほかの CR が中身を変えた行 → conflicts
                   印 conflict_checks・反映の受け付けで 409・反映の指示に今の文
[112-4 競合(画面)]  見出しの下の知らせ・確かめのボタン・反映のボタンの止め・ダイアログの1行
        ▼
[Phase 113]  束の鮮度(changed_after を使う)
```

- **前提として読むもの**: [111-3](../Phase-111/Phase-111-3.md)(指摘と調べたこと)、[111-4](../Phase-111/Phase-111-4.md) の Phase 112 の行と未確定事項、[外部設計書](../../docs/external_design.md) 2.14節(反映)・2.15節(合意の精度)・2.17節。
- **この Phase を始めた時点の状態**:
  - 外側のリポジトリは `b93361d`(ステージ14 の要件確認)。devex-api は `stage11-15` ブランチの `72fe5b6`、devex-ui は `main` の `e90105c`。どれも未コミットの変更なし。
  - `tagmerge.py` の手直し(振り返り 18.7)は Phase 111 のセッションで済んでいた。章ごとの写しの手順([`tools/README.md`](../tools/README.md))で samples に当てた。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(着手時の決定1)。本体(`devex-api`・`devex-ui`)と samples に同じ内容を書いた。

E2E: この Phase では流さない。ステージ14 の E2E は、Phase 117 で既存を含めて全部流す(#36)。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 112 開始時」。質問は計画モードで1回(4問)。すべて推奨どおり。

1. **自動実装モードと分け方**: on・1 Phase 4章(112a・112b に分けない。どちらも反映の周りで、合意の記録と純粋関数を共有するため)。
2. **前 → 後の保存先**: 時系列の `apply` の行の `refs`。既に反映済みの CR(題材の CR-6 など)は後から作らず「前 → 後を残す前の反映」と出す。
3. **前 → 後の範囲**: 文書の合意の対象の要素だけ。範囲の外で合意の形に戻した所(版の `protection`)も「合意の形に戻した」として並べる。段階は今までの印と予測の比較に任せる。
4. **確かめの印**: CR の列(`conflict_checks`)。確かめた後にほかの CR がさらに変えたら求め直す。共有リンクの画面には出さない。

ほかに、111-4 の「どの Phase も」の項: テンプレートから取り込むものは無い。簡易ドキュメントモードは、CR がもともと詳細設計モードだけなので、新しい入口は無い(`_load` の `require_detailed` で断る)。

**推奨と違った選択は0件**。計画の差し戻しも無い。#39 の材料。

Claude の判断:
- 前 → 後は、新しい API を作らず、比較の API(`GET .../comparison`)に `reflections` を足した(影響のタブが反映の後に既に読んでいるため)。
- 競合の判定は、版でなく合意の記録で行った(記録は消えず、束と CR の反映が順つきで残る)。束の後に CR が変えた要素の取り出し(`changed_after`)は、Phase 113 の束の鮮度で使う前提で分けた(#17)。
- 画面確認で、文を変えなかった反映(偽の LLM が同じ文を返した CR-1)が「先に変えた」と出ることを見つけ、中身が前の記録と同じ行を数えないようにした([`q_a.md`](../q_a.md) の CR。#38・#40)。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-112-1.md`](./Phase-112-1.md) | 反映の前 → 後(API): 比べ方・記録・比較の応答 | `app/agreements/reflection_diff.py` ほか | なし |
| [`Phase-112-2.md`](./Phase-112-2.md) | 反映の前 → 後(画面): 影響のタブ・URL のタブと要素・確認事項のリンク | `ReflectionChanges.tsx` ほか | 112-1 |
| [`Phase-112-3.md`](./Phase-112-3.md) | 競合のガード(API): 判定・印・409・反映の指示 | `app/change_requests/conflicts.py`・マイグレーション ほか | なし(112-1 と同じファイルを触る) |
| [`Phase-112-4.md`](./Phase-112-4.md) | 競合のガード(画面): 知らせ・確かめ・反映のボタンの止め | `ConflictNotice.tsx` ほか | 112-2・112-3 |

## サンプルコード一覧

新規(8):
- backend: [`reflection_diff.py`](../samples/backend/app/agreements/reflection_diff.py)・[`conflicts.py`](../samples/backend/app/change_requests/conflicts.py)・[マイグレーション `c4e8a1f7b2d6`](../samples/backend/alembic/versions/c4e8a1f7b2d6_add_change_request_conflict_checks.py)・テスト3本([`test_reflection_diff.py`](../samples/backend/tests/unit/test_reflection_diff.py)・[`test_change_request_conflicts.py`](../samples/backend/tests/unit/test_change_request_conflicts.py)・[`test_change_request_conflict_guard.py`](../samples/backend/tests/unit/test_change_request_conflict_guard.py))
- frontend: [`ReflectionChanges.tsx`](../samples/frontend/src/features/change-requests/components/ReflectionChanges.tsx)・[`ConflictNotice.tsx`](../samples/frontend/src/features/change-requests/components/ConflictNotice.tsx) とそのテスト2本

更新: backend 15・frontend 21(各章の表)。#29 のタグは `Phase-112-1`〜`112-4`。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 作成・更新するファイル | 責務(1行) | テスト観点 |
|---|---|---|---|
| 112-1 | `reflection_diff.py` | 前後の合意の要素を比べ、欄ごとの前 → 後・種類・区分にする | 区分・追加と削除・戻した・保存の形の往復 |
| 112-1 | `change_request_service.py`・`doc_generator_service.py` | 反映のときに前 → 後を時系列に残す | 反映の行の `refs.changes` |
| 112-1 | `schemas/change_request.py`・ルート | 比較の応答の `reflections` | 記録なしの反映・表示名 |
| 112-2 | `changeRequestOps.ts`・ページ・詳細 | URL のタブと要素・見出しの分け方 | 知らないタブは内容 |
| 112-2 | `ReflectionChanges.tsx`・`ImpactTab.tsx`・`ConfirmationTable.tsx` | 反映で変わった所と、確認事項からのリンク | 最新の反映の行だけ目立たせる |
| 112-3 | `conflicts.py` | 合意の記録から競合と印の効き目を決める | 自分・新しい束・文を変えない反映は競合でない |
| 112-3 | モデル・マイグレーション・サービス・ルート・`errors.py` | 詳細の `conflicts`・確かめ・反映の 409 | 印は後の変更で外れる |
| 112-3 | `instruction.py` | 反映の指示に今の文を添える | 消えた要件の1行 |
| 112-4 | 型・API・ストア・`changeRequestOps.ts` | 確かめの操作・未確認の数え方 | POST と詳細の置き換え |
| 112-4 | `ConflictNotice.tsx`・`ImpactTab.tsx`・`ChangeRequestActions.tsx`・`DecisionDialog.tsx`・`ContentTab.tsx` | 知らせ・止め・ダイアログの1行・案内 | 反映だけ止め、説明済み・合意は止めない |

## 写経順序(#23)

章番号順(112-1 → 112-2 → 112-3 → 112-4)。各章の表は依存順(#30)。実装は 112-1 → 112-3 → 112-2 → 112-4(API を先に)の順で行ったが、112-2 は 112-3 の API を使わず、112-3 は 112-2 の画面を使わないので、章番号順に写しても import は切れない。

実 import 監査(#15): 各章の終わりの本体の写し(章ごとの写しの手順)で、各ファイルの import を読んだ。前方 import は無い(112-1 の `change_request_service.py` は `conflicts` を、112-2 の型は `ChangeRequestConflictRead` を持たない。どちらも 112-3・112-4 で足した)。各章のテストが、その章の全ファイルを import する(マイグレーションは Phase 117 の往復で確かめる。ルートは統合テストと `test_change_requests_api.py` のルートの登録)。

## 検証結果

- devex-api:
  - ユニット全体 `uv run pytest`: 1915 件が通った(競合の判定の直しの後)。
  - 統合テスト `tests/integration/test_change_requests_flow.py`(専用の DB): 10 件が通った。
  - `ruff check`: 0 件。`uvx pyright`(触ったファイル): 0 件。
  - マイグレーション: 単一の head で ID の衝突なしを確かめ、開発 DB を `c4e8a1f7b2d6` に上げた(往復は Phase 117)。
- devex-ui: `npx tsc --noEmit`: 0 件。`npm run lint`: エラー 0(警告は既存の `streamChat.test.ts` の1件だけ)。全体テスト `npx vitest run --maxWorkers=4`: 212 ファイル・1371 件が通った(その後に `ContentTab.test.tsx` に1行足して流した)。
- `textbook/tools/samples_check.py --api-since HEAD --ui-since HEAD`: 不一致 0・本体のみ 0(一致 1078 / 並び順のみ差 8 / 例外 5)。
- `textbook/tools/link_check.py`: リンク切れ 0 件。
- ヘッドレスのブラウザ(run-devex-ui の手順。E2E の捨てのプロジェクト `e2e-cr-1792937864529@example.com` の「予約の CR」):
  - API で CR-2(B-1 基準。FR-001 に承認を足す)を作り、説明済み・合意にして、文書へ反映した(**実 LLM 1回**。既定の Gemini。要件定義書・外部設計書と自己診断。概算 $0.01 未満)。影響のタブ(`?tab=impact&focus=req:FR-001`)に、CR の対象(FR-001 の内容・根拠の観点)と予測した要素(SCR-001・`POST /api/v1/reservations`)の前 → 後が出て、FR-001 の行が目立った。
  - CR-3(B-1 基準。FR-001 の期間)を作ると、見出しの下に「CR-2 が先に変えた」(束の文・今の文)が出た。説明済みのダイアログに知らせの1行が出た(取り消した)。「今の文と見比べて確かめた」で確かめ済みになった。
  - その前に、文を変えなかった CR-1 の反映が「先に変えた」と出ることを見つけて直した(上の Claude の判断)。
  - 想定外のブラウザの誤りは無し(ログイン前の `401 POST /auth/refresh` と、下書きの無い CR の `404 GET .../options/draft` だけ)。
  - **残したデータ**: このプロジェクトの CR-2(反映済み。要件定義書・外部設計書 v3)と CR-3(下書き・競合は確かめ済み)。トレンド追跡アプリは触っていない。
- E2E: 流していない(Phase 117)。

## 未消化の申し送り(#37)

[Phase 111](../Phase-111/Phase-111-introduction.md#未消化の申し送り37) から引き継いだもの。

**ステージ14 の中で扱うもの**(行き先は [111-4](../Phase-111/Phase-111-4.md)):
- **古い束を基準にした説明**(P110・18.3)→ Phase 113・115・116(決定5)。Phase 113 の束の鮮度は、112-3 の `changed_after`(文を変えなかった反映は数えない)を使う。
- **開発環境での画面確認**: この Phase の画面は、上のヘッドレスで見た。ユーザーの確認は Phase 117 の開発環境での画面確認でまとめて行う(#37 の運用注記)。見てほしい所: 影響のタブの「反映で変わった所」(欄が多い要素の読みやすさ・範囲の外の多さ)、確認事項からのリンク、競合の知らせの置き場と文。
- **合意済みの内容の中の食い違い**: 題材の外部設計書 2.4・2.6 に CR-6 の後も「TOP10」が残る。Phase 117 で B-7 を作る前に決める。

**ステージ14 の範囲の外**:
- **本番への反映と本番での確認**: ステージ15 の完了時に、[`OPERATIONS.md`](../../devex-api/OPERATIONS.md) 10.8節で行う。この Phase のマイグレーション `c4e8a1f7b2d6` も、Phase 117 で 10.8節のステージ14 の分に足す。
- **使われ方を見て決める**: 要約・案の下書きの回数の上限、実 LLM が利用者の `prev_id` を書くか(P105)、実 LLM の段階1 の処理のまとめ(P110)、取り込みの LLM の回数の上限。
- **LLM の案の下書きは両端に寄る**(18.4): 生成の質の候補として持ち越す。
- 振り返り 6節の残り5件・生成の質の候補4件(Phase 100 と同じ)。

**持ち越し**(触るときに直す。中身は [振り返り](../retrospectives/project-retrospective.md) 8節):
- `test_chat_service.py` などの pyright の指摘(Phase 40)
- devex-ui の並列のテストのタイムアウト(Phase 44)
- 偽 LLM の外部設計書の GET に DF が無い(Phase 45)
- `DfdEditorTabs` のテストのまれな失敗(Phase 77)
- Google の公開鍵を毎回取りに行く(Phase 74)
- `ListCard` の入れ物(Phase 79。テンプレートでは直した)
- 英語のままの refresh の失敗の文(Phase 79)
- `streamChat.test.ts` の lint の警告(既存)
- `appendix/measurements/stage11/measure.py` の `ruff check` の指摘(Phase 80 から)
- 反映の後の CR の流れの部品・束の写しの取り出し(#17。触るときに寄せる)
- `tagmerge.py` のメソッドの中身を移す変更の扱い(P104)と、import 区間の中の名前の無い追記のタグ(P109)。README の「要手当て」に書いた
- 段階5 の `StrayProcedureTable` と `StrayFunctionTable` の重なり(#17)
- ログインの無い共有リンクの画面でも `POST /auth/refresh` が呼ばれて 401 になる(P108・110)

**ユーザーが決めるもの**:
- **開発環境の後始末**: 題材「トレンド追跡アプリ」の B-5・B-6・CR-5・CR-6 と CR-6 の共有リンク(期限 2026-11-08)、E2E の捨てのプロジェクト(この Phase で「予約の CR」に CR-2・CR-3 を足した)。
- **タグ**: devex-api `phase-101`〜`phase-106`・`phase-110`、devex-ui `phase-107`〜`phase-110`(振り返り 18.1 の Q8)。この Phase は両方に `phase-112`。
- **未コミット**: この Phase の分(外側・devex-api・devex-ui)。コミットはユーザーが行う(#35)。

**この Phase で生まれたもの**:
- **前 → 後を残す前の反映**: 題材の CR-6 など、この Phase より前の反映は「前 → 後を残す前の反映」と出る(着手時の決定2。反映をやり直すと残る)。Phase 117 で題材を使うときに気にする。
- **反映の受け付けの後の競合**: 受け付けで確かめ、バックグラウンドの生成では確かめない(生成中は別の反映が 409 で止まるため、間に変わることは無い)。
- **セッションの区切りの記録**: Phase 112 は1セッションで行った。
  1. 計画モードで調査した(エージェントは使わず直接)。質問を1回(4問)。計画の承認。
  2. 112-1 → 112-3(API)→ 112-2 → 112-4(画面)。章ごとに本体の写しを取った。
  3. ヘッドレスの画面確認(実 LLM 1回)→ 競合の判定の直し(CR)。
  4. samples(`tagmerge.py`。章ごとに)→ docs → 教材・q_a。

**この Phase で解決したもの**:
- **使い勝手の直し**(111-3 の指摘2件: 反映の前 → 後・重なる CR の競合のガード)→ [112-1](./Phase-112-1.md)〜[112-4](./Phase-112-4.md)。
- **重なる CR の競合のガードが無い**(111-3。Phase 82 の決定の続き)→ [112-3](./Phase-112-3.md)・[112-4](./Phase-112-4.md)。

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

設問は Phase の要点の要約である(回答は求めない)。

1. 反映の前 → 後を LLM でなくシステムが比べるのはなぜか。比べる単位を「合意の対象の要素」と `body_of` にしたことで、合意の保護・状態とどこがそろうか。
2. 前 → 後を反映のときに求めて時系列に残し、後から求め直さないのはなぜか。前 → 後を残す前の反映をどう見せたか。
3. 競合を版でなく合意の記録で判定するのはなぜか。基準の束が新しい CR・自分の反映・文を変えなかった反映が競合にならない理由は何か。
4. 反映だけを止め、作成・説明済み・合意を止めないのはなぜか。確かめの印が、後の変更で外れるようにしたのはなぜか。
5. 画面確認で見つけた「文を変えなかった反映」は、単体テストのどの前提から漏れていたか。

## 次のフェーズ

**Phase 113**: 資料 API と束の鮮度。着手時に、[111-4](../Phase-111/Phase-111-4.md) の Phase 113 の未確定事項を決める(自動実装モード・テンプレートから取り込むものも、そこで決める)。束の鮮度の判定は、112-3 の `changed_after` から始める。
