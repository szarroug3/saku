#!/usr/bin/env python3
"""Kana quiz — local web app. Run:  python3 kana_quiz.py

Opens http://127.0.0.1:8766 in your browser. Stdlib only, nothing to install.
- Characters live in characters.py, visuals in theme.py — edit those, refresh.
- Session results append to history.json (synced with the vault via git),
  which powers the score history and weak-character memory.
"""
import json
import os
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import characters
import theme

HERE = os.path.dirname(os.path.abspath(__file__))
HISTORY_PATH = os.path.join(HERE, "history.json")
PORT = 8766


def load_history():
    if os.path.exists(HISTORY_PATH):
        try:
            with open(HISTORY_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            pass
    return {"sessions": [], "chars": {}}


def save_session(session):
    """Append a session and fold its per-character stats into the aggregate."""
    hist = load_history()
    hist["sessions"].append(session)
    hist["sessions"] = hist["sessions"][-200:]
    for c, s in session.get("chars", {}).items():
        agg = hist["chars"].setdefault(c, {"seen": 0, "missed": 0, "slow": 0})
        agg["seen"] += s.get("seen", 0)
        agg["missed"] += s.get("missed", 0)
        agg["slow"] += s.get("slow", 0)
    with open(HISTORY_PATH, "w", encoding="utf-8") as f:
        json.dump(hist, f, ensure_ascii=False, indent=1)
    return hist


def delete_sessions(ids=None, delete_all=False):
    """Remove sessions (by ts) or everything, then rebuild the per-char aggregate."""
    hist = load_history()
    if delete_all:
        hist["sessions"] = []
    else:
        drop = set(ids or [])
        hist["sessions"] = [s for s in hist["sessions"] if s.get("ts") not in drop]
    chars = {}
    for s in hist["sessions"]:
        for c, st in s.get("chars", {}).items():
            agg = chars.setdefault(c, {"seen": 0, "missed": 0, "slow": 0})
            agg["seen"] += st.get("seen", 0)
            agg["missed"] += st.get("missed", 0)
            agg["slow"] += st.get("slow", 0)
    hist["chars"] = chars
    with open(HISTORY_PATH, "w", encoding="utf-8") as f:
        json.dump(hist, f, ensure_ascii=False, indent=1)
    return hist


def theme_css():
    t = theme.THEME
    def block(colors, indent="  "):
        return "\n".join(f"{indent}--{k}: {v};" for k, v in colors.items())
    return (
        ":root {\n" + block(t["light"]) +
        f"\n  --font-ui: {t['font_ui']};\n}}\n"
        "@media (prefers-color-scheme: dark) {\n:root {\n" + block(t["dark"]) + "\n}\n}\n"
    )


def page():
    with open(os.path.join(HERE, "app.html"), "r", encoding="utf-8") as f:
        html = f.read()
    data = {
        "sets": characters.SETS,
        "lookalikes": characters.LOOKALIKES,
        "jpFonts": theme.THEME["jp_fonts"],
        "behavior": theme.THEME["behavior"],
        "history": load_history(),
    }
    html = html.replace("/*__THEME_CSS__*/", theme_css())
    html = html.replace("\"__DATA_JSON__\"", json.dumps(data, ensure_ascii=False))
    return html.encode("utf-8")


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, body, ctype="application/json; charset=utf-8"):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path in ("/", "/index.html"):
            self._send(200, page(), "text/html; charset=utf-8")
        elif self.path == "/api/history":
            self._send(200, json.dumps(load_history(), ensure_ascii=False).encode("utf-8"))
        else:
            self._send(404, b'{"error":"not found"}')

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        try:
            body = json.loads(self.rfile.read(length).decode("utf-8")) if length else {}
            if self.path == "/api/session":
                hist = save_session(body)
                self._send(200, json.dumps({"ok": True, "sessions": len(hist["sessions"])}).encode("utf-8"))
            elif self.path == "/api/delete":
                hist = delete_sessions(body.get("ids"), body.get("all", False))
                self._send(200, json.dumps({"ok": True, "sessions": len(hist["sessions"])}).encode("utf-8"))
            else:
                self._send(404, b'{"error":"not found"}')
        except (json.JSONDecodeError, OSError) as e:
            self._send(400, json.dumps({"error": str(e)}).encode("utf-8"))

    def log_message(self, *args):
        pass


def main():
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    url = f"http://127.0.0.1:{PORT}"
    print(f"Kana quiz running at {url}  (Ctrl+C to stop)")
    webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
