from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.auth import UserRegister, UserLogin, UserResponse, TokenResponse, UserUpdate
from app.models.user import User
from app.services.auth_service import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user
)

router = APIRouter(
    prefix="/auth",
    tags=["authentication"]
)

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(data: UserRegister, db: Session = Depends(get_db)):
    """Registers a new user by checking email uniqueness, hashing their password, and saving their profile details."""
    # Check if email is already registered
    stmt = select(User).where(User.email == data.email)
    exists = db.execute(stmt).scalar_one_or_none()
    if exists:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address is already registered"
        )
        
    # Generate generic avatar URL based on email
    avatar_hash = hash(data.email) % 100
    avatar_url = f"https://api.dicebear.com/7.x/bottts/svg?seed={data.email}"

    db_user = User(
        email=data.email,
        full_name=data.full_name,
        hashed_password=hash_password(data.password),
        avatar_url=avatar_url
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@router.post("/login", response_model=TokenResponse, status_code=status.HTTP_200_OK)
def login_user(data: UserLogin, db: Session = Depends(get_db)):
    """Authenticates user credentials, generates a JWT token, and returns user profile details."""
    stmt = select(User).where(User.email == data.email)
    user = db.execute(stmt).scalar_one_or_none()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    access_token = create_access_token(data={"sub": user.email})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }

@router.get("/me", response_model=UserResponse, status_code=status.HTTP_200_OK)
def get_user_profile(current_user: User = Depends(get_current_user)):
    """Retrieves current user details based on the JWT authorization header."""
    return current_user

@router.put("/profile", response_model=UserResponse, status_code=status.HTTP_200_OK)
def update_profile(data: UserUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Updates the authenticated user's display name or password."""
    if data.full_name is not None:
        name = data.full_name.strip()
        if not name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Name cannot be empty"
            )
        current_user.full_name = name
        
    if data.password is not None:
        current_user.hashed_password = hash_password(data.password)
        
    db.commit()
    db.refresh(current_user)
    return current_user

