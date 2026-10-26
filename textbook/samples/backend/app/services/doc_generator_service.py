# 作成：Phase-2-4｜更新：Phase-2-5,6-1,6-5,6-6,8-5,10-1,13-2,15-1,15-3,16-1,24(ゴール3後の調整),31-1,36-2,37-2,38-2,40-1,43-3,45-3,46-2,49-3,52-4,53-1,53(完了後の調整),54-2,54-5,56-2,57-1,57-2,64-2,68-3,68-4,69-1,81-1,85-2,88-1,91-3,92-3,93-3,93-4,94-3,105-3,106-2,112-1,112-3
# Phase-105-3：更新(docstring: apply_adopt_user は利用者を ID で指す)
# Phase-94-3：更新(docstring: adopt_requirement を commit だけにし、中身を apply_adopt_requirement〈採用した行を確認済みにすることを足した〉へ移した)
# Phase-93-4：更新(docstring: generate が CR の反映で合意を更新することを足した)
# Phase-93-3：更新(docstring: _generate_external_design が合意済みの画面・API・外部連携を守り、戻した要素を返すことを足した)
# Phase-92-3：更新(docstring: _generate_requirements が合意済みの行と利用者を守り、戻した要素を返すことを足した)
# Phase-91-3：更新(docstring: adopt_requirement が詳細設計モードで合意を記録することを足した)
# Phase-85-2：更新(docstring: generate_documents・request_generation・generate が cr_number を受けることを足した)
# 写経レベル: コア ── MVPコアループ(4文書生成+自己診断)そのもの。BackgroundTasksのセッション管理とエラー時のstatus復旧ロジックに注意。
# Phase-2-5:追記 ── app.services.errors.LLMQuotaExceededError, app.services.llm_retry.invoke_with_retry
# Phase-6-1:追記 ── app.services.errors.DocumentNotFoundError
# Phase-6-5:追記 ── structlog
# Phase-8-5:追記 ── app.models.project.Project
# Phase-15-3:追記 ── datetime(UTC, datetime), app.services.errors.DocGenerationInProgressError,
#   app.services.generation_staleness.is_stale
# Phase-36-2:追記 ── pydantic.ValidationError, app.documents.requirements(RequirementsModel, build_model, mark_adopted, render_requirements, source_counts, validate_requirements), app.documents.requirements.drafting(RequirementsGenerationOutput, build_requirements_messages, to_draft), app.hearing.as_scale, app.repositories.hearing_point.HearingPointRepository, app.schemas.document(AssumedRequirementRead, GeneratedDocumentRead, RequirementIssueRead, RequirementsSummaryRead), app.services.errors(RequirementNotAssumedError, RequirementNotFoundError), app.services.llm_retry.invoke_structured
# Phase-37-2:追記 ── app.documents.external_design(ExternalDesignModel, build_model as build_external_design_model, render_external_design, row_counts, validate_external_design), app.documents.external_design.drafting(ExternalDesignGenerationOutput, build_external_design_messages, to_draft as to_external_design_draft), app.documents.issues.DocumentIssue, app.schemas.document(DocumentIssueRead, ExternalDesignSummaryRead)
# Phase-37-2：削除 ── app.schemas.document.RequirementIssueRead
# Phase-40-1:追記 ── re
# Phase-43-3:追記 ── app.services.design_stage_service.DesignStageService
# Phase-45-3:追記 ── app.documents.internal_design(InternalDesignModel, build_model, render_internal_design, row_counts, validate_internal_design), app.documents.internal_design.drafting(InternalDesignGenerationOutput, build_internal_design_messages, to_draft)
# Phase-45-3:追記 ── app.documents.implementation_plan(ImplementationPlanModel, build_model, render_implementation_plan, row_counts, validate_implementation_plan), app.documents.implementation_plan.drafting(ImplementationPlanGenerationOutput, build_implementation_plan_messages, to_draft), app.schemas.document.DocumentSummaryRead
# Phase-45-3：削除 ── re(見出しの重なりを直す正規表現は、md を AI に書かせなくなったので消した)
# Phase-49-3:追記 ── collections.abc.Mapping, app.documents.revision.changed_rows, external_design_rows, internal_design_rows, requirement_rows
# Phase-52-4:追記 ── redis.asyncio.Redis, app.core.errors.AppError, app.infrastructure.redis.get_redis_client, app.models.user.User, app.review.review_effective, app.services.review_service.ReviewService, app.repositories.generated_document.DOC_TYPES_BY_MODE
# Phase-52-4：削除 ── app.repositories.generated_document.DOC_TYPES(DOC_TYPES_BY_MODE と一緒に移した)
# Phase-53-1:追記 ── app.review.DOCUMENTS_GATE
# Phase-53(完了後の調整):追記 ── app.services.errors(GenerationStartInvalidError, GenerationUpstreamMissingError), app.services.generation_progress(GenerationProgress, GenerationProgressStore)
# Phase-54-2:追記 ── app.review.build_instruction, app.review.findings_for, app.services.fix_check_service.FixCheckService, collections.abc.Sequence
# Phase-56-2:追記 ── pydantic.BaseModel, app.detailed_design.function_list.FunctionListModel, app.detailed_design.plan(PLAN_STAGE, PlanModel), app.detailed_design.stages(doc_key, stage_key), app.documents.test_spec(TestSpecModel, build_model, detailed_links, is_outdated, render_test_spec, required_tests, row_counts, simple_links, validate_test_spec), app.documents.test_spec.drafting(TestSpecGenerationOutput, build_test_spec_messages, to_draft), app.repositories.generated_document.TEST_SPEC, app.schemas.document.TestSpecRead, app.services.errors.TestSpecUpstreamNotReadyError
# Phase-57-1:追記 ── app.services.test_spec_state(FUNCTION_STAGE, TEST_SPEC_STAGES, current_test_spec, spec_inputs)
# Phase-57-1：削除 ── app.detailed_design.stages(doc_key, stage_key), app.documents.test_spec.is_outdated(入力の版と「古い」は test_spec_state へ移した)
# Phase-57-2:追記 ── app.documents.test_spec.design_gap_count
# Phase-64-2:追記 ── app.services.project_deletion(commit_if_live, project_vanished, purge_deleted_projects)
# Phase-68-3：削除 ── app.ai.llm.gemini.extract_text_content, app.ai.llm.gemini.get_gemini_llm
# Phase-68-3:追記 ── app.ai.llm.catalog.Purpose, app.ai.llm.content.extract_text_content, app.services.llm_resolver.LlmResolver
# Phase-68-4：削除 ── app.review.review_effective
# Phase-69-1:追記 ── app.uml.generation.failures(ReasonCode, classify_failure)
# Phase-69-1：削除 ── app.services.errors.LLMQuotaExceededError
# Phase-81-1:追記 ── app.services.llm_resolver.injected_llm
# Phase-85-2:追記 ── app.change_requests.join_instructions, app.detailed_design.impact.Mark, app.detailed_design.impact.cr_source, app.services.change_request_service.ChangeRequestService, app.services.errors.ChangeRequestNotReflectableError
# Phase-88-1:追記 ── app.repositories.change_request.ChangeRequestRepository
# Phase-91-3:追記 ── app.services.agreement_service.AgreementService
# Phase-92-3:追記 ── app.agreements.USERS_KEY, app.agreements.agreed_requirement_ids, app.agreements.protect_requirements, app.agreements.requirement_key, app.change_requests.targets_from_json, app.documents.requirements.UserScene, app.models.change_request.ChangeRequest
# Phase-93-3:追記 ── app.agreements.agreed_external_ids, app.agreements.protect_external_design, app.change_requests.rewritable_keys
# Phase-93-3：削除 ── app.agreements.requirement_key
# Phase-94-3:追記 ── app.confirmations.requirement_item, app.confirmations.user_item, app.documents.requirements.mark_user_adopted, app.repositories.confirmation.ConfirmationRepository
# Phase-106-2:追記 ── app.confirmations.changed_requirement_keys
import uuid
from collections.abc import Mapping, Sequence
from datetime import UTC, datetime

import structlog
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, ValidationError
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.agreements import (
    USERS_KEY,
    agreed_external_ids,
    agreed_requirement_ids,
    protect_external_design,
    protect_requirements,
)
from app.ai.llm.catalog import Purpose
from app.ai.llm.content import extract_text_content
from app.change_requests import join_instructions, rewritable_keys, targets_from_json
from app.confirmations import changed_requirement_keys, requirement_item, user_item
from app.core.database import AsyncSessionLocal
from app.core.errors import AppError
from app.detailed_design.function_list import FunctionListModel
from app.detailed_design.impact import Mark, cr_source
from app.detailed_design.plan import PLAN_STAGE, PlanModel
from app.documents.external_design import (
    ExternalDesignModel,
    render_external_design,
    row_counts,
    validate_external_design,
)
from app.documents.external_design import build_model as build_external_design_model
from app.documents.external_design.drafting import (
    ExternalDesignGenerationOutput,
    build_external_design_messages,
)
from app.documents.external_design.drafting import to_draft as to_external_design_draft
from app.documents.implementation_plan import (
    ImplementationPlanModel,
    render_implementation_plan,
    validate_implementation_plan,
)
from app.documents.implementation_plan import build_model as build_implementation_plan_model
from app.documents.implementation_plan import row_counts as implementation_plan_counts
from app.documents.implementation_plan.drafting import (
    ImplementationPlanGenerationOutput,
    build_implementation_plan_messages,
)
from app.documents.implementation_plan.drafting import (
    to_draft as to_implementation_plan_draft,
)
from app.documents.internal_design import (
    InternalDesignModel,
    render_internal_design,
    validate_internal_design,
)
from app.documents.internal_design import build_model as build_internal_design_model
from app.documents.internal_design import row_counts as internal_design_counts
from app.documents.internal_design.drafting import (
    InternalDesignGenerationOutput,
    build_internal_design_messages,
)
from app.documents.internal_design.drafting import to_draft as to_internal_design_draft
from app.documents.issues import DocumentIssue
from app.documents.requirements import (
    RequirementsModel,
    UserScene,
    build_model,
    mark_adopted,
    mark_user_adopted,
    render_requirements,
    source_counts,
    validate_requirements,
)
from app.documents.requirements.drafting import (
    RequirementsGenerationOutput,
    build_requirements_messages,
    to_draft,
)
from app.documents.revision import (
    changed_rows,
    external_design_rows,
    internal_design_rows,
    requirement_rows,
)
from app.documents.test_spec import (
    TestSpecModel,
    design_gap_count,
    detailed_links,
    render_test_spec,
    required_tests,
    simple_links,
    validate_test_spec,
)
from app.documents.test_spec import build_model as build_test_spec_model
from app.documents.test_spec import row_counts as test_spec_counts
from app.documents.test_spec.drafting import TestSpecGenerationOutput, build_test_spec_messages
from app.documents.test_spec.drafting import to_draft as to_test_spec_draft
from app.hearing import as_scale
from app.infrastructure.redis import get_redis_client
from app.models.change_request import ChangeRequest
from app.models.chat_history import ChatHistory
from app.models.generated_document import GeneratedDocument
from app.models.project import Project
from app.models.user import User
from app.repositories.change_request import ChangeRequestRepository
from app.repositories.chat_history import ChatHistoryRepository
from app.repositories.confirmation import ConfirmationRepository
from app.repositories.generated_document import (
    DOC_TYPES_BY_MODE,
    TEST_SPEC,
    GeneratedDocumentRepository,
)
from app.repositories.hearing_point import HearingPointRepository
from app.repositories.project import ProjectRepository
from app.review import (
    DOCUMENTS_GATE,
    build_instruction,
    findings_for,
)
from app.schemas.document import (
    AssumedRequirementRead,
    DocumentIssueRead,
    DocumentSummaryRead,
    ExternalDesignSummaryRead,
    GeneratedDocumentRead,
    RequirementsSummaryRead,
    TestSpecRead,
)
from app.services.agreement_service import AgreementService
from app.services.change_request_service import ChangeRequestService
from app.services.design_stage_service import DesignStageService
from app.services.errors import (
    ChangeRequestNotReflectableError,
    DocGenerationInProgressError,
    DocumentNotFoundError,
    GenerationStartInvalidError,
    GenerationUpstreamMissingError,
    RequirementNotAssumedError,
    RequirementNotFoundError,
    TestSpecUpstreamNotReadyError,
)
from app.services.fix_check_service import FixCheckService
from app.services.generation_progress import GenerationProgress, GenerationProgressStore
from app.services.generation_staleness import is_stale
from app.services.llm_resolver import LlmResolver, injected_llm
from app.services.llm_retry import invoke_structured, invoke_with_retry
from app.services.project_deletion import (
    commit_if_live,
    project_vanished,
    purge_deleted_projects,
)
from app.services.review_service import ReviewService
from app.services.test_spec_state import (
    FUNCTION_STAGE,
    TEST_SPEC_STAGES,
    current_test_spec,
    spec_inputs,
)
from app.uml.generation.failures import ReasonCode, classify_failure

logger = structlog.get_logger(__name__)

_DOC_TYPE_LABELS: dict[str, str] = {
    "requirements": "要件定義書",
    "external_design": "外部設計書",
    "internal_design": "内部設計書",
    "implementation_plan": "実装計画書",
    # Phase-56-2:追記
    TEST_SPEC: "テスト仕様書",
}
# Phase-57-1：削除(test_spec_state へ移した)
# # 詳細設計モードのテスト仕様書が読む段階(処理の一覧と実装計画。処理・単位の列を引く)
# FUNCTION_STAGE = 1
# _TEST_SPEC_STAGES = (FUNCTION_STAGE, PLAN_STAGE)

# Phase-45-3：削除
# # 4文書に共通する出力上の心がけ。当プロジェクト自身の4文書(docs/requirements.md等)を
# # 実際に作成した際、個別プロンプトの指示を超えて一貫して採用されていた書式(表形式の多用・
# # 複数観点の番号付きサブセクション化・構造図のコードブロック化)を、ドメインに依存しない
# # 一般的な指針として全doc_typeへ横展開したもの。
# _COMMON_FORMAT_GUIDANCE = (
#     "\n\n出力全体の心がけ:\n"
#     "- 一覧性の高い情報(画面一覧・テーブル定義・APIエンドポイント一覧等)は"
#     "Markdownテーブルで整理する。\n"
#     "- 1つの見出しが複数の観点を含む場合は、意味のある小見出し付きの番号付きサブセクション"
#     "(### 1. ... / ### 2. ...)に展開する。\n"
#     "- システム構成・ディレクトリ構成・画面遷移フロー等の構造は、"
#     "コードブロック内のテキスト図で視覚的に示す。"
# )
#
# # doc_typeごとに特化したシステムプロンプト(docs/internal_design.md 3.3節)。
# # 出力フォーマット(見出し構成)を明示することで、4文書の粒度・構成を安定させる。
# # 要件定義書・外部設計書はここに無い(構造化出力 → model → md。app/documents/requirements・
# # app/documents/external_design の drafting.py)。外部設計書の見出し(2.1〜2.6)と 2.6 の列は
# # app/documents/external_design/markdown.py が組み立てる。
# _DOC_TYPE_PROMPTS: dict[str, str] = {
#     "internal_design": (
#         "あなたは優秀なリードエンジニア・データベース設計者です。"
#         "以下の【要件定義書】および【外部設計書】に基づき、システム内部の構造・ロジックに関する"
#         "「内部設計書」をMarkdown形式で作成してください。前置きや断り書きは不要です。"
#         "Markdown本文のみを出力してください。\n\n"
#         "出力フォーマット:\n"
#         "# 3. 内部設計書\n\n"
#         "## 3.1 技術スタック選定・アーキテクチャ方針\n"
#         "- フロントエンド / バックエンド / データベース / インフラの選定理由と構成方針\n\n"
#         "## 3.2 データモデル定義\n- 主要エンティティ一覧\n"
#         "- テーブルごとに『### テーブル: <テーブル名>』の見出しを立て、"
#         "Markdownテーブル(カラム名/データ型/制約/説明)で全カラムを列挙する\n\n"
#         "## 3.3 バックエンド処理・モジュール設計\n"
#         "- 主要処理ロジック（ビジネスロジック）の分割方針。ディレクトリ構成はコードブロックで示す\n"
#         "- APIエンドポイント一覧はMarkdownテーブル(メソッド/パス/概要)で示す。"
#         "外部設計書2.6のAPI一覧と同じメソッド・パスを使い、内部の担当(ルート・サービス)の"
#         "観点で概要を書く\n"
#         "- 続けて『### モジュール一覧』の小節を設け、ファイル単位の責務を"
#         "Markdownテーブル(パス/層/責務/主な依存先)で示す。"
#         "スキーマ・設定のような定型のファイルは省くか1行にまとめる\n"
#         "- 続けて『### 処理別データフロー』の小節を設け、APIエンドポイント・バッチ処理ごとに"
#         "『#### DF-<連番>: <HTTPメソッド> <パス>』(バッチは『#### DF-<連番>: <バッチ名>』)の"
#         "見出しを立てる\n"
#         "  - 各見出しの下に、データの流れをMarkdownテーブル(元/データ/変換/先)で示す。"
#         "元・先は外部実体(利用者・外部サービス)、処理(担当モジュール名)、"
#         "データストア(テーブル名)のいずれかとする\n"
#         "  - 続けて、その処理に登場するデータ項目を"
#         "『- データ項目: <名前>(<フィールド1>, <フィールド2>, ...)』の形式で列挙する。"
#         "同じデータ項目は全処理で同じ名前を使う\n\n"
#         "## 3.4 例外処理・エラーハンドリング・ログ設計\n"
#         "- 共通エラーレスポンス形式、例外検知・ログ出力方針"
#         + _COMMON_FORMAT_GUIDANCE
#     ),
#     "implementation_plan": (
#         "あなたは経験豊富なプロジェクトマネージャーです。"
#         "以下の設計情報（要件定義・内部設計）を踏まえ、開発を安全かつ確実に進めるための「実装計画書」を"
#         "Markdown形式で作成してください。前置きや断り書きは不要です。Markdown本文のみを出力してください。\n\n"
#         "出力フォーマット:\n"
#         "# 4. 実装計画書\n\n"
#         "## 4.1 開発フェーズ分割・マイルストーン\n"
#         "- 各フェーズの見出しに『── 【優先度】』の形式でMoSCoW優先度を明記する\n"
#         "- フェーズ1（MVP / 必須機能）、フェーズ2（拡張機能）などの段階的リリース計画\n"
#         "- 各フェーズに含めるマイルストーンを、4.2のID(M-01など)で挙げる\n\n"
#         "## 4.2 タスク分解（WBS）\n"
#         "- タスクは実装手順書の作業単位になる。機能ごとの縦割りにし、1つのタスクに"
#         "その処理のバックエンド・フロントエンド・テストを含める。処理の無い準備・デプロイは"
#         "基盤のタスクにする\n"
#         "- マイルストーンごとに『### M-<2桁の連番>: <マイルストーン名> ── 【Must/Should/Could】』"
#         "の見出しを立て、直後に『- ゴール: <動くようになること>』を書く。"
#         "この節にはマイルストーン以外の見出しを立てない\n"
#         "- タスクは『- [ ] M-<2桁>-T<2桁> [機能] <タスク名>』(処理の無いものは[基盤])の形式で書き、"
#         "マイルストーンの中で01から連番を振る\n"
#         "- 各タスクの下に、字下げした箇条書きで次の欄を書く(該当が無い欄は『なし』):\n"
#         "  - 『処理: DF-<連番>, ...』内部設計書の処理別データフローのID。"
#         "機能のタスクは原則1つ(多くても3つ)、基盤のタスクは『なし』\n"
#         "  - 『要件: FR-<3桁>, ...』そのタスクが実現する、要件定義書の機能要件のID。"
#         "要件定義書に無いIDは作らない。基盤のタスクは『なし』\n"
#         "  - 『依存: M-<2桁>-T<2桁>, ...』先に終わっている必要があるタスクのID。"
#         "前に書いたタスクだけを指す\n"
#         "  - 『モジュール: <パス>, ...』作る・直すファイル。"
#         "内部設計書のモジュール一覧のパスを使う\n"
#         "  - 『環境・設定: <ファイル>, ...』Dockerfile・docker-compose.ymlのような"
#         "環境・設定のファイル\n"
#         "- 内部設計書の処理別データフローは、すべていずれかの機能のタスクに入れる。"
#         "要件定義書の Must の機能要件は、すべていずれかのタスクの『要件』に入れる。"
#         "Won't haveの機能はタスクにしない\n"
#         "- 例:\n"
#         "```\n"
#         "### M-01: 予約の登録 ── 【Must】\n"
#         "- ゴール: 備品を予約して一覧で確かめられる\n"
#         "- [ ] M-01-T01 [基盤] 開発環境とDBを用意する\n"
#         "  - 処理: なし\n"
#         "  - 要件: なし\n"
#         "  - 依存: なし\n"
#         "  - モジュール: backend/app/main.py\n"
#         "  - 環境・設定: docker-compose.yml\n"
#         "- [ ] M-01-T02 [機能] 予約を登録する\n"
#         "  - 処理: DF-1\n"
#         "  - 要件: FR-001\n"
#         "  - 依存: M-01-T01\n"
#         "  - モジュール: backend/app/api/reservations.py, backend/app/services/reservation.py\n"
#         "  - 環境・設定: なし\n"
#         "```\n\n"
#         "## 4.3 開発環境・CI/CD・事前準備事項\n- 開発に必要なツール、"
#         "リポジトリ構成、自動テスト・CI/CD方針\n\n"
#         "## 4.4 想定リスクと対策（トレードオフ・後回し候補）\n"
#         "- 各リスクは『**リスクN: 内容**』の見出し+『*対策*: ...』の形式で記述する\n"
#         "- 想定される技術的・スケジュール的リスク\n"
#         "- 納期・予算超過時のトレードオフ策（機能削減・代替手段案）"
#         + _COMMON_FORMAT_GUIDANCE
#     ),
# }
#
# 各doc_typeの入力として使う、前段で確定済みの文書(doc_type名のタプル)。
# Phase-36-2：更新
# # ここに無いdoc_type(requirements)は、代わりにチャット全履歴(transcript)を直接読む。
# ↓↓
# ここに無いdoc_type(requirements)は、代わりにチャット全履歴(transcript)と観点の表を読む。
# Phase-37-2:追記
# Phase-45-3：更新
# # 外部設計書(_generate_external_design)は、要件定義書の md に加えて、生成した要件定義書の
# # model(要件ID の照合)も受け取る。
# # 後続の文書は生のチャット履歴を再解釈せず、前段の確定済み文書だけを入力にすることで、
# # 4文書間の一貫性を確保する。
# ↓↓
# 後続の文書は生のチャット履歴を再解釈せず、前段の確定済み文書(model から組み立てた md)だけを
# 入力にすることで、4文書間の一貫性を確保する。照合用の ID(要件ID・API・処理別データフローの ID)
# は、前段の model から写す(app/documents の各 assemble.build_model)。
# 4文書とも構造化出力 → model → md(app/documents の requirements・external_design・
# internal_design・implementation_plan の drafting.py にプロンプトがある)。
_DOC_TYPE_INPUTS: dict[str, tuple[str, ...]] = {
    "external_design": ("requirements",),
    "internal_design": ("requirements", "external_design"),
    "implementation_plan": ("requirements", "internal_design"),
}
# Phase-45-3：削除
#
# # 見出しの記号が重なった行(LLM が「### ### 1. …」と書くことがある)。先頭の記号だけを残す
# _DOUBLED_HEADING = re.compile(r"^(#{1,6})(?:[ \t]+#{1,6})+(?=[ \t])", re.MULTILINE)

# Phase-52-4：削除(app/repositories/generated_document.py へ移した。生成の後のレビューも使うため)
# # Phase-15-1:追記
# # モード(projects.mode)ごとに生成する文書。詳細設計モードは要件定義・外部設計だけを生成し、
# # 内部設計・実装計画に当たる部分は段階(docs/internal_design.md 3.3節「4. 詳細設計モード」)
# # へ引き継ぐ。
# # 並びは生成の順序で、_DOC_TYPE_INPUTSの前段が必ず先に来る。
# DOC_TYPES_BY_MODE: dict[str, tuple[str, ...]] = {
#     "simple": DOC_TYPES,
#     "detailed": ("requirements", "external_design"),
# }

_SELF_DIAGNOSIS_SYSTEM_PROMPT = (
    # Phase-15-1：更新(詳細設計モードでは2種になる)
    # "あなたはレビュアーです。以下は今しがた生成された4種の設計書です。"
    # ↓↓
    "あなたはレビュアーです。以下は今しがた生成された設計書です。"
    "各ドキュメントの不足・不明瞭な点を「最重要(実装着手に支障)」「中程度(後続の設計判断に影響)」"
    "「軽微(運用上の補足)」の3段階に分類し、日本語の箇条書きで指摘してください。"
    "指摘が無い場合は、その旨を簡潔に述べてください。"
)


# Phase-15-3:追記
# Phase-69-1：更新
# # 生成の失敗・中断をチャットに残す文言(生の例外の文字列は利用者に見せず、ログにだけ残す)
# _QUOTA_MESSAGE = "本日の利用上限に達しました。時間をおいて再度お試しください。"
# _FAILED_MESSAGE = "設計書の生成に失敗しました。時間をおいて再度お試しください。"
# _STALE_MESSAGE = (
#     "設計書の生成が時間内に終わらなかったため、中断しました。もう一度生成してください。"
# )
# ↓↓
# 生成の失敗・中断の理由ごとの文言。チャットに残し、プロジェクトの`generation_failure`にも書く
# (生の例外の文字列は利用者に見せず、ログにだけ残す。理由の分類は classify_failure を共有する)
_FAILURE_MESSAGES: dict[ReasonCode, str] = {
    "QUOTA_EXCEEDED": "本日の利用上限に達しました。時間をおいて再度お試しください。",
    "TOKEN_LIMIT": (
        "AIの入力または出力のトークン数が上限を超えたため、設計書を作れませんでした。"
    ),
    "INVALID_OUTPUT": "AIの出力を設計書として解釈できませんでした。もう一度生成してください。",
    "LLM_UNAVAILABLE": (
        "使うAIのAPIキーが設定されていないため、設計書を作れませんでした。"
        "マイページでモデルかAPIキーを見直してください。"
    ),
    "GENERATION_FAILED": "設計書の生成に失敗しました。時間をおいて再度お試しください。",
    "STALE_GENERATION": (
        "設計書の生成が時間内に終わらなかったため、中断しました。もう一度生成してください。"
    ),
}


def failure_record(reason: ReasonCode, targets: Sequence[str], now: datetime) -> dict:
    """プロジェクトの`generation_failure`に書く失敗の記録(理由・文言・作り直そうとした文書・日時)。"""
    return {
        "reason_code": reason,
        "message": _FAILURE_MESSAGES[reason],
        "targets": list(targets),
        "failed_at": now.isoformat(),
    }


# Phase-15-3：更新(受け付けたときの状態を受け取る。Phase-2-4でuser_idを足した経緯はPhase-02-4.md参照)
# async def generate_documents(project_id: uuid.UUID, user_id: uuid.UUID, *, llm=None) -> None:
# ↓↓
async def generate_documents(
    project_id: uuid.UUID,
    user_id: uuid.UUID,
    status_before_generation: str | None = None,
    *,
    # Phase-53(完了後の調整):追記
    start_from: str | None = None,
    # Phase-54-2:追記
    finding_ids: Sequence[uuid.UUID] = (),
    # Phase-85-2:追記
    cr_number: int | None = None,
    llm=None,
) -> None:
    """`BackgroundTasks`から呼び出すエントリポイント。`start_from`は再生成の起点(省略で全部)、
    `finding_ids`は再生成の指示に入れる採用した指摘、`cr_number`は反映する合意した CR の番号。

    FastAPI 0.106以降、`yield`を使うDIのセッション(SessionDep)はbackground task実行"前"に
    クローズされるため、background task内でリクエストのセッションをそのまま使うことはできない。
    そのためこの関数はセッションを自前で開始・終了する(公式ドキュメントの推奨パターン:
    "pass identifiers ... retrieve the necessary objects inside the background task itself")。

    project_idに加えuser_idも受け取るのは、所有者チェック無しの専用メソッド(get_by_id_unscoped)を
    リポジトリに増やすのではなく、既存の所有者スコープ版get_by_idへ統一するため。project_id・
    user_idはどちらも値であり、セッションのようにリクエストのライフサイクルに紐づくものではない
    ため、background taskへ渡すこと自体に技術的な制約は無い。

    終わったら、削除の印が付いたプロジェクトの物理削除を試す(生成中は、このジョブが持つロックで
    飛ばされているため。app/services/project_deletion.py)。
    """
    # Phase-52-4：更新
    # async with AsyncSessionLocal() as session:
    #     # Phase-15-3：更新
    #     # await DocGeneratorService(session).generate(project_id, user_id, llm=llm)
    #     # ↓↓
    #     await DocGeneratorService(session).generate(
    #         project_id, user_id, status_before_generation=status_before_generation, llm=llm
    #     )
    # ↓↓
    redis = get_redis_client()
    try:
        async with AsyncSessionLocal() as session:
            # Phase-53(完了後の調整)：更新
            # await DocGeneratorService(session, redis=redis).generate(
            #     project_id, user_id, status_before_generation=status_before_generation, llm=llm
            # )
            # ↓↓
            await DocGeneratorService(session, redis=redis).generate(
                project_id,
                user_id,
                status_before_generation=status_before_generation,
                start_from=start_from,
                # Phase-54-2:追記
                finding_ids=finding_ids,
                # Phase-85-2:追記
                cr_number=cr_number,
                llm=llm,
            )
    finally:
        await redis.aclose()
        # Phase-64-2:追記
        await purge_deleted_projects()


class DocGeneratorService:
    """ヒアリング完了後の4種ドキュメント一括生成+自己診断を担当するサービス。"""

    # Phase-52-4：更新
    # def __init__(self, session: AsyncSession) -> None:
    # ↓↓
    def __init__(self, session: AsyncSession, *, redis: Redis | None = None) -> None:
        # session: DB操作用の非同期セッション(background task用に独立して開始されたもの)
        # Phase-52-4:追記
        # redis: 生成の後の設計レビューの1日の回数を数える
        self._session = session
        # Phase-52-4:追記
        self._redis = redis
        self._projects = ProjectRepository(session)
        self._chat_histories = ChatHistoryRepository(session)
        self._documents = GeneratedDocumentRepository(session)
        # Phase-36-2：更新
        #
        # ↓↓
        self._hearing_points = HearingPointRepository(session)
        # Phase-43-3:追記
        self._stages = DesignStageService(session)
        # Phase-53(完了後の調整):追記
        self._progress = GenerationProgressStore(redis)
    # Phase-15-3:追記 ── 気づき#4・#5: 受け付け時の409と、止まった生成の回収
    # Phase-53(完了後の調整)：更新
    # async def request_generation(self, project: Project) -> str:
    # ↓↓
    async def request_generation(
        self,
        project: Project,
        *,
        start_from: str | None = None,
        finding_ids: Sequence[uuid.UUID] = (),
        # Phase-85-2:追記
        cr_number: int | None = None,
    ) -> str:
        """生成の要求を受け付け、`status`を`generating`にしてcommitする。戻り値は受け付ける前の状態
        (失敗したときに戻す先。バックグラウンドの`generate`へ渡す)。

        `start_from`は再生成の起点(その文書から下流を作り直す。省略で全部)。モードに無い起点は
        `GenerationStartInvalidError`(400)、起点より上流の文書がまだ無ければ
        `GenerationUpstreamMissingError`(409)。詳細設計モードのテスト仕様書は、段階1・段階7 が
        承認済みで古くなければ作れる(違えば`TestSpecUpstreamNotReadyError`(409))。`finding_ids`(再生成の指示に入れる指摘)に
        プロジェクトに無い指摘があれば`ReviewFindingNotFoundError`(404)、採用していない・ヒアリングが
        原因の指摘があれば`SendbackFindingInvalidError`(409)。`cr_number`(反映する CR)が
        プロジェクトに無ければ`ChangeRequestNotFoundError`(404)、合意・反映済みでないか、
        作り直す文書が設計書を含まない(テスト仕様書だけ)なら`ChangeRequestNotReflectableError`(409)。

        生成中なら`DocGenerationInProgressError`(409)にする。受け付けと同じリクエストの中で
        `generating`にするのは、バックグラウンドで切り替えると、切り替わる前の二度押しを
        すり抜けさせてしまうため。止まった「生成中」は先に回収する(`recover_if_stale`)。"""
        # Phase-53(完了後の調整):追記
        targets = generation_targets(project.mode, start_from)
        for doc_type in DOC_TYPES_BY_MODE[project.mode]:
            if doc_type in targets:
                break
            if await self._documents.get_current(project_id=project.id, doc_type=doc_type) is None:
                raise GenerationUpstreamMissingError(
                    "上流の設計書がまだ無いため、ここから再生成できません。"
                )
        # Phase-56-2:追記
        if TEST_SPEC in targets and project.mode == "detailed":
            # Phase-57-1：更新
            # approved = await self._stages.approved_stages(project, _TEST_SPEC_STAGES)
            # if len(approved) < len(_TEST_SPEC_STAGES):
            # ↓↓
            approved = await self._stages.approved_stages(project, TEST_SPEC_STAGES)
            if len(approved) < len(TEST_SPEC_STAGES):
                raise TestSpecUpstreamNotReadyError(
                    "テスト仕様書は、段階1(処理)と段階7(実装計画)を承認してから作れます。"
                )
        # Phase-54-2:追記
        await ReviewService(self._session).sendback_findings(
            project.id, finding_ids, strict=True
        )
        # Phase-85-2:追記
        if cr_number is not None:
            await ChangeRequestService(self._session).reflectable(project, cr_number)
            # Phase-112-3:追記
            await ChangeRequestService(self._session).require_conflicts_checked(project, cr_number)
            if not any(t in DOC_TYPES_BY_MODE[project.mode] for t in targets):
                raise ChangeRequestNotReflectableError(
                    "テスト仕様書だけの生成には、変更要求を渡せません。"
                )
        await self.recover_if_stale(project)
        if project.status == "generating":
            raise DocGenerationInProgressError(
                "設計書を生成しています。完了してから再度お試しください。"
            )
        status_before_generation = project.status
        project.status = "generating"
        # Phase-69-1:追記
        # 前の失敗の知らせは、次の生成を受け付けた時点で消す
        project.generation_failure = None
        await self._session.commit()
        # updated_at(生成を始めた時刻。回収の判定に使う)はDB側で決まるため読み直す
        await self._session.refresh(project)
        return status_before_generation

    async def recover_if_stale(self, project: Project, *, now: datetime | None = None) -> bool:
        """しきい値(15分)を超えて`generating`のままのプロジェクトを、生成前の状態へ戻す
        (app/services/generation_staleness.py)。戻した場合はTrue。

        生成前の状態は記録していないため、文書が既にあれば`revising`、無ければ`interviewing`にする
        (どちらも再度「生成する」を押せる状態)。中断したことはチャットと`generation_failure`に
        残す(作り直そうとした文書は進み具合から読む。消えていればモードの全部とみなす)。"""
        if project.status != "generating":
            return False
        # updated_at はDB側で更新されるため、失効していれば読み直す(非同期では暗黙に読めない)
        await self._session.refresh(project, ["updated_at"])
        if not is_stale(project.updated_at, now or datetime.now(UTC)):
            return False
        has_documents = bool(await self._documents.list_current_for_project(project.id))
        project.status = "revising" if has_documents else "interviewing"
        # Phase-69-1:追記
        progress = await self._progress.read(project.id)
        targets = (
            progress.targets if progress is not None else generation_targets(project.mode, None)
        )
        project.generation_failure = failure_record(
            "STALE_GENERATION", targets, now or datetime.now(UTC)
        )
        await self._chat_histories.add(
            # Phase-69-1：更新
            # project_id=project.id, sender="others", message=_STALE_MESSAGE
            # ↓↓
            project_id=project.id,
            sender="others",
            message=_FAILURE_MESSAGES["STALE_GENERATION"],
        )
        await self._session.commit()
        await self._session.refresh(project)
        logger.warning("documents_generation_stale", project_id=str(project.id))
        return True

    # Phase-15-3：更新
    # async def generate(self, project_id: uuid.UUID, user_id: uuid.UUID, *, llm=None) -> None:
    # ↓↓
    async def generate(
        self,
        project_id: uuid.UUID,
        user_id: uuid.UUID,
        *,
        status_before_generation: str | None = None,
        # Phase-53(完了後の調整):追記
        start_from: str | None = None,
        # Phase-54-2:追記
        finding_ids: Sequence[uuid.UUID] = (),
        # Phase-85-2:追記
        cr_number: int | None = None,
        llm=None,
        # Phase-52-4:追記
        review_llm=None,
        # Phase-54-2:追記
        judge_llm=None,
    ) -> None:
        # Phase-15-1：更新
        # """チャット全履歴をコンテキストに4種の設計書を生成し、続けて自己診断を行う。
        # ↓↓
        """チャット全履歴をコンテキストに、モードごとの設計書(simpleは4種、detailedは要件定義・
        外部設計の2種。DOC_TYPES_BY_MODE)を生成し、続けて自己診断を行う。

        設計レビューがオン(app/review/policy.py の実効値)のアカウントは、自己診断の代わりに、
        生成を完了にした後で設計レビューを流す(`_review_after_generation`。生成の完了を
        レビューの分だけ待たせない)。`review_llm`はテストでレビューの LLM を差し替える。
        プロジェクトが見つからない場合は何もしない(background task内なので例外を送出しても
        呼び出し元には伝播しないため、静かに終了する)。

        LLM呼び出し失敗時(quota超過等)は`status`を呼び出し前の状態(`interviewing`または
        `revising`)に戻し再試行可能にする ── 失敗時に`generating`のまま固定されると
        ユーザーが再度「生成する」を押せなくなるため。`revising`から始まった再生成が
        失敗した場合に`interviewing`へ巻き戻すと、既に生成済みだったという文脈が失われる
        ため、開始時点の状態を記憶しておいて戻す。
        失敗内容は`sender='others'`のchat_historiesにも記録し、チャット画面に表示できるようにする。
        失敗したときは、途中まで作った版と古い版の削除を rollback で取り消してから状態を戻す
        (4文書の組がそろわない状態を残さないため)。

        `status_before_generation`は`request_generation`が受け付けたときの状態。省略したときは
        (受け付けを経ない呼び出し)ここで`generating`へ切り替える。
        `start_from`(再生成の起点)より上流の文書は作り直さず、表示中の版を下流の入力に使う。
        生成の間は、作り直す文書・できた文書・今作っている文書を Redis に置く
        (app/services/generation_progress.py。終わったら消す)。

        `finding_ids`(設計レビューの採用した指摘)は、作り直す文書ごとに、関連する指摘だけを
        修正指示にして生成のプロンプトに入れる(app/review/sendback.py)。

        `cr_number`(合意した CR)は、作り直す設計書のどれにも同じ指示にして入れ
        (app/change_requests/instruction.py)、作った版に CR を残す。生成が終わったら、CR を
        反映済みにし、付いた印(出どころに`cr:<番号>`を足す)を CR の写しに重ねる(同じ
        トランザクション)。CR で書き換えてよい要素(対象の要件と、保存した予測の画面・API)の
        合意も、作り直した中身で更新する(app/services/agreement_service.py)。
        受け付けの後に反映できない状態になった CR は渡さない。

        テスト仕様書(`TEST_SPEC`)は設計書の後に作る(簡易モードは毎回、詳細設計モードは
        `start_from="test_spec"`のときだけ。`generation_targets`)。設計書と同じトランザクションに
        入れ、自己診断・設計レビュー・変更の影響の印には渡さない。テスト仕様書だけを作ったときは、
        自己診断も設計レビューも流さない。
        """
        project = await self._projects.get_by_id(project_id, user_id=user_id)
        if project is None:
            return

        # Phase-15-3：更新(受け付け(request_generation)を経た呼び出しは、そこで generating に
        # 切り替え済み。文書文字列の後ろ2段落も Phase-15-3 で足した)
        # status_before_generation = project.status
        # project.status = "generating"
        # await self._session.commit()
        # ↓↓
        if status_before_generation is None:
            status_before_generation = project.status
            project.status = "generating"
            await self._session.commit()
        # Phase-52-4:追記
        user = await self._session.get(User, user_id)
        # Phase-68-4：更新
        # reviewing = user is not None and review_effective(
        #     is_superuser=user.is_superuser, review_enabled=user.review_enabled
        # )
        # ↓↓
        reviewing = user is not None and await LlmResolver(self._session).review_effective(user)

        try:
            # Phase-68-3：更新
            # llm = llm or get_gemini_llm()
            # ↓↓
            # Phase-81-1：更新
            # llm = llm or (
            #     await LlmResolver(self._session).resolve(user_id, Purpose.GENERATION)
            # ).llm
            # ↓↓
            # 版に残すモデル名のため、解決した結果を持つ(渡された LLM は既定のモデルとみなす)
            resolved = (
                injected_llm(llm, Purpose.GENERATION)
                if llm is not None
                else await LlmResolver(self._session).resolve(user_id, Purpose.GENERATION)
            )
            llm = resolved.llm
            # Phase-54-2:追記
            sendback = await ReviewService(self._session).sendback_findings(
                project_id, finding_ids
            )
            # Phase-85-2:追記
            change_requests = ChangeRequestService(self._session)
            reflection = await change_requests.reflection(project_id, cr_number)
            cr_instruction = reflection.instruction if reflection is not None else ""
            change_request_id = (
                reflection.change_request.id if reflection is not None else None
            )
            versions: list[tuple[str, int]] = []
            history = await self._chat_histories.list_for_project(project_id)
            transcript = _render_transcript(history)

            generated: dict[str, str] = {}
            # Phase-15-1：更新
            # for doc_type in DOC_TYPES:
            # ↓↓
            # Phase-37-2:追記
            requirements: RequirementsModel | None = None
            # Phase-45-3:追記
            external: ExternalDesignModel | None = None
            internal: InternalDesignModel | None = None
            # Phase-56-2:追記
            plan: ImplementationPlanModel | None = None
            doc_types = DOC_TYPES_BY_MODE[project.mode]
            # Phase-53(完了後の調整):追記
            targets = generation_targets(project.mode, start_from)
            progress = GenerationProgress(targets=list(targets))
            await self._progress.write(project_id, progress)
            # Phase-43-3:追記
            # 詳細設計モードの変更の影響は、生成の前に表示していた版と比べる
            previous_models: dict[str, dict | None] = {}
            for doc_type in doc_types:
                current = await self._documents.get_current(
                    project_id=project_id, doc_type=doc_type
                )
                previous_models[doc_type] = current.model if current is not None else None
            new_models: dict[str, dict | None] = {}
            # Phase-112-1:追記
            # 作った版で合意の形へ戻した要素(反映の前 → 後に「戻した」として残す)
            protections: list[dict] = []
            for doc_type in doc_types:
                # Phase-53(完了後の調整):追記
                if doc_type not in targets:
                    # 起点より上流は作り直さず、表示中の版を下流の入力にする
                    kept = await self._documents.get_current(
                        project_id=project_id, doc_type=doc_type
                    )
                    if kept is None:
                        raise GenerationUpstreamMissingError(f"{doc_type} not found")
                    generated[doc_type] = kept.content
                    if doc_type == "requirements":
                        requirements = parse_requirements_model(kept.model)
                    elif doc_type == "external_design":
                        external = parse_external_design_model(kept.model)
                    elif doc_type == "internal_design":
                        internal = parse_internal_design_model(kept.model)
                    # Phase-56-2:追記
                    else:
                        plan = parse_implementation_plan_model(kept.model)
                    continue
                progress.current = doc_type
                await self._progress.write(project_id, progress)
                # Phase-36-2：更新
                # content = await self._generate_one(doc_type, transcript, generated, llm=llm)
                # ↓↓
                model: dict | None = None
                # Phase-49-3:追記
                # Phase-92-3:追記
                protection: list[dict] | None = None
                # 再生成を前の版の差分にとどめるため、上流の文書で変わった行を渡す
                changed = upstream_changes(
                    doc_type, previous_models, requirements, external, internal
                )
                # Phase-54-2:追記
                # Phase-85-2：更新
                # instruction = build_instruction(findings_for([doc_type], sendback))
                # ↓↓
                instruction = join_instructions(
                    [build_instruction(findings_for([doc_type], sendback)), cr_instruction]
                )
                if doc_type == "requirements":
                    # Phase-37-2：更新
                    # content, model = await self._generate_requirements(
                    # ↓↓
                    # Phase-92-3：更新
                    # content, requirements = await self._generate_requirements(
                    #     project, transcript, instruction, llm=llm
                    # ↓↓
                    content, requirements, protection = await self._generate_requirements(
                        project,
                        transcript,
                        instruction,
                        reflection.change_request if reflection is not None else None,
                        llm=llm,
                    # Phase-37-2:追記
                    )
                    model = requirements.model_dump(mode="json")
                elif doc_type == "external_design":
                    # Phase-45-3：更新
                    # content, model = await self._generate_external_design(
                    # ↓↓
                    # Phase-93-3：更新
                    # content, external = await self._generate_external_design(
                    # ↓↓
                    content, external, protection = await self._generate_external_design(
                        # Phase-49-3：更新
                        # project, generated["requirements"], requirements, llm=llm
                        # ↓↓
                        # Phase-54-2：更新
                        # project, generated["requirements"], requirements, changed, llm=llm
                        # ↓↓
                        project,
                        generated["requirements"],
                        requirements,
                        changed,
                        instruction,
                        # Phase-93-3:追記
                        reflection.change_request if reflection is not None else None,
                        llm=llm,
                    )
                    # Phase-45-3:追記
                    model = external.model_dump(mode="json")
                elif doc_type == "internal_design":
                    content, internal = await self._generate_internal_design(
                        # Phase-49-3：更新
                        # project, generated, external, llm=llm
                        # ↓↓
                        # Phase-54-2：更新
                        # project, generated, external, changed, llm=llm
                        # ↓↓
                        project, generated, external, changed, instruction, llm=llm
                    )
                    model = internal.model_dump(mode="json")
                else:
                    # Phase-45-3：更新
                    # content = await self._generate_one(doc_type, transcript, generated, llm=llm)
                    # ↓↓
                    content, plan = await self._generate_implementation_plan(
                        # Phase-49-3：更新
                        # project, generated, requirements, internal, llm=llm
                        # ↓↓
                        # Phase-54-2：更新
                        # project, generated, requirements, internal, changed, llm=llm
                        # ↓↓
                        project, generated, requirements, internal, changed, instruction, llm=llm
                    )
                    model = plan.model_dump(mode="json")
                # Phase-85-2：更新
                # await self._documents.create_version(
                # ↓↓
                document = await self._documents.create_version(
                    # Phase-36-2：更新
                    # project_id=project_id, doc_type=doc_type, content=content
                    # ↓↓
                    # Phase-81-1：更新
                    # project_id=project_id, doc_type=doc_type, content=content, model=model
                    # ↓↓
                    project_id=project_id,
                    doc_type=doc_type,
                    content=content,
                    model=model,
                    generated_model=resolved.model,
                    # Phase-85-2:追記
                    change_request_id=change_request_id,
                    # Phase-92-3:追記
                    protection=protection,
                )
                # Phase-85-2:追記
                versions.append((doc_type, document.version))
                # Phase-112-1:追記
                protections += protection or []
                generated[doc_type] = content
                # Phase-43-3:追記
                new_models[doc_type] = model
                # Phase-53(完了後の調整):追記
                progress.done.append(doc_type)
            # Phase-56-2:追記
            if TEST_SPEC in targets:
                progress.current = TEST_SPEC
                await self._progress.write(project_id, progress)
                content, test_spec = await self._generate_test_spec(
                    project, generated, requirements, external, internal, plan, llm=llm
                )
                await self._documents.create_version(
                    project_id=project_id,
                    doc_type=TEST_SPEC,
                    content=content,
                    model=test_spec.model_dump(mode="json"),
                    # Phase-81-1:追記
                    generated_model=resolved.model,
                )
                progress.done.append(TEST_SPEC)
            progress.current = None
            await self._progress.write(project_id, progress)
            # Phase-53(完了後の調整)：更新
            # for doc_type in doc_types:
            # ↓↓
            # Phase-56-2：更新
            # for doc_type in targets:
            # ↓↓
            designed = [doc_type for doc_type in targets if doc_type in doc_types]
            # Phase-85-2:追記
            extra_sources = (
                (cr_source(reflection.change_request.number),) if reflection is not None else ()
            )
            marks: list[Mark] = []
            for doc_type in designed:
                # Phase-85-2：更新
                # await self._stages.record_document_change(
                #     project, doc_type, previous_models[doc_type], new_models[doc_type]
                # ↓↓
                marks += await self._stages.record_document_change(
                    project,
                    doc_type,
                    previous_models[doc_type],
                    new_models[doc_type],
                    extra_sources=extra_sources,
                )
            # Phase-85-2:追記
            if reflection is not None and versions:
                await change_requests.record_document_apply(
                    reflection.change_request,
                    documents=versions,
                    model=resolved.model,
                    marks=marks,
                    actor_id=user_id,
                    # Phase-112-1:追記
                    before_models=previous_models,
                    after_models=new_models,
                    protection=protections,
                # Phase-93-4:追記
                )
                await AgreementService(self._session).record_change_request(
                    project, reflection.change_request, new_models, recorded_by=user_id
                )
                # Phase-106-2:追記
                if "requirements" in designed:
                    await self._reopen_confirmations(
                        project,
                        reflection.change_request,
                        previous_models.get("requirements"),
                        new_models.get("requirements"),
                    )

            # Phase-52-4：更新
            # diagnosis = await self._self_diagnose(generated, llm=llm)
            # await self._chat_histories.add(
            #     project_id=project_id, sender="others", message=diagnosis
            # )
            # ↓↓
            # Phase-56-2：更新
            # if not reviewing:
            # ↓↓
            if designed and not reviewing:
                diagnosis = await self._self_diagnose(generated, llm=llm)
                await self._chat_histories.add(
                    project_id=project_id, sender="others", message=diagnosis
                )
        # Phase-15-3：更新(気づき#3: rollbackしてから状態を戻す。生の例外の文字列は見せない)
        # except LLMQuotaExceededError:
        #     # LLM_QUOTA_EXCEEDEDはdocs/internal_design.md 3.4節が定めるとおり、
        #     # ユーザーに分かりやすい専用メッセージを表示する。
        #     project.status = status_before_generation
        #     await self._chat_histories.add(
        #         project_id=project_id,
        #         sender="others",
        #         message="本日の利用上限に達しました。時間をおいて再度お試しください。",
        #     )
        #     await self._session.commit()
        #     return
        # except Exception as exc:  # noqa: BLE001 -- それ以外の失敗要因も再試行可能な状態に戻す
        #     project.status = status_before_generation
        #     await self._chat_histories.add(
        #         project_id=project_id,
        #         sender="others",
        #         message=f"設計書の生成に失敗しました。時間をおいて再度お試しください。({exc})",
        #     )
        #     await self._session.commit()
        #     return
        # ↓↓
        except Exception as exc:  # noqa: BLE001 -- どの失敗要因も再試行可能な状態に戻す
            await self._session.rollback()
            # Phase-53(完了後の調整):追記
            await self._progress.clear(project_id)
            # Phase-64-2:追記
            if await project_vanished(self._session, project_id, job="documents"):
                return  # 生成中に削除された(外部キーの違反も含む)。失敗として記録しない
            logger.warning(
                "documents_generation_failed",
                project_id=str(project_id),
                error_type=type(exc).__name__,
            )
            # rollbackで失効したプロジェクトを読み直してから、状態を戻す
            project = await self._projects.get_by_id(project_id, user_id=user_id)
            if project is None:
                return
            project.status = status_before_generation
            # LLM_QUOTA_EXCEEDEDはdocs/internal_design.md 3.4節が定めるとおり、
            # Phase-69-1：更新
            # # ユーザーに分かりやすい専用メッセージを表示する。
            # ↓↓
            # ユーザーに分かりやすい専用メッセージを表示する。画面は`generation_failure`で知らせる
            reason = classify_failure(exc).reason_code
            project.generation_failure = failure_record(
                reason, _failure_targets(project.mode, start_from), datetime.now(UTC)
            )
            await self._chat_histories.add(
                # Phase-69-1：更新
                # project_id=project_id,
                # sender="others",
                # message=(
                #     _QUOTA_MESSAGE if isinstance(exc, LLMQuotaExceededError) else _FAILED_MESSAGE
                # ),
                # ↓↓
                project_id=project_id, sender="others", message=_FAILURE_MESSAGES[reason]
            )
            # Phase-64-2：更新
            # await self._session.commit()
            # ↓↓
            await commit_if_live(self._session, project_id, job="documents")
            return

        project.status = "completed"
        # Phase-64-2：更新
        # await self._session.commit()
        # ↓↓
        # 生成中に削除されていたら、作った版ごと捨てる
        live = await commit_if_live(self._session, project_id, job="documents")
        # Phase-6-5:追記 ── ドキュメント生成完了(主要ライフサイクルイベント、内部設計書3.4節INFO)
        # Phase-15-1：更新
        # logger.info("documents_generated", project_id=str(project_id), doc_count=len(DOC_TYPES))
        # ↓↓
        # Phase-53(完了後の調整):追記
        await self._progress.clear(project_id)
        # Phase-64-2:追記
        if not live:
            return
        # Phase-53(完了後の調整)：更新
        # logger.info(
        #     "documents_generated", project_id=str(project_id), doc_count=len(generated)
        # )
        # ↓↓
        logger.info(
            "documents_generated",
            project_id=str(project_id),
            doc_count=len(targets),
            start_from=start_from,
        )
        # Phase-52-4:追記
        # Phase-56-2：更新
        # if reviewing and user is not None:
        # ↓↓
        if designed and reviewing and user is not None:
            await self._review_after_generation(project, user, generated, llm, review_llm)
            # Phase-54-2:追記
            await self._check_fixes(project_id, user, judge_llm)

    async def _check_fixes(self, project_id: uuid.UUID, user: User, judge_llm) -> None:
        """生成の後に、採用した指摘が直ったかを判定する(シャドーモード。失敗は生成を失敗に
        しない)。レビューで commit した後なので、プロジェクトは読み直す。"""
        try:
            project = await self._session.get(Project, project_id)
            if project is not None:
                await FixCheckService(self._session, redis=self._redis, llm=judge_llm).run_for(
                    project, user
                )
        except Exception as exc:  # noqa: BLE001 -- 判定の失敗は生成を失敗にしない
            await self._session.rollback()
            logger.warning(
                "fix_checks_after_generation_failed",
                project_id=str(project_id),
                error_type=type(exc).__name__,
            )

    async def _review_after_generation(
        self, project: Project, user: User, generated: dict[str, str], llm, review_llm
    ) -> None:
        """生成の後の設計レビュー。受け付けで止まった(上限・キー無し・実行中)ときは失敗の回を
        残し、実行で失敗したときと同じく、生成と同じモデルの自己診断に切り替える。"""
        project_id = project.id
        # Phase-64-2:追記
        if await project_vanished(self._session, project_id, job="documents_review"):
            return
        review = ReviewService(self._session, redis=self._redis, llm=review_llm)
        try:
            # Phase-53-1：更新
            # run = await review.start_documents_review(project, user, trigger="auto")
            # ↓↓
            run = await review.start_review(project, user, gate=DOCUMENTS_GATE, trigger="auto")
        except Exception as exc:  # noqa: BLE001 -- レビューの失敗は生成を失敗にしない
            if not isinstance(exc, AppError):
                # 想定外の失敗(DB など)だけ戻す。戻すと失効するプロジェクトは読み直す
                # (非同期では暗黙に読めない)
                await self._session.rollback()
                # Phase-64-2:追記
                if await project_vanished(self._session, project_id, job="documents_review"):
                    return  # レビューの受け付けの間に削除された
                project = await self._session.get(Project, project_id) or project
            await review.record_failed_start(project, trigger="auto", exc=exc)
            await self._fallback_self_diagnose(project_id, generated, llm)
            return
        finished = await review.execute(run.id)
        if finished is None or finished.status != "succeeded":
            await self._fallback_self_diagnose(project_id, generated, llm)

    async def _fallback_self_diagnose(
        self, project_id: uuid.UUID, generated: dict[str, str], llm
    ) -> None:
        """レビューに失敗したときの自己診断。これも失敗したらログだけ残す(文書は完了のまま)。"""
        try:
            diagnosis = await self._self_diagnose(generated, llm=llm)
        except Exception as exc:  # noqa: BLE001 -- 文書の生成は終わっているため、止めない
            logger.warning(
                "self_diagnosis_failed", project_id=str(project_id), error_type=type(exc).__name__
            )
            return
        await self._chat_histories.add(project_id=project_id, sender="others", message=diagnosis)
        # Phase-64-2：更新
        # await self._session.commit()
        # ↓↓
        await commit_if_live(self._session, project_id, job="self_diagnosis")

    # Phase-8-5:追記 ── ルーターがRepositoryを直接参照しない方針への統一(list_generated_documents用)
    async def list_current_documents(self, project_id: uuid.UUID) -> list[GeneratedDocument]:
        """生成された設計書(各doc_typeの現在表示中のバージョンのみ)一覧を取得する。"""
        return await self._documents.list_current_for_project(project_id)

    # Phase-8-5:追記 ── 同上(download_generated_document用。以前はルーターに所有権チェックが
    # 手書きされていた)
    async def get_document(self, *, project: Project, doc_id: uuid.UUID) -> GeneratedDocument:
        """指定ドキュメントを1件取得する(他プロジェクトのものは404扱い)。
        GeneratedDocumentRepositoryはProjectRepositoryのような所有権スコープの
        get_by_idを持たないため、その意味づけ(見つからなければNotFound)をここに集約する。"""
        document = await self._documents.get_by_id(doc_id)
        if document is None or document.project_id != project.id:
            raise DocumentNotFoundError(f"Document {doc_id} not found")
        return document

    # Phase-6-1:追記 ── SCR-006(バージョン履歴管理画面)向け。写経レベル: コア(復元の意味論
    # ─新バージョンとして追加、既存版は上書きしない─ は仕様診断#28で確定した設計判断のため)。
    async def list_versions(self, project_id: uuid.UUID, doc_type: str) -> list[GeneratedDocument]:
        """指定doc_typeの保管済み全バージョン(最大3件)を新しい順に返す。"""
        return await self._documents.list_versions(project_id=project_id, doc_type=doc_type)

    # Phase-88-1:追記
    async def change_request_numbers(
        self, documents: Sequence[GeneratedDocument]
    ) -> dict[uuid.UUID, int]:
        """版が反映した CR の id → 番号(版の履歴に「CR-N で反映」と出すため)。"""
        ids = {d.change_request_id for d in documents if d.change_request_id is not None}
        return await ChangeRequestRepository(self._session).numbers_by_id(ids)

    async def restore_version(
        self, project_id: uuid.UUID, doc_type: str, version: int
    ) -> GeneratedDocument:
        # Phase-6-6：更新(復元のたびに同じ内容のバージョンが増えていく不具合。「復元」は新しい版を
        # 作らず、表示中バージョン(is_current)を指定版へ付け替えるだけにした。新しい版が増えるのは
        # 再生成(generate→create_version)のときのみ)
        # """指定バージョンの内容を新バージョンとして追加する(既存版の上書きはしない、
        # create_versionのバージョニング方針との一貫性を保つ)。"""
        # target = await self._documents.get_version(
        #     project_id=project_id, doc_type=doc_type, version=version
        # )
        # if target is None:
        #     raise DocumentNotFoundError(f"{doc_type} version {version} not found")
        # restored = await self._documents.create_version(
        #     project_id=project_id, doc_type=doc_type, content=target.content
        # )
        # await self._session.commit()
        # return restored
        # ↓↓
        # Phase-13-2：更新(D1案Aの例外を明記)
        # """指定バージョンを表示中(is_current)に切り替える。バージョン番号は増やさず、新しい行も
        # 作らない(既存版の内容も書き換えない)。指定バージョンが存在しなければDocumentNotFoundError。"""
        # ↓↓
        """指定バージョンを表示中(is_current)に切り替える。バージョン番号は増やさず、新しい行も
        作らない(既存版の内容も書き換えない)。指定バージョンが存在しなければDocumentNotFoundError。
        既存版の内容を書き換える例外は1つだけ: 承認済みのUML図を内部設計書へ反映するとき
        (`GeneratedDocumentRepository.update_content_in_place`、D1案A)。復元した版には、その版を
        表示していた当時に反映した図のアンカーが残っている(陳腐化の判定はその`v=`で行う)。
        切り替える前に表示していた版と比べて、変更の影響を段階に記録する(model を持つ文書。
        Phase 43-3、簡易モードは Phase 46-2)。"""
        # Phase-43-3:追記
        previous = await self._documents.get_current(project_id=project_id, doc_type=doc_type)
        previous_model = previous.model if previous is not None else None
        restored = await self._documents.set_current(
            project_id=project_id, doc_type=doc_type, version=version
        )
        if restored is None:
            raise DocumentNotFoundError(f"{doc_type} version {version} not found")
        # Phase-43-3:追記
        project = await self._session.get(Project, project_id)
        if project is not None:
            await self._stages.record_document_change(
                project, doc_type, previous_model, restored.model
            )
        await self._session.commit()
        return restored

    # Phase-36-2:追記
    # Phase-91-3：更新
    # async def adopt_requirement(self, project: Project, req_id: str) -> GeneratedDocument:
    # ↓↓
    async def adopt_requirement(
        self, project: Project, req_id: str, *, recorded_by: uuid.UUID | None = None
    ) -> GeneratedDocument:
        """現在の版の要件定義書の推測の要件を、利用者が確かめた「採用」にする(LLMは呼ばない)。
        中身は`apply_adopt_requirement`で、ここで commit する。"""
        document = await self.apply_adopt_requirement(project, req_id, recorded_by=recorded_by)
        await self._session.commit()
        await self._session.refresh(document)
        return document

    # Phase-94-3:追記
    async def apply_adopt_requirement(
        self, project: Project, req_id: str, *, recorded_by: uuid.UUID | None = None
    ) -> GeneratedDocument:
        """推測の要件を「採用」にする(commit は呼ぶ側。確認事項の一覧からも使う)。

        同じ版の model と md を書き換え、版は増やさない(中身は変わらないので、後続の段階を
        古くしない)。詳細設計モードでは、採用した行を合意として記録し、確認事項の一覧の項目を
        確認済みにする(記録した人 = `recorded_by`)。生成中は409。要件が無い・model の無い版は
        404、推測でない要件は409。"""
        # Phase-94-3：更新(生成中・要件定義書の無いときの確かめは _requirements_for_adopt へ移した)
        # if project.status == "generating":
        #     raise DocGenerationInProgressError(
        #         "設計書を生成しています。完了してから再度お試しください。"
        #     )
        # document = await self._documents.get_current(
        #     project_id=project.id, doc_type="requirements"
        # )
        # if document is None:
        #     raise DocumentNotFoundError("requirements not found")
        # model = parse_requirements_model(document.model)
        # ↓↓
        document, model = await self._requirements_for_adopt(project)
        if model is None or all(row.id != req_id for row in model.rows):
            raise RequirementNotFoundError(f"Requirement {req_id} not found")
        adopted = mark_adopted(model, req_id)
        if adopted is None:
            raise RequirementNotAssumedError(f"Requirement {req_id} is not assumed")
        await self._documents.replace_model(
            document,
            content=render_requirements(adopted),
            model=adopted.model_dump(mode="json"),
        )
        # Phase-91-3:追記
        row = next(row for row in adopted.rows if row.id == req_id)
        await AgreementService(self._session).record_adopt(project, row, recorded_by=recorded_by)
        # Phase-94-3：更新
        # await self._session.commit()
        # await self._session.refresh(document)
        # ↓↓
        if project.mode == "detailed":
            await ConfirmationRepository(self._session).mark_confirmed(
                project.id, requirement_item(row), updated_by=recorded_by
            )
        return document

    # Phase-94-3:追記
    async def apply_adopt_user(
        # Phase-105-3：更新
        # self, project: Project, user: str, *, recorded_by: uuid.UUID | None = None
        # ↓↓
        self, project: Project, user_id: str, *, recorded_by: uuid.UUID | None = None
    ) -> GeneratedDocument:
        """推測の利用者と使う場面(1.2 の行。ID で指す)を「採用」にする(commit は
        呼ぶ側。確認事項の一覧から使う)。要件の採用と同じく版は増やさず、詳細設計モードでは
        1.2 全体を合意として記録し、確認事項の一覧の項目を確認済みにする。生成中は409。要件定義書・
        その行が無ければ404、推測でない行は409。"""
        document, model = await self._requirements_for_adopt(project)
        # Phase-105-3：更新
        # if model is None or all(u.user != user.strip() for u in model.users):
        #     raise RequirementNotFoundError(f"User scene {user} not found")
        # adopted = mark_user_adopted(model, user)
        # ↓↓
        if model is None or all(u.id != user_id.strip() for u in model.users):
            raise RequirementNotFoundError(f"User scene {user_id} not found")
        adopted = mark_user_adopted(model, user_id)
        if adopted is None:
            # Phase-105-3：更新
            # raise RequirementNotAssumedError(f"User scene {user} is not assumed")
            # ↓↓
            raise RequirementNotAssumedError(f"User scene {user_id} is not assumed")
        await self._documents.replace_model(
            document,
            content=render_requirements(adopted),
            model=adopted.model_dump(mode="json"),
        )
        if project.mode == "detailed":
            await AgreementService(self._session).record_adopt_users(
                project, adopted.users, recorded_by=recorded_by
            )
            # Phase-105-3：更新
            # scene = next(u for u in adopted.users if u.user == user.strip())
            # ↓↓
            scene = next(u for u in adopted.users if u.id == user_id.strip())
            await ConfirmationRepository(self._session).mark_confirmed(
                project.id, user_item(scene), updated_by=recorded_by
            )
        return document

    # Phase-106-2:追記
    async def _reopen_confirmations(
        self,
        project: Project,
        change_request: ChangeRequest,
        previous: dict | None,
        new: dict | None,
    ) -> None:
        """CR の反映で文が変わった対象の要件の確認事項を、確認済みから未確認に戻す(戻した CR の
        番号を残す。共有リンクで合意した CR も同じ。再生成の文は案の文と同じとは限らないため)。
        生成と同じトランザクションで、commit しない。"""
        keys = changed_requirement_keys(
            parse_requirements_model(previous),
            parse_requirements_model(new),
            [target.requirement_id for target in targets_from_json(change_request.targets)],
        )
        reopened = await ConfirmationRepository(self._session).reopen(
            project.id, keys, change_request_number=change_request.number
        )
        if reopened:
            logger.info(
                "confirmations_reopened",
                project_id=str(project.id),
                change_request=change_request.number,
                keys=reopened,
            )

    # Phase-94-3:追記
    async def _requirements_for_adopt(
        self, project: Project
    ) -> tuple[GeneratedDocument, RequirementsModel | None]:
        """採用の対象の、現在の版の要件定義書と model。生成中は409、要件定義書が無ければ404。"""
        if project.status == "generating":
            raise DocGenerationInProgressError(
                "設計書を生成しています。完了してから再度お試しください。"
            )
        document = await self._documents.get_current(
            project_id=project.id, doc_type="requirements"
        )
        if document is None:
            raise DocumentNotFoundError("requirements not found")
        return document, parse_requirements_model(document.model)

    async def _generate_requirements(
        # Phase-54-2：更新
        # self, project: Project, transcript: str, *, llm
        # ↓↓
        # Phase-92-3：更新
        # self, project: Project, transcript: str, instruction: str = "", *, llm
        # ) -> tuple[str, RequirementsModel]:
        # ↓↓
        self,
        project: Project,
        transcript: str,
        instruction: str = "",
        change_request: ChangeRequest | None = None,
        *,
        llm,
    ) -> tuple[str, RequirementsModel, list[dict] | None]:
        """要件定義書を構造化出力で下書きし、model と md を作る。入力は会話・観点の表・前の版の
        要件(ID を引き継ぐため)。出どころは観点の状態を上限に直す(app/documents/requirements)。

        詳細設計モードでは、合意済みの要件の行と利用者(1.2)を守る(docs/external_design.md
        2.15節)。プロンプトで「変えない行」として渡し、組み立ての後に合意の形へ戻す
        (app/agreements/protection.py)。反映する CR(`change_request`)の対象の要件は書き換えて
        よい。戻した要素の一覧を3つ目に返す(簡易ドキュメントモードは None)。"""
        states = await self._hearing_points.load_states(project.id)
        scale = as_scale(project.hearing_scale)
        current = await self._documents.get_current(
            project_id=project.id, doc_type="requirements"
        )
        previous = parse_requirements_model(current.model if current else None)
        # Phase-54-2：更新
        # messages = build_requirements_messages(transcript, states, scale, previous)
        # ↓↓
        # Phase-92-3：更新
        # messages = build_requirements_messages(transcript, states, scale, previous, instruction)
        # ↓↓
        agreed = await self._agreed_elements(project)
        # Phase-93-3：更新
        # exempt = frozenset(
        #     requirement_key(target.requirement_id)
        #     for target in targets_from_json(change_request.targets if change_request else None)
        # )
        # ↓↓
        exempt = _rewritable(change_request)
        agreed_ids = agreed_requirement_ids(agreed or {}, exempt)
        agreed_users = (
            [UserScene.model_validate(u) for u in agreed[USERS_KEY]["users"]]
            if agreed and USERS_KEY in agreed
            else []
        )
        messages = build_requirements_messages(
            transcript,
            states,
            scale,
            previous,
            instruction,
            agreed_ids=agreed_ids,
            agreed_users=agreed_users,
        )
        output = await invoke_structured(llm, RequirementsGenerationOutput, messages)
        # Phase-92-3：更新
        # model = build_model(to_draft(output), previous, states, scale)
        # return render_requirements(model), model
        # ↓↓
        model = build_model(to_draft(output), previous, states, scale, agreed_ids=agreed_ids)
        if agreed is None:
            return render_requirements(model), model, None
        model, restored = protect_requirements(model, previous, agreed, exempt=exempt)
        protection = [{"key": r.key, "reason": r.reason} for r in restored]
        return render_requirements(model), model, protection

    async def _agreed_elements(self, project: Project) -> dict[str, dict] | None:
        """今の合意(キー → 合意した中身)。合意は詳細設計モードの機能なので、簡易ドキュメント
        モードは None(合意を読まず、守らない)。"""
        if project.mode != "detailed":
            return None
        records = await AgreementService(self._session).current(project)
        return {r.key: r.content for r in records if r.content is not None}

    async def _generate_external_design(
        self,
        project: Project,
        requirements_md: str,
        requirements: RequirementsModel | None,
        # Phase-49-3:追記
        changed_upstream: list[str],
        # Phase-54-2:追記
        instruction: str = "",
        # Phase-93-3:追記
        change_request: ChangeRequest | None = None,
        *,
        llm,
    # Phase-93-3：更新
    # ) -> tuple[str, ExternalDesignModel]:
    # ↓↓
    ) -> tuple[str, ExternalDesignModel, list[dict] | None]:
        """外部設計書を構造化出力で下書きし、model と md を作る。入力は要件定義書の md、前の版の
        画面・API・外部連携(画面ID を引き継ぎ、変えない行をそのまま使うため)と、要件定義書の
        変わった行。要件ID の照合用に要件定義書の model を写す(app/documents/external_design)。

        詳細設計モードでは、合意済みの画面・API・外部連携を守る(要件定義書と同じ。
        docs/external_design.md 2.15節)。反映する CR(`change_request`)の保存した予測の画面・API
        は書き換えてよい。戻した要素の一覧を3つ目に返す(簡易ドキュメントモードは None)。"""
        current = await self._documents.get_current(
            project_id=project.id, doc_type="external_design"
        )
        previous = parse_external_design_model(current.model if current else None)
        # Phase-49-3：更新
        # messages = build_external_design_messages(requirements_md, previous)
        # ↓↓
        # Phase-54-2：更新
        # messages = build_external_design_messages(requirements_md, previous, changed_upstream)
        # ↓↓
        # Phase-93-3:追記
        agreed = await self._agreed_elements(project)
        exempt = _rewritable(change_request)
        ids = agreed_external_ids(agreed or {}, exempt)
        messages = build_external_design_messages(
            # Phase-93-3：更新
            # requirements_md, previous, changed_upstream, instruction
            # ↓↓
            requirements_md,
            previous,
            changed_upstream,
            instruction,
            agreed_screen_ids=ids.screen_ids,
            agreed_endpoints=ids.endpoints,
            agreed_services=ids.services,
        )
        output = await invoke_structured(llm, ExternalDesignGenerationOutput, messages)
        model = build_external_design_model(
            to_external_design_draft(output), previous, requirements
        )
        # Phase-45-3：更新
        # return render_external_design(model), model.model_dump(mode="json")
        # ↓↓
        # Phase-93-3：更新
        # return render_external_design(model), model
        # ↓↓
        if agreed is None:
            return render_external_design(model), model, None
        model, restored = protect_external_design(model, previous, agreed, exempt=exempt)
        protection = [{"key": r.key, "reason": r.reason} for r in restored]
        return render_external_design(model), model, protection

    async def _generate_internal_design(
        self,
        project: Project,
        generated: dict[str, str],
        external: ExternalDesignModel | None,
        # Phase-49-3:追記
        changed_upstream: list[str],
        # Phase-54-2:追記
        instruction: str = "",
        *,
        llm,
    ) -> tuple[str, InternalDesignModel]:
        """内部設計書を構造化出力で下書きし、model と md を作る(app/documents/internal_design)。
        入力は要件定義書・外部設計書の md、前の版の行と上流の変わった行。処理別データフローの ID
        は前の版の model から引き継ぎ、外部設計書の API(検証が照らす)は外部設計書の model から
        写す。"""
        current = await self._documents.get_current(
            project_id=project.id, doc_type="internal_design"
        )
        # Phase-45-3：更新
        # messages = [
        #     SystemMessage(content=system_prompt),
        #     HumanMessage(content=human_content),
        # ]
        # ↓↓
        previous = parse_internal_design_model(current.model if current else None)
        messages = build_internal_design_messages(
            # Phase-49-3：更新
            # generated["requirements"], generated["external_design"]
            # ↓↓
            # Phase-54-2：更新
            # generated["requirements"], generated["external_design"], previous, changed_upstream
            # ↓↓
            generated["requirements"],
            generated["external_design"],
            previous,
            changed_upstream,
            instruction,
        )
        output = await invoke_structured(llm, InternalDesignGenerationOutput, messages)
        apis = [a.label for a in external.apis] if external else []
        model = build_internal_design_model(to_internal_design_draft(output), previous, apis)
        return render_internal_design(model), model

    # Phase-45-3：更新
    #     async def _call() -> str:
    #         response = await llm.ainvoke(messages)
    #         return _collapse_doubled_headings(extract_text_content(response.content))
    #
    #     return await invoke_with_retry(_call, messages=messages)
    #
    # ↓↓
    async def _generate_implementation_plan(
        self,
        project: Project,
        generated: dict[str, str],
        requirements: RequirementsModel | None,
        internal: InternalDesignModel | None,
        # Phase-49-3:追記
        changed_upstream: list[str],
        # Phase-54-2:追記
        instruction: str = "",
        *,
        llm,
    ) -> tuple[str, ImplementationPlanModel]:
        """実装計画書を構造化出力で下書きし、model と md を作る(app/documents/implementation_plan)。
        入力は要件定義書・内部設計書の md、前の版のタスクと上流の変わった行。タスクのキーは前の版の
        model から引き継ぎ、処理別データフローの ID と要件ID(検証が照らす)は内部設計書・
        要件定義書の model から写す。"""
        current = await self._documents.get_current(
            project_id=project.id, doc_type="implementation_plan"
        )
        previous = parse_implementation_plan_model(current.model if current else None)
        messages = build_implementation_plan_messages(
            # Phase-49-3：更新
            # generated["requirements"], generated["internal_design"]
            # ↓↓
            # Phase-54-2：更新
            # generated["requirements"], generated["internal_design"], previous, changed_upstream
            # ↓↓
            generated["requirements"],
            generated["internal_design"],
            previous,
            changed_upstream,
            instruction,
        )
        output = await invoke_structured(llm, ImplementationPlanGenerationOutput, messages)
        model = build_implementation_plan_model(
            to_implementation_plan_draft(output),
            previous,
            dataflow_ids=[f.id for f in internal.dataflows] if internal else [],
            requirements=requirements,
        )
        return render_implementation_plan(model), model

    # Phase-56-2:追記
    async def _generate_test_spec(
        self,
        project: Project,
        generated: Mapping[str, str],
        requirements: RequirementsModel | None,
        external: ExternalDesignModel | None,
        internal: InternalDesignModel | None,
        plan: ImplementationPlanModel | None,
        *,
        llm,
    ) -> tuple[str, TestSpecModel]:
        """テスト仕様書を構造化出力で下書きし、model と md を作る(app/documents/test_spec)。
        入力は要件定義書の md と外部設計書の画面・API の行、コードが決めた必要なテストの一覧。
        処理・単位は、簡易は内部設計書・実装計画書、詳細は段階1・段階7 から引く。生成した時点の
        入力の版を model に写す(「古い」の判定)。"""
        if project.mode == "detailed":
            # Phase-57-1：更新
            # approved = await self._stages.approved_stages(project, _TEST_SPEC_STAGES)
            # ↓↓
            approved = await self._stages.approved_stages(project, TEST_SPEC_STAGES)
            links = detailed_links(
                _parse(FunctionListModel, approved.get(FUNCTION_STAGE)),
                _parse(PlanModel, approved.get(PLAN_STAGE)),
            )
        else:
            links = simple_links(internal, plan)
        obligations = required_tests(requirements, external or ExternalDesignModel())
        messages = build_test_spec_messages(generated["requirements"], external, obligations)
        output = await invoke_structured(llm, TestSpecGenerationOutput, messages)
        model = build_test_spec_model(
            to_test_spec_draft(output),
            requirements=requirements,
            external=external,
            links=links,
            # Phase-57-1：更新
            # inputs=await self._test_spec_inputs(project),
            # ↓↓
            inputs=await spec_inputs(self._session, project),
        )
        return render_test_spec(model), model

    # Phase-57-1：削除(テスト仕様書の入力の版は app/services/test_spec_state.py の spec_inputs へ移した。zip も使うため)
    # async def _test_spec_inputs(self, project: Project) -> dict[str, int | None]:
    #     """テスト仕様書の入力の今の版(簡易は4文書、詳細は要件・外部と段階1・段階7 の承認した版。
    #     承認されていない・古い段階は None)。"""
    #     inputs: dict[str, int | None] = {}
    #     for doc_type in DOC_TYPES_BY_MODE[project.mode]:
    #         current = await self._documents.get_current(project_id=project.id, doc_type=doc_type)
    #         inputs[doc_key(doc_type)] = current.version if current is not None else None
    #     if project.mode == "detailed":
    #         approved = await self._stages.approved_stages(project, _TEST_SPEC_STAGES)
    #         for stage in _TEST_SPEC_STAGES:
    #             inputs[stage_key(stage)] = approved[stage][0] if stage in approved else None
    #     return inputs

    async def get_test_spec(self, project: Project) -> TestSpecRead:
        """テスト仕様書の今の版と、件数・検証の指摘・古いか。まだ無ければ`DocumentNotFoundError`。
        model の無い・壊れた版は件数0・指摘なし・古くない、とする。"""
        # Phase-57-1：更新
        # document = await self._documents.get_current(project_id=project.id, doc_type=TEST_SPEC)
        # if document is None:
        # ↓↓
        current = await current_test_spec(self._session, project)
        if current is None:
            raise DocumentNotFoundError("test_spec not found")
        # Phase-57-1：削除
        # model = _parse(TestSpecModel, document.model) or TestSpecModel()
        return TestSpecRead(
            # Phase-57-1：更新
            # document=document_read(document),
            # counts=test_spec_counts(model),
            # issues=_issues_read(validate_test_spec(model)),
            # outdated=is_outdated(model, await self._test_spec_inputs(project)),
            # ↓↓
            document=document_read(current.document),
            counts=test_spec_counts(current.model),
            issues=_issues_read(validate_test_spec(current.model)),
            outdated=current.outdated,
            # Phase-57-2:追記
            design_gaps=design_gap_count(current.model),
        )

    async def _self_diagnose(self, generated: dict[str, str], *, llm) -> str:
        # Phase-2-5：更新
        # """生成済みの4文書をまとめて入力し、不足・不明瞭な点を3段階で自己診断させる。"""
        # combined = "\n\n".join(
        #     f"## {_DOC_TYPE_LABELS[doc_type]}\n{content}" for doc_type, content in generated.items()
        # )
        # messages = [
        #     SystemMessage(content=_SELF_DIAGNOSIS_SYSTEM_PROMPT),
        #     HumanMessage(content=combined),
        # ]
        # response = await llm.ainvoke(messages)
        # return str(response.content)
        # ↓↓
        # Phase-15-1：更新
        # """生成済みの4文書をまとめて入力し、不足・不明瞭な点を3段階で自己診断させる。"""
        # ↓↓
        """生成済みの文書(モードにより4種または2種)をまとめて入力し、不足・不明瞭な点を
        3段階で自己診断させる。"""
        combined = "\n\n".join(
            f"## {_DOC_TYPE_LABELS[doc_type]}\n{content}" for doc_type, content in generated.items()
        )
        messages = [
            SystemMessage(content=_SELF_DIAGNOSIS_SYSTEM_PROMPT),
            HumanMessage(content=combined),
        ]

        async def _call() -> str:
            response = await llm.ainvoke(messages)
            return extract_text_content(response.content)

        return await invoke_with_retry(_call, messages=messages)


# Phase-53(完了後の調整):追記
def generation_targets(mode: str, start_from: str | None) -> tuple[str, ...]:
    """再生成で作り直す文書(起点から下流。上流 → 下流の順)。起点が無ければモードの全部。
    下流は上流を入力にして作るので、起点を作り直したら下流も必ず作り直す(整合を保つため)。
    モードに無い起点は`GenerationStartInvalidError`(400)。

    テスト仕様書は最下流。簡易モードは設計書に続けて必ず作り直し、詳細設計モードは段階7の
    承認の後に`start_from="test_spec"`でだけ作る(設計書の再生成では作らない)。"""
    doc_types = DOC_TYPES_BY_MODE[mode]
    # Phase-56-2：更新
    # if start_from is None:
    #     return doc_types
    # if start_from not in doc_types:
    # ↓↓
    if start_from == TEST_SPEC:
        return (TEST_SPEC,)
    if start_from is not None and start_from not in doc_types:
        raise GenerationStartInvalidError("このモードには無い設計書から再生成しようとしました。")
    # Phase-56-2：更新
    # return doc_types[doc_types.index(start_from) :]
    # ↓↓
    targets = doc_types if start_from is None else doc_types[doc_types.index(start_from) :]
    return (*targets, TEST_SPEC) if mode == "simple" else targets


# Phase-69-1:追記
def _failure_targets(mode: str, start_from: str | None) -> tuple[str, ...]:
    """失敗の記録に書く「作り直そうとした文書」。起点がモードに無ければ(その失敗自体)モードの全部。"""
    try:
        return generation_targets(mode, start_from)
    except GenerationStartInvalidError:
        return generation_targets(mode, None)


def _render_transcript(history: list[ChatHistory]) -> str:
    """chat_historiesを、ドキュメント生成プロンプトに埋め込むための読みやすいテキストに変換する。
    sender='others'(過去の自己診断結果)は生成の入力には含めない。"""
    _SPEAKER_LABELS = {"user": "ユーザー", "ai": "AI", "intake": "初期入力", "attachment": "添付資料"}
    lines = [
        f"[{_SPEAKER_LABELS.get(entry.sender, entry.sender)}] {entry.message}"
        for entry in history
        if entry.sender != "others"
    ]
    return "\n".join(lines)


# Phase-49-3:追記
# Phase-93-3:追記
def _rewritable(change_request: ChangeRequest | None) -> frozenset[str]:
    """反映する CR で書き換えてよい要素のキー(合意済みの要素の保護から外す)。CR が無ければ空。"""
    if change_request is None:
        return frozenset()
    return rewritable_keys(
        targets_from_json(change_request.targets), change_request.predicted_impact
    )


def upstream_changes(
    doc_type: str,
    previous_models: Mapping[str, dict | None],
    requirements: RequirementsModel | None,
    external: ExternalDesignModel | None,
    internal: InternalDesignModel | None,
) -> list[str]:
    """文書の上流(_DOC_TYPE_INPUTS)で、前の版から今回の生成で変わった行(後続の再生成を前の版の
    差分にとどめる手がかり。app/documents/revision.py)。上流の前の版が無ければ空。"""
    rows = {
        "requirements": (
            requirement_rows(parse_requirements_model(previous_models.get("requirements"))),
            requirement_rows(requirements),
        ),
        "external_design": (
            external_design_rows(
                parse_external_design_model(previous_models.get("external_design"))
            ),
            external_design_rows(external),
        ),
        "internal_design": (
            internal_design_rows(
                parse_internal_design_model(previous_models.get("internal_design"))
            ),
            internal_design_rows(internal),
        ),
    }
    return [
        change
        for upstream in _DOC_TYPE_INPUTS.get(doc_type, ())
        for change in changed_rows(*rows[upstream])
    ]


# Phase-56-2:追記
def _parse[M: BaseModel](model_type: type[M], raw: Mapping | tuple | None) -> M | None:
    """保存した model を読む。無い・壊れていれば None。段階は(承認した版, 内容)の組も受ける。"""
    if isinstance(raw, tuple):
        raw = raw[1]
    if raw is None:
        return None
    try:
        return model_type.model_validate(raw)
    except ValidationError:
        return None


# Phase-36-2:追記
def parse_requirements_model(raw: dict | None) -> RequirementsModel | None:
    """保存した model を読む。無い・壊れていれば None(md のまま使う)。"""
    if raw is None:
        return None
    try:
        return RequirementsModel.model_validate(raw)
    except ValidationError:
        return None


def requirements_summary(document: GeneratedDocument) -> RequirementsSummaryRead | None:
    """プレビューに出す要件定義書の出どころの件数・推測の要件・検証の指摘(LLMは呼ばない)。
    model の無い版・ほかの文書は None。"""
    if document.doc_type != "requirements":
        return None
    model = parse_requirements_model(document.model)
    if model is None:
        return None
    return RequirementsSummaryRead(
        counts={**source_counts(model)},
        assumed=[
            AssumedRequirementRead(id=r.id, kind=r.kind, text=r.text)
            for r in model.rows
            if r.source == "assumed"
        ],
        # Phase-37-2：更新
        # issues=[
        #     RequirementIssueRead(
        #         level=i.level, code=i.code, message=i.message, targets=list(i.targets)
        #     )
        #     for i in validate_requirements(model)
        # ],
        # ↓↓
        issues=_issues_read(validate_requirements(model)),
    )


# Phase-37-2:追記
def parse_external_design_model(raw: dict | None) -> ExternalDesignModel | None:
    """保存した外部設計書の model を読む。無い・壊れていれば None(md のまま使う)。"""
    if raw is None:
        return None
    try:
        return ExternalDesignModel.model_validate(raw)
    except ValidationError:
        return None


def external_design_summary(document: GeneratedDocument) -> ExternalDesignSummaryRead | None:
    """プレビューに出す外部設計書の行数と検証の指摘(LLMは呼ばない)。model の無い版・ほかの
    文書は None。"""
    if document.doc_type != "external_design":
        return None
    model = parse_external_design_model(document.model)
    if model is None:
        return None
    return ExternalDesignSummaryRead(
        counts=row_counts(model), issues=_issues_read(validate_external_design(model))
    )


# Phase-45-3:追記
def parse_internal_design_model(raw: dict | None) -> InternalDesignModel | None:
    """保存した内部設計書の model を読む。無い・壊れていれば None(md のまま使う)。"""
    if raw is None:
        return None
    try:
        return InternalDesignModel.model_validate(raw)
    except ValidationError:
        return None


def parse_implementation_plan_model(raw: dict | None) -> ImplementationPlanModel | None:
    """保存した実装計画書の model を読む。無い・壊れていれば None(md のまま使う)。"""
    if raw is None:
        return None
    try:
        return ImplementationPlanModel.model_validate(raw)
    except ValidationError:
        return None


def internal_design_summary(document: GeneratedDocument) -> DocumentSummaryRead | None:
    """プレビューに出す内部設計書の行数と検証の指摘(LLMは呼ばない)。model の無い版・ほかの
    文書は None。"""
    if document.doc_type != "internal_design":
        return None
    model = parse_internal_design_model(document.model)
    if model is None:
        return None
    return DocumentSummaryRead(
        counts=internal_design_counts(model),
        issues=_issues_read(validate_internal_design(model)),
    )


def implementation_plan_summary(document: GeneratedDocument) -> DocumentSummaryRead | None:
    """プレビューに出す実装計画書の行数と検証の指摘(LLMは呼ばない)。model の無い版・ほかの
    文書は None。"""
    if document.doc_type != "implementation_plan":
        return None
    model = parse_implementation_plan_model(document.model)
    if model is None:
        return None
    return DocumentSummaryRead(
        counts=implementation_plan_counts(model),
        issues=_issues_read(validate_implementation_plan(model)),
    )


def _issues_read(issues: list[DocumentIssue]) -> list[DocumentIssueRead]:
    return [
        DocumentIssueRead(level=i.level, code=i.code, message=i.message, targets=list(i.targets))
        for i in issues
    ]


def document_read(
    document: GeneratedDocument, change_request_number: int | None = None
) -> GeneratedDocumentRead:
    # Phase-37-2：更新
    # """文書の応答。要件定義書は出どころの件数・推測の要件・検証の指摘を付ける。"""
    # ↓↓
    """文書の応答。要件定義書は出どころの件数・推測の要件・検証の指摘を、外部設計書・内部設計書・
    実装計画書は行数と検証の指摘を付ける。反映した CR の番号は、読んだ呼び手が渡す(版の履歴)。"""
    read = GeneratedDocumentRead.model_validate(document)
    # Phase-88-1:追記
    read.change_request_number = change_request_number
    read.requirements = requirements_summary(document)
    # Phase-37-2:追記
    read.external_design = external_design_summary(document)
    # Phase-45-3:追記
    read.internal_design = internal_design_summary(document)
    read.implementation_plan = implementation_plan_summary(document)
    return read
