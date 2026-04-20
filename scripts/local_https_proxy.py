from __future__ import annotations

import http.client
import ssl
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


BACKEND_HOST = "127.0.0.1"
BACKEND_PORT = 8010


class ProxyHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def _forward(self) -> None:
        body = b""
        length = self.headers.get("Content-Length")
        if length is not None:
            body = self.rfile.read(int(length))

        connection = http.client.HTTPConnection(BACKEND_HOST, BACKEND_PORT, timeout=30)
        headers = {key: value for key, value in self.headers.items() if key.lower() not in {"host", "connection"}}
        headers["Host"] = f"{BACKEND_HOST}:{BACKEND_PORT}"
        headers["X-Forwarded-Proto"] = "https"
        headers["X-Forwarded-For"] = self.client_address[0]

        try:
            connection.request(self.command, self.path, body=body, headers=headers)
            response = connection.getresponse()
            payload = response.read()

            self.send_response(response.status, response.reason)
            for key, value in response.getheaders():
                lowered = key.lower()
                if lowered in {"transfer-encoding", "connection", "keep-alive"}:
                    continue
                self.send_header(key, value)
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            if payload:
                self.wfile.write(payload)
        finally:
            connection.close()

    def do_GET(self) -> None:  # noqa: N802
        self._forward()

    def do_POST(self) -> None:  # noqa: N802
        self._forward()

    def log_message(self, fmt: str, *args: object) -> None:
        sys.stdout.write(f"{self.address_string()} - - [{self.log_date_time_string()}] {fmt % args}\n")


def main() -> None:
    if len(sys.argv) != 4:
        raise SystemExit("usage: local_https_proxy.py <port> <cert.pem> <key.pem>")

    port = int(sys.argv[1])
    cert_path = sys.argv[2]
    key_path = sys.argv[3]

    server = ThreadingHTTPServer(("127.0.0.1", port), ProxyHandler)
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(certfile=cert_path, keyfile=key_path)
    server.socket = context.wrap_socket(server.socket, server_side=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
