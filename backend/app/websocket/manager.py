import time
import asyncio
import uuid
from typing import Dict, List, Optional
from fastapi import WebSocket
from app.websocket.presence import ParticipantPresence
from app.websocket.schemas import SignalingMessage

class Room:
    def __init__(self, meeting_id: str):
        self.meeting_id = meeting_id
        self.connections: Dict[str, WebSocket] = {}       # connection_id -> WebSocket
        self.presences: Dict[str, ParticipantPresence] = {} # connection_id -> ParticipantPresence
        self.last_heartbeats: Dict[str, float] = {}       # connection_id -> timestamp (time.time())

    def add_participant(self, connection_id: str, ws: WebSocket, presence: ParticipantPresence):
        self.connections[connection_id] = ws
        self.presences[connection_id] = presence
        self.last_heartbeats[connection_id] = time.time()

    def remove_participant(self, connection_id: str) -> Optional[ParticipantPresence]:
        self.connections.pop(connection_id, None)
        self.last_heartbeats.pop(connection_id, None)
        return self.presences.pop(connection_id, None)

    def update_heartbeat(self, connection_id: str):
        self.last_heartbeats[connection_id] = time.time()

class ConnectionManager:
    def __init__(self):
        self.rooms: Dict[str, Room] = {}

    def get_or_create_room(self, meeting_id: str) -> Room:
        if meeting_id not in self.rooms:
            self.rooms[meeting_id] = Room(meeting_id)
        return self.rooms[meeting_id]

    async def send_to_connection(self, ws: WebSocket, msg: SignalingMessage):
        await ws.send_text(msg.model_dump_json())

    async def unicast(self, meeting_id: str, target_id: str, msg: SignalingMessage):
        room = self.rooms.get(meeting_id)
        if room and target_id in room.connections:
            ws = room.connections[target_id]
            try:
                await self.send_to_connection(ws, msg)
            except Exception:
                await self.handle_disconnect(meeting_id, target_id)

    async def broadcast(self, meeting_id: str, msg: SignalingMessage, exclude_id: Optional[str] = None):
        room = self.rooms.get(meeting_id)
        if room:
            failed_connections = []
            for conn_id, ws in room.connections.items():
                if exclude_id and conn_id == exclude_id:
                    continue
                try:
                    await self.send_to_connection(ws, msg)
                except Exception:
                    failed_connections.append(conn_id)
            for conn_id in failed_connections:
                await self.handle_disconnect(meeting_id, conn_id)

    async def handle_disconnect(self, meeting_id: str, conn_id: str):
        room = self.rooms.get(meeting_id)
        if room:
            presence = room.remove_participant(conn_id)
            if presence:
                print(f"[WS] Participant {presence.display_name} ({conn_id}) disconnected from meeting {meeting_id}")
                # Notify remaining members in the room
                leave_msg = SignalingMessage(
                    id=str(uuid.uuid4()),
                    type="participant-left",
                    meetingId=meeting_id,
                    senderId=conn_id,
                    timestamp=time.time(),
                    payload={
                        "display_name": presence.display_name,
                        "connection_id": conn_id,
                        "user_id": presence.user_id
                    }
                )
                await self.broadcast(meeting_id, leave_msg)
            # Remove room from global state if no connections remain
            if not room.connections:
                self.rooms.pop(meeting_id, None)

    async def start_heartbeat_monitor(self):
        """Asynchronous background loop to check for heartbeat timeouts."""
        while True:
            await asyncio.sleep(15) # Check every 15 seconds
            now = time.time()
            for meeting_id, room in list(self.rooms.items()):
                for conn_id, last_time in list(room.last_heartbeats.items()):
                    if now - last_time > 45: # 45 seconds threshold (30s interval + 15s leeway)
                        print(f"[WS] Heartbeat timeout for {conn_id} in meeting {meeting_id}")
                        ws = room.connections.get(conn_id)
                        if ws:
                            try:
                                await ws.close(code=4000, reason="Heartbeat timeout")
                            except Exception:
                                pass
                        await self.handle_disconnect(meeting_id, conn_id)

# Global signaling manager instance
manager = ConnectionManager()
