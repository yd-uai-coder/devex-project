# Q&A ログ

保存専用・追記のみ。作業中には参照しない(#8)。各エントリ: (1) 疑問が生じた Phase (2) 質問・相談内容 (3) 回答と対応方針。

---

## Phase 0

1. Phase 0
2. README.md の「フェーズ1/フェーズ2」と CL開発の「Phase-N」が指すものが別軸で、用語が衝突する。どう扱うか。
3. ユーザー判断: 両方とも「Phase」のまま維持し、文脈で区別する。CLAUDE.md「進行のルール」節に用語注記を追加して対応(#18〜25冒頭)。

1. Phase 0
2. 所感5.1の「学習モード/納期モード」切替を本プロジェクトで実際に採用するか。
3. ユーザー判断: 採用する。#21として運用ルール化。ただしMVPコアループの章は常に学習モード固定とした。

1. Phase 0
2. Phase 0(最初の教材単位)の範囲はどこまでか(ルール確定+ゴール策定のみか、Devexのヒアリングフロー設計まで含めるか)。
3. ユーザー判断: ルール確定+ゴール策定のみ(推奨案どおり)。ヒアリングフロー設計はPhase 1に回す。

1. Phase 0
2. decision digest(後続Phaseに効く決定の圧縮記録)の置き場所をどこにするか。
3. ユーザー判断: CLAUDE.mdとは別ファイル(`textbook/decision-digest.md`)に分離し、進行中に能動的に参照するファイルと位置づける。#24として明文化。

1. Phase 0
2. ユーザー指示: 「mdファイル作成時のルールとして、他のmdファイルを参照する場合はリンクを貼ることを共通ルールに明記して」
3. #26として新設。`textbook/`配下・`CLAUDE.md`からの`.md`参照は全てMarkdownリンク化する運用にした。既存ファイル(Phase-0-introduction.md、Phase-0-1.md、decision-digest.md)も遡って修正した。

1. Phase 0
2. ユーザー指摘: appendix原本#1「学習教材をPhase毎に教材フォルダ(例: textbook/)に.md形式で作成する」の解釈が誤っている可能性。「Phase毎の教材フォルダ」は「Phase毎にフォルダを作成する」の意ではないか。
3. #1本文は変更せず、直下に運用注記を追加(#6「各Phaseフォルダ直下」とも整合する読み方であることを明記)。`textbook/Phase-0-*.md` だったファイルを `textbook/Phase-0/` 配下へ移設し、相対リンクを修正した。

1. Phase 0
2. ユーザー指示: 「共通ルールとしてPhase0を要件・設計の確認からPhase1以降の実装手順を具体化するフェーズとする。本プロジェクトにおいてはプロジェクトルートに置かれたREADME.mdを元に実装手順を作成する。Devex完成以降はDevexで作成したドキュメントを元にPhase0を行うので、このルールはDevex完成後の振り返りで具体化する。」
3. #27として新設(共通ルール候補、将来のhandoff v2引き継ぎを想定)。README.md 4.2 WBSの5区分に1:1対応する形でPhase 1〜5のロードマップを具体化し、`textbook/Phase-0/Phase-0-2.md`に記録した。Devex完成後の入力切替方法は今は確定せず、完成後の振り返りに委ねる。

1. Phase 0
2. ユーザー補足: 「実装手順をPhase{N}と呼ぶ。README.mdの実装計画のフェーズは別の言葉に置き換えたい。」
3. 前回「両方ともPhaseのまま文脈で区別」と決めた用語方針を撤回。README.mdの「フェーズ1/フェーズ2」を「ステージ1/ステージ2」に一括リネームし、「Phase」はCL実装単位専用の語にした。CLAUDE.mdの用語注記を「解消済み」に更新。

## Phase 0(続き)

1. Phase 0
2. ユーザーから初期ヒアリング入力の構成案(基本ヒアリング4項目+環境設定4項目をまとめてPOST、その後チャット)が提示され、よりアクセシブルな構成への改善提案を依頼された。重視点: 初期入力段階で明確な設計・構想を求めすぎないこと、要件・設計はAIが判断しユーザー承認を経てドキュメント化すること。
3. devex-ui/devex-apiを調査(TokenInput非制御・aria-labelなし、InputSuggestは静的フィルタのみ、動的コンボボックス前例なし、aria-invalid等未配線、chat_service.pyに構造化入力の前例なし)した上で、「大幅に簡略化」案をユーザーが選択。初期フォームを3自由記述項目+折りたたみ環境設定(静的チェックボックスグルーピング)に縮小し、機能提案・箇条書き化はチャット側に移す設計をREADME.mdに反映した。詳細は[`decision-digest.md`](../decision-digest.md)、[`Phase-0/Phase-0-3.md`](./Phase-0/Phase-0-3.md)参照。

1. Phase 0
2. ユーザー指摘: 「claudeは現在Phase1であると認識している?私はPhase0である認識である。何故なら、Phase1は既に実装段階であり、要件のすり合わせはPhase0であるから。また、まだPhase1を開始する旨は明示していない。」
3. 指摘は正しい。前回、初期ヒアリング入力の設計作業を記録する際に「Phase 2-3 / 3-2 着手前」という造語見出しを使い、Phase 0の範囲(#27: 要件・設計の確認)であることを正しく記録していなかった。また前回の応答で「Phase 2を開始する」と言及したのは誤り(ロードマップ上の次はPhase 1「環境構築」であり、その開始トリガーもまだ受けていない)。`decision-digest.md`・`q_a.md`の見出しを「Phase 0」に訂正し、[`Phase-0/Phase-0-3.md`](./Phase-0/Phase-0-3.md)として正式にPhase 0の1章に位置づけ直した。現在地は引き続きPhase 0であり、Phase 1以降は未着手。

1. Phase 0
2. ユーザー指示: 「README.mdに要件・外部設計・内部設計・実装計画が混在しており縦長で読みづらい。Devexは各ドキュメントを別ファイルで出力する想定なので、本プロジェクトでも分割して格納したい。README.mdには詳細を書かず概要のみとし、詳細は分割ファイルにリンクする。」
3. `docs/requirements.md`/`docs/external_design.md`/`docs/internal_design.md`/`docs/implementation_plan.md`を新設し、`README.md`の1〜4章をそれぞれ移設(ファイル名はDevex自身が生成する4種のドキュメント名と揃えた)。`README.md`は概要+リンク表のみに縮小。内部節番号は維持し、`CLAUDE.md`・`decision-digest.md`・`textbook/Phase-0/*.md`(introduction/1/2/3)内のREADME.md参照を新パスに更新した(#12の参照リンク張り替え除外規定を適用)。この作業自体を[`Phase-0/Phase-0-4.md`](./Phase-0/Phase-0-4.md)として記録した。

1. Phase 0
2. ユーザー指示: 「本実装の開始前に現在の要件定義〜実装計画の内容について診断してもらいたい。システム開発において不足や不明瞭な部分はないか、意見が欲しい。」に対し、12項目の診断結果を提示。ユーザーから全項目の決定を得た(うち2. ストリーミング方式、4. ヒアリング完了判定基準、9. アクセシビリティ、10. JWT仕様の4項目はClaudeへの提案依頼)。10.については、将来別プロジェクトでも同仕様を再利用する想定のため、Devex完了後にテンプレートリポジトリ(devex-api/devex-ui)へ反映する申し送りの指示もあった。
3. `docs/`配下4ファイルに12項目すべてを反映した。詳細は[`decision-digest.md`](../decision-digest.md)、[`Phase-0/Phase-0-5.md`](./Phase-0/Phase-0-5.md)参照。JWT仕様のテンプレートリポジトリへの反映は、今回は申し送りの記録のみとし、devex-api/devex-ui自体は変更していない。

1. Phase 0
2. ユーザー指示: 「共通ルールとしてPhase0内で今回と同じ検討を行う事をルールとする。」
3. #28として新設(共通ルール候補、#27と同様に将来のhandoff v2引き継ぎを想定)。Phase 1トリガー前に`docs/`配下4文書を対象に最重要/中程度/軽微の3段階で診断し、ユーザーが決定またはAIへの提案依頼を選べる運用を`CLAUDE.md`に明文化した。今回はルール新設のみで、追加の診断作業は行っていない。

1. Phase 0
2. ユーザー指示: 「本プロジェクトで作成するシステムは今回の検討と同じ観点で精査したドキュメントを作成するものである事を要件として明示したい」
3. #28(CL進行ルール)を、Devexというプロダクト自体の機能要件としても明示。[`docs/requirements.md`](../docs/requirements.md) 1.4節Must haveに「ドキュメント自己診断機能」を追加し、[`docs/external_design.md`](../docs/external_design.md)・[`docs/internal_design.md`](../docs/internal_design.md)にも反映した。`chat_histories.sender`の`'others'`値の用途を「ドキュメント自己診断結果の記録」に確定した。

1. Phase 6(ステージ2動作確認後)
2. ユーザー指示: 「HearingCompletionBannerの発生が早い。まだ質問事項があるのに発生している」「設計書生成→チャットに戻る→再度チャット送信→新しいHearingCompletionBannerが表示されるが、設計書生成ボタンがdisabled:falseに戻らない(ダッシュボード経由で再遷移すると押下可能になる)」「同じ内容でも復元ボタンを押すたびにバージョンが上がっている。新しく生成しない場合はバージョンを更新せず、現在の表示内容がどのバージョンかを示すバッジをバージョン履歴に付ける。ダウンロードは現在表示中のバージョンの内容にする」
3. [`Phase-6-6.md`](./Phase-6/Phase-6-6.md)として対応(samplesのみ反映)。完了判定はプロンプト厳格化+ユーザー発話3件の下限ガード、ボタンは`hearing-store`が`projectStatus`(completed→revising)・`completion`を追従、復元は`generated_documents.is_current`カラムの付け替えのみに変更(仕様診断#28決定2を撤回、`docs/internal_design.md`3.2節を改訂)。

1. Phase 6(ステージ2デプロイ後の本番確認)
2. ユーザー報告: 「ログイン状態からF5でブラウザを更新するとログイン状態が切れる」(本番 devex.uandi-tech.com)。DevTools・VPSログの確認を経て、`refresh`のRequest URLが`https://devex-api.uandi-tech.com//api/v1/auth/refresh`(`//`二重)で、`cookie:`ヘッダが付いていないことが判明。
3. 原因は、VercelのNEXT_PUBLIC_API_URLの末尾スラッシュ。Cookieの`Path=/api/v1/auth`が`//api/...`にパスマッチせず送られなかった(サーバー側のRedis・Set-Cookieは正常)。対応: Vercelの環境変数から末尾スラッシュを削除して再デプロイ+`src/lib/api/base-url.ts`で末尾スラッシュを除去する再発防止([`Phase-6-6.md`](./Phase-6/Phase-6-6.md)「API ベースURLの末尾スラッシュ除去」参照)。

## Phase 7(ステージ3着手)

1. Phase 7
2. ユーザー確認: Phase 7着手にあたり、3リポジトリ(`devex`本体/`devex-api`/`devex-ui`)のブランチ運用を質問した。前回セッションの検討メモには「stage2-phase6の未コミット変更を整理し、ステージ3用のブランチを切る」という次アクションが残っていたが、本プロジェクトはPhase 0〜6まで一貫してmain直下にコミットしてきており、ブランチを切った前例が無かったため。
3. ユーザーから、`devex-api`は既に`stage2-phase6`をmainへマージ済み(PR#1)・`stage3`ブランチ作成済みとの実際のgit状態が共有された。`devex`本体はステージ2分をpush済みでブランチ不要、`devex-ui`も同様にブランチ不要と指示された。結果: `devex-api`のみ`stage3`ブランチで進行し、他2リポジトリは`main`のまま。
4. ユーザー確認: レイアウトエンジン移植スパイク(Phase 9に本実装を割り当て済み)をPhase 7でどこまで踏み込むか。
5. ユーザー選択: 「見通しの文書化のみ(推奨)」。実コードのコピーはPhase 9まで行わず、[`Phase-7-4.md`](./Phase-7/Phase-7-4.md)に移植可否・リスクの文書化のみ行った。
6. ユーザー確認: React Flow×Tamaguiスパイク(Phase 11に本実装を割り当て済み)の成果物の扱い。
7. ユーザー選択: 「使い捨ての技術検証のみ(推奨)」。ただし検証精度を上げるため、Phase 11で実際に使う予定のルート/コンポーネント配置(`app/.../projects/[id]/uml/page.tsx` + `src/features/uml/components/UmlPageContent.tsx`)で検証した。詳細は[`Phase-7-3.md`](./Phase-7/Phase-7-3.md)参照。

## Phase 8(意味モデル・データ辞書・CRUD/validate API)

1. Phase 8
2. ユーザー確認: `docs/internal_design.md`が「Phase 8で確定する」と明記していた`DataItem`の永続化実体(専用テーブルかプロジェクト単位のJSONBか)をどちらにするか。
3. ユーザー選択: 「専用テーブル `data_items`」(推奨)。項目単位のCRUD・一意性制約・参照検証のしやすさを理由に採用。
4. ユーザー確認: `DataItem`を操作する専用APIをPhase 8で公開するか(`docs/internal_design.md`のエンドポイント表にはdiagram系のみでDataItem用エンドポイントが未記載だった)。
5. ユーザー選択: 「最小限のCRUD APIを今追加」(推奨)。`/projects/{id}/uml/data-items`系として実装。
6. ユーザー確認: DFD検証規則「上位図と下位図の境界フローが一致する」(診断8)は`uml_diagrams`に階層列が無いため今のままでは検証できない。列を先に追加するか、規則をPhase 10へ申し送るか。
7. ユーザーから、列追加の有無でPhase 10の設計判断がどう変わるか(見立て)を求められた。Claudeは診断8本文の「APIエンドポイント/バッチごとに1枚」という記述が示すフラットな複数図構成の可能性、列だけ追加してもノード単位の対応情報が別途必要になり手戻りになりうる点を提示した。
8. ユーザー選択: 「案A: 列追加を見送り、規則をPhase 10へ申し送り」。ただし「Phase10開始時の設計判断は診断8本文どおりフラットな複数図に留める構成を前提に行う」という前提を明示的に付記するよう指示があった。この前提は[`Phase-8-introduction.md`](./Phase-8/Phase-8-introduction.md)・[`decision-digest.md`](../decision-digest.md)双方に反映済み。
9. ユーザー指示: 「Phase7-4にPhase9への申し送り事項の記載がある。Phase9開始時に申し送りを見落とさないようにしておいて欲しい」。
10. 対応: [`Phase-8-introduction.md`](./Phase-8/Phase-8-introduction.md)「次のフェーズ」に明記し、[`decision-digest.md`](../decision-digest.md)のPhase 8完了エントリにも参照を残した。

## Phase 8完了後(ルーター層の設計統一)

1. Phase 8完了後
2. ユーザー質問: 「routeから直接Repositoryを呼び出す場合とServiceを経由して処理する場合の設計判断が知りたい」。
3. Claudeが既存コードを調査し、「単純な読み取りはRepository直呼び、書き込み・複数Repo調整・外部呼び出しはService経由」という暗黙の基準を提示。Phase 8の`uml.py`ではこれより厳格に「全操作をService経由」で統一したことも説明した。
4. ユーザー確認: 「今回の判断とは異なる現場実務上の暗黙のルールのような構成がないか確認してほしい」。
5. Claudeが業界動向を調査(WebSearch)。CQRS的な立場(Ardalis等)と、ArchUnit等で強制する「常にService経由」の立場、FastAPI公式`full-stack-fastapi-template`の慣習の3つを提示した。
6. ユーザー指示: 「常にService経由、Repository直参照は層違反として禁止。この立場で統一したいのでproject関連もリファクタリングしてほしい」。理由: 将来の処理追加時の拡張性、設計判断の余地を減らしたいこと。
7. 対応: `projects.py`/`prompt_templates.py`の直接Repository参照6箇所をServiceメソッド経由へ統一(`app/services/prompt_template.py`新設)。詳細は[`Phase-8-5.md`](./Phase-8/Phase-8-5.md)参照。`app/api/deps.py`の`get_current_project`は既存の認証境界の例外カテゴリとして対象外にした(ユーザーへ報告済み、異論なし)。

## Phase 9(レイアウトエンジン移植・レーン/行割り当て・`/layout` API)

1. Phase 9
2. ユーザー指示: 「Phase9を開始する。過去のPhaseからの申し送り事項を見落とさない様注意」。
3. 対応: `Phase-7-4.md`の申し送り5点・`appendix/stage3-requirements-organization.md`診断3・移植元エンジン`engine.py`全文を2エージェントで横断調査してから設計に入った。
4. ユーザー確認: 移植元のlane/row前提(lane=AI出力のlayer/actor等)に対し、`ErElement`には`layer`が無くER図はモジュール依存・時系列を表す図ではない。Phase 9のレイアウトエンジンをER図にも適用する場合、laneの割り当てをどうするか。
5. ユーザー選択: 「ER図は単純なフォールバック値で同じエンジンに乗せる」(推奨)。`lane=0`固定・`row`=定義順indexという機械的なフォールバックに決定した。詳細は[`Phase-9-1.md`](./Phase-9/Phase-9-1.md)参照。

### Phase 9 ── 移植元プロジェクト名の除去

1. Phase 9
2. ユーザー指示: 移植元の別プロジェクト名はこのアプリケーションと直接関係が無いので使わないでほしい。
3. ユーザー選択: 除去範囲は全ファイル(教材・samples・devex-api本体・docs・decision digest・本ログ・appendixの調査記録・`.gitignore`)。出自は「別プロジェクトの自作図生成エンジンから移植」という一般名の1行だけにする。
4. 対応: パス・commitハッシュ・移植元のメソッド名による対比は削除し、設計判断はdevex単体の理由として書き直した。どうしても触れる必要がある箇所だけ「移植元エンジン」と呼ぶ。appendix D3の決定文も「コピー + 出自を一般名で明記」に更新した。

### Phase 9 ── 製図処理へのライブラリ適用の検討

1. Phase 9
2. ユーザー質問: 製図に使う処理をライブラリ(例: networkx)で簡略化できないか。ただし、networkxは以前、自作DFSより消費メモリが多かった経験がある。その点も含めて検討したい。
3. 回答: `app/uml/layout/`の各処理を評価した結果、採用したのは標準ライブラリ`graphlib.TopologicalSorter`だけ(`ranking.py`のKahnループを置き換え)。ランダムな2000グラフ(n≦30、循環あり)で結果が完全一致。計測(tracemallocのピーク値): 手書き版 約12KB / `graphlib`版 約16KB / networkx は`import`だけで約17.8MB(初回約2.7秒)、構築+計算で約52KB。networkxは置き換えられる量が`graphlib`と同じなので不採用。back edge検出は`dfs_labeled_edges`がback edgeを区別しないため自作DFSのまま。経路探索・仕上げ処理(graphviz/grandalf/libavoid)と線分判定(shapely)は、前提(レーン×行の格子・独自の許容誤差)に合わないので不採用。
4. 対応方針: samples・devex-api本体の`ranking.py`を更新(samplesは#29の`Phase-9-1：更新`タグ付き)。評価の表は[`Phase-9-1.md`](./Phase-9/Phase-9-1.md)「ライブラリ適用の検討」節。decision digestへの要約はPhase 9完了時に行う(#24)。
