# 更新：Phase-2-2
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
