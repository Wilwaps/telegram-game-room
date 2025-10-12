import requests

def test_list_users_with_fires_pagination_and_search():
    base_url = "http://127.0.0.1:3000"
    endpoint = "/api/economy/users"
    headers = {
        "X-Test-Runner": "testsprite",
        "User-Agent": "TestSprite"
    }
    params = {
        "cursor": "",
        "limit": 5,
        "search": "a"  # example search term to filter users
    }
    try:
        # First call without cursor to get initial page
        resp = requests.get(base_url + endpoint, headers=headers, params=params, timeout=30)
        assert resp.status_code == 200, f"Expected status 200 but got {resp.status_code}"
        data = resp.json()

        if isinstance(data, list):
            users = data
        elif isinstance(data, dict):
            users = data.get("users") or data.get("items") or data.get("data")
            assert users is not None, "Response json does not contain users key"
            assert isinstance(users, list), "Users field is not a list"
        else:
            assert False, "Response JSON is neither dict nor list"

        # Check that 'fires' field exists per user
        for user in users:
            user_fires = user.get("fires")
            assert user_fires is not None, "User object lacks 'fires' field"

        # Check pagination: if a cursor is given in response, use it to request next page
        if isinstance(data, dict):
            next_cursor = data.get("cursor") or data.get("nextCursor") or data.get("next_cursor")
            if next_cursor:
                params["cursor"] = next_cursor
                resp2 = requests.get(base_url + endpoint, headers=headers, params=params, timeout=30)
                assert resp2.status_code == 200, f"Expected status 200 but got {resp2.status_code} in second page"
                data2 = resp2.json()
                if isinstance(data2, list):
                    users2 = data2
                elif isinstance(data2, dict):
                    users2 = data2.get("users") or data2.get("items") or data2.get("data")
                    assert users2 is not None, "Second page response json does not contain users key"
                else:
                    assert False, "Second page response JSON is neither dict nor list"
                assert isinstance(users2, list), "Second page users field is not a list"

    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

test_list_users_with_fires_pagination_and_search()
