"""add_started_at_and_recording_columns

Revision ID: e6cfb57679c6
Revises: 29e37cc1772f
Create Date: 2026-07-27 11:01:24.582238

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e6cfb57679c6'
down_revision: Union[str, Sequence[str], None] = '29e37cc1772f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('meetings', sa.Column('meeting_started_at', sa.DateTime(), nullable=True))
    op.add_column('meetings', sa.Column('is_recording', sa.Boolean(), server_default='0', nullable=False))
    op.add_column('meetings', sa.Column('recording_started_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('meetings', 'recording_started_at')
    op.drop_column('meetings', 'is_recording')
    op.drop_column('meetings', 'meeting_started_at')
