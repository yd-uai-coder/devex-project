# Phase 13 導入: 内部設計書への図の反映(M9a)・アンカー・陳腐化の検知・zip

## 目的

[`docs/implementation_plan.md`](../../docs/implementation_plan.md) 4.1節 ステージ3ロードマップの「Phase 13: 内部設計書への図による補完の埋め込み・アンカー導入・陳腐化検知」を実装する。対象は M9a(図による詳細設計の補完)である。

- **反映**: 承認済みの UML 図(component / ER / DFD)の要素表を、内部設計書の該当する節にアンカーコメントで区切って書き込む。書き込むのは表示中の版で、版は増やさない(D1 案A)。
- **差し込み**: 文書のプレビューでは、アンカーの位置に図の SVG を表示する(D8)。
- **zip**: 内部設計書の md と図のファイル(SVG・draw.io)を zip でダウンロードさせる(D8)。
- **陳腐化の検知**: 図と文書のどちらが古くなったかを、双方向に見分けて画面に出す(診断7)。

画面は、文書画面の内部設計のタブ(SCR-004)と、設計図の一覧(`/uml`)に手を入れる。

あわせて、[`Phase-12-introduction.md`](../Phase-12/Phase-12-introduction.md)「後続 Phase への申し送り」を解消する。

- プレビューへの SVG の差し込みは、12-3 の `build_render` → `to_svg` をそのまま使う。承認済み(`approved`/`exported`)の図だけを差し込む(13-3)。
- zip の中の図のファイル名は、12-4 の `_export_filename` の規則を共有する(13-2 で `app/uml/export/files.py` へ移し、13-4 で使う)。
- 図を差し込んだ文書を zip で出力したとき、図の状態をどうするか → 下の確定事項4で `exported` にすると決めた(13-4)。

## 実装前の設計判断(このセッションで確定)

着手前の相談で、次の4点を確定した。詳細は [`textbook/q_a.md`](../q_a.md) を参照。

1. **反映の契機**
   - 承認と同じトランザクションで、自動で反映する(13-2)。
   - 文書を再生成・復元するとアンカーが消えるので、文書画面に「図を再反映」(一括)ボタンを置く(13-2・13-6)。
   - 書き込みは `is_current` の行の in-place 更新で、版は増やさない(D1 案A)。
   - 明示ボタンだけにする案もあった。しかし、承認と反映が別の操作になると、反映し忘れが起きる。
2. **アンカーはバックエンドが見出しを基準に挿入する**
   - アンカーは図の ID を含む。図は文書の後で作られるので、文書を生成する LLM には書けない。
   - そのため、プロンプト(Phase 2)は改訂せず、反映のときに見出しを手がかりに挿入する(13-1)。
   - 挿入先: component は `## 3.3` の直下、ER は `## 3.2` の直下、DFD は対象の `#### DF-n: <処理名>` の直下。見つからなければ末尾の `## 付録: 設計図` 節に入れる。
3. **陳腐化の範囲は、図と内部設計書の間の双方向だけ**
   - (a) 図が、内部設計書の古い版から作られている。(b) 文書に反映した内容が、図の今の状態と違う。
   - 文書チェーン(要件定義 → 外部設計 → 内部設計)に沿って下流へ伝える処理は、それを必要とする M9b(Phase 13b)へ回す。
4. **zip の中身と状態**
   - 中身は、内部設計書の md と、`diagrams/` の下の SVG・draw.io。zip の中の md では、アンカーの範囲の先頭に相対パスの画像リンクを入れる(md ビューアでも図が見える)。
   - zip に入れた図は `approved` → `exported` にする。zip には編集用の `.drawio` も入り、図のファイルを出力したことになるためである。

Claude の判断で決めたこと(計画の承認で確定):

- **md/uml 共通の純粋パッケージは今回も切り出さない**([decision digest](../decision-digest.md)「Phase 10完了後」の検討課題(1)の判定)。内部設計書の形式を読み書きする新しいコードは、すべて uml 側(`app/uml/sync/`)の消費者である。md 側(`doc_generator_service.py`)にはプロンプトの定数しかなく、形式のパーサを import する実在の消費者がいない(#17)。Stage 3 終了時に再判定する。
- **アンカーに図の版を埋める**(`start v=<version>`)。文書を復元すると、古いアンカーも一緒に戻る。DB に「反映した版」の列を足すより整合が崩れにくく、マイグレーションも要らない。
- **プレビューの SVG は `<img src="data:image/svg+xml,...">` で表示する**。img で読み込んだ SVG はスクリプトを実行しない。`rehype-raw` は入れない。

## パイプライン上の位置づけ・前提

```
承認:   POST /approve ─ (Phase 12 の5条件) → approved → UmlSyncService.reflect            (13-2)
                          render_element_table → upsert_block → update_content_in_place   (13-1, 13-2)
再反映: POST /uml/reflect ─ reflect_all(承認済みの図すべて)                                (13-2)
表示:   GET /uml/embeds ─ parse_anchors + diagram_sync_state + to_svg(状態は変えない)       (13-3)
zip:    GET /uml/bundle ─ with_image_links + svg/drawio → zipfile → exported             (13-4)
[FE]:   documents/anchors.splitByAnchors → ReactMarkdown | DiagramEmbed(img data URI)    (13-6)
        DiagramSyncBar(再反映・zip) / DiagramList(図が古いバッジ)                          (13-5, 13-6)
```

- **前提として読むもの**:
  - [`Phase-10-1.md`](../Phase-10/Phase-10-1.md): 内部設計書の見出しの固定形式と、`sections.py` の切り出し(13-1 で見出しの位置を返す関数を足す)。
  - [`Phase-12-introduction.md`](../Phase-12/Phase-12-introduction.md): 状態遷移(`status.py`)と出力エンジン(`build_render`/`to_svg`/`to_drawio`)。
  - [`Phase-6-introduction.md`](../Phase-6/Phase-6-introduction.md): 文書の版の保持(3件)と、復元は `is_current` の付け替えだけで内容を書き換えないという不変条件。13-2 はこの不変条件の例外を1つ作る。
- **本 Phase 開始時点の状態**:
  - `uml_diagrams.source_doc_versions` は AI 生成のときに書き込まれるが、何とも比べられていない。
  - 内部設計書の本文には、図への参照が何も無い。文書のプレビュー(react-markdown)は HTML コメントを描かない。
  - zip を扱うコードは、バックエンドにもフロントエンドにも無い。
- **既存コードに前例が無い新規パターン**:
  1. 既存の版の本文を書き換える(`update_content_in_place`)。Phase 6 の「既存版の内容は書き換えない」の、唯一の例外である。
  2. 文書の中にコメントで区切った「機械が管理する範囲」を持ち、何度でも同じ位置で置き換える(アンカー)。
  3. 描画の前に Markdown を分割し、分割した位置に別の部品(図)を差し込む(FE)。
  4. zip をメモリ上で組み立てて返し、FE は Blob のまま保存させる。

## モード宣言(#21)

自動実装モード: **on**(AI が本体へ実装し、`textbook/samples/` も並行して作った)。

> 旧ルール(学習モード / 納期モード)では、13-4・13-5 を納期モード、他を学習モードとした。旧・納期モードの章は、#14 の SUT/ドライバ/スタブの言語化を省いている。旧ルールから自動実装モードへ改めた経緯は [`overall-retrospective.md`](../appendix/overall-retrospective.md) を参照。

## 章一覧

| 章 | トピック | 旧モード | 依存 |
|---|---|---|---|
| [`Phase-13-1.md`](./Phase-13-1.md) | BE: `app/uml/sync/`(アンカーの解析・挿入・置換、記法ごとの要素表。純粋) | 学習 | なし |
| [`Phase-13-2.md`](./Phase-13-2.md) | BE: 反映サービス(in-place 更新、承認時の自動反映、一括の再反映 API) | 学習 | 13-1 |
| [`Phase-13-3.md`](./Phase-13-3.md) | BE: 陳腐化の判定(純粋)と、埋め込み用 API(SVG と状態) | 学習 | 13-1, 13-2 |
| [`Phase-13-4.md`](./Phase-13-4.md) | BE: zip のダウンロード(画像リンクの差し込み、`exported` にする) | 納期 | 13-1, 13-3 |
| [`Phase-13-5.md`](./Phase-13-5.md) | FE: API クライアント・型、`saveFile` の Blob 対応 | 納期 | 13-2〜13-4 |
| [`Phase-13-6.md`](./Phase-13-6.md) | FE: プレビューへの図の差し込み、陳腐化の表示、再反映・zip のボタン | 学習 | 13-5 |

13-4 が 13-3 に依存するのは、zip の SVG・draw.io を、13-3 でサービスに足す描画の関数 `_render` で作るためである。

## サンプルコード一覧

- **バックエンド**(`textbook/samples/backend/`、`devex-api/backend/` と同じ相対パス):
  - 新規: `app/uml/sync/{__init__,anchors,tables,staleness}.py`、`app/uml/export/files.py`、`app/services/uml_sync_service.py`
  - 新規(テスト): `tests/unit/test_uml_sync_{anchors,tables,staleness,service,routes}.py`、`tests/unit/test_uml_export_files.py`
  - 更新: `app/uml/generation/sections.py`、`app/uml/export/__init__.py`、`app/repositories/generated_document.py`、`app/services/doc_generator_service.py`(docstring のみ)、`app/services/uml_diagram_service.py`、`app/schemas/uml_diagram.py`、`app/api/routes/uml.py`
  - 更新(テスト): `tests/fixtures/uml.py`、`tests/unit/test_uml_generation_sections.py`、`tests/unit/test_generated_document_repository.py`
- **フロントエンド**(`textbook/samples/frontend/`、`devex-ui/` と同じ相対パス):
  - 新規: `src/features/documents/anchors.ts`、`src/features/documents/hooks/useDiagramEmbeds.ts`、`src/features/documents/components/{DiagramEmbed,DiagramSyncBar}.tsx`
  - 新規(テスト): `src/features/documents/__tests__/anchors.test.ts`、`src/features/documents/hooks/__tests__/useDiagramEmbeds.test.ts`、`src/features/documents/components/__tests__/{DiagramEmbed,DiagramSyncBar}.test.tsx`
  - 更新: `src/lib/api/download.ts`、`src/features/uml/api/{types,umlApi}.ts`、`src/features/documents/components/DocumentMarkdownView.tsx`、`src/features/uml/{uml-store,uml-editor-store}.ts`、`src/features/uml/components/DiagramList.tsx`、`src/features/uml/test-utils/umlFixtures.ts`
  - 更新(テスト): `src/lib/api/__tests__/download.test.ts`、`src/features/uml/api/__tests__/umlApi.test.ts`、`src/features/uml/__tests__/{uml-store,uml-editor-store}.test.ts`、`src/features/uml/components/__tests__/DiagramList.test.tsx`、`src/features/documents/components/__tests__/DocumentMarkdownView.test.tsx`
- デモページ(`/uml-demo`、devex-ui だけ)は、この Phase では変えていない。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| 13-1 | `app/uml/sync/{anchors,tables,__init__}.py`(新規)、`generation/sections.py`(更新) | 見出しを手がかりにアンカーの位置を決め、記法ごとの要素表を作る(どちらも純粋) | `uv run pytest tests/unit/test_uml_sync_anchors.py tests/unit/test_uml_sync_tables.py tests/unit/test_uml_generation_sections.py` |
| 13-2 | `app/uml/export/files.py`・`app/services/uml_sync_service.py`(新規)、リポジトリ・`uml_diagram_service.py`・スキーマ・ルート(更新) | 承認と同じトランザクションで、表示中の版に要素表を書き込む(版は増やさない)。一括の再反映 | `uv run pytest tests/unit/test_generated_document_repository.py tests/unit/test_uml_export_files.py tests/unit/test_uml_sync_service.py tests/unit/test_uml_sync_routes.py tests/unit/test_uml_diagram_service.py` |
| 13-3 | `app/uml/sync/staleness.py`(新規)、`uml_sync_service.py`・スキーマ・ルート(更新) | 図の版・文書の版・アンカーの版を比べて食い違いを決め、承認済みの図の SVG と一緒に返す | `uv run pytest tests/unit/test_uml_sync_staleness.py tests/unit/test_uml_sync_service.py tests/unit/test_uml_sync_routes.py` |
| 13-4 | `anchors.py`・`uml_sync_service.py`・ルート(更新) | 反映済みの図のファイルと、画像リンクを入れた md を zip にし、入れた図を `exported` にする | `uv run pytest tests/unit/test_uml_sync_anchors.py tests/unit/test_uml_sync_service.py tests/unit/test_uml_sync_routes.py` |
| 13-5 | `download.ts`・`umlApi.ts`・`types.ts`(更新) | 埋め込み・再反映・zip の API を呼ぶ。zip は Blob のまま受け取って保存させる | `npx vitest run src/features/uml/api src/lib/api` |
| 13-6 | `documents/anchors.ts`・`useDiagramEmbeds.ts`・`DiagramEmbed.tsx`・`DiagramSyncBar.tsx`(新規)、`DocumentMarkdownView.tsx`・`uml-store.ts`・`uml-editor-store.ts`・`DiagramList.tsx`(更新) | アンカーで本文を分けて図を差し込み、食い違いを次の操作の言葉にする | `npx vitest run src/features/documents src/features/uml/__tests__ src/features/uml/components/__tests__/DiagramList.test.tsx` |

## 写経順序(#23)

章番号順(13-1 → 13-2 → 13-3 → 13-4 → 13-5 → 13-6)に進める。各章の中は依存順(#30)で、順番は各章の表を参照。

次のファイルは、複数の章で少しずつ完成する。各章の担当分には `# Phase-13-<n>:追記` / `# Phase-13-<n>：更新` のタグを付けてある。写経するときは、その章までのタグの部分だけを書く。

- `app/uml/sync/anchors.py`・`app/uml/sync/__init__.py`(13-1 → 13-3 → 13-4)
- `app/services/uml_sync_service.py`(13-2 → 13-3 → 13-4)
- `app/schemas/uml_diagram.py`・`app/api/routes/uml.py`(13-2 → 13-3 → 13-4)
- `tests/unit/test_uml_sync_service.py`・`tests/unit/test_uml_sync_routes.py`(13-2 → 13-3 → 13-4)

途中に前の章のコードが続く箇所には、`# ── ここから Phase-13-<n> の作成分 ──` という境界の印を付けた(#12 の「章番号が後退する境界では必ず再タグを付ける」)。

## Stage 3 固有の運用(Phase 7 から継続)

`textbook/samples/` への反映と並行して、Claude が本体に直接実装する。対象は `devex-api`(`stage3` ブランチ)と `devex-ui`(`main`)。samples 側の Phase タグは本体には書かない。

## 検証結果

- **BE(Phase 完了時の全体テスト)**: 全体 428件が成功(Phase 12 完了時は 382件)。`ruff check .` は全通過。`uvx pyright` は既知の1件(`app/ai/llm/gemini.py` の `E2eFakeLLM`)のみ。
- **FE(Phase 完了時の全体テスト)**: 全体 363件(69ファイル)が成功。`tsc --noEmit`・`build` は成功。`lint` は既存の警告1件だけ(`streamChat.test.ts`)。
- **samples と本体の一致**: Phase タグと、更新・削除で残した旧コードのコメントを取り除いた samples が、本体と一致することを diff で確かめた。残る差は、Phase 13 以前からあるコメントの差だけである。
- **実 import 監査(#15)**: 全ファイルの import 文を章の順に読み、前方 import が無いことを確かめた。タグの付け漏れ2件(`anchors.py` の `Mapping` は 13-4、サービステストの `TWO_MODULES` は 13-3 の追記)を直した。

### 目視確認

- 実際のサービス(インメモリ SQLite、実レイアウトエンジン)で、component と ER の図を承認して zip を作り、展開した。
  - 中身は `internal_design.md`、`diagrams/component.{svg,drawio}`、`diagrams/er.{svg,drawio}` の5ファイル。
  - md では、`## 3.3` と `## 3.2` の直下にアンカーの範囲があり、先頭に `![ER図(全体)](<diagrams/er.svg>)` のような画像リンク、続いて注意書きと要素表が入っていた。既存の本文(`- 主要エンティティ: ...` など)は、範囲の後ろにそのまま残っていた。
- md を HTML に変換するところまでは行った。ヘッドレス Chromium でのスクリーンショットは、実行環境のコマンド確認が一時的に失敗したため未実施である。

## 後続 Phase への申し送り

- **Phase 13b(M9b: 図の手直しを基本設計へ反映)**:
  - 文書チェーンに沿った陳腐化の伝播は、この Phase では扱っていない(確定事項3)。13b で基本設計を修正案で変えるときに、下流の文書と図へ伝える必要がある。
  - 13b で散文へ修正案を適用すると、新しい版ができる(D1 案B)。その版には、前の版のアンカーを引き継ぐ必要がある。修正案を適用した後に `reflect_all` を呼べば、承認済みの図は元の位置に戻る。
  - `update_content_in_place` は反映(M9a)専用である。修正案の適用に使わないこと(D1)。

  > **[Phase 14 で確定 ── 〈Phase 13b(M9b)を実施しない〉]** 当初〈上の3点を 13b で扱う予定〉→ 撤回。理由〈ステージ3は Phase 13 で終了し、M9b は詳細設計モード(ステージ4)の構想により不要とした。文書チェーンの陳腐化の伝播は、詳細設計モードの段階の陳腐化(`design_stages`)として作る。[`Phase-14-1.md`](../Phase-14/Phase-14-1.md) 参照〉。

- **既知の制約**:
  - アンカーの範囲の中を利用者が手で編集することは想定していない(本文の編集機能自体が無い)。文書の注意書きに「再反映すると上書きされる」と書いた。
  - DFD のアンカーは、処理名(`#### DF-n: <処理名>` の処理名)で位置を探す。内部設計書を再生成して処理名が変わると、付録の節に入る。図の `subject` も古い処理名のままなので、`source_outdated` の表示で再生成を促す。
  - 一覧画面の「図が古い」の表示は、生成候補の `internal_design_version` と比べる。キャッシュ(20秒)の間は、文書画面で再生成した結果がすぐには出ない。
- **検証していないこと**:
  - Docker が使えないため、実バックエンドとつないだブラウザでの確認は未実施である(文書画面への図の差し込みは、コンポーネントのテストで確かめた)。
  - zip の md を md ビューアで開いて画像が表示されることの目視は未実施である(上の「目視確認」参照)。

## 後続 Phase での改訂

- Phase 14: ステージ3は本 Phase で終了とし、申し送りの Phase 13b(M9b)と旧 Phase 14 を撤回した([`Phase-14-1.md`](../Phase-14/Phase-14-1.md))。
- Phase 22: 詳細設計書の zip も同じ規則で図を描くため、`uml_sync_service.py` の `_render` の中身と `_unique_base` を `app/uml/export/files.py` の `render_diagram`・`unique_base` へ、FE の `umlApi.ts` の `fetchAttachment` を `src/lib/api/download.ts` へ移した(#17。[`Phase-22-5.md`](../Phase-22/Phase-22-5.md)・[`Phase-22-6.md`](../Phase-22/Phase-22-6.md))。
- Phase 24 完了後の調整([`q_a.md`](../q_a.md)「Phase 24 完了後 ── 文書プレビューの不具合・簡易モードの設計図の削除・モード表示」): 簡易モードの設計図を削除したので、本 Phase の内部設計書への反映・アンカー・陳腐化・zip(`uml_sync_service.py`・`app/uml/sync/`・`DiagramEmbed`・`DiagramSyncBar`・`useDiagramEmbeds`・`anchors.ts`)を削除した。`BundleFile` は詳細設計書の出力サービスへ移した。文書のプレビューは `skipHtml` にして、以前に反映したアンカーを表示しない。

## Phase 完了チェック(#22)

1. アンカーを LLM に出力させず、反映のときにバックエンドが見出しを基準に挿入することにした理由を、「アンカーに何が含まれるか」と「図と文書のどちらが先に作られるか」から説明できるか。
2. 反映で `create_version` を使わず `update_content_in_place` を使った理由と、その代わりに必要になった仕組み(再反映・陳腐化の検知)を、D1 と3件の保持数から説明できるか。
3. 「文書に反映した図の版」を DB の列ではなくアンカーの `v=` に持たせた理由を、文書の復元が起きたときの動きから説明できるか。
4. `source_outdated` を「大きい/小さい」ではなく「等しくない」で判定する理由を説明できるか。
5. プレビューで react-markdown に `rehype-raw` を入れず、描画の前に本文を分割して img の data URI で SVG を表示した理由を、XSS の経路から説明できるか。
