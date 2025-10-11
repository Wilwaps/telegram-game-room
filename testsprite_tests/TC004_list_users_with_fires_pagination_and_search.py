import requests
import time

BASE_URL = "https://telegram-game-room-production.up.railway.app"
HEADERS = {
    "X-Test-Runner": "testsprite",
    "User-Agent": "PythonTestClient TestSprite",
}

def test_list_users_with_fires_pagination_and_search():
    url = f"{BASE_URL}/api/economy/users"

    # Use search string from existing user name substring if possible, otherwise fallback to empty
    # Pagination: test limit=2 and cursor from previous response to test pagination

    params = {"limit": 2}

    # First request: get first page
    try:
        resp = requests.get(url, headers=HEADERS, params=params, timeout=30)
        assert resp.status_code == 200, f"Expected 200 OK, got {resp.status_code}"
        data = resp.json()
        assert "success" in data and data["success"] is True, "'success' field missing or false in response"
        assert "items" in data and isinstance(data["items"], list), "'items' missing or not a list"
        assert isinstance(data.get("cursor", None), (str, type(None))), "'cursor' field missing or not string or None"

        # Validate items structure and fires integer
        for item in data["items"]:
            assert isinstance(item, dict), "Item is not a dict"
            assert "userId" in item and isinstance(item["userId"], str), "Missing or invalid userId"
            if "username" in item:
                assert isinstance(item["username"], str), "Invalid username"
            assert "fires" in item and isinstance(item["fires"], int), "Missing or invalid fires"

        cursor = data.get("cursor", None)
        if cursor:
            # Use cursor to get second page and verify pagination works
            params2 = {"limit": 2, "cursor": cursor}
            resp2 = requests.get(url, headers=HEADERS, params=params2, timeout=30)
            assert resp2.status_code == 200, f"Expected 200 OK for second page, got {resp2.status_code}"
            data2 = resp2.json()
            assert data2.get("success", False) is True, "Second page success field false"
            assert isinstance(data2.get("items"), list), "Second page items not a list"
            # Validate second page items structure
            for item in data2["items"]:
                assert isinstance(item, dict), "Second page item is not a dict"
                assert "userId" in item and isinstance(item["userId"], str), "Second page missing or invalid userId"
                if "username" in item:
                    assert isinstance(item["username"], str), "Second page invalid username"
                assert "fires" in item and isinstance(item["fires"], int), "Second page missing or invalid fires"

        # Search test: use username from first item substring if exists
        if data["items"] and "username" in data["items"][0]:
            search_str = data["items"][0]["username"][:3]
        else:
            search_str = "a"

        params_search = {"search": search_str, "limit": 5}
        resp_search = requests.get(url, headers=HEADERS, params=params_search, timeout=30)
        assert resp_search.status_code == 200, f"Expected 200 OK for search, got {resp_search.status_code}"
        data_search = resp_search.json()
        assert data_search.get("success", False) is True, "Search response success false"
        items_search = data_search.get("items", [])
        assert isinstance(items_search, list), "Search items not a list"
        for item in items_search:
            assert isinstance(item, dict), "Search item not dict"
            assert "userId" in item and isinstance(item["userId"], str)
            if "username" in item:
                assert isinstance(item["username"], str)
                # Validate search filter applied (username contains search_str case-insensitive)
                assert search_str.lower() in item["username"].lower()
            assert "fires" in item and isinstance(item["fires"], int)

    except requests.exceptions.RequestException as e:
        assert False, f"Request failed: {e}"

test_list_users_with_fires_pagination_and_search()
