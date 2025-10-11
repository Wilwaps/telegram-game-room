import requests
import time

def test_update_xp_thresholds():
    base_url = "https://telegram-game-room-production.up.railway.app"
    url = f"{base_url}/api/xp/config"
    headers = {
        "X-Test-Runner": "testsprite",
        "User-Agent": "python-requests TestSprite",
        "x-admin-username": "wilcnct",
        "x-admin-code": "658072974",
        "Content-Type": "application/json"
    }

    # Define a valid thresholds object to update
    new_thresholds = {
        "thresholds": {
            "2": 100,
            "3": 300,
            "4": 600,
            "5": 1000
        }
    }

    # First, get the current thresholds to restore them later (cleanup)
    try:
        resp_get = requests.get(url, headers={
            "X-Test-Runner": "testsprite",
            "User-Agent": "python-requests TestSprite"
        }, timeout=30)
        if resp_get.status_code == 429:
            time.sleep(0.3)
            resp_get = requests.get(url, headers={
                "X-Test-Runner": "testsprite",
                "User-Agent": "python-requests TestSprite"
            }, timeout=30)
        resp_get.raise_for_status()
        original_data = resp_get.json()
    except Exception as e:
        original_data = None

    try:
        # Update XP thresholds
        resp_post = requests.post(url, headers=headers, json=new_thresholds, timeout=30)
        if resp_post.status_code == 429:
            time.sleep(0.3)
            resp_post = requests.post(url, headers=headers, json=new_thresholds, timeout=30)
        resp_post.raise_for_status()

        # Validate response: We expect a 200 status code
        assert resp_post.status_code == 200

        # Optionally verify thresholds updated by GET after POST
        resp_verify = requests.get(url, headers={
            "X-Test-Runner": "testsprite",
            "User-Agent": "python-requests TestSprite"
        }, timeout=30)
        if resp_verify.status_code == 429:
            time.sleep(0.3)
            resp_verify = requests.get(url, headers={
                "X-Test-Runner": "testsprite",
                "User-Agent": "python-requests TestSprite"
            }, timeout=30)
        resp_verify.raise_for_status()
        verify_json = resp_verify.json()

        assert isinstance(verify_json, dict), "Verify response is not a dict"
        assert "thresholds" in verify_json, "Thresholds key missing in verify response"
        
        # Check each numeric threshold key's value
        for key, val in new_thresholds["thresholds"].items():
            assert key in verify_json["thresholds"], f"Threshold key '{key}' missing in verify response"
            assert int(verify_json["thresholds"][key]) == int(val), f"Threshold value for '{key}' not updated as expected"

    finally:
        # Restore original thresholds to not affect environment
        if original_data and "thresholds" in original_data:
            try:
                requests.post(url, headers=headers, json={"thresholds": original_data["thresholds"]}, timeout=30)
            except Exception:
                pass

test_update_xp_thresholds()
