"""Pydantic / PydanticAI structured types for the Campus Customs shop agent.

Types are added here as each homework problem needs them.
"""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field


class StructuredModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


# ---------------------------------------------------------------- what the tools return to the agent


LOW_STOCK_MAX = 5  # 1 to 5 units left counts as "low stock"

StockStatus = Literal["in_stock", "low_stock", "sold_out"]


class SizeStock(StructuredModel):
    """Live stock for one size of one product (one `inventory` row)."""

    size: str = Field(description="One of XS, S, M, L, XL, XXL.")
    quantity: int = Field(description="Units on hand right now, straight from the inventory table.")
    status: StockStatus = Field(
        description="sold_out when quantity is 0; low_stock when 1 to 5 are left; otherwise in_stock."
    )


class ProductMatch(StructuredModel):
    """One search hit: enough for the agent to pick and describe a product."""

    product_id: str = Field(description="Exact catalogue ID; pass it to get_product_details or check_stock.")
    name: str
    garment_type: str
    price: float = Field(description="Price in US dollars, straight from the catalogue. Quote exactly.")
    colors: list[str] = Field(description="Listed colors; empty means the catalogue does not list any.")
    short_description: str = Field(description="First sentence of the description, for quick comparisons.")
    total_stock: int = Field(description="Units on hand across all sizes; 0 means sold out in every size.")
    in_stock_sizes: list[str] = Field(
        default_factory=list, description="Sizes with at least 1 unit right now, XS to XXL. No counts: use check_stock."
    )


class ProductDetails(ProductMatch):
    """Full record for one product: the whole description, price, and stock for every size."""

    description: str = Field(description="The complete catalogue description. Use it to answer detail questions.")
    search_tags: list[str]
    sizes: list[SizeStock] = Field(description="Every size the product is offered in, XS to XXL, with live stock.")
    in_stock_sizes: list[str] = Field(description="Sizes with at least 1 unit, in size order.")
    sold_out_sizes: list[str] = Field(description="Sizes with 0 units, in size order. Say these are sold out.")


class StockCheck(StructuredModel):
    """Answer to "do you have <product> in <size>?" for ONE size."""

    product_id: str
    name: str
    price: float = Field(description="Price in US dollars, straight from the catalogue.")
    requested_size: str = Field(description="The size as the shopper asked for it, e.g. 'medium'.")
    size: str | None = Field(description="The catalogue size it maps to (XS to XXL), or null if not offered.")
    status: Literal["in_stock", "low_stock", "sold_out", "size_not_offered"] = Field(
        description="What to tell the shopper. sold_out and size_not_offered must be said clearly."
    )
    quantity: int = Field(description="Units on hand in that size (0 if sold out or not offered).")
    in_stock_sizes: list[str] = Field(description="Other sizes that ARE available, to offer instead.")
    similar_in_stock: list[ProductMatch] = Field(
        default_factory=list,
        description=(
            "Filled automatically when status is sold_out or size_not_offered: similar products (same kind of "
            "garment, closest style and price) that DO have the requested size in stock. Offer these."
        ),
    )


class SizeRecommendation(StructuredModel):
    """recommend_size result: a size suggestion from a general size chart, checked against live stock."""

    product_id: str
    name: str
    status: Literal["recommended", "need_more_info"] = Field(
        description="need_more_info when no height, weight, or chest measurement was given."
    )
    recommended_size: str | None = Field(description="Best size from the general chart (XS to XXL), or null.")
    reason: str = Field(description="One sentence on how the size was chosen, to share with the shopper.")
    fit_note: str = Field(description="Reminder that this is a general unisex guide, not the brand's own chart.")
    recommended_quantity: int = Field(description="Units on hand in the recommended size (0 = sold out).")
    recommended_status: Literal["in_stock", "low_stock", "sold_out", "unknown"]
    nearby_sizes_in_stock: list[str] = Field(description="Neighbouring sizes (one up/down) that are in stock.")
    in_stock_sizes: list[str]
    similar_in_stock: list[ProductMatch] = Field(
        default_factory=list, description="If the recommended size is sold out: similar products that have it."
    )


# ---------------------------------------------------------------- what the agent returns


MAX_PAGE_CARDS = 12  # most product cards one chat answer can put on the page


class ShopReply(StructuredModel):
    """The agent's structured answer for one chat turn (the agent → website API contract)."""

    reply: str = Field(
        description="What the shopper reads in the chat: friendly plain text in the Campus Customs voice, no Markdown headings."
    )
    product_ids: list[str] = Field(
        default_factory=list,
        max_length=MAX_PAGE_CARDS,
        description=(
            "Exact product_id values of the products that match the shopper's request, best match first. "
            "The website shows these as product cards on the page. Only IDs returned by a tool while "
            "answering this message. Empty if no product is discussed."
        ),
    )
    results_title: str | None = Field(
        default=None,
        max_length=60,
        description=(
            "Short heading for the cards on the page, e.g. 'Hoodies', 'Navy crewnecks under $60', "
            "'Berkeley College gear'. Required when product_ids is not empty; null otherwise."
        ),
    )


# ---------------------------------------------------------------- what the API sends and receives


class ProductCard(StructuredModel):
    """A product card the website shows on the page (same shape as /api/products items)."""

    product_id: str
    name: str
    garment_type: str
    short_description: str
    price: float
    image_url: str
    colors: list[str]
    total_stock: int


class CustomerContext(StructuredModel):
    """Who is chatting (signed-in shoppers only). The ONLY customer fields the agent ever sees:
    never the user id, password hash, or anyone else's data."""

    first_name: str
    last_name: str
    email: str
    style_notes: str | None = Field(
        default=None, description="Their saved design-studio answers and liked/disliked items, in one short line."
    )


class PageContext(StructuredModel):
    """Where the shopper is on the site when they send a message (sent by the browser).

    The backend checks product IDs against the database before the agent sees anything.
    """

    path: str = Field(default="/", max_length=2000, description="Current page, e.g. '/products/basic-hoodie-big-yale'.")
    product_id: str | None = Field(default=None, max_length=120, description="Product on screen, if on a product page.")
    search_query: str | None = Field(default=None, max_length=2000, description="Search box text (cleaned before use).")
    visible_product_ids: list[str] = Field(
        default_factory=list, max_length=12, description="Product cards the chat put on the page, in order."
    )


class ChatTurn(StructuredModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=4000)


class ChatRequest(StructuredModel):
    message: str = Field(min_length=1, max_length=1000)
    history: list[ChatTurn] = Field(
        default_factory=list,
        max_length=20,
        description=(
            "Guests only: earlier turns of this conversation, oldest first. For signed-in shoppers the "
            "server ignores this and reads their saved history from the database instead."
        ),
    )
    page: PageContext | None = Field(default=None, description="Where the shopper is on the site right now.")


class ChatResponse(StructuredModel):
    """What POST /api/chat returns. The website renders `products` as cards on the page."""

    reply: str = Field(description="Text for the chat bubble.")
    ok: bool = Field(default=True, description="False when the reply is an error message, not a real answer.")
    results_title: str | None = Field(default=None, description="Heading for the cards on the page.")
    products: list[ProductCard] = Field(
        default_factory=list, description="Full product cards built from the database, in the agent's order."
    )


class ChatHistoryMessage(StructuredModel):
    """One saved message, returned by GET /api/chat/history so the chat reloads when a shopper returns."""

    role: Literal["user", "assistant"]
    content: str
    products: list[ProductCard] = Field(default_factory=list, description="Fresh cards for products named in the reply.")
    created_at: str


# ---------------------------------------------------------------- audit trail (Problem 9)


class AuditToolCall(StructuredModel):
    tool: str
    call_id: str = ""
    arguments: dict
    result: str = Field(description="Short summary of what the tool returned (or the retry message).")


class AuditStep(StructuredModel):
    """One model response in the agent loop: when, what it asked for, what came back, and why it stopped."""

    step: int
    at: str = Field(default="", description="UTC time the model answered (ISO 8601).")
    stop_reason: str = Field(
        default="",
        description="tool_calls (asked for tools), final_result (answered), validator_retry (answer sent back), text.",
    )
    tool_calls: list[AuditToolCall] = Field(default_factory=list)
    validator_retry: str | None = Field(default=None, description="Why the output validator sent the answer back.")
    input_tokens: int = 0
    output_tokens: int = 0


class AuditRecord(StructuredModel):
    """One chat turn, appended to output/audit_trail.json for accuracy checks and cost tracking."""

    run_id: str
    timestamp: str
    mode: str = Field(default="chat", description="chat (shop assistant) or studio (design studio).")
    status: str = Field(description="ok, blocked (provider content filter), or error:<type>.")
    stop_reason: str = Field(default="", description="Why the loop ended: final_result, a usage limit, blocked, or an error.")
    shopper: str = Field(description="'guest' or 'user:<id>'. No names or emails are logged.")
    page: str | None = None
    message: str = Field(description="The shopper's message (first 500 characters).")
    model: str
    steps: list[AuditStep] = Field(default_factory=list)
    tools_used: list[str] = Field(default_factory=list)
    validator_retries: int = Field(default=0, description="Answers the output validator sent back.")
    tool_retries: int = Field(default=0, description="Tool calls that asked the model to retry (e.g. unknown ID).")
    reply: str | None = Field(default=None, description="The reply (first 500 characters).")
    product_ids: list[str] = Field(default_factory=list)
    model_requests: int = 0
    input_tokens: int = 0
    output_tokens: int = 0
    seconds_to_first_status: float | None = None
    seconds_to_first_text: float | None = None
    seconds_total: float = 0.0


# ---------------------------------------------------------------- design studio (Problem 12 feature)

Vibe = Literal["classic ivy", "game day", "cozy", "vintage", "minimal", "sporty", "preppy"]
Fit = Literal["fitted", "regular", "relaxed", "oversized"]
Occasion = Literal["class and library", "game day", "family weekend", "reunion", "gift", "gym", "night out"]
Garment = Literal["hoodie", "crewneck", "t-shirt", "quarter-zip", "jacket", "surprise me"]
Logo = Literal["yale wordmark", "y monogram", "bulldog", "college crest", "school or sport", "est. 1701"]
Placement = Literal["left chest", "center chest", "sleeve", "back", "hood"]
Color = Literal["yale navy", "heather gray", "cream", "white", "black", "royal blue", "red accents", "forest green"]
Material = Literal["heavy fleece", "soft cotton", "tri-blend", "sweater knit", "performance", "waffle knit"]


class StudioAnswers(StructuredModel):
    """What the shopper tells the design studio. Choices are fixed lists; free text is short."""

    vibe: Vibe
    fit: Fit
    occasion: Occasion
    garment: Garment = "surprise me"
    colors: list[Color] = Field(default_factory=list, max_length=4, description="Picked from the studio's color chips.")
    materials: list[Material] = Field(default_factory=list, max_length=3, description="Picked from the material chips.")
    logo: Logo = "yale wordmark"
    logo_detail: str = Field(default="", max_length=40, description="Which college, school, or sport, if any.")
    placement: Placement = "left chest"
    inspired_by: str = Field(default="", max_length=160, description="Styles or pieces that inspire the idea.")
    notes: str = Field(default="", max_length=240, description="Anything else the shopper wants.")


class StudioConcept(StructuredModel):
    """Dan's original product pitch (a concept for the store team, not a product for sale)."""

    name: str = Field(max_length=60, description="A catchy product name, e.g. 'Lamplight Library Crew'.")
    tagline: str = Field(max_length=120)
    garment: Literal["hoodie", "crewneck", "t-shirt", "quarter-zip", "jacket"]
    base_color: str = Field(max_length=30, description="Main garment color, from the shopper's colors when given.")
    accent_color: str = Field(max_length=30, description="Logo and trim color.")
    material: str = Field(max_length=60)
    logo_text: str = Field(max_length=24, description="The exact words or letters printed, e.g. 'YALE', 'Y', 'BERKELEY'.")
    placement: Literal["left chest", "center chest", "sleeve", "back", "hood"]
    details: list[Annotated[str, Field(max_length=90)]] = Field(max_length=4, description="Two to four specific design details.")
    inspired_by_note: str = Field(max_length=200, description="How the shopper's inspiration shows up, without copying any brand's logo.")
    why_it_fits: str = Field(max_length=240, description="Why this fits the shopper's vibe, fit, and occasion.")


class StudioPick(StructuredModel):
    product_id: str
    why: str = Field(max_length=180, description="One sentence: why this real catalogue item fits the vibe. No prices or stock.")


class StudioResult(StructuredModel):
    """The studio agent's structured output."""

    concept: StudioConcept
    picks: list[StudioPick] = Field(min_length=3, max_length=8, description="Best first; only IDs from the candidate list.")
    styling_note: str = Field(max_length=220, description="How to wear the picks together for the occasion.")


class StudioPickCard(StructuredModel):
    product: ProductCard
    why: str


class StudioResponse(StructuredModel):
    pitch_id: int
    concept: StudioConcept
    picks: list[StudioPickCard] = Field(description="Shown first (up to 4).")
    reserve: list[StudioPickCard] = Field(default_factory=list, description="Swapped in on 'Show another' or 'Not for me'.")
    styling_note: str
    saved_to_account: bool


class StudioRequest(StructuredModel):
    answers: StudioAnswers
    # Guests keep likes in their own browser and send them along; signed-in shoppers' come from the database.
    liked: list[Annotated[str, Field(max_length=120)]] = Field(default_factory=list, max_length=40)
    disliked: list[Annotated[str, Field(max_length=120)]] = Field(default_factory=list, max_length=40)


class StudioFeedback(StructuredModel):
    product_id: str = Field(max_length=120)
    verdict: Literal["like", "dislike", "clear"]
