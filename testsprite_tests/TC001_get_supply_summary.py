import requests

def test_get_supply_summary():
    base_url = "https://telegram-game-room-production.up.railway.app"
    endpoint = "/api/economy/supply"
    url = base_url + endpoint
    headers = {
        "Accept": "application/json"
    }
    try:
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        assert False, f"Request failed: {e}"

    # Assert status code 200
    assert response.status_code == 200, f"Expected status code 200, got {response.status_code}"

    # Try to parse JSON and verify it's a dict/object
    try:
        data = response.json()
    except ValueError:
        assert False, "Response is not valid JSON"

    assert isinstance(data, dict), "Response JSON is not an object/dict"

test_get_supply_summary()