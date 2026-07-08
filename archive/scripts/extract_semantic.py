import json
from pathlib import Path

# Files from chunk 3
chunk3_files = [
    "openspec\\changes\\archive\\2026-03-06-fix-started-app-logs\\specs\\app-log-streaming\\spec.md",
    "openspec\\changes\\archive\\2026-03-06-fix-started-app-logs\\specs\\gallery-log-inline-panel\\spec.md",
    "openspec\\changes\\archive\\2026-03-09-add-gallery-view\\design.md",
    "openspec\\changes\\archive\\2026-03-09-add-gallery-view\\proposal.md",
    "openspec\\changes\\archive\\2026-03-09-add-gallery-view\\tasks.md",
    "openspec\\changes\\archive\\2026-03-09-add-gallery-view\\specs\\gallery-view\\spec.md",
    "openspec\\changes\\archive\\2026-03-09-fix-gallery-log-terminal\\design.md",
    "openspec\\changes\\archive\\2026-03-09-fix-gallery-log-terminal\\proposal.md",
    "openspec\\changes\\archive\\2026-03-09-fix-gallery-log-terminal\\tasks.md",
    "openspec\\changes\\archive\\2026-03-09-fix-gallery-log-terminal\\specs\\gallery-log-terminal\\spec.md",
    "openspec\\changes\\archive\\2026-03-09-fix-python-start-cmd\\design.md",
    "openspec\\changes\\archive\\2026-03-09-fix-python-start-cmd\\proposal.md",
    "openspec\\changes\\archive\\2026-03-09-fix-python-start-cmd\\tasks.md",
    "openspec\\changes\\archive\\2026-03-09-fix-python-start-cmd\\specs\\process-execution\\spec.md",
    "openspec\\changes\\archive\\2026-03-14-remove-sidebar-views\\design.md",
    "openspec\\changes\\archive\\2026-03-14-remove-sidebar-views\\proposal.md",
    "openspec\\changes\\archive\\2026-03-14-remove-sidebar-views\\tasks.md",
    "openspec\\changes\\archive\\2026-03-14-shutdown-and-tray-fix\\design.md",
    "openspec\\changes\\archive\\2026-03-14-shutdown-and-tray-fix\\proposal.md",
    "openspec\\changes\\archive\\2026-03-14-shutdown-and-tray-fix\\tasks.md",
]

nodes = []
edges = []
hyperedges = []


# Helper to create node ID
def make_id(name):
    return name.lower().replace(" ", "_").replace("-", "_").replace("/", "_")


# 1. Feature Nodes
features = {
    "app_log_streaming": "App Log Streaming",
    "gallery_view": "Gallery View",
    "gallery_log_terminal": "Gallery Log Terminal",
    "process_execution": "Process Execution",
    "remove_sidebar_views": "Remove Sidebar Views",
    "shutdown_tray_fix": "Shutdown and Tray Fix",
}

for fid, label in features.items():
    nodes.append(
        {
            "id": fid,
            "label": label,
            "file_type": "document",
            "source_file": chunk3_files[0],  # representative
            "source_location": None,
            "source_url": None,
            "captured_at": None,
            "author": None,
            "contributor": None,
        }
    )

# 2. Component/Concept Nodes from file contents
# Based on reading the files:
# App Log Streaming:
# - Backend process manager
# - Frontend subscription binding
# Gallery View:
# - CSS Grid
# - SolidJS createSignal
# - Sidebar (for toggle)
# Gallery Log Terminal:
# - Overlay popup
# - Layout disruption fix
# Process Execution:
# - win32 platform check
# - sudo stripping
# Remove Sidebar Views:
# - Sidebar component
# Shutdown Tray Fix:
# - SettingsModal
# - SysTrayClass
# - keepServicesOnExit

concepts = [
    ("backend_process_manager", "Backend Process Manager"),
    ("frontend_subscription", "Frontend Subscription"),
    ("css_grid", "CSS Grid"),
    ("solidjs_signal", "SolidJS Signal"),
    ("overlay_popup", "Overlay Popup"),
    ("win32_platform", "Win32 Platform"),
    ("sudo_stripping", "Sudo Stripping"),
    ("sidebar_component", "Sidebar Component"),
    ("settings_modal", "Settings Modal"),
    ("systray_class", "SysTray Class"),
    ("keep_services_on_exit", "Keep Services On Exit"),
]

for cid, clabel in concepts:
    nodes.append(
        {
            "id": cid,
            "label": clabel,
            "file_type": "document",
            "source_file": chunk3_files[0],
            "source_location": None,
            "source_url": None,
            "captured_at": None,
            "author": None,
            "contributor": None,
        }
    )

# 3. Extract edges based on file content logic
# App Log Streaming -> Backend Process Manager (EXTRACTED)
edges.append(
    {
        "source": "app_log_streaming",
        "target": "backend_process_manager",
        "relation": "references",
        "confidence": "EXTRACTED",
        "confidence_score": 1.0,
        "source_file": chunk3_files[0],
        "source_location": None,
        "weight": 1.0,
    }
)

# App Log Streaming -> Frontend Subscription (EXTRACTED)
edges.append(
    {
        "source": "app_log_streaming",
        "target": "frontend_subscription",
        "relation": "references",
        "confidence": "EXTRACTED",
        "confidence_score": 1.0,
        "source_file": chunk3_files[0],
        "source_location": None,
        "weight": 1.0,
    }
)

# Gallery View -> CSS Grid (EXTRACTED)
edges.append(
    {
        "source": "gallery_view",
        "target": "css_grid",
        "relation": "implements",
        "confidence": "EXTRACTED",
        "confidence_score": 1.0,
        "source_file": chunk3_files[2],
        "source_location": None,
        "weight": 1.0,
    }
)

# Gallery View -> SolidJS Signal (EXTRACTED)
edges.append(
    {
        "source": "gallery_view",
        "target": "solidjs_signal",
        "relation": "uses",
        "confidence": "EXTRACTED",
        "confidence_score": 1.0,
        "source_file": chunk3_files[2],
        "source_location": None,
        "weight": 1.0,
    }
)

# Gallery Log Terminal -> Overlay Popup (EXTRACTED)
edges.append(
    {
        "source": "gallery_log_terminal",
        "target": "overlay_popup",
        "relation": "implements",
        "confidence": "EXTRACTED",
        "confidence_score": 1.0,
        "source_file": chunk3_files[6],
        "source_location": None,
        "weight": 1.0,
    }
)

# Process Execution -> Win32 Platform (EXTRACTED)
edges.append(
    {
        "source": "process_execution",
        "target": "win32_platform",
        "relation": "references",
        "confidence": "EXTRACTED",
        "confidence_score": 1.0,
        "source_file": chunk3_files[10],
        "source_location": None,
        "weight": 1.0,
    }
)

# Process Execution -> Sudo Stripping (EXTRACTED)
edges.append(
    {
        "source": "process_execution",
        "target": "sudo_stripping",
        "relation": "implements",
        "confidence": "EXTRACTED",
        "confidence_score": 1.0,
        "source_file": chunk3_files[10],
        "source_location": None,
        "weight": 1.0,
    }
)

# Remove Sidebar Views -> Sidebar Component (EXTRACTED)
edges.append(
    {
        "source": "remove_sidebar_views",
        "target": "sidebar_component",
        "relation": "modifies",
        "confidence": "EXTRACTED",
        "confidence_score": 1.0,
        "source_file": chunk3_files[14],
        "source_location": None,
        "weight": 1.0,
    }
)

# Shutdown Tray Fix -> Settings Modal (EXTRACTED)
edges.append(
    {
        "source": "shutdown_tray_fix",
        "target": "settings_modal",
        "relation": "modifies",
        "confidence": "EXTRACTED",
        "confidence_score": 1.0,
        "source_file": chunk3_files[17],
        "source_location": None,
        "weight": 1.0,
    }
)

# Shutdown Tray Fix -> SysTray Class (EXTRACTED)
edges.append(
    {
        "source": "shutdown_tray_fix",
        "target": "systray_class",
        "relation": "modifies",
        "confidence": "EXTRACTED",
        "confidence_score": 1.0,
        "source_file": chunk3_files[17],
        "source_location": None,
        "weight": 1.0,
    }
)

# Shutdown Tray Fix -> Keep Services On Exit (EXTRACTED)
edges.append(
    {
        "source": "shutdown_tray_fix",
        "target": "keep_services_on_exit",
        "relation": "implements",
        "confidence": "EXTRACTED",
        "confidence_score": 1.0,
        "source_file": chunk3_files[17],
        "source_location": None,
        "weight": 1.0,
    }
)

# Cross-feature relationships (INFERRED)
# Gallery View and Gallery Log Terminal are related
edges.append(
    {
        "source": "gallery_view",
        "target": "gallery_log_terminal",
        "relation": "conceptually_related_to",
        "confidence": "INFERRED",
        "confidence_score": 0.8,
        "source_file": "chunk3_aggregate",
        "source_location": None,
        "weight": 1.0,
    }
)

# Shutdown Tray Fix and Process Execution are related (both involve process management)
edges.append(
    {
        "source": "shutdown_tray_fix",
        "target": "process_execution",
        "relation": "conceptually_related_to",
        "confidence": "INFERRED",
        "confidence_score": 0.7,
        "source_file": "chunk3_aggregate",
        "source_location": None,
        "weight": 1.0,
    }
)

# Create a hyperedge for UI components
hyperedges.append(
    {
        "id": "ui_components_group",
        "label": "UI Components Group",
        "nodes": [
            "gallery_view",
            "gallery_log_terminal",
            "remove_sidebar_views",
            "shutdown_tray_fix",
        ],
        "relation": "participate_in",
        "confidence": "INFERRED",
        "confidence_score": 0.75,
        "source_file": "chunk3_aggregate",
    }
)

# Output JSON
output = {
    "nodes": nodes,
    "edges": edges,
    "hyperedges": hyperedges,
    "input_tokens": 0,
    "output_tokens": 0,
}

print(json.dumps(output))
