import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Text, DateTime
from app.database import Base


class MediaMetadata(Base):
    __tablename__ = "media_metadata"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    media_file_id = Column(String, nullable=True)
    title = Column(String, nullable=False)
    year = Column(Integer, nullable=True)
    tmdb_id = Column(Integer, nullable=True)
    media_type = Column(String, nullable=True)  # movie, tv
    overview = Column(Text, nullable=True)
    poster_url = Column(String, nullable=True)
    backdrop_url = Column(String, nullable=True)
    rating = Column(String, nullable=True)
    genres = Column(Text, nullable=True)  # JSON string
    created_at = Column(DateTime, default=datetime.utcnow)
