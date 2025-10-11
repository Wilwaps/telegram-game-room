import requests
import uuid

BASE_URL = "https://telegram-game-room-production.up.railway.app"
TIMEOUT = 30

HEADERS_ADMIN = {
    "X-Test-Runner": "testsprite",
    "User-Agent": "python-requests TestSprite",
    "x-admin-username": "wilcnct",
    "x-admin-code": "658072974",
    "Content-Type": "application/json",
}


def test_add_sponsor_as_admin():
    # Prepare test sponsor data
    test_user_id = f"testsprite-{uuid.uuid4()}"
    sponsor_data = {
        "userId": test_user_id,
        "key": "testkey123",
        "description": "Test Sponsor added by admin",
        "initialAmount": 1000
    }

    try:
        # POST /api/economy/sponsors/add as admin
        resp = requests.post(
            f"{BASE_URL}/api/economy/sponsors/add",
            json=sponsor_data,
            headers=HEADERS_ADMIN,
            timeout=TIMEOUT,
        )
        assert resp.status_code == 200, f"Expected status 200, got {resp.status_code}"
        resp_json = resp.json()
        assert "success" in resp_json, "'success' field missing from response"
        assert resp_json["success"] is True, "Response success is not True"
        assert "sponsors" in resp_json, "'sponsors' field missing from response"
        assert isinstance(resp_json["sponsors"], list), "'sponsors' is not a list"
        # Validate added sponsor is in returned sponsors list by userId
        assert any(s.get("userId") == test_user_id for s in resp_json["sponsors"]), (
            f"Sponsor with userId {test_user_id} not found in response sponsors"
        )
    finally:
        # Cleanup: remove the test sponsor by admin
        requests.post(
            f"{BASE_URL}/api/economy/sponsors/remove",
            json={"userId": test_user_id},
            headers=HEADERS_ADMIN,
            timeout=TIMEOUT,
        )


test_add_sponsor_as_admin()