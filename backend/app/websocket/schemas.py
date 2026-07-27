from pydantic import BaseModel, Field
from typing import Optional, Dict, Any

class SignalingMessage(BaseModel):
    id: str = Field(..., description="Message UUID")
    type: str = Field(..., description="join | participant-list | offer | answer | ice-candidate | camera-state | microphone-state | screen-share-start | screen-share-stop | participant-left | heartbeat | pong | error")
    meetingId: str
    senderId: str = Field(..., description="Identifier of the sender (e.g. connection_id)")
    targetId: Optional[str] = Field(None, description="Identifier of the target participant for unicast messages")
    timestamp: float = Field(..., description="Epoch timestamp")
    payload: Dict[str, Any] = Field(default_factory=dict, description="Custom payload content")
