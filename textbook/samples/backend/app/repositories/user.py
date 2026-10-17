# 更新：Phase-66-1,74-1
# CL開発以前のスターターテンプレート由来のファイル(CLAUDE.md #29)。Phase 66 で初めて samples に載せた
# (全文。タグの無い部分はテンプレートのまま)。
from app.models.user import User
from app.repositories.base import CRUDRepository


class UserRepository(CRUDRepository[User]):
    """Userモデルに対する永続化操作をまとめるリポジトリ。"""

    model = User

    async def get_by_email(self, email: str) -> User | None:
        """メールアドレスの完全一致でユーザーを1件検索する。"""
        return await self.find_one(email=email)

    # Phase-74-1:追記
    async def get_by_google_sub(self, google_sub: str) -> User | None:
        """連携した Google アカウントの識別子(sub)でユーザーを1件検索する。"""
        return await self.find_one(google_sub=google_sub)

    async def create(
        # Phase-66-1：更新
        # self, *, email: str, hashed_password: str, full_name: str | None = None
        # ↓↓
        # Phase-74-1：更新
        # self, *, email: str, hashed_password: str, user_name: str | None = None
        # ↓↓
        self,
        *,
        email: str,
        hashed_password: str | None,
        user_name: str | None = None,
        google_sub: str | None = None,
    ) -> User:
        """新規ユーザーをセッションに追加し、flushしてIDを確定させた状態で返す。"""
        # Phase-66-1：更新
        # user = User(email=email, hashed_password=hashed_password, full_name=full_name)
        # ↓↓
        # Phase-74-1：更新
        # user = User(email=email, hashed_password=hashed_password, user_name=user_name)
        # ↓↓
        user = User(
            email=email,
            hashed_password=hashed_password,
            user_name=user_name,
            google_sub=google_sub,
        )
        self._session.add(user)
        await self._session.flush()
        return user
