import requests

BASE_URL = "https://telegram-game-room-production.up.railway.app"
TIMEOUT = 30

def test_get_user_fires_history_with_pagination():
    # Step 1: Obtain a userId by listing users (to have a valid userId to test)
    users_url = f"{BASE_URL}/api/economy/users"
    try:
        users_resp = requests.get(users_url, params={"limit": 1}, timeout=TIMEOUT)
        users_resp.raise_for_status()
        users_data = users_resp.json()
        # API devuelve { cursor, items }
        if not users_data or not isinstance(users_data, dict):
            raise AssertionError("Users response is empty or invalid")
        items = users_data.get("items") or []
        if not items:
            raise AssertionError("Users list is empty")
        user = items[0]
        user_id = user.get("userId") or user.get("id")
        if not user_id or not isinstance(user_id, str):
            raise AssertionError("userId missing or invalid in user object")
    except Exception as e:
        raise AssertionError(f"Failed to obtain userId for test: {e}")

    limit = 5
    offset = 0
    history_url = f"{BASE_URL}/api/economy/history/{user_id}"
    try:
        resp = requests.get(history_url, params={"limit": limit, "offset": offset}, timeout=TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
        # API devuelve { success, items, limit, offset }
        assert isinstance(data, dict), "Response should be an object"
        items = data.get("items") or []
        assert len(items) <= limit, f"Returned more than {limit} entries"
        for item in items:
            assert isinstance(item, dict), "Each item should be a dict"
            assert any(k in item for k in ["amount", "value", "fires", "transactionId", "txId", "id", "reason"]), "No expected transaction keys found"
    except Exception as e:
        raise AssertionError(f"Failed to get user fires history with pagination: {e}")


test_get_user_fires_history_with_pagination()
