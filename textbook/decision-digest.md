# 決定ダイジェスト

後の Phase に前向きに効く決定・知見だけを圧縮して記録する(#24)。詳細な経緯は [`q_a.md`](./q_a.md) を参照。**q_a.md と異なり、このファイルは進行中に能動的に参照する。**

追記は Phase 完了時にまとめて1回行う(#18・#24)。

## Phase 0

- [`CLAUDE.md`](../CLAUDE.md)「進行のルール」節に appendix原本の #1〜17 を転記し、本プロジェクト固有の #18〜27 を追加した。#1〜17 は今後も内容を変更しない(調整は #18 以降への追加で行う)。
- 納期モード(#21)を採用。ただしMVPコアループ(チャット↔4文書生成の中核)の章は常に学習モード固定。
- #26(md相互参照はリンクで明記)を追加。`textbook/`配下と`CLAUDE.md`からの`.md`参照は全てMarkdownリンクにする。
- #1の「Phase毎に教材フォルダ」は「Phase毎にフォルダを作成する」の意と解釈し直した(#6「各Phaseフォルダ直下」と整合)。教材ファイルは `textbook/Phase-<N>/` 配下に置く(`textbook/`直下にフラット配置しない)。Phase-0の教材を `textbook/Phase-0/` に移設済み。
- #27(Phase 0の役割定義、共通ルール候補)を追加。Phase 0の範囲を「ルール確定+ゴール策定」から「`README.md`/`docs/`配下を入力とした実装ロードマップの具体化」まで拡張した。Devex完成後は入力をDevex生成物に切り替える想定だが、詳細はDevex完成後の振り返りで具体化する(今は未確定)。
- 用語衝突を解消: [`docs/implementation_plan.md`](../docs/implementation_plan.md)の「フェーズ1/フェーズ2」を「ステージ1/ステージ2」にリネームした。以後「Phase」はCL開発の実装単位(`Phase-<N>`)専用の語。
- 実装ロードマップを確定([`docs/implementation_plan.md`](../docs/implementation_plan.md) 4.2 WBSの5区分に1:1対応): Phase 1=環境構築、Phase 2=バックエンド開発(2-1 DB移行〜2-5 エクスポート/エラーハンドリング)、Phase 3=フロントエンド開発(3-1〜3-3)、Phase 4=統合テスト・QA、Phase 5=デプロイ・運用準備。詳細は[`Phase-0/Phase-0-2.md`](./Phase-0/Phase-0-2.md)参照。旧決定「Phase 1=チャットヒアリングフロー設計」はPhase 2-3に位置づけ直した。

## Phase 0 ── 初期ヒアリング入力の設計(#27: 要件・設計の確認)

この作業は#27が定めるPhase 0の範囲(要件・設計の確認)内であり、Phase 1以降ではない。まだ「Phase 1を開始する」等の明示トリガーは行っていない(#5)。将来Phase 2-3(チャットヒアリングフロー)・Phase 3-2(チャットヒアリングUI)が読む [`docs/external_design.md`](../docs/external_design.md)・[`docs/internal_design.md`](../docs/internal_design.md) 自体を、Phase 0のうちに先行して更新した。詳細は[`Phase-0/Phase-0-3.md`](./Phase-0/Phase-0-3.md)参照。着手時に参照すること:

- 初期ヒアリング入力は「概要(必須・自由記述)」「実現したいこと(必須・自由記述、箇条書き強制なし)」「補足(任意・自由記述、旧サブ機能+その他を統合)」の3項目+折りたたみ式「環境設定(任意)」に簡略化した。理由: 初期入力段階で明確な設計・構想を求めすぎないため(ユーザー方針)。箇条書き化・機能提案はチャット側でAIが行う。
- 「言語→フレームワーク」の動的コンボボックスは devex-ui に前例がなくa11yリスクが高いため**採用しない**。フレームワークは言語ごとに `<fieldset><legend>` で静的グルーピングする静的チェックボックス群(`CheckboxGroupWithLabel`流用)にする。
- `projects` テーブルに `intake`(JSONB, NULL可)カラムを追加([`docs/internal_design.md`](../docs/internal_design.md) 3.2)。初期ヒアリング入力をそのまま保持する。
- AIが「十分な要件が揃った」と判断した後も即生成せず、構造化サマリを提示してユーザーの明示的な承認を得てから生成に進む([`docs/external_design.md`](../docs/external_design.md) 2.3、[`docs/internal_design.md`](../docs/internal_design.md) 3.3に明記)。
- devex-ui調査での既知ギャップ: `TokenInput`は非制御・aria-labelなし、`InputSuggest`は静的配列フィルタのみで非同期/AI連携なし、`aria-invalid`/`aria-describedby`/`role="alert"`/`aria-live`はリポジトリ全体で未使用。新規/改修コンポーネントでは必ず配線すること。

## Phase 0 ── ドキュメント構成の分割(README.md → docs/)

`README.md`に混在していた要件定義書・外部設計書・内部設計書・実装計画書を、Devex自身が生成する4ファイル構成([`docs/external_design.md`](../docs/external_design.md) 2.3節SCR-005参照)と揃えて`docs/requirements.md`/`docs/external_design.md`/`docs/internal_design.md`/`docs/implementation_plan.md`に分割した。`README.md`は概要+リンク表のみに縮小した。内部の節番号(1.1, 2.1, 3.1, 4.1…)は維持。詳細は[`Phase-0/Phase-0-4.md`](./Phase-0/Phase-0-4.md)参照。

## Phase 0 ── Phase 1着手前の仕様診断への対応(12項目)

Phase 1着手前にユーザーへ仕様診断を提示し、全12項目の決定を得た。詳細は[`Phase-0/Phase-0-5.md`](./Phase-0/Phase-0-5.md)参照。

1. **リポジトリ構成**: `devex-api`/`devex-ui`の独立2リポジトリ構成を正とする(モノレポ案は破棄)。[`docs/implementation_plan.md`](../docs/implementation_plan.md) 4.3.2に反映。
2. **ストリーミング方式**: SSE(Server-Sent Events)を採用(WebSocketは将来の双方向リアルタイム機能が必要になった場合に再検討)。
3. **初期ヒアリング入力の文字数上限**: システム概要=全角200文字、実現したいこと=全角80文字、補足=全角400文字。
4. **ヒアリング完了判定基準**: (1)目的・課題の明確化 (2)コア機能1つ以上を「誰が・何を・なぜ」で具体化 (3)想定ユーザー像の把握 (4)MVPスコープの認識合わせ (5)環境設定未入力時は技術的制約の確認、を満たしたら「十分」と判定。
5. **`generated_documents`バージョニング**: 再生成時は新バージョンを追加(上書きしない)。直近3バージョンまで保管し、4件目生成時に最古を削除。
6. **`chat_histories.sender`を4値に拡張**: `'user'`/`'ai'`/`'intake'`(初期ヒアリング入力の記録)/`'others'`(将来拡張用)。intakeは`sender='intake'`の行として明示的に永続化する。
7. **SCR-003↔SCR-004連携**: `prompt_templates`に`default_environment`(JSONB)を追加し、テンプレート選択時にSCR-004のintake環境設定へプリフィルする。
8. **LLMコスト超過リスク**: 使用モデルはGemini Flash-Lite(無料プラン)。トークン上限超過は`LLM_QUOTA_EXCEEDED`エラーコードでハンドリング。
9. **アクセシビリティの全画面適用**: SCR-004限定だった`aria-invalid`/`aria-describedby`/`role="alert"`等の方針を[`docs/requirements.md`](../docs/requirements.md) 1.5の非機能要件として全画面に一般化。
10. **JWT仕様**: アクセストークン30分・リフレッシュトークン14日・リフレッシュトークンはhttpOnly Secure Cookie・devex-ui既存`auth-store.ts`のサイレントリフレッシュパターンを流用。**将来への申し送り**: この仕様は別プロジェクトでも再利用する想定のため、Devexプロジェクト**完了後**に`devex-api`/`devex-ui`テンプレートリポジトリ側のデフォルト仕様として反映すること(今回はテンプレートリポジトリ自体は変更していない)。
11. **マイルストーン起算日**: 個人開発のため厳密には定めない(Week 3/5/7は目安のまま維持)。
12. **`doc_type`表記統一**: `'requirement'` → `'requirements'`に変更。

## Phase 0 ── 実装着手前の仕様診断を共通ルール化(#28)

上記の仕様診断(12項目)を一度限りのレビューで終わらせず、**Phase 0内で毎回行う共通ルール**として#28を新設した(ユーザー指示、#27と同様に将来のhandoff v2引き継ぎ候補)。Phase 1のトリガー前に、`docs/`配下4文書を対象に最重要/中程度/軽微の3段階で診断し、ユーザーが決定またはAIへの提案依頼を選べる運用とする。今回はルール新設のみで、追加の診断作業は行っていない。詳細は[`Phase-0/Phase-0-6.md`](./Phase-0/Phase-0-6.md)参照。

## Phase 0 ── 「生成ドキュメントの自己診断」をプロダクト要件化

#28(CL進行ルールとしての仕様診断)を、Devexというプロダクト自体の機能要件としても明示した(ユーザー指示、#25再帰検証ルールの直接的な適用例)。[`docs/requirements.md`](../docs/requirements.md) 1.4節Must haveに「ドキュメント自己診断機能」を追加: 4文書生成後、AIが不足・不明瞭な点を最重要/中程度/軽微の3段階で自己診断しチャットに提示する。診断結果は`chat_histories`の`sender='others'`行として記録する(既存の4値化で確保していた枠を具体的な用途に確定)。詳細は[`Phase-0/Phase-0-7.md`](./Phase-0/Phase-0-7.md)参照。
