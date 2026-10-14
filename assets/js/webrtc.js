(function () {
  "use strict";
  const ROOM = "A-01";
  const ICE = [{ urls: "stun:stun.l.google.com:19302" }];
  const send = (from, to, type, payload = {}) =>
    fetch("/signal", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ room: ROOM, from, to, type, payload }),
    }).then((res) => {
      if (!res.ok) throw new Error("Signaling server tidak tersedia.");
    });
  function peerClient(role, onMessage, onError) {
    let cursor = "latest",
      stopped = false,
      busy = false,
      timer = null,
      initialized = false;
    let resolveReady;
    const ready = new Promise((resolve) => {
      resolveReady = resolve;
    });
    async function poll() {
      if (stopped || busy) return;
      busy = true;
      try {
        const response = await fetch(`/signal?peer=${role}&since=${cursor}`, {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Signaling server tidak tersedia.");
        const data = await response.json();
        cursor = Math.max(Number(cursor) || 0, Number(data.cursor) || 0);
        if (!initialized) {
          initialized = true;
          resolveReady();
        }
        for (const message of data.messages || []) await onMessage(message);
      } catch (error) {
        if (!stopped) onError?.(error);
      } finally {
        busy = false;
      }
    }
    timer = setInterval(poll, 700);
    poll();
    return {
      ready,
      post: (type, payload) =>
        send(role, role === "station" ? "proctor" : "station", type, payload),
      stop: () => {
        stopped = true;
        clearInterval(timer);
      },
    };
  }

  function startStation(getStream, getPresenceMetadata = () => null) {
    let pc = null,
      pendingCandidates = [];
    const setPresence = (state) =>
      fetch("/presence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          room: ROOM,
          state,
          session: state === "station" ? getPresenceMetadata() : null,
        }),
      }).catch(() => {});
    let presenceTimer = null;
    const client = peerClient(
      "station",
      async (message) => {
        if (message.type === "hangup") {
          pc?.close();
          pc = null;
          pendingCandidates = [];
          return;
        }
        if (message.type === "candidate") {
          if (pc?.remoteDescription)
            await pc.addIceCandidate(message.payload.candidate);
          else pendingCandidates.push(message.payload.candidate);
          return;
        }
        if (message.type !== "offer" || !getStream()) return;
        pc?.close();
        pc = new RTCPeerConnection({ iceServers: ICE });
        getStream()
          .getTracks()
          .forEach((track) => pc.addTrack(track, getStream()));
        pc.onicecandidate = ({ candidate }) => {
          if (candidate) client.post("candidate", { candidate });
        };
        pc.onconnectionstatechange = () => {
          if (
            ["failed", "closed", "disconnected"].includes(pc?.connectionState)
          ) {
            pc?.close();
            pc = null;
          }
        };
        await pc.setRemoteDescription(message.payload.description);
        for (const candidate of pendingCandidates)
          await pc.addIceCandidate(candidate);
        pendingCandidates = [];
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await client.post("answer", { description: pc.localDescription });
      },
      () => {},
    );
    client.ready.then(() => {
      setPresence("station");
      presenceTimer = setInterval(() => setPresence("station"), 2000);
    });
    return () => {
      if (presenceTimer) clearInterval(presenceTimer);
      setPresence("offline");
      client.stop();
      pc?.close();
      pc = null;
    };
  }

  function startProctor(video, onState = () => {}) {
    let pc = null,
      active = false,
      pendingCandidates = [];
    const close = (notify = true) => {
      active = false;
      pendingCandidates = [];
      if (pc) {
        pc.ontrack = null;
        pc.close();
        pc = null;
      }
      video.srcObject = null;
      onState("closed");
      if (notify) client.post("hangup", {});
    };
    const client = peerClient(
      "proctor",
      async (message) => {
        if (message.type === "hangup") {
          close(false);
          return;
        }
        if (message.type === "answer" && pc && active) {
          await pc.setRemoteDescription(message.payload.description);
          for (const candidate of pendingCandidates)
            await pc.addIceCandidate(candidate);
          pendingCandidates = [];
        } else if (message.type === "candidate" && pc && active) {
          if (pc.remoteDescription)
            await pc.addIceCandidate(message.payload.candidate);
          else pendingCandidates.push(message.payload.candidate);
        }
      },
      (error) => onState("error", error.message),
    );

    async function connect() {
      if (active) return;
      active = true;
      onState("connecting");
      try {
        await client.ready;
        pc = new RTCPeerConnection({ iceServers: ICE });
        pc.addTransceiver("video", { direction: "recvonly" });
        pc.ontrack = (event) => {
          video.srcObject = event.streams[0] || new MediaStream([event.track]);
          video.play().catch(() => {});
          onState("live", "", video.srcObject);
        };
        pc.onicecandidate = ({ candidate }) => {
          if (candidate && pc) client.post("candidate", { candidate });
        };
        pc.onconnectionstatechange = () => {
          if (pc && ["failed", "disconnected"].includes(pc.connectionState))
            onState("error", "Koneksi kamera terputus.");
        };
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await client.post("offer", { description: pc.localDescription });
      } catch (error) {
        close(false);
        onState("error", error.message);
      }
    }
    return {
      connect,
      close: () => close(true),
      stop: () => {
        close(true);
        client.stop();
      },
    };
  }
  function getStationPresence() {
    return fetch("/presence", { cache: "no-store" }).then((response) =>
      response.json(),
    );
  }
  window.UjiRtc = { startStation, startProctor, getStationPresence };
})();
