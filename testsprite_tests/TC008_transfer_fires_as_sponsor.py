import requests
import uuid

BASE_URL = "https://telegram-game-room-production.up.railway.app"
TIMEOUT = 30

def test_transfer_fires_as_sponsor():
    headers = {
        "Content-Type": "application/json"
    }

    # Step 1: Get list of users to pick fromUserId and toUserId
    try:
        users_resp = requests.get(f"{BASE_URL}/api/economy/users", params={"limit": 10}, timeout=TIMEOUT)
        users_resp.raise_for_status()
        users_data = users_resp.json()
        users_list = users_data.get("users") if isinstance(users_data, dict) else None
        assert users_list and len(users_list) >= 2, "Need at least two users for transfer"
        from_user = users_list[0]
        to_user = users_list[1]
        fromUserId = from_user.get("userId") or from_user.get("id")
        toUserId = to_user.get("userId") or to_user.get("id")
        assert fromUserId and toUserId, "User IDs must be present"
    except Exception:
        # Create dummy users by granting fires to generate user ids
        # We'll create two users by granting fires from supply (admin API)
        # create user1
        create_user1_id = str(uuid.uuid4())
        create_user2_id = str(uuid.uuid4())
        grant_payload1 = {"toUserId": create_user1_id, "amount": 1000, "reason": "test setup user1"}
        grant_payload2 = {"toUserId": create_user2_id, "amount": 1000, "reason": "test setup user2"}
        try:
            grant_resp1 = requests.post(f"{BASE_URL}/api/economy/grant-from-supply", json=grant_payload1, headers=headers, timeout=TIMEOUT)
            grant_resp1.raise_for_status()
            grant_resp2 = requests.post(f"{BASE_URL}/api/economy/grant-from-supply", json=grant_payload2, headers=headers, timeout=TIMEOUT)
            grant_resp2.raise_for_status()
        except Exception as e:
            assert False, f"Failed to create users for testing: {e}"
        fromUserId = create_user1_id
        toUserId = create_user2_id

    # Step 2: Get sponsorKey for a sponsor user - we try to find one from sponsors list
    sponsorKey = None
    try:
        sponsors_resp = requests.get(f"{BASE_URL}/api/economy/sponsors", timeout=TIMEOUT)
        sponsors_resp.raise_for_status()
        sponsors = sponsors_resp.json()
        if isinstance(sponsors, dict) and "sponsors" in sponsors and sponsors["sponsors"]:
            sponsor_entry = sponsors["sponsors"][0]
            sponsorKey = sponsor_entry.get("key")
        elif isinstance(sponsors, list) and len(sponsors) > 0:
            sponsorKey = sponsors[0].get("key")
    except Exception:
        sponsorKey = None

    # If no sponsorKey found, create one (admin action)
    created_sponsor_userId = None
    if not sponsorKey:
        # Create sponsor with sponsorKey "test-sponsor-key"
        created_sponsor_userId = str(uuid.uuid4())
        sponsor_data = {
            "userId": created_sponsor_userId,
            "key": "test-sponsor-key",
            "description": "Test Sponsor",
            "initialAmount": 5000
        }
        try:
            add_sponsor_resp = requests.post(f"{BASE_URL}/api/economy/sponsors/add", json=sponsor_data, headers=headers, timeout=TIMEOUT)
            add_sponsor_resp.raise_for_status()
            sponsorKey = sponsor_data["key"]
        except Exception as e:
            assert False, f"Failed to add test sponsor: {e}"

    # Step 3: Perform the fires transfer as sponsor
    amount = 50
    reason = "Test transfer fires as sponsor"
    transfer_payload = {
        "fromUserId": fromUserId,
        "toUserId": toUserId,
        "amount": amount,
        "reason": reason,
        "sponsorKey": sponsorKey
    }
    try:
        transfer_resp = requests.post(f"{BASE_URL}/api/economy/transfer", json=transfer_payload, headers=headers, timeout=TIMEOUT)
        transfer_resp.raise_for_status()
        transfer_result = transfer_resp.json()
    except requests.HTTPError as http_err:
        assert False, f"HTTP error occurred during transfer: {http_err}"
    except Exception as err:
        assert False, f"Other error occurred during transfer: {err}"

    # Validate response content (assumed success if 200)
    assert transfer_resp.status_code == 200, f"Expected status 200 but got {transfer_resp.status_code}"

    # Optionally check expected keys in response or any fields if defined
    assert transfer_result is not None, "Response JSON must not be empty"

    # Step 4: Validate balances updated by fetching user fires history or balances
    # Fetch fromUser history and toUser history to check transactions
    def get_user_fires(user_id):
        try:
            resp = requests.get(f"{BASE_URL}/api/economy/history/{user_id}", params={"limit": 10}, timeout=TIMEOUT)
            resp.raise_for_status()
            history_data = resp.json()
            return history_data
        except Exception:
            return None

    from_user_history = get_user_fires(fromUserId)
    to_user_history = get_user_fires(toUserId)

    assert from_user_history is not None, "From user fires history should be retrievable"
    assert to_user_history is not None, "To user fires history should be retrievable"

    # Check recent transactions have amount deducted and added accordingly
    from_transactions = from_user_history.get("transactions") if isinstance(from_user_history, dict) else None
    to_transactions = to_user_history.get("transactions") if isinstance(to_user_history, dict) else None

    # At least one recent transaction each expected and should include amount transferred (negative for sender, positive for receiver)
    def check_transfer_in_transactions(transactions, user_id, amount, positive):
        if not transactions:
            return False
        for tx in transactions:
            if tx.get("userId") == user_id and tx.get("amount") == (amount if positive else -amount):
                return True
        return False

    sender_has_deduct = False
    receiver_has_add = False
    if from_transactions:
        # Check for negative amount or reason containing transfer
        for tx in from_transactions:
            if tx.get("amount") == -amount:
                sender_has_deduct = True
                break
    if to_transactions:
        # Check for positive amount or reason containing transfer
        for tx in to_transactions:
            if tx.get("amount") == amount:
                receiver_has_add = True
                break

    assert sender_has_deduct, "From user transactions should reflect amount deducted"
    assert receiver_has_add, "To user transactions should reflect amount added"

    # Cleanup: remove sponsor if created newly
    if created_sponsor_userId:
        try:
            requests.post(f"{BASE_URL}/api/economy/sponsors/remove", json={"userId": created_sponsor_userId}, headers=headers, timeout=TIMEOUT)
        except Exception:
            pass

test_transfer_fires_as_sponsor()