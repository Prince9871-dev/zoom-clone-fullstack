# Zoom Clone Backend API

A production-quality REST API backend architecture built using **FastAPI**, **SQLAlchemy 2.0**, **Pydantic v2**, **Alembic**, and **SQLite**.

## Architecture & Design Decisions

1. **Separation of Concerns (Service Layer)**: Controller routes (`routers/meetings.py`) only handle request validation and responses, delegating all database transactions and business logic to a dedicated service layer (`services/meeting_service.py`).
2. **SQLAlchemy 2.0 Style**: Avoids deprecated APIs. All database transactions are executed using type-annotated `Mapped` attributes and `select(...)` structures instead of `query(...)` methods.
3. **Pydantic v2 Syntax**: Uses `ConfigDict(from_attributes=True)` and modern `@field_validator` hooks for validation.
4. **Offline Database Persistence**: Relies on a local SQLite database (`zoom_clone.db`). Alembic is fully configured to track and manage migrations automatically.
5. **Zoom-Style Meeting IDs**: Automatically generates alphanumeric, human-readable meeting IDs in the format `abc-1234-xyz`. It verifies database uniqueness using an anti-collision loop before inserting records.

---

## Database Schema Design

### Meetings Table
| Column Name | SQLAlchemy Type | Constraints | Description |
|---|---|---|---|
| `id` | `Integer` | Primary Key, Index | Autoincrement internal ID |
| `meeting_id` | `String(50)` | Unique, Index, Not Null | Public ID (e.g. `abc-1234-xyz`) |
| `title` | `String(100)` | Not Null | Title of the meeting |
| `description` | `String(500)` | Nullable | Optional meeting agenda |
| `host_name` | `String(100)` | Not Null | Display name of the meeting host |
| `invite_link` | `String(255)` | Not Null | Generated invite URL |
| `scheduled_at` | `DateTime` | Not Null | Start time (or now for instant meetings) |
| `duration_minutes` | `Integer` | Not Null | Meeting duration in minutes |
| `status` | `String(50)` | Not Null (Default: "scheduled") | Meeting status ("scheduled", "active", "completed", "cancelled") |
| `created_at` | `DateTime` | server_default=func.now() | Record creation timestamp |
| `updated_at` | `DateTime` | server_default=func.now(), onupdate | Record update timestamp |

### Participants Table
| Column Name | SQLAlchemy Type | Constraints | Description |
|---|---|---|---|
| `id` | `Integer` | Primary Key, Index | Autoincrement internal ID |
| `meeting_id` | `Integer` | Foreign Key (meetings.id, CASCADE) | Link to parent meeting |
| `display_name` | `String(100)` | Not Null | Display name of the participant |
| `joined_at` | `DateTime` | server_default=func.now() | Timestamp when they joined |
| `left_at` | `DateTime` | Nullable | Timestamp when they left |
| `is_host` | `Boolean` | Not Null (Default: False) | True if this user is the meeting host |

---

## API Endpoints List

### 1. Create Instant Meeting
* **Method & Path**: `POST /meetings/new`
* **Request Body**:
  ```json
  {
    "host_name": "Diana Prince"
  }
  ```
* **Response (201 Created)**: Returns the complete meeting details and automatically registers the host as the first participant in the meeting.

### 2. Schedule Meeting
* **Method & Path**: `POST /meetings/schedule`
* **Request Body**:
  ```json
  {
    "title": "Project Alignment Sync",
    "description": "Discussing phase 2 tasks",
    "scheduled_at": "2026-08-01T14:30:00",
    "duration_minutes": 60,
    "host_name": "Diana Prince"
  }
  ```
* **Response (201 Created)**: Returns the scheduled meeting details (status set to `"scheduled"`).

### 3. Join Meeting
* **Method & Path**: `POST /meetings/join`
* **Request Body**:
  ```json
  {
    "meeting_id": "abc-1234-xyz",
    "display_name": "Bruce Wayne",
    "is_host": false
  }
  ```
* **Response (200 OK)**: Adds the user to the meeting's participants table. If the meeting was `"scheduled"`, updates its status to `"active"`. Returns the full meeting object.
* **Exceptions**: Returns `404 Not Found` if meeting doesn't exist, and `400 Bad Request` if the meeting has already completed.

### 4. Get All Meetings
* **Method & Path**: `GET /meetings`
* **Response (200 OK)**: A list of all meetings in the system ordered by scheduled time.

### 5. Get Upcoming Meetings
* **Method & Path**: `GET /meetings/upcoming`
* **Response (200 OK)**: A list of all scheduled meetings with start times in the future.

### 6. Get Recent Meetings
* **Method & Path**: `GET /meetings/recent`
* **Response (200 OK)**: A list of all meetings scheduled in the past or marked as completed.

### 7. Get Single Meeting
* **Method & Path**: `GET /meetings/{meeting_id}`
* **Response (200 OK)**: Fetches full meeting details and its participant list using the unique Zoom-style public ID (e.g. `/meetings/abc-1234-xyz`).
* **Exceptions**: `404 Not Found` if the meeting is missing.

### 8. Delete Meeting
* **Method & Path**: `DELETE /meetings/{meeting_id}`
* **Response (200 OK)**: Removes the meeting (and cascade-deletes all associated participants).
* **Exceptions**: `404 Not Found` if the meeting is missing.
