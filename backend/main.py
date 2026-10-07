"""Campus Customs backend (FastAPI).

Problem 3: serve the product catalogue, stock, and images from the local SQLite
data pack, plus a stub chat endpoint. Problem 5 grows this into the agent backend.
Problem 4: create-account / log-in / log-out with securely hashed passwords and a
signed, HttpOnly session cookie.
Problem 5: POST /api/chat runs the PydanticAI shop agent (agent.py + tools.py +
models.py + prompts/prompt.md).
Problem 8: signed-in shoppers' chats are saved in `chat_messages` and reloaded; the agent
gets the shopper's name/email and the page they're on.
Problem 12 feature: the design studio (/api/studio/*) pitches a new product from a shopper's answers,
picks real items that fit their vibe, and learns their likes (saved to their account).

Run from this folder:  uvicorn main:app --reload --port 8000
"""

import base64
import threading
import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import time
from collections import defaultdict, deque
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent
load_dotenv(BACKEND_DIR.parent / ".env")  # before importing modules that read settings

from fastapi import Depends, FastAPI, HTTPException, Request, Response  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from fastapi.responses import FileResponse, StreamingResponse  # noqa: E402
from pydantic import BaseModel, Field, field_validator  # noqa: E402
from pydantic_ai.exceptions import ModelHTTPError, UsageLimitExceeded  # noqa: E402

import agent  # noqa: E402
import images  # noqa: E402
from models import (  # noqa: E402
    ChatHistoryMessage, ChatRequest, ChatResponse, ChatTurn, CustomerContext, StudioAnswers, StudioFeedback,
    StudioPickCard, StudioRequest, StudioResponse,
)
from tools import (  # noqa: E402
    DATA_DIR, DB_PATH, IMAGE_VERSION, PRODUCT_SQL, SIZE_ORDER, all_product_rows, complete_the_look, garment_kind,
    known_product_ids, more_like_this, other_colors, picked_for_you, product_cards, to_card,
)

IMAGES_DIR = DATA_DIR / "products"

if not DB_PATH.exists():
    raise RuntimeError(f"Database not found at {DB_PATH}. Place the data pack in data/ first.")

# Chat history is read per user, newest first; index it once (safe to run every start).
with sqlite3.connect(DB_PATH) as _conn:
    _conn.execute("CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON chat_messages (user_id, id)")
    # Design studio (Problem 12 feature): each shopper's last answers, their likes, and every pitch.
    _conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS style_profiles (
            user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            answers_json TEXT NOT NULL,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS product_feedback (
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            product_id TEXT NOT NULL,
            verdict TEXT NOT NULL CHECK (verdict IN ('like', 'dislike')),
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, product_id)
        );
        CREATE TABLE IF NOT EXISTS product_pitches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            answers_json TEXT NOT NULL,
            concept_json TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        """
    )

app = FastAPI(title="Campus Customs API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Product images (Problem 9): served cleaned up, never the raw folder or the DB
# ---------------------------------------------------------------------------
# The clean-up itself lives in images.py (AI cut-out on a white canvas, centered).
# The data pack is never edited: cleaned copies are cached in data/.image_cache/.

IMAGE_CACHE_DIR = DATA_DIR / ".image_cache"  # inside data/, so git ignores it and --reload doesn't fire
IMAGE_NAME_RE = re.compile(r"^[A-Za-z0-9_\-]+\.(?:jpg|jpeg|png|webp)$", re.IGNORECASE)


def _cache_path(source: Path, kind: str) -> Path:
    return IMAGE_CACHE_DIR / f"{source.stem}-{IMAGE_VERSION}-{kind}.jpg"


def cleaned_image(source: Path, use_ai: bool) -> Path:
    """Return the cached clean version of a product photo, building it if needed."""
    target = _cache_path(source, "ai" if use_ai else "basic")
    if target.exists() and target.stat().st_mtime >= source.stat().st_mtime:
        return target
    IMAGE_CACHE_DIR.mkdir(exist_ok=True)
    out = images.clean_photo(source, DATA_DIR, use_ai=use_ai)
    tmp = target.with_suffix(f".{threading.get_ident()}.tmp")
    out.save(tmp, "JPEG", quality=90, optimize=True)
    tmp.replace(target)  # atomic, so two requests can't serve a half-written file
    return target


@app.get("/images/{filename}")
def product_image(filename: str, raw: bool = False) -> FileResponse:
    # Only plain file names from the products folder: no paths, no database.
    if not IMAGE_NAME_RE.match(filename) or not (IMAGES_DIR / filename).is_file():
        raise HTTPException(status_code=404, detail="Image not found")
    source = IMAGES_DIR / filename
    if raw:
        return FileResponse(source)  # ?raw=1 shows the original photo (for before/after checks)
    ai_copy = _cache_path(source, "ai")
    if ai_copy.exists():
        return FileResponse(ai_copy, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=86400"})
    # The AI copy is still being made in the background (first start): serve the quick clean-up
    # and tell the browser not to keep it, so it picks up the AI version on the next visit.
    try:
        path = cleaned_image(source, use_ai=False)
    except Exception as error:  # a photo we can't process still shows, just uncleaned
        print(f"Image clean-up failed for {filename}: {type(error).__name__}")
        path = source
    return FileResponse(path, media_type="image/jpeg", headers={"Cache-Control": "no-cache"})


def _warm_image_cache() -> None:
    sources = [p for p in sorted(IMAGES_DIR.iterdir()) if IMAGE_NAME_RE.match(p.name)]
    use_ai = images.ensure_model(DATA_DIR) is not None and images.ai_available(DATA_DIR)
    done = 0
    for source in sources:
        try:
            cleaned_image(source, use_ai=use_ai)
            done += 1
        except Exception as error:
            print(f"Image clean-up failed for {source.name}: {type(error).__name__}")
    print(f"Product photos ready: {done}/{len(sources)} ({'AI cut-out' if use_ai else 'simple clean-up'}).")


# Clean all photos in the background at startup so shoppers never wait for it.
threading.Thread(target=_warm_image_cache, daemon=True).start()


@contextmanager
def get_db() -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Products
# ---------------------------------------------------------------------------


def product_summary(row: sqlite3.Row) -> dict:
    return to_card(row).model_dump()


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/products")
def list_products(q: str | None = None) -> list[dict]:
    sql = PRODUCT_SQL
    params: list[str] = []
    if q:
        sql += " WHERE c.name LIKE ? OR c.garment_type LIKE ? OR c.search_tags LIKE ?"
        params = [f"%{q}%"] * 3
    sql += " GROUP BY c.product_id ORDER BY c.name"
    with get_db() as conn:
        rows = conn.execute(sql, params).fetchall()
    return [product_summary(r) for r in rows]


@app.get("/api/products/{product_id}")
def get_product(product_id: str) -> dict:
    with get_db() as conn:
        row = conn.execute(PRODUCT_SQL + " WHERE c.product_id = ? GROUP BY c.product_id", (product_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Product not found")
        stock_rows = conn.execute(
            "SELECT size, quantity FROM inventory WHERE product_id = ?", (product_id,)
        ).fetchall()

    sizes = sorted(
        ({"size": s["size"], "quantity": s["quantity"]} for s in stock_rows),
        key=lambda s: SIZE_ORDER.index(s["size"]) if s["size"] in SIZE_ORDER else len(SIZE_ORDER),
    )
    return {
        **product_summary(row),
        "description": row["description"],
        "search_tags": json.loads(row["search_tags"]),
        "sizes": sizes,
    }


@app.get("/api/products/{product_id}/recommendations")
def recommendations(product_id: str) -> dict:
    """Product page extras (Problem 10): similar styles, other colors, and a complete-the-look outfit."""
    if product_id not in known_product_ids():
        raise HTTPException(status_code=404, detail="Product not found")
    row = next(r for r in all_product_rows() if r["product_id"] == product_id)
    return {
        "kind": garment_kind(row),
        "more_like_this": [c.model_dump() for c in more_like_this(product_id)],
        "other_colors": [c.model_dump() for c in other_colors(product_id)],
        "complete_the_look": complete_the_look(product_id),
    }


class InterestRequest(BaseModel):
    # product_id -> seconds the shopper spent on it (kept only in their own browser)
    interests: dict[str, float] = Field(default_factory=dict, max_length=60)


@app.post("/api/recommendations/for-you")
def for_you(req: InterestRequest) -> dict:
    """Products to suggest based on what the shopper lingered on (no account needed, nothing stored)."""
    ids = picked_for_you({k[:120]: v for k, v in req.interests.items()})
    return {"product_ids": ids, "products": [c.model_dump() for c in product_cards(ids[:6])]}


# ---------------------------------------------------------------------------
# Passwords: salted PBKDF2-HMAC-SHA256
# ---------------------------------------------------------------------------

# New hashes: "pbkdf2_sha256$<iterations>$<salt>$<hex digest>" (OWASP 2023 guidance: 600k).
# Seed-data hashes: "pbkdf2_sha256$<salt>$<hex digest>" made with 120k iterations.
PBKDF2_ITERATIONS = 600_000
LEGACY_ITERATIONS = 120_000


def _pbkdf2(password: str, salt: str, iterations: int) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), iterations).hex()


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt}${_pbkdf2(password, salt, PBKDF2_ITERATIONS)}"


def verify_password(password: str, stored: str) -> bool:
    parts = stored.split("$")
    if len(parts) == 4 and parts[0] == "pbkdf2_sha256":
        _, iterations, salt, digest = parts
        expected = _pbkdf2(password, salt, int(iterations))
    elif len(parts) == 3 and parts[0] == "pbkdf2_sha256":
        _, salt, digest = parts
        expected = _pbkdf2(password, salt, LEGACY_ITERATIONS)
    else:
        return False
    return hmac.compare_digest(expected, digest)


def needs_rehash(stored: str) -> bool:
    parts = stored.split("$")
    return len(parts) != 4 or int(parts[1]) < PBKDF2_ITERATIONS


# Used when an email is unknown, so a failed login takes the same time either way.
_DUMMY_HASH = hash_password(secrets.token_hex(16))


# ---------------------------------------------------------------------------
# Sessions: HMAC-signed token in an HttpOnly cookie
# ---------------------------------------------------------------------------

SESSION_COOKIE = "cc_session"
SESSION_TTL_SECONDS = 7 * 24 * 3600
SESSION_SECRET = os.getenv("SESSION_SECRET") or secrets.token_urlsafe(48)
if not os.getenv("SESSION_SECRET"):
    print("WARNING: SESSION_SECRET not set; using a temporary secret (logins reset on restart).")


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _unb64(data: str) -> bytes:
    return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4))


def make_session_token(user_id: int) -> str:
    payload = _b64(json.dumps({"uid": user_id, "exp": int(time.time()) + SESSION_TTL_SECONDS}).encode())
    sig = _b64(hmac.new(SESSION_SECRET.encode(), payload.encode(), hashlib.sha256).digest())
    return f"{payload}.{sig}"


def read_session_token(token: str) -> int | None:
    try:
        payload, sig = token.split(".")
        expected = _b64(hmac.new(SESSION_SECRET.encode(), payload.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(sig, expected):
            return None
        data = json.loads(_unb64(payload))
        if data["exp"] < time.time():
            return None
        return int(data["uid"])
    except (ValueError, KeyError, json.JSONDecodeError):
        return None


def set_session_cookie(response: Response, user_id: int) -> None:
    response.set_cookie(
        SESSION_COOKIE,
        make_session_token(user_id),
        max_age=SESSION_TTL_SECONDS,
        httponly=True,  # page JavaScript (and any injected script) cannot read it
        samesite="lax",  # not sent on cross-site POSTs
        secure=os.getenv("COOKIE_SECURE", "false").lower() == "true",  # set true behind HTTPS
        path="/",
    )


# ---------------------------------------------------------------------------
# Brute-force protection: at most 5 failed logins per email + IP per 15 minutes
# ---------------------------------------------------------------------------

MAX_FAILED_LOGINS = 5
FAILED_LOGIN_WINDOW = 15 * 60
_failed_logins: dict[tuple[str, str], deque[float]] = defaultdict(deque)


def _recent_failures(key: tuple[str, str]) -> deque[float]:
    attempts = _failed_logins[key]
    while attempts and attempts[0] < time.time() - FAILED_LOGIN_WINDOW:
        attempts.popleft()
    return attempts


# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class UserPublic(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: str


class RegisterRequest(BaseModel):
    first_name: str
    last_name: str
    email: str
    password: str
    confirm_password: str

    @field_validator("first_name", "last_name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        v = v.strip()
        if not 1 <= len(v) <= 50:
            raise ValueError("must be 1 to 50 characters")
        return v

    @field_validator("email")
    @classmethod
    def clean_email(cls, v: str) -> str:
        v = v.strip().lower()
        if len(v) > 254 or not EMAIL_RE.match(v):
            raise ValueError("must be a valid email address")
        return v

    @field_validator("password")
    @classmethod
    def strong_enough(cls, v: str) -> str:
        if not 8 <= len(v) <= 128:
            raise ValueError("must be 8 to 128 characters")
        return v


class LoginRequest(BaseModel):
    email: str
    password: str


def to_public(row: sqlite3.Row) -> UserPublic:
    # Older seed rows may only have "name"; fall back to splitting it.
    first, _, last = (row["name"] or "").partition(" ")
    return UserPublic(
        id=row["id"],
        first_name=row["first_name"] or first,
        last_name=row["last_name"] or last,
        email=row["email"],
    )


def current_user(request: Request) -> UserPublic | None:
    token = request.cookies.get(SESSION_COOKIE)
    user_id = read_session_token(token) if token else None
    if user_id is None:
        return None
    with get_db() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return to_public(row) if row else None


def require_user(user: UserPublic | None = Depends(current_user)) -> UserPublic:
    if user is None:
        raise HTTPException(status_code=401, detail="Please log in.")
    return user


@app.post("/api/auth/register", response_model=UserPublic, status_code=201)
def register(req: RegisterRequest, response: Response) -> UserPublic:
    if req.password != req.confirm_password:
        raise HTTPException(status_code=422, detail="Passwords do not match.")
    password_hash = hash_password(req.password)
    try:
        with get_db() as conn:
            cur = conn.execute(
                "INSERT INTO users (name, email, password_hash, first_name, last_name) VALUES (?, ?, ?, ?, ?)",
                (f"{req.first_name} {req.last_name}", req.email, password_hash, req.first_name, req.last_name),
            )
            user_id = cur.lastrowid
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="An account with that email already exists. Try logging in.")
    set_session_cookie(response, user_id)
    return UserPublic(id=user_id, first_name=req.first_name, last_name=req.last_name, email=req.email)


@app.post("/api/auth/login", response_model=UserPublic)
def login(req: LoginRequest, request: Request, response: Response) -> UserPublic:
    email = req.email.strip().lower()
    key = (email, request.client.host if request.client else "unknown")
    if len(_recent_failures(key)) >= MAX_FAILED_LOGINS:
        raise HTTPException(status_code=429, detail="Too many failed attempts. Please wait 15 minutes and try again.")

    with get_db() as conn:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        ok = verify_password(req.password, row["password_hash"] if row else _DUMMY_HASH) and row is not None
        if not ok:
            _failed_logins[key].append(time.time())
            # Same message whether the email or the password was wrong.
            raise HTTPException(status_code=401, detail="Email or password is incorrect.")
        if needs_rehash(row["password_hash"]):
            # Upgrade older hashes to the current iteration count on a successful login.
            conn.execute("UPDATE users SET password_hash = ? WHERE id = ?", (hash_password(req.password), row["id"]))

    _failed_logins.pop(key, None)
    set_session_cookie(response, row["id"])
    return to_public(row)


@app.post("/api/auth/logout", status_code=204)
def logout(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE, path="/")


@app.get("/api/auth/me", response_model=UserPublic)
def me(user: UserPublic = Depends(require_user)) -> UserPublic:
    return user


# ---------------------------------------------------------------------------
# Chat: the PydanticAI shop agent
# ---------------------------------------------------------------------------

MAX_CHATS_PER_WINDOW = 30
CHAT_WINDOW = 10 * 60
_chat_times: dict[str, deque[float]] = defaultdict(deque)

SORRY = "Sorry, I'm having trouble reaching our shop assistant right now. Please try again in a moment."
DECLINE = (
    "I can only help with Campus Customs shopping, like finding Yale hoodies, crewnecks, and tees, "
    "or checking prices, sizes, and stock. What can I help you find?"
)


# ---------------------------------------------------------------------------
# Customer memory (Problem 8): saved chat history for signed-in shoppers
# ---------------------------------------------------------------------------

HISTORY_FOR_AGENT = 10  # saved messages sent back to the agent as context
HISTORY_FOR_PAGE = 50  # saved messages shown when the chat reloads


def load_saved_history(user_id: int, limit: int) -> list[sqlite3.Row]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT role, content, products_json, created_at FROM chat_messages "
            "WHERE user_id = ? ORDER BY id DESC LIMIT ?",
            (user_id, limit),
        ).fetchall()
    return list(reversed(rows))


def saved_product_ids(products_json: str | None) -> list[str]:
    # Seed rows and our rows both store a JSON list of product objects with a product_id.
    try:
        items = json.loads(products_json) if products_json else []
        return [item["product_id"] for item in items if isinstance(item, dict) and "product_id" in item]
    except (ValueError, TypeError):
        return []


def save_chat_turn(user_id: int, message: str, response: ChatResponse) -> None:
    products_json = json.dumps([card.model_dump() for card in response.products]) if response.products else None
    with get_db() as conn:
        conn.execute(
            "INSERT INTO chat_messages (user_id, role, content, products_json) VALUES (?, 'user', ?, NULL)",
            (user_id, message),
        )
        conn.execute(
            "INSERT INTO chat_messages (user_id, role, content, products_json) VALUES (?, 'assistant', ?, ?)",
            (user_id, response.reply, products_json),
        )


def customer_for(user: UserPublic) -> CustomerContext:
    return CustomerContext(
        first_name=user.first_name, last_name=user.last_name, email=user.email, style_notes=style_notes(user.id)
    )


@app.get("/api/chat/history", response_model=list[ChatHistoryMessage])
def chat_history(user: UserPublic = Depends(require_user)) -> list[ChatHistoryMessage]:
    """The signed-in shopper's own saved chat (never anyone else's), oldest first."""
    messages = []
    for row in load_saved_history(user.id, HISTORY_FOR_PAGE):
        messages.append(
            ChatHistoryMessage(
                role=row["role"],
                content=row["content"],
                # Rebuild cards from today's catalogue so prices and stock are current.
                products=product_cards(saved_product_ids(row["products_json"])),
                created_at=row["created_at"],
            )
        )
    return messages


@app.delete("/api/chat/history", status_code=204)
def clear_chat_history(user: UserPublic = Depends(require_user)) -> None:
    with get_db() as conn:
        conn.execute("DELETE FROM chat_messages WHERE user_id = ?", (user.id,))


def _check_rate_limit(request: Request, need_ai: bool = True) -> None:
    # Cost guard: at most 30 messages per visitor per 10 minutes.
    times = _chat_times[request.client.host if request.client else "unknown"]
    while times and times[0] < time.time() - CHAT_WINDOW:
        times.popleft()
    if len(times) >= MAX_CHATS_PER_WINDOW:
        raise HTTPException(status_code=429, detail="You're sending messages quickly. Please wait a few minutes.")
    times.append(time.time())
    if need_ai and not agent.api_key():
        print("Chat unavailable: PORTKEY_API_KEY is not set.")
        raise HTTPException(status_code=503, detail=SORRY)


def _chat_inputs(req: ChatRequest, user: UserPublic | None) -> dict:
    """Arguments for agent.stream_chat / run_chat shared by both chat routes."""
    if user:
        # Signed in: memory comes from the database, not from what the browser sends.
        history = [
            ChatTurn(role=row["role"], content=row["content"][:4000])
            for row in load_saved_history(user.id, HISTORY_FOR_AGENT)
        ]
    else:
        history = req.history  # guests: this tab's conversation only, never saved
    return {
        "message": req.message.strip(),
        "history": history,
        "customer": customer_for(user) if user else None,
        "page": req.page,
        "shopper": f"user:{user.id}" if user else "guest",
    }


def _friendly_error(error: Exception) -> ChatResponse | None:
    """Turn an agent failure into a shopper-friendly reply. Logs only the error type/status:
    provider messages can echo the shopper's text. Returns DECLINE replies (worth saving) or SORRY."""
    if isinstance(error, ModelHTTPError):
        if error.status_code == 400 and "content_filter" in str(error.body):
            # The provider's safety filter blocked the message (often a jailbreak attempt).
            print("Chat blocked by provider content filter.")
            return ChatResponse(reply=DECLINE)
        print(f"Chat model error: HTTP {error.status_code}")
    elif isinstance(error, UsageLimitExceeded):
        print("Chat stopped: usage limit reached for one message.")
    else:  # other agent, network, or timeout errors
        print(f"Chat failed: {type(error).__name__}")
    return None


@app.post("/api/chat", response_model=ChatResponse)
async def chat(req: ChatRequest, request: Request, user: UserPublic | None = Depends(current_user)) -> ChatResponse:
    """One chat turn, answered all at once."""
    _check_rate_limit(request)
    inputs = _chat_inputs(req, user)
    try:
        response = await agent.run_chat(**inputs)
    except Exception as error:
        response = _friendly_error(error)
        if response is None:
            return ChatResponse(reply=SORRY, ok=False)
    if user:
        save_chat_turn(user.id, inputs["message"], response)
    return response


@app.post("/api/chat/stream")
async def chat_stream(req: ChatRequest, request: Request, user: UserPublic | None = Depends(current_user)):
    """One chat turn, streamed as newline-delimited JSON (Problem 9: faster-feeling replies).

    Each line is one event: {"type": "status"|"delta"|"reset"|"done"|"error", ...}. The widget shows
    status lines while tools run, types the reply as the model writes it, then swaps in the final,
    validated answer and its product cards on "done".
    """
    _check_rate_limit(request)
    inputs = _chat_inputs(req, user)

    async def events():
        try:
            async for event in agent.stream_chat(**inputs):
                if event["type"] == "done":
                    response: ChatResponse = event["response"]
                    if user:
                        save_chat_turn(user.id, inputs["message"], response)
                    yield json.dumps({"type": "done", "response": response.model_dump()}) + "\n"
                else:
                    yield json.dumps(event) + "\n"
        except Exception as error:
            response = _friendly_error(error)
            if response is not None and user:
                save_chat_turn(user.id, inputs["message"], response)
            final = response or ChatResponse(reply=SORRY, ok=False)
            yield json.dumps({"type": "done", "response": final.model_dump()}) + "\n"

    return StreamingResponse(events(), media_type="application/x-ndjson", headers={"Cache-Control": "no-cache"})


# ---------------------------------------------------------------------------
# Design studio (Problem 12 feature): pitch the next product, picks that fit, learned likes
# ---------------------------------------------------------------------------

SHOWN_PICKS = 4  # tiles on screen; the rest wait for "Show another" / "Not for me"


def load_feedback(user_id: int) -> tuple[set[str], set[str]]:
    with get_db() as conn:
        rows = conn.execute("SELECT product_id, verdict FROM product_feedback WHERE user_id = ?", (user_id,)).fetchall()
    return {r["product_id"] for r in rows if r["verdict"] == "like"}, {r["product_id"] for r in rows if r["verdict"] == "dislike"}


def load_style_answers(user_id: int) -> StudioAnswers | None:
    with get_db() as conn:
        row = conn.execute("SELECT answers_json FROM style_profiles WHERE user_id = ?", (user_id,)).fetchone()
    try:
        return StudioAnswers.model_validate_json(row["answers_json"]) if row else None
    except ValueError:
        return None


def product_names(product_ids: set[str], limit: int = 6) -> list[str]:
    return [card.name for card in product_cards(sorted(product_ids))][:limit]


def style_notes(user_id: int) -> str | None:
    """One line for the chat agent: the shopper's saved studio choices and likes. Only fixed choices and
    catalogue names go in (never their free text), so nothing they typed lands in the instructions."""
    answers = load_style_answers(user_id)
    liked, disliked = load_feedback(user_id)
    parts = []
    if answers:
        parts.append(f"{answers.vibe} vibe, {answers.fit} fit, dressing for {answers.occasion}")
        if answers.garment != "surprise me":
            parts.append(f"likes {answers.garment}s")
        if answers.colors:
            parts.append("colors: " + ", ".join(answers.colors))
        parts.append(f"logo: {answers.logo} on the {answers.placement}")
    if liked:
        parts.append("liked: " + "; ".join(product_names(liked, 5)))
    if disliked:
        parts.append("not for them: " + "; ".join(product_names(disliked, 5)))
    return ". ".join(parts)[:600] or None


@app.get("/api/studio/profile")
def studio_profile(user: UserPublic = Depends(require_user)) -> dict:
    """The signed-in shopper's saved answers and likes, so the studio opens where they left off."""
    liked, disliked = load_feedback(user.id)
    answers = load_style_answers(user.id)
    return {
        "answers": answers.model_dump() if answers else None,
        "liked": sorted(liked),
        "disliked": sorted(disliked),
    }


@app.post("/api/studio/feedback", status_code=204)
def studio_feedback(req: StudioFeedback, user: UserPublic = Depends(require_user)) -> None:
    """Like / Not for me on a pick (signed in). Guests keep theirs in the browser."""
    if req.product_id not in known_product_ids():
        raise HTTPException(status_code=404, detail="Unknown product.")
    with get_db() as conn:
        if req.verdict == "clear":
            conn.execute("DELETE FROM product_feedback WHERE user_id = ? AND product_id = ?", (user.id, req.product_id))
        else:
            conn.execute(
                "INSERT INTO product_feedback (user_id, product_id, verdict) VALUES (?, ?, ?) "
                "ON CONFLICT (user_id, product_id) DO UPDATE SET verdict = excluded.verdict, created_at = CURRENT_TIMESTAMP",
                (user.id, req.product_id, req.verdict),
            )


@app.post("/api/studio/generate", response_model=StudioResponse)
async def studio_generate(
    req: StudioRequest, request: Request, user: UserPublic | None = Depends(current_user)
) -> StudioResponse:
    """Dan pitches an original product from the answers and picks real items that fit the vibe.
    Works without the AI too (a rule-based pitch), so the studio never shows an error page."""
    _check_rate_limit(request, need_ai=False)  # same per-visitor budget as the chat
    known = known_product_ids()
    if user:
        liked, disliked = load_feedback(user.id)
    else:
        liked, disliked = set(req.liked) & known, set(req.disliked) & known
    result = await agent.run_studio(
        req.answers, liked, disliked - liked, product_names(liked), product_names(disliked),
        customer=customer_for(user) if user else None, shopper=f"user:{user.id}" if user else "guest",
    )
    cards = {card.product_id: card for card in product_cards([p.product_id for p in result.picks])}
    tiles = [StudioPickCard(product=cards[p.product_id], why=p.why) for p in result.picks if p.product_id in cards]
    with get_db() as conn:
        pitch_id = conn.execute(
            "INSERT INTO product_pitches (user_id, answers_json, concept_json) VALUES (?, ?, ?)",
            (user.id if user else None, req.answers.model_dump_json(), result.concept.model_dump_json()),
        ).lastrowid
        if user:
            conn.execute(
                "INSERT INTO style_profiles (user_id, answers_json) VALUES (?, ?) ON CONFLICT (user_id) "
                "DO UPDATE SET answers_json = excluded.answers_json, updated_at = CURRENT_TIMESTAMP",
                (user.id, req.answers.model_dump_json()),
            )
    return StudioResponse(
        pitch_id=pitch_id,
        concept=result.concept,
        picks=tiles[:SHOWN_PICKS],
        reserve=tiles[SHOWN_PICKS:],
        styling_note=result.styling_note,
        saved_to_account=user is not None,
    )

