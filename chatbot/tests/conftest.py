import importlib
import json
import os
import sys
import tempfile
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[2]
TEST_ROOT = Path(tempfile.mkdtemp(prefix="vallombrosa-tests-"))
DATA_DIR = TEST_ROOT / "campaign-data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
(DATA_DIR / "tier1.md").write_text("Test campaign knowledge.\n", encoding="utf-8")
(DATA_DIR / "vector_store.json").write_text(
    json.dumps({"meta": {"built_at": "test"}, "entries": []}),
    encoding="utf-8",
)

TEST_ENV = {
    "CAMPAIGN_DATA_DIR": str(DATA_DIR),
    "APP_DB_PATH": str(TEST_ROOT / "app.sqlite3"),
    "GALLERY_DIR": str(TEST_ROOT / "gallery"),
    "LOG_PATH": str(TEST_ROOT / "chat.log"),
    "LORE_DRAFT_DIR": str(TEST_ROOT / "lore-drafts"),
    "SITE_SOURCE_DIR": str(REPO_ROOT),
    "AUTH_TOKEN_SECRET": "test-player-secret",
    "SESSION_JWT_SECRET": "test-session-secret",
    "ALLOWED_DM_EMAILS": "dm@example.test",
    "GOOGLE_OAUTH_CLIENT_ID": "test-google-client",
    "DISCORD_OAUTH_CLIENT_ID": "test-discord-client",
    "DISCORD_OAUTH_CLIENT_SECRET": "test-discord-secret",
    "PUBLIC_BASE_URL": "https://example.test",
    "AUTH_COOKIE_SECURE": "0",
    "QUERY_EXPANSION_ENABLED": "0",
    "STUDIO_MONTHLY_QUOTA": "0",
}
os.environ.update(TEST_ENV)

sys.path.insert(0, str(REPO_ROOT))
sys.path.insert(0, str(REPO_ROOT / "chatbot"))
server = importlib.import_module("server")
server.app.config.update(TESTING=True)


@pytest.fixture(scope="session")
def server_module():
    return server


@pytest.fixture(scope="session")
def app(server_module):
    return server_module.app


@pytest.fixture(scope="session")
def auth_headers(server_module):
    tokens = {
        "anonymous": None,
        "player": server_module._issue_player_token("Lotan"),
        "dm": server_module._issue_player_token("DM", is_dm=True),
        "google_dm": server_module._mint_session_jwt("dm@example.test"),
    }
    return {
        role: ({"Authorization": f"Bearer {token}"} if token else {})
        for role, token in tokens.items()
    }
