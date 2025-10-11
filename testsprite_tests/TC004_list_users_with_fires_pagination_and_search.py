import requests

BASE_URL = "https://telegram-game-room-production.up.railway.app"
TIMEOUT = 30

def test_list_users_with_fires_pagination_and_search():
    endpoint = f"{BASE_URL}/api/economy/users"
    params = {
        "cursor": "",
        "limit": 10,
        "search": "user"
    }
    try:
        response = requests.get(endpoint, params=params, timeout=TIMEOUT)
        assert response.status_code == 200, f"Expected status 200 but got {response.status_code}"
        data = response.json()
        assert isinstance(data, dict) or isinstance(data, list), "Response JSON should be dict or list"
        # Check paginated structure if dict (usually with cursor info)
        if isinstance(data, dict):
            # Typical paginated response with users and next cursor
            assert "users" in data or "items" in data, "Response should contain 'users' or 'items' key"
            users = data.get("users") or data.get("items")
            assert isinstance(users, list), "'users' or 'items' should be a list"
            # Validate filtered results contain the search term (case-insensitive) in user fields
            for user in users:
                user_str = " ".join(str(v).lower() for v in user.values() if isinstance(v, str))
                assert "user" in user_str, "Each user should match the search query"
                # Check fires presence
                assert "fires" in user or "fires_balance" in user, "User object should contain 'fires' field"
        elif isinstance(data, list):
            # If the response is just a list
            for user in data:
                user_str = " ".join(str(v).lower() for v in user.values() if isinstance(v, str))
                assert "user" in user_str, "Each user should match the search query"
                assert "fires" in user or "fires_balance" in user, "User object should contain 'fires' field"
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

test_list_users_with_fires_pagination_and_search()