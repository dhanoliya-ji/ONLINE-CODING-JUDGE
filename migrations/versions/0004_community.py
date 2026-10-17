"""Community: ratings, virtual contests, discussions, lists, editorials.

Also ends any contest longer than 30 days that is still running. The demo
seed used to create a year-long "Practice Round #1", which kept its problems
out of practice (no coach, no daily pick) for a year.

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-17 02:59:12.210516
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import sqlalchemy as sa
from alembic import op

revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('problem_lists',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=60), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id', 'name', name='uq_problem_list_user_name')
    )
    with op.batch_alter_table('problem_lists', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_problem_lists_user_id'), ['user_id'], unique=False)

    op.create_table('discussion_posts',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('problem_id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('parent_id', sa.Integer(), nullable=True),
    sa.Column('body', sa.Text(), nullable=False),
    sa.Column('deleted', sa.Boolean(), server_default='0', nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.ForeignKeyConstraint(['parent_id'], ['discussion_posts.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['problem_id'], ['problems.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('discussion_posts', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_discussion_posts_parent_id'), ['parent_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_discussion_posts_problem_id'), ['problem_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_discussion_posts_user_id'), ['user_id'], unique=False)

    op.create_table('editorials',
    sa.Column('problem_id', sa.Integer(), nullable=False),
    sa.Column('body', sa.Text(), nullable=False),
    sa.Column('author', sa.String(length=80), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['problem_id'], ['problems.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('problem_id')
    )
    op.create_table('problem_list_items',
    sa.Column('list_id', sa.Integer(), nullable=False),
    sa.Column('problem_id', sa.Integer(), nullable=False),
    sa.Column('added_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['list_id'], ['problem_lists.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['problem_id'], ['problems.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('list_id', 'problem_id')
    )
    with op.batch_alter_table('problem_list_items', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_problem_list_items_problem_id'), ['problem_id'], unique=False)

    op.create_table('rating_changes',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('contest_id', sa.Integer(), nullable=False),
    sa.Column('rank', sa.Integer(), nullable=False),
    sa.Column('old_rating', sa.Integer(), nullable=False),
    sa.Column('new_rating', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['contest_id'], ['contests.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id', 'contest_id', name='uq_rating_change_user_contest')
    )
    with op.batch_alter_table('rating_changes', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_rating_changes_contest_id'), ['contest_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_rating_changes_user_id'), ['user_id'], unique=False)

    op.create_table('virtual_participations',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('contest_id', sa.Integer(), nullable=False),
    sa.Column('started_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['contest_id'], ['contests.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id', 'contest_id', name='uq_virtual_user_contest')
    )
    with op.batch_alter_table('virtual_participations', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_virtual_participations_contest_id'), ['contest_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_virtual_participations_user_id'), ['user_id'], unique=False)

    op.create_table('discussion_votes',
    sa.Column('post_id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['post_id'], ['discussion_posts.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('post_id', 'user_id')
    )
    with op.batch_alter_table('contests', schema=None) as batch_op:
        batch_op.add_column(sa.Column('rated', sa.Boolean(), server_default='1', nullable=False))
        batch_op.add_column(sa.Column('is_auto', sa.Boolean(), server_default='0', nullable=False))
        batch_op.add_column(sa.Column('finalized_at', sa.DateTime(timezone=True), nullable=True))

    with op.batch_alter_table('submissions', schema=None) as batch_op:
        batch_op.add_column(sa.Column('is_virtual', sa.Boolean(), server_default='0', nullable=False))

    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('rating', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('max_rating', sa.Integer(), nullable=True))
        batch_op.create_index(batch_op.f('ix_users_rating'), ['rating'], unique=False)


    contests = sa.table(
        "contests",
        sa.column("id", sa.Integer()),
        sa.column("start_time", sa.DateTime(timezone=True)),
        sa.column("end_time", sa.DateTime(timezone=True)),
        sa.column("rated", sa.Boolean()),
    )
    now = datetime.now(timezone.utc)
    rows = op.get_bind().execute(
        sa.select(contests.c.id, contests.c.start_time, contests.c.end_time)
    ).all()
    for contest_id, start, end in rows:
        start = start if start.tzinfo else start.replace(tzinfo=timezone.utc)
        end = end if end.tzinfo else end.replace(tzinfo=timezone.utc)
        if end - start > timedelta(days=30) and start <= now < end:
            op.execute(
                contests.update()
                .where(contests.c.id == contest_id)
                # A year-long practice round says nothing about skill.
                .values(end_time=now, rated=False)
            )


def downgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_users_rating'))
        batch_op.drop_column('max_rating')
        batch_op.drop_column('rating')

    with op.batch_alter_table('submissions', schema=None) as batch_op:
        batch_op.drop_column('is_virtual')

    with op.batch_alter_table('contests', schema=None) as batch_op:
        batch_op.drop_column('finalized_at')
        batch_op.drop_column('is_auto')
        batch_op.drop_column('rated')

    op.drop_table('discussion_votes')
    with op.batch_alter_table('virtual_participations', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_virtual_participations_user_id'))
        batch_op.drop_index(batch_op.f('ix_virtual_participations_contest_id'))

    op.drop_table('virtual_participations')
    with op.batch_alter_table('rating_changes', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_rating_changes_user_id'))
        batch_op.drop_index(batch_op.f('ix_rating_changes_contest_id'))

    op.drop_table('rating_changes')
    with op.batch_alter_table('problem_list_items', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_problem_list_items_problem_id'))

    op.drop_table('problem_list_items')
    op.drop_table('editorials')
    with op.batch_alter_table('discussion_posts', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_discussion_posts_user_id'))
        batch_op.drop_index(batch_op.f('ix_discussion_posts_problem_id'))
        batch_op.drop_index(batch_op.f('ix_discussion_posts_parent_id'))

    op.drop_table('discussion_posts')
    with op.batch_alter_table('problem_lists', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_problem_lists_user_id'))

    op.drop_table('problem_lists')
