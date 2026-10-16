# 作成：Phase-52-1｜更新：Phase-68-2,68-4
"""設計レビューを使うかどうかの判定(純粋関数)。"""


# Phase-68-2:追記
def review_allowed(*, is_superuser: bool, has_own_review_key: bool) -> bool:
    """レビューを使えるアカウントか。superuser(既定のキーで使える)か、レビューの用途の AI の
    自分のキーを登録している(費用は本人のキーにかかる)とき。ほかは既定のキーで意図しない
    Anthropic の課金が起きないよう、使えない。"""
    return is_superuser or has_own_review_key


# Phase-68-4：更新
# def review_effective(*, is_superuser: bool, review_enabled: bool) -> bool:
#     """レビューの実効値。superuser が自分でオンにしたときだけ真(初期値はオフ)。superuser で
#     ないアカウントは、保存された設定によらずオフ(意図しない Anthropic の課金を防ぐ)。"""
#     return is_superuser and review_enabled
# ↓↓
def review_effective(*, review_allowed: bool, review_enabled: bool) -> bool:
    """レビューの実効値。使えるアカウントが自分でオンにしたときだけ真(初期値はオフ)。使えない
    アカウントは、保存された設定によらずオフ。"""
    return review_allowed and review_enabled
