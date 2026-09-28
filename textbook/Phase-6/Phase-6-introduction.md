# Phase 6 導入: ステージ2(機能拡張・品質向上)

## 目的

[`docs/implementation_plan.md`](../../docs/implementation_plan.md) 4.1節 ステージ2(Should have要件)を実装する: 生成ドキュメントのバージョン管理・履歴保持(SCR-006)、プロンプトテンプレートの選択機能(SCR-003)、エラーハンドリングの堅牢化・ログの構造化・監視強化の3機能。

Phase 1〜5(ステージ1/MVP)は完了・実VPSデプロイまで確認済み。ステージ2はMVPからの連番でPhase 6からスタートする([`Phase-0-2.md`](../Phase-0/Phase-0-2.md)「後続Phaseでの改訂」参照)。

## 仕様診断(#28)

着手前に、要件定義書・外部設計書・内部設計書・実装計画書の4ドキュメントと実コード(devex-api/devex-ui)への影響調査を行い、CLAUDE.md #28に従い3段階(最重要/中程度/軽微)に分類した。最重要5点はユーザーに確認し、以下の通り確定した(4ドキュメントへの反映済み)。

| # | 論点 | 決定 |
|---|---|---|
| 1 | バージョン履歴の保持件数ポリシー | 現状の3件キャップを維持(拡張・撤廃しない)。Should have分は履歴閲覧・比較・復元のUI(SCR-006)の新設のみを指す |
| 2 | バージョン復元の意味論 | 復元は新バージョンとして追加(既存行の上書きはしない、既存の「再生成」方針との一貫性) |

> **[Phase 6 で確定 ── 復元で新バージョンを作らない]** 当初〈復元は新バージョンとして追加〉→ 撤回。理由〈復元のたびに同一内容のバージョンが増え、保持3件を無意味に消費するため〉。以後、復元は表示中バージョン(`is_current`)の付け替えのみ。詳細は[`Phase-6-6.md`](./Phase-6-6.md)。

| 3 | `template_id`の永続化 | `projects.template_id`(nullable FK)としてサーバー側に永続化。合流先は4文書生成(`doc_generator_service.py`)ではなく**ヒアリングチャットのシステムプロンプト**(`chat_service.py`) |
| 4 | DEBUGログとプライバシーの矛盾 | 内部設計書の「DEBUGログにプロンプト内容を含める」記述を撤回。ログには project_id・doc_type・文字数・レイテンシ等のメタデータのみを記録し、プロンプト・レスポンス本文は一切出力しない |
| 5 | 監視強化の具体策 | `structlog`によるJSON構造化ログ + `SENTRY_DSN`設定時のみ有効化するSentryエラー追跡(無料枠、未設定時は完全no-op) + 既存`/health`への外部無料アップタイム監視(UptimeRobot等、コード変更不要) |

反映先: [`docs/requirements.md`](../../docs/requirements.md) 1.4節、[`docs/external_design.md`](../../docs/external_design.md) 2.2節・2.5節、[`docs/internal_design.md`](../../docs/internal_design.md) 3.2節・3.3節・3.4節、[`docs/implementation_plan.md`](../../docs/implementation_plan.md) 4.1節・4.4節。あわせて、各ドキュメントが「MVPで既に実装済みの部分」(バージョン増分機構・共通エラーレスポンス形式)を未着手であるかのように記述していた不整合も是正した。

中程度・軽微に分類した項目(バージョン差分表示形式、テンプレートのプロンプト合流の詳細、「堅牢化」の具体的範囲、SCR-003/SCR-006のUI/UX詳細節の欠落等)は、各章の設計時に個別に決定する。

## モード宣言(#21)

各章のモードは章一覧に記載する。バックエンドAPI実装を含む章(6-1・6-3・6-5)は既存の設計判断(保持ポリシー・合流先・ログ方針)が仕様診断で確定済みのため納期モード、UI実装を含む章(6-2・6-4)はSCR-003/SCR-006のUI/UX詳細が未確定のため学習モードとする(#21条件(a): UI設計の判断箇所が過半数を占める)。MVPコアループ(チャット↔4文書生成)そのものの変更ではないため、#21「コアループは常に学習モード」の対象ではない。

## パイプライン上の位置づけ・前提

- 前提として読むべきもの: [`docs/internal_design.md`](../../docs/internal_design.md)(本Phaseで更新した3.2節・3.3節・3.4節)、[`Phase-2/Phase-2-3.md`](../Phase-2/Phase-2-3.md)(`chat_service.py`の既存設計)・[`Phase-2/Phase-2-4.md`](../Phase-2/Phase-2-4.md)(`doc_generator_service.py`の既存設計、章番号は要確認)、[`Phase-3/Phase-3-introduction.md`](../Phase-3/Phase-3-introduction.md)(devex-ui`src/features/`の既存パターン)。
- 本Phase開始時点の既知の状態(仕様診断で確認済み): `generated_documents`のバージョン増分+3件保持は実装済みだが、これを閲覧・比較・復元するAPI/UIは一切無い。`prompt_templates`はmodel+migrationのみ存在するorphanedテーブル。構造化ログ・監視は一切未導入(bare `logging.getLogger`が1箇所のみ)。

## 章一覧

| 章 | トピック | モード | 依存 |
|---|---|---|---|
| [`Phase-6-1.md`](./Phase-6-1.md) | バージョン履歴API(list-versions/restore、`GeneratedDocumentRepository`拡張) | 納期 | なし |
| [`Phase-6-2.md`](./Phase-6-2.md) | バージョン履歴UI(SCR-006、`DocumentTabs`との統合) | 学習 | 6-1 |
| [`Phase-6-3.md`](./Phase-6-3.md) | プロンプトテンプレートAPI(`projects.template_id`マイグレーション、`PromptTemplateRepository`/service/route新設、`chat_service.py`への合流、固定シードデータ) | 納期 | なし |
| [`Phase-6-4.md`](./Phase-6-4.md) | プロンプトテンプレート選択UI(SCR-003、`IntakeForm`への`template_id`追加) | 学習 | 6-3 |
| [`Phase-6-5.md`](./Phase-6-5.md) | エラーハンドリング堅牢化・構造化ログ・監視(`structlog`導入、Sentry統合、`OPERATIONS.md`更新) | 納期 | なし |
| [`Phase-6-6.md`](./Phase-6-6.md) | 動作確認後の修正(ヒアリング完了判定の厳格化、生成ボタン再描画、復元=表示バージョン切替) | 学習 | 6-1, 6-2 |

6-1/6-3/6-5は互いに独立して並行に進めてよい。6-2は6-1、6-4は6-3の完了を前提にする。当初の5章構成はユーザー確認済み。6-6は動作確認で見つかった不具合・仕様変更の追補章(6-1・6-2・Phase 2-3/3-5の改訂を含む)。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| 6-1 | `app/repositories/generated_document.py`(更新)、`app/services/doc_generator_service.py`(更新)、`app/api/routes/projects.py`(更新) | doc_typeの全保持バージョン一覧取得・指定バージョンの新バージョンとしての復元 | `uv run pytest tests/unit/test_generated_document_repository.py tests/unit/test_doc_generator_service.py tests/unit/test_document_versions.py` |
| 6-2 | `src/features/documents/api/documentsApi.ts`(更新)、`src/features/documents/components/VersionHistoryPanel.tsx`(新規)、`DocumentMarkdownView.tsx`(更新) | SCR-006、バージョン一覧・復元操作のUI | `npx vitest run src/features/documents` |
| 6-3 | 新規alembicマイグレーション(`projects.template_id`)、`app/repositories/prompt_template.py`(新規)、`app/services/project.py`・`app/services/chat_service.py`(更新)、`app/api/routes/prompt_templates.py`(新規)、`scripts/seed.py`(更新) | テンプレート一覧取得・`template_id`永続化・ヒアリング開始時の`system_prompt`合流 | `uv run pytest tests/unit/test_prompt_template_repository.py tests/unit/test_prompt_templates_routes.py tests/unit/test_seed_prompt_templates.py tests/unit/test_chat_service.py` |
| 6-4 | `src/features/hearing/api/templatesApi.ts`(新規)、`src/features/hearing/components/TemplateSelectField.tsx`(新規)、`IntakeForm.tsx`・`schemas.ts`・`createProject.ts`(更新) | テンプレート選択UI・環境設定へのプリフィル・`template_id`のプロジェクト作成ペイロードへの追加 | `npx vitest run src/features/hearing` |
| 6-5 | `app/core/logging.py`(新規)、`app/core/config.py`・`app/main.py`・`app/api/error_handlers.py`・`app/services/llm_retry.py`(更新)、`devex-api/OPERATIONS.md`(更新) | 構造化ログ・エラー追跡・死活監視の追加 | `uv run pytest tests/unit/test_logging_config.py tests/unit/test_llm_retry.py tests/unit/test_config_safety.py tests/unit/test_error_handlers.py` |
| 6-6 | `chat_service.py`・`generated_document.py`(model/repository)・`doc_generator_service.py`・`schemas/document.py`・`routes/projects.py`・`ai/llm/fake.py`(更新)、新規alembicマイグレーション(`is_current`)、`HearingCompletionBanner.tsx`・`hearing-store.ts`・`documentsApi.ts`・`VersionHistoryPanel.tsx`(更新)、E2E台本(更新) | 完了判定の厳格化・生成ボタン再描画・復元=表示切替 | 章末のテスト観点参照 |

## 写経順序(#23)

章番号順(6-1 → 6-2 → 6-3 → 6-4 → 6-5 → 6-6)。6-1/6-3/6-5は依存が無いため並行着手も可。6-6は6-1〜6-5の完了後(既存コードへの追補)。

## Phase完了チェック(#22)

1. バージョン履歴のShould have機能が「3件キャップの拡張」ではなく「既存機構へのUI追加」である理由を、仕様診断の経緯を踏まえて説明できるか。
2. `prompt_templates.system_prompt`がなぜ`doc_generator_service.py`ではなく`chat_service.py`に合流するのか、`prompt_templates`テーブルの元々の設計意図(SCR-003→SCR-004)に沿って説明できるか。
3. DEBUGログからプロンプト本文を除外した理由を、要件定義書1.5節のどの記述と結びつけて説明できるか。
4. `SENTRY_DSN`未設定時にSentryが完全にno-opになる設計が、なぜ個人開発規模のプロジェクトに適しているか説明できるか。

## 次のフェーズ

ステージ2完了後の次Phaseは未定。実装計画書のWBSはステージ2で完結する。

## 後続 Phase での改訂(#12)

- [`Phase-6-6.md`](./Phase-6-6.md)で、6-1/6-2の「復元は新バージョンとして追加」を「復元は表示中バージョンの切替(新バージョンは作らない)」へ改訂した(`generated_documents.is_current`追加)。6-1・6-2本文の該当節に改訂注記あり。
