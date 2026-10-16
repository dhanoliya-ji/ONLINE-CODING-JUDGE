"""Baseline: the schema as it stood before migrations were introduced.

A database created by the old `create_all` start-up is stamped at this
revision rather than migrated (see app/migrate.py).

Revision ID: 0001
Revises: 
Create Date: 2026-10-17 01:16:26.700678
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = '0001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('users',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('username', sa.String(length=50), nullable=False),
    sa.Column('email', sa.String(length=255), nullable=False),
    sa.Column('hashed_password', sa.String(length=255), nullable=False),
    sa.Column('is_admin', sa.Boolean(), server_default='0', nullable=False),
    sa.Column('is_active', sa.Boolean(), server_default='1', nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_users_email'), ['email'], unique=True)
        batch_op.create_index(batch_op.f('ix_users_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_users_username'), ['username'], unique=True)

    op.create_table('coach_usage',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('day', sa.Date(), nullable=False),
    sa.Column('replies', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id', 'day', name='uq_coach_usage_user_day')
    )
    with op.batch_alter_table('coach_usage', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_coach_usage_user_id'), ['user_id'], unique=False)

    op.create_table('contests',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('title', sa.String(length=255), nullable=False),
    sa.Column('slug', sa.String(length=280), nullable=False),
    sa.Column('description', sa.Text(), nullable=False),
    sa.Column('start_time', sa.DateTime(timezone=True), nullable=False),
    sa.Column('end_time', sa.DateTime(timezone=True), nullable=False),
    sa.Column('penalty_minutes_per_wrong', sa.Integer(), server_default='20', nullable=False),
    sa.Column('created_by', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('contests', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_contests_end_time'), ['end_time'], unique=False)
        batch_op.create_index(batch_op.f('ix_contests_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_contests_slug'), ['slug'], unique=True)
        batch_op.create_index(batch_op.f('ix_contests_start_time'), ['start_time'], unique=False)

    op.create_table('problems',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('title', sa.String(length=255), nullable=False),
    sa.Column('slug', sa.String(length=280), nullable=False),
    sa.Column('description', sa.Text(), nullable=False),
    sa.Column('difficulty', sa.String(length=20), nullable=False),
    sa.Column('input_format', sa.Text(), nullable=False),
    sa.Column('output_format', sa.Text(), nullable=False),
    sa.Column('constraints', sa.Text(), nullable=False),
    sa.Column('sample_input', sa.Text(), nullable=False),
    sa.Column('sample_output', sa.Text(), nullable=False),
    sa.Column('time_limit_ms', sa.Integer(), server_default='2000', nullable=False),
    sa.Column('memory_limit_mb', sa.Integer(), server_default='128', nullable=False),
    sa.Column('is_public', sa.Boolean(), server_default='1', nullable=False),
    sa.Column('created_by', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('problems', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_problems_difficulty'), ['difficulty'], unique=False)
        batch_op.create_index(batch_op.f('ix_problems_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_problems_slug'), ['slug'], unique=True)
        batch_op.create_index(batch_op.f('ix_problems_title'), ['title'], unique=True)

    op.create_table('contest_problems',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('contest_id', sa.Integer(), nullable=False),
    sa.Column('problem_id', sa.Integer(), nullable=False),
    sa.Column('label', sa.String(length=8), nullable=True),
    sa.Column('order_index', sa.Integer(), server_default='0', nullable=False),
    sa.Column('points', sa.Integer(), server_default='100', nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.ForeignKeyConstraint(['contest_id'], ['contests.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['problem_id'], ['problems.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('contest_id', 'problem_id', name='uq_contest_problem')
    )
    with op.batch_alter_table('contest_problems', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_contest_problems_contest_id'), ['contest_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_contest_problems_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_contest_problems_problem_id'), ['problem_id'], unique=False)

    op.create_table('contest_registrations',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('contest_id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('registered_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['contest_id'], ['contests.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('contest_id', 'user_id', name='uq_contest_registration')
    )
    with op.batch_alter_table('contest_registrations', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_contest_registrations_contest_id'), ['contest_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_contest_registrations_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_contest_registrations_user_id'), ['user_id'], unique=False)

    op.create_table('submissions',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('problem_id', sa.Integer(), nullable=False),
    sa.Column('contest_id', sa.Integer(), nullable=True),
    sa.Column('language', sa.String(length=20), nullable=False),
    sa.Column('source_code', sa.Text(), nullable=False),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('verdict', sa.String(length=30), nullable=False),
    sa.Column('execution_time_ms', sa.Float(), server_default='0', nullable=False),
    sa.Column('memory_kb', sa.Integer(), server_default='0', nullable=False),
    sa.Column('passed_tests', sa.Integer(), server_default='0', nullable=False),
    sa.Column('total_tests', sa.Integer(), server_default='0', nullable=False),
    sa.Column('score', sa.Integer(), server_default='0', nullable=False),
    sa.Column('error_message', sa.Text(), nullable=True),
    sa.Column('failed_test_index', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.ForeignKeyConstraint(['contest_id'], ['contests.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['problem_id'], ['problems.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('submissions', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_submissions_contest_id'), ['contest_id'], unique=False)
        batch_op.create_index('ix_submissions_contest_user', ['contest_id', 'user_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_submissions_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_submissions_problem_id'), ['problem_id'], unique=False)
        batch_op.create_index('ix_submissions_problem_user', ['problem_id', 'user_id'], unique=False)
        batch_op.create_index('ix_submissions_user_created', ['user_id', 'created_at'], unique=False)
        batch_op.create_index(batch_op.f('ix_submissions_user_id'), ['user_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_submissions_verdict'), ['verdict'], unique=False)

    op.create_table('test_cases',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('problem_id', sa.Integer(), nullable=False),
    sa.Column('input_data', sa.Text(), nullable=False),
    sa.Column('expected_output', sa.Text(), nullable=False),
    sa.Column('is_sample', sa.Boolean(), server_default='0', nullable=False),
    sa.Column('order_index', sa.Integer(), server_default='0', nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.ForeignKeyConstraint(['problem_id'], ['problems.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('test_cases', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_test_cases_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_test_cases_problem_id'), ['problem_id'], unique=False)



def downgrade() -> None:
    with op.batch_alter_table('test_cases', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_test_cases_problem_id'))
        batch_op.drop_index(batch_op.f('ix_test_cases_id'))

    op.drop_table('test_cases')
    with op.batch_alter_table('submissions', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_submissions_verdict'))
        batch_op.drop_index(batch_op.f('ix_submissions_user_id'))
        batch_op.drop_index('ix_submissions_user_created')
        batch_op.drop_index('ix_submissions_problem_user')
        batch_op.drop_index(batch_op.f('ix_submissions_problem_id'))
        batch_op.drop_index(batch_op.f('ix_submissions_id'))
        batch_op.drop_index('ix_submissions_contest_user')
        batch_op.drop_index(batch_op.f('ix_submissions_contest_id'))

    op.drop_table('submissions')
    with op.batch_alter_table('contest_registrations', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_contest_registrations_user_id'))
        batch_op.drop_index(batch_op.f('ix_contest_registrations_id'))
        batch_op.drop_index(batch_op.f('ix_contest_registrations_contest_id'))

    op.drop_table('contest_registrations')
    with op.batch_alter_table('contest_problems', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_contest_problems_problem_id'))
        batch_op.drop_index(batch_op.f('ix_contest_problems_id'))
        batch_op.drop_index(batch_op.f('ix_contest_problems_contest_id'))

    op.drop_table('contest_problems')
    with op.batch_alter_table('problems', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_problems_title'))
        batch_op.drop_index(batch_op.f('ix_problems_slug'))
        batch_op.drop_index(batch_op.f('ix_problems_id'))
        batch_op.drop_index(batch_op.f('ix_problems_difficulty'))

    op.drop_table('problems')
    with op.batch_alter_table('contests', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_contests_start_time'))
        batch_op.drop_index(batch_op.f('ix_contests_slug'))
        batch_op.drop_index(batch_op.f('ix_contests_id'))
        batch_op.drop_index(batch_op.f('ix_contests_end_time'))

    op.drop_table('contests')
    with op.batch_alter_table('coach_usage', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_coach_usage_user_id'))

    op.drop_table('coach_usage')
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_users_username'))
        batch_op.drop_index(batch_op.f('ix_users_id'))
        batch_op.drop_index(batch_op.f('ix_users_email'))

    op.drop_table('users')
