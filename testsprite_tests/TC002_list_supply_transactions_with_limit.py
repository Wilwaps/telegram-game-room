import requests

BASE_URL = "https://telegram-game-room-production.up.railway.app"
TIMEOUT = 30

def test_list_supply_transactions_with_limit():
    url = f"{BASE_URL}/api/economy/supply/txs"
    params = {"limit": 10}
    headers = {
        "Accept": "application/json"
    }
    try:
        response = requests.get(url, params=params, headers=headers, timeout=TIMEOUT)
        response.raise_for_status()
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    try:
        data = response.json()
    except ValueError:
        assert False, "Response is not valid JSON"

    assert isinstance(data, list), "Response JSON is not a list"
    assert len(data) <= 10, "Returned more transactions than the limit"

    for tx in data:
        assert isinstance(tx, dict), "Each transaction should be a dictionary"
        # Basic expected keys check (may vary depending on actual schema)
        expected_keys = ["id", "type", "amount", "timestamp"]
        for key in expected_keys:
            assert key in tx, f"Transaction missing expected key: {key}"

test_list_supply_transactions_with_limit()