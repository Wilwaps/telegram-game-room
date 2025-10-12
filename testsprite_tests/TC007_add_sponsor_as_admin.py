import os
import requests

def test_add_sponsor_as_admin():
    base_url = "http://127.0.0.1:3000"
    endpoint = "/api/economy/sponsors/add"
    url = base_url + endpoint
    timeout = 30

    # Admin headers
    admin_username = "wilcnct"
    admin_code = os.getenv("X_ADMIN_CODE", "default_admin_code_value")
    headers = {
        "X-Test-Runner": "testsprite",
        "User-Agent": "TestSprite",
        "x-admin-username": admin_username,
        "x-admin-code": admin_code,
        "Content-Type": "application/json"
    }

    # Valid sponsor data
    sponsor_data = {
        "userId": "test_sponsor_user_001",
        "key": "testkey123",
        "description": "Test Sponsor",
        "initialAmount": 1000
    }

    # Since no resource ID is provided, create and delete in try-finally is not required,
    # but we clean up by removing sponsor after test.

    # Remove sponsor endpoint for cleanup
    remove_endpoint = "/api/economy/sponsors/remove"
    remove_url = base_url + remove_endpoint

    try:
        # Add sponsor
        response = requests.post(url, json=sponsor_data, headers=headers, timeout=timeout)
        assert response.status_code == 200, f"Expected status 200, got {response.status_code}"
        resp_json = response.json()
        assert resp_json is not None, "Response JSON is empty"
        
        # Optional: Validate response contents if known (schema not specified beyond 200 OK)

    finally:
        # Cleanup: Remove sponsor to avoid test pollution
        remove_payload = {"userId": sponsor_data["userId"]}
        try:
            remove_resp = requests.post(remove_url, json=remove_payload, headers=headers, timeout=timeout)
            assert remove_resp.status_code == 200, f"Cleanup failed, status code {remove_resp.status_code}"
        except Exception:
            pass  # Ignore any cleanup errors to not mask test results

test_add_sponsor_as_admin()