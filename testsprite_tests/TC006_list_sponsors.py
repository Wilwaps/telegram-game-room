import requests

BASE_URL = "https://telegram-game-room-production.up.railway.app"
HEADERS = {
    "X-Test-Runner": "testsprite",
    "User-Agent": "python-requests TestSprite"
}

def test_list_sponsors():
    url = f"{BASE_URL}/api/economy/sponsors"
    try:
        response = requests.get(url, headers=HEADERS, timeout=30)
        assert response.status_code == 200, f"Expected status 200 but got {response.status_code}"
        data = response.json()
        assert isinstance(data, dict), "Response is not a JSON object"
        # The test plan does not specify fields to validate inside sponsors list,
        # so just check if data contains keys and sponsors list if present is a list
        # The PRD shows the GET sponsors return {success, sponsors: [...]}
        # But only add/remove specify that, get sponsors returns 200 with unspecified structure,
        # so just validate 'success' and optionally 'sponsors' as list if present.
        assert "success" in data, "'success' key not in response"
        # It's not explicitly specified that /api/economy/sponsors returns sponsors list in key 'sponsors',
        # typically list should be returned but schema not shown, so if 'sponsors' is in response validate type
        if "sponsors" in data:
            assert isinstance(data["sponsors"], list), "'sponsors' is not a list"
    except requests.exceptions.RequestException as e:
        assert False, f"Request failed: {e}"

test_list_sponsors()