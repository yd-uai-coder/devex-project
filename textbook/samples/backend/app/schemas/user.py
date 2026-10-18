# 更新：Phase-52-5,66-1,66-2,68-4,74-1,75-1,75-2
# CL開発以前のスターターテンプレート由来のファイル(CLAUDE.md #29)。Phase 52 で初めて samples に載せた
# (全文。タグの無い部分はテンプレートのまま)。
# Phase-52-5:追記 ── pydantic.computed_field
# Phase-52-5:追記 ── app.review.review_effective
# Phase-66-2:追記 ── typing.Annotated, pydantic.StringConstraints, pydantic.field_validator, app.core.password_policy.password_violations
# Phase-68-4：削除 ── pydantic.computed_field, app.review.review_effective
import uuid
from datetime import datetime
from typing import Annotated

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    StringConstraints,
    field_validator,
)

from app.core.password_policy import password_violations

# Phase-66-2:追記
# ユーザーネームの変更で受ける値(前後の空白を除いて1〜255文字。列の長さと同じ上限)
type UserNameText = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)
]


class UserBase(BaseModel):
    """ユーザー関連スキーマ間で共通するフィールドをまとめた基底クラス。"""

    email: EmailStr
    # Phase-66-1：更新
    # full_name: str | None = None
    # ↓↓
    user_name: str | None = None


class UserCreate(UserBase):
    """ユーザー登録APIのリクエストボディ。"""

    password: str


# Phase-66-2：削除(使われていなかったテンプレートの更新用スキーマ。変更は操作ごとのスキーマに分けた)
# class UserUpdate(BaseModel):
#     """ユーザー更新APIのリクエストボディ（指定したフィールドのみ更新する想定）。"""
#
#     full_name: str | None = None
#     password: str | None = None


class UserRead(UserBase):
    """ユーザー情報をAPIレスポンスとして返す際のスキーマ（パスワードは含まない）。"""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    is_active: bool
    is_superuser: bool
    created_at: datetime
    # Phase-52-5:追記
    # 設計レビューの設定(保存値)。使うかどうかは review_effective で見る
    review_enabled: bool = False
    # Phase-68-4：更新
    #
    # @computed_field
    # @property
    # def review_effective(self) -> bool:
    #     """設計レビューの実効値(superuser かつ設定がオン)。画面はこれで出し分ける。"""
    #     return review_effective(
    #         is_superuser=self.is_superuser, review_enabled=self.review_enabled
    #     )
    # ↓↓
    # レビューを使えるアカウントか(superuser、またはレビューの用途の AI の自分のキーがある)と、
    # 実効値(使えて、設定がオン)。キーの登録を読むので、ルートが app/api/user_read.py で埋める
    review_allowed: bool = False
    review_effective: bool = False
    # Phase-74-1:追記
    # パスワードを持つか・Google と連携しているか(マイページの出し分けに使う。値そのものは返さない)
    has_password: bool = False
    google_linked: bool = False


# Phase-52-5:追記
class ReviewSettingsUpdate(BaseModel):
    """設計レビューの設定の変更のリクエストボディ。"""

    review_enabled: bool


# Phase-66-2:追記
class UserNameUpdate(BaseModel):
    """ユーザーネームの変更(PATCH /users/me)のリクエストボディ。"""

    user_name: UserNameText


class EmailUpdate(BaseModel):
    """メールアドレスの変更(PUT /users/me/email)のリクエストボディ。今のパスワードで本人を
    確かめる。"""

    new_email: EmailStr
    current_password: str


class PasswordUpdate(BaseModel):
    """パスワードの変更(PUT /users/me/password)のリクエストボディ。新しいパスワードには登録の
    画面と同じ規則を課す(合わなければ 422)。"""

    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def _check_policy(cls, value: str) -> str:
        # Phase-75-1：更新
        # violations = password_violations(value)
        # if violations:
        #     raise ValueError(" / ".join(violations))
        # return value
        # ↓↓
        return _require_policy(value)


# Phase-75-1:追記
class PasswordSet(BaseModel):
    """パスワードの設定(POST /users/me/password)のリクエストボディ。パスワードを持たない
    (Google だけの)利用者が使う。規則は変更と同じ(合わなければ 422)。"""

    new_password: str

    @field_validator("new_password")
    @classmethod
    def _check_policy(cls, value: str) -> str:
        return _require_policy(value)


# Phase-75-2:追記
class GoogleLinkCurrentRequest(BaseModel):
    """マイページからの Google の連携(POST /users/me/google)のリクエストボディ。credential は
    Google のボタンが返す ID トークン。今のパスワードで本人を確かめる(盗まれたセッションで他人の
    Google を足させない)。"""

    credential: str
    current_password: str


# Phase-75-1:追記
def _require_policy(value: str) -> str:
    """新しいパスワードに登録の画面と同じ規則を課す(変更と設定で共有する)。"""
    violations = password_violations(value)
    if violations:
        raise ValueError(" / ".join(violations))
    return value
