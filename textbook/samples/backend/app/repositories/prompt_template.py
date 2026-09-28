# 作成：Phase-6-3
# 写経レベル: 定型 ── CRUDRepositoryの薄いラッパー(独自クエリはlist_all_templatesの並び順のみ)。
from app.models.prompt_template import PromptTemplate
from app.repositories.base import CRUDRepository


class PromptTemplateRepository(CRUDRepository[PromptTemplate]):
    """PromptTemplateモデルに対する永続化操作をまとめるリポジトリ。CRUD機能は設けず
    (内部設計書3.2節⑤: テンプレートは固定シードデータのみ)、一覧取得・ID取得のみ提供する。"""

    model = PromptTemplate

    async def list_all_templates(self) -> list[PromptTemplate]:
        """選択可能なテンプレート一覧を名前順で取得する。"""
        return await self.list_all(order_by=PromptTemplate.name)
