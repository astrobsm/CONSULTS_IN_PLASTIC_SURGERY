"""Quick test for public consult endpoint using TestClient."""
import json

# Test via FastAPI TestClient (no server needed)
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

body = {
    "patient_name": "Test Patient",
    "hospital_number": "UNTH001",
    "age": 30,
    "sex": "Male",
    "ward": "Ward 1",
    "bed_number": "5",
    "date_of_admission": "2026-02-22",
    "primary_diagnosis": "Burn injury",
    "indication": "Need plastic consult",
    "urgency": "routine",
    "inviting_unit": "General Surgery",
    "consultant_in_charge": "Dr Smith",
    "requesting_doctor": "Dr Jones",
    "designation": "Registrar",
    "phone_number": "08012345678",
}

resp = client.post("/api/consults/public", json=body)
print(f"Status: {resp.status_code}")
print(f"Body: {json.dumps(resp.json(), indent=2)}")

