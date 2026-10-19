# Phase 48 導入: 段階3・5 の書き落とし

## 目的

ステージ7(変更影響分析・変更管理)の7つ目の実装 Phase。変更管理とは主題が違うが、ステージ6のベースライン([Phase 33](../Phase-33/Phase-33-introduction.md))で見つけた生成の質の課題をこのステージで扱うと決めた([41-2](../Phase-41/Phase-41-2.md))。

- **段階3**: CRUD 図の検証のエラー `DFD_WRITE_MISSING`(DFD に書き込みの線があるのに、CRUD 図に C/U/D が無い)が4件出て、人が直した。
- **段階5**: 手順の分岐の欄の「1a へ」の行が見つからない指摘 `MISSING_BRANCH_TARGET` が15件(効果測定1回目でも4件)出た。

着手時に測定の記録を調べると、どちらも「書き落とし」ではなかった。段階3の4件はすべて「取得」の処理で、AI の CRUD 図は正しく、誤りは DFD の書き込みの線だった(と考えられる)。段階5は分岐の行は在り、AI が参照の番号を振り違えていた。この Phase では、段階3は DFD の下書きで防ぎ、残りをシステムが補って印を付ける(48-1)。段階5は分岐を手順の入れ子で書かせ、参照はシステムが振る(48-2)。確定した仕様は [`docs/external_design.md`](../../docs/external_design.md) 2.10節「段階3・5 の書き落とし(Phase 48 で確定)」と、[`docs/internal_design.md`](../../docs/internal_design.md) 3.3節「Phase 48 で実装した部分」に足した。

## パイプライン上の位置づけ・前提

```
[段階2] DFD の下書き ──(48-1 読むだけの処理に書き込みの線を描かない)
   │ 線の向き = R / W
   ▼
[段階3] CRUD 図 = DFD の R/W + AI の C/U/D ──(48-1 C/U/D が無ければ名前から補い、印と警告)
   │
   ▼
[段階5] 手順の表 ──(48-2 AI は分岐を手順の中に書く → 平らな行 → 参照を並びから振る)
   │
   ▼
[Phase 49]  効果測定: 実 LLM で、段階3・5 の検証の件数を数える
```

- **前提として読むもの**:
  - [Phase 18](../Phase-18/Phase-18-introduction.md)(CRUD 図と DFD の線の向き)・[Phase 20](../Phase-20/Phase-20-introduction.md)(手順の表と分岐の行)・[Phase 29](../Phase-29/Phase-29-introduction.md)(シーケンス図と `MISSING_BRANCH_TARGET`)。
  - [Phase 33](../Phase-33/Phase-33-introduction.md)(ベースラインで見つけた課題)・[`appendix/measurements/stage6-baseline.md`](../../appendix/measurements/stage6-baseline.md)(人の操作の規則。段階3は U を足して直した)。
  - [41-5](../Phase-41/Phase-41-5.md)(Phase 48 のスコープと未確定事項)。
- **この Phase を始めた時点の状態**: Phase 47 は3つのリポジトリともコミット済み(Claude が Phase ごとに分けてコミットした。タグは付けていない)。Phase 47 の完了後の調整は無かった。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(AI が devex-api・devex-ui に実装し、`textbook/samples/` も同じ内容で作った)。

E2E: この Phase では流さない。偽 LLM の手順の出力は入れ子の形になったが、平らにした結果は今までと同じで(分岐の欄の「—」が空になっただけ)、偽 LLM の CRUD 図は補いの対象にならない(偽 LLM の契約テスト `test_fake_llm_e2e.py` と段階3・5 の生成のテストで確かめた)。ステージ7の E2E は Phase 50 で既存を含めて全部流す。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 48 開始時」を参照。

1. **Phase 47 の完了後の調整・自動実装モード**: 調整なし・on(推奨どおり)。
2. **段階3の防ぎ方(41-5 の未確定事項)**: DFD のプロンプトで防ぎ、それでも残ったセルはシステムが補う(推奨と違う。推奨は DFD のプロンプトだけ。補うと DFD の誤りが CRUD 図に入るため)。
3. **補う文字**: 処理の名前から推定する(推奨どおり)。「削除」→ D、「登録」「作成」など → C、それ以外 → U。
4. **段階5の防ぎ方(41-5 の未確定事項)**: 生成の構造を変える(分岐を手順の入れ子にする)+ 参照の付け直し(推奨どおり)。ユーザーは最初、「下書きで補う案と構造を変える案の、メリット・デメリットを比べて再提案してほしい」と求めた。比べた結果、構造を変える案も付け直しを含み、そのうえで分岐の行の置き場所のずれも防げると分かり、こちらを選んだ。

Claude の判断(計画の承認で確定、または実装中):

- **補ったセルに警告 `DFD_WRITE_INFERRED` を出し、読むだけの処理なら DFD の線を直すよう案内する**(2 の心配を和らげるため。[48-1](./Phase-48-1.md))。
- **推定の印は真のときだけ保存する**(実装中。印の無いセルの保存の形と既存のテストの期待を変えないため。[48-1](./Phase-48-1.md))。
- **devex-ui は印を保持するだけ**(画面は model 全体を保存するので、落とすと他のセルの印が消える。表示は変えない)。
- **参照の付け直しは AI の下書きの取り込みだけで行う**(人の編集では行わず、警告のまま。[48-2](./Phase-48-2.md))。
- **C の手がかりに「新規」「アップロード」も足した**(実装中。測定の機能一覧の名前を見て)。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-48-1.md`](./Phase-48-1.md) | 段階3: DFD の書き込みの線と CRUD 図 | あり(API・UI) | なし(Phase 18) |
| [`Phase-48-2.md`](./Phase-48-2.md) | 段階5: 分岐を手順の入れ子にして、参照を並びから振る | あり(API) | なし(Phase 20・29) |

## サンプルコード一覧

`textbook/samples/backend/` 配下:

- 48-1: `app/detailed_design/{data_flow_drafting,data_model,validation,__init__}.py`・`app/detailed_design/impact/elements.py`
- 48-2: `app/detailed_design/{procedure,procedure_drafting,__init__}.py`・`app/ai/llm/fake.py`
- テスト: `tests/unit/test_data_flow_drafting.py`・`test_data_model.py`・`test_impact_diff.py`(48-1)、`test_procedure.py`・`test_procedure_drafting.py`・`test_design_stage_generation.py`(48-2)

`textbook/samples/frontend/` 配下(48-1): `src/features/detailed-design/{api/types.ts,crudOps.ts,__tests__/crudOps.test.ts}`。

マイグレーションは無い(`inferred` は JSON の model の中、手順は保存の形を変えない)。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| [48-1](./Phase-48-1.md) | `data_flow_drafting.py`・`data_model.py`・`validation.py`・`impact/elements.py`・`crudOps.ts` | DFD の下書きで書き込みの線を絞り、残ったセルを名前から補って印と警告を出す | 純粋関数(スタブ不要)。補う条件・推定の文字・印の外れ方・警告と案内・保存の形・差分に入れない・画面の保存で印が残る |
| [48-2](./Phase-48-2.md) | `procedure_drafting.py`・`procedure.py`・`fake.py` | 分岐を入れ子で書かせ、平らにしてから参照を並びから振る | 純粋関数(スタブ不要)。平らにする順・参照の付け直し・他の文字を残す・空の行の後の番号・シーケンス図の指摘が出ない。既存の stage5.json で LLM なしに数える |

## 写経順序(#23)

章番号順。各章の中は「この章で作成・更新したファイル」の表の順(#30。依存されるファイルが上、テストは末尾)。`app/detailed_design/__init__.py` は両方の章が1行ずつ足す。

実 import 監査(#15。全 import 文を読んで確かめた):

- 48-1: `data_model.py`・`validation.py`・`data_flow_drafting.py`・`impact/elements.py` は import を足していない(`Field` は既存)。`__init__.py` は同じ章の `data_model.infer_write_ops` を足した。`test_data_model.py` は同じ章の `infer_write_ops` を足した。devex-ui は import を足していない。
- 48-2: `procedure.py` は標準の `re` を足した。`procedure_drafting.py` は import を足していない(`StepKind` は既存)。`fake.py` は同じ章の `GeneratedBranch` を足した。`__init__.py` は同じ章の `procedure.link_branch_refs` を足した。`test_procedure.py` は同じ章の `link_branch_refs`、`test_procedure_drafting.py` は同じ章の `GeneratedBranch` と既存の `sequence.to_sequence`(Phase 29)を足した。
- 前方 import は無い。章が更新する本体のファイルは、その章のテストが少なくとも1度 import する(48-1: `data_flow_drafting.py` ← `test_data_flow_drafting.py`、`data_model.py`・`validation.py`・`__init__.py` ← `test_data_model.py`、`impact/elements.py` ← `test_impact_diff.py`(`app.detailed_design.impact` 経由)、`types.ts`・`crudOps.ts` ← `crudOps.test.ts` / 48-2: `procedure.py` ← `test_procedure.py`、`procedure_drafting.py`・`fake.py` ← `test_procedure_drafting.py`)。

## 検証結果

- devex-api: 部分テスト(各章の「テスト観点」のコマンド)成功、`ruff check`・`uvx pyright`(触ったファイル)0件。Phase 完了時の全体テスト(#18): 1046 件成功(Phase 47 の 1039 件 + 新規7件)。
- devex-ui: `crudOps.test.ts` 成功、`eslint`・`tsc --noEmit` 0件。Phase 完了時の全体テスト(`--maxWorkers=4`): 775 件成功(既存のテストに確認を足したので件数は Phase 46 と同じ)。
- 既存のデータでの確認: ステージ6の測定の stage5.json で `MISSING_BRANCH_TARGET` が 15 → 0・4 → 0([48-2](./Phase-48-2.md))。
- `samples_check.py`(`--api-since HEAD --ui-since HEAD`): 不一致 0 件・作り忘れ 0 件(一致 561 / 並び順のみ差 8 / 例外 5)。`link_check.py`: 切れ 0 件。
- 実画面: 確かめていない(#37 の運用注記。「未消化の申し送り」に手順を書いた)。

## 未消化の申し送り(#37)

Phase 47 から引き継いだもの(未解決のまま):

- **持ち越し(Phase 22 から)**: 段階6が開いていないときの、05 の詳細バッジ / ER の主キーの NULL の表示。
- **E2E を CI で流すか**: 未定([`retrospective-memo.md`](../retrospective-memo.md) に候補として記録済み)。#36 のまま。
- **コミュニケーション図**: 後回し([25-5](../Phase-25/Phase-25-5.md))。
- **「AI に提案を求める」**: ステージ8との境界として申し送る。
- **段階8の生成の入力の大きさ・判定の LLM の入力の大きさ**: 問題になれば測る(観点が4つ増え、判定の表も4行増えた)。
- **生成済みの簡易モードのプロジェクト**: Phase 31 より前に生成した文書では段階8の単位が空。再生成で使える。
- **既存のプロジェクトの会話の順**(Phase 35 から): 直さない。
- **`test_chat_service.py` の pyright の指摘4件**(Phase 40 から): 触るときに `isinstance` で絞る。
- **Phase 49〜50 の未確定事項**: [41-5](../Phase-41/Phase-41-5.md)「未確定事項」。
- **共有のモジュールの中で「どれを直すか」**: 示さない。効果測定では見落としとして数え続ける。
- **devex-ui の「開発用」メニュー**: ステージ7の完了時に、ユーザーが前と同じく外すかを決める。
- **共有の画面を通って別の処理に届く**(Phase 42 から): 止めるかは Phase 49 の数字で決める。簡易モードでも同じ規則。
- **テーブルの変更は、そのテーブルを読み書きする全処理に届く**(Phase 42 から): Phase 49 で数える。
- **文書の要素(要件・画面・API)からの影響は、まだ生成物で確かめていない**(Phase 42 から): Phase 49 で、測定用に文書の model を用意して測る。
- **改名の後に下流の参照を直して承認すると、内容の変更として広がる**(Phase 43 から): 過剰かどうかは Phase 49 で数える。
- **ER 以外の段階の外の図の変更は差分に入らない**(Phase 43 から): DFD の線が効いているかを Phase 49 で見る。
- **「段階Nで直す」の推定は名前の照合**(Phase 44 から): 当たる割合は Phase 49 の効果測定で見るか、画面確認で外れが目立てば直す。
- **影響の取得は段階の一覧のたびに1回**(Phase 44 から): 重く感じたら、生成のポーリング中は取らないなどで減らす。
- **並列のテストのタイムアウト**(Phase 44 から): devex-ui の全体テストは `--maxWorkers=4` で流すと安定する。
- **以前の版の段階8の手順書**(Phase 45 から): キーが単位の ID のまま。キーで引けない手順書は要素にならず、印も付かない。
- **偽 LLM の外部設計書の GET に DF が無い**(Phase 45 から): プレビューに中程度の指摘が1件出る(E2E の検証対象ではない)。
- **画面確認(ユーザー。Phase 49・50 でまとめてよい)**(Phase 46 から): 簡易モードのプロジェクトで、文書を生成 → 段階8を生成・承認 → 要件を変えるヒアリングの後に文書を再生成(または前の版に戻す)→ 実装手順書の画面の上に「変更の影響」パネルが出て、出どころと単位の一覧の行の印が出ること。確認済みにすると段階8を承認し直せること。
- **再生成の言い回しの揺れも「内容の変更」になる**(Phase 46 から): Phase 49 の効果測定(S8・N4)で、実際の再生成の過剰を数える。
- **model の無い版との切り替え**(Phase 46 から): Phase 45 より前に生成した版から再生成した最初の1回は印が付かない。
- **効果測定(Phase 49)でヒアリングを流す**(Phase 47 から): 同じ版で詳細・簡易を3回ずつ。発言の上限は24回。[`tally.py`](../../appendix/measurements/stage7-hearing.md) で、L2・L5・L6・L14 が聞けた回数と、自由回答の採用・発言の数の幅を数える。判定を直すかは、その幅を見て決める。
- **発言の数が増える**(Phase 47 から): 観点が4つ増えた(公開サービスの必須は15 → 19)。ヒアリングが長すぎると感じるかを、Phase 49 の数字と画面確認で見る。
- **画面確認(ユーザー。Phase 49・50 でまとめてよい)**(Phase 47 から): 新しいプロジェクトでヒアリングし、観点の表に4つの観点が大項目の観点のすぐ後ろに並ぶこと。可用性の次にデータの保全が、セキュリティの次にログ・不正利用が聞かれること。個人・小規模ではログ・不正利用が任意になること。
- **すでにヒアリングしたプロジェクト**(Phase 47 から): 新しい観点は未決として表に出る。保存済みの完了判定は次の発言まで変わらない。必須なら、チャットで答えると埋まる。

この Phase で生まれたもの:

- **効果測定(Phase 49)で段階3・5 を数える**: 実 LLM で段階2〜5 を生成し、(a) DFD の読むだけの処理の書き込みの線と、補ったセル(`DFD_WRITE_INFERRED`)の件数と、補った文字が正しいか (b) `MISSING_BRANCH_TARGET` の件数 (c) 処理あたりの分岐の行の数(入れ子にして減っていないか。ベースラインは14処理で23行)(d) 分岐の行の置き場所が正しいか。
- **画面確認(ユーザー。Phase 49・50 でまとめてよい)**: 詳細設計モードのプロジェクトで段階2〜3 を生成し、CRUD 図に補ったセルがあれば、検証の一覧に「DFD の書き込みの線から…と推定しました」が出ること。そのセルを書き換えると警告が消え、他のセルの下書きの印は残ること。段階5を生成し、分岐の行の直前の手順の分岐の欄が「1a へ」になっていること。
- **既存のプロジェクト**: DFD・CRUD 図・手順は直さない。再生成すると新しい規則で作られる。以前に保存した手順の分岐の参照のずれは、今までどおりシーケンス図の警告で出る。
- **セッションの区切りの記録**: Phase 48 は1セッションで行った(計画モードで質問2回(段階5は比較表を示して聞き直した)→ 48-1 → 48-2 → 既存データでの確認 → 全体テスト → samples → 教材)。

この Phase で解決したもの:

- **段階3の CRUD の下書きと DFD の書き込みの線の食い違い・段階5の分岐の行の書き落とし**(Phase 33 から): DFD の下書きの規則と補い([48-1](./Phase-48-1.md))、分岐の入れ子と参照の付け直し([48-2](./Phase-48-2.md))。実 LLM での件数は Phase 49 で測る。
- **41-5 の Phase 48 の未確定事項**: 両方で防ぐ / 構造を変える + 付け直し(この Phase の「着手時の相談で決めたこと」2・4)。

## 完了後の調整

(まだ無い)

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

設問は Phase の要点の要約(回答は求めない)。

1. ベースラインの `DFD_WRITE_MISSING` 4件で、誤っていたのは CRUD 図と DFD のどちらか。それを見ずに CRUD 図を DFD から導くと、何が起きるか。
2. 補ったセルに `draft` に加えて `inferred` の印を付け、警告で DFD を直す道を案内するのはなぜか。
3. `inferred` を真のときだけ保存し、devex-ui の `toCrud` で残すのはなぜか(画面の保存の仕方との関係)。
4. 段階5の `MISSING_BRANCH_TARGET` の原因は何だったか。手順番号と同じく、参照もシステムが振るべき理由は何か。
5. 入れ子の分岐にしても、参照の付け直し(`link_branch_refs`)が要るのはなぜか。付け直しを人の編集に当てないのはなぜか。

## 次のフェーズ

**Phase 49**: 効果測定。[ベースライン](../../appendix/measurements/stage7-baseline.md) と同じシナリオ(S1〜S8・N1〜N4)を実装した仕組みで測り、Phase 47 のヒアリング(各モード3回)と Phase 48 の段階3・5 の検証の件数を数える。着手時に自動実装モード(#21)と [41-5](../Phase-41/Phase-41-5.md) の Phase 49 の未確定事項を決める。
