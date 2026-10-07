# Phase 29 導入: シーケンス図(ステージ5)

## 目的

ステージ5(実装手順書 + 実装可能性チェック)の4つ目の実装 Phase。[25-5](../Phase-25/Phase-25-5.md) で「シーケンス図は段階5の手順から決定的に導く読み取り専用のビューにする(LLM で生成しない・画面で編集しない)」と決め、デモで確かめた。この Phase で本実装にする。

- **段階5の行の種別**: 手順の行に同期の呼び出し・非同期の呼び出し・戻りの区別を足す。AI の下書きに書かせ、人が表で直せる。
- **導出と指摘**: 手順から参加者・矢印・分岐の注記を導き、図にするときに分かる手順の不備(戻りを呼び出しとして書いた行・入れ子を推測できない並び・存在しない分岐先・段階4の依存先に無い呼び出し)を段階5の検証の警告にする。
- **表示**: 詳細設計書の 05章(HTML は SVG、md は Mermaid)、段階5の画面の処理のタブ、段階8の単位の詳細(参照の展開)に図を載せる。
- **スタブの候補**: 手順書のテスト観点のスタブが、図で SUT から呼ばれないモジュールを挙げていれば、段階8の検証の軽微な指摘にする。

## パイプライン上の位置づけ・前提

- 前提として読むもの: [Phase 25-5](../Phase-25/Phase-25-5.md)(シーケンス図の判断と、見本での課題の扱い)、[Phase 25-4](../Phase-25/Phase-25-4.md)(Phase 29 の範囲と未確定事項)、[Phase 28-1](../Phase-28/Phase-28-1.md)(参照の展開をバックエンドだけに置いた理由)、デモの `sequenceModel.ts`・`SequenceSection.tsx`(`devex-ui/src/features/implementation-procedure/demo/`)。
- 段階5の model と検証の正本は `devex-api` の `app/detailed_design/procedure.py`・`validation.py`([Phase 20](../Phase-20/Phase-20-introduction.md))。

```
[種別]   ProcedureStep.kind(call / async / return。既定 call)・calls_function                     (29-1)
[導出]   sequence.to_sequence(procedure, dependencies) → SequenceDiagram(参加者・矢印・注記・指摘)   (29-2)
           → validate_procedures の警告(RETURN_AS_CALL・NESTING_UNKNOWN・MISSING_BRANCH_TARGET・…)
[図]     sequence_svg.to_sequence_svg / sequence.to_mermaid                                          (29-3)
           → 05章: HTML に SVG、md に ```mermaid
[画面]   GET /design-stages/procedures/{function_id}/sequence → ProcedureSequenceView(表の下)       (29-4)
[手順書] expand_ref(手順)に Mermaid、ExpandedRef.svg → UnitProcedureEditor                         (29-5)
           validate_procedure_doc: STUB_OUTSIDE_SEQUENCE(軽微・段階5)
```

## モード宣言(#21)

自動実装モード: **on**(AI が本体へ実装し、`textbook/samples/` も同じ内容で作る)。E2E は流さない(#36。Phase 32 で全 E2E を流す)。

## 着手時の相談で決めたこと

[Phase 25-4](../Phase-25/Phase-25-4.md)「未確定事項」の Phase 29 の分と、モード・導出の置き場を、着手時に決めた(4つとも推奨どおり。[`q_a.md`](../q_a.md)「Phase 29 開始時」)。

1. **自動実装モード**: on。
2. **種別の欄**: 段階5の下書きのプロンプトに書かせ、人が表で直せる。既存のデータは同期として読む(29-1)。
3. **05章の画面の図の置き場**: 処理のタブの中、手順の表の下。保存した内容から描く(29-4)。
4. **導出の置き場**: バックエンドだけ(28-1 と同じ方針、#17)。デモの `sequenceModel.ts` は本体の画面へ移さない(29-2)。

Claude の判断(計画の承認で確定):

- md(詳細設計書の 05章・単位の参照の展開)は Mermaid のコードブロック、HTML と画面は バックエンドで作った SVG。zip に図のファイルは足さない(29-3)。
- 単位の参照の展開(手順)に Mermaid を入れ、生成の入力・画面・Phase 30 の AI 向けの出力が同じ図を持つようにする(29-5)。
- スタブの候補の突き合わせは段階8の検証の**軽微な警告**(直す先は段階5)にし、デモにあった単位の図の色の強調は作らない(29-5)。
- 図にするときの指摘は段階5の検証の**警告**(承認を止めない)(29-2)。
- 戻りの行は関数の紐づけの対象外にし、判定を `calls_function` の1か所にまとめる(29-1)。

実装で計画から変えたこと:

- `procedure_sequence`(05 に載せる図のモデル)は、計画の `markdown.py` でなく `document/views.py` に置いた。md と HTML の両方が使うため(29-3)。段階4の依存先の dict は `sequence.module_dependencies` にまとめ、検証・05章・API が使う(29-2)。
- 自己呼び出し(呼び出し元 = 呼び出し先)はスタックに積まない。積むと、その後の戻りがずれて描かれた(実際の図を描いて確かめた。29-2)。
- 「戻りを呼び出しとして書いている」の判定を同期の呼び出しに限った。非同期の通知は呼び出し中の参加者へ向けてもよい(29-2)。
- E2E 用の偽 LLM の段階5の手順は、最後の「利用者へ返す」行を `kind="return"` にした。この Phase の検証で警告が出るため(29-2)。
- 段階5の画面の図の取り直しは、取得した鍵(処理ID と版)を結果に持たせる形にした。効果の中で同期的に「読み込み中」へ戻すと lint に当たるため(29-4)。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-29-1.md`](./Phase-29-1.md) | 段階5の行の種別(model・プロンプト・05 の表・画面の列・`calls_function`) | あり(BE・FE) | なし |
| [`Phase-29-2.md`](./Phase-29-2.md) | シーケンスの導出と段階5の検証 | あり(BE) | 29-1(`kind`) |
| [`Phase-29-3.md`](./Phase-29-3.md) | SVG と、詳細設計書の 05章 | あり(BE) | 29-2 |
| [`Phase-29-4.md`](./Phase-29-4.md) | 段階5の画面の図(API と `ProcedureSequenceView`) | あり(BE・FE) | 29-3(`to_sequence_svg`) |
| [`Phase-29-5.md`](./Phase-29-5.md) | 手順書の単位への表示とスタブの候補 | あり(BE・FE) | 29-3(`sequence_block`)・29-4(`SequenceSvg`) |
| [`Phase-29-6.md`](./Phase-29-6.md) | `docs/*.md` への反映 | `docs/` 配下(文書のため #13/#15/#30 の対象外) | 29-1〜29-5 |

## サンプルコード一覧

`textbook/samples/backend/` 配下:

- `app/detailed_design/procedure.py`・`procedure_drafting.py`・`logic.py`・`procedure_doc.py`・`sequence.py`(新規)・`sequence_svg.py`(新規)・`procedure_doc_refs.py`・`validation.py`・`__init__.py`
- `app/detailed_design/document/views.py`・`markdown.py`・`html.py`
- `app/schemas/design_stage.py`・`app/services/errors.py`・`app/services/design_stage_service.py`・`app/api/routes/design_stages.py`・`app/ai/llm/fake.py`
- テスト: `tests/unit/test_sequence.py`(新規)・`test_sequence_svg.py`(新規)・`test_design_stage_sequence.py`(新規)・`test_procedure.py`・`test_procedure_drafting.py`・`test_logic.py`・`test_detailed_design_document_views.py`・`test_detailed_design_document_markdown.py`・`test_detailed_design_document_html.py`・`test_procedure_doc_refs.py`・`test_procedure_doc_validation.py`

`textbook/samples/frontend/src/features/detailed-design/` 配下:

- `api/types.ts`・`api/designStagesApi.ts`・`labels.ts`・`procedureOps.ts`・`logicOps.ts`
- `components/ProcedureStepTable.tsx`・`ProcedureSequenceView.tsx`(新規)・`ProcedurePanel.tsx`・`UnitProcedureEditor.tsx`
- テスト: `test-utils/stageFixtures.ts`、`__tests__/procedureOps.test.ts`・`logicOps.test.ts`、`api/__tests__/designStagesApi.test.ts`、`components/__tests__/ProcedureStepTable.test.tsx`・`ProcedureSequenceView.test.tsx`(新規)・`ProcedurePanel.test.tsx`・`UnitProcedureEditor.test.tsx`

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| [29-1](./Phase-29-1.md) | `procedure.py`・`procedure_drafting.py`・`views.py`・`markdown.py`・`html.py`・`procedureOps.ts`・`ProcedureStepTable.tsx` | 行の種別を足し、戻りの行を関数の紐づけから外す | 既存の行は同期、`calls_function`、merge の種別、`EMPTY_CALL`、05 の種別の列、段階6の候補・関与表(純粋)。表の select で `onChange`(`onChange` をスタブ) |
| [29-2](./Phase-29-2.md) | `sequence.py`・`validation.py`・`fake.py` | 手順から図のモデルと指摘を導き、段階5の警告にする | 入れ子と推測した戻り・指摘5種・非同期・自己呼び出し・Mermaid・スタブの候補(純粋) |
| [29-3](./Phase-29-3.md) | `sequence_svg.py`・`views.py`・`markdown.py`・`html.py` | 図を SVG にし、05章に載せる | 決定的・エスケープ・矢印の種類・列の幅(純粋)、05 の Mermaid と SVG |
| [29-4](./Phase-29-4.md) | `design_stage_service.py`・`design_stages.py`・`ProcedureSequenceView.tsx`・`ProcedurePanel.tsx` | 保存した手順の図を API で返し、表の下に出す | API の成功・404・409(インメモリ DB)、埋め込み・指摘・取り直し・失敗(API をスタブ) |
| [29-5](./Phase-29-5.md) | `procedure_doc_refs.py`・`validation.py`・`UnitProcedureEditor.tsx` | 単位の参照に図を添え、スタブの候補の外を指摘する | 展開の末尾の Mermaid・SVG は手順だけ・`STUB_OUTSIDE_SEQUENCE`(純粋)、展開で図が出る(API をスタブ) |
| [29-6](./Phase-29-6.md) | `docs/*.md` | 決定と実装の反映 | なし(文書の目視レビュー) |

## 写経順序(#23)

章番号順。各章の「この章で作成・更新したファイル」の表の順に写す。

注意: `views.py`・`markdown.py`・`html.py` とそのテストは 29-1 と 29-3 の両方で、`validation.py` は 29-1・29-2・29-5 で、`schemas/design_stage.py`・`types.ts` は 29-4 と 29-5(`types.ts` は 29-1 も)で、`__init__.py` は 29-1 と 29-2 で触る(samples ではタグで区別している)。

実 import 監査(#15): 各章のファイルの import 先は、以前の Phase か、その章までにある。29-1 の `views.py` は `procedure.calls_function`(29-1)だけを足し、`sequence` を読むのは 29-3 から。`validation.py` は 29-2 で `sequence.module_dependencies`・`to_sequence` を、29-5 で `reachable_callees`・`stubs_outside_sequence`・`sut_participant`(29-2 で作成)と `procedure_doc.UnitProcedure`(Phase 27)を読む。29-3 の `html.py`・`markdown.py`・`views.py` は 29-2 の `sequence` と 29-3 の `sequence_svg` を読む。29-4 のサービスは 29-2・29-3 を、`ProcedurePanel.tsx` は 29-4 の `ProcedureSequenceView` を読む。29-5 の `procedure_doc_refs.py` は 29-3 の `sequence_block`・`to_sequence_svg` を、`UnitProcedureEditor.tsx` は 29-4 の `SequenceSvg` を読む。章が作成・更新するファイルは、その章のテストが少なくとも1度 import する(`errors.py` の `DesignProcedureNotFoundError` は `test_design_stage_sequence.py` が、`labels.ts` の `STEP_KIND_LABELS` は描画する `ProcedureStepTable` 越しに、`fake.py` は `test_procedure_drafting.py` が読む)。

## 検証結果

- devex-api: 章ごとの関係するテスト(`test_sequence.py` 12件・`test_sequence_svg.py` 5件・`test_design_stage_sequence.py` 4件ほか)。ユニットテスト全体 743 件成功(Phase 28 の 705 件 + 38 件)。`ruff check`・`pyright` 成功。マイグレーションは無い(`kind` は JSON の model の既定値)。
- devex-ui: 詳細設計の feature 全体 260 件成功(`--maxWorkers=4`)。`tsc --noEmit`・eslint 成功。
- `samples_check.py`(`--api-since HEAD --ui-since HEAD`): 不一致 0 件・作り忘れ 0 件(一致 439 / 並び順のみ差 8 / 例外 5)。`link_check.py`: 切れ 0 件。
- 図の見た目は、手作りの手順(F-07 相当)の SVG をブラウザで描いて確かめた(自己呼び出しの戻りのずれをここで見つけて直した)。

### Phase 完了時の確認

- devex-api: ユニットテスト全体 743 件成功、`ruff check`・`pyright` 成功。
- devex-ui: 全体 610 件成功(`--maxWorkers=4`、1回目で全件成功)、`npm run build` 成功。eslint は警告1件(既存の `src/features/hearing/api/__tests__/streamChat.test.ts`。この Phase では触っていない)。

## 未消化の申し送り(#37)

Phase 28 から引き継いだもの:

- **持ち越し(Phase 22 から)**:
  - 段階6が開いていないときの、05 の詳細バッジ
  - ER の主キーの NULL の表示
- **E2E を CI で流すか**: 未定([`retrospective-memo.md`](../retrospective-memo.md) に候補として記録済み)。
- **Phase 30〜31 の未確定事項**: [25-4](../Phase-25/Phase-25-4.md)「未確定事項」(HTML 1枚の構成・AI 向けの版の置き場・簡易モードの入口)。
- **コミュニケーション図**: 後回し([25-5](../Phase-25/Phase-25-5.md))。
- **本番の段階7・段階8の移行**: 本番に反映するときは、マイグレーション `b8c9d0e1f2a3`(段階7をレビュー中に戻す)・`c9d0e1f2a3b4`(段階8の CHECK)を同じ順で流す。本番反映の手順は Phase 32 でまとめる。
- **「段階Nで直す」の移動先での強調**: 段階5は手順・処理を開くが、段階3・4・7は段階を開くだけ。必要なら各パネルに `focus` を読ませる。
- **Phase 27・28 の画面確認**: `UNRESOLVED_CALL` の文言とボタン、実 LLM での段階8の生成(手順書の中身・指摘の重要度と直す先)、単位の詳細の展開・編集、承認前の確認を、ユーザーが確かめる(この Phase の画面確認と合わせて行える)。
- **「AI に提案を求める」**: ステージ8(AI 設計レビュー・再ヒアリング)との境界として申し送る。
- **偽 LLM の段階8**: `app/ai/llm/fake.py` に `ProcedureDocGenerationOutput` を登録し、段階1〜8の契約テストを Phase 32 で作る。
- **セッションの区切りの記録**(#18 の見直しの材料): Phase 25〜29 はそれぞれ1セッション(着手時の相談 → 計画 → 実装と samples → docs → 教材)。全体テストは Phase 完了時だけ。

この Phase で解決したもの:

- **シーケンス図の本実装**(Phase 25 で発生): [29-1](./Phase-29-1.md)〜[29-5](./Phase-29-5.md)。
- **Phase 29 の未確定事項**([25-4](../Phase-25/Phase-25-4.md)): 種別の欄は AI の下書き + 人が直す、05章の図は処理のタブの表の下(着手時に決定)。

この Phase で生まれたもの:

- **画面確認**: 実 LLM で段階5を下書きし直し、種別の付き方(戻り・非同期が正しく付くか)、段階5のタブの図と指摘、詳細設計書の zip の 05章(HTML の図・md の Mermaid)、段階8の単位の詳細の図と `STUB_OUTSIDE_SEQUENCE` の出方を、ユーザーが確かめる。既存のプロジェクトの段階5(種別の無い行)にも、図にするときの警告が新しく出ることがある(承認の状態は変わらない)。
- **段階8の生成の入力が増えた**: 手順の展開に Mermaid が入ったので、段階8の下書きのプロンプトが長くなった。入力の大きさが問題になれば、Phase 30 以降で測る。

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

1. 図の導出を画面に持たず、バックエンドだけに置いたのはなぜか。図を使う5か所(段階5の検証・05章の md と HTML・段階5の画面・手順書の参照の展開・段階8の検証)と、その代わりに受け入れたこと(画面の図は保存まで表とずれる)から説明できるか。
2. 種別の無い既存の行を「同期の呼び出し」として読むことにしたのはなぜか。マイグレーションをしないで済む理由と、承認済みの段階5に起きること・起きないことを説明できるか。
3. 戻りの行を、06 の紐づけ・段階6の候補・段階8の参照・関与表から外したのはなぜか。判定を `calls_function` の1か所にまとめた理由を #17 と結びつけて説明できるか。
4. 「戻りを呼び出しとして書いている」の判定を同期の呼び出しに限り、自己呼び出しをスタックに積まないのはなぜか。それぞれ、そうしないと図がどう崩れるか。
5. スタブの候補の突き合わせを、図の色付けでなく段階8の軽微な指摘にし、直す先を段階5にしたのはなぜか。重要度を軽微にした理由も説明できるか。

## 次のフェーズ

**Phase 30**: 手順書の出力(zip の `implementation_procedure/`(`index.md`・単位ごとの md・AI 向けの版・HTML 1枚)、画面の「AI 向けにコピー」、未承認・古いときの書き方)。着手時に自動実装モード(#21)と [25-4](../Phase-25/Phase-25-4.md) の Phase 30 の未確定事項(HTML 1枚の構成・AI 向けの版の置き場)を決める。
