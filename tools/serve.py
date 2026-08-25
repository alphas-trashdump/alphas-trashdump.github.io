#!/usr/bin/env python3
"""Preview the site locally: python3 tools/serve.py [port]

Rebuilds data/index.json first, then serves the repo root with no-cache
headers so edits show up on refresh. Open http://localhost:8000 on the phone.
"""
from __future__ import annotations

import functools
import http.server
import pathlib
import socketserver
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("  %s\n" % (fmt % args))


def main() -> int:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    build = subprocess.run([sys.executable, str(ROOT / "tools" / "build_index.py")],
                           cwd=ROOT, text=True, capture_output=True)
    sys.stderr.write(build.stdout + build.stderr)
    if build.returncode:
        return build.returncode

    socketserver.TCPServer.allow_reuse_address = True
    handler = functools.partial(Handler, directory=str(ROOT))
    with socketserver.TCPServer(("", port), handler) as httpd:
        print(f"serving {ROOT} on http://localhost:{port}  (ctrl-c to stop)")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nbye")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
