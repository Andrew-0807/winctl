import json
from pathlib import Path

# Load uncached files
with open(".graphify_uncached.txt", "r") as f:
    lines = f.read().splitlines()

# Separate docs and images
docs = []
images = []
for line in lines:
    if line.lower().endswith((".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp")):
        images.append(line)
    else:
        docs.append(line)

print(f"Docs: {len(docs)}, Images: {len(images)}")

# Create chunks
chunks = []
# Image chunks: each image单独一个chunk
for img in images:
    chunks.append([img])

# Doc chunks: group by directory to keep related files together
doc_chunks = []
current_chunk = []
current_dir = None

for doc in docs:
    doc_path = Path(doc)
    doc_dir = doc_path.parent

    # Start new chunk if we have ~25 files or if directory changes significantly
    if len(current_chunk) >= 25 or (
        current_dir and doc_dir != current_dir and len(current_chunk) > 10
    ):
        if current_chunk:
            doc_chunks.append(current_chunk)
            current_chunk = []

    current_chunk.append(doc)
    current_dir = doc_dir

if current_chunk:
    doc_chunks.append(current_chunk)

chunks.extend(doc_chunks)

print(f"Total chunks: {len(chunks)}")
for i, chunk in enumerate(chunks):
    print(f"Chunk {i}: {len(chunk)} files")
    if len(chunk) <= 5:
        print(f"  Files: {chunk}")

# Save chunks info
with open("graphify-out/chunks_info.json", "w") as f:
    json.dump({"total_chunks": len(chunks), "chunks": chunks}, f, indent=2)
