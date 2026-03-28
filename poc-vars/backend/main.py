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

def load_labs():
    with open(LABS_FILE, "r") as f:
        return json.load(f)

def save_labs(data):
    with open(LABS_FILE, "w") as f:
        json.dump(data, f, indent=2)

@app.get("/api/labs")
def get_labs():
    return load_labs()

@app.get("/api/labs/{lab_name}")
def get_lab(lab_name: str):
    data = load_labs()
    lab = data["labs"].get(lab_name)
    if not lab:
        return {"error": "Lab not found"}
    return lab

@app.post("/api/labs/{lab_name}/slots/{slot_id}")
def update_slot(lab_name: str, slot_id: int, updated: dict):
    data = load_labs()
    lab = data["labs"].get(lab_name)
    if not lab:
        return {"error": "Lab not found"}

    for i, slot in enumerate(lab["slots"]):
        if slot["id"] == slot_id:
            lab["slots"][i] = updated
            save_labs(data)
            return {"status": "updated"}

    lab["slots"].append(updated)
    save_labs(data)
    return {"status": "inserted"}

@app.delete("/api/labs/{lab_name}/slots/{slot_id}")
def delete_slot(lab_name: str, slot_id: int):
    data = load_labs()
    lab = data["labs"].get(lab_name)
    if not lab:
        return {"error": "Lab not found"}

    original_len = len(lab["slots"])
    lab["slots"] = [s for s in lab["slots"] if s["id"] != slot_id]

    if len(lab["slots"]) == original_len:
        return {"error": "Slot not found"}

    save_labs(data)
    return {"status": "deleted"}

@app.post("/api/labs/{lab_name}/columns")
def add_column(lab_name: str, payload: dict):
    col_name = payload.get("column")
    if not col_name:
        return {"error": "Missing column name"}

    data = load_labs()
    lab = data["labs"].get(lab_name)
    if not lab:
        return {"error": "Lab not found"}

    if col_name in lab["columns"]:
        return {"error": "Column already exists"}

    lab["columns"].append(col_name)
    for slot in lab["slots"]:
        slot.setdefault(col_name, "")

    save_labs(data)
    return {"status": "column added", "column": col_name}

@app.delete("/api/labs/{lab_name}/columns/{col_name}")
def delete_column(lab_name: str, col_name: str):
    data = load_labs()
    lab = data["labs"].get(lab_name)
    if not lab:
        return {"error": "Lab not found"}

    if col_name not in lab["columns"]:
        return {"error": "Column not found"}

    lab["columns"].remove(col_name)
    for slot in lab["slots"]:
        slot.pop(col_name, None)

    save_labs(data)
    return {"status": "column deleted", "column": col_name}

@app.get("/api/variables")
def get_variables(email: str):
    data = load_labs()
    for lab_name, lab in data["labs"].items():
        for slot in lab["slots"]:
            if slot.get("email") == email:
                result = {k: v for k, v in slot.items() if k not in ["id", "email"]}
                return {"lab": lab_name, "variables": result}
    return {"error": "User not assigned to any slot"}