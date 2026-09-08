import os
import time
from datetime import datetime

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, DateTime
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql://pixelchat:pixelchat@db:5432/pixelchat"
)

# --- DB setup -----------------------------------------------------------

Base = declarative_base()


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, index=True)
    text = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)


def wait_for_engine(url, retries=20, delay=1.5):
    last_err = None
    for _ in range(retries):
        try:
            eng = create_engine(url)
            conn = eng.connect()
            conn.close()
            return eng
        except Exception as e:  # db might not be ready yet
            last_err = e
            time.sleep(delay)
    raise last_err


engine = wait_for_engine(DATABASE_URL)
Base.metadata.create_all(bind=engine)
SessionLocal = sessionmaker(bind=engine)

# --- App ------------------------------------------------------------------

app = FastAPI(title="PixelChat")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def serialize(msg: Message):
    return {
        "id": msg.id,
        "username": msg.username,
        "text": msg.text,
        "created_at": msg.created_at.isoformat(),
    }


class ConnectionManager:
    def __init__(self):
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self.active:
            self.active.remove(ws)

    async def broadcast(self, payload: dict):
        dead = []
        for conn in self.active:
            try:
                await conn.send_json(payload)
            except Exception:
                dead.append(conn)
        for d in dead:
            self.disconnect(d)


manager = ConnectionManager()


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/messages")
def get_messages():
    session = SessionLocal()
    try:
        rows = session.query(Message).order_by(Message.id.asc()).limit(200).all()
        return [serialize(r) for r in rows]
    finally:
        session.close()


@app.websocket("/ws/{username}")
async def ws_endpoint(websocket: WebSocket, username: str):
    await manager.connect(websocket)
    try:
        # let everyone know someone joined
        await manager.broadcast(
            {"type": "system", "text": f"{username} joined the chat"}
        )
        while True:
            data = await websocket.receive_json()
            text = (data.get("text") or "").strip()
            if not text:
                continue

            session = SessionLocal()
            try:
                msg = Message(username=username, text=text)
                session.add(msg)
                session.commit()
                session.refresh(msg)
            finally:
                session.close()

            await manager.broadcast({"type": "message", **serialize(msg)})
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        await manager.broadcast(
            {"type": "system", "text": f"{username} left the chat"}
        )
