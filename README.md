# Zoom Clone

A professional Zoom-inspired real-time video conferencing and meeting management platform built with Next.js 15, FastAPI, WebSockets, and WebRTC.

---

## 1. Technical Architecture

The project is structured as a full-stack monorepo:

* **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS, ShadCN UI, TanStack React Query (server state), and Zustand (global authentication state). Media tracks are captured locally via the HTML5 MediaStream API and transmitted peer-to-peer using WebRTC.
* **Backend**: FastAPI, SQLite database, SQLAlchemy 2.0 ORM, Alembic database migrations, and Pydantic v2 schemas.
* **Signaling Server**: FastAPI WebSockets are used as a signaling channel. WebSockets manage participant presences, forward WebRTC SDP offers/answers, forward ICE candidates, and route administrative commands. Media streams (audio and video) flow entirely peer-to-peer (P2P) and never touch the FastAPI server.

```
                  SDP Offer / Answer & ICE Candidates
   Peer A <─────────────────────────────────────────────────> Peer B
     │                                                          │
     │ Capture Camera & Mic                      Play Audio/Video│
     ▼                                                          ▼
[Next.js Client] <───────── WebSocket Signaling ─────────> [Next.js Client]
                                   │
                                   ▼
                       [FastAPI WebSocket Server]
                                   │
                                   ▼
                       [SQLite Database (ORM)]
```

---

## 2. Database Schema

The SQLite schema represents a relational structure with CASCADE deletions handled natively by SQLite connection pragmas:

* **`users` Table**: ID, email (unique, indexed), full_name, hashed_password, avatar_url, created_at, updated_at.
* **`meetings` Table**: ID, meeting_id (unique, indexed), title, description, host_name, invite_link, scheduled_at, duration_minutes, status, meeting_started_at, is_recording, recording_started_at, host_id (Foreign Key pointing to `users.id` with `ondelete="SET NULL"`).
* **`participants` Table**: ID, meeting_id (Foreign Key pointing to `meetings.id` with `ondelete="CASCADE"`), user_id (Foreign Key pointing to `users.id` with `ondelete="SET NULL"`), display_name, joined_at, left_at, is_host.

SQLite Foreign Key support is explicitly enabled on every database connection pool session using SQLAlchemy event listeners:
```python
@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()
```

---

## 3. WebSocket Signaling Protocol

The WebSocket signaling server handles real-time synchronization using a strongly-typed message frame:

```json
{
  "id": "uuid-string",
  "type": "join | leave | offer | answer | ice-candidate | camera-state | microphone-state | ejected | mute-all | recording-start | recording-stop",
  "meetingId": "abc-1234-xyz",
  "senderId": "sender-connection-uuid",
  "targetId": "target-connection-uuid",
  "timestamp": 1785105349,
  "payload": {}
}
```

### Handshake & Media Negotiation Flow
1. **Join**: The client opens a WebSocket connection to `ws://localhost:8000/ws/{meeting_id}?token={jwt_token}`. The server validates the token, accepts the connection, and broadcasts a `join` event to other participants.
2. **Offer & Answer**: Remote peers receive the join notification, construct an `RTCPeerConnection`, call `createOffer()`, and unicast an `offer` message to the joining client. The joining client returns an `answer` message.
3. **ICE Candidates**: Both clients exchange network routing candidates via `ice-candidate` messages until the connection is established.
4. **State Broadcaster**: Track toggles (`microphone-state`, `camera-state`) are broadcasted to all connected peers to sync mute indicators in real-time.
5. **Host Control Signals**:
   * **Mute All**: The meeting host sends a `mute-all` broadcast. The backend verifies the host's identity and forwards the signal. Receiving clients disable their local microphone tracks.
   * **Eject**: The meeting host sends a `remove-participant` signal targetting a participant connection ID. The target client receives an `ejected` frame, stops all media tracks, terminates peer connections, and redirects to the dashboard.
   * **Recording Status**: The host starts/stops recording state, writing metadata to the database and broadcasting `recording-start` / `recording-stop` triggers to update red recording duration pills in sync.

---

## 4. Setup & Running Instructions

### Prerequisites
* Node.js (v18.x or above)
* Python (v3.10 or above)

### 1. Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Initialize and activate a Python virtual environment:
   ```bash
   python -m venv venv
   # Windows (PowerShell)
   .\venv\Scripts\activate
   # macOS / Linux
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Copy environment settings and configure keys:
   ```bash
   copy .env.example .env
   ```
5. Apply database migrations:
   ```bash
   alembic upgrade head
   ```
6. Seed the database with sample user credentials and meeting records:
   ```bash
   python app/seed.py
   ```
7. Start the FastAPI development server:
   ```bash
   uvicorn app.main:app --reload
   ```

### 2. Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install Node packages:
   ```bash
   npm install
   ```
3. Copy environment settings:
   ```bash
   copy .env.example .env.local
   ```
4. Start the Next.js development server:
   ```bash
   npm run dev
   ```
5. Open your browser and navigate to `http://localhost:3000`. Log in using the seeded credentials:
   * **Email**: `prince@example.com`
   * **Password**: `password123`

---

## 5. Environment Variables Reference

### Backend (`backend/.env`)
* `DATABASE_URL`: Database connection URI (defaults to local SQLite: `sqlite:///./zoom_clone.db`). Automatically normalizes `postgres://` prefixes to `postgresql://` on cloud deployments like Render/Heroku.
* `SECRET_KEY`: Random string for JWT encryption.
* `ACCESS_TOKEN_EXPIRE_MINUTES`: Expiration time for generated access tokens (e.g. `1440` for 24 hours).
* `FRONTEND_URL`: URL origin of the frontend web app to configure CORS middleware.

### Frontend (`frontend/.env.local`)
* `NEXT_PUBLIC_API_URL`: Root URL endpoint for backend REST services (e.g. `http://localhost:8000`).
* `NEXT_PUBLIC_WS_URL`: Root URL endpoint for WebSocket signaling connections (e.g. `ws://localhost:8000`). Automatically maps protocols to `wss://` in production environments.

---

## 6. Features Checklist

* **Authentication Guard Rails**: Zod-validated authentication inputs with JWT tokens persisted in Zustand state and client `localStorage`.
* **Apple & SaaS-Inspired UI Layouts**: Refactored typography, hover lifts, semantic contrast borders, and responsive dashboards with 3-way Cycle Theme Selectors (Light, Dark, and System).
* **IP-Based Local Timezone**: Automatically extracts and displays browser timezone names (e.g., `Asia/Kolkata`) and local times (`Monday • 10:37 AM`) on the home greeting dashboard.
* **Synchronized Meeting Timers**: Synchronizes meeting room clocks relative to the backend database start epoch. Clocks survive refreshes and late joins.
* **Host Control Actions**: The meeting host can trigger Mute All participants or Eject users from active sessions.
* **Live Recording Indicators**: Display red animated recording pills with synchronized durations for all connected users in real-time.
