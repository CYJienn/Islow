import json
import random
import re
from typing import Any

from app.schemas.chat import ChatResponse

HELP = (
    "Type /create followed by a chart type and topic.\n\n"
    "Chart types: histogram, line, pie, donut, gauge, ring, scatter, "
    "heatmap, bar, meter\n\nExample: /create line chart of sales"
)

CHART_KEYWORDS = {
    "hist": ("histogram", "frequency", "distribution"),
    "line": ("line", "trend", "time series"),
    "pie": ("pie", "proportion", "breakdown"),
    "donut": ("donut", "doughnut"),
    "gauge": ("gauge", "speedometer", "dial"),
    "ring": ("ring", "circular progress"),
    "scatter": ("scatter", "correlation"),
    "heat": ("heatmap", "heat map"),
    "bars": ("bar chart", "bar graph", "column chart"),
    "meter": ("meter", "progress"),
}

TOPICS = {
    "sales": ("sales", "sale", "revenue", "jualan"),
    "expenses": ("expenses", "expense", "spend", "cost", "belanja"),
    "water": ("water", "hydration", "drink", "air"),
    "tasks": ("tasks", "task", "todo", "tugas"),
    "customers": ("customers", "customer", "client", "pelanggan"),
    "inventory": ("inventory", "stock", "stok", "barang"),
    "energy": ("energy", "stamina", "tenaga"),
    "mood": ("mood", "feeling", "wellness"),
}


def _match(mapping: dict[str, tuple[str, ...]], text: str, default: str) -> str:
    return next(
        (name for name, words in mapping.items() if any(word in text for word in words)),
        default,
    )


def _widget(description: str) -> dict[str, Any]:
    chart = _match(CHART_KEYWORDS, description, "bars")
    topic = _match(TOPICS, description, "overview")
    title = topic.title()
    labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    values = [{"label": label, "value": random.randint(20, 100)} for label in labels]
    widget_id = re.sub(r"[^a-z0-9-]", "-", f"{topic}-{chart}").strip("-")[:24]

    if chart in {"gauge", "ring", "meter"}:
        blocks = [{"type": chart, "value": random.randint(40, 95), "label": title}]
    elif chart in {"pie", "donut"}:
        blocks = [{"type": chart, "slices": values[:4], "center": title}]
    elif chart == "scatter":
        blocks = [{"type": "scatter", "points": [{"x": i * 15, "y": item["value"]} for i, item in enumerate(values)]}]
    else:
        blocks = [{"type": chart, "items": values}]

    return {
        "id": widget_id,
        "title": {"en": title, "ms": title},
        "colors": ["#99f6e4", "#14b8a6"],
        "iconColor": "#04201c",
        "size": [4, 3],
        "mini": {"big": str(values[-1]["value"]), "l1": title, "l2": "Demo data"},
        "blocks": blocks,
    }


def respond(text: str) -> ChatResponse:
    command = re.fullmatch(r"/create\s*(.*)", text.strip(), flags=re.IGNORECASE | re.DOTALL)
    if not command:
        return ChatResponse(type="text", message=HELP)

    value = re.sub(r"^```(?:json)?\s*|\s*```$", "", command.group(1).strip(), flags=re.IGNORECASE)
    if not value:
        return ChatResponse(type="text", message=HELP)

    if value.startswith("{"):
        try:
            spec = json.loads(value)
        except json.JSONDecodeError as error:
            return ChatResponse(type="error", message=f"Invalid JSON: {error.msg}.")
    else:
        spec = _widget(value.lower())

    return ChatResponse(
        type="widget",
        spec=spec,
        message=f'Created "{spec.get("title", {}).get("en", "custom")}" widget. Save the layout to keep its position.',
    )
