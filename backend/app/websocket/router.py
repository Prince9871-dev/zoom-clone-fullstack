import time
import uuid
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.database import get_db
from app.models.meeting import Meeting
from app.websocket.auth import get_ws_user
from app.websocket.presence import ParticipantPresence
from app.websocket.schemas import SignalingMessage
from app.websocket.manager import manager

router = APIRouter(
    prefix="/ws",
    tags=["signaling"]
)

@router.websocket("/{meeting_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    meeting_id: str,
    token: str = Query(..., description="JWT Bearer Token"),
    db: Session = Depends(get_db)
):
    # 1. Accept the connection immediately to establish the session cleanly
    await websocket.accept()
    
    # 2. Run validations
    try:
        # A. Validate JWT Token
        try:
            user = get_ws_user(token, db)
        except ValueError as e:
            print(f"[WS Auth Error] Handshake rejected: {e}")
            await websocket.send_text(json.dumps({
                "type": "error",
                "payload": {"message": f"Auth failed: {str(e)}"}
            }))
            await websocket.close(code=1008, reason=f"Auth failed: {str(e)}")
            return

        # B. Verify meeting exists in database
        stmt = select(Meeting).where(Meeting.meeting_id == meeting_id)
        meeting = db.execute(stmt).scalar_one_or_none()
        if not meeting:
            print(f"[WS Error] Meeting '{meeting_id}' not found")
            await websocket.send_text(json.dumps({
                "type": "error",
                "payload": {"message": "Meeting room not found"}
            }))
            await websocket.close(code=3000, reason="Meeting room not found")
            return

        # C. Verify meeting is active
        if meeting.status == "completed":
            print(f"[WS Error] Meeting '{meeting_id}' is completed")
            await websocket.send_text(json.dumps({
                "type": "error",
                "payload": {"message": "This meeting has already ended."}
            }))
            await websocket.close(code=3000, reason="Meeting has already ended")
            return

    except Exception as e:
        print(f"[WS Exception during validation] {e}")
        await websocket.close(code=1011, reason="Internal validation error")
        return

    connection_id = f"conn_{uuid.uuid4().hex[:8]}"
    print(f"[WS] Connection {connection_id} accepted for user '{user.full_name}' in meeting '{meeting_id}'")

    # 4. Initialize Presence State
    presence = ParticipantPresence(
        user_id=user.id,
        connection_id=connection_id,
        meeting_id=meeting_id,
        display_name=user.full_name,
        joined_at=time.time(),
        camera_enabled=True,
        microphone_enabled=True,
        screen_sharing=False,
        connection_state="connected"
    )
    
    room = manager.get_or_create_room(meeting_id)
    
    # 5. Send current participant presence list to the new joiner
    existing_presences = {
        conn_id: pres.model_dump() 
        for conn_id, pres in room.presences.items()
    }
    
    list_msg = SignalingMessage(
        id=str(uuid.uuid4()),
        type="participant-list",
        meetingId=meeting_id,
        senderId="server",
        targetId=connection_id,
        timestamp=time.time(),
        payload={"participants": existing_presences}
    )
    await websocket.send_text(list_msg.model_dump_json())

    # 6. Add new participant connection to manager registry
    room.add_participant(connection_id, websocket, presence)

    # 7. Broadcast join event to all other room members
    join_msg = SignalingMessage(
        id=str(uuid.uuid4()),
        type="join",
        meetingId=meeting_id,
        senderId=connection_id,
        timestamp=time.time(),
        payload=presence.model_dump()
    )
    await manager.broadcast(meeting_id, join_msg, exclude_id=connection_id)

    # 8. Connection Listen Loop
    try:
        while True:
            raw_data = await websocket.receive_text()
            data = json.loads(raw_data)
            
            # Parse into strongly-typed schema
            msg = SignalingMessage(**data)
            
            # Security checks: prevent spoofing and cross-room signaling leakage
            if msg.meetingId != meeting_id:
                print(f"[WS Security] Mismatched meetingId in message from {connection_id}")
                continue
            if msg.senderId != connection_id:
                print(f"[WS Security] Mismatched senderId in message from {connection_id}")
                continue

            # Heartbeat handling
            if msg.type == "heartbeat":
                room.update_heartbeat(connection_id)
                pong_msg = SignalingMessage(
                    id=str(uuid.uuid4()),
                    type="pong",
                    meetingId=meeting_id,
                    senderId="server",
                    targetId=connection_id,
                    timestamp=time.time()
                )
                await websocket.send_text(pong_msg.model_dump_json())
                continue

            # targeted messaging forwarding (offer, answer, ice-candidate)
            if msg.type in ("offer", "answer", "ice-candidate"):
                if not msg.targetId:
                    print(f"[WS Warning] Unicast message '{msg.type}' missing targetId")
                    continue
                # Confirm target resides in the same room connection list
                if msg.targetId not in room.connections:
                    print(f"[WS Warning] Target connection '{msg.targetId}' not found in room '{meeting_id}'")
                    continue
                await manager.unicast(meeting_id, msg.targetId, msg)
                continue

            # Host Controls (mute-all, remove-participant)
            if msg.type in ("mute-all", "remove-participant"):
                # Verify that the sender is the registered meeting host
                stmt = select(Meeting).where(Meeting.meeting_id == meeting_id)
                meeting = db.execute(stmt).scalar_one_or_none()
                if not meeting or meeting.host_name != presence.display_name:
                    print(f"[WS Security] Non-host '{presence.display_name}' attempted host control '{msg.type}'")
                    continue

                if msg.type == "mute-all":
                    # Broadcast mute-all event to all other room participants
                    await manager.broadcast(meeting_id, msg, exclude_id=connection_id)
                elif msg.type == "remove-participant":
                    target_conn_id = msg.targetId
                    if target_conn_id in room.connections:
                        eject_msg = SignalingMessage(
                            id=str(uuid.uuid4()),
                            type="ejected",
                            meetingId=meeting_id,
                            senderId=connection_id,
                            targetId=target_conn_id,
                            timestamp=time.time()
                        )
                        # Send the targeted ejection signal to the participant
                        await manager.unicast(meeting_id, target_conn_id, eject_msg)
                continue

            # state update broadcasting (mic, camera, screen-sharing, recording toggles)
            if msg.type in ("camera-state", "microphone-state", "screen-share-start", "screen-share-stop", "recording-start", "recording-stop"):
                if msg.type == "camera-state":
                    presence.camera_enabled = msg.payload.get("enabled", True)
                elif msg.type == "microphone-state":
                    presence.microphone_enabled = msg.payload.get("enabled", True)
                elif msg.type == "screen-share-start":
                    presence.screen_sharing = True
                elif msg.type == "screen-share-stop":
                    presence.screen_sharing = False

                # Broadcast update state to everyone else
                await manager.broadcast(meeting_id, msg, exclude_id=connection_id)
                continue

    except WebSocketDisconnect:
        # Trigger clean exit disconnect operations
        await manager.handle_disconnect(meeting_id, connection_id)
    except Exception as e:
        print(f"[WS Exception] Connection {connection_id} encountered error: {e}")
        await manager.handle_disconnect(meeting_id, connection_id)
