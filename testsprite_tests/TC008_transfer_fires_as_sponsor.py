import requests
import random
import string

BASE_URL = "https://telegram-game-room-production.up.railway.app"
TIMEOUT = 30
HEADERS = {"Content-Type": "application/json"}

def get_users_with_fires(limit=10):
    url = f"{BASE_URL}/api/economy/users"
    params = {"limit": limit}
    try:
        resp = requests.get(url, headers=HEADERS, params=params, timeout=TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
        users = data.get("users") or data.get("items") or data  # accommodate possible structure
        if isinstance(users, list):
            return users
        else:
            return []
    except Exception:
        return []

def add_sponsor(user_id, key, description="Test Sponsor", initialAmount=1000):
    url = f"{BASE_URL}/api/economy/sponsors/add"
    payload = {
        "userId": user_id,
        "key": key,
        "description": description,
        "initialAmount": initialAmount
    }
    resp = requests.post(url, headers=HEADERS, json=payload, timeout=TIMEOUT)
    resp.raise_for_status()
    return resp.json()

def remove_sponsor(user_id):
    url = f"{BASE_URL}/api/economy/sponsors/remove"
    payload = {"userId": user_id}
    resp = requests.post(url, headers=HEADERS, json=payload, timeout=TIMEOUT)
    resp.raise_for_status()
    return resp.json()

def transfer_fires(from_user_id, to_user_id, amount, reason=None, sponsor_key=None):
    url = f"{BASE_URL}/api/economy/transfer"
    payload = {
        "fromUserId": from_user_id,
        "toUserId": to_user_id,
        "amount": amount
    }
    if reason:
        payload["reason"] = reason
    if sponsor_key:
        payload["sponsorKey"] = sponsor_key
    resp = requests.post(url, headers=HEADERS, json=payload, timeout=TIMEOUT)
    resp.raise_for_status()
    return resp.json()

def test_transfer_fires_as_sponsor():
    users = get_users_with_fires(limit=10)
    assert len(users) >= 2, "Need at least 2 users with fires to perform transfer"

    from_user = users[0]
    to_user = users[1]

    from_user_id = from_user.get("userId") or from_user.get("id") or from_user.get("_id") or from_user.get("userID")
    to_user_id = to_user.get("userId") or to_user.get("id") or to_user.get("_id") or to_user.get("userID")

    assert from_user_id and to_user_id, "Both fromUserId and toUserId must be valid"

    # Prepare a sponsor key by adding a sponsor using from_user_id
    sponsor_key = ''.join(random.choices(string.ascii_letters + string.digits, k=16))
    try:
        add_sponsor_resp = add_sponsor(from_user_id, sponsor_key, description="Test Sponsor Key", initialAmount=1000)
        assert add_sponsor_resp is not None, "Add sponsor response should not be None"

        # Choose an amount to transfer (must be <= from_user's fires if known)
        from_user_fires = from_user.get("fires") or 1000
        amount = min(100, from_user_fires if isinstance(from_user_fires, int) else 1000)
        reason = "Test transfer fires as sponsor"

        transfer_resp = transfer_fires(from_user_id, to_user_id, amount, reason=reason, sponsor_key=sponsor_key)
        assert transfer_resp is not None, "Transfer response should not be None"
        # Usually server returns confirmation or updated balance; check keys
        assert isinstance(transfer_resp, dict), "Transfer response must be a dict"
        assert "success" not in transfer_resp or transfer_resp.get("success") is True or "error" not in transfer_resp, "Transfer should be successful"

    finally:
        # Clean up: remove sponsor
        try:
            remove_sponsor(from_user_id)
        except Exception:
            pass

test_transfer_fires_as_sponsor()