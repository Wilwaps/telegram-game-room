import os
import requests

BASE_URL = "http://127.0.0.1:3000"
HEADERS = {
    "X-Test-Runner": "testsprite",
    "User-Agent": "TestSprite"
}
TIMEOUT = 30


def test_get_user_fires_history_with_pagination():
    # First get some users to obtain a userId to test
    users_url = f"{BASE_URL}/api/economy/users"
    try:
        resp_users = requests.get(users_url, headers=HEADERS, timeout=TIMEOUT)
        resp_users.raise_for_status()
    except requests.RequestException as e:
        assert False, f"Failed to list users for setup: {e}"

    users_data = resp_users.json()
    # Expecting a dictionary or list of users; find a userId
    # Based on typical structure, it might be in users_data['items'] or users_data as list
    # We'll try both and fallback to fail if none found
    user_id = None
    if isinstance(users_data, dict):
        # try keys that might hold list of users
        if "items" in users_data and isinstance(users_data["items"], list) and users_data["items"]:
            user_id = users_data["items"][0].get("userId") or users_data["items"][0].get("id")
        elif "users" in users_data and isinstance(users_data["users"], list) and users_data["users"]:
            user_id = users_data["users"][0].get("userId") or users_data["users"][0].get("id")
    elif isinstance(users_data, list) and users_data:
        user_id = users_data[0].get("userId") or users_data[0].get("id")

    if not user_id:
        # As a fallback, create a new user profile to get userId
        # Since user creation isn't described in API, assume we can get at least profile or create with economy/grant-from-supply endpoint.
        # We'll grant fires to a new user to create it.

        # Generate a unique userId for testing
        import uuid
        user_id = str(uuid.uuid4())

        grant_url = f"{BASE_URL}/api/economy/grant-from-supply"
        grant_payload = {
            "toUserId": user_id,
            "amount": 10,
            "reason": "setup for TC005 test"
        }
        try:
            grant_resp = requests.post(grant_url, headers=HEADERS, json=grant_payload, timeout=TIMEOUT)
            grant_resp.raise_for_status()
        except requests.RequestException as e:
            assert False, f"Setup grant fires failed: {e}"

    # Now make the GET request to /api/economy/history/{userId} with limit and offset query params
    history_url = f"{BASE_URL}/api/economy/history/{user_id}"
    params = {
        "limit": 5,
        "offset": 0
    }
    try:
        resp_history = requests.get(history_url, headers=HEADERS, params=params, timeout=TIMEOUT)
        resp_history.raise_for_status()
    except requests.RequestException as e:
        assert False, f"GET user fires history failed: {e}"

    history_data = resp_history.json()

    # Validate response is list or dict containing list entries
    assert resp_history.status_code == 200
    assert history_data is not None
    # Expect at least a list or dict containing user's fires transactions
    if isinstance(history_data, dict):
        # Expect a key like 'items' or 'transactions' or 'history'
        valid_keys = ['items', 'transactions', 'history']
        found_list = False
        for key in valid_keys:
            if key in history_data and isinstance(history_data[key], list):
                found_list = True
                # Optional: check structure of one item
                if history_data[key]:
                    item = history_data[key][0]
                    assert isinstance(item, dict)
                    # item might have keys like type, amount, timestamp, etc.
                break
        assert found_list, f"Response dict does not contain expected list keys {valid_keys}"
    else:
        # If directly list, check contents
        assert isinstance(history_data, list), "Expected list or dict with list of transactions"
        if history_data:
            item = history_data[0]
            assert isinstance(item, dict)

    # Optionally check that number of returned items <= limit param
    if isinstance(history_data, dict):
        list_items = None
        for k in ['items','transactions','history']:
            if k in history_data and isinstance(history_data[k], list):
                list_items = history_data[k]
                break
        if list_items is not None:
            assert len(list_items) <= params['limit']
    elif isinstance(history_data, list):
        assert len(history_data) <= params['limit']


test_get_user_fires_history_with_pagination()