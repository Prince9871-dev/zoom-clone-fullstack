from typing import List
from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.config import settings
from app.schemas.meeting import (
    MeetingCreateInstant,
    MeetingCreateScheduled,
    JoinMeetingRequest,
    ParticipantJoin,
    MeetingResponse
)
from app.services.meeting_service import MeetingService

router = APIRouter(
    prefix="/meetings",
    tags=["meetings"]
)

@router.post("/new", response_model=MeetingResponse, status_code=status.HTTP_201_CREATED)
def create_instant_meeting(data: MeetingCreateInstant, db: Session = Depends(get_db)):
    """Creates an instant meeting, automatically registers the host as the first participant, and returns the meeting details."""
    return MeetingService.create_instant_meeting(db, data, settings.FRONTEND_URL)

@router.post("/schedule", response_model=MeetingResponse, status_code=status.HTTP_201_CREATED)
def schedule_meeting(data: MeetingCreateScheduled, db: Session = Depends(get_db)):
    """Schedules a future meeting with details (title, description, start time, duration), generates a Zoom-style meeting ID, and registers the host."""
    return MeetingService.schedule_meeting(db, data, settings.FRONTEND_URL)

@router.post("/join", response_model=MeetingResponse, status_code=status.HTTP_200_OK)
def join_meeting(data: JoinMeetingRequest, db: Session = Depends(get_db)):
    """Validates meeting exists, adds a participant with display name, and returns the full meeting details."""
    participant_data = ParticipantJoin(
        display_name=data.display_name,
        is_host=data.is_host
    )
    return MeetingService.join_meeting(db, data.meeting_id, participant_data)

@router.get("", response_model=List[MeetingResponse], status_code=status.HTTP_200_OK)
def list_meetings(db: Session = Depends(get_db)):
    """Lists all meetings in the system ordered by scheduled start time."""
    return MeetingService.get_all_meetings(db)

@router.get("/upcoming", response_model=List[MeetingResponse], status_code=status.HTTP_200_OK)
def list_upcoming_meetings(db: Session = Depends(get_db)):
    """Lists all scheduled future meetings (scheduled start time is in the future)."""
    return MeetingService.get_upcoming_meetings(db)

@router.get("/recent", response_model=List[MeetingResponse], status_code=status.HTTP_200_OK)
def list_recent_meetings(db: Session = Depends(get_db)):
    """Lists all past or completed meetings (scheduled start time is in the past, or status is completed)."""
    return MeetingService.get_recent_meetings(db)

@router.get("/{meeting_id}", response_model=MeetingResponse, status_code=status.HTTP_200_OK)
def get_meeting(meeting_id: str, db: Session = Depends(get_db)):
    """Retrieves full details of a specific meeting using its unique Zoom-style public ID (abc-1234-xyz)."""
    return MeetingService.get_meeting_by_id(db, meeting_id)

from pydantic import BaseModel
from datetime import datetime
from app.models.meeting import Meeting, Participant

class ParticipantLeaveRequest(BaseModel):
    display_name: str

@router.delete("/{meeting_id}", status_code=status.HTTP_200_OK)
def delete_meeting(meeting_id: str, db: Session = Depends(get_db)):
    """Deletes/cancels a specific meeting by its unique Zoom-style public ID (abc-1234-xyz)."""
    return MeetingService.delete_meeting(db, meeting_id)

@router.post("/{meeting_id}/leave", status_code=status.HTTP_200_OK)
def leave_meeting(meeting_id: str, data: ParticipantLeaveRequest, db: Session = Depends(get_db)):
    """Updates the left_at column for the participant leaving the meeting."""
    from sqlalchemy import select
    # Find the meeting
    stmt = select(Meeting).where(Meeting.meeting_id == meeting_id)
    meeting = db.execute(stmt).scalar_one_or_none()
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Meeting with ID {meeting_id} not found"
        )
    
    # Find active participant matching name in this meeting (where left_at is null)
    stmt = select(Participant).where(
        Participant.meeting_id == meeting.id,
        Participant.display_name == data.display_name,
        Participant.left_at.is_(None)
    )
    participant = db.execute(stmt).scalars().first()
    if participant:
        participant.left_at = datetime.now()
        db.commit()
    return {"detail": "Left meeting successfully"}


@router.post("/{meeting_id}/start", response_model=MeetingResponse, status_code=status.HTTP_200_OK)
def start_meeting(meeting_id: str, db: Session = Depends(get_db)):
    """Starts the meeting timer by setting meeting_started_at timestamp."""
    from sqlalchemy import select
    stmt = select(Meeting).where(Meeting.meeting_id == meeting_id)
    meeting = db.execute(stmt).scalar_one_or_none()
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Meeting '{meeting_id}' not found"
        )
    if not meeting.meeting_started_at:
        meeting.meeting_started_at = datetime.now()
        db.commit()
    return meeting


@router.post("/{meeting_id}/recording/start", response_model=MeetingResponse, status_code=status.HTTP_200_OK)
def start_recording(meeting_id: str, db: Session = Depends(get_db)):
    """Activates the meeting recording state."""
    from sqlalchemy import select
    stmt = select(Meeting).where(Meeting.meeting_id == meeting_id)
    meeting = db.execute(stmt).scalar_one_or_none()
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Meeting '{meeting_id}' not found"
        )
    meeting.is_recording = True
    meeting.recording_started_at = datetime.now()
    db.commit()
    return meeting


@router.post("/{meeting_id}/recording/stop", response_model=MeetingResponse, status_code=status.HTTP_200_OK)
def stop_recording(meeting_id: str, db: Session = Depends(get_db)):
    """Deactivates the meeting recording state."""
    from sqlalchemy import select
    stmt = select(Meeting).where(Meeting.meeting_id == meeting_id)
    meeting = db.execute(stmt).scalar_one_or_none()
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Meeting '{meeting_id}' not found"
        )
    meeting.is_recording = False
    meeting.recording_started_at = None
    db.commit()
    return meeting

