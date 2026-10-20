# Phase 89 導入: 効果測定・統合/E2E・画面確認(ステージ11 の最後)

## 目的

ステージ11(合意と変更の一巡)の最後の Phase。[80-4](../Phase-80/Phase-80-4.md) の Phase 89 として、Phase 81〜88 で作った合意済みの版・変更要求(CR)・予測・説明書・反映・再検証を、[ベースライン](../../appendix/measurements/stage11-baseline.md)と同じ題材と表で測り直し、マイルストーン12 を満たしたかを判定する。
- 同じ N2・同じ材料で、7段と4つの問いの表と影響の一覧を埋め直す ── [89-1](./Phase-89-1.md)
- CR の流れの E2E を足し、既存を含めて全部流す(#36)── [89-2](./Phase-89-2.md)
- マイグレーションの往復を確かめ、本番への反映の手順を下書きする ── [89-3](./Phase-89-3.md)
- Phase 87・88 から積んだ画面確認と、実 LLM での一巡を、開発環境で行う ── [89-4](./Phase-89-4.md)

**本番への反映は、この Phase では行わない**。着手時の相談で、ステージ11〜15 をまとめてステージ15 の完了時に出すと決めた(#40 の CR。下の「着手時の相談で決めたこと」)。

## パイプライン上の位置づけ・前提

```
ステージ11(Phase 80〜89)
  80 仕様診断・ベースライン(N2・7段・4つの問い・影響の一覧)
  81〜86 API(束・CR・予測・説明書・反映・再検証)
  87〜88 画面(CR・束・説明書)
  89 ── 効果測定(同じ N2・同じ表)                                         ──[89-1]
        CR の流れの E2E + 既存の全 E2E                                     ──[89-2]
        マイグレーションの往復・OPERATIONS.md 10.8(ステージ11〜15 の下書き)──[89-3]
        開発環境での画面確認・実 LLM での一巡                                ──[89-4]
  └→ ステージ12〜15 → ステージ15 の完了時に本番へ(10.8節)
```

- **前提として読むもの**:
  - ベースライン: [Phase 80-2](../Phase-80/Phase-80-2.md)・[`stage11-baseline.md`](../../appendix/measurements/stage11-baseline.md)。
  - 予測・比較・検証の純粋関数: [Phase 83](../Phase-83/Phase-83-introduction.md)・[Phase 85](../Phase-85/Phase-85-introduction.md)・[Phase 86](../Phase-86/Phase-86-introduction.md)。
  - 画面: [Phase 87](../Phase-87/Phase-87-introduction.md)・[Phase 88](../Phase-88/Phase-88-introduction.md)(申し送りの「画面確認」)。
  - 前のステージの最後の Phase: [Phase 79](../Phase-79/Phase-79-introduction.md)(E2E の流し方・マイグレーションの往復・手順の形)。
- **この Phase を始めた時点の状態**:
  - devex-api は `stage11-15` ブランチの `1cdba17`(Phase 88)。`main` は `origin/main` と同じ `cd5b1a9`(2026-10-19 の整理。`d7e2a9c4f1b3` を含む)。devex-ui は `main` の `6e8b96c`(origin より1つ先)。外側のリポジトリは `cb9ec5a`。どれも作業ツリーはきれい。
  - alembic の head は `be106e6426be`。本番(見込み `d7e2a9c4f1b3`)から9本。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(本体 + samples)。本体のコードは変えない(画面確認の指摘で直すときは「Phase 完了後の調整」に書く)。

E2E: **この Phase で既存を含めて全部流す**。CR の流れの spec を1本足す([89-2](./Phase-89-2.md))。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 89 開始時」を参照。計画モードで2回(4問 + 2問)聞いた。

| # | 問い | 決定 |
|---|---|---|
| 1 | 自動実装モードと CR の流れの E2E の範囲 | on・**文書だけの一巡**(段階は作らない)。既存と合わせて全部流す(推奨どおり) |
| 2 | 実 LLM をどこで使うか | 本番確認で1回(推奨どおり)→ 3 を受けて 5 で置き場を変えた |
| 3 | 本番への反映 | **ステージ15 の完了時にまとめて出す**(推奨は「この Phase で出す」) |
| 4 | ロールバックの確かめ方 | 開発 DB の複製で往復(推奨どおり) |
| 5 | 実 LLM の1回 | **開発環境で今1回**(推奨どおり。Gemini 3.5 Flash-Lite) |
| 6 | 画面確認と手順 | 画面確認は開発環境でこの Phase に行う。手順は `OPERATIONS.md` 10.8節に下書きする(推奨どおり) |

推奨と違った選択は1件(3)。計画の差し戻しは無し。#39 の材料。

- **3 は #40 の CR**: 80-4 の計画(Phase 89 で本番へ)を変えるので、`q_a.md` に CR の形で残し、[実装計画](../../docs/implementation_plan.md) 4.1・[位置付け](../../appendix/devex_project_positioning.md) 12章・[80-4](../Phase-80/Phase-80-4.md) に反映した。マイルストーン12 の判断基準は本番を含まないので変わらない。

Claude の判断(計画の承認で確定、または作業中):

- 効果測定のスクリプトは、ベースラインの `measure.py` の材料の読み出しと反映の模擬を import して使う(同じ材料・同じ変更で比べるため。#17)。
- E2E の CR の対象は偽の要件定義書の `FR-001`(偽の外部設計書の画面と API がこの要件を持つので、文書の側の確認まで通る)。
- **作業中**: ユーザーの `npm run dev`(3000 番)と実 LLM の backend が動いていたので、Phase 79 と同じく止めずに流した([89-2](./Phase-89-2.md))。
- **作業中**: たどる記録に合意の相手が出ないことが E2E で分かった。spec は内容のタブで確かめる形にし、見せ方は画面確認で決める([89-4](./Phase-89-4.md))。
- インフラの文書(`OPERATIONS.md`)と測定のスクリプト(`appendix/`)は samples に写さない(#21。前の Phase と同じ)。

## 章一覧

| 章 | トピック | 依存 | 実装ファイル |
|---|---|---|---|
| [89-1](./Phase-89-1.md) | 効果測定(N2・同じ表・決定的) | Phase 81〜86 | 無し(`appendix/` の測定のスクリプトだけ。#13/#15 の対象外) |
| [89-2](./Phase-89-2.md) | CR の流れの E2E と全 E2E | Phase 87・88 | `e2e/change-request-flow.spec.ts` |
| [89-3](./Phase-89-3.md) | マイグレーションの往復と手順の下書き(10.8節) | Phase 81〜88 のマイグレーション | 無し(インフラの文書。#13/#15 の対象外) |
| [89-4](./Phase-89-4.md) | 開発環境での画面確認・実 LLM での一巡 | 89-1〜89-3 | 無し(確認の記録。指摘の修正は「Phase 完了後の調整」) |

## サンプルコード一覧

| ファイル | 章 | 新規/更新 |
|---|---|---|
| [`frontend/e2e/change-request-flow.spec.ts`](../samples/frontend/e2e/change-request-flow.spec.ts) | 89-2 | 新規 |

samples に写さないもの: [`appendix/measurements/stage11/effect.py`](../../appendix/measurements/stage11/effect.py)(測定のスクリプト)・[`devex-api/OPERATIONS.md`](../../devex-api/OPERATIONS.md)(インフラの文書)。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 作るもの | 責務 | テスト観点 |
|---|---|---|---|
| 89-1 | `effect.py` | ベースラインと同じ材料・同じ CR で、予測・説明書・反映の模擬・比較・検証を純粋関数のまま一巡させ、表を出す | 2回流して同じ出力(決定的)。予測が正解の6件と一致するか |
| 89-2 | `change-request-flow.spec.ts` | 文書 → B-1 → CR → 説明書 → 説明済み → 合意 → 文書への反映 → 文書の側の確認 → 検証済み → B-2 → たどる記録 を画面で通す | SUT = 画面 + API、ドライバ = Playwright、スタブ = 偽の LLM(と偽の Google の検証) |
| 89-3 | 10.8節 | ステージ11〜15 をまとめて出す手順(ステージ11 の分)・確認の表・ロールバック | 複製 DB の2往復で、既存の表の行の数が変わらず、head が戻る |
| 89-4 | 画面確認の記録 | Phase 87・88 の申し送りの画面確認と、実 LLM での一巡(反映・要約) | 人が見る。実 LLM の結果は DB と API から読んで効果測定に足す |

## 写経順序(#23)

章番号順。89-1 と 89-3 は本体のファイルを作らないので、写経するのは 89-2 の spec だけ。

## 検証結果

- 89-1: `effect.py` を2回流して同じ出力。予測 6件(正解と一致)・反映の印 4件・文書の側の確認 2件・比較は一致 4 / 予測だけ 2(文書の側)/ 実際だけ 0。`ruff check` 成功。
- 89-2: 新しい spec は3回直して成功(spec の側の誤り3件。[89-2](./Phase-89-2.md))。全 E2E **10件成功**(既存9 + 新1。2.6分)を2回。devex-ui の `tsc` 成功、`lint` は既存の警告1件だけ、`build` 成功。
- 89-3: 複製 DB で 9本の downgrade → upgrade を2往復。既存の表の行の数は不変、head は `d7e2a9c4f1b3` ↔ `be106e6426be`。
- 本体のコードは変えていない(devex-api・devex-ui のソースの変更は無し。spec の追加だけ)。

## 未消化の申し送り(#37)

[Phase 88](../Phase-88/Phase-88-introduction.md#未消化の申し送り37) から引き継いだもの。

**ステージ11 の範囲の外へ送るもの**:
- **CR を渡さない再生成で、合意した行が動く**(この Phase で生まれた。[89-4](./Phase-89-4.md) の実 LLM での一巡): FR-005 の文は同じまま、出どころが「採用」から「推測」に変わり、関係の無い印が3件付いた。ステージ12(合意済みの行の保護)で扱う。
- **影響が広がる変更の実 LLM での比較**(この Phase で生まれた): 実 LLM の一巡は予測0件の変更だった。予測と実際の印の比較を実 LLM で見るのは、ステージ12 以降の測定で行う。
- **段階の承認で付く印の漏れ**: CR を渡して作り直した段階を承認したとき、新しく生まれた要素から先の印は CR に結ばれない(Phase 86 のユーザー決定)。N2 の材料では差分が要件1件で出ない([89-1](./Phase-89-1.md))。段階の作り直しが要る変更の測定を、ステージ12(行単位の変更の履歴)で行う。
- **下書きの中の直しは時系列に残さない**: ステージ12(行単位の変更の履歴)。
- **要約の生成の回数の上限**: 置いていない(文書の生成と同じ)。既定のキーで使われすぎると分かったら決める。
- **束の一覧の入れた CR**: CR の一覧から引いている。CR が多くなって重いと分かったら、束の応答に足す。
- **反映の後の CR の流れの部品**: `tests/fixtures/change_requests.py`。85-2〜85-4 のテストの中の同じ手順は、触るときに寄せる(#17)。
- **本番への反映と本番での確認**(この Phase で生まれた。#40 の CR): ステージ15 の完了時に、[`OPERATIONS.md`](../../devex-api/OPERATIONS.md) 10.8節で行う。各ステージは 10.8節に自分の分(マイグレーション・確認の表・ロールバック)を足す。
- 振り返り 6節の残り7件(ステージ12: 推測の採用率・決める機会 / ステージ15 の前後: 前提作業・戻し方・版の一致 / ヒアリングを扱うステージ: 認証の対の問い・基本機能の観点)。
- 生成の質の候補4件(再生成のきっかけの残り・設計に無いテスト・日本語の名前のデータストア・語の表の範囲)。
- 新しい要件を足す CR の予測の起点を人が選ぶ形(ステージ12 以降)。
- 規模の集計と選択肢つきの説明(ステージ13)。

**持ち越し**(触るときに直す。中身は [振り返り](../retrospectives/project-retrospective.md) 8節):
- `test_chat_service.py` などの pyright の指摘(Phase 40)
- devex-ui の並列のテストのタイムアウト(Phase 44)
- 偽 LLM の外部設計書の GET に DF が無い(Phase 45)
- `DfdEditorTabs` のテストのまれな失敗(Phase 77)
- Google の公開鍵を毎回取りに行く(Phase 74)
- `ListCard` の入れ物(Phase 79。テンプレートでは直した)
- 英語のままの refresh の失敗の文(Phase 79)
- `tagmerge.py` の手直し(ステージ10 の振り返り。Phase 88 の手直しの一覧はその introduction)→ ステージ11 の振り返りで、ステージ12 の前に別のセッションで直すと決めた(overall-retrospective 16.1 の Q2)
- `streamChat.test.ts` の lint の警告(使っていない変数。既存)
- `appendix/measurements/stage11/measure.py` の `ruff check` の指摘(行の長さ1件。Phase 80 から)

**ユーザーが決めるもの**:
- **開発環境の後始末**: 確認用の利用者・プロジェクト(開発 DB の束 12・CR 8。多くは E2E が作った)、DB の事故の後の複製(振り返り 8節)。
- **この Phase の未コミット**: Phase 完了後の調整(外側のリポジトリ・devex-api・devex-ui)。コミットはユーザーが行う(#35)。タグは devex-api・devex-ui とも `phase-89`(調整のコミットに付ける)。
- ~~**ステージ11 の振り返り**~~ → 別のセッションで行った([`overall-retrospective.md`](../retrospectives/overall-retrospective.md) 16節)。

**セッションの区切りの記録**: Phase 89 は2セッション。1つ目で計画 → 89-1〜89-3 → 教材まで、2つ目で 89-4 の記録(ユーザーの画面確認と実 LLM での一巡の後)と Phase 完了後の調整を行った。2つ目は、ステージ11 の振り返りを始めようとして 89-4 が済んでいないと分かり、先に 89-4 を済ませたもの(振り返りは別のセッション。#18)。

**この Phase で解決したもの**:
- **80-4 の Phase 89 の未確定事項**(実 LLM で反映を通すか・E2E の範囲・本番の手順とロールバック): 着手時の相談と [89-2](./Phase-89-2.md)・[89-3](./Phase-89-3.md)。本番の手順は下書き(ステージ15 で仕上げる)。
- **CR の流れの E2E**(Phase 87 から): [89-2](./Phase-89-2.md)。束は画面で作り、CR は束の中身から作る。
- **予測・説明書の応答の大きさ**(Phase 87 から): [89-1](./Phase-89-1.md) で測り、今の形で足りると判断した。画面でも重さの指摘は無かった([89-4](./Phase-89-4.md))。
- **画面確認**(Phase 87・88 の分): [89-4](./Phase-89-4.md)。指摘は無かった。
- **反映・要約を実 LLM で通す**: [89-4](./Phase-89-4.md) の実 LLM での一巡。要約の照合の不一致 0件・読みやすさは問題なし。
- **写しの元の基準の束・CR を選ぶ欄の初期値・要約を直した人・束の段階の写しを読む画面・全角の数字の印・レビューを外す操作**: [89-4](./Phase-89-4.md) で、どれも今のままに決めた。
- **たどる記録に合意の相手が出ない**(この Phase で生まれた)・**反映の完了待ちの範囲**: 下の「Phase 完了後の調整」で直した。

## Phase 完了後の調整

89-4 の決める項目の2件(推奨どおり)と、実 LLM での一巡で見つかった版の巡回(推奨は「ステージ12 へ送る」だったが、ユーザーが「今直す」を選んだ)を直した(#38 の通常の工程)。仕様を変えるので、#40 の CR として [`q_a.md`](../q_a.md)「Phase 89 完了後の調整」に残し、docs に反映した。マイグレーションは無い。

| 指摘 | 対応 |
|---|---|
| たどる記録に合意の相手が出ない(89-2) | 「合意」「却下」の行のメモに、CR の合意の記録(相手・メモ・理由。あるものだけ)を「相手: … / メモ: … / 理由: …」の形で出す。画面は行のメモを出しているので変えない |
| 反映の生成中に一覧や別の画面へ移って戻ると、反映中の表示と完了の後の読み直しが消える | CR の詳細を開いたとき、プロジェクトを読み、生成中なら反映の完了を待ち直す(`resumeReflection`。使われていなかった `setReflecting` を置き換えた) |
| CR-2 の反映で作った文書の版が、CR を渡さない再生成2回で消えた(実 LLM での一巡) | CR を渡した再生成で作った版(`change_request_id` あり)は、巡回で消さず、直近3件の数にも入れない |

### 作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`backend/app/repositories/generated_document.py`](../samples/backend/app/repositories/generated_document.py) | 更新 | `create_version` の巡回が、CR で反映していない版だけを数えて消す |
| [`backend/app/change_requests/trace.py`](../samples/backend/app/change_requests/trace.py) | 更新 | `DecisionFacts`・`decision_note`。`trace_entries` に `decision` |
| [`backend/app/change_requests/__init__.py`](../samples/backend/app/change_requests/__init__.py) | 更新 | `DecisionFacts`・`decision_note` の re-export |
| [`backend/app/services/change_request_service.py`](../samples/backend/app/services/change_request_service.py) | 更新 | `trace` が CR の合意の記録を `DecisionFacts` で渡す |
| [`frontend/src/features/change-requests/change-requests-store.ts`](../samples/frontend/src/features/change-requests/change-requests-store.ts) | 更新 | `resumeReflection`(`setReflecting` を置き換え) |
| [`frontend/src/features/change-requests/components/ChangeRequestDetailContent.tsx`](../samples/frontend/src/features/change-requests/components/ChangeRequestDetailContent.tsx) | 更新 | 開いたときに `resumeReflection` |
| テスト(更新) | 更新 | `test_generated_document_repository.py`・`test_change_request_trace.py`、ストアのテスト・`ChangeRequestDetailContent.test.tsx`、テストの準備 `renderWithStore.tsx` |

samples のタグは `Phase-89(完了後の調整)`。

### 要点

- **数えるのは CR を渡していない版だけ**: 新しい版が CR の版なら、CR を渡していない版の数は増えないので消さない。CR を渡していない版なら、今までどおり直近3件にそろえる。表示中の版は常に最新なので、消える版が表示中になることは無い(今までと同じ)。
- **合意の記録は CR の列から読む**: 時系列の行には合意の記録を写していない(Phase 82)。たどる記録を組むときに CR の列から渡すので、前に合意した CR にも出る。却下も同じ列を使うので、却下の行にも出る。
- **完了待ちはプロジェクトの状態で決める**: 生成中なら、CR の反映かどうかを問わず待つ(生成中は反映を押しても 409 で、完了の後に詳細を読み直せばよいため)。

### テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `test_generated_document_repository.py`(追記) | `create_version` の巡回 | pytest のテスト関数 | SQLite のセッション。CR は `tests/fixtures/change_requests.py` の合意した CR-1 |
| `test_change_request_trace.py`(追記) | `trace_entries`・`decision_note`、`ChangeRequestService.trace` の合意の行 | pytest のテスト関数 | 純粋関数はスタブ不要 ── 対象が純粋で外部依存を呼ばないため。サービスは既存のとおり |
| ストアのテスト(追記) | `resumeReflection`(生成中なら待つ・生成中でなければ待たない) | vitest のテスト関数 | `fetch`(`stubFetch`) |
| `ChangeRequestDetailContent.test.tsx`(追記) | 開いたときに `resumeReflection` を呼ぶ | Testing Library | ストアの関数(`vi.fn`) |

### 検証

- devex-api: **1629 件成功**(3件増えた)。`ruff check`・`pyright`(変えたファイル)成功。
- devex-ui: **1175 件成功**(`--maxWorkers=4`。1件増えた。既存のテストに確かめを足した分は件数に出ない)。`tsc` 成功、`lint` は既存の警告1件だけ。
- `samples_check.py`: 一致 924・並び順のみ差 8・例外 5、「samples のみ」「本体のみ」0件。`link_check.py`: 0 件。
- 画面での確かめはしていない(E2E は変えていない。たどる記録の spec は内容のタブで相手を確かめる形のまま)。

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

設問は Phase の要点の要約(回答は求めない)。

1. ベースラインで「今の印は4件」だった画面と API は、ステージ11 でどう扱われるようになったか。予測の6件は、検証でどう2つに分かれるか。
2. 要約の照合が「10件」の取り違えを拾わなかったのはなぜか。それでも要約を出力に入れる前に人の確認を関門にしているのはなぜか。
3. CR の流れの E2E で、段階を作らず文書だけで一巡させたのはなぜか。偽の LLM の再生成で印が付かないのに、検証の条件を確かめられるのはなぜか。
4. ロールバックの第一の手を「コードだけ戻す」にしているのはなぜか。downgrade で何が失われるか。
5. 本番への反映をステージ15 まで待つと、何が増え、何を毎ステージ続ける必要があるか。

## 次のフェーズ

**ステージ11 の振り返り**は済んだ([`overall-retrospective.md`](../retrospectives/overall-retrospective.md) 16節・decision digest)。本番での確認の指摘(#39)はステージ15 の反映の後に埋める。次は、**`tagmerge.py` の修正**(別のセッション。16.1 の Q2)→ **ステージ12(合意の精度)** の要件確認フェーズ。入力は 16.3 の「ステージ12 の入力」・この Phase の申し送り・[位置付け](../../appendix/devex_project_positioning.md) 12章。
