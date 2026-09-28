# 作成：Phase-6-6
"""add is_current to generated_documents

Revision ID: b7e1d2c4a9f0
Revises: 3f9ce4d4a23b
Create Date: 2026-09-28 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b7e1d2c4a9f0"
down_revision: str | Sequence[str] | None = "3f9ce4d4a23b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "generated_documents",
        sa.Column("is_current", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    # 既存データは「各(project_id, doc_type)の最大versionがcurrent」とみなす
    # (従来は常に最新版を表示していたため、挙動を変えない)。
    op.execute(
        """
        UPDATE generated_documents
        SET is_current = true
        WHERE (project_id, doc_type, version) IN (
            SELECT project_id, doc_type, MAX(version)
            FROM generated_documents
            GROUP BY project_id, doc_type
        )
        """
    )


def downgrade() -> None:
    op.drop_column("generated_documents", "is_current")
