import requests
import time

BASE_URL = "https://telegram-game-room-production.up.railway.app"
TIMEOUT = 30

def test_list_users_with_fires_pagination_and_search():
    endpoint = f"{BASE_URL}/api/economy/users"

    # Prepare query parameters for pagination and search
    params = {
        "cursor": "",  # Start with empty cursor to get initial page
        "limit": 5,
        "search": "user"  # Example search term to filter users
    }

    all_users = []
    cursor = params["cursor"]

    try:
        # Pagination loop: retrieve up to 2 pages to check pagination correctness
        for _ in range(2):
            params["cursor"] = cursor
            response = requests.get(endpoint, params=params, timeout=TIMEOUT)
            assert response.status_code == 200, f"Expected 200, got {response.status_code}"
            json_data = response.json()
            # Validate response structure (actual API)
            assert "items" in json_data, "'items' key missing in response"
            assert isinstance(json_data["items"], list), "'items' should be a list"
            assert all(isinstance(user.get("fires", 0), int) for user in json_data["items"]), "Each user must have integer 'fires'"

            all_users.extend(json_data["items"])

            # Pagination cursor for next page (actual key 'cursor')
            cursor = json_data.get("cursor")
            # If no next cursor, break pagination
            if not cursor:
                break
            
            # Validate search filter using userName or userId
            for user in json_data["items"]:
                username = (user.get("userName") or "").lower()
                uid = str(user.get("userId") or "").lower()
                fires = user.get("fires")
                assert isinstance(fires, int), "'fires' should be integer"
                if params["search"]:
                    assert params["search"].lower() in username or params["search"].lower() in uid, \
                        f"User {username or uid} does not match search filter"

            time.sleep(0.1)  # brief pause between pages

    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

test_list_users_with_fires_pagination_and_search()