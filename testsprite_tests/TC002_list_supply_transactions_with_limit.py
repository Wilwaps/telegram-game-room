import requests

def test_list_supply_transactions_with_limit():
    base_url = "http://127.0.0.1:3000"
    endpoint = "/api/economy/supply/txs"
    headers = {
        "X-Test-Runner": "testsprite",
        "User-Agent": "TestSprite"
    }
    params = {
        "limit": 5
    }
    timeout = 30

    try:
        response = requests.get(
            url=f"{base_url}{endpoint}",
            headers=headers,
            params=params,
            timeout=timeout
        )
        # Assert status code 200
        assert response.status_code == 200, f"Unexpected status code: {response.status_code}"
        
        # Assert response is JSON and a dict
        json_data = response.json()
        assert isinstance(json_data, dict), f"Response is not a dict but {type(json_data)}"
        
    except requests.Timeout:
        assert False, "Request timed out"
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

test_list_supply_transactions_with_limit()