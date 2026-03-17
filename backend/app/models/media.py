import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime, Text
from app.database import Base


class MediaFile(Base):
    __tablename__ = "media_files"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    original_path = Column(Text, nullable=True)
    current_path = Column(Text, nullable=True)
    status = Column(String, default="pending")  # pending, organizing, done, error
    confidence = Column(Float, default=0.0)
    type = Column(String, nullable=True)  # movie, tv
    title = Column(String, nullable=True)
    year = Column(String, nullable=True)
    tmdb_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
