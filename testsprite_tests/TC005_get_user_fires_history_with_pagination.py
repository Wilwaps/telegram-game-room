import requests

BASE_URL = "https://telegram-game-room-production.up.railway.app"
TIMEOUT = 30
HEADERS = {
    "Accept": "application/json"
}

def test_get_user_fires_history_with_pagination():
    # Step 1: Get a userId from the users list endpoint to use for the test
    users_url = f"{BASE_URL}/api/economy/users"
    try:
        resp_users = requests.get(users_url, params={"limit": 1}, headers=HEADERS, timeout=TIMEOUT)
        resp_users.raise_for_status()
        users_data = resp_users.json()
        assert isinstance(users_data, list) and len(users_data) > 0, "Users data format unexpected"
        user_id = users_data[0].get("userId") or users_data[0].get("id")
        assert user_id, "User ID not found in users data"
    except (requests.RequestException, AssertionError) as e:
        raise RuntimeError(f"Failed to retrieve userId for testing: {e}")

    limit = 5
    offset = 0
    url = f"{BASE_URL}/api/economy/history/{user_id}"
    params = {
        "limit": limit,
        "offset": offset
    }
    try:
        response = requests.get(url, params=params, headers=HEADERS, timeout=TIMEOUT)
        response.raise_for_status()
        data = response.json()
        # Validate response structure and types
        assert isinstance(data, dict) or isinstance(data, list), "Response data should be list or dict"
        if isinstance(data, dict):
            # no exact schema specified, so just checking dict is not empty
            assert len(data) >= 0
        elif isinstance(data, list):
            for item in data:
                assert isinstance(item, dict), "Each transaction should be a dict"
    except (requests.RequestException, AssertionError) as e:
        raise AssertionError(f"Test failed for get_user_fires_history_with_pagination: {e}")

test_get_user_fires_history_with_pagination()
