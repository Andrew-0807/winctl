import sys, json
from graphify.build import build_from_json
from graphify.cluster import score_all
from graphify.analyze import god_nodes, surprising_connections, suggest_questions
from graphify.report import generate
from pathlib import Path

extraction = json.loads(Path(".graphify_extract.json").read_text())
detection = json.loads(Path(".graphify_detect.json").read_text())
analysis = json.loads(Path(".graphify_analysis.json").read_text())

G = build_from_json(extraction)
communities = {int(k): v for k, v in analysis["communities"].items()}
cohesion = {int(k): v for k, v in analysis["cohesion"].items()}
tokens = {
    "input": extraction.get("input_tokens", 0),
    "output": extraction.get("output_tokens", 0),
}

# LABELS - replace these with the names you chose above
labels = {
    0: "UI Components",
    1: "Server Core",
    2: "CLI Commands",
    3: "API Layer",
    4: "Process Manager",
    5: "Configuration",
    6: "Settings UI",
    7: "HTTP Routes",
    8: "System Info UI",
    9: "Utilities",
    10: "Shutdown & Tray",
    11: "Gallery View",
    12: "Autostart",
    13: "Log Streaming",
    14: "Sidebar Cleanup",
    15: "Scripts",
    16: "Scripts",
    17: "Scripts",
    18: "Scripts",
    19: "Scripts",
    20: "Scripts",
    21: "Type Definitions",
    22: "Type Definitions",
    23: "Type Definitions",
    24: "Type Definitions",
    25: "Type Definitions",
    26: "Type Definitions",
    27: "Type Definitions",
    28: "Service Install",
    29: "Service Uninstall",
}

# Regenerate questions with real community labels (labels affect question phrasing)
questions = suggest_questions(G, communities, labels)

report = generate(
    G,
    communities,
    cohesion,
    labels,
    analysis["gods"],
    analysis["surprises"],
    detection,
    tokens,
    "openspec/changes/archive",
    suggested_questions=questions,
)
Path("graphify-out/GRAPH_REPORT.md").write_text(report, encoding="utf-8")
Path(".graphify_labels.json").write_text(
    json.dumps({str(k): v for k, v in labels.items()})
)
print("Report updated with community labels")
