import requests
import uuid

BASE_URL = "https://telegram-game-room-production.up.railway.app"
TIMEOUT = 30
ADMIN_AUTH_TOKEN = "Bearer admin-token-placeholder"  # Replace with valid admin token

def test_add_sponsor_as_admin():
    url_add = f"{BASE_URL}/api/economy/sponsors/add"
    url_remove = f"{BASE_URL}/api/economy/sponsors/remove"

    # Generate unique sponsor userId and key for test
    sponsor_user_id = f"test-sponsor-{uuid.uuid4()}"
    sponsor_key = f"key-{uuid.uuid4()}"
    sponsor_description = "Automated test sponsor"
    sponsor_initial_amount = 1000

    headers = {
        "Authorization": ADMIN_AUTH_TOKEN,
        "Content-Type": "application/json"
    }

    payload = {
        "userId": sponsor_user_id,
        "key": sponsor_key,
        "description": sponsor_description,
        "initialAmount": sponsor_initial_amount
    }

    try:
        response = requests.post(url_add, json=payload, headers=headers, timeout=TIMEOUT)
        assert response.status_code == 200, f"Expected status 200, got {response.status_code}"
        json_resp = response.json()
        # Validate response content as needed (assuming it returns the created sponsor info or success flag)
        assert json_resp is not None, "Response JSON is None"
        # Optionally check keys in response, example if returned
        # Could check if 'userId' or 'key' are in response JSON if API defines this
    except (requests.RequestException, AssertionError) as e:
        raise AssertionError(f"Failed to add sponsor as admin: {e}")
    finally:
        # Clean up: remove the created sponsor to avoid side effects
        try:
            remove_payload = {"userId": sponsor_user_id}
            remove_response = requests.post(url_remove, json=remove_payload, headers=headers, timeout=TIMEOUT)
            assert remove_response.status_code == 200, f"Failed to remove sponsor, status {remove_response.status_code}"
        except Exception as cleanup_err:
            # Log cleanup failure but do not override test failure if exists
            print(f"Cleanup error removing sponsor {sponsor_user_id}: {cleanup_err}")

test_add_sponsor_as_admin()