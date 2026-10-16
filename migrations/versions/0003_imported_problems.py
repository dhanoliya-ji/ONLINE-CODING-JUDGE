"""Imported problems: identity, rating, checker, and a reference solution.

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-17 01:46:32.574407
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('problems', schema=None) as batch_op:
        batch_op.add_column(sa.Column('external_id', sa.String(length=120), nullable=True))
        batch_op.add_column(sa.Column('rating', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('checker', sa.String(length=40), server_default='exact', nullable=False))
        batch_op.add_column(sa.Column('reference_solution', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('reference_language', sa.String(length=20), nullable=True))
        batch_op.create_index(batch_op.f('ix_problems_external_id'), ['external_id'], unique=True)
        batch_op.create_index(batch_op.f('ix_problems_rating'), ['rating'], unique=False)



def downgrade() -> None:
    with op.batch_alter_table('problems', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_problems_rating'))
        batch_op.drop_index(batch_op.f('ix_problems_external_id'))
        batch_op.drop_column('reference_language')
        batch_op.drop_column('reference_solution')
        batch_op.drop_column('checker')
        batch_op.drop_column('rating')
        batch_op.drop_column('external_id')

