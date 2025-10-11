import requests
import time

BASE_URL = "https://telegram-game-room-production.up.railway.app"
HEADERS = {
    "X-Test-Runner": "testsprite",
    "User-Agent": "python-requests TestSprite"
}
TIMEOUT = 30


def test_get_user_fires_history_with_pagination():
    # Step 1: Get at least one userId from /api/economy/users
    users_url = f"{BASE_URL}/api/economy/users"
    user_id = None
    limit_val = 5
    offset_val = 0

    # Retry logic for 429 with small sleep between requests
    def get_users_with_retry(max_retries=5):
        retries = 0
        while retries < max_retries:
            resp = requests.get(users_url, headers=HEADERS, timeout=TIMEOUT)
            if resp.status_code == 429:
                time.sleep(0.2)
                retries += 1
            else:
                return resp
        resp.raise_for_status()
        return resp

    resp_users = get_users_with_retry()
    assert resp_users.status_code == 200, f"Users endpoint returned {resp_users.status_code}"
    users_data = resp_users.json()
    assert isinstance(users_data, dict), "Users response is not a dict"
    assert "items" in users_data, "Users response missing 'items'"
    items = users_data.get("items")
    assert isinstance(items, list), "'items' not a list in users response"
    assert len(items) > 0, "No users found to test"

    # Validate user entries have required fields and types
    for user in items:
        assert "userId" in user and isinstance(user["userId"], str), "userId missing or not string"
        assert "fires" in user and isinstance(user["fires"], int), "fires missing or not int"

    user_id = items[0]["userId"]

    # Step 2: Call GET /api/economy/history/{userId} with limit and offset query params
    history_url = f"{BASE_URL}/api/economy/history/{user_id}"
    params = {"limit": limit_val, "offset": offset_val}

    # Retry logic for 429 with small sleep between requests
    def get_history_with_retry(max_retries=5):
        retries = 0
        while retries < max_retries:
            resp = requests.get(history_url, headers=HEADERS, params=params, timeout=TIMEOUT)
            if resp.status_code == 429:
                time.sleep(0.25)
                retries += 1
            else:
                return resp
        resp.raise_for_status()
        return resp

    resp_history = get_history_with_retry()
    assert resp_history.status_code == 200, f"History API returned {resp_history.status_code}"

    history_data = resp_history.json()
    assert isinstance(history_data, dict), "History response is not a dict"
    assert history_data.get("success") is True, "'success' field missing or not True in history response"
    assert "items" in history_data and isinstance(history_data["items"], list), "'items' missing or not list"
    assert "limit" in history_data and history_data["limit"] == limit_val, "'limit' missing or incorrect"
    assert "offset" in history_data and history_data["offset"] == offset_val, "'offset' missing or incorrect"

    # Check each item in items list has at least one of the allowed keys: amount|value|fires|reason
    allowed_keys = {"amount", "value", "fires", "reason"}
    for tx in history_data["items"]:
        assert any(key in tx for key in allowed_keys), (
            f"Transaction item {tx} does not contain any of the required keys {allowed_keys}"
        )


test_get_user_fires_history_with_pagination()
