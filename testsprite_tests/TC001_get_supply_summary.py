import requests

BASE_URL = "https://telegram-game-room-production.up.railway.app"
TIMEOUT = 30

def test_get_supply_summary():
    url = f"{BASE_URL}/api/economy/supply"
    headers = {
        "Accept": "application/json"
    }
    try:
        response = requests.get(url, headers=headers, timeout=TIMEOUT)
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        assert False, f"Request failed: {e}"

    assert response.status_code == 200, f"Expected status code 200, got {response.status_code}"
    try:
        json_data = response.json()
    except ValueError:
        assert False, "Response is not valid JSON"
    assert isinstance(json_data, dict), "Response JSON is not an object"
    # Additional keys/values validation could be here if schema provided

test_get_supply_summary()