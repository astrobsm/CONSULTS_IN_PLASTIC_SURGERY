# PS Consult – UNTH Backend

## Plastic Surgery Consult System – University of Nigeria Teaching Hospital

### Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows

pip install -r requirements.txt

# Create .env file
cp .env.example .env

# Run database migrations
alembic upgrade head

# Seed initial data
python seed.py

# Start server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Environment Variables

Create a `.env` file with:

```
DATABASE_URL=postgresql://postgres:password@localhost:5432/ps_consult
SECRET_KEY=your-secret-key-change-this
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480
```
