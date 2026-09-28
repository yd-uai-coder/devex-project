# 作成：Phase-6-3
"""add template_id to projects

Revision ID: 3f9ce4d4a23b
Revises: 9c91eca2a657
Create Date: 2026-09-28 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "3f9ce4d4a23b"
down_revision: str | Sequence[str] | None = "9c91eca2a657"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("projects", sa.Column("template_id", sa.Uuid(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_projects_template_id_prompt_templates",
        "projects",
        "prompt_templates",
        ["template_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_projects_template_id_prompt_templates", "projects", type_="foreignkey"
    )
    op.drop_column("projects", "template_id")
