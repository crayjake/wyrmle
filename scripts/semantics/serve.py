#!/usr/bin/env python3
"""Start the checksum-pinned local semantic model, with optional asset download.

The server is local to this machine and is used only during puzzle authoring.
Run refine.py separately; its completed inference memos survive interruptions.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import sys
import tarfile
import time
import urllib.request


def verify(path, asset):
    if not path.is_file() or path.stat().st_size != asset["bytes"]:
        return False
    sha = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(8 * 1024 * 1024), b""):
            sha.update(chunk)
    return sha.hexdigest() == asset["sha256"]


def obtain(asset, cache, download):
    path = cache / asset["filename"]
    if verify(path, asset):
        return path
    if path.exists():
        raise ValueError(f"Checksum/size mismatch: {path}; remove it before downloading again")
    if not download:
        raise ValueError(f"Missing {path}; supply --download to obtain pinned assets")
    cache.mkdir(parents=True, exist_ok=True)
    partial = path.with_suffix(path.suffix + ".partial")
    offset = partial.stat().st_size if partial.exists() else 0
    if offset >= asset["bytes"]:
        if verify(partial, asset):
            partial.replace(path)
            return path
        raise ValueError(f"Invalid completed partial download: {partial}; remove it and retry")
    headers = {"User-Agent": "wyrmle-offline-authoring"}
    if offset:
        headers["Range"] = f"bytes={offset}-"
    request = urllib.request.Request(asset["url"], headers=headers)
    with urllib.request.urlopen(request, timeout=120) as response:
        if offset and response.status == 206:
            if not response.headers.get("Content-Range", "").startswith(f"bytes {offset}-"):
                raise ValueError("Download server returned an inconsistent byte range")
            mode = "ab"
        elif response.status == 200:
            offset, mode = 0, "wb"
        else:
            raise ValueError(f"Unexpected download HTTP status {response.status}")
        report_at = 0
        with partial.open(mode) as output:
            for chunk in iter(lambda: response.read(1024 * 1024), b""):
                output.write(chunk)
                offset += len(chunk)
                if time.monotonic() >= report_at:
                    print(f"{asset['filename']}: {offset / asset['bytes']:.1%}", flush=True)
                    report_at = time.monotonic() + 15
    if not verify(partial, asset):
        raise ValueError(f"Downloaded asset failed checksum verification: {partial}")
    partial.replace(path)
    return path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--assets", type=Path, default=Path(__file__).with_name("contextual-assets.json"))
    parser.add_argument("--cache", type=Path, default=Path.home() / ".cache/wyrmle/semantic-model")
    parser.add_argument("--backend", choices=("vulkan", "cpu"), default="vulkan")
    parser.add_argument("--download", action="store_true")
    parser.add_argument("--verify-only", action="store_true")
    args = parser.parse_args()
    assets = json.loads(args.assets.read_text())
    runtime = assets["vulkanRuntime" if args.backend == "vulkan" else "runtime"]
    model = obtain(assets["model"], args.cache, args.download)
    archive = obtain(runtime, args.cache, args.download)
    # Extract again from the verified archive so cached executables cannot
    # silently differ from the runtime pin. Python's data filter prevents
    # archive members from escaping the destination directory.
    runtime_dir = args.cache / runtime["sha256"]
    runtime_dir.mkdir(parents=True, exist_ok=True)
    with tarfile.open(archive) as package:
        package.extractall(runtime_dir, filter="data")
    servers = list(runtime_dir.rglob("llama-server"))
    if len(servers) != 1:
        raise ValueError("Pinned runtime archive must contain exactly one llama-server")
    server = servers[0]
    print(json.dumps({"model": str(model), "runtime": str(server), "backend": args.backend,
                      "modelDigest": assets["model"]["sha256"], "runtimeBuild": runtime["build"]}), flush=True)
    if not args.verify_only:
        environment = dict(os.environ)
        environment["LD_LIBRARY_PATH"] = str(server.parent) + (
            ":" + environment["LD_LIBRARY_PATH"] if environment.get("LD_LIBRARY_PATH") else "")
        os.execve(server, [str(server), "-m", str(model), *runtime["serverArguments"]], environment)


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError) as error:
        sys.exit(str(error))
