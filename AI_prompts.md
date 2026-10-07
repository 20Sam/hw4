# AI Prompts Log: Homework 4 (Campus Customs Shop + Chatbot)

This file logs what I typed to my AI coding assistant (Claude Code) for each problem.
Each section lists the problem number and title, my first prompt (in my own words), any
follow-up prompt, and one sentence on what the first attempt was missing.
The running site, the database writes, and the screenshots in `output/` are the evidence of the work.

---

## Problem 1: Vibe coder prompts

**Prompt 1 (my words):**
> The Campus Customs shop needs a real customer website with a helpful chatbot. We'll build a
> React + Vite + TypeScript front end and a Python FastAPI back end whose brain is a Pydantic AI
> agent. Shoppers can create an account, chat about the merch, see matching items appear on the
> page, and get honest answers about price and stock from the local database. Research
> yalebulldogblue.com for the style and for info for the agent prompt. Use our Portkey API key
> with OpenAI models. Work one problem at a time, and never commit the database or product images.
> First, create an `AI_prompts.md` at the start of the assignment to log what I type to you. Describe
> each problem in our own words, with one section per problem: the problem number and title, at least
> one prompt I typed in my own words, a follow-up prompt if needed, and one sentence on what was
> lacking after the first.

**Follow-up prompt:**
> For problem one, "Vibe coder prompts," we've already done it. Here's an image of the problem
> for you to verify that we've done just that.

**What was lacking after the first prompt:** The first version of this log had a generic
"Setup" heading instead of the problem number and title, so I sent the Problem 1 panels to
check it against the rubric and fix the heading.

---

## Problem 2: Analyze the database

**Prompt 1 (my words):**
> Problem two is "analyze the database." Look at `data/campus_customs.db` and understand the
> fields of each table, at a minimum catalog, inventory, and users. Then start the file
> `output/harness.md`: write down each table and its fields, with one short line on why each
> field matters to the shop or the chatbot. We'll keep growing this harness file in later
> problems with models, tools, safety, and specs.

**What was lacking after the first prompt:** The prompt assumed a table called `catalog` and
only three tables, but the real database uses `catalogue` and has a fourth `chat_messages`
table, so the harness had to document both plus data quirks (JSON-text colors/tags,
inconsistent garment types, sold-out sizes).

---

## Problem 3: Build the Campus Customs website

**Prompt 1 (my words):**
> Problem three is "build the Campus Customs website." Scaffold a React + Vite + TypeScript front
> end for Campus Customs with a nav bar at the top linking to the main pages: Home, Products, About
> Us, Log in, and Create account. Pull the Campus Customs style wording from yalebulldogblue.com for
> Home and About Us, but write these pages in your own voice; do not copy the original site text.
> Show me what the original site text looks like and what you are saying instead. On the Products
> page, show product images from the catalogue using the image paths in the database, with basic
> info (name, price, short description). Make each product open a single-item page: large image on
> one side, full product text on the other (description, price, sizes and stock). Clicking a card
> should take the shopper there. Add a chat interface in the bottom right (a floating panel is
> fine). It doesn't need to talk to an agent yet; a stub that calls the backend is enough. Start a
> simple FastAPI app in `backend/main.py` just to serve products and images, and we'll grow it into
> the agent backend in Problem 5.

**Follow-up prompt:**
> This is just so you know. Make sure that you don't miss any of the technical details.
> (Sent with screenshots of Problem 3 Panels A and B.)

**Follow-up prompt 2:**
> Okay, is there anything that I'm missing here? Anything that the prompt from above is missing?

**Follow-up prompt 3:**
> Let's save the Yale Bulldog Blue research: add a "Store facts" section to `output/harness.md`
> (address, officially licensed, custom items can't be returned, shipping to 30+ countries, product
> categories) so it's ready for `prompt.md`. Then let's move on to question 4.

**What was lacking after the first prompt:** My spoken prompt was a bit jumbled, so I sent the
two assignment panels to make sure no technical requirement (exact nav labels, the
sizes/stock detail page, the chat stub calling the backend) was missed, and the site research
was only in the chat until I asked to save it in the harness.

---

## Problem 4: Create account and login

**Prompt 1 (my words):**
> Problem four is "create account and login." Build a normal create-account / login flow. Create
> account collects first name, last name, email, password, and confirm password (a nice touch, so
> let's do it). Login is email and password. New accounts go into the `users` table. Make sure to
> store passwords securely so hackers, human or AI, cannot access them. The seed database already
> has a test user (test@campuscustoms.yale.edu); confirm you can log in as that user and that a
> brand-new account you create also works. Update `output/harness.md` with how auth works: what
> you store for a user and how passwords are protected.

**Follow-up prompt:**
> (Sent screenshots of Problem 4 Panels A and B while the work was in progress.)

**Follow-up prompt 2:**
> Is there anything I'm missing for problem four?

**What was lacking after the first prompt:** It didn't say how the seed passwords were hashed
(the hash string has no iteration count) or how a login should be remembered, so the AI had to
work out the 120,000-round seed format and add signed HttpOnly session cookies.

---

## Problem 5: PydanticAI agent backend

**Prompt 1 (my words):**
> Problem five is "PydanticAI agent backend." Build the shop chatbot as a PydanticAI agent behind
> FastAPI, plugged into the front-end chat widget. Put the API app in `backend/main.py`, the file
> you run with Uvicorn, and keep the agent as four files next to it, same idea as Homework 3 (take a
> quick peek at my Homework 3 submission if you need to, but don't change anything):
> `backend/prompts/prompt.md` (system prompt, we'll grow this same file later), `backend/agent.py`
> (agent entry and wiring), `backend/tools.py` (tools the agent can call), and `backend/models.py`
> (Pydantic / PydanticAI structured types). In `main.py`, expose a chat route so a message from the
> website returns a reply from the agent, plus whatever else you need for products and auth. Use
> the AI model API key. Put the Campus Customs voice and safety basics into `prompts/prompt.md`;
> we'll expand tools and safety later. Start or update types in `models.py` for chat replies and
> product cards. In `output/harness.md`, note how the front end talks to FastAPI and how the agent
> is loaded (prompt file + model). Make sure the backend runs from the `backend/` folder with
> `uvicorn main:app --reload --port 8000`.

**Follow-up prompt:**
> (Sent screenshots of Problem 5 Panels A and B while the work was in progress.)

**Follow-up prompt 2:**
> Is there anything I'm missing for problem five?

**What was lacking after the first prompt:** I said the API goes in "front end slash main.py" by
mistake (the panels confirm `backend/main.py`), and the prompt didn't say what should happen when
the AI provider's content filter blocks a message, which the first safety test exposed.

---

## Problem 6: Tools: product info and stock

**Prompt 1 (my words):**
> Problem six is "tools: product info and stock." Give the agent tools to look up real information
> from `campus_customs.db`: the product description, the price, and how many are in stock by size
> when the customer asks. The agent must use the database and must not invent prices or
> quantities. This is very important. If a size is out of stock, say so clearly. Expand
> `prompts/prompt.md` so the agent knows to call these tools for price and stock questions, and
> add or update return types in `models.py`. In `output/harness.md`, list each tool and explain which
> model fields you chose for the lookup results and why.

**Follow-up prompt:**
> (Sent screenshots of Problem 6 Panels A and B while the work was in progress.)

**What was lacking after the first prompt:** "Don't invent prices or quantities" was only a rule
for the model to follow, so the AI added a code check that rejects any price or stock number the
tools didn't return, and a `check_stock` tool with an explicit sold-out status.

---

## Problem 7: Chat search that updates the page

**Prompt 1 (my words):**
> Problem seven is "chat search that updates the page." Add a neat feature: when a customer asks
> about a type of item, for example "what hoodies do you have?", the agent should search the
> catalogue and the website should dynamically show those matching items as product cards (image,
> name, price, short info). This is an API contract: the agent returns structured product matches
> and the front end renders them on the website. After the dynamic cards load, make sure the
> single-item page from Problem 3 still works: every product card, including the ones the chat
> just put on the page, should open that detail view (large image plus full info) when clicked.
> Update `prompts/prompt.md` and `output/harness.md` so it's clear how search results reach the page.

**Follow-up prompt:**
> (Sent screenshots of Problem 7 Panels A and B.)

**What was lacking after the first prompt:** It didn't say where on the site the cards should
appear or how long they should stay, so the AI chose a "From your chat" section at the top of the
current page that persists while browsing until the shopper clears it.

---

## Problem 8: Customer memory

**Prompt 1 (my words):**
> Problem eight is "customer memory." When shoppers are logged in, save their chat history in the
> database in an appropriate table and reload it when they return. The agent should know who is
> chatting (name and email): put that in agent deps or an equivalent clear pattern, and/or tools
> the agent can call. Also pass enough page context that if someone is on a product page and asks
> "do you have this in pink?", the agent knows which item they mean. Hint: you can put code into the
> agent context, so let's act on this hint. Guests can still chat, but history only needs to persist
> for logged-in users. Document in `output/harness.md` how user chat history is stored, what
> customer fields the agent sees, and how page context is passed.

**Follow-up prompt:**
> (Sent screenshots of Problem 8 Panels A and B.)

**What was lacking after the first prompt:** It didn't say whether the browser's copy of the chat
should be trusted, so the AI made signed-in history come only from the database and checks page
context against the catalogue before it reaches the agent.

---

## Problem 9: Usability improvements

**Prompt 1 (my words):**
> Problem 9 is usability improvements: choose and implement 2 front-end and 2 agent/backend
> improvements, write `output/usability.md` (what we added and why it helps a shopper or the
> business), and make sure every improvement shows up in the running app. Straight off the bat,
> some product images aren't centered and look like they're falling off the page, which makes the
> site less enjoyable and less professional; fixing this will make the store look more put
> together and more attractive to buyers. I also don't like that some products have a black
> background with a white outline. Cut off all the black and leave them on a white canvas for
> better uniformity, so it looks less sloppy and more professional. Let's start here.

**Follow-up prompt:**
> (Sent ~20 screenshots of product cards.) The trimming around the items is still not great. Aren't
> there tools you can call on to do better photo editing than this? Make sure gaps between the
> sleeves and the body are cut out, and that each item looks crisp, sleek, and smooth. We're going
> for looks here. Also, you cut off the head of a human model. That looks off, so bring back the
> images where models show the product and don't cut off their heads.

**Follow-up prompt 2:**
> I'd also like to improve the feel of the website: a more editorial feel. Since this is Yale, put
> some beautiful pictures there. Here's one (a photo of Yale's rooftops at dusk); start the page
> with something like this and really feed off that vibe.

**Follow-up prompt 3:**
> (Shared the table of four agent/backend options: faster replies, size recommendation tool,
> similar items when sold out, audit log.) Let's do all four.

**Follow-up prompt 4:**
> OK, but you never applied this theme (the Yale-at-dusk photo) to the website. (Then:) I would still
> like the stock photo to show up on top of the webpage before you start shopping. Take inspiration
> from Aritzia. (Then:) Nope, I don't like the Aritzia styling, please go back to what we had before.

**Follow-up prompt 5:**
> Is there anything I'm missing for problem nine?

**What was lacking after the first prompt:** It didn't say whether to edit the image files or which
tools to use, so the first Pillow-only clean-up left black gaps under the sleeves and jagged edges.
After my follow-up, the AI used a local AI background-removal model (I approved the download), had
six AI reviewers check all 102 photos, and fixed what they found. (The model photo's head was
already cropped in the original, so it now keeps its natural framing instead.)

---

## Problem 10: Style the website

**Prompt 1 (my words):**
> Problem 10 is "style the website." Add creative design so the site feels like a real Campus
> Customs storefront: fonts, color, hierarchy, motion, product presentation, and chat feel. More
> points for imaginative and innovative design. Then write `output/design.md`: what you changed and
> why it should help customers stick around and buy. Keep it concrete and short.

**Follow-up prompt:**
> I'd like the website to feel a little more dynamic: string lights along the sides that flicker on
> and off, and leaves falling softly on the sides so customers scroll down to see where the leaves
> land. Make some leaves land on the product tiles, brushed away if you hover or touch them, but
> not so many that they hide the products. The leaves should hover around things you think the
> customer might like based on what they're viewing and how long they spend on one item. When you
> click into an item, recommend other items they might like: other sweaters, other colors, and a
> styling suggestion, like pairing a shirt, sweater, or whatever else.

**What was lacking after the first prompt:** It didn't say whether to restyle from scratch, so the AI
kept the "Yale at dusk" look I'd chosen in Problem 9 (after I rejected an Aritzia-style redesign) and
added new layers on top: a time-of-day sky, a CSS bulldog chat assistant, a print magnifier, and a
residential-college shelf.

---

## Problem 11: Site testing (app check)

**Prompt 1 (my words):**
> Problem 11 is "site testing (app check)." Test the live site and document it in
> `output/app_check.html`, a page you can double-click open. Include clear screenshots and short
> captions for: (1) the chat checking the inventory level of an item (honest stock and price from
> the DB), (2) the dynamic search-result cards appearing after a category question like hoodies,
> and (3) one of the usability features from Problem 9. Make the HTML easy to grade: a heading for
> each check, the screenshot, and one or two sentences on what it proves. Put the images in
> `output/app_check_images/` and link them with relative paths.

**Follow-up prompt:**
> (Sent screenshots of Problem 11 Panels A and B, since voice-to-text might have garbled the
> technical terms.)

**What was lacking after the first prompt:** It didn't say how to prove the chat was honest, so the
AI added the matching database rows and the audit-trail tool calls next to each screenshot, and
used a headless Chrome so the screenshots are full-size and sharp.

---

## Problem 12: Audit trail, safety, finish the harness

**Prompt 1 (my words):**
> Problem 12 is "audit trail, safety, finish harness." Keep an append-only
> `output/audit_trail.json` of agent-loop activity (time, tool name, short args/result, stop
> reason), and do not wipe it between runs. Think of some safety rules to give the agent and put
> them in `prompts/prompt.md`. Then finish `output/harness.md` so it is clear how the system works:
> the model fields in `models.py` and why you chose them, the tools and abilities, the safety rules,
> and the specs (loop limits, result caps, models, how to run the front end and back end).
>
> Also add a feature to pitch the next product. At the bottom of the pages, underneath the "You
> found the leaf pile" box with Dan's picks (and on a product page, in case the suggestions there
> don't fit), add a design tool with a questionnaire: your vibe, typical fit, the occasion, colors,
> materials, which Yale logos and where, "inspired by…", and a free description. Dan generates a
> concept outfit or product, and his recommendations should fit the vibe you describe, each with a
> short note on why it fits. Show them as tiles you can like, dislike, or swap for another
> suggestion, and make Dan learn your preferences and save them to your account.

**Follow-up prompt:**
> (Sent screenshots of the Problem 12 panels, since voice-to-text might have garbled the technical
> terms.)

**What was lacking after the first prompt:** It didn't say how a concept should be shown or kept
safe, so the AI drew each pitch as an SVG garment sketch labelled "concept, not for sale", limited
the questionnaire to fixed choices plus three short text fields, and added a validator so Dan only
picks real in-stock items and uses Yale marks only.

---

## Problem 13: Push to GitHub and submit the URL

**Prompt 1 (my words, at the start of the homework):**
> I'm starting homework four. Here's the file structure we need to follow (screenshots of
> Problem 13). Go into the homework four folder and put a joke in there so I know you're in
> the right folder.

**Follow-up prompt:**
> Let's not have a folder inside a folder. Just make the "HW 4" folder the main folder and treat
> it as `hw4`, use the Problem 13 structure from the beginning, and I'll add the needed
> components at the end.

**Prompt 2 (my words, at the end):**
> Problem 13 is "push to GitHub and submit the URL" (screenshots of the panels). It's just to help
> with the submission, so let's do that next. Let me know what you need from me. (Then: here is my
> GitHub, 20Sam.)

**Follow-up prompt:**
> It's not letting me hit Enter like you suggested. (The GitHub sign-in in the terminal panel
> wasn't taking input, so the AI ran the sign-in itself and gave me the one-time code to enter on
> github.com.)

**What was lacking after the first prompt:** It didn't say how to publish from this Mac (no GitHub
sign-in was set up) or what should stay private, so the AI asked me how to publish, whether to
include the campus photo and `joke.md`, and which email to show on commits, then installed the
GitHub CLI and checked the repo for secrets before pushing.
