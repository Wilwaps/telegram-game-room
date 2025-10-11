import requests

BASE_URL = "https://telegram-game-room-production.up.railway.app"
HEADERS = {
    "X-Test-Runner": "testsprite",
    "User-Agent": "python-requests TestSprite"
}


def test_get_xp_thresholds():
    url = f"{BASE_URL}/api/xp/config"
    try:
        response = requests.get(url, headers=HEADERS, timeout=30)
        response.raise_for_status()
    except requests.RequestException as e:
        assert False, f"Request to {url} failed: {e}"

    assert response.status_code == 200
    try:
        data = response.json()
    except ValueError:
        assert False, "Response is not valid JSON"

    # According to PRD, GET /api/xp/config returns the current XP thresholds config as JSON object
    # Validate that the response is a dict and contains 'thresholds' key or is a dict with threshold keys
    # The schema was "properties": { "thresholds": { "type": "object" } } and optional
    assert isinstance(data, dict), "Response JSON is not an object"

    # It's acceptable if 'thresholds' key exists or if the dict itself represents thresholds
    assert "thresholds" in data or data, "Response does not contain 'thresholds' or is empty"

    if "thresholds" in data:
        assert isinstance(data["thresholds"], dict), "'thresholds' is not an object"

test_get_xp_thresholds()