#!/usr/bin/env python3
"""Collect data/devices.json + data/maintainers.json + data/releases/**.json
into a single data/index.json that the site fetches at runtime.

Also validates every release file and fails loudly, so a bad hand-edit never
reaches the published site.

    python3 tools/build_index.py           # write data/index.json
    python3 tools/build_index.py --check   # validate only, no write
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
RELEASES = DATA / "releases"

CHANNELS = {"stable", "beta", "experimental"}
NOTE_STYLES = {"callout", "quiet"}
REQUIRED = ["id", "device", "name", "android", "date", "maintainer", "mirrors"]

LIST_FIELDS = ["install", "bugs", "changelog", "screenshots", "extras", "mirrors", "supports"]
DEFAULTS = {
    "shortName": None,
    "channel": "stable",
    "size": None,
    "recovery": None,
    "screenshotsAlbum": None,
    "notes": None,
    "noteStyle": "callout",
}


class Problem(Exception):
    pass


def fail(path: pathlib.Path, msg: str) -> None:
    raise Problem(f"{path.relative_to(ROOT)}: {msg}")


def load(path: pathlib.Path):
    try:
        with path.open(encoding="utf-8") as fh:
            return json.load(fh)
    except json.JSONDecodeError as exc:
        raise Problem(f"{path.relative_to(ROOT)}: invalid JSON - {exc}") from None


def check_release(path: pathlib.Path, rel: dict, devices: set[str], maints: set[str]) -> dict:
    if not isinstance(rel, dict):
        fail(path, "expected a JSON object")
    for key in REQUIRED:
        if rel.get(key) in (None, "", []):
            fail(path, f"missing required field '{key}'")
    for key in LIST_FIELDS:
        rel.setdefault(key, [])
        if not isinstance(rel[key], list):
            fail(path, f"'{key}' must be a list")
    for key, default in DEFAULTS.items():
        rel.setdefault(key, default)

    if rel["device"] not in devices:
        fail(path, f"unknown device '{rel['device']}' - add it to data/devices.json")
    if rel["maintainer"] not in maints:
        fail(path, f"unknown maintainer '{rel['maintainer']}' - add them to data/maintainers.json")
    if rel["channel"] not in CHANNELS:
        fail(path, f"channel must be one of {sorted(CHANNELS)}")
    if rel["noteStyle"] not in NOTE_STYLES:
        fail(path, f"noteStyle must be one of {sorted(NOTE_STYLES)}")
    try:
        dt.date.fromisoformat(rel["date"])
    except ValueError:
        fail(path, "date must be ISO format YYYY-MM-DD")

    expect_dir = rel["device"]
    if path.parent.name != expect_dir:
        fail(path, f"lives in releases/{path.parent.name}/ but device is '{expect_dir}'")
    if path.stem != rel["id"]:
        fail(path, f"filename must match id ('{rel['id']}.json')")

    for i, mirror in enumerate(rel["mirrors"]):
        if not isinstance(mirror, dict) or not mirror.get("url") or not mirror.get("label"):
            fail(path, f"mirrors[{i}] needs both 'label' and 'url'")
        mirror.setdefault("primary", False)
    if rel["mirrors"] and not any(m["primary"] for m in rel["mirrors"]):
        rel["mirrors"][0]["primary"] = True

    for i, extra in enumerate(rel["extras"]):
        if not isinstance(extra, dict) or not extra.get("url") or not extra.get("label"):
            fail(path, f"extras[{i}] needs both 'label' and 'url'")

    for shot in rel["screenshots"]:
        if not isinstance(shot, str):
            fail(path, "screenshots must be a list of paths or https URLs")
        if shot.startswith(("http://", "https://")):
            continue  # externally hosted shot, nothing to check on disk
        if not (ROOT / shot).exists():
            fail(path, f"screenshot not found on disk: {shot}")

    rel["_source"] = str(path.relative_to(ROOT))
    return rel


def build() -> dict:
    devices = load(DATA / "devices.json")
    maintainers = load(DATA / "maintainers.json")
    if not isinstance(devices, list):
        raise Problem("data/devices.json must be a list")
    if not isinstance(maintainers, dict):
        raise Problem("data/maintainers.json must be an object keyed by id")

    codenames = {d["codename"] for d in devices}
    if len(codenames) != len(devices):
        raise Problem("data/devices.json has duplicate codenames")
    devices.sort(key=lambda d: (d.get("order", 999), d["codename"].lower()))

    releases = []
    seen = set()
    for path in sorted(RELEASES.glob("*/*.json")):
        rel = check_release(path, load(path), codenames, set(maintainers))
        key = (rel["device"], rel["id"])
        if key in seen:
            raise Problem(f"duplicate release id '{rel['id']}' for {rel['device']}")
        seen.add(key)
        releases.append(rel)

    releases.sort(key=lambda r: (r["date"], r["id"]), reverse=True)

    for dev in devices:
        own = [r for r in releases if r["device"] == dev["codename"]]
        dev["releaseCount"] = len(own)
        dev["latest"] = own[0]["id"] if own else None

    return {
        "generated": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat(),
        "counts": {"devices": len(devices), "releases": len(releases)},
        "devices": devices,
        "maintainers": maintainers,
        "releases": releases,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="validate without writing")
    ap.add_argument("--verify-fresh", action="store_true",
                    help="fail if the committed data/index.json differs from a fresh build "
                         "(ignoring the build timestamp)")
    args = ap.parse_args()
    try:
        index = build()
    except Problem as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    if args.check:
        print(f"ok: {index['counts']['releases']} releases across {index['counts']['devices']} devices")
        return 0

    if args.verify_fresh:
        out = DATA / "index.json"
        if not out.exists():
            print("error: data/index.json is missing - run tools/build_index.py", file=sys.stderr)
            return 1
        committed = json.loads(out.read_text(encoding="utf-8"))
        a = {k: v for k, v in committed.items() if k != "generated"}
        b = {k: v for k, v in index.items() if k != "generated"}
        if a != b:
            print("error: data/index.json is stale - run 'python3 tools/build_index.py' and commit it",
                  file=sys.stderr)
            return 1
        print("data/index.json is up to date")
        return 0

    out = DATA / "index.json"
    tmp = out.with_suffix(".json.tmp")
    with tmp.open("w", encoding="utf-8") as fh:
        json.dump(index, fh, indent=1, ensure_ascii=False)
        fh.write("\n")
    os.replace(tmp, out)
    print(f"wrote {out.relative_to(ROOT)} - {index['counts']['releases']} releases, {index['counts']['devices']} devices")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
