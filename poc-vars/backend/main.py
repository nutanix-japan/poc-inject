from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import json
from pathlib import Path

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

LABS_FILE = Path("labs.json")

def load_lab():
    with open(LABS_FILE, "r") as f:
        return json.load(f)

def save_lab(data):
    with open(LABS_FILE, "w") as f:
        json.dump(data, f, indent=2)

# ── Get full lab (columns + slots) ──
@app.get("/api/lab")
def get_lab():
    return load_lab()

# ── Upsert slot by email ──
@app.post("/api/lab/slots/{email}")
def upsert_slot(email: str, updated: dict):
    data = load_lab()
    for i, slot in enumerate(data["slots"]):
        if slot["email"] == email:
            data["slots"][i] = updated
            save_lab(data)
            return {"status": "updated"}
    data["slots"].append(updated)
    save_lab(data)
    return {"status": "inserted"}

# ── Delete slot by email ──
@app.delete("/api/lab/slots/{email}")
def delete_slot(email: str):
    data = load_lab()
    original_len = len(data["slots"])
    data["slots"] = [s for s in data["slots"] if s.get("email") != email]
    if len(data["slots"]) == original_len:
        return {"error": "Slot not found"}
    save_lab(data)
    return {"status": "deleted"}

# ── Add column ──
@app.post("/api/lab/columns")
def add_column(payload: dict):
    col_name = payload.get("column")
    if not col_name:
        return {"error": "Missing column name"}
    data = load_lab()
    if col_name in data["columns"]:
        return {"error": "Column already exists"}
    data["columns"].append(col_name)
    for slot in data["slots"]:
        slot.setdefault(col_name, "")
    save_lab(data)
    return {"status": "column added", "column": col_name}

# ── Delete column ──
@app.delete("/api/lab/columns/{col_name}")
def delete_column(col_name: str):
    data = load_lab()
    if col_name not in data["columns"]:
        return {"error": "Column not found"}
    data["columns"].remove(col_name)
    for slot in data["slots"]:
        slot.pop(col_name, None)
    save_lab(data)
    return {"status": "column deleted", "column": col_name}

# ── Backward-compatible endpoint for inline [[key]] replacement ──
# Future: call with ?email=user2@mail.com when you add selector/authentication
@app.get("/api/variables")
def get_variables(email: str = None):
    data = load_lab()
    
    if not data.get("slots"):
        return {"variables": {}}
    
    # Use provided email or fall back to first slot
    slot = None
    if email:
        slot = next((s for s in data["slots"] if s.get("email") == email), None)
    
    if not slot:
        slot = data["slots"][0]  # default to first slot
    
    # Return flat dict like the old system expected
    variables = {k: v for k, v in slot.items() if k != "email"}
    return {"variables": variables}

# ── Validate email exists in labs.json ──
@app.get("/api/validate-email")
def validate_email(email: str):
    data = load_lab()
    exists = any(slot.get("email") == email for slot in data.get("slots", []))
    if not exists:
        return {"valid": False, "message": "Email not found"}
    return {"valid": True}