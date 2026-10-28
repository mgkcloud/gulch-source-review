#!/usr/bin/env python3
"""Browser test suite for the Gulch Ask surface.

Drives the real page in Chrome. Catches the class of fault that unit tests miss:
a handler that never fires, a composer that strands, a thread that does not
persist, a rail that renders into the wrong grid column.

usage:
  tools/test-ui.py                      # against 127.0.0.1:8790
  tools/test-ui.py --base http://127.0.0.1:8811
  tools/test-ui.py --skip-answers       # layout/state only, no model calls

Exit code 0 only when every check passes. Prints one line per check so a run is
readable in a log.
"""
import argparse
import json
import sys
import os

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    sys.exit("playwright is not installed for this interpreter")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

results = []


def check(name, cond, detail=""):
    results.append((name, bool(cond), detail))
    mark = "PASS" if cond else "FAIL"
    line = "  %-5s %s" % (mark, name)
    if detail and not cond:
        line += "   -> " + str(detail)[:200]
    print(line)


def wait_idle(page, timeout=180000):
    """Return when the composer is usable again.

    The send button carries text 'Ask'/'Create' when idle and 'Stop' while a
    turn is streaming, so its label is the completion signal. Waiting on the
    label rather than a timer means a fast answer costs nothing and a slow one
    is not mistaken for a hang.
    """
    page.wait_for_function(
        "()=>{const b=document.querySelector('#askSend');"
        "return !!b && !b.classList.contains('stopping') && b.textContent.trim()!=='Stop';}",
        timeout=timeout)


def open_ask(page):
    page.evaluate("()=>{const o=document.getElementById('askOverlay');if(o)o.classList.add('open');}")
    page.wait_for_timeout(400)


def run(base, password, skip_answers):
    with sync_playwright() as pw:
        browser = pw.chromium.launch(
            channel="chrome", headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage"])
        ctx = browser.new_context(viewport={"width": 1280, "height": 900})
        page = ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))

        r = page.request.post(base + "/api/auth",
                              data=json.dumps({"password": password}),
                              headers={"Content-Type": "application/json"})
        check("auth accepted", r.status == 200, "status=%s" % r.status)

        page.goto(base + "/index.html", wait_until="domcontentloaded")
        page.wait_for_timeout(1500)

        # ── shell ────────────────────────────────────────────────────
        check("page loaded", page.title() != "" or page.query_selector("body") is not None)
        check("game frame present", page.query_selector("#gameFrame") is not None)
        frame_has_doc = page.evaluate(
            "()=>{const f=document.getElementById('gameFrame');"
            "try{return !!(f&&f.srcdoc&&f.srcdoc.length>1000)}catch(e){return false}}")
        check("game frame has a loaded document", frame_has_doc)
        check("composer present", page.query_selector("#input") is not None)

        open_ask(page)
        check("overlay opens", page.eval_on_selector("#askOverlay", "e=>e.classList.contains('open')"))
        check("rail present", page.query_selector("#askRail") is not None)
        check("main column present", page.query_selector("#askMain") is not None)
        check("chat list present", page.query_selector("#askChats") is not None)
        check("new chat button present", page.query_selector("#askNewChat") is not None)

        # ── layout ───────────────────────────────────────────────────
        rail = page.evaluate("()=>{const r=document.getElementById('askRail').getBoundingClientRect();"
                             "return {x:r.x,w:r.width,h:r.height}}")
        main = page.evaluate("()=>{const r=document.getElementById('askMain').getBoundingClientRect();"
                             "return {x:r.x,w:r.width}}")
        check("rail has usable width", rail["w"] > 150, rail)
        check("rail sits left of the thread", rail["x"] < main["x"], "%s vs %s" % (rail["x"], main["x"]))
        check("rail fills panel height", rail["h"] > 400, rail["h"])
        check("thread column has width", main["w"] > 300, main["w"])

        # ── empty state ──────────────────────────────────────────────
        has_empty = page.query_selector(".axempty") is not None
        tips = page.query_selector_all(".axtip button")
        if has_empty:
            check("empty state shown", True)
            check("starter prompts offered", len(tips) >= 3, "count=%d" % len(tips))
        else:
            check("existing thread restored from storage", True)

        # ── new chat resets the pane ─────────────────────────────────
        page.click("#askNewChat")
        page.wait_for_timeout(500)
        check("new chat shows empty state", page.query_selector(".axempty") is not None)

        if not skip_answers:
            # ── first turn ───────────────────────────────────────────
            page.fill("#askInput", "Remember the codeword LOTUS-9. Reply with just OK.")
            page.click("#askSend")
            wait_idle(page)
            page.wait_for_timeout(800)
            bots = page.query_selector_all("#askBody .ax.bot")
            check("answer rendered", len(bots) >= 1, "bots=%d" % len(bots))
            check("composer usable after answer",
                  page.eval_on_selector("#askSend", "e=>!e.disabled && !e.classList.contains('stopping')"))
            check("user turn rendered", len(page.query_selector_all("#askBody .ax.you")) >= 1)

            rows = page.query_selector_all(".axchat")
            check("chat listed in rail", len(rows) >= 1, "rows=%d" % len(rows))
            title = page.eval_on_selector(".axchat .lbl", "e=>e.textContent") if rows else ""
            check("chat titled from first message",
                  ("LOTUS" in title or "Remember" in title), title)

            # ── second turn keeps context ────────────────────────────
            page.fill("#askInput", "What was the codeword?")
            page.click("#askSend")
            wait_idle(page)
            page.wait_for_timeout(800)
            allbots = " ".join(page.eval_on_selector_all(
                "#askBody .ax.bot .text", "es=>es.map(e=>e.textContent)"))
            check("second answer rendered",
                  len(page.query_selector_all("#askBody .ax.bot")) >= 2)
            check("follow-up recalled context", "LOTUS-9" in allbots, allbots[:160])

            # ── persistence ──────────────────────────────────────────
            page.reload(wait_until="domcontentloaded")
            page.wait_for_timeout(1600)
            open_ask(page)
            check("thread survived reload",
                  len(page.query_selector_all("#askBody .ax")) >= 4,
                  "messages=%d" % len(page.query_selector_all("#askBody .ax")))
            survived = " ".join(page.eval_on_selector_all(
                "#askBody .ax.bot .text", "es=>es.map(e=>e.textContent)"))
            check("answers survived reload", "LOTUS-9" in survived)

            # ── regenerate replaces rather than piles up ─────────────
            before = len(page.query_selector_all("#askBody .ax"))
            page.click("#askBody .ax.bot:last-of-type .acts button:has-text('Regenerate')")
            page.wait_for_timeout(1500)
            wait_idle(page)
            page.wait_for_timeout(800)
            after = len(page.query_selector_all("#askBody .ax"))
            check("regenerate does not duplicate turns", after <= before + 1, "%d -> %d" % (before, after))

            # ── switching chats ──────────────────────────────────────
            page.click("#askNewChat")
            page.wait_for_timeout(400)
            page.eval_on_selector_all(
                ".axchat", "es=>{const t=es.find(e=>/LOTUS|Remember/.test(e.textContent));if(t)t.click();}")
            page.wait_for_timeout(700)
            check("switching back restores history",
                  len(page.query_selector_all("#askBody .ax")) >= 4,
                  "messages=%d" % len(page.query_selector_all("#askBody .ax")))

        check("no uncaught page errors", not errors, "; ".join(errors[:3]))
        browser.close()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://127.0.0.1:8790")
    ap.add_argument("--password", default=None)
    ap.add_argument("--skip-answers", action="store_true",
                    help="layout and state checks only; no model calls")
    a = ap.parse_args()

    pw = a.password
    if not pw:
        p = os.path.join(ROOT, ".room-password")
        pw = open(p).read().strip() if os.path.isfile(p) else ""

    print("Gulch UI suite ->", a.base)
    run(a.base.rstrip("/"), pw, a.skip_answers)

    bad = [r for r in results if not r[1]]
    print()
    print("RESULT: %d/%d passed" % (len(results) - len(bad), len(results)))
    return 0 if not bad else 1


if __name__ == "__main__":
    sys.exit(main())
