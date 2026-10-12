[← README.md](../README.md)

# 実装計画書：Devex

本実装計画書は、提示された[要件定義書](requirements.md)および[内部設計書](internal_design.md)に基づき、システム開発プロジェクト「Devex」を安全、確実、かつ効率的に推進するためのロードマップを定義するものである。

---

## 4.1 開発ステージ分割・マイルストーン

プロジェクトの確実な立ち上げとリスク最小化のため、機能を段階的にリリースする7ステージの開発アプローチを採用する(ステージ8以降の構想は[`appendix/devex_roadmap.md`](../appendix/devex_roadmap.md)。各ステージの着手時にここへ書き写す)。

> 用語注記: 本節の「ステージ」はプロダクトのリリース単位を指す。CL(Curriculum Loop)開発における教材単位「Phase」とは別軸の概念であり、混同を避けるためリネームした(詳細は `CLAUDE.md`「進行のルール」#27参照)。

### ステージ1：MVP（最小実用製品）開発 ── 【最優先・Must have】

* **目的**: コア機能である「チャットによるヒアリング」「LangChainを用いた4種のMarkdown設計書自動生成」「結果のプレビュー・保存」の動作をエンドツーエンドで検証する。
* **対象機能**:
  * ユーザー認証（JWTによる登録・ログイン）
  * プロジェクト管理（作成、一覧・詳細取得）
  * 初期ヒアリング添付ファイル(txt/Markdown/PDF、最大3ファイル)の読み込み
  * チャット機能（FastAPI + LangChainによる対話、ストリーミング応答）
  * 設計書一括生成機能（バックグラウンド処理による4種のMarkdown生成）
  * ドキュメント閲覧・コピー・ダウンロード機能
  * PostgreSQLによるデータ永続化
* **マイルストーン1**: バックエンドのLLM連携とフロントエンドのチャットUI結合完了（Week 3）
* **マイルストーン2**: MVPリリース・社内/個人検証開始（Week 5）

### ステージ2：機能拡張・品質向上 ── 【Should have】

* **目的**: ユーザビリティの向上および、将来的な運用・拡張を見据えた機能の実装。
* **対象機能**:
  * 生成されたドキュメントのバージョン管理・履歴保持 (`generated_documents` のバージョンインクリメント。増分+直近3件保持の機構自体はMVPで実装済みのため、Should have分は履歴閲覧・比較・復元UI(SCR-006)の新設を指す。[内部設計書](internal_design.md) 3.2節参照)
  * プロンプトテンプレートの選択機能（Webアプリ向け、API向けなど、`prompt_templates` の適用。`projects.template_id`でサーバー側に永続化し、ヒアリングのシステムプロンプトへ合流させる。[内部設計書](internal_design.md) 3.2節・3.3節参照）
  * エラーハンドリングの堅牢化、ログの構造化・監視強化（共通エラーレスポンス形式自体はMVPで実装済み。Should have分は`structlog`による構造化ログ・プロンプト本文を含めないプライバシー配慮・Sentryによるエラー追跡/外部アップタイム監視の追加を指す。[内部設計書](internal_design.md) 3.4節参照）
* **マイルストーン3**: ステージ2機能実装完了および安定化（Week 7）

### ステージ3：UML設計図パイプライン ── 【Could have】

> **[Phase 24 で確定 ── 〈簡易ドキュメントモードの設計図(SCR-007)を提供しない〉]** 当初〈簡易ドキュメントモードの4文書生成の後に「設計図を生成する」から、内部設計書を入力にコンポーネント図・ER図・DFDを生成し、承認した図を内部設計書へ差し込む(ステージ3、Phase 7〜13)〉→ 撤回。理由〈詳細設計モード(ステージ4)が、段階2〜4で同じ図(DFD・ER・構成図)を段階の入力から作り、承認して詳細設計書に載せるようになったため、簡易モードからの設計図の作成は不要になった(Phase 24 完了後のユーザーの決定)。画面(SCR-007)・生成と履歴の API(`POST /uml/diagrams`・`/candidates`・`/generation-runs`)・内部設計書への反映(`/reflect`・`/embeds`・`/bundle`)を削除した。図の編集・検証・自動レイアウト・承認・出力の API とデータ辞書は、詳細設計モードが使うので残す。DB の`uml_generation_runs`テーブルと`uml_diagrams.scope`列は、既存のデータを残すため消していない。以前に図を反映した内部設計書のアンカー(HTML コメント)は、プレビューでは表示しない〉。


* **目的**: 承認済みの4文書からAIがUML意味モデル(JSON)を生成し、Web上でレビュー・修正した上でdraw.io/SVG形式へ出力する。生成した図と要素表を内部設計書へ差し込み、詳細設計の理解を補完する(自動コーディングはスコープ外のまま。[要件定義書](requirements.md) 1.3節参照)。
* **対象Phase**(CL開発の教材単位。詳細は`textbook/Phase-7/`以降、`appendix/stage3-requirements-organization.md` 7節参照):
  * Phase 7: 設計フェーズ(仕様診断・図↔文書対応表(D5)の確定・スパイク・docs反映。実装なし)
  * Phase 8: 意味モデル(Pydantic)・データ辞書・`uml_diagrams`・CRUD/validate API(component/ER/DFD)
  * Phase 9: レイアウトエンジン移植・レーン/行割り当て・`/layout` API
  * Phase 10: AI生成(構造化出力)・内部設計書プロンプトへの「処理別データフロー」節追加
  * Phase 11: フロントエンド(Adapter・React Flowプレビュー/編集)
  * Phase 12: 承認フロー・draw.io/SVG出力・ダウンロード
  * Phase 13: 内部設計書への図による補完の埋め込み・アンカー導入・陳腐化検知
  * Phase 13b: 図の手直しのAI修正案・差分レビューUI・承認反映
  * Phase 14: アクティビティ図追加・統合/E2E/デプロイ確認

  > **[Phase 14 で確定 ── 〈Phase 13b・旧Phase 14を実施しない〉]** 当初〈Phase 13bで図の手直しを散文へ戻すAI修正案(M9b)を、Phase 14でアクティビティ図・統合/E2E/デプロイ確認を行う予定〉→ 撤回。理由〈Phase 13完了後の相談で「詳細設計モード」(ステージ4)の構想が出た。詳細設計モードでは文書を承認済みの意味モデルから組み立てるため、散文へ戻す修正案(M9b)はほぼ不要になる。ステージ3はPhase 13で終了とし、M9bとアクティビティ図は未達のまま撤回した。「Phase 14」の番号はステージ4の要件定義フェーズに充てる。経緯は[`textbook/Phase-14/Phase-14-1.md`](../textbook/Phase-14/Phase-14-1.md)参照〉。

* **マイルストーン4**: UML設計図パイプラインのMVP(component/ER/DFDの生成・レビュー・draw.io出力)完了。
  * **達成範囲(Phase 13で終了)**: component/ER/DFDのAI生成・レビュー/編集・自動レイアウト・承認・draw.io/SVG出力、内部設計書への図の反映(要素表・プレビューへのSVG差し込み)・陳腐化検知・zipダウンロードまで。図の手直しの散文への反映(M9b)とアクティビティ図は未達(撤回)。統合/E2Eとデプロイでの確認は、ステージ4の実装と合わせて行う。

### ステージ4：詳細設計モード ── 【Could have】

* **目的**: 要件定義・外部設計の後に、段階ごとに人が承認しながら詳細設計書を組み立てる「詳細設計モード」を増設する。現行の4文書一括生成は「簡易ドキュメントモード」としてそのまま残す。実務の詳細設計(C4・arc42・日本の詳細設計の成果物)に構成を合わせ、人がコーディングするのに十分な資料をシステムが作ることを目指す(AIによる自動コーディングは理想形であり、要件ではない)。構想は[`appendix/detailed-design-mode-organization.md`](../appendix/detailed-design-mode-organization.md)参照。
* **段階**: 1 機能(処理)一覧 → 2 機能グループごとのDFD・データ辞書・処理概要表 → 3 ER・テーブル定義・CRUD図 → 4 構成図(層)+モジュール一覧 → 5 選んだ処理の番号付き手順 → 6(任意)選んだ関数の処理ロジックの詳細 → 7 横断事項と実装計画(Phase 23で改称)。各段階は人が承認してから次の段階の入力にする([内部設計書](internal_design.md) 3.3節「4. 詳細設計モード」参照)。
* **対象Phase**(暫定。各Phaseの着手時に見直す。Phaseごとの成果物・依存関係・再利用するステージ3の資産は[`textbook/Phase-14/Phase-14-4.md`](../textbook/Phase-14/Phase-14-4.md)参照):
  * Phase 14: 要件定義フェーズ(仕様診断・05/06章の表現と出力形式の確定・docs反映。実装は見せ方を確かめるデモページのみ)
  * Phase 15: モードと段階の土台+既存機能の修正(モード選択ダイアログと`projects.mode`・モードごとの生成・`design_stages`・段階の承認と陳腐化・SCR-008の骨格、簡易ドキュメントモードの内部設計書へのモジュール一覧表、出力見本の気づき#1〜#10の修正と自動レイアウトの高速化) ── **完了**([`textbook/Phase-15/Phase-15-introduction.md`](../textbook/Phase-15/Phase-15-introduction.md))
  * Phase 16: 段階1 機能一覧(外部設計書へのAPI一覧の追加、処理IDの採番と引き継ぎ、機能グループの初期値、段階ごとの検証、AIの下書きの生成、機能一覧の編集画面) ── **完了**([`textbook/Phase-16/Phase-16-introduction.md`](../textbook/Phase-16/Phase-16-introduction.md))
  * Phase 17: 段階2 データフロー(機能グループごとのDFD・データ辞書・処理概要表、DFD・データ辞書の編集による段階2の差し戻し) ── **完了**([`textbook/Phase-17/Phase-17-introduction.md`](../textbook/Phase-17/Phase-17-introduction.md))
  * Phase 18: 段階3 データモデル(ER・テーブル定義・CRUD図、ER の編集による段階3の差し戻し) ── **完了**([`textbook/Phase-18/Phase-18-introduction.md`](../textbook/Phase-18/Phase-18-introduction.md))
  * Phase 19: 段階4 ソフトウェア構造(構成図(層)・モジュール一覧、構成図の編集による段階4の差し戻し) ── **完了**([`textbook/Phase-19/Phase-19-introduction.md`](../textbook/Phase-19/Phase-19-introduction.md))
  * Phase 20: 段階5 主要処理の手順(処理の選択・処理ごとの下書き・索引・関与表・タブ。レビュー画面はPhase 14のデモの見せ方を採用) ── **完了**([`textbook/Phase-20/Phase-20-introduction.md`](../textbook/Phase-20/Phase-20-introduction.md))
  * Phase 21: 段階6 処理ロジックの詳細(05の手順から選んだ関数・関数ごとの下書き・呼ばれる手順・逆引き・05↔06のバッジによる段階をまたぐ移動、段階6を飛ばす操作(0件で承認)) ── **完了**([`textbook/Phase-21/Phase-21-introduction.md`](../textbook/Phase-21/Phase-21-introduction.md))
  * Phase 22: 詳細設計書の組み立てと出力(01〜06章のHTML+md+図のzip、未承認の章と「06 省略」、SCR-008のダウンロード) ── **完了**([`textbook/Phase-22/Phase-22-introduction.md`](../textbook/Phase-22/Phase-22-introduction.md))
  * Phase 23: 段階7 横断事項と実装計画(生成・検証・作業領域、07章、zip の実装計画) ── **完了**([`textbook/Phase-23/Phase-23-introduction.md`](../textbook/Phase-23/Phase-23-introduction.md))
  * Phase 24: 統合/E2E・デプロイでの確認(偽LLMの段階1〜7の契約テスト、詳細設計モードのE2E、簡易モードのE2Eの修復、マイグレーションを先に流す自動デプロイの順序、ステージ3・4の本番反映の手順) ── **完了**([`textbook/Phase-24/Phase-24-introduction.md`](../textbook/Phase-24/Phase-24-introduction.md))。本番での確認はユーザーの実施待ち
  * (Phase 16の着手時に段階1と段階2を、Phase 20の着手時に段階5と段階6を、Phase 22の着手時に組み立て・段階7・統合/E2Eを別のPhaseに分け、そのたびに以降の番号を送った)
* **マイルストーン5**: 詳細設計モードで、段階1〜6を承認して詳細設計書(HTML+md)をダウンロードできる。(Phase 22で達成)
  * **達成範囲(Phase 24で終了)**: 段階1〜7(段階7 横断事項と実装計画はPhase 23)と、詳細設計書・実装計画の zip。Phase 24で、段階1〜7 → zip を偽LLMのE2E(Playwright)で通しで確かめた。本番への反映は[`devex-api/OPERATIONS.md`](../devex-api/OPERATIONS.md) 10節の手順による。

### ステージ5：実装手順書 + 実装可能性チェック ── 【Could have】

* **目的**: 実装計画・詳細設計から、開発者(人または AI Coding Agent)が実際に作業できる実装手順書を作る。その過程で、設計が実装できる状態かを検証し、不足・矛盾を表に出す(実装できない設計を、実装に入る前に見つける)。見つかった不足は、ステージ6(ヒアリング改良)の材料にする。方針は[`appendix/devex_implementation_procedure_guideline.md`](../appendix/devex_implementation_procedure_guideline.md)、構想の中の位置は[`appendix/devex_roadmap.md`](../appendix/devex_roadmap.md)。
* **方針(Phase 25で確定)**: 段階7のタスクを機能ごとの縦割り・ID 付きに改め、手順書の作業単位にする。手順書は詳細設計モードの段階8。設計は ID で参照して書き写さない。未定義は検証と AI の指摘の2層で出し、対象の段階で直す。段階5の手順から読み取り専用のシーケンス図を導く。簡易ドキュメントモードは後半で同じ形にする([外部設計書](external_design.md) 2.8節、[内部設計書](internal_design.md) 3.3節「5. 実装手順書」)。
* **対象Phase**(暫定。各Phaseの着手時に見直す。Phaseごとの成果物・依存関係は[`textbook/Phase-25/Phase-25-4.md`](../textbook/Phase-25/Phase-25-4.md)参照):
  * Phase 25: 要件定義フェーズ(仕様診断・手順書の見本とデモ・シーケンス図の判断・docs反映・ステージ5の実装計画) ── **完了**([`textbook/Phase-25/Phase-25-introduction.md`](../textbook/Phase-25/Phase-25-introduction.md))
  * Phase 26: 段階7の改修(縦割りの単位・ID・依存・ファイルの欄の分離と検証・プロンプト・作業領域・実装計画の出力・既存データの扱い・段階7の入力の大きさの計測) ── **完了**([`textbook/Phase-26/Phase-26-introduction.md`](../textbook/Phase-26/Phase-26-introduction.md))
  * Phase 27: 段階8の土台と決定的な実装可能性チェック(段階8・参照の導出と解決・検証・SCR-008 の単位の一覧と未定義の一覧) ── **完了**([`textbook/Phase-27/Phase-27-introduction.md`](../textbook/Phase-27/Phase-27-introduction.md))
  * Phase 28: 手順書の生成(参照の展開・単位ごとの AI の下書き・AI の指摘・単位の詳細の表示と編集・最重要が残るときの承認前の確認) ── **完了**([`textbook/Phase-28/Phase-28-introduction.md`](../textbook/Phase-28/Phase-28-introduction.md))
  * Phase 29: シーケンス図(段階5の行の種別・導出・05章と手順書への表示・スタブの候補の突き合わせ) ── **完了**([`textbook/Phase-29/Phase-29-introduction.md`](../textbook/Phase-29/Phase-29-introduction.md))
  * Phase 30: 手順書の出力(zip の`implementation_procedure/`・AI 向けの版・画面のコピー) ── **完了**([`textbook/Phase-30/Phase-30-introduction.md`](../textbook/Phase-30/Phase-30-introduction.md))
  * Phase 31: 簡易ドキュメントモードの手順書(実装計画書の WBS の縦割り・ID 付きの書式と決定的な解析・内部設計書からの参照・簡易モードの段階8・SCR-005 の入口) ── **完了**([`textbook/Phase-31/Phase-31-introduction.md`](../textbook/Phase-31/Phase-31-introduction.md))
  * Phase 32: 統合/E2E・デプロイでの確認(偽LLMの段階8と両モードの契約テスト・段階8の生成までの E2E と既存を含めた全 E2E・マイグレーションの往復・本番反映の手順) ── **完了**([`textbook/Phase-32/Phase-32-introduction.md`](../textbook/Phase-32/Phase-32-introduction.md))。本番への反映と本番での確認も完了(2026-10-08、問題なし)
* **マイルストーン6**: 詳細設計モードで、段階8の実装手順書を単位ごとに生成し、未定義を設計の側で直して、手順書を zip と AI 向けの版で出力できる。簡易ドキュメントモードでも同じ形の手順書を作れる。
* **達成範囲(Phase 32で終了)**: 段階8(両モード)の生成・検証・承認・zip・AI 向けの版と、段階5のシーケンス図。Phase 32で、偽LLMの段階8の出力が生成 → 承認 → 実装手順書の zip を通ることを両モードの契約テスト(ブラウザ無し)で固定し、E2E(Playwright)は両モードとも段階8の生成まで通した。本番への反映は[`devex-api/OPERATIONS.md`](../devex-api/OPERATIONS.md) 10.2節の手順による。

### ステージ6：ヒアリング改良 + 上流の構造化 ── 【Could have】

* **目的**: 聞き漏れを減らし、設計後の要件変更を減らす。セキュリティや非機能要件を、AI の推測に任せず、利用者の判断として引き出す。要件定義書・外部設計書を構造化して要件ID を振り、要件 → 処理 → 作業単位の追跡を上流までつなぐ。構想は[`appendix/devex_roadmap.md`](../appendix/devex_roadmap.md)。
* **出発点(Phase 33 のベースライン)**: 今の Devex を実際の LLM で段階8まで動かしたところ、両モードとも利用者の発言3回でヒアリングが完了し、非機能の観点はほとんど聞かれなかった。技術スタックも聞かれず、簡易モードでは技術スタックを AI が創作した。要件定義書の非機能・制約の記述の6〜7割は、利用者が言っていない内容だった([`appendix/stage6-baseline/`](../appendix/stage6-baseline/README.md)、[`textbook/Phase-33/Phase-33-1.md`](../textbook/Phase-33/Phase-33-1.md))。
* **方針(Phase 33で確定)**: ヒアリングの5条件を、観点の表(`hearing_points` テーブル。機能面の観点と IPA 非機能要求グレードの6大項目、規模で必須を切り替える)で置き換え、完了は「必須の観点がすべて未決以外」をコードが判定する。AI の問いは場面で聞く選択肢カードにし、選ぶと「AI の提案を採用」として記録する。要件定義書と外部設計書は意味モデルから組み立て、要件に ID(`FR-001`・`NFR-001`・`CON-001`)と出どころ(ユーザー・採用・推測)を持たせる。要件 → 処理は段階1の機能の`req_ids`、簡易モードは WBS の「要件」欄でつなぐ([外部設計書](external_design.md) 2.9節、[内部設計書](internal_design.md) 3.3節「6. ヒアリングと上流の構造化」。決定の経緯は[`textbook/Phase-33/Phase-33-2.md`](../textbook/Phase-33/Phase-33-2.md))。
* **対象Phase**(暫定。各Phaseの着手時に見直す。Phaseごとの成果物・依存関係・未確定事項は[`textbook/Phase-33/Phase-33-5.md`](../textbook/Phase-33/Phase-33-5.md)参照):
  * Phase 33: 要件定義フェーズ(ベースライン・仕様診断・見本とデモ・docs反映・ステージ6の実装計画) ── **完了**([`textbook/Phase-33/Phase-33-introduction.md`](../textbook/Phase-33/Phase-33-introduction.md))
  * Phase 34: 観点の表(`hearing_points`・観点の定義と規模の表・観点ごとの判定と決定的な完了判定・チャット画面の観点の表・既存プロジェクトの扱い) ── **完了**([`textbook/Phase-34/Phase-34-introduction.md`](../textbook/Phase-34/Phase-34-introduction.md))
  * Phase 35: 選択肢カード(場面で問う構造化した問い・カードの表示と選択・「採用」の記録) ── **完了**([`textbook/Phase-35/Phase-35-introduction.md`](../textbook/Phase-35/Phase-35-introduction.md))
  * Phase 36: 要件定義書のモデル化(要件の行・ID・出どころ・観点・md の組み立て・検証。両モード) ── **完了**([`textbook/Phase-36/Phase-36-introduction.md`](../textbook/Phase-36/Phase-36-introduction.md))
  * Phase 37: 外部設計書のモデル化(画面・API・外部連携の行と要件ID・本文の節・検証。両モード) ── **完了**([`textbook/Phase-37/Phase-37-introduction.md`](../textbook/Phase-37/Phase-37-introduction.md))
  * Phase 38: 要件 → 処理・作業単位(段階1の`req_ids`と検証・簡易モードの WBS の「要件」欄・手順書と詳細設計書の追跡表) ── **完了**([`textbook/Phase-38/Phase-38-introduction.md`](../textbook/Phase-38/Phase-38-introduction.md))
  * Phase 39: 効果測定(ベースラインと同じペルソナ・規則で、実際の LLM で両モードを流して比べる。聞けた潜在の事実 0〜1/14 → 10/14、要件の非機能・制約の推測 6〜7割 → 0。測定で見つけた判定の取りこぼし・規模と技術スタックの推し量り・認証の聞き漏れを直して再測定) ── **完了**([`textbook/Phase-39/Phase-39-introduction.md`](../textbook/Phase-39/Phase-39-introduction.md)、[`appendix/stage6-effect/`](../appendix/stage6-effect/README.md))
  * Phase 40: 統合/E2E・デプロイでの確認(Phase 39 の測定で見つけた小さな不具合の直し・偽LLMのヒアリングから2文書の model までの契約テスト・カードと「採用にする」を足した E2E と既存を含めた全 E2E・マイグレーションの往復・本番反映の手順) ── **完了**([`textbook/Phase-40/Phase-40-introduction.md`](../textbook/Phase-40/Phase-40-introduction.md))
* **マイルストーン7**: ヒアリングが観点の表で進み、必須の観点が決まるまで完了しない。要件定義書・外部設計書の要件・画面・API に ID と出どころがあり、要件から作業単位までをたどれる。ベースラインと比べて、聞けた事実が増え、要件の「推測」が減ったことを数字で示せる。(Phase 39で達成)
* **達成範囲(Phase 40で終了)**: 観点の表と決定的な完了判定、選択肢カード、要件定義書・外部設計書の意味モデル(要件ID・画面ID・出どころ・検証)、要件 → 処理・作業単位の追跡、効果測定(ベースラインと比べた数字)。Phase 40で、偽LLMの判定・カード・2文書の出力が観点の取り込み・完了判定・組み立てと検証・「採用にする」を通ることを契約テスト(ブラウザ無し)で固定し、E2E(Playwright)は規模のカードを選ぶ操作と「採用にする」を足して、既存を含めた全 E2E を通した。聞かれない潜在の事実(バックアップ・ログの本文・不正利用・削除)は残る。本番への反映は[`devex-api/OPERATIONS.md`](../devex-api/OPERATIONS.md) 10.3節の手順による。

### ステージ7：変更影響分析・変更管理 ── 【Could have】

* **目的**: 設計を「作る」だけでなく「変更に強くする」。ある要素を変えたときに見直しが要る要素を示し、陳腐化を段階単位から要素単位へ細かくする。再生成の候補を示す。構想は[`appendix/devex_roadmap.md`](../appendix/devex_roadmap.md)。
* **出発点(Phase 41 のベースライン)**: 決まった変更シナリオ(S1〜S8)で、今の段階単位の陳腐化が示した要素の 87% は見直し不要だった(見落としは2件 ── 同じ段階の中の依存と文書の中の画面)。ID のグラフを直接だけたどると見落とし21、全部たどると過剰 71%。処理を軸にたどる試案は過剰 43%・見落とし10(うち6は非機能要件から先の辺が無いため)で、後から決めたシナリオ(N1〜N4)でも同じ傾向だった([`appendix/stage7-baseline/`](../appendix/stage7-baseline/README.md)、[`textbook/Phase-41/Phase-41-1.md`](../textbook/Phase-41/Phase-41-1.md))
* **方針(Phase 41で確定)**: 「処理を軸」のたどり方(改名は直接の参照元だけ、理由は参照の種類からシステムが書き LLM は使わない)。段階は直前の承認の写しと、文書は前の版の model と比べて変わったものを求める。段階の「古い」は残し、その中の要素に印を付けて「確認済み」にしていく。横断事項に要件ID、作業単位に安定キー。簡易モードは内部設計書・実装計画書も意味モデルにする。あわせて、ヒアリングで聞かれない側面(L2・L5・L6・L14)と段階3・5 の書き落としを直す([外部設計書](external_design.md) 2.10節、[内部設計書](internal_design.md) 3.3節「7. 変更影響分析・変更管理」)。
* **対象Phase**(暫定。各Phaseの着手時に見直す。Phaseごとの成果物・依存関係・未確定事項は[`textbook/Phase-41/Phase-41-5.md`](../textbook/Phase-41/Phase-41-5.md)参照):
  * Phase 41: 要件定義フェーズ(ベースライン・仕様診断・見本とデモ・docs反映・ステージ7の実装計画) ── **完了**([`textbook/Phase-41/Phase-41-introduction.md`](../textbook/Phase-41/Phase-41-introduction.md))
  * Phase 42: 要素のグラフと影響のたどり方(詳細設計モード。横断事項の要件ID・作業単位の安定キーを含む) ── **完了**([`textbook/Phase-42/Phase-42-introduction.md`](../textbook/Phase-42/Phase-42-introduction.md))
  * Phase 43: 承認時の写しと要素単位の陳腐化(差分・見直しの印・確認済み・承認し直し) ── **完了**([`textbook/Phase-43/Phase-43-introduction.md`](../textbook/Phase-43/Phase-43-introduction.md))
  * Phase 44: 影響の画面(作業領域のパネル・各段階の表の印・行の強調・再生成の候補) ── **完了**([`textbook/Phase-44/Phase-44-introduction.md`](../textbook/Phase-44/Phase-44-introduction.md))
  * Phase 45: 簡易モードの文書のモデル化(内部設計書・実装計画書の model と検証) ── **完了**([`textbook/Phase-45/Phase-45-introduction.md`](../textbook/Phase-45/Phase-45-introduction.md))
  * Phase 46: 簡易モードの変更の影響(段階8の単位の印) ── **完了**([`textbook/Phase-46/Phase-46-introduction.md`](../textbook/Phase-46/Phase-46-introduction.md))
  * Phase 47: ヒアリングの側面(L2・L5・L6・L14)と判定のゆらぎ ── **完了**([`textbook/Phase-47/Phase-47-introduction.md`](../textbook/Phase-47/Phase-47-introduction.md))
  * Phase 48: 段階3・5 の書き落とし(CRUD の下書きと DFD の食い違い・分岐の行) ── **完了**([`textbook/Phase-48/Phase-48-introduction.md`](../textbook/Phase-48/Phase-48-introduction.md))
  * Phase 49: 効果測定(ベースラインと同じシナリオ・ヒアリングはステージ6のペルソナで複数回。基準(過剰 ≤ 35%・見落とし S ≤ 5 / N ≤ 1)に届かず、差分の再生成・単位のキーの引き継ぎ・たどり方を直して再測定: シナリオ S 過剰 22%・見落とし 2、N 過剰 23%・見落とし 0、別のプロジェクトの再生成で揺れの印 0) ── **完了**([`textbook/Phase-49/Phase-49-introduction.md`](../textbook/Phase-49/Phase-49-introduction.md)、[`appendix/stage7-effect/`](../appendix/stage7-effect/README.md))
  * Phase 50: 統合/E2E・デプロイでの確認(偽LLMの変更の影響の契約テスト・変更の影響の流れを足した E2E と既存を含めた全 E2E・マイグレーションの往復・本番反映の手順・「開発用」メニューを外す) ── **完了**([`textbook/Phase-50/Phase-50-introduction.md`](../textbook/Phase-50/Phase-50-introduction.md))
* **マイルストーン8**: 設計の要素を変えると、見直しが要る要素が理由つきで示され、段階の「古い」の中で要素を確認していける。ベースラインと比べて、示す要素の過剰が減り、見落としが増えていないことを数字で示せる。(Phase 49で達成)
* **達成範囲(Phase 50で終了)**: 要素のグラフと「処理を軸」のたどり方(理由はシステムが書く)、承認時の写しと文書の版の model の差分から付ける見直しの印・確認済み・承認し直しの条件、作業領域の「変更の影響」パネルと各段階の表の印・再生成の候補、簡易モードの内部設計書・実装計画書の意味モデルと段階8の単位の印、差分の再生成と単位の安定キー、ヒアリングの側面(データの保全・保持と削除・ログ・不正利用)、段階3・5 の書き落としの直し、効果測定(ベースラインと比べた数字)。Phase 50で、偽LLMの出力が写し・差分・印・確認済み・承認し直しと、同じ出力での再生成(印が増えない)を通ることを契約テスト(ブラウザ無し)で固定し、E2E(Playwright)は段階1を直して承認し直し、下流の印を確認済みにして承認し直す流れを足して、既存を含めた全 E2E を通した。共有のモジュールの中で「どれを直すか」と、非機能要件から横断事項の対象を使う手順まで(シナリオ S2)は示さない。本番への反映は[`devex-api/OPERATIONS.md`](../devex-api/OPERATIONS.md) 10.4節の手順による。

---

## 4.2 タスク分解（WBS案）

プロジェクト全体を5つのカテゴリに分割し、詳細なタスクを定義する。

### 1. 要件確認・環境構築タスク

* [ ] プロジェクトキックオフ、要件および内部設計の確認
* [ ] Gitリポジトリ構成の確認: `devex-api`（バックエンド）・`devex-ui`（フロントエンド）の独立2リポジトリ構成を正とする(モノレポ化はしない)
* [ ] Docker / Docker Compose環境構築（Next.js, FastAPI, PostgreSQLのコンテナ連携確認）
* [ ] 外部API（OpenAI等）のAPIキー取得および環境変数（`.env`）の管理方針策定

### 2. バックエンド開発タスク（FastAPI + LangChain）

* [ ] **データベース設計・マイグレーション実装**: SQLAlchemy / Alembicを用いたテーブル（`users`, `projects`, `chat_histories`, `generated_documents`, `prompt_templates`）の構築
* [ ] **認証基盤の実装**: JWT発行・検証ミドルウェア、パスワードハッシュ化 (`auth/register`, `auth/login`)
* [ ] **プロジェクト・チャットAPI実装**:
  * プロジェクトCRUD API
  * 初期ヒアリング添付ファイルのテキスト化処理実装(`txt`/`md`は直接読み込み、`pdf`は既存のGemini連携を流用してテキスト化。`intake_files`への永続化)
  * チャットメッセージ送受信・LangChainメモリ連携・ストリーミング応答（SSE）ロジック (`chat_service.py`)
* [ ] **ドキュメント生成AIロジック実装**:
  * チャット履歴をコンテキストとした4種設計書生成ロジック (`doc_generator_service.py`)
  * バックグラウンドタスク（BackgroundTasks）による非同期生成処理の実装
* [ ] **ドキュメント閲覧・エクスポートAPI実装**: ドキュメント取得・ダウンロード用エンドポイント
* [ ] **共通エラーハンドリング・ログ出力実装**: グローバル例外ハンドラ、JSON構造化ログの導入

### 3. フロントエンド開発タスク（Next.js）

* [ ] **プロジェクト初期設定・ルーティング設計**: Next.js (App Router) のレイアウト、Tailwind CSS等によるスタイリング基盤構築
* [ ] **認証画面の実装**: 新規登録画面、ログイン画面、JWTのクライアント側保持（Cookie/LocalStorage）と認可ガード
* [ ] **ダッシュボード画面の実装**: プロジェクト一覧表示、新規プロジェクト作成モーダル
* [ ] **チャットヒアリング画面の実装**:
  * リアルタイムに近い対話UI、メッセージのストリーミング表示対応
  * 初期ヒアリング入力へのファイルアップロードUI実装(最大3ファイル、対応形式はtxt/Markdown/PDFのみ明示、Word/Excel/PowerPoint非対応の案内、エラー表示)
  * ヒアリング完了・生成トリガーボタンの実装
* [ ] **ドキュメントプレビュー・エクスポート画面の実装**:
  * 4種のMarkdownタブ切り替え表示、プレビューエリア（Markdownレンダラー）
  * クリップボードへのコピー機能、ファイルダウンロード機能

### 4. 統合テスト・品質保証タスク

* [ ] **バックエンド単体テスト**: Pytestを用いたAPIエンドポイントおよび各サービスのモックテスト
* [ ] **フロントエンド単体・コンポーネントテスト**: 主要UIコンポーネントの動作確認
* [x] **E2E（エンドツーエンド）テスト**: 「ログイン ➔ プロジェクト作成 ➔ チャットヒアリング ➔ 設計書生成 ➔ ダウンロード」の一連のフロー検証(Phase 4で簡易モード、Phase 24で詳細設計モードの段階1〜7 → zip を追加し、壊れていた簡易モードも修復。Phase 32で両モードの段階8の生成まで延長)
* [ ] **パフォーマンス・セキュリティ確認**: LLM呼び出しタイムアウト時の挙動確認、SQLインジェクションや不正アクセス対策のレビュー

### 5. デプロイ・運用準備タスク

* [ ] 本番環境用Dockerイメージのビルド最適化（マルチステージビルド等）
* [ ] クラウドインフラ（例: Render, AWS, Fly.io等）へのデプロイ検証
* [ ] 運用マニュアル・READMEの整備

---

## 4.3 開発環境・CI/CD・事前準備事項

### 1. 開発に必要なツール・ライブラリ

* **バージョン管理**: GitHub
* **コンテナ技術**: Docker / Docker Compose
* **バックエンド**: Python 3.11+, FastAPI, LangChain, OpenAI SDK, SQLAlchemy, Alembic, Pydantic(初期ヒアリング添付ファイルのテキスト化は既存のGemini連携を流用するため、PDF/Office解析用の新規ライブラリは追加しない)
* **フロントエンド**: Node.js (LTS), Next.js (App Router), TypeScript, Tailwind CSS, Markdownビューアライブラリ
* **データベース**: PostgreSQL 15+

### 2. リポジトリ構成

バックエンドとフロントエンドは、**モノレポではなく独立した2つのgitリポジトリ**で管理する(現行構成を正とする):

```text
devex/                    # 本リポジトリ(仕様書・進行ルールのみ。コードは持たない)
├── README.md / docs/     # 要件定義・外部設計・内部設計・実装計画
├── CLAUDE.md             # 進行ルール
├── textbook/             # CL開発教材
├── devex-api/            # 独立git repo: FastAPI + LangChain バックエンド
│   ├── backend/app/      # 内部設計に準拠したソースコード
│   ├── backend/tests/    # Pytest
│   └── Dockerfile
└── devex-ui/              # 独立git repo: Next.js フロントエンド
    ├── src/               # Next.js App Router構成
    └── package.json
```

各リポジトリの`docker compose up`をローカルで併用して起動する(`devex-ui`は`NEXT_PUBLIC_API_URL`経由で`devex-api`を参照する。詳細は`CLAUDE.md`「Working across the two repos」参照)。ルートに共有のbuild script・CI設定は置かない。

### 3. 自動テスト・CI/CD方針

* **GitHub Actionsを活用したCIパイプライン**:
  * プルリクエスト作成時およびmainブランチへのマージ時に自動実行。
  * バックエンド: `flake8 / black`（コードフォーマット・静的解析）および `pytest`（単体テスト）。
  * フロントエンド: `npm run lint` および `npm run build`（ビルドエラー検知）。
* **デプロイ方針（MVP段階）**:
  * Dockerコンテナをベースに、主要なクラウドホスティングサービスへ手動またはシンプルなWebhookによる自動デプロイから開始する。

---

## 4.4 想定リスクと対策（トレードオフ・後回し候補）

プロジェクト推進にあたって想定されるリスクと、その具体的な対策・トレードオフ方針を以下に整理する。

### 1. 技術的リスク

* **リスク1: 外部LLM（Gemini Flash-Lite等）のAPI制限（Rate Limit）やレスポンス遅延**
  * *対策*: バックエンド側でリトライ処理（指数バックオフ）を実装する。また、ストリーミング応答（SSE）を適切に処理することで、ユーザー側の体感待ち時間を軽減する。
* **リスク2: 4種の設計書一括生成時のタイムアウトやメモリ枯渇**
  * *対策*: [内部設計書](internal_design.md)に示されている通り、FastAPIのBackgroundTasksを用いた完全な非同期処理とし、フロントエンド側はポーリングまたはSSEで進捗・完了通知を受け取るアーキテクチャを徹底する。
* **リスク3: LLM無料枠のトークン上限超過**
  * *対策*: 使用モデルはGemini Flash-Lite(無料プラン想定)であり、無料枠のトークン上限を超えると呼び出しがエラーになる。この失敗モードを想定内として扱い、`LLM_QUOTA_EXCEEDED`エラーコード([内部設計書](internal_design.md) 3.4)でハンドリングし、ユーザーには「本日の利用上限に達しました」等の分かりやすいメッセージを表示する。有料プランへの移行は本MVPのスコープ外とする。
* **リスク5: PDFアップロード時のLLM呼び出しによるクォータ消費・処理遅延**
  * *対策*: 初期ヒアリングの添付PDFはGeminiのネイティブなファイル理解でテキスト化するため、アップロードの都度LLM呼び出しを1回消費する(リスク3と同じクォータプール)。ファイル数上限(3件)・サイズ上限(1ファイル5MB)で呼び出し回数と処理時間を抑え、失敗時は`FILE_EXTRACTION_FAILED`としてヒアリング自体はブロックしない([内部設計書](internal_design.md) 3.4)。

### 2. スケジュール・スコープのトレードオフリスク

* **リスク4: 開発遅延発生時の対応方針（機能削減の優先順位）**
  * *トレードオフ策*: 
    * 納期遅延が危ぶまれた場合、**「ステージ2（Should have要件）」に含まれる機能のうちバージョン管理(SCR-006)・プロンプトテンプレート選択切り替え(SCR-003)を完全にカット**し、ステージ1（MVP）の必須機能にリソースを集中させる。エラーハンドリングの堅牢化・ログの構造化・監視強化は個人開発の運用継続に直結するため、上記2機能ほど優先度を下げず、可能な範囲で対応を継続する。
    * リアルタイムプレビュー（分割画面）などのCould have要件についても、通常のタブ切り替え式等への簡素化を即座に判断する。
