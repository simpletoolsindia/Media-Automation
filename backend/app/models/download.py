import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime, Text
from app.database import Base


class Download(Base):
    __tablename__ = "downloads"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String, nullable=False)
    magnet = Column(Text, nullable=True)
    status = Column(String, default="queued")  # queued, downloading, done, error, paused
    progress = Column(Float, default=0.0)
    size = Column(Float, default=0.0)
    speed = Column(String, nullable=True)
    eta = Column(String, nullable=True)
    client = Column(String, default="qbittorrent")
    torrent_hash = Column(String, nullable=True)
    save_path = Column(Text, nullable=True)
    media_type = Column(String, nullable=True)  # movie, tv
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
