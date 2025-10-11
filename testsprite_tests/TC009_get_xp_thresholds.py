import requests

def test_get_xp_thresholds():
    base_url = "https://telegram-game-room-production.up.railway.app"
    endpoint = "/api/xp/config"
    url = base_url + endpoint
    headers = {
        "Accept": "application/json"
    }

    try:
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    # Assert status code is 200
    assert response.status_code == 200, f"Expected status code 200, got {response.status_code}"

    # Assert response content type is JSON
    content_type = response.headers.get("Content-Type", "")
    assert "application/json" in content_type, f"Expected JSON response, got Content-Type: {content_type}"

    # Assert response body is a JSON object with "thresholds" key
    json_data = response.json()
    assert isinstance(json_data, dict), f"Response JSON is not a dictionary: {json_data}"
    assert "thresholds" in json_data, f"Response JSON does not contain 'thresholds' key: {json_data}"

test_get_xp_thresholds()
