import requests

def test_get_xp_thresholds():
    base_url = "https://telegram-game-room-production.up.railway.app"
    endpoint = f"{base_url}/api/xp/config"
    headers = {
        "Accept": "application/json"
    }
    timeout = 30

    try:
        response = requests.get(endpoint, headers=headers, timeout=timeout)
        response.raise_for_status()
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    try:
        data = response.json()
    except ValueError:
        assert False, "Response content is not valid JSON"

    assert response.status_code == 200, f"Expected status code 200 but got {response.status_code}"
    assert isinstance(data, dict), "Response JSON is not a dictionary"
    # Optional: validate 'thresholds' key existence, if applicable
    assert "thresholds" in data, "'thresholds' key not found in response JSON"

test_get_xp_thresholds()