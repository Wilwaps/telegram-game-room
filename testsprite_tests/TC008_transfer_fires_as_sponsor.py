import os
import requests
import uuid

BASE_URL = "http://127.0.0.1:3000"
TIMEOUT = 30
HEADERS_QA = {
    "X-Test-Runner": "testsprite",
    "User-Agent": "TestSprite"
}
HEADERS_ADMIN = {
    "X-Test-Runner": "testsprite",
    "User-Agent": "TestSprite",
    "x-admin-username": "wilcnct",
    "x-admin-code": os.environ.get("X_ADMIN_CODE", "default_admin_code")
}

def test_transfer_fires_as_sponsor():
    # Helper to create user by granting from supply (admin operation)
    def create_user_with_fires(amount=100):
        user_id = str(uuid.uuid4())
        payload = {
            "toUserId": user_id,
            "amount": amount,
            "reason": "Setup user for test"
        }
        resp = requests.post(f"{BASE_URL}/api/economy/grant-from-supply", headers=HEADERS_ADMIN, json=payload, timeout=TIMEOUT)
        assert resp.status_code == 200, f"Failed to create user {user_id} with fires"
        return user_id

    # Helper to add sponsor for user (admin operation)
    def add_sponsor(user_id):
        sponsor_key = f"sponsor-key-{str(uuid.uuid4())[:8]}"
        payload = {
            "userId": user_id,
            "key": sponsor_key,
            "description": "Test sponsor",
            "initialAmount": 1000
        }
        resp = requests.post(f"{BASE_URL}/api/economy/sponsors/add", headers=HEADERS_ADMIN, json=payload, timeout=TIMEOUT)
        assert resp.status_code == 200, "Failed to add sponsor"
        return sponsor_key

    # Helper to remove sponsor (cleanup)
    def remove_sponsor(user_id):
        payload = {"userId": user_id}
        resp = requests.post(f"{BASE_URL}/api/economy/sponsors/remove", headers=HEADERS_ADMIN, json=payload, timeout=TIMEOUT)
        assert resp.status_code == 200, "Failed to remove sponsor"

    from_user_id = create_user_with_fires()
    to_user_id = create_user_with_fires()
    sponsor_key = None

    # Add sponsor key for from_user
    try:
        sponsor_key = add_sponsor(from_user_id)

        transfer_payload = {
            "fromUserId": from_user_id,
            "toUserId": to_user_id,
            "amount": 50,
            "reason": "Test fires transfer",
            "sponsorKey": sponsor_key
        }
        resp = requests.post(f"{BASE_URL}/api/economy/transfer", headers=HEADERS_QA, json=transfer_payload, timeout=TIMEOUT)
        assert resp.status_code == 200, f"Transfer failed with status {resp.status_code}: {resp.text}"
        resp_json = resp.json()
        assert isinstance(resp_json, dict), "Response is not a JSON object"
        # Check for keys usually present in success or at least no error field:
        assert "success" not in resp_json or resp_json.get("success") is True, "Transfer response did not indicate success"
    finally:
        # Cleanup sponsor
        if sponsor_key:
            remove_sponsor(from_user_id)

test_transfer_fires_as_sponsor()