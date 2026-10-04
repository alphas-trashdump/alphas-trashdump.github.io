#!/usr/bin/env python3
"""Interactive CLI tool to add, edit, or delete ROM releases without touching JSON.

Usage:
    python3 tools/post.py
"""
from __future__ import annotations

import datetime as dt
import json
import pathlib
import re
import subprocess
import sys
from urllib.parse import urlparse

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
DEVICES_FILE = DATA / "devices.json"
MAINTAINERS_FILE = DATA / "maintainers.json"
RELEASES_DIR = DATA / "releases"


def load_json(path: pathlib.Path):
    try:
        with path.open(encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def save_json(path: pathlib.Path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2, ensure_ascii=False)
        f.write("\n")


def slug(text: str) -> str:
    text = text.lower().replace("+", " plus ")
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return re.sub(r"-{2,}", "-", text) or "release"


def host_label(url: str) -> str:
    host = urlparse(url).hostname or "download"
    host = host.replace("www.", "")
    known = {
        "drive.google.com": "Google Drive",
        "sourceforge.net": "SourceForge",
        "t.me": "Telegram",
        "mega.nz": "MEGA",
        "mediafire.com": "MediaFire",
        "pixeldrain.com": "pixeldrain",
        "github.com": "GitHub",
        "buzzheavier.com": "buzzheavier",
    }
    return known.get(host, host)


def ask(prompt: str, default: str | None = None) -> str:
    if default:
        p = f"{prompt} [{default}]: "
    else:
        p = f"{prompt}: "
    val = input(p).strip()
    return val if val else (default or "")


def ask_choice(prompt: str, options: list[str], default_idx: int = 0) -> str:
    print(f"\n{prompt}")
    for i, opt in enumerate(options, 1):
        marker = "*" if i - 1 == default_idx else " "
        print(f"  {i}) {marker} {opt}")
    while True:
        choice = input(f"Choose [1-{len(options)}] (default: {default_idx + 1}): ").strip()
        if not choice:
            return options[default_idx]
        if choice.isdigit() and 1 <= int(choice) <= len(options):
            return options[int(choice) - 1]
        print(f"Please enter a number between 1 and {len(options)}.")


def ask_multiline(prompt: str, hint: str = "one item per line, press Enter on empty line to finish") -> list[str]:
    print(f"\n{prompt} ({hint}):")
    items = []
    while True:
        line = input("  > ").strip()
        if not line:
            break
        items.append(line)
    return items


def select_device(devices: dict) -> str:
    dev_keys = list(devices.keys())
    opts = [f"{k} ({devices[k].get('name', k)})" for k in dev_keys] + ["[Add a new device]"]
    chosen = ask_choice("Select target device:", opts)
    if chosen == "[Add a new device]":
        codename = ask("New device codename (lowercase, e.g. 'land')").strip().lower()
        fullname = ask("Device display name (e.g. 'Redmi 3S')")
        devices[codename] = {"name": fullname, "fullName": fullname}
        save_json(DEVICES_FILE, devices)
        print(f"Added new device '{codename}'.")
        return codename
    return dev_keys[opts.index(chosen)]


def add_release():
    devices = load_json(DEVICES_FILE)
    maintainers = load_json(MAINTAINERS_FILE)

    if not devices:
        print("Error: data/devices.json is missing or empty.")
        return

    device = select_device(devices)

    print("\n--- ROM Information ---")
    name = ask("ROM Name (e.g. 'HyperOS 3.0.313.0')")
    while not name:
        print("ROM Name is required.")
        name = ask("ROM Name")

    default_id = slug(name)
    rel_id = ask("Release ID", default=default_id)
    android = ask("Android Version (e.g. '14', '15')", default="14")

    channel = ask_choice("Release Channel:", ["stable", "beta", "experimental"], default_idx=0)
    today = dt.date.today().isoformat()
    date_str = ask("Build Date (YYYY-MM-DD)", default=today)
    size = ask("File Size (e.g. '1.8 GB', press Enter to skip)", default="")

    maint_keys = list(maintainers.keys())
    if maint_keys:
        maint_opts = [f"{k} ({maintainers[k].get('name', k)})" for k in maint_keys]
        maint_choice = ask_choice("Maintainer:", maint_opts, default_idx=0)
        maintainer = maint_keys[maint_opts.index(maint_choice)]
    else:
        maintainer = ask("Maintainer ID", default="alpha")

    print("\n--- Download Mirrors ---")
    mirrors = []
    main_url = ask("Main download URL")
    while not main_url:
        print("At least one download URL is required.")
        main_url = ask("Main download URL")
    main_label = ask("Mirror label", default=host_label(main_url))
    mirrors.append({"label": main_label, "url": main_url, "primary": True})

    while True:
        more = ask("Add another mirror? (y/N)", default="n").lower()
        if more != "y":
            break
        m_url = ask("Mirror URL")
        if m_url:
            m_label = ask("Mirror label", default=host_label(m_url))
            mirrors.append({"label": m_label, "url": m_url})

    rec_url = ask("\nRecommended recovery URL (press Enter to skip)", default="")
    recovery = None
    if rec_url:
        rec_label = ask("Recovery label", default="Recommended recovery")
        recovery = {"label": rec_label, "url": rec_url}

    album = ask("\nTelegram screenshot album link (press Enter to skip)", default="")

    print("\n--- Installation Steps ---")
    use_std_install = ask("Use standard 5-step clean flash instructions? (Y/n)", default="y").lower()
    if use_std_install != "n":
        install = [
            "Wipe dalvik, cache, system, vendor and data",
            "Format data > yes",
            "Flash the ROM zip",
            "Reboot to system",
            "First boot takes 10-15 minutes",
        ]
    else:
        install = ask_multiline("Enter custom installation steps in order")

    bugs = ask_multiline("Enter known bugs (leave empty if none)")
    changelog = ask_multiline("Enter changelog entries (leave empty if none)")

    notes = ask("\nSpecial notice / note (press Enter to skip)", default="")
    note_style = "callout"
    if notes:
        note_style_choice = ask_choice("Note style:", ["callout (highlight box)", "quiet (plain line)"], default_idx=0)
        note_style = "callout" if "callout" in note_style_choice else "quiet"

    payload = {
        "id": rel_id,
        "device": device,
        "name": name,
        "shortName": None,
        "android": android,
        "channel": channel,
        "date": date_str,
        "size": size or None,
        "maintainer": maintainer,
        "supports": [],
        "mirrors": mirrors,
        "extras": [],
        "recovery": recovery,
        "screenshots": [],
        "screenshotsAlbum": album or None,
        "install": install,
        "bugs": bugs,
        "changelog": changelog,
        "notes": notes or None,
        "noteStyle": note_style,
    }

    target = RELEASES_DIR / device / f"{rel_id}.json"
    save_json(target, payload)
    print(f"\n[OK] Saved release to: {target.relative_to(ROOT)}")

    finish_build(name)


def list_all_releases() -> list[tuple[str, str, pathlib.Path]]:
    out = []
    if not RELEASES_DIR.exists():
        return out
    for dev_dir in sorted(RELEASES_DIR.iterdir()):
        if not dev_dir.is_dir():
            continue
        for rel_file in sorted(dev_dir.glob("*.json")):
            data = load_json(rel_file)
            rel_name = data.get("name", rel_file.stem)
            out.append((dev_dir.name, rel_name, rel_file))
    return out


def delete_release():
    releases = list_all_releases()
    if not releases:
        print("No releases found to delete.")
        return

    opts = [f"[{r[0]}] {r[1]} ({r[2].name})" for r in releases]
    chosen = ask_choice("Select release to DELETE:", opts)
    idx = opts.index(chosen)
    dev, name, path = releases[idx]

    confirm = ask(f"Are you sure you want to PERMANENTLY delete '{name}'? (yes/no)", default="no")
    if confirm.lower() == "yes":
        path.unlink()
        print(f"[OK] Deleted {path.relative_to(ROOT)}")
        finish_build(f"Delete {name}")
    else:
        print("Cancelled.")


def finish_build(action_title: str):
    print("\nRebuilding data/index.json...")
    res = subprocess.run([sys.executable, str(ROOT / "tools" / "build_index.py")])
    if res.returncode == 0:
        print("[OK] Index rebuilt successfully!")
    else:
        print("[WARN] Index build failed. Check errors above.")

    git_push = ask("\nDo you want to git commit and push these changes now? (Y/n)", default="y").lower()
    if git_push != "n":
        subprocess.run(["git", "add", "data/"], cwd=ROOT)
        subprocess.run(["git", "commit", "-m", f"release: {action_title}"], cwd=ROOT)
        print("Pushing to GitHub...")
        subprocess.run(["git", "push"], cwd=ROOT)
        print("[OK] Finished! Your site will update in a moment.")


def main():
    print("=========================================")
    print("   alpha's trashdump - Release Manager   ")
    print("=========================================")
    action = ask_choice("What would you like to do?", [
        "Add a new ROM release",
        "Delete an existing release",
        "Exit",
    ], default_idx=0)

    if action == "Add a new ROM release":
        add_release()
    elif action == "Delete an existing release":
        delete_release()
    else:
        print("Goodbye!")


if __name__ == "__main__":
    main()
