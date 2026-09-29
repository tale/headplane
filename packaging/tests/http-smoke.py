#!/usr/bin/env python3
"""Exercise the installed bundle against the disposable VM's real Headscale."""

import http.cookiejar
import json
import pathlib
import re
import subprocess
import urllib.parse
import urllib.request

base = "http://127.0.0.1:3000"
cookies = http.cookiejar.CookieJar()
client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookies))


def request(path, fields=None):
    data = urllib.parse.urlencode(fields).encode() if fields is not None else None
    req = urllib.request.Request(base + path, data=data, headers={"Origin": base})
    with client.open(req, timeout=30) as response:
        assert response.status == 200, (path, response.status)
        return response.url, response.read()


url, body = request("/admin/login")
assert "login" in url
assets = set(re.findall(rb'["\'](/admin/assets/[^"\']+\.(?:js|css))["\']', body))
assert assets, "Login page has no static JS/CSS references"
for path in assets:
    _, asset = request(path.decode())
    assert len(asset) > 0
_, wasm = request("/admin/hp_ssh.wasm")
assert wasm.startswith(b"\x00asm"), "Browser SSH WASM is missing"
_, wasm_exec = request("/admin/wasm_exec.js")
assert b"Go" in wasm_exec

url, _ = request("/admin/login", {"api_key": "invalid-key"})
assert "login" in url and not list(cookies), "Invalid credentials were accepted"
key = subprocess.check_output(
    ["/usr/local/bin/headscale", "apikeys", "create", "--expiration", "1h", "-o", "json"],
    text=True,
)
key = json.loads(key)
url, _ = request("/admin/login", {"api_key": key})
assert "machines" in url and list(cookies), "API key login did not establish a session"
request("/admin/users", {"action_id": "create_user", "username": "deb-smoke"})
users = json.loads(subprocess.check_output(["headscale", "users", "list", "-o", "json"])) or []
user = next(u for u in users if u["name"] == "deb-smoke")
request("/admin/users", {
    "action_id": "rename_user", "headscale_user_id": user["id"], "new_name": "deb-renamed",
})
users = json.loads(subprocess.check_output(["headscale", "users", "list", "-o", "json"])) or []
assert any(u["name"] == "deb-renamed" for u in users)
request("/admin/users", {"action_id": "delete_user", "headscale_user_id": user["id"]})
users = json.loads(subprocess.check_output(["headscale", "users", "list", "-o", "json"])) or []
assert not any(u["name"] == "deb-renamed" for u in users)
assert any(pathlib.Path("/var/lib/headplane").iterdir())
print("PASS: login, JS/CSS/WASM, rejected credentials, authenticated user create/rename/delete")
