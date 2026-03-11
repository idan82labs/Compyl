"""
Worker HTTP server.

Minimal HTTP server for the AI worker.
Accepts job requests from the API server per the provisional contract.
"""

from __future__ import annotations

import json
from http.server import HTTPServer, BaseHTTPRequestHandler
from dataclasses import asdict

from .health import health_check
from .jobs import JobRequest, handle_job


class WorkerHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        if self.path == "/health":
            self._json_response(200, health_check())
        else:
            self._json_response(404, {"error": "not found"})

    def do_POST(self) -> None:
        if self.path == "/jobs":
            content_length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(content_length))

            request = JobRequest(
                job_id=body["job_id"],
                job_type=body["job_type"],
                payload=body["payload"],
                idempotency_key=body["idempotency_key"],
                created_at=body["created_at"],
            )

            response = handle_job(request)
            result = asdict(response)
            # Remove None error field for clean JSON
            if result["error"] is None:
                del result["error"]

            self._json_response(200, result)
        else:
            self._json_response(404, {"error": "not found"})

    def _json_response(self, status: int, data: dict) -> None:
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def log_message(self, format: str, *args: object) -> None:
        # Suppress default logging for clean test output
        pass


def run_server(host: str = "0.0.0.0", port: int = 8001) -> None:
    server = HTTPServer((host, port), WorkerHandler)
    print(f"Worker AI server listening on {host}:{port}")
    server.serve_forever()


if __name__ == "__main__":
    run_server()
