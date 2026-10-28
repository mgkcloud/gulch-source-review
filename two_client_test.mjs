/* Two-client realtime proof: both must see the same board, and a move from one
   must appear on the other without the other polling. */
const BASE = process.env.BASE || "http://127.0.0.1:8790";
import fs from "node:fs";
const PW = fs.readFileSync("/home/mgk/clawd/workspace/gulch-seed/.room-password", "utf8").trim();

function login() {
  return fetch(BASE + "/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: PW }),
  }).then((r) => {
    if (!r.ok) throw new Error("login failed " + r.status);
    return (r.headers.getSetCookie ? r.headers.getSetCookie() : [])
      .map((c) => c.split(";")[0]).join("; ");
  });
}

function openStream(cookie, label, seen) {
  return new Promise((resolve, reject) => {
    const ac = new AbortController();
    fetch(BASE + "/api/events", { headers: { Cookie: cookie }, signal: ac.signal })
      .then(async (res) => {
        if (!res.ok) return reject(new Error(label + " stream " + res.status));
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        const t = setTimeout(() => ac.abort(), 9000);
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf("\n\n")) >= 0) {
            const chunk = buf.slice(0, i);
            buf = buf.slice(i + 2);
            const line = chunk.split("\n").find((l) => l.startsWith("data: "));
            if (!line) continue;
            try {
              const s = JSON.parse(line.slice(6));
              seen.push({ label, t: Date.now(), snap: s });
              if (seen.filter((x) => x.label === label).length === 1) resolve(s);
            } catch { /* partial frame */ }
          }
        }
        clearTimeout(t);
      })
      .catch((e) => { if (e.name !== "AbortError") reject(e); });
  });
}

(async () => {
  const a = await login();
  const b = await login();
  const seen = [];
  const pa = openStream(a, "A", seen);
  const pb = openStream(b, "B", seen);
  const [sa, sb] = await Promise.all([pa, pb]);
  console.log("initial: A player", sa.player.x + "," + sa.player.y, "| B player", sb.player.x + "," + sb.player.y,
    "| same:", sa.player.x === sb.player.x && sa.player.y === sb.player.y);
  console.log("clients on A:", sa.clients, "| clients on B:", sb.clients);

  // A moves. B must observe it without doing anything.
  const before = Date.now();
  await fetch(BASE + "/api/move", {
    method: "POST", headers: { "Content-Type": "application/json", Cookie: a },
    body: JSON.stringify({ dx: 2, dy: 0 }),
  });
  const bMoves = seen.filter((x) => x.label === "B" && x.snap.player.x === sa.player.x + 2);
  await new Promise((r) => setTimeout(r, 2500));
  const after = seen.filter((x) => x.label === "B" && x.snap.turn > sb.turn);
  console.log("B observed A's move without polling:", after.length > 0,
    "| frames:", after.length, "| latency ms:", after.length ? after[0].t - before : "n/a");

  // chat from B must land on A
  const seenA0 = seen.filter((x) => x.label === "A").length;
  await fetch(BASE + "/api/chat", {
    method: "POST", headers: { "Content-Type": "application/json", Cookie: b },
    body: JSON.stringify({ text: "two-client realtime test" }),
  });
  await new Promise((r) => setTimeout(r, 1500));
  const aChat = seen.slice(seenA0).filter((x) => x.label === "A" && x.snap.chat.some((c) => c.text === "two-client realtime test"));
  console.log("A received B's chat:", aChat.length > 0);

  const last = seen[seen.length - 1].snap;
  console.log("final turn:", last.turn, "| players:", last.clients, "| chat entries:", last.chat.length);
  const ok = before && after.length > 0 && aChat.length > 0 && sa.player.x === sb.player.x;
  console.log(ok ? "TWO_CLIENT_REALTIME_OK" : "TWO_CLIENT_REALTIME_FAIL");
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
