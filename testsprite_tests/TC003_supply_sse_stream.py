import requests
import time

BASE_URL = "https://telegram-game-room-production.up.railway.app"
ENDPOINT = "/api/economy/supply/stream"
TIMEOUT = 30
HEADERS = {
    "Accept": "text/event-stream"
}

def test_supply_sse_stream():
    url = BASE_URL + ENDPOINT

    try:
        response = requests.get(url, headers=HEADERS, stream=True, timeout=TIMEOUT)
        assert response.status_code == 200, f"Unexpected status code: {response.status_code}"
        ctype = response.headers.get("Content-Type", "")
        assert ctype.startswith("text/event-stream"), f"Content-Type is not SSE: {ctype}"

        events_collected = []
        start_time = time.time()
        for line in response.iter_lines(decode_unicode=True):
            if line is None:
                continue
            if line.startswith('data: '):
                data = line[6:].strip()
                events_collected.append(data)
            if len(events_collected) >= 3 or (time.time() - start_time) > 15:
                break

        assert len(events_collected) > 0, "No SSE events received from stream"
        for data in events_collected:
            assert data is not None and str(data).strip() != "", "Received empty event data"

    except requests.exceptions.RequestException as e:
        assert False, f"Request failed: {e}"
    except Exception as ex:
        assert False, f"Unexpected error occurred: {ex}"
    finally:
        try:
            if response is not None:
                response.close()
        except Exception:
            pass

test_supply_sse_stream()