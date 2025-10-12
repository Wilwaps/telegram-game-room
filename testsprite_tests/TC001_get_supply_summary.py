import requests

def test_get_supply_summary():
    base_url = "http://127.0.0.1:3000"
    url = f"{base_url}/api/economy/supply"
    headers = {
        "X-Test-Runner": "testsprite",
        "User-Agent": "TestSprite"
    }
    try:
        response = requests.get(url, headers=headers, timeout=30)
        assert response.status_code == 200, f"Expected status 200 but got {response.status_code}"
        try:
            _ = response.json()
        except Exception:
            assert False, "Response is not valid JSON"
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

test_get_supply_summary()