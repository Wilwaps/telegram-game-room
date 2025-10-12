import requests

def test_get_xp_thresholds():
    base_url = "http://127.0.0.1:3000"
    url = f"{base_url}/api/xp/config"
    headers = {
        "X-Test-Runner": "testsprite",
        "User-Agent": "TestSprite"
    }
    timeout = 30
    try:
        response = requests.get(url, headers=headers, timeout=timeout)
        # Assert response status
        assert response.status_code == 200, f"Expected status code 200 but got {response.status_code}"
        # Validate response is JSON and contains thresholds object (if present)
        data = response.json()
        assert isinstance(data, dict), "Response JSON is not a dictionary"
        # It may or may not have 'thresholds' key, but at least ensure the content is valid JSON object
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

test_get_xp_thresholds()