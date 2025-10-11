import requests
import uuid

BASE_URL = "https://telegram-game-room-production.up.railway.app"
TIMEOUT = 30

# Dummy admin auth token for authorization header (replace with real token if needed)
ADMIN_AUTH_TOKEN = "Bearer YOUR_ADMIN_JWT_TOKEN"


def test_add_sponsor_as_admin():
    headers = {
        "Content-Type": "application/json",
        "Authorization": ADMIN_AUTH_TOKEN
    }
    sponsor_user_id = f"test-sponsor-{uuid.uuid4()}"
    sponsor_key = f"key-{uuid.uuid4()}"
    sponsor_description = "Automated test sponsor"
    sponsor_initial_amount = 1000

    sponsor_payload = {
        "userId": sponsor_user_id,
        "key": sponsor_key,
        "description": sponsor_description,
        "initialAmount": sponsor_initial_amount
    }

    # Add sponsor
    add_url = f"{BASE_URL}/api/economy/sponsors/add"
    remove_url = f"{BASE_URL}/api/economy/sponsors/remove"

    try:
        response = requests.post(add_url, json=sponsor_payload, headers=headers, timeout=TIMEOUT)
        assert response.status_code == 200, f"Expected status 200, got {response.status_code}"
        json_response = response.json()
        # Assuming successful addition returns the sponsor details or confirmation (not specified)
        assert isinstance(json_response, dict), "Response is not a JSON object"

        # Optionally verify sponsor present in sponsors list
        list_url = f"{BASE_URL}/api/economy/sponsors"
        list_response = requests.get(list_url, headers=headers, timeout=TIMEOUT)
        assert list_response.status_code == 200, f"Expected status 200 for sponsors list, got {list_response.status_code}"
        sponsors = list_response.json()
        assert any(s.get("userId") == sponsor_user_id for s in sponsors), "Sponsor not found in sponsors list after addition"

    finally:
        # Cleanup: remove the sponsor after test
        remove_payload = {"userId": sponsor_user_id}
        remove_response = requests.post(remove_url, json=remove_payload, headers=headers, timeout=TIMEOUT)
        assert remove_response.status_code == 200, f"Cleanup remove sponsor failed with status {remove_response.status_code}"


test_add_sponsor_as_admin()
