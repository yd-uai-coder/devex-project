# Phase-25-5: シーケンス図の判断 ── 段階5の手順から導く読み取り専用のビュー

## この章の目的

見本([25-2](./Phase-25-2.md))の確認中に、ユーザーから提案があった:「シーケンス図またはコミュニケーション図を作り、実装手順書と相関を持たせれば、実装が確実で手軽になる。システム的な課題と実現性を検討してほしい」。[Phase 14](../Phase-14/Phase-14-1.md) では「シーケンス図は当面作らず、05 の番号付き手順で扱う。作るかはステージ4の運用の後に判断する」としていた。ステージ4を終えた今、その判断をこの章で行う。あわせて、見本(md とデモ)に図を足して確かめる。

自動実装モード: on([introduction](./Phase-25-introduction.md) 参照)。

## この章で作成・更新するファイル

| ファイル | 種類 |
|---|---|
| [`features/implementation-procedure/demo/procedureDocModel.ts`](../samples/frontend/src/features/implementation-procedure/demo/procedureDocModel.ts) | 更新(手順の行の種別 `kind`、md へのシーケンス図) |
| [`features/implementation-procedure/demo/sequenceModel.ts`](../samples/frontend/src/features/implementation-procedure/demo/sequenceModel.ts) | 新規 |
| [`features/implementation-procedure/demo/SequenceSection.tsx`](../samples/frontend/src/features/implementation-procedure/demo/SequenceSection.tsx) | 新規 |
| [`features/implementation-procedure/demo/ImplementationProcedureDemoPageContent.tsx`](../samples/frontend/src/features/implementation-procedure/demo/ImplementationProcedureDemoPageContent.tsx) | 更新(単位の詳細に図を出す) |
| [`features/implementation-procedure/demo/__tests__/sequenceModel.test.ts`](../samples/frontend/src/features/implementation-procedure/demo/__tests__/sequenceModel.test.ts) | 新規 |
| [`features/implementation-procedure/demo/__tests__/procedureDocModel.test.ts`](../samples/frontend/src/features/implementation-procedure/demo/__tests__/procedureDocModel.test.ts) | 更新 |
| [`features/implementation-procedure/demo/__tests__/ImplementationProcedureDemoPageContent.test.tsx`](../samples/frontend/src/features/implementation-procedure/demo/__tests__/ImplementationProcedureDemoPageContent.test.tsx) | 更新 |
| md の見本(M-03-T01 と AI 向けの版・README) | 更新(文書のため #13/#15/#30 の対象外) |

## 調べて分かったこと

- **段階5の手順の行は、シーケンス図の材料をすでに持つ**(`devex-api/backend/app/detailed_design/procedure.py` の `ProcedureStep`)。呼び出し元・呼び出し先 = ライフライン、関数 = メッセージ、渡すデータ = 引数、結果 = 戻り、分岐の行 = 注記、手順ID `F-07#2`。したがって、**LLM を使わずに決定論的に変換できる**。
- 既存の図のパイプライン(`app/uml/`)は component/er/dfd 向けで、レイアウトエンジンは箱と線の図のためのもの。シーケンス図の配置は単純(参加者 = 列、手順 = 行)なので、エンジンは要らない。
- 段階5の実データ(ゴール3)には、そのまま図にすると壊れる書き方がある。F-07#4 `services/ai_service.py → frontend` は戻りを呼び出しとして書いている。F-08 の設計書生成の起動は非同期だが、区別する欄が無い。F-07#1 の「3a へ」は存在しない行を指す。
- 段階5で手順が書かれるのは、人が選んだ処理だけである(ゴール3では F-07・F-08 の2件)。

## 検討の結論と決定

| 論点 | 結論 | 決定 |
|---|---|---|
| 作り方 | 段階5の手順から**決定論的に導く読み取り専用のビュー**にする。直すのは手順の表で、図は直さない | **採用**(ユーザー決定) |
| LLM に図を別に生成させる | 手順の表と図の二重管理になり、食い違う | 不採用 |
| 図を React Flow で編集する | シーケンス図の編集(順序・入れ子・断片)は箱と線より難しく、正本が2つになる。Phase 13 の M9b(図の手直しを散文へ戻す)と同じ問題が起きる | 不採用 |
| コミュニケーション図 | 情報はシーケンス図と同じで、時間の順が番号でしか読めない。参加者の関係は段階4の構成図と 05 の関与表で見えている。配置にレイアウトエンジンが要る | **後回し**(シーケンス図を運用してから判断。ユーザー決定) |

### システム的な課題と、見本での扱い

| # | 課題 | 見本での扱い | 本実装への申し送り |
|---|---|---|---|
| 1 | **戻りと呼び出しの区別が無い**(最重要) | 呼び出し先が呼び出し中(呼び出し元の側)にいれば戻りとして描き、検証の指摘を出す | 段階5の行に種別(同期の呼び出し/非同期の呼び出し/戻り)を足す。既存のデータは「同期の呼び出し」として読む |
| 2 | 入れ子(活性区間)が決まらない | 呼び出し中の参加者の積み上げで推測する。呼び出し元が呼び出し中でなければ「推測できない」と指摘する | 同じ規則を使う。指摘は段階5の検証(警告)にする |
| 3 | 分岐が「条件+結果」だけ | 元の行に付けた注記として描く。存在しない分岐先は指摘する | ループ・並行は扱わない(要るなら段階5のモデルの変更として別に判断) |
| 4 | 参加者の粒度 | `frontend` はそのまま1本のライフライン | 段階4の問題として、手順書の未定義で指摘済み |
| 5 | 手順の無い処理には図が無い | 手順の無い単位(M-01-T02)には図を出さない | 手順の無いことは手順書の未定義で出す(今の決定どおり) |
| 6 | 表示と出力 | 画面は SVG。md と AI 向けの版は Mermaid の `sequenceDiagram` | 画面・HTML の SVG はバックエンドで作る(`app/uml/export/svg.py` の書式を流用)。md は Mermaid(Devex 自身の md プレビューでは描かれずコードとして見えるが、許容する)。draw.io は要望が出てから |

### 手順書との相関

- 単位が参照する手順の図を、単位の手順書に載せる。矢印には手順番号を付け、表の行と対応させる。
- **ファイルの表 ↔ ライフライン**: 単位で作るファイルのライフラインを強調する。
- **テスト観点 ↔ 図の切れ目**: SUT のライフラインから呼ぶ先が、スタブの候補になる。手順書のスタブの欄が、候補の外のモジュールを挙げていれば指摘する。見本では、TC-01 のスタブ `project_repository` が手順に無いことが分かった(段階6 L-01 の疑似コードにだけ出てくる)。チャット履歴の保存が手順に無いこと([25-2](./Phase-25-2.md) の見本で見つけた穴)と同じ穴である。
- **注意**: 図は、手順の表に無い情報を足さない。確実さを生むのは、図にするための規則(種別・入れ子)と、そこから出るチェックである。図が担うのは、読みやすさと AI への渡しやすさ。

## 各ファイルの解説

### `sequenceModel.ts` ── 手順からシーケンスを導く純粋関数

- 型: `Sequence`(`participants`・`events`・`issues`)。`events` はメッセージ(`kind` = call/async/return、表に無く推測した戻りは `derived`)と注記(分岐の行)。参加者の `id`(`P1`…)は Mermaid の別名に使う(パスの「/」を避けるため)。
- `toSequence(procedure, modules)`: 呼び出し中の参加者を積み上げて入れ子を推測する。呼び出し元が途中にいれば、上の参加者の戻りを推測で足す。呼び出し先が呼び出し元の側にいれば、その行を戻りとして描いて指摘する。ほかに、存在しない分岐先と、依存先(段階4)に無い呼び出しも指摘する。行に `kind` があれば、それに従う(本実装で段階5に足す欄の先取り)。
- `reachableCallees`: 参加者から呼び出しをたどって届く参加者(スタブの候補)。`sutParticipant`: テスト観点の SUT を参加者に対応させる(関数名なら、それを呼ぶ矢印の先。トリガーなら、最初の呼び出しの先)。`stubsOutsideSequence`: スタブの欄が、候補の外のモジュールを挙げていないかを調べる。
- `toMermaid`: Mermaid のテキスト。Mermaid で意味を持つ「#」「;」は外す。

### `SequenceSection.tsx` ── 図と、単位との対応

- `SequenceDiagram`: SVG で描く(参加者 = 列、イベント = 行)。破線は戻り、斜体は推測した戻り。参加者の色は、SUT = 青、スタブの候補 = 橙、単位のファイル = 黄。
- `SequenceSection`: 図・図にするときの指摘・「テスト観点とスタブの候補」の表。表のテストを押すと、図の SUT と候補に色が付く。

### `procedureDocModel.ts`・`ImplementationProcedureDemoPageContent.tsx`(更新)

- `ProcedureStep` に任意の `kind` を足した。人向けと AI 向けの md の両方に、手順から導いた Mermaid と指摘を入れる(`sequenceSection`)。図は参照先の別の見え方なので、人向けの md に入れても「設計を書き写さない」に反しない(正本は段階5の表のまま)。
- 単位の詳細で、手順を参照する単位にだけ `SequenceSection` を出す。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `sequenceModel.test.ts` | `toSequence`・`reachableCallees`・`sutParticipant`・`stubsOutsideSequence`・`toMermaid` | vitest | スタブ不要 ── 対象が純粋関数で外部依存を呼ばないため。小さな手作りの手順と、デモの F-07 の両方を入力にする |
| `procedureDocModel.test.ts`(追記) | `toUnitMarkdown`・`toAiMarkdown` | vitest | スタブ不要(同上) |
| `ImplementationProcedureDemoPageContent.test.tsx`(追記) | デモ画面のシーケンス図 | vitest + Testing Library | スタブ不要 ── 図とテスト観点の表は、データだけで描くため |

- 入れ子: 3段の呼び出しの後に、内側から順に戻りが足される。
- 指摘: 存在しない分岐先、依存先に無い呼び出し、呼び出し元へ戻る行(戻りとして描く)。非同期の呼び出しは戻りを待たない。
- デモの F-07: `ai_service → frontend` が `api/routes/projects.py → frontend` の戻りとして描かれ、F-07#1・#4 が指摘される。
- スタブの候補: `AIservice.stream_chat` からは `gemini_client` だけ。TC-01 のスタブの欄の `project_repository` が、候補の外として出る。
- 画面: 図・指摘・表が出て、TC-01 を押すと SUT が青、候補が橙、単位のファイルが黄になる。

## 後続 Phase への申し送り

- 段階5の行への種別の追加、手順の表の検証への指摘(戻りを呼び出しとして書いている・入れ子を推測できない・存在しない分岐先)、シーケンス図の SVG(バックエンド)と Mermaid の出力を、Phase 29 で行う([25-4](./Phase-25-4.md))。
- `docs/external_design.md` の「シーケンス図: 当面は作らない」の注記は、[25-3](./Phase-25-3.md) で撤回の blockquote(#12)で改めた。
