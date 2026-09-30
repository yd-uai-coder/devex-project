# 作成：Phase-2-1｜更新：Phase-6-1,6-6,13-2
# 写経レベル: コア ── バージョニング(直近3件保持・最古削除)はdocs/internal_design.md 3.2節の
# ドメイン規則をそのままロジック化した箇所であり、慎重な写経・理解が必要。
# Phase-6-1: list_versions/get_versionはSCR-006向けの定型的な参照系メソッド(写経レベル: 定型)。
import uuid

from app.models.generated_document import GeneratedDocument
from app.repositories.base import CRUDRepository

# 生成される4種のドキュメント種別。GeneratedDocument.doc_type の取りうる値と対応する。
DOC_TYPES = ("requirements", "external_design", "internal_design", "implementation_plan")

# 同一project_id+doc_typeにつき保管する最大バージョン数(docs/internal_design.md 3.2節「バージョニング方針」)。
MAX_VERSIONS_PER_DOC_TYPE = 3


class GeneratedDocumentRepository(CRUDRepository[GeneratedDocument]):
    """GeneratedDocumentモデルに対する永続化操作をまとめるリポジトリ。"""

    model = GeneratedDocument

    async def create_version(
        self, *, project_id: uuid.UUID, doc_type: str, content: str
    ) -> GeneratedDocument:
        """新バージョンを追加する(既存行は上書きしない)。追加後に保管数がMAX_VERSIONS_PER_DOC_TYPEを
        超える場合は、最も古いバージョンから順に削除して上限を維持する。

        Phase-6-6:追記 ── 新バージョンは常にis_current=Trueで作成し、既存行のis_currentは全て外す
        (新規生成した版が表示中になる)。新しい版が常にcurrentなので、保持数超過で削除される
        「最も古い版」がcurrentであることは無い。"""
        existing = await self.list_all(
            order_by=GeneratedDocument.version.desc(), project_id=project_id, doc_type=doc_type
        )
        next_version = (existing[0].version + 1) if existing else 1

        # Phase-6-6:追記
        for row in existing:
            row.is_current = False

        document = GeneratedDocument(
            project_id=project_id,
            doc_type=doc_type,
            content=content,
            version=next_version,
            is_current=True,  # Phase-6-6:追記
        )
        self._session.add(document)
        await self._session.flush()

        # existingは新バージョン追加"前"の一覧(新しい順)。追加後の総数が上限を超える古いものを削除する。
        keep_count = MAX_VERSIONS_PER_DOC_TYPE - 1
        for stale in existing[keep_count:]:
            await self._session.delete(stale)
        if len(existing) > keep_count:
            await self._session.flush()

        return document

    async def get_latest(
        self, *, project_id: uuid.UUID, doc_type: str
    ) -> GeneratedDocument | None:
        """指定project_id・doc_typeの最新バージョンを1件取得する。"""
        rows = await self.list_all(
            order_by=GeneratedDocument.version.desc(), project_id=project_id, doc_type=doc_type
        )
        return rows[0] if rows else None

    # Phase-6-6：更新(一覧・ダウンロードが参照するのは「最新版」ではなく「現在表示中の版」になった
    # ため、get_latest(最大version)ではなくget_currentで集める。名称もlist_current_for_projectへ変更)
    # async def list_latest_for_project(self, project_id: uuid.UUID) -> list[GeneratedDocument]:
    #     """4種のドキュメントそれぞれについて、存在する場合は最新バージョンのみを集めて返す。"""
    #     results = []
    #     for doc_type in DOC_TYPES:
    #         latest = await self.get_latest(project_id=project_id, doc_type=doc_type)
    #         if latest is not None:
    #             results.append(latest)
    #     return results
    # ↓↓
    async def get_current(
        self, *, project_id: uuid.UUID, doc_type: str
    ) -> GeneratedDocument | None:
        """指定project_id・doc_typeの現在表示中(is_current=True)のバージョンを1件取得する。
        currentが無い場合(マイグレーション前のデータ等)は最新バージョンにフォールバックする。"""
        current = await self.find_one(project_id=project_id, doc_type=doc_type, is_current=True)
        if current is not None:
            return current
        return await self.get_latest(project_id=project_id, doc_type=doc_type)

    async def list_current_for_project(self, project_id: uuid.UUID) -> list[GeneratedDocument]:
        """4種のドキュメントそれぞれについて、存在する場合は現在表示中のバージョンのみを集めて返す。"""
        results = []
        for doc_type in DOC_TYPES:
            current = await self.get_current(project_id=project_id, doc_type=doc_type)
            if current is not None:
                results.append(current)
        return results

    # Phase-6-1:追記 ── SCR-006(バージョン履歴管理画面)向け。保持件数(MAX_VERSIONS_PER_DOC_TYPE)
    # 自体は変更せず、既存の保持ポリシーの上に一覧・復元のAPIを追加する(仕様診断#28で確定)。
    async def list_versions(
        self, *, project_id: uuid.UUID, doc_type: str
    ) -> list[GeneratedDocument]:
        """指定project_id・doc_typeについて、保管されている全バージョン(最大MAX_VERSIONS_PER_DOC_TYPE件)
        を新しい順に返す。"""
        return await self.list_all(
            order_by=GeneratedDocument.version.desc(), project_id=project_id, doc_type=doc_type
        )

    async def get_version(
        self, *, project_id: uuid.UUID, doc_type: str, version: int
    ) -> GeneratedDocument | None:
        """指定project_id・doc_type・versionの1件を取得する(復元機能向け)。"""
        return await self.find_one(project_id=project_id, doc_type=doc_type, version=version)

    # Phase-6-6:追記 ── 復元(表示中バージョンの切替)。新しい行は作らずis_currentの付け替えのみ行う。
    async def set_current(
        self, *, project_id: uuid.UUID, doc_type: str, version: int
    ) -> GeneratedDocument | None:
        """指定バージョンをcurrentにし、同一project_id・doc_typeの他の版のcurrentを外す。
        指定バージョンが存在しない場合は何も変更せずNoneを返す。"""
        rows = await self.list_versions(project_id=project_id, doc_type=doc_type)
        target = next((row for row in rows if row.version == version), None)
        if target is None:
            return None
        for row in rows:
            row.is_current = row is target
        await self._session.flush()
        return target

    # Phase-13-2:追記 ── 図の反映(M9a、D1案A)。版を増やさずに表示中の版の本文を書き換える。
    async def update_content_in_place(
        self, document: GeneratedDocument, content: str
    ) -> GeneratedDocument:
        """既存の版の本文を書き換える(版は増やさず、他の版は消さない)。

        「既存版の内容は書き換えない」(doc_generator_service.restore_version)の唯一の例外で、
        承認済みのUML図の要素表をアンカーの範囲に反映するときだけ使う(D1案A)。反映した内容は
        正本(uml_diagrams)から決定的に作り直せるため、履歴に残さず、保持数(3件)も消費しない。
        create_versionで反映すると、反映3回でAIが生成した原本が保持数から押し出される。"""
        document.content = content
        await self._session.flush()
        return document
