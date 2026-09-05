#!/usr/bin/env python3
# network-control.py — pfctl-based network block/unblock for Maestro iOS flows.
#
# MUST be started with sudo (pfctl requires root).
# On CircleCI the distiller user has passwordless sudo — start via:
#   sudo -n python3 network-control.py PORT &
# Locally for network flow testing:
#   sudo python3 .maestro/config/network-control.py 10000 &
#
# HTTP endpoints (localhost only):
#   GET /block    — pfctl: block out on !lo0 all  (loopback stays open)
#   GET /unblock  — flush rules, disable pfctl
#   GET /         — ready check

import socket
import threading
import subprocess
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 10000

PF_BLOCK_RULES = b"block out on !lo0 all\n"
PF_EMPTY_RULES = b"\n"


def pf_block():
    proc = subprocess.Popen(
        ['pfctl', '-f', '-'],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    )
    proc.communicate(PF_BLOCK_RULES)
    subprocess.run(['pfctl', '-e'], capture_output=True)


def pf_unblock():
    proc = subprocess.Popen(
        ['pfctl', '-f', '-'],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    )
    proc.communicate(PF_EMPTY_RULES)
    subprocess.run(['pfctl', '-d'], capture_output=True)


def handle(client):
    try:
        req = client.recv(1024).decode('latin-1', errors='replace')
        parts = req.split(' ', 2)
        path = parts[1] if len(parts) > 1 else '/'
        if '/block' in path:
            pf_block()
            body = b'blocked'
        elif '/unblock' in path:
            pf_unblock()
            body = b'unblocked'
        else:
            body = b'ready'
        resp = (b'HTTP/1.1 200 OK\r\nContent-Length: ' + str(len(body)).encode()
                + b'\r\nConnection: close\r\n\r\n' + body)
        client.sendall(resp)
    except Exception:
        pass
    finally:
        client.close()


sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
sock.bind(('127.0.0.1', PORT))
sock.listen(32)

while True:
    try:
        client, _ = sock.accept()
        threading.Thread(target=handle, args=(client,), daemon=True).start()
    except Exception:
        break
