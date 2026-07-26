import sys
import random
from datetime import datetime, timedelta
from sqlalchemy import delete, select
from sqlalchemy.orm import Session
from app.database import SessionLocal, Base, engine
from app.models.meeting import Meeting, Participant
from app.services.meeting_service import get_unique_meeting_id
from app.config import settings

# Sample data for seeding
HOSTS = ["Alice Smith", "Bob Jones", "Charlie Brown", "Diana Prince", "Evan Wright"]
PARTICIPANTS = [
    "Frank Castle", "Grace Hopper", "Hank Pym", "Ivy Pepper", 
    "Jack Ryan", "Karen Page", "Leo Fitz", "Melinda May"
]

UPCOMING_TOPICS = [
    "Daily Team Standup",
    "Product Architecture Sync",
    "Frontend UI Design Review",
    "Weekly Marketing Alignment",
    "SDE Full-Stack Code Review"
]

PREVIOUS_TOPICS = [
    "Sprint 1 Project Planning",
    "Quick Architecture Sync",
    "Database Migration Review",
    "System Outage Post-Mortem",
    "Engineering 1-on-1 Catchup"
]

def seed_database():
    db: Session = SessionLocal()
    try:
        # Clear existing tables in correct order due to foreign key constraints
        print("Clearing existing records...")
        db.execute(delete(Participant))
        db.execute(delete(Meeting))
        db.commit()

        frontend_url = settings.FRONTEND_URL.rstrip('/')
        now = datetime.now()

        # 1. Generate 5 Upcoming Meetings
        print("Generating 5 upcoming meetings...")
        for i in range(5):
            meeting_id = get_unique_meeting_id(db)
            host = random.choice(HOSTS)
            scheduled_time = now + timedelta(days=i+1, hours=random.randint(1, 8))
            duration = random.choice([30, 45, 60, 90])
            
            meeting = Meeting(
                meeting_id=meeting_id,
                title=UPCOMING_TOPICS[i],
                description=f"Automated discussions and review for {UPCOMING_TOPICS[i]}.",
                host_name=host,
                invite_link=f"{frontend_url}/join/{meeting_id}",
                scheduled_at=scheduled_time,
                duration_minutes=duration,
                status="scheduled"
            )
            db.add(meeting)
            db.commit()
            db.refresh(meeting)

            # Auto-add host as participant
            host_part = Participant(
                meeting_id=meeting.id,
                display_name=host,
                joined_at=scheduled_time,
                is_host=True
            )
            db.add(host_part)

            # Add 1-4 random participants
            num_participants = random.randint(1, 4)
            chosen_participants = random.sample(PARTICIPANTS, num_participants)
            for guest_name in chosen_participants:
                guest_part = Participant(
                    meeting_id=meeting.id,
                    display_name=guest_name,
                    joined_at=scheduled_time + timedelta(minutes=random.randint(1, 5)),
                    is_host=False
                )
                db.add(guest_part)
            db.commit()

        # 2. Generate 5 Previous Meetings
        print("Generating 5 previous meetings...")
        for i in range(5):
            meeting_id = get_unique_meeting_id(db)
            host = random.choice(HOSTS)
            # Scheduled in the past (e.g. 1 to 5 days ago)
            scheduled_time = now - timedelta(days=i+1, hours=random.randint(1, 8))
            duration = random.choice([30, 45, 60, 90])
            
            meeting = Meeting(
                meeting_id=meeting_id,
                title=PREVIOUS_TOPICS[i],
                description=f"Archived notes from {PREVIOUS_TOPICS[i]}.",
                host_name=host,
                invite_link=f"{frontend_url}/join/{meeting_id}",
                scheduled_at=scheduled_time,
                duration_minutes=duration,
                status="completed"
            )
            db.add(meeting)
            db.commit()
            db.refresh(meeting)

            # Add host as participant
            host_part = Participant(
                meeting_id=meeting.id,
                display_name=host,
                joined_at=scheduled_time,
                left_at=scheduled_time + timedelta(minutes=duration),
                is_host=True
            )
            db.add(host_part)

            # Add 1-4 random participants
            num_participants = random.randint(1, 4)
            chosen_participants = random.sample(PARTICIPANTS, num_participants)
            for guest_name in chosen_participants:
                guest_join = scheduled_time + timedelta(minutes=random.randint(1, 5))
                guest_left = guest_join + timedelta(minutes=random.randint(15, duration - 5))
                # Ensure left time doesn't exceed too much
                if guest_left > scheduled_time + timedelta(minutes=duration):
                    guest_left = scheduled_time + timedelta(minutes=duration)
                
                guest_part = Participant(
                    meeting_id=meeting.id,
                    display_name=guest_name,
                    joined_at=guest_join,
                    left_at=guest_left,
                    is_host=False
                )
                db.add(guest_part)
            db.commit()

        print("Database seeding completed successfully!")

    except Exception as e:
        print(f"Error seeding database: {e}")
        db.rollback()
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
