# Campus Customs Shop + Chatbot (Homework 4)

A Yale apparel shop for Campus Customs (Yale Bulldog Blue, 57 Broadway, New Haven) with **Dan**,
a bulldog shop assistant that answers from the live catalogue: products, prices, stock by size,
size advice, and a design studio that pitches new pieces and learns your style.

- **Front end:** React 19 + Vite + TypeScript (`frontend/`)
- **Back end:** FastAPI + PydanticAI (`backend/`), model `gpt-5.6-luna` through Portkey
- **Data:** the course data pack in `data/` (SQLite + product photos, not in git)

How it all works (models, tools, safety rules, limits): [`output/harness.md`](output/harness.md).

## What you need

- Python 3.11 or newer (check with `python3 --version`; the macOS built-in 3.9 is too old)
- Node.js 20.19 or later on the 20.x line, or 22.12 or later, and npm (Vite 8's requirement)
- A Portkey API key (for the chat and the design studio; the shop itself works without one)
- The course data pack: `campus_customs.db` and the `products/` photo folder

## 1. Place the data pack

The database and product photos are **not** in this repo. Put them here:

```
hw4/
└── data/
    ├── campus_customs.db
    └── products/          # images referenced by the catalogue
```

## 2. Add your settings

```bash
cp .env.example .env               # Windows (cmd): copy .env.example .env
```

Open `.env` and set:

| Setting | What to put |
|---|---|
| `PORTKEY_API_KEY` | Your Portkey key |
| `SESSION_SECRET` | Any long random string: `python3 -c "import secrets; print(secrets.token_urlsafe(48))"` |
| `CAMPUS_MODEL` (optional) | Another model name; the default is `gpt-5.6-luna` |
| `CAMPUS_IMAGE_AI=0` (optional) | Skip the photo-model download and use the simple photo clean-up |

## 3. Run the back end (terminal 1)

From the `hw4` folder:

```bash
python3 -m venv .venv              # Windows: py -3.12 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cd backend
uvicorn main:app --reload --port 8000
```

The API is now on `http://localhost:8000` (try `http://localhost:8000/api/health`).

On the first start the back end:
- creates its extra tables in the database (design-studio profiles, likes, and pitches);
- downloads the photo clean-up model (`isnet-general-use.onnx`, about 179 MB) into `data/.models/`
  and cleans the 102 product photos in the background (cached in `data/.image_cache/`). This takes
  a few minutes the first time; the site works meanwhile. If the download isn't possible (or you
  set `CAMPUS_IMAGE_AI=0`), a simpler clean-up is used.

## 4. Run the front end (terminal 2)

From the `hw4` folder:

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** (or the Local URL Vite prints, if 5173 was busy). The dev server
forwards `/api` and `/images` to the back end on port 8000, so keep both running.

**Test account** (from the data pack): `test@campuscustoms.yale.edu`, password `password`. You can
also create your own account.

## Try it

- **Chat with Dan** (button at the bottom right): "Do you have navy hoodies under $70?",
  "Is the Yale Dad Crewneck in medium?", "I'm 5'10" and 170 lb, what size should I get?"
- **Search from the chat:** "What hoodies do you have?" puts the matching cards on the page.
- **Product pages:** live stock per size, "Ask Dan about this one", Complete the look.
- **Design studio:** scroll to the bottom of any page, past the leaf pile, and pitch the next piece.
- Signed-in chats and studio likes are saved to your account.

## Checks

In a new terminal, from the `hw4` folder:

```bash
source .venv/bin/activate                       # Windows: .venv\Scripts\activate
cd backend
python agent.py --check                         # offline wiring check, no API call
python agent.py "Do you have navy hoodies?"     # one live message
cd ../frontend
npm run build                                   # type-check and production build
```

## What's in the repo

```
hw4/
├── AI_prompts.md            # prompts used for each problem
├── requirements.txt
├── .env.example             # placeholders only
├── .gitignore
├── README.md
├── frontend/                # Vite React TypeScript app
├── backend/
│   ├── main.py              # FastAPI app: run with uvicorn main:app --reload --port 8000
│   ├── agent.py             # the agents (chat + design studio), streaming, audit trail
│   ├── models.py            # Pydantic models
│   ├── tools.py             # the agent's tools and catalogue queries
│   ├── images.py            # product photo clean-up
│   └── prompts/
│       └── prompt.md        # Dan's system prompt and safety rules
└── output/
    ├── harness.md           # how the system works
    ├── design.md
    ├── usability.md
    ├── app_check.html       # open in a browser
    ├── app_check_images/    # screenshots linked from app_check.html
    └── audit_trail.json     # append-only log of every agent run
```

Not in git: `.env`, the `data/` folder (database, product photos, the downloaded model, the photo
cache), `.venv/`, and `node_modules/`.

## Troubleshooting

- **"Address already in use" on port 8000:** another copy of the back end is running; stop it or
  use that one. If port 5173 is busy, Vite picks the next free port (5174, ...); open the URL it
  prints.
- **`pip install` says "No matching distribution":** your `python3` is older than 3.11. Make the
  venv with a newer one, e.g. `python3.12 -m venv .venv`.
- **Photos look plain (no AI cut-out) and the log says the photo model is unavailable:** on
  python.org's macOS Python, run "Install Certificates.command" from your Python folder, delete
  `data/.image_cache/`, and restart the back end.
- **Dan says he's having trouble reaching the shop:** check `PORTKEY_API_KEY` in `.env` and restart
  the back end.
- **"Database not found":** the data pack must be at `data/campus_customs.db`, inside this folder.
