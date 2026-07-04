import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL: str = os.environ["DATABASE_URL"]
PORT: int = int(os.environ.get("PORT", "8000"))

_DEFAULT_SECRET = "dev-python-api-secret-change-me"
API_SECRET: str = os.environ.get("API_SECRET", _DEFAULT_SECRET)

if os.environ.get("ENVIRONMENT", "development") == "production" and API_SECRET == _DEFAULT_SECRET:
    raise RuntimeError("API_SECRET must be set to a secure value in production")
