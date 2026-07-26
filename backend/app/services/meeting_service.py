import random
import string
from datetime import datetime
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.meeting import Meeting, Participant
from app.schemas.meeting import MeetingCreateInstant, MeetingCreateScheduled, ParticipantJoin

def generate_zoom_meeting_id() -> str:
    """Generates a Zoom-style meeting ID in the format abc-1234-xyz."""
    letters1 = "".join(random.choices(string.ascii_lowercase, k=3))
    digits = "".join(random.choices(string.digits, k=4))
    letters2 = "".join(random.choices(string.ascii_lowercase, k=3))
    return f"{letters1}-{digits}-{letters2}"

def get_unique_meeting_id(db: Session) -> str:
    """Generates a Zoom-style meeting ID and validates its uniqueness in the database."""
    for _ in range(10):  # Prevent infinite loop
        meeting_id = generate_zoom_meeting_id()
        stmt = select(Meeting).where(Meeting.meeting_id == meeting_id)
        exists = db.execute(stmt).scalar_one_or_none()
        if not exists:
            return meeting_id
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Could not generate a unique meeting ID after multiple attempts"
    )

class MeetingService:
    @staticmethod
    def create_instant_meeting(db: Session, data: MeetingCreateInstant, frontend_url: str) -> Meeting:
        meeting_id = get_unique_meeting_id(db)
        invite_link = f"{frontend_url.rstrip('/')}/join/{meeting_id}"
        
        db_meeting = Meeting(
            meeting_id=meeting_id,
            title=f"{data.host_name}'s Instant Meeting",
            description="Instant Zoom-clone video meeting",
            host_name=data.host_name,
            invite_link=invite_link,
            scheduled_at=datetime.now(),
            duration_minutes=40,  # default instant meeting length
            status="active"
        )
        db.add(db_meeting)
        db.commit()
        db.refresh(db_meeting)
        
        # Auto-join the host as a participant
        host_participant = Participant(
            meeting_id=db_meeting.id,
            display_name=data.host_name,
            joined_at=datetime.now(),
            is_host=True
        )
        db.add(host_participant)
        db.commit()
        db.refresh(db_meeting)
        
        return db_meeting

    @staticmethod
    def schedule_meeting(db: Session, data: MeetingCreateScheduled, frontend_url: str) -> Meeting:
        meeting_id = get_unique_meeting_id(db)
        invite_link = f"{frontend_url.rstrip('/')}/join/{meeting_id}"
        
        db_meeting = Meeting(
            meeting_id=meeting_id,
            title=data.title,
            description=data.description,
            host_name=data.host_name,
            invite_link=invite_link,
            scheduled_at=data.scheduled_at,
            duration_minutes=data.duration_minutes,
            status="scheduled"
        )
        db.add(db_meeting)
        db.commit()
        db.refresh(db_meeting)
        
        # Auto-join the host as a participant
        host_participant = Participant(
            meeting_id=db_meeting.id,
            display_name=data.host_name,
            joined_at=data.scheduled_at,
            is_host=True
        )
        db.add(host_participant)
        db.commit()
        db.refresh(db_meeting)
        
        return db_meeting

    @staticmethod
    def join_meeting(db: Session, meeting_id: str, data: ParticipantJoin) -> Meeting:
        # Validate meeting exists
        stmt = select(Meeting).where(Meeting.meeting_id == meeting_id)
        meeting = db.execute(stmt).scalar_one_or_none()
        if not meeting:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Meeting with ID {meeting_id} not found"
            )
            
        # Check if meeting has ended
        if meeting.status == "completed":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This meeting has already ended"
            )
            
        # Store participant
        participant = Participant(
            meeting_id=meeting.id,
            display_name=data.display_name,
            joined_at=datetime.now(),
            is_host=data.is_host
        )
        db.add(participant)
        
        # If the meeting was scheduled but is now being joined, set status to active
        if meeting.status == "scheduled":
            meeting.status = "active"
            
        db.commit()
        db.refresh(meeting)
        return meeting

    @staticmethod
    def get_all_meetings(db: Session) -> List[Meeting]:
        stmt = select(Meeting).order_by(Meeting.scheduled_at.desc())
        return list(db.execute(stmt).scalars().unique().all())

    @staticmethod
    def get_upcoming_meetings(db: Session) -> List[Meeting]:
        stmt = select(Meeting).where(
            Meeting.scheduled_at > datetime.now(),
            Meeting.status == "scheduled"
        ).order_by(Meeting.scheduled_at.asc())
        return list(db.execute(stmt).scalars().unique().all())

    @staticmethod
    def get_recent_meetings(db: Session) -> List[Meeting]:
        stmt = select(Meeting).where(
            (Meeting.scheduled_at <= datetime.now()) | (Meeting.status == "completed")
        ).order_by(Meeting.scheduled_at.desc())
        return list(db.execute(stmt).scalars().unique().all())

    @staticmethod
    def get_meeting_by_id(db: Session, meeting_id: str) -> Meeting:
        stmt = select(Meeting).where(Meeting.meeting_id == meeting_id)
        meeting = db.execute(stmt).scalar_one_or_none()
        if not meeting:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Meeting with ID {meeting_id} not found"
            )
        return meeting

    @staticmethod
    def delete_meeting(db: Session, meeting_id: str) -> dict:
        stmt = select(Meeting).where(Meeting.meeting_id == meeting_id)
        meeting = db.execute(stmt).scalar_one_or_none()
        if not meeting:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Meeting with ID {meeting_id} not found"
            )
        db.delete(meeting)
        db.commit()
        return {"detail": f"Meeting {meeting_id} deleted successfully"}
