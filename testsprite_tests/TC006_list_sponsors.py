import requests

def test_list_sponsors():
    base_url = "https://telegram-game-room-production.up.railway.app"
    url = f"{base_url}/api/economy/sponsors"
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        sponsors_list = response.json()
        assert isinstance(sponsors_list, (list, dict)), "Response should be a list or dictionary"
    except requests.exceptions.RequestException as e:
        assert False, f"Request failed: {e}"

test_list_sponsors()