#!/usr/bin/env python3
"""Turn a GitHub issue-form submission into release data.

Reads the issue body from --body-file (or ISSUE_BODY), writes/removes
data/releases/<device>/<id>.json, downloads and optimises screenshots into
res/shots/<device>/<id>/, and prints a markdown summary on stdout for the bot
to post back on the issue.

    python3 tools/publish_issue.py --body-file body.md --mode add
    python3 tools/publish_issue.py --body-file body.md --mode remove
"""
from __future__ import annotations

import argparse
import datetime as dt
import io
import json
import os
import pathlib
import re
import shutil
import sys
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
SHOTS = ROOT / "res" / "shots"
TEMPLATE = ROOT / ".github" / "ISSUE_TEMPLATE" / "add-release.yml"

NO_RESPONSE = {"_no response_", "_none_", "none", "n/a", "-", ""}
MAX_SHOTS = 12
MAX_EDGE = 1440
UA = "trashdump-bot (+https://github.com/alphas-trashdump)"


class Bail(Exception):
    """User-facing failure: message is posted back on the issue."""


# ---------------------------------------------------------------- parsing

def label_to_id() -> dict[str, str]:
    """Build {issue-form label -> field id} straight from the template."""
    import yaml  # provided by the workflow

    spec = yaml.safe_load(TEMPLATE.read_text(encoding="utf-8"))
    out = {}
    for block in spec.get("body", []):
        attrs = block.get("attributes") or {}
        if block.get("id") and attrs.get("label"):
            out[attrs["label"].strip().lower()] = block["id"]
    return out


def parse_body(body: str, labels: dict[str, str]) -> dict[str, str]:
    fields: dict[str, str] = {}
    # issue forms render each answer as "### Label\n\nvalue"
    chunks = re.split(r"^###\s+", body.replace("\r\n", "\n"), flags=re.M)
    for chunk in chunks[1:]:
        head, _, value = chunk.partition("\n")
        key = labels.get(head.strip().lower())
        if not key:
            continue
        value = value.strip()
        if value.strip().lower() in NO_RESPONSE:
            continue
        fields[key] = value
    return fields


def lines(value: str | None) -> list[str]:
    if not value:
        return []
    out = []
    for raw in value.split("\n"):
        item = raw.strip().lstrip("-*0123456789.) ").strip()
        if item and item.lower() not in NO_RESPONSE:
            out.append(item)
    return out


def pairs(value: str | None) -> list[dict]:
    """Parse "Label | URL" lines. A bare URL gets a label from its host."""
    out = []
    for line in lines(value):
        if "|" in line:
            label, _, url = line.partition("|")
            label, url = label.strip(), url.strip()
        else:
            label, url = "", line
        url = url.strip("<>() ")
        if not url.startswith(("http://", "https://")):
            raise Bail(f"`{line}` is not a valid link - each line needs to be `Label | https://...`")
        if not label:
            label = host_label(url)
        out.append({"label": label, "url": url})
    return out


def host_label(url: str) -> str:
    from urllib.parse import urlparse

    host = urlparse(url).hostname or "download"
    return {
        "drive.google.com": "Google Drive",
        "sourceforge.net": "SourceForge",
        "t.me": "Telegram",
        "mega.nz": "MEGA",
        "www.mediafire.com": "MediaFire",
        "mediafire.com": "MediaFire",
        "pixeldrain.com": "pixeldrain",
        "github.com": "GitHub",
    }.get(host.replace("www.", ""), host.replace("www.", ""))


def slug(text: str) -> str:
    text = text.lower().replace("+", " plus ")
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return re.sub(r"-{2,}", "-", text) or "release"


def norm_date(value: str | None) -> str:
    if not value:
        return dt.date.today().isoformat()
    value = value.strip()
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%Y/%m/%d"):
        try:
            return dt.datetime.strptime(value, fmt).date().isoformat()
        except ValueError:
            continue
    raise Bail(f"`{value}` is not a date I understand - use `YYYY-MM-DD`")


# ------------------------------------------------------------ screenshots

IMG_RE = re.compile(
    r"!\[[^\]]*\]\(([^)\s]+)\)"          # ![alt](url)
    r"|<img[^>]+src=\"([^\"]+)\""            # <img src="url">
    r"|(https?://(?:user-images\.githubusercontent\.com|github\.com/user-attachments)/\S+)"
    r"|(https?://\S+\.(?:png|jpe?g|webp|gif))",  # bare image link
    re.I,
)


def extract_images(value: str | None) -> list[str]:
    if not value:
        return []
    urls = []
    for match in IMG_RE.finditer(value):
        url = next((g for g in match.groups() if g), None)
        if url and url not in urls:
            urls.append(url.strip("<>"))
    return urls[:MAX_SHOTS]


def fetch(url: str) -> bytes:
    allow_local = os.environ.get("TD_ALLOW_LOCAL_FILES") == "1"
    if not url.startswith(("https://", "http://")) and not allow_local:
        raise Bail(f"refusing to fetch `{url}` - screenshots must be http(s) links or dragged-in attachments")
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as res:
        if int(res.headers.get("Content-Length") or 0) > 25 * 1024 * 1024:
            raise Bail(f"{url} is over 25 MB - shrink it first")
        return res.read(25 * 1024 * 1024 + 1)


def save_shots(urls: list[str], device: str, rid: str) -> list[str]:
    if not urls:
        return []
    out_dir = SHOTS / device / rid
    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    try:
        from PIL import Image, features
        fmt, ext = ("WEBP", ".webp") if features.check("webp") else ("JPEG", ".jpg")
    except ImportError:
        Image, fmt, ext = None, None, None

    saved = []
    for i, url in enumerate(urls, 1):
        try:
            blob = fetch(url)
        except Bail:
            raise
        except Exception as exc:  # noqa: BLE001 - report, keep going
            print(f"::warning::could not download {url}: {exc}", file=sys.stderr)
            continue

        if Image is None:
            suffix = pathlib.Path(url.split("?")[0]).suffix.lower() or ".png"
            path = out_dir / f"{i:02d}{suffix}"
            path.write_bytes(blob)
        else:
            with Image.open(io.BytesIO(blob)) as img:
                img = img.convert("RGB")
                if max(img.size) > MAX_EDGE:
                    scale = MAX_EDGE / max(img.size)
                    img = img.resize((round(img.width * scale), round(img.height * scale)),
                                     Image.LANCZOS)
                path = out_dir / f"{i:02d}{ext}"
                img.save(path, fmt, quality=80, **({"method": 5} if fmt == "WEBP" else {"optimize": True}))
        saved.append(str(path.relative_to(ROOT)))

    if not saved:
        shutil.rmtree(out_dir, ignore_errors=True)
    return saved


# ----------------------------------------------------------------- device

def ensure_device(fields: dict[str, str]) -> str:
    devices = json.loads((DATA / "devices.json").read_text(encoding="utf-8"))
    known = {d["codename"] for d in devices}
    picked = (fields.get("device") or "").strip()

    if picked and picked != "new device":
        if picked not in known:
            raise Bail(f"device `{picked}` is not in data/devices.json")
        return picked

    codename = (fields.get("new_device_codename") or "").strip()
    if not codename:
        raise Bail('you picked "new device" but left the codename empty')
    if codename in known:
        return codename

    devices.append({
        "codename": codename,
        "name": (fields.get("new_device_name") or codename).strip(),
        "fullName": (fields.get("new_device_name") or codename).strip(),
        "soc": None,
        "family": False,
        "order": max([d.get("order", 0) for d in devices] or [0]) + 1,
        "note": None,
    })
    (DATA / "devices.json").write_text(
        json.dumps(devices, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"::notice::added new device {codename}", file=sys.stderr)
    return codename


# ------------------------------------------------------------------- main

def do_add(fields: dict[str, str]) -> tuple[str, str]:
    device = ensure_device(fields)
    name = (fields.get("name") or "").strip()
    if not name:
        raise Bail("the ROM name is empty")
    rid = slug(fields.get("release_id") or name)

    existing_path = DATA / "releases" / device / f"{rid}.json"
    existing = json.loads(existing_path.read_text(encoding="utf-8")) if existing_path.exists() else {}

    shot_urls = extract_images(fields.get("screenshots"))
    screenshots = save_shots(shot_urls, device, rid) if shot_urls else existing.get("screenshots", [])

    recovery = None
    if fields.get("recovery"):
        raw = fields["recovery"].strip()
        parsed = pairs(raw)[0]
        label = parsed["label"] if "|" in raw else "Recommended recovery"
        recovery = {"label": label, "url": parsed["url"]}

    mirrors = pairs(fields.get("mirrors"))
    if not mirrors:
        raise Bail("at least one download mirror is required")
    mirrors[0]["primary"] = True
    for m in mirrors[1:]:
        m["primary"] = False

    release = {
        "id": rid,
        "device": device,
        "name": name,
        "shortName": (fields.get("short_name") or "").strip() or None,
        "android": (fields.get("android") or "").strip(),
        "channel": (fields.get("channel") or "stable").strip(),
        "date": norm_date(fields.get("date")),
        "size": (fields.get("size") or "").strip() or None,
        "maintainer": (fields.get("maintainer") or "").strip(),
        "supports": [s.strip() for s in (fields.get("supports") or "").split(",") if s.strip()],
        "mirrors": mirrors,
        "extras": pairs(fields.get("extras")),
        "recovery": recovery,
        "screenshots": screenshots,
        "screenshotsAlbum": existing.get("screenshotsAlbum"),
        "install": lines(fields.get("install")),
        "bugs": lines(fields.get("bugs")),
        "changelog": lines(fields.get("changelog")),
        "notes": (fields.get("notes") or "").strip() or None,
        "noteStyle": "quiet" if (fields.get("note_style") or "").startswith("Plain") else "callout",
    }
    if not release["install"]:
        raise Bail("install steps are required")

    existing_path.parent.mkdir(parents=True, exist_ok=True)
    existing_path.write_text(json.dumps(release, indent=2, ensure_ascii=False) + "\n",
                             encoding="utf-8")

    verb = "Updated" if existing else "Published"
    summary = "\n".join([
        f"{verb} **{name}** for `{device}`.",
        "",
        f"- release page: `#/r/{device}/{rid}`",
        f"- mirrors: {len(mirrors)}",
        f"- extras: {len(release['extras'])}",
        f"- screenshots: {len(screenshots)}",
        f"- install steps: {len(release['install'])}, known bugs: {len(release['bugs'])}",
        f"- data file: `data/releases/{device}/{rid}.json`",
    ])
    return f"{verb.lower()} {device}/{rid}", summary


def do_remove(fields: dict[str, str]) -> tuple[str, str]:
    device = (fields.get("device") or "").strip()
    rid = (fields.get("release_id") or "").strip()
    if not device or not rid:
        raise Bail("both the device codename and the release id are required")
    path = DATA / "releases" / device / f"{rid}.json"
    if not path.exists():
        raise Bail(f"`data/releases/{device}/{rid}.json` does not exist")
    path.unlink()
    shutil.rmtree(SHOTS / device / rid, ignore_errors=True)
    return f"removed {device}/{rid}", f"Removed **{device}/{rid}** and its screenshots."


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--body-file")
    ap.add_argument("--mode", choices=["add", "remove"], default="add")
    args = ap.parse_args()

    body = (pathlib.Path(args.body_file).read_text(encoding="utf-8")
            if args.body_file else os.environ.get("ISSUE_BODY", ""))
    if not body.strip():
        print("error: empty issue body", file=sys.stderr)
        return 1

    try:
        if args.mode == "remove":
            fields = parse_body(body, {"device codename": "device", "release id": "release_id"})
            title, summary = do_remove(fields)
        else:
            fields = parse_body(body, label_to_id())
            title, summary = do_add(fields)
    except Bail as exc:
        summary = f"I could not publish this: {exc}"
        emit(ok=False, title="failed", summary=summary)
        print(summary, file=sys.stderr)
        return 1

    emit(ok=True, title=title, summary=summary)
    print(summary)
    return 0


def emit(*, ok: bool, title: str, summary: str) -> None:
    out = os.environ.get("GITHUB_OUTPUT")
    if not out:
        return
    with open(out, "a", encoding="utf-8") as fh:
        fh.write(f"ok={'true' if ok else 'false'}\n")
        fh.write(f"title={title}\n")
        fh.write("summary<<__EOF__\n" + summary + "\n__EOF__\n")


if __name__ == "__main__":
    raise SystemExit(main())
