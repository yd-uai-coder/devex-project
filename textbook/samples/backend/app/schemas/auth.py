# 更新：Phase-2-2,74-3
from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    """ログインAPIのリクエストボディ。"""

    email: EmailStr
    password: str


# Phase-2-2：更新(リフレッシュトークンはhttpOnly Cookieでやり取りするため、
# レスポンスボディから除外する。TokenPair/RefreshRequestは廃止)
# class TokenPair(BaseModel):
#     """ログイン成功時に返すアクセストークンとリフレッシュトークンの組。"""
#
#     access_token: str
#     refresh_token: str
#     token_type: str = "bearer"
#
#
# class RefreshRequest(BaseModel):
#     """トークン更新・ログアウトAPIのリクエストボディ。"""
#
#     refresh_token: str
#
#
# class AccessToken(BaseModel):
#     """トークン更新APIのレスポンスボディ。"""
#
#     access_token: str
#     token_type: str = "bearer"
# ↓↓
class AccessToken(BaseModel):
    """ログイン・トークン更新APIのレスポンスボディ。
    リフレッシュトークンはhttpOnly Cookieでやり取りするため、レスポンスボディには含めない。"""

    access_token: str
    token_type: str = "bearer"


# Phase-74-3:追記
class GoogleLoginRequest(BaseModel):
    """Google でのログイン(POST /auth/google)のリクエストボディ。credential は Google Identity
    Services のボタンが返す ID トークン。"""

    credential: str


class GoogleLinkRequest(BaseModel):
    """連携の確かめ(POST /auth/google/link)のリクエストボディ。同じ ID トークンをもう一度送り、
    既存のアカウントのパスワードで本人を確かめる(サーバーに状態を持たない)。"""

    credential: str
    password: str
