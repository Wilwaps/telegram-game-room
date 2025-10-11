import requests

def test_list_supply_transactions_with_limit():
    base_url = "https://telegram-game-room-production.up.railway.app"
    endpoint = f"{base_url}/api/economy/supply/txs"
    params = {"limit": 10}
    headers = {
        "Accept": "application/json"
    }
    try:
        response = requests.get(endpoint, headers=headers, params=params, timeout=30)
        response.raise_for_status()
    except requests.RequestException as e:
        assert False, f"HTTP request failed: {e}"

    assert response.status_code == 200, f"Expected status code 200 but got {response.status_code}"
    try:
        data = response.json()
    except Exception:
        assert False, "Response is not a valid JSON"

    assert isinstance(data, dict), "Response JSON is not an object"
    
test_list_supply_transactions_with_limit()