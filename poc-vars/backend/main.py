from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import json
from pathlib import Path

app = FastAPI()

# CORS (needed for MkDocs on different port)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # PoC only
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_FILE = Path(__file__).parent / "variables.json"


@app.get("/api/variables")
def get_variables():
    try:
        with open(DATA_FILE) as f:
            data = json.load(f)
        return data
    except Exception as e:
        return {"error": str(e)}