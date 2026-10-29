"""Does the player actually move? Real browser, real keypress, real server.

This is the test that was missing: server-side probes cannot tell you whether a
keypress reaches the world. It presses a movement key inside the game frame and
asserts the authoritative player position changes, and that the runtime does not
fall into its "Waiting for the current turn to confirm" state.
"""
import json
import os
import sys
import time
import urllib.request
import http.cookiejar
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BASE", "http://127.0.0.1:8814")
ROOT = os.environ.get("ROOT", "/home/mgk/gulch-mv")
PW = open(os.path.join(ROOT, ".room-password")).read().strip()
results = []


def check(name, cond, detail=""):
    results.append((name, bool(cond), detail))
    print(("  PASS  " if cond else "  FAIL  ") + name + (("   -> " + str(detail)[:180]) if detail and not cond else ""))


def player():
    """Authoritative player position straight from the server."""
    cj = http.cookiejar.CookieJar()
    op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
    op.open(urllib.request.Request(
        BASE + "/api/auth", data=json.dumps({"password": PW}).encode(),
        headers={"Content-Type": "application/json"}), timeout=30).read()
    d = json.loads(op.open(BASE + "/api/state", timeout=30).read().decode())
    p = d.get("player") or {}
    return {"x": p.get("x"), "y": p.get("y"), "hp": p.get("hp"),
            "map": p.get("mapId"), "rev": d.get("stateRevision"),
            "gameOver": (d.get("gameState") or {}).get("gulchPermanentGameOver")}


keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"]

with sync_playwright() as pw:
    b = pw.chromium.launch(channel="chrome", headless=True,
                           args=["--no-sandbox", "--disable-dev-shm-usage"])
    ctx = b.new_context(viewport={"width": 1280, "height": 900})
    page = ctx.new_page()
    errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))

    r = page.request.post(BASE + "/api/auth", data=json.dumps({"password": PW}),
                          headers={"Content-Type": "application/json"})
    check("auth", r.status == 200, r.status)

    before = player()
    print("    player before:", before)
    check("player alive", (before["hp"] or 0) > 0, before)

    page.goto(BASE + "/index.html", wait_until="domcontentloaded")
    page.wait_for_timeout(2500)

    # the frame must have a loaded document before it can take input
    page.wait_for_function(
        "()=>{const f=document.getElementById('gameFrame');return !!(f&&f.srcdoc&&f.srcdoc.length>1000)}",
        timeout=30000)

    frame = page.frame_locator("#gameFrame")

    moved = 0
    tried = 0
    for k in keys:
        # click the map so the frame owns focus, then press the key
        try:
            frame.locator("canvas, body").first.click(timeout=5000)
        except Exception:
            page.click("#gameFrame")
        page.wait_for_timeout(400)
        page_before = player()
        tried += 1
        try:
            page.keyboard.press(k)
        except Exception as e:
            print("    keypress failed:", e)
        # give the ordered commit time to land
        for _ in range(30):
            page.wait_for_timeout(200)
            now = player()
            if now["rev"] != page_before["rev"]:
                break
        after = player()
        delta = (abs((after["x"] or 0) - (page_before["x"] or 0)) +
                 abs((after["y"] or 0) - (page_before["y"] or 0)))
        print("    %-11s rev %s -> %s   pos (%s,%s) -> (%s,%s)  moved=%d"
              % (k, page_before["rev"], after["rev"],
                 page_before["x"], page_before["y"], after["x"], after["y"], delta))
        if delta > 0:
            moved += 1

    final = player()
    print("    player after :", final)

    check("player position changed on keypress", moved > 0,
          "moved on %d of %d presses" % (moved, tried))
    check("stateRevision advanced", final["rev"] != before["rev"],
          "%s -> %s" % (before["rev"], final["rev"]))

    blocked = page.evaluate(
        "()=>{const t=document.body.innerText||'';return /Waiting for the current turn to confirm/i.test(t)}")
    check("no 'waiting to confirm' block", not blocked)
    check("no page errors", not errs, "; ".join(errs[:3]))

    b.close()

bad = [r for r in results if not r[1]]
print()
print("RESULT: %d/%d passed" % (len(results) - len(bad), len(results)))
sys.exit(0 if not bad else 1)
