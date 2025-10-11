import requests
import time

BASE_URL = "https://telegram-game-room-production.up.railway.app"
HEADERS = {
    "X-Test-Runner": "testsprite",
    "User-Agent": "python-requests TestSprite"
}
TIMEOUT = 30


def test_list_supply_transactions_with_limit():
    url = f"{BASE_URL}/api/economy/supply/txs"
    params = {"limit": 5}

    try:
        response = requests.get(url, headers=HEADERS, params=params, timeout=TIMEOUT)
        if response.status_code == 429:
            time.sleep(0.2)
            response = requests.get(url, headers=HEADERS, params=params, timeout=TIMEOUT)
        response.raise_for_status()
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    json_data = response.json()
    assert isinstance(json_data, dict) or isinstance(json_data, list), "Response is not a JSON object or list"

    if isinstance(json_data, list):
        transactions = json_data
    else:
        possible_keys = ['items', 'txs', 'transactions', 'data']
        transactions = None
        for key in possible_keys:
            if key in json_data and isinstance(json_data[key], list):
                transactions = json_data[key]
                break
        if transactions is None:
            transactions = []

    assert isinstance(transactions, list), "Transactions is not a list"
    assert len(transactions) <= params["limit"], "Number of transactions exceeds the limit"

    for tx in transactions:
        assert isinstance(tx, dict), "Each transaction should be a dict"


test_list_supply_transactions_with_limit()