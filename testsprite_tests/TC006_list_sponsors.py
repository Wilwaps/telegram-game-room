import os
import requests

def test_list_sponsors():
    base_url = "http://127.0.0.1:3000"
    url = f"{base_url}/api/economy/sponsors"
    headers = {
        "X-Test-Runner": "testsprite",
        "User-Agent": "TestSprite"
    }

    try:
        response = requests.get(url, headers=headers, timeout=30)
        assert response.status_code == 200, f"Expected status code 200 but got {response.status_code}"
        sponsors_response = response.json()
        assert isinstance(sponsors_response, dict), "Response JSON should be an object"
    except requests.RequestException as e:
        assert False, f"HTTP request failed: {e}"

test_list_sponsors()
