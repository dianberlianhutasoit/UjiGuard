"use strict";

// Minimal in-memory WebRTC signaling plus static file server for the demo.
// Media never passes through this process; it only relays SDP and ICE metadata.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const port = Number(process.env.PORT || 8000);
const messages = [];
const presence = new Map();
const monitoringEvents = [];
let sequence = 0;
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg" };

function send(res, status, data, type = "application/json; charset=utf-8") {
  res.writeHead(status, { "content-type": type, "cache-control": "no-store" });
  res.end(type.startsWith("application/json") ? JSON.stringify(data) : data);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (url.pathname === "/presence" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => { body += chunk; if (body.length > 4096) req.destroy(); });
    req.on("end", () => {
      try {
        const item = JSON.parse(body);
        if (item.room !== "A-01" || !["station", "offline"].includes(item.state)) return send(res, 400, { error: "Invalid presence" });
        if (item.state === "station") {
          const source = item.session && typeof item.session === "object" ? item.session : {};
          const session = {};
          ["participantId", "name", "examId", "sessionId", "cameraStatus", "microphoneStatus", "screenStatus", "monitoringStatus", "joinedAt"].forEach((key) => {
            if (source[key] != null) session[key] = String(source[key]).slice(0, 120);
          });
          presence.set("A-01", { lastSeen: Date.now(), session });
        }
        else presence.delete("A-01");
        send(res, 202, { ok: true });
      } catch (_) { send(res, 400, { error: "Invalid JSON" }); }
    });
    return;
  }
  if (url.pathname === "/presence" && req.method === "GET") {
    const item = presence.get("A-01") || null;
    const online = !!item && Date.now() - item.lastSeen < 7000;
    return send(res, 200, { online, lastSeen: item?.lastSeen || null, session: online ? item.session : null });
  }
  if (url.pathname === "/monitoring-events" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => { body += chunk; if (body.length > 4096) req.destroy(); });
    req.on("end", () => {
      try {
        const item = JSON.parse(body);
        const allowedTypes = ["MONITORING_STARTED", "SCREEN_STARTED", "SCREEN_STOPPED", "PAGE_VISIBILITY_CHANGED", "CONNECTION_LOST", "CONNECTION_RESTORED", "CAMERA_OFF", "CAMERA_ON", "MIC_OFF", "MIC_ON"];
        if (!/^PST-\d{3}$/.test(String(item.participantId || "")) || !/^SESSION-\d{2}$/.test(String(item.sessionId || "")) || !allowedTypes.includes(item.type)) return send(res, 400, { error: "Invalid monitoring event" });
        monitoringEvents.push({ id: `REMOTE-${++sequence}`, originEventId: String(item.originEventId || "").slice(0, 80), participantId: String(item.participantId), sessionId: String(item.sessionId), timestamp: new Date().toISOString(), type: item.type, severity: item.severity === "warning" ? "warning" : "info", source: "Browser / Monitoring", title: String(item.title || "Aktivitas monitoring").slice(0, 120), description: String(item.description || "").slice(0, 300), isSimulation: false, reviewStatus: "PENDING" });
        while (monitoringEvents.length > 500) monitoringEvents.shift();
        send(res, 202, { ok: true });
      } catch (_) { send(res, 400, { error: "Invalid JSON" }); }
    });
    return;
  }
  if (url.pathname === "/monitoring-events" && req.method === "GET") {
    const cursor = Number(url.searchParams.get("since")) || 0;
    const events = monitoringEvents.filter((item) => Number(item.id.slice(7)) > cursor);
    const next = events.length ? Number(events[events.length - 1].id.slice(7)) : cursor;
    return send(res, 200, { events, cursor: next });
  }
  if (url.pathname === "/signal" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => { body += chunk; if (body.length > 32768) req.destroy(); });
    req.on("end", () => {
      try {
        const item = JSON.parse(body);
        if (item.room !== "A-01" || !["station", "proctor"].includes(item.from) || !["station", "proctor"].includes(item.to) || item.from === item.to || !["offer", "answer", "candidate", "hangup"].includes(item.type)) return send(res, 400, { error: "Invalid signaling message" });
        messages.push({ ...item, seq: ++sequence, at: Date.now() });
        while (messages.length && (messages[0].at < Date.now() - 120000 || messages.length > 300)) messages.shift();
        send(res, 202, { ok: true });
      } catch (_) { send(res, 400, { error: "Invalid JSON" }); }
    });
    return;
  }
  if (url.pathname === "/signal" && req.method === "GET") {
    const peer = url.searchParams.get("peer");
    if (!["station", "proctor"].includes(peer)) return send(res, 400, { error: "Invalid peer" });
    if (url.searchParams.get("since") === "latest") return send(res, 200, { messages: [], cursor: sequence });
    const since = Number(url.searchParams.get("since") || 0);
    const found = messages.filter((item) => item.to === peer && item.seq > since);
    return send(res, 200, { messages: found, cursor: sequence });
  }
  if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, { error: "Method not allowed" });
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch (_) { return send(res, 400, "Bad path", "text/plain; charset=utf-8"); }
  const filename = path.resolve(root, `.${pathname === "/" ? "/index.html" : pathname}`);
  if (filename !== root && !filename.startsWith(root + path.sep)) return send(res, 403, "Forbidden", "text/plain; charset=utf-8");
  fs.readFile(filename, (error, data) => {
    if (error) return send(res, 404, "Not found", "text/plain; charset=utf-8");
    res.writeHead(200, { "content-type": mime[path.extname(filename)] || "application/octet-stream", "cache-control": "no-store" });
    res.end(req.method === "HEAD" ? undefined : data);
  });
});

server.listen(port, "0.0.0.0", () => console.log(`Tervia demo server listening on http://localhost:${port}`));
