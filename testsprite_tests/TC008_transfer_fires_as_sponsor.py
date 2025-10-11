import requests
import time
import random
import string

BASE_URL = "https://telegram-game-room-production.up.railway.app"
HEADERS = {
    "X-Test-Runner": "testsprite",
    "User-Agent": "Python-requests TestSprite"
}
ADMIN_HEADERS = {
    **HEADERS,
    "x-admin-username": "wilcnct",
    "x-admin-code": "658072974"
}
TIMEOUT = 30


def random_user_id():
    return "testuser_" + "".join(random.choices(string.ascii_lowercase + string.digits, k=8))


def wait_if_429(response):
    if response.status_code == 429:
        time.sleep(random.uniform(0.15, 0.3))
        return True
    return False


def get_users(min_count=2):
    users = []
    cursor = None
    retries = 0
    while len(users) < min_count and retries < 5:
        params = {"limit": 50}
        if cursor:
            params["cursor"] = cursor
        resp = requests.get(
            f"{BASE_URL}/api/economy/users",
            headers=HEADERS,
            params=params,
            timeout=TIMEOUT,
        )
        if wait_if_429(resp):
            retries += 1
            continue
        resp.raise_for_status()
        data = resp.json()
        assert data.get("success") is True
        items = data.get("items")
        assert isinstance(items, list)
        for u in items:
            assert "userId" in u and "userName" in u and "fires" in u
            assert isinstance(u["fires"], int)
        users.extend(items)
        cursor = data.get("cursor")
        if not cursor:
            break
    return users[:min_count]


def add_sponsor(user_id, initial_amount=1000, description="Test Sponsor"):
    payload = {
        "userId": user_id,
        "description": description,
        "initialAmount": initial_amount,
    }
    retries = 0
    while retries < 5:
        resp = requests.post(
            f"{BASE_URL}/api/economy/sponsors/add",
            headers=ADMIN_HEADERS,
            json=payload,
            timeout=TIMEOUT,
        )
        if wait_if_429(resp):
            retries += 1
            continue
        resp.raise_for_status()
        data = resp.json()
        assert data.get("success") is True
        sponsors = data.get("sponsors", [])
        assert any(s.get("userId") == user_id for s in sponsors)
        return
    raise Exception("Failed to add sponsor after retries")


def set_sponsor_key(user_id, key):
    payload = {"userId": user_id, "key": key}
    retries = 0
    while retries < 5:
        resp = requests.post(
            f"{BASE_URL}/api/economy/sponsors/set-key",
            headers=ADMIN_HEADERS,
            json=payload,
            timeout=TIMEOUT,
        )
        if wait_if_429(resp):
            retries += 1
            continue
        resp.raise_for_status()
        data = resp.json()
        assert data.get("success") is True
        return
    raise Exception("Failed to set sponsor key after retries")


def remove_sponsor(user_id):
    payload = {"userId": user_id}
    retries = 0
    while retries < 5:
        resp = requests.post(
            f"{BASE_URL}/api/economy/sponsors/remove",
            headers=ADMIN_HEADERS,
            json=payload,
            timeout=TIMEOUT,
        )
        if wait_if_429(resp):
            retries += 1
            continue
        if resp.status_code == 200:
            data = resp.json()
            assert data.get("success") is True
            return
        break


def grant_fires(to_user_id, amount=1000, reason="Test grant from supply"):
    payload = {"toUserId": to_user_id, "amount": amount, "reason": reason}
    retries = 0
    while retries < 5:
        resp = requests.post(
            f"{BASE_URL}/api/economy/grant-from-supply",
            headers=ADMIN_HEADERS,
            json=payload,
            timeout=TIMEOUT,
        )
        if wait_if_429(resp):
            retries += 1
            continue
        resp.raise_for_status()
        data = resp.json()
        assert data.get("success") is True
        return
    raise Exception("Failed to grant fires after retries")


def test_transfer_fires_as_sponsor():
    # Step 1: Ensure at least 2 users exist with userId and fires
    users = get_users(min_count=2)
    created_users = []
    if len(users) < 2:
        while len(users) < 2:
            new_user_id = random_user_id()
            grant_fires(new_user_id, amount=500)
            created_users.append(new_user_id)
            users.append({"userId": new_user_id, "userName": "", "fires": 500})

    # Use first two userIds
    from_user_id = users[0]["userId"]
    to_user_id = users[1]["userId"]

    # Step 2: Ensure fromUserId is a sponsor with a sponsorKey
    retries = 0
    sponsor_key = None
    sponsors_resp = None
    while retries < 5:
        sponsors_resp = requests.get(
            f"{BASE_URL}/api/economy/sponsors", headers=HEADERS, timeout=TIMEOUT
        )
        if wait_if_429(sponsors_resp):
            retries += 1
            continue
        sponsors_resp.raise_for_status()
        break
    data = sponsors_resp.json()
    assert data.get("success") is True
    sponsors = data.get("sponsors", []) if "sponsors" in data else []
    sponsor_user_ids = [s.get("userId") for s in sponsors if "userId" in s]

    need_cleanup = False
    added_sponsor_user_id = None

    if from_user_id not in sponsor_user_ids:
        # Add sponsor
        add_sponsor(from_user_id)
        need_cleanup = True
        added_sponsor_user_id = from_user_id

    # Set sponsor key for from_user_id
    sponsor_key = "key_" + "".join(random.choices(string.ascii_letters + string.digits, k=12))
    set_sponsor_key(from_user_id, sponsor_key)

    try:
        # Step 3: Perform transfer POST /api/economy/transfer
        transfer_amount = 10
        transfer_payload = {
            "fromUserId": from_user_id,
            "toUserId": to_user_id,
            "amount": transfer_amount,
            "reason": "Test transfer_fires_as_sponsor",
            "sponsorKey": sponsor_key,
        }
        retries = 0
        while retries < 5:
            resp = requests.post(
                f"{BASE_URL}/api/economy/transfer",
                json=transfer_payload,
                headers=HEADERS,
                timeout=TIMEOUT,
            )
            if wait_if_429(resp):
                retries += 1
                continue
            break
        resp.raise_for_status()
        resp_data = resp.json()
        assert resp_data.get("success") is True

    finally:
        # Cleanup: remove sponsor if we added it and remove sponsor key
        try:
            if need_cleanup:
                remove_sponsor(added_sponsor_user_id)
            # Remove sponsor key for from_user_id (best effort)
            requests.post(
                f"{BASE_URL}/api/economy/sponsors/remove-key",
                headers=ADMIN_HEADERS,
                json={"userId": from_user_id},
                timeout=TIMEOUT,
            )
        except Exception:
            # ignore cleanup exceptions
            pass


test_transfer_fires_as_sponsor()