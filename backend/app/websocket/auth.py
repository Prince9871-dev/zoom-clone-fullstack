import jwt
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.config import settings
from app.services.auth_service import ALGORITHM
from app.models.user import User

def get_ws_user(token: str, db: Session) -> User:
    """Verifies the JWT token for a WebSocket connection and returns the associated User."""
    try:
        # Strip potential enclosing quotes
        token_str = token.strip('"\'')
        payload = jwt.decode(token_str, settings.SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise ValueError("JWT 'sub' claim is missing")
    except jwt.PyJWTError as e:
        raise ValueError(f"Invalid token signature or expired: {e}")
        
    stmt = select(User).where(User.email == email)
    user = db.execute(stmt).scalar_one_or_none()
    if user is None:
        raise ValueError(f"User '{email}' not found in database")
    return user
