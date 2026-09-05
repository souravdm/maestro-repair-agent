#!/usr/bin/env python3
# Minimal HTTP/HTTPS forwarding proxy for Maestro network simulation.
# Used by network-toggle.js to simulate network outages without admin rights.
#
# Block  = kill this process  → port closed → connection refused → app offline
# Unblock = start this process → port open  → traffic forwarded → app online
#
# Usage: python3 proxy_server.py [PORT]   (default: 9999)
# Writes PID to /tmp/maestro_proxy_<PORT>.pid for clean teardown.

import socket
import threading
import select
import sys
import os
import signal

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9999
PID_FILE = f"/tmp/maestro_proxy_{PORT}.pid"
CONTROL_PORT = PORT + 1

# When set, proxy rejects all connections with 503 (simulates network outage)
BLOCKED = threading.Event()


def relay(src, dst):
    try:
        while True:
            r, _, _ = select.select([src], [], [], 30)
            if not r:
                break
            data = src.recv(8192)
            if not data:
                break
            dst.sendall(data)
    except Exception:
        pass


def control_handler(client):
    """Handle one HTTP request on the control port: /block or /unblock."""
    try:
        req = client.recv(1024).decode("latin-1", errors="replace")
        parts = req.split(" ", 2)
        path = parts[1] if len(parts) > 1 else "/"
        if "/block" in path:
            BLOCKED.set()
            body = b"blocked"
        elif "/unblock" in path:
            BLOCKED.clear()
            body = b"unblocked"
        else:
            body = b"ok"
        resp = (b"HTTP/1.1 200 OK\r\nContent-Length: " + str(len(body)).encode()
                + b"\r\nConnection: close\r\n\r\n" + body)
        client.sendall(resp)
    except Exception:
        pass
    finally:
        client.close()


def control_server():
    """Listen on CONTROL_PORT for /block and /unblock commands from network-toggle.js."""
    ctrl = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    ctrl.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    ctrl.bind(("127.0.0.1", CONTROL_PORT))
    ctrl.listen(32)
    while True:
        try:
            client, _ = ctrl.accept()
            threading.Thread(target=control_handler, args=(client,), daemon=True).start()
        except Exception:
            break


def handle(client):
    # Reject immediately when blocked — simulates network outage
    if BLOCKED.is_set():
        try:
            client.sendall(
                b"HTTP/1.1 503 Service Unavailable\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
            )
        except Exception:
            pass
        finally:
            client.close()
        return

    server = None
    try:
        req = b""
        while b"\r\n\r\n" not in req:
            chunk = client.recv(4096)
            if not chunk:
                return
            req += chunk

        first_line = req.split(b"\r\n")[0].decode("latin-1")
        parts = first_line.split(" ", 2)
        if len(parts) < 2:
            return
        method, target = parts[0], parts[1]

        if method == "CONNECT":
            # HTTPS tunnel — respond 200 then relay raw bytes
            host, _, port_str = target.partition(":")
            server = socket.create_connection((host, int(port_str or 443)), timeout=15)
            client.sendall(b"HTTP/1.1 200 Connection Established\r\n\r\n")
            t = threading.Thread(target=relay, args=(server, client), daemon=True)
            t.start()
            relay(client, server)
            t.join(timeout=60)
        else:
            # Plain HTTP — strip http:// and forward
            if target.startswith("http://"):
                target = target[7:]
            host_part, _, path = target.partition("/")
            path = "/" + path
            host, _, port_str = host_part.partition(":")
            port = int(port_str) if port_str else 80
            server = socket.create_connection((host, port), timeout=15)
            req = req.replace(
                first_line.encode("latin-1"),
                f"{method} {path} HTTP/1.1".encode("latin-1"),
                1,
            )
            server.sendall(req)
            relay(server, client)
    except Exception:
        pass
    finally:
        client.close()
        if server:
            try:
                server.close()
            except Exception:
                pass


threading.Thread(target=control_server, daemon=True).start()

sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
sock.bind(("127.0.0.1", PORT))
sock.listen(128)

with open(PID_FILE, "w") as f:
    f.write(str(os.getpid()))


def cleanup(sig=None, frame=None):
    try:
        os.remove(PID_FILE)
    except Exception:
        pass
    sys.exit(0)


signal.signal(signal.SIGTERM, cleanup)
signal.signal(signal.SIGINT, cleanup)

while True:
    try:
        client, _ = sock.accept()
        threading.Thread(target=handle, args=(client,), daemon=True).start()
    except Exception:
        break
