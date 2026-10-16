"""Problem catalogue: topic tags, provenance, and full-text search.

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-17 01:17:07.250195
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('tags',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('slug', sa.String(length=60), nullable=False),
    sa.Column('name', sa.String(length=60), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('name')
    )
    with op.batch_alter_table('tags', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_tags_slug'), ['slug'], unique=True)

    op.create_table('problem_tags',
    sa.Column('problem_id', sa.Integer(), nullable=False),
    sa.Column('tag_id', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['problem_id'], ['problems.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['tag_id'], ['tags.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('problem_id', 'tag_id')
    )
    with op.batch_alter_table('problem_tags', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_problem_tags_tag_id'), ['tag_id'], unique=False)

    with op.batch_alter_table('problems', schema=None) as batch_op:
        batch_op.add_column(sa.Column('source', sa.String(length=80), nullable=True))
        batch_op.add_column(sa.Column('source_url', sa.String(length=500), nullable=True))
        batch_op.add_column(sa.Column('license', sa.String(length=120), nullable=True))
        batch_op.create_index(batch_op.f('ix_problems_source'), ['source'], unique=False)

    # Full-text search over title and statement. Postgres only: SQLite (local
    # development) falls back to LIKE. The expression must stay identical to
    # the one in app/services/catalogue.py, or the planner will not use it.
    if op.get_bind().dialect.name == "postgresql":
        op.execute(
            "CREATE INDEX IF NOT EXISTS ix_problems_fulltext ON problems "
            "USING gin (to_tsvector('english', title || ' ' || description))"
        )


def downgrade() -> None:
    if op.get_bind().dialect.name == "postgresql":
        op.execute("DROP INDEX IF EXISTS ix_problems_fulltext")
    with op.batch_alter_table('problems', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_problems_source'))
        batch_op.drop_column('license')
        batch_op.drop_column('source_url')
        batch_op.drop_column('source')

    with op.batch_alter_table('problem_tags', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_problem_tags_tag_id'))

    op.drop_table('problem_tags')
    with op.batch_alter_table('tags', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_tags_slug'))

    op.drop_table('tags')
