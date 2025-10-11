import requests
import time

BASE_URL = "https://telegram-game-room-production.up.railway.app"
TIMEOUT = 30


def test_supply_sse_stream():
    url = f"{BASE_URL}/api/economy/supply/stream"
    headers = {
        "Accept": "text/event-stream"
    }
    try:
        with requests.get(url, headers=headers, stream=True, timeout=TIMEOUT) as response:
            assert response.status_code == 200, f"Expected status 200, got {response.status_code}"
            
            message_count = 0
            start_time = time.time()
            event_data = []
            event_id = None
            event_name = None

            for line_bytes in response.iter_lines(decode_unicode=True):
                if line_bytes is None:
                    continue
                line = line_bytes.strip()
                if line == "":  # dispatch event
                    if event_data:
                        data_str = "\n".join(event_data)
                        assert isinstance(data_str, str), "Event data should be a string"
                        assert data_str.strip() != "", "Event data should not be empty"
                        assert event_name is not None, "SSE event should have 'event' attribute"
                        assert event_id is not None, "SSE event should have 'id' attribute"
                        message_count += 1
                        event_data = []
                        event_id = None
                        event_name = None
                        if message_count >= 3 or (time.time() - start_time) > 15:
                            break
                else:
                    if line.startswith("data:"):
                        event_data.append(line[5:].strip())
                    elif line.startswith("id:"):
                        event_id = line[3:].strip()
                    elif line.startswith("event:"):
                        event_name = line[6:].strip()

            assert message_count > 0, "No SSE messages received from the supply stream"
    except requests.exceptions.RequestException as e:
        assert False, f"Request to SSE endpoint failed: {e}"


test_supply_sse_stream()
