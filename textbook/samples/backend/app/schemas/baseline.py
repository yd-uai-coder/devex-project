# 作成：Phase-81-3｜更新：Phase-82-2,86-4,87-1,96-3,106-5
# Phase-106-5：更新(docstring: BaselineOriginRead の kind に function を足した)
# Phase-86-4：更新(docstring: BaselineCreate に束に入れる CR の番号を足した)
# Phase-82-2：更新 ── 合意の記録の項目を app.schemas.agreement.AgreementNotes に移した(CR の合意・却下と共有)
# import uuid
# from datetime import datetime
# from typing import Annotated, Any
#
# from pydantic import (
#     AwareDatetime,
#     BaseModel,
#     ConfigDict,
#     Field,
#     StringConstraints,
#     computed_field,
#     field_validator,
# )
#
# ↓↓
# Phase-86-4:追記 ── pydantic.Field, pydantic.field_validator
# Phase-106-5:追記 ── typing.Self
import uuid
from datetime import datetime
from typing import Any, Self

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, computed_field, field_validator

from app.schemas.agreement import AgreementNotes

# Phase-82-2：更新
# # 合意の記録の文の上限(相手は名前・会社名、メモは打ち合わせの要点)
# COUNTERPART_MAX = 200
# MEMO_MAX = 10000
# REASON_MAX = 2000
#
#
# class BaselineCreate(BaseModel):
#     """合意済みの版(束)を作るときの合意の記録。相手は空でもよい(空白だけは null にそろえる)。
#     合意の日時は記録する日時と別に、タイムゾーン付きで受け取る。理由は必須。"""
#
#     counterpart: str | None = Field(default=None, max_length=COUNTERPART_MAX)
#     agreed_at: AwareDatetime
#     memo: str = Field(default="", max_length=MEMO_MAX)
#     reason: Annotated[
#         str, StringConstraints(strip_whitespace=True, min_length=1, max_length=REASON_MAX)
#     ]
#
#     @field_validator("counterpart")
#     @classmethod
#     def _blank_to_none(cls, value: str | None) -> str | None:
#         if value is None:
#             return None
#         return value.strip() or None
# ↓↓
class BaselineCreate(AgreementNotes):
    """合意済みの版(束)を作るときの合意の記録。相手・メモ・理由は AgreementNotes。合意の日時は
    記録する日時と別に、タイムゾーン付きで受け取る。`change_request_numbers`は、この束に入れる
    検証済みの CR の番号(任意。束と CR を結び、CR の時系列に1行残す)。"""

    agreed_at: AwareDatetime
    # Phase-86-4:追記
    change_request_numbers: list[int] = Field(default_factory=list, max_length=100)

    @field_validator("change_request_numbers")
    @classmethod
    def _unique_numbers(cls, value: list[int]) -> list[int]:
        if any(number < 1 for number in value):
            raise ValueError("CR の番号は1以上です")
        return list(dict.fromkeys(value))


class BaselineItemSummaryRead(BaseModel):
    """束の写し1件の要約(中身なし)。`key`は文書の種類か`stage:N`、`state`は段階の状態
    (StageState)か文書の`present`/`absent`。"""

    model_config = ConfigDict(from_attributes=True)

    key: str
    included: bool
    state: str
    source_version: int | None
    generated_model: str | None


class BaselineItemRead(BaselineItemSummaryRead):
    """束の写し1件(文書の md と意味モデル、段階の承認の写し)。"""

    content: str | None
    model: dict[str, Any] | None


# Phase-106-5:追記
class BaselineChangeRequestRead(BaseModel):
    """束に入れた CR 1つ(番号と題)。"""

    number: int
    title: str


class _BaselineRecordRead(BaseModel):
    """合意済みの版1つの番号と合意の記録(写しは継承先で持つ)。`label`は画面に出す名前(B-1…)。"""

    model_config = ConfigDict(from_attributes=True)

    number: int
    counterpart: str | None
    agreed_at: datetime
    memo: str
    reason: str
    recorded_by: uuid.UUID | None
    created_at: datetime
    # Phase-106-5:追記
    # 束に入れた CR(番号の順)。ORM の行には無いので、ルートが`with_included`で足す
    included_change_requests: list[BaselineChangeRequestRead] = Field(default_factory=list)

    def with_included(self, included: list[tuple[int, str]]) -> Self:
        """束に入れた CR(`(番号, 題)`の一覧)を足した写し。"""
        return self.model_copy(
            update={
                "included_change_requests": [
                    BaselineChangeRequestRead(number=n, title=t) for n, t in included
                ]
            }
        )

    @computed_field
    @property
    def label(self) -> str:
        return f"B-{self.number}"


class BaselineSummaryRead(_BaselineRecordRead):
    """合意済みの版1つ(一覧用。写しは要約だけ)。"""

    items: list[BaselineItemSummaryRead]


class BaselineRead(_BaselineRecordRead):
    """合意済みの版1つ(写しの中身付き)。"""

    items: list[BaselineItemRead]


# Phase-87-1:追記
# Phase-96-3:追記
class BaselineOriginRead(BaseModel):
    """束で、新しい要件の予測の起点に選べる要素1つ(CR の起点を選ぶ画面用)。`kind`は
    requirement / screen / api / function。"""

    key: str
    kind: str
    label: str


class BaselineRequirementRead(BaseModel):
    """束の要件定義書の写しにある要件1行(CR の対象を選ぶ画面用。根拠の観点などは返さない)。"""

    id: str
    kind: str
    priority: str | None = None
    category: str = ""
    text: str
