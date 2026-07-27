from pydantic import BaseModel
from typing import Optional

class ParticipantPresence(BaseModel):
    user_id: int
    connection_id: str
    meeting_id: str
    display_name: str
    joined_at: float
    camera_enabled: bool = True
    microphone_enabled: bool = True
    screen_sharing: bool = False
    connection_state: str = "connected" # connected | reconnecting | disconnected
