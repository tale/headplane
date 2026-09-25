#!/usr/bin/env python3
"""Retain dependency license/notice files beside the bundled release artifacts."""

import json
import pathlib
import shutil
import subprocess
import sys

source, output = map(pathlib.Path, sys.argv[1:])
output.mkdir(parents=True)


def copy_notices(root, target):
    for entry in root.iterdir():
        name = entry.name.lower()
        if name.startswith(("license", "licence", "copying", "notice", "copyright")):
            target.mkdir(parents=True, exist_ok=True)
            if entry.is_dir():
                shutil.copytree(entry, target / entry.name, dirs_exist_ok=True)
            elif entry.is_file():
                shutil.copyfile(entry, target / entry.name)


# Include all installed packages, including build dependencies whose output
# may be embedded in the bundle. Resolve pnpm's package directories once.
seen = set()
store = source / "node_modules/.pnpm"
manifests = list(store.glob("*/node_modules/*/package.json"))
manifests += list(store.glob("*/node_modules/@*/*/package.json"))
if not manifests:
    raise SystemExit("No installed npm dependencies found for license collection")
for manifest in manifests:
    root = manifest.parent.resolve()
    if root in seen:
        continue
    seen.add(root)
    package = json.loads(manifest.read_text())
    if not package.get("name") or not package.get("version"):
        continue
    target = output / "npm" / (package["name"].replace("/", "__") + "@" + package["version"])
    target.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(manifest, target / "package.json")
    copy_notices(root, target)

# Go's module cache retains original license files. Record the full module
# inventory as well so each included notice can be traced to its source.
raw = subprocess.check_output(["go", "list", "-m", "-json", "all"], cwd=source, text=True)
(output / "go-modules.json").write_text(raw)
decoder = json.JSONDecoder()
while raw.strip():
    module, end = decoder.raw_decode(raw.lstrip())
    raw = raw.lstrip()[end:]
    if module.get("Main") or not module.get("Dir"):
        continue
    root = pathlib.Path(module["Dir"])
    target = output / "go" / (module["Path"].replace("/", "__") + "@" + module["Version"])
    copy_notices(root, target)
