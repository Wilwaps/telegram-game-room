import requests

def test_get_supply_summary():
    base_url = "https://telegram-game-room-production.up.railway.app"
    url = f"{base_url}/api/economy/supply"
    headers = {
        "X-Test-Runner": "testsprite",
        "User-Agent": "python-requests TestSprite"
    }
    try:
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()
        # Just check status code and content presence since schema not specified
        assert response.status_code == 200
        json_data = response.json()
        assert isinstance(json_data, dict)
        assert len(json_data) > 0
    except requests.exceptions.RequestException as e:
        assert False, f"Request failed: {e}"

test_get_supply_summary()