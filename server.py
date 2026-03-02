#!/usr/bin/env python3
import socket
import os
import sys
import psutil  # pip install psutil
from http.server import HTTPServer, SimpleHTTPRequestHandler

PORT = 3000

# --- Step 1: Check if port is in use ---
def kill_process_on_port(port):
    for conn in psutil.net_connections():
        if conn.laddr.port == port:
            pid = conn.pid
            if pid:
                print(f"Port {port} is in use by PID {pid}. Killing process...")
                p = psutil.Process(pid)
                p.terminate()
                p.wait()
                print(f"Process {pid} terminated.")

kill_process_on_port(PORT)

# --- Step 2: Start server ---
server_address = ("", PORT)
httpd = HTTPServer(server_address, SimpleHTTPRequestHandler)

print(f"Serving HTTP on port {PORT} (http://localhost:{PORT}/) ...")
try:
    httpd.serve_forever()
except KeyboardInterrupt:
    print("\nShutting down server.")
    httpd.server_close()

