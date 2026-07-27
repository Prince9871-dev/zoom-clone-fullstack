from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict, field_validator

class MeetingCreateInstant(BaseModel):
    host_name: str = Field(..., min_length=1, max_length=100, description="Display name of the host user")

    @field_validator("host_name")
    @classmethod
    def name_must_not_be_whitespace(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Host name cannot be empty or whitespace")
        return v.strip()

class MeetingCreateScheduled(BaseModel):
    title: str = Field(..., min_length=1, max_length=100, description="Title of the meeting")
    description: Optional[str] = Field(None, max_length=500, description="Optional description of the meeting")
    scheduled_at: datetime = Field(..., description="Date and time when the meeting is scheduled to start")
    duration_minutes: int = Field(..., gt=0, le=1440, description="Meeting duration in minutes (between 1 and 1440)")
    host_name: str = Field(..., min_length=1, max_length=100, description="Display name of the host user")

    @field_validator("title", "host_name")
    @classmethod
    def field_must_not_be_whitespace(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Field cannot be empty or whitespace")
        return v.strip()

class ParticipantJoin(BaseModel):
    display_name: str = Field(..., min_length=1, max_length=100, description="Display name of the joining participant")
    is_host: bool = Field(False, description="Whether this participant is joining as a host")

    @field_validator("display_name")
    @classmethod
    def name_must_not_be_whitespace(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Display name cannot be empty or whitespace")
        return v.strip()

class ParticipantResponse(BaseModel):
    id: int
    meeting_id: int
    display_name: str
    joined_at: datetime
    left_at: Optional[datetime] = None
    is_host: bool

    model_config = ConfigDict(from_attributes=True)

class MeetingResponse(BaseModel):
    id: int
    meeting_id: str
    title: str
    description: Optional[str] = None
    host_name: str
    invite_link: str
    scheduled_at: datetime
    duration_minutes: int
    status: str
    meeting_started_at: Optional[datetime] = None
    is_recording: bool = False
    recording_started_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    participants: List[ParticipantResponse] = []

    model_config = ConfigDict(from_attributes=True)

class JoinMeetingRequest(BaseModel):
    meeting_id: str = Field(..., description="The unique Zoom-style meeting ID (abc-1234-xyz)")
    display_name: str = Field(..., min_length=1, max_length=100, description="Display name of the participant")
    is_host: bool = Field(False, description="Whether the participant is joining as a host")

