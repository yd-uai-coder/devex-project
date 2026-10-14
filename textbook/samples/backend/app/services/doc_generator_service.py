# 作成：Phase-2-4｜更新：Phase-2-5,6-1,6-5,6-6,8-5,10-1,13-2,15-1,15-3,16-1,24(ゴール3後の調整),31-1,36-2,37-2,38-2,40-1,43-3,45-3,46-2,49-3,52-4,53-1,53(完了後の調整),54-2,54-5
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
import uuid
from collections.abc import Mapping, Sequence
from datetime import UTC, datetime

import structlog
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import ValidationError
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.llm.gemini import extract_text_content, get_gemini_llm
from app.core.database import AsyncSessionLocal
from app.core.errors import AppError
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
    build_model,
    mark_adopted,
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
from app.hearing import as_scale
from app.infrastructure.redis import get_redis_client
from app.models.chat_history import ChatHistory
from app.models.generated_document import GeneratedDocument
from app.models.project import Project
from app.models.user import User
from app.repositories.chat_history import ChatHistoryRepository
from app.repositories.generated_document import (
    DOC_TYPES_BY_MODE,
    GeneratedDocumentRepository,
)
from app.repositories.hearing_point import HearingPointRepository
from app.repositories.project import ProjectRepository
from app.review import (
    DOCUMENTS_GATE,
    build_instruction,
    findings_for,
    review_effective,
)
from app.schemas.document import (
    AssumedRequirementRead,
    DocumentIssueRead,
    DocumentSummaryRead,
    ExternalDesignSummaryRead,
    GeneratedDocumentRead,
    RequirementsSummaryRead,
)
from app.services.design_stage_service import DesignStageService
from app.services.errors import (
    DocGenerationInProgressError,    DocumentNotFoundError,    GenerationStartInvalidError,    GenerationUpstreamMissingError,    LLMQuotaExceededError,    RequirementNotAssumedError,    RequirementNotFoundError,
)
from app.services.fix_check_service import FixCheckService
from app.services.generation_progress import GenerationProgress, GenerationProgressStore
from app.services.generation_staleness import is_stale
from app.services.llm_retry import invoke_structured, invoke_with_retry
from app.services.review_service import ReviewService

logger = structlog.get_logger(__name__)

_DOC_TYPE_LABELS: dict[str, str] = {
    "requirements": "要件定義書",
    "external_design": "外部設計書",
    "internal_design": "内部設計書",
    "implementation_plan": "実装計画書",
}

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
# 生成の失敗・中断をチャットに残す文言(生の例外の文字列は利用者に見せず、ログにだけ残す)
_QUOTA_MESSAGE = "本日の利用上限に達しました。時間をおいて再度お試しください。"
_FAILED_MESSAGE = "設計書の生成に失敗しました。時間をおいて再度お試しください。"
_STALE_MESSAGE = (
    "設計書の生成が時間内に終わらなかったため、中断しました。もう一度生成してください。"
)


# Phase-15-3：更新(受け付けたときの状態を受け取る。Phase-2-4でuser_idを足した経緯はPhase-2-4.md参照)
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
    llm=None,
) -> None:
    """`BackgroundTasks`から呼び出すエントリポイント。`start_from`は再生成の起点(省略で全部)、
    `finding_ids`は再生成の指示に入れる採用した指摘。

    FastAPI 0.106以降、`yield`を使うDIのセッション(SessionDep)はbackground task実行"前"に
    クローズされるため、background task内でリクエストのセッションをそのまま使うことはできない。
    そのためこの関数はセッションを自前で開始・終了する(公式ドキュメントの推奨パターン:
    "pass identifiers ... retrieve the necessary objects inside the background task itself")。

    project_idに加えuser_idも受け取るのは、所有者チェック無しの専用メソッド(get_by_id_unscoped)を
    リポジトリに増やすのではなく、既存の所有者スコープ版get_by_idへ統一するため。project_id・
    user_idはどちらも値であり、セッションのようにリクエストのライフサイクルに紐づくものではない
    ため、background taskへ渡すこと自体に技術的な制約は無い。
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
                llm=llm,
            )
    finally:
        await redis.aclose()


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
    ) -> str:
        """生成の要求を受け付け、`status`を`generating`にしてcommitする。戻り値は受け付ける前の状態
        (失敗したときに戻す先。バックグラウンドの`generate`へ渡す)。

        `start_from`は再生成の起点(その文書から下流を作り直す。省略で全部)。モードに無い起点は
        `GenerationStartInvalidError`(400)、起点より上流の文書がまだ無ければ
        `GenerationUpstreamMissingError`(409)。`finding_ids`(再生成の指示に入れる指摘)に
        プロジェクトに無い指摘があれば`ReviewFindingNotFoundError`(404)、採用していない・ヒアリングが
        原因の指摘があれば`SendbackFindingInvalidError`(409)。

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
        # Phase-54-2:追記
        await ReviewService(self._session).sendback_findings(
            project.id, finding_ids, strict=True
        )
        await self.recover_if_stale(project)
        if project.status == "generating":
            raise DocGenerationInProgressError(
                "設計書を生成しています。完了してから再度お試しください。"
            )
        status_before_generation = project.status
        project.status = "generating"
        await self._session.commit()
        # updated_at(生成を始めた時刻。回収の判定に使う)はDB側で決まるため読み直す
        await self._session.refresh(project)
        return status_before_generation

    async def recover_if_stale(self, project: Project, *, now: datetime | None = None) -> bool:
        """しきい値(15分)を超えて`generating`のままのプロジェクトを、生成前の状態へ戻す
        (app/services/generation_staleness.py)。戻した場合はTrue。

        生成前の状態は記録していないため、文書が既にあれば`revising`、無ければ`interviewing`にする
        (どちらも再度「生成する」を押せる状態)。中断したことはチャットに残す。"""
        if project.status != "generating":
            return False
        # updated_at はDB側で更新されるため、失効していれば読み直す(非同期では暗黙に読めない)
        await self._session.refresh(project, ["updated_at"])
        if not is_stale(project.updated_at, now or datetime.now(UTC)):
            return False
        has_documents = bool(await self._documents.list_current_for_project(project.id))
        project.status = "revising" if has_documents else "interviewing"
        await self._chat_histories.add(
            project_id=project.id, sender="others", message=_STALE_MESSAGE
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
        reviewing = user is not None and review_effective(
            is_superuser=user.is_superuser, review_enabled=user.review_enabled
        )

        try:
            llm = llm or get_gemini_llm()
            # Phase-54-2:追記
            sendback = await ReviewService(self._session).sendback_findings(
                project_id, finding_ids
            )
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
                    continue
                progress.current = doc_type
                await self._progress.write(project_id, progress)
                # Phase-36-2：更新
                # content = await self._generate_one(doc_type, transcript, generated, llm=llm)
                # ↓↓
                model: dict | None = None
                # Phase-49-3:追記
                # 再生成を前の版の差分にとどめるため、上流の文書で変わった行を渡す
                changed = upstream_changes(
                    doc_type, previous_models, requirements, external, internal
                )
                # Phase-54-2:追記
                instruction = build_instruction(findings_for([doc_type], sendback))
                if doc_type == "requirements":
                    # Phase-37-2：更新
                    # content, model = await self._generate_requirements(
                    # ↓↓
                    content, requirements = await self._generate_requirements(
                        # Phase-54-2：更新
                        # project, transcript, llm=llm
                        # ↓↓
                        project, transcript, instruction, llm=llm
                    # Phase-37-2:追記
                    )
                    model = requirements.model_dump(mode="json")
                elif doc_type == "external_design":
                    # Phase-45-3：更新
                    # content, model = await self._generate_external_design(
                    # ↓↓
                    content, external = await self._generate_external_design(
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
                await self._documents.create_version(
                    # Phase-36-2：更新
                    # project_id=project_id, doc_type=doc_type, content=content
                    # ↓↓
                    project_id=project_id, doc_type=doc_type, content=content, model=model
                )
                generated[doc_type] = content
                # Phase-43-3:追記
                new_models[doc_type] = model
                # Phase-53(完了後の調整):追記
                progress.done.append(doc_type)
            progress.current = None
            await self._progress.write(project_id, progress)
            # Phase-53(完了後の調整)：更新
            # for doc_type in doc_types:
            # ↓↓
            for doc_type in targets:
                await self._stages.record_document_change(
                    project, doc_type, previous_models[doc_type], new_models[doc_type]
                )

            # Phase-52-4：更新
            # diagnosis = await self._self_diagnose(generated, llm=llm)
            # await self._chat_histories.add(
            #     project_id=project_id, sender="others", message=diagnosis
            # )
            # ↓↓
            if not reviewing:
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
            # ユーザーに分かりやすい専用メッセージを表示する。
            await self._chat_histories.add(
                project_id=project_id,
                sender="others",
                message=(
                    _QUOTA_MESSAGE if isinstance(exc, LLMQuotaExceededError) else _FAILED_MESSAGE
                ),
            )
            await self._session.commit()
            return

        project.status = "completed"
        await self._session.commit()
        # Phase-6-5:追記 ── ドキュメント生成完了(主要ライフサイクルイベント、内部設計書3.4節INFO)
        # Phase-15-1：更新
        # logger.info("documents_generated", project_id=str(project_id), doc_count=len(DOC_TYPES))
        # ↓↓
        # Phase-53(完了後の調整):追記
        await self._progress.clear(project_id)
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
        if reviewing and user is not None:
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
        await self._session.commit()

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
    async def adopt_requirement(self, project: Project, req_id: str) -> GeneratedDocument:
        """現在の版の要件定義書の推測の要件を、利用者が確かめた「採用」にする(LLMは呼ばない)。

        同じ版の model と md を書き換え、版は増やさない(中身は変わらないので、後続の段階を
        古くしない)。生成中は409。要件が無い・model の無い版は404、推測でない要件は409。"""
        if project.status == "generating":
            raise DocGenerationInProgressError(
                "設計書を生成しています。完了してから再度お試しください。"
            )
        document = await self._documents.get_current(
            project_id=project.id, doc_type="requirements"
        )
        if document is None:
            raise DocumentNotFoundError("requirements not found")
        model = parse_requirements_model(document.model)
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
        await self._session.commit()
        await self._session.refresh(document)
        return document

    async def _generate_requirements(
        # Phase-54-2：更新
        # self, project: Project, transcript: str, *, llm
        # ↓↓
        self, project: Project, transcript: str, instruction: str = "", *, llm
    ) -> tuple[str, RequirementsModel]:
        """要件定義書を構造化出力で下書きし、model と md を作る。入力は会話・観点の表・前の版の
        要件(ID を引き継ぐため)。出どころは観点の状態を上限に直す(app/documents/requirements)。"""
        states = await self._hearing_points.load_states(project.id)
        scale = as_scale(project.hearing_scale)
        current = await self._documents.get_current(
            project_id=project.id, doc_type="requirements"
        )
        previous = parse_requirements_model(current.model if current else None)
        # Phase-54-2：更新
        # messages = build_requirements_messages(transcript, states, scale, previous)
        # ↓↓
        messages = build_requirements_messages(transcript, states, scale, previous, instruction)
        output = await invoke_structured(llm, RequirementsGenerationOutput, messages)
        model = build_model(to_draft(output), previous, states, scale)
        # Phase-37-2：更新
        # return render_requirements(model), model.model_dump(mode="json")
        # ↓↓
        return render_requirements(model), model

    async def _generate_external_design(
        self,
        project: Project,
        requirements_md: str,
        requirements: RequirementsModel | None,
        # Phase-49-3:追記
        changed_upstream: list[str],
        # Phase-54-2:追記
        instruction: str = "",
        *,
        llm,
    ) -> tuple[str, ExternalDesignModel]:
        """外部設計書を構造化出力で下書きし、model と md を作る。入力は要件定義書の md、前の版の
        画面・API(画面ID を引き継ぎ、変えない行をそのまま使うため)と、要件定義書の変わった行。
        要件ID の照合用に要件定義書の model を写す(app/documents/external_design)。"""
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
        messages = build_external_design_messages(
            requirements_md, previous, changed_upstream, instruction
        )
        output = await invoke_structured(llm, ExternalDesignGenerationOutput, messages)
        model = build_external_design_model(
            to_external_design_draft(output), previous, requirements
        )
        # Phase-45-3：更新
        # return render_external_design(model), model.model_dump(mode="json")
        # ↓↓
        return render_external_design(model), model

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
    モードに無い起点は`GenerationStartInvalidError`(400)。"""
    doc_types = DOC_TYPES_BY_MODE[mode]
    if start_from is None:
        return doc_types
    if start_from not in doc_types:
        raise GenerationStartInvalidError("このモードには無い設計書から再生成しようとしました。")
    return doc_types[doc_types.index(start_from) :]


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


def document_read(document: GeneratedDocument) -> GeneratedDocumentRead:
    # Phase-37-2：更新
    # """文書の応答。要件定義書は出どころの件数・推測の要件・検証の指摘を付ける。"""
    # ↓↓
    """文書の応答。要件定義書は出どころの件数・推測の要件・検証の指摘を、外部設計書・内部設計書・
    実装計画書は行数と検証の指摘を付ける。"""
    read = GeneratedDocumentRead.model_validate(document)
    read.requirements = requirements_summary(document)
    # Phase-37-2:追記
    read.external_design = external_design_summary(document)
    # Phase-45-3:追記
    read.internal_design = internal_design_summary(document)
    read.implementation_plan = implementation_plan_summary(document)
    return read
