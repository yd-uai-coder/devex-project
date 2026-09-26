# Phase-0-5: 仕様診断への対応(12項目の決定)

設計フェーズの章のため、[CLAUDE.md](../../CLAUDE.md)「進行のルール」#13(全ファイル解説)・#14(SUT/ドライバ/スタブ)・#15(全ファイルimport)・#12(リファクタ追従)は対象外(#2 冒頭の規定どおり)。この章は #27 が定める Phase 0 の範囲「要件・設計の確認」に該当する。

## この章で作成・更新したファイル

- [`docs/implementation_plan.md`](../../docs/implementation_plan.md) — リポジトリ構成を実態(devex-api/devex-ui 2リポジトリ)に修正、LLMコスト超過リスクを追加。
- [`docs/internal_design.md`](../../docs/internal_design.md) — LLMプロバイダー(Gemini Flash-Lite)・SSE採用・JWT TTL/リフレッシュ方式を明記、`chat_histories.sender`を4値化、`generated_documents`バージョニング方針、`prompt_templates.default_environment`列、`doc_type`表記統一、`LLM_QUOTA_EXCEEDED`エラーコードを追加。
- [`docs/external_design.md`](../../docs/external_design.md) — システム構成図をSSE/Geminiに更新、SCR-004にヒアリング完了判定基準・文字数上限・テンプレート環境設定プリフィルを追記。
- [`docs/requirements.md`](../../docs/requirements.md) — アクセシビリティ非機能要件を全画面に一般化、LLMプロバイダー制約を明記。

## 決定内容の要点

Phase 1着手前の仕様診断([Phase-0-4](./Phase-0-4.md)完了後に実施)で洗い出した12項目について、ユーザーから全項目の決定を得た。うち3項目(ストリーミング方式・アクセシビリティ・JWT)は「Claudeから提案してほしい」との指示があったため、トレードオフ比較や既存devex-uiパターンの調査結果に基づき提案し、採用された。

決定の全文は[`decision-digest.md`](../decision-digest.md)の該当節を参照。特に以下2点は今後の作業で参照頻度が高いため強調する:

- **リポジトリ構成**: モノレポ案は破棄し、既存の`devex-api`/`devex-ui`独立2リポジトリ構成が正式に確定した。Phase 1(環境構築)の最初のタスクはこれを前提に進める。
- **JWT仕様の将来的なテンプレート化**: 今回決定したJWT仕様(アクセストークン30分/リフレッシュトークン14日/httpOnly Cookie/サイレントリフレッシュ)は、Devexプロジェクト完了後に`devex-api`/`devex-ui`のデフォルト仕様として反映する候補とした(今回はテンプレートリポジトリ自体は変更しない)。詳細は[`retrospective-memo.md`](../retrospective-memo.md)「`[テンプレート反映候補]` JWT仕様」参照。

## テスト観点

該当なし(設計フェーズのため #14 対象外。ドキュメント更新のみでコードは生成していない)。
