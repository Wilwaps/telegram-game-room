import requests
import time
import json

BASE_URL = "https://telegram-game-room-production.up.railway.app"
HEADERS = {
    "X-Test-Runner": "testsprite",
    "User-Agent": "python-requests TestSprite",
    "Accept": "text/event-stream"
}

def test_supply_sse_stream():
    url = f"{BASE_URL}/api/economy/supply/stream"
    try:
        with requests.get(url, headers=HEADERS, stream=True, timeout=30) as response:
            assert response.status_code == 200, f"Expected status 200 but got {response.status_code}"
            event_data_found = False
            start_time = time.time()

            for line in response.iter_lines(decode_unicode=True):
                if line:
                    # Reset timeout countdown with every received line
                    start_time = time.time()
                    if line.startswith("data: "):
                        data_str = line[6:].strip()
                        assert data_str != "", "SSE data line is empty"
                        # Try parsing JSON, else allow plain string
                        try:
                            parsed = json.loads(data_str)
                            # Parsed should be either dict, list or any valid JSON type
                            assert parsed is not None
                        except json.JSONDecodeError:
                            # If not JSON, just ensure string is non-empty already checked
                            pass
                        event_data_found = True
                        break
                # Timeout after 15s waiting for valid event data line
                if time.time() - start_time > 15:
                    break

            assert event_data_found, "No SSE event data received within 15 seconds"

    except requests.exceptions.RequestException as e:
        assert False, f"Request failed: {e}"

test_supply_sse_stream()