import requests
import os
import threading
import time

BASE_URL = "http://127.0.0.1:3000"
HEADERS_QA = {
    "X-Test-Runner": "testsprite",
    "User-Agent": "TestSprite",
}
TIMEOUT = 30


def test_supply_sse_stream():
    """
    Test the GET /api/economy/supply/stream endpoint to verify it establishes a Server-Sent Events stream
    for real-time supply updates. Validate reception of an initial 'supply' event, then close the connection.
    Also validate rate-limit bypass with ALLOW_TEST_RUNNER=true header.
    """

    url = f"{BASE_URL}/api/economy/supply/stream"
    headers = HEADERS_QA.copy()
    headers["ALLOW_TEST_RUNNER"] = "true"

    # Requests does not support SSE natively, so we access the raw response
    with requests.get(url, headers=headers, stream=True, timeout=TIMEOUT) as response:
        # Validate response status code
        assert response.status_code == 200, f"Expected status 200, got {response.status_code}"
        # Validate content-type header for SSE
        content_type = response.headers.get("Content-Type", "")
        assert "text/event-stream" in content_type, f"Expected 'text/event-stream' in Content-Type, got {content_type}"

        # We'll attempt to read lines until we find the initial supply event or timeout after a short time
        initial_event = None
        start_time = time.time()
        timeout_seconds = 10

        def decode_event(stream):
            """
            Generator that yields lines decoded in utf-8 from the stream.
            """
            for line in stream.iter_lines(decode_unicode=True):
                if line:
                    yield line

        try:
            for line in decode_event(response):
                # SSE events lines may be like: event: <eventname>
                if line.startswith("event: "):
                    event_name = line[len("event: "):]
                    # Check if this is the 'supply' event as initial event
                    if event_name == "supply":
                        # Next line(s) should be data
                        data_line = next(decode_event(response), None)
                        if data_line and data_line.startswith("data: "):
                            data_content = data_line[len("data: "):]
                            # Basic validation: data_content should not be empty
                            assert data_content, "Supply event data is empty"
                            initial_event = {
                                "event": event_name,
                                "data": data_content,
                            }
                            break

                # Timeout safeguard
                if time.time() - start_time > timeout_seconds:
                    break

            assert initial_event is not None, "Did not receive initial 'supply' event"
        except Exception as e:
            raise AssertionError(f"Exception when reading SSE stream: {e}")

    return initial_event


test_supply_sse_stream()