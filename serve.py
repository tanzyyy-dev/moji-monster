#!/usr/bin/env python3
"""Local development server with LAN access for device testing."""

import http.server
import socket
import socketserver
import sys


def lan_ip():
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("8.8.8.8", 80))
        return sock.getsockname()[0]
    except OSError:
        try:
            return socket.gethostbyname(socket.gethostname())
        except OSError:
            return "127.0.0.1"
    finally:
        sock.close()


def create_server(host, port, handler=None):
    if handler is None:
        handler = http.server.SimpleHTTPRequestHandler
    httpd = http.server.ThreadingHTTPServer((host, port), handler)
    httpd.allow_reuse_address = True
    httpd.daemon_threads = True
    return httpd


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    host = "0.0.0.0"

    handler = http.server.SimpleHTTPRequestHandler
    with create_server(host, port, handler) as httpd:
        print("Local:   http://localhost:{}".format(port))
        print("Network: http://{}:{}".format(lan_ip(), port))
        print("Press Ctrl+C to stop.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopping server.")


if __name__ == "__main__":
    main()
