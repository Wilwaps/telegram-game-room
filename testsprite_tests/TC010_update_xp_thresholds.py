import requests

BASE_URL = "https://telegram-game-room-production.up.railway.app"
TIMEOUT = 30

def test_update_xp_thresholds():
    url = f"{BASE_URL}/api/xp/config"
    headers = {
        "Content-Type": "application/json"
    }
    payload = {
        "thresholds": {
            "level1": 100,
            "level2": 250,
            "level3": 500,
            "level4": 1000
        }
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
        assert response.status_code == 200, f"Expected status code 200 but got {response.status_code}"
        json_response = response.json()
        assert isinstance(json_response, dict), "Response is not a JSON object"
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

test_update_xp_thresholds()