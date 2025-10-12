import os
import requests

def test_update_xp_thresholds():
    base_url = "http://127.0.0.1:3000"
    url = f"{base_url}/api/xp/config"
    headers = {
        "X-Test-Runner": "testsprite",
        "User-Agent": "TestSprite",
        "x-admin-username": "wilcnct",
        "x-admin-code": os.getenv("X_ADMIN_CODE", "default_admin_code_value")
    }

    payload = {
        "thresholds": {
            "level1": 100,
            "level2": 200,
            "level3": 300
        }
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        response.raise_for_status()
        assert response.status_code == 200
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

test_update_xp_thresholds()