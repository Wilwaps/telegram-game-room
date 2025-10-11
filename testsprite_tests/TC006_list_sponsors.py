import requests

BASE_URL = "https://telegram-game-room-production.up.railway.app"
TIMEOUT = 30

def test_list_sponsors():
    url = f"{BASE_URL}/api/economy/sponsors"
    headers = {
        "Accept": "application/json"
    }
    try:
        response = requests.get(url, headers=headers, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Request to list sponsors failed: {e}"

    assert response.status_code == 200, f"Expected status code 200, got {response.status_code}"
    try:
        sponsors_resp = response.json()
    except ValueError:
        assert False, "Response is not valid JSON"

    assert isinstance(sponsors_resp, dict), f"Expected response to be a dict, got {type(sponsors_resp)}"

test_list_sponsors()