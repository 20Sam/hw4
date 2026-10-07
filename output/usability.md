# Usability improvements (Problem 9)

Six improvements to the Campus Customs shop: two on the front end (how the site looks and
feels) and four in the agent / backend (better, more accurate, safer, faster, or cheaper answers).
The assignment asks for 2 + 2; we built two extra backend ones.
Each one is live in the running app; "Where to see it" says how to find it.

---

## Front-end improvement 1: Studio-quality product photos (clean white background, centered)

**What we added**

The 102 catalogue photos were inconsistent: 73 sat on a solid black background or had black bars,
several had black gaps between the sleeves and the body, some were tall or off-center and spilled
out of their card, and a few had faint border lines from the original photo. The backend now
cleans every photo before the site shows it (`backend/images.py`, served by `main.py` at
`/images/<file>`):

1. **AI cut-out.** An open-source background-removal model (ISNet `isnet-general-use`, the model
   behind the `rembg` tool) runs **locally** with onnxruntime to find the garment. No photos are
   sent to an outside service. The model file (~179 MB) is downloaded once into `data/.models/`
   and checked against its published checksum.
2. **Black → white, including the gaps under the sleeves.** On black-background photos, the
   border black and any large enclosed black patch (the armpit gaps) become white. The AI only
   decides the uncertain edge pixels, so dark navy fabric is never faded or erased.
3. **Crisp, smooth edges.** The outline is smoothed (no stair-steps or dark specks) and
   anti-aliased; faint near-white border lines from the original photos are wiped.
4. **Centered with an even margin.** Each garment is cropped to its outline and centered on an
   800×800 white canvas with the same 7% margin. The one on-model photo (The Forest School
   Hoodie, where the original photographer cropped the model at the chin) keeps its natural
   framing, flush with the top edge like a fashion shot, instead of a floating, headless figure.
5. **Cards can't overflow.** In `index.css` the photo sits in a fixed square frame
   (`overflow: hidden`, `object-fit: contain`), so no image can ever cover the product text.

The original files in `data/products/` are **never edited**. Cleaned copies are cached in
`data/.image_cache/` (git-ignored) and built in the background when the server first starts
(a few minutes for all 102; until then the quick non-AI clean-up is shown). If the model can't be
downloaded, the site automatically uses the simpler Pillow-only clean-up instead. Image URLs carry
a version (`?v=v8`, `IMAGE_VERSION` in `backend/tools.py`) so browsers always load the newest photos.

**Quality check (4 rounds):** six AI reviewers compared every cleaned photo with its original on
labeled before/after sheets; after each round the causes were fixed, all 102 photos were rebuilt,
and they were reviewed again.

| Round | Issues found | What we changed |
|---|---|---|
| 1 | 43 (24 black sleeve gaps, 10 faint border lines, 5 framing, 4 edges) | Enclosed black patches become background; near-white → white; even margins for every product photo |
| 2 | ~30, mostly smaller | A dark hood lining was being erased → gaps must be at the sides and below the shoulders; slivers followed into their tips |
| 3 | Print artwork erased on 5 products (bulldog faces, Morse crest) | The speck clean-up now never touches anything inside the garment's outline |
| 4 | Only minor cosmetic notes (a few specks in very thin sleeve slits, slightly wavy gap edges or hems on ~15 photos); no artwork, color, or cropping problems | Accepted for now |

**Why it helps**

- **Shoppers:** every product looks like it was shot in the same studio, so the grid is calm and
  easy to compare, and nothing (black boxes, cut-off sleeves, overflowing photos) distracts from
  the garment.
- **The business:** a polished, consistent catalogue looks premium and trustworthy, the way major
  retailers present products, which makes people more confident to buy.

**Where to see it:** any product grid (Home, Products, chat results), product pages, and chat
cards. Compare with an original by adding `?raw=1`, e.g.
`http://localhost:5173/images/yale-mom-crewneck.jpg?raw=1`.

---

## Front-end improvement 2: Editorial look with Yale campus photography

**What we added**

- **Full-bleed photo hero** on Home: Yale's Gothic rooftops at dusk behind a large serif headline
  ("Wear your Yale, *every season* of the year."), with a slow, subtle zoom and a photo caption.
  The About page opens with the same photography.
- **Editorial typography:** Cormorant Garamond (display serif) with Inter (body), small-caps
  kickers, italic accents, and section numerals (I., II., III.).
- **Magazine-style sections:** an opening statement band, "The Edit" (a numbered, hoverable index
  of categories instead of plain tiles), the favorites grid, and a photo + story panel about the
  shop on Broadway.
- **"Yale at dusk" color theme across the whole site**, taken from the photo: dusk indigo and
  lavender (primary colors, nav, chat header), sunset gold and lamplight (buttons, the gold
  underline on the current page, accents), sandstone and limestone (backgrounds, cards, filter
  chips), and copper-green / brick for in-stock and sold-out labels. It keeps the workspace's
  blue-and-sand idea, warmed up to match Yale's stone at sunset.
- **The photo runs through the site**: the Products page opens with a skyline banner before the
  catalogue, Log in and Create account sit beside a photo panel ("Welcome back to the Bulldog
  family."), the footer shows the skyline after dark, and the chat header fades from indigo to
  sunset gold like the sky.
- Text sits on a gradient over the photo so it stays readable, and the layout collapses cleanly on
  phones (motion is turned off for visitors who prefer less motion).

**Why it helps**

- **Shoppers:** the first screen immediately says *Yale*, the place they love, before it says
  *store*. Clear numbered categories make it quick to jump to hoodies, crewnecks, or tees.
- **The business:** Campus Customs sells pride and belonging, not just sweatshirts. Editorial
  campus imagery tells that story, makes the brand feel premium, and gives visitors a reason to
  stay and browse.

**Where to see it:** every page: Home (hero, statement, The Edit, story), Products (photo banner),
About Us, Log in / Create account (photo panel), the footer, and the chat.

---

## Agent / backend improvement 1: Faster replies (streaming + fewer round trips)

**What we added**

- **Streaming chat** (`POST /api/chat/stream`, `agent.stream_chat`): the reply is sent as
  newline-delimited JSON events while the agent works. The chat bubble shows a live status line
  for each tool ("Searching the catalogue for “hoodies”…", "Checking stock in size M…",
  "Working out your size…"), then types the answer as the model writes it (the `reply` text is
  read from the half-finished structured output). If the safety check sends an answer back, the
  bubble resets and shows "Double-checking…"; the final validated answer and its product cards
  always replace the streamed text.
- **Fewer model round trips:**
  - `search_products` now returns `in_stock_sizes` for every product and takes a `size` filter, so
    "navy crewnecks under $60 in L?" is **one** search instead of one stock check per product.
    (Before, that question made 13 tool calls, hit the safety limit, and the shopper got
    "Sorry, I'm having trouble…".)
  - On a product page, the backend reads that product's live details and puts them straight into
    the agent's context, so "how many XL are left of this one?" can be answered with no tool call.
- **Portkey's response cache** (already on through our gateway) answers repeated identical
  questions in under half a second; it stays accurate because a cached step is only reused when
  the tool results it saw are identical.

**Measured** (same questions, `gpt-5.6-luna`, cache bypassed so timings are real):

| | Before (Problem 8) | After |
|---|---|---|
| Time until the shopper sees anything | ~5.0 s of silence (whole answer at once) | **~2 s** (live status), reply text from ~4 s |
| "Navy crewneck under $60 in size L?" | **failed** (13 tool calls → error) | 1 tool call, 5.2 s, 12 matching cards |
| "How many XL are left of this one?" (on its product page) | ~4 s, 2 model requests | **2.6 s, 1 model request**, no tool call |
| Total time for a typical answer | ~5 s | ~5 s (the model itself takes the same time) |

**Why it helps**

- **Shoppers:** instead of staring at a silent chat for five seconds, they see what the assistant is
  doing within about two seconds and can start reading as the answer arrives, which feels quick
  and trustworthy. Size-filtered questions that used to fail now work.
- **The business:** fewer model round trips and cached repeats mean lower API cost per chat, and
  shoppers are less likely to give up while waiting.

**Where to see it:** open the chat on any page and ask something; watch the status line and the
reply appear. Every turn's timings are in `output/audit_trail.json`
(`seconds_to_first_status`, `seconds_to_first_text`, `seconds_total`).

---

## Agent / backend improvement 2: Size recommendation tool

**What we added**

A new agent tool, `recommend_size(product_id, height_inches, weight_lbs, chest_inches, fit)`
(`backend/tools.py`, result type `SizeRecommendation` in `models.py`):

- Maps height and weight (or, more accurately, a chest measurement) to XS–XXL using a general
  unisex adult size chart, and sizes up or down for "relaxed" or "snug" fit preferences.
- **Checks live stock** for that size in that product. If it's sold out, it lists the nearby sizes
  (one up/down) that are in stock and adds similar products that have the recommended size.
- If the shopper hasn't given any measurements, it returns `need_more_info` and the agent asks for
  height and weight instead of guessing; unrealistic values are ignored.
- The agent always says it's a **general size guide** (the tool returns a `fit_note`), because the
  data pack has no maker's size chart.

Example (live): *"I'm 5'10 and 170 lb, what size should I get in this?"* on the Yale Dad Crewneck
page → "our general unisex size guide recommends M… M is sold out; S is the nearby in-stock size…
similar crewnecks in M: Yale Mom Crewneck, …" with those products as cards.

**Why it helps**

- **Shoppers:** sizing is one of the biggest worries when buying clothes online. A quick, honest suggestion that
  is *actually in stock* saves guesswork.
- **The business:** fewer wrong-size purchases means fewer returns and exchanges, and a sold-out
  size turns into a suggestion instead of a lost sale.

**Where to see it:** ask the chat "I'm 5'10\" and 170 lb, what size should I get?" on any product
page, or "What size should I get in the Basic Hoodie Big Yale?" (it will ask for your height and
weight).

---

## Agent / backend improvement 3: Similar items when a size is sold out

**What we added**

- `check_stock` now **automatically** returns `similar_in_stock` when the requested size is sold
  out: up to 3 products of the same kind (the catalogue's 22 garment-type spellings are grouped
  into hoodie / crewneck / T-shirt / quarter-zip / jacket / long-sleeve), ranked by shared tags
  (sport, college, family), shared colors, and closest price, and **only ones that have that size
  in stock**. No extra tool call is needed.
- A new tool, `find_similar_in_stock(product_id, size)`, for "anything like this in M?".
- The prompt tells the agent to always offer these when it says "sold out", and to show them as
  product cards on the page.

Example (live): *"Do you have the Yale Dad Crewneck in medium?"* → "sold out in medium… available
in XS, S, and XXL. For medium, similar options include the Yale Mom Crewneck, Yale Sports Field
Hockey Crewneck, and Yale Sports Volleyball Crewneck" (all three checked to have M in stock).

**Why it helps**

- **Shoppers:** "sold out" stops being a dead end; they immediately see close alternatives in
  their size.
- **The business:** it saves sales that would otherwise be lost and moves stock that is
  available.

**Where to see it:** ask about a sold-out size, e.g. "Yale Dad Crewneck in medium?" or
"Baseball Left Chest Crewneck in XL?".

---

## Agent / backend improvement 4: Audit trail for every chat turn

**What we added**

Every chat turn (both chat routes, including failures) is appended to `output/audit_trail.json`
(`agent.write_audit`, types `AuditRecord` / `AuditStep` / `AuditToolCall` in `models.py`):

- **What happened:** each model step's tool calls with their arguments and a short result summary
  (product IDs, stock status, recommended size), any **validator retries** (with the reason, e.g.
  a price the tools didn't return), the final reply, and the product cards shown.
- **Cost and speed:** model requests, input and output tokens, time to first status, time to first
  text, and total seconds.
- **Context:** timestamp, page path, the shopper's message, and the model. Status is `ok`,
  `blocked` (the provider's safety filter) or `error:<type>`.
- **Privacy:** the shopper is recorded only as `guest` or `user:<id>`. Before anything is written,
  the signed-in shopper's first and last name and any email address are replaced with
  `[first name]`, `[last name]`, `[email]` (in the message, the reply, and tool arguments);
  passwords never reach the agent at all. The file keeps the newest 500 turns and is written under
  a file lock with a unique temp file, so concurrent chats can't corrupt it (a damaged file is moved
  aside, never wiped).
- Failed turns (provider block, usage limit) are recorded too, with the steps and tokens they used.

**Why it helps**

- **Shoppers:** indirectly, a store that checks its assistant's answers gives more accurate ones.
  When something goes wrong, there's a record to find and fix it.
- **The business:** it's how to check accuracy (every price and stock answer can be traced to the
  tool result it came from), spot slow or expensive questions (tokens and seconds per turn), and
  investigate complaints. It already caught a real bug during development: a crash in
  `get_product_details` showed up as an `error:TypeError` record and was fixed.

**Where to see it:** `output/audit_trail.json` grows with every chat message.

---

## How the backend improvements were checked

- **Live benchmarks** (cache bypassed) before and after, recorded above, plus every turn in
  `output/audit_trail.json`.
- **Adversarial code review:** three AI reviewers searched the new streaming, audit, tool, and chat
  widget code for bugs, and a separate skeptic per area tried to disprove each one. 23 of 24
  reports were confirmed and **all 23 were fixed**, including: the size filter ignoring the size
  for type searches ("hoodies under $70 in M"); sizes like "X Large" or "Size: M." not being
  understood; short, heavy shoppers being sized too small; cm/kg entered as inches/pounds; the audit
  logging names and emails; parallel tool calls getting each other's results in the audit; a
  rejected answer staying on screen while the agent re-checked; and "New chat" during a streaming
  reply bringing a deleted chat back.
- **Offline tests** with a scripted fake model (no API cost) reproduce each audit/streaming bug and
  confirm the fix; live smoke tests confirm "Yale Dad T-Shirt in X Large?" → sold out in XL, with
  three similar $32 tees that have XL (all checked against the database), and "178 cm and 80 kg" →
  size L, 8 left.
