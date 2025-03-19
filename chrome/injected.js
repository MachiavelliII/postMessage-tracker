(function (pushstate, msgeventlistener, msgporteventlistener) {
  const loaded = { value: false };
  const originalFunctionToString = Function.prototype.toString;

  const m = (detail) => {
    window.postMessage({ type: "postMessageTracker", detail }, "*");
  };

  const h = (p) => {
    let hops = "";
    try {
      if (!p) p = window;
      if (p.top !== p && p.top === window.top) {
        let w = p;
        while (top !== w) {
          let x = 0;
          for (let i = 0; i < w.parent.frames.length; i++) {
            if (w === w.parent.frames[i]) x = i;
          }
          hops = `frames[${x}]` + (hops.length ? "." : "") + hops;
          w = w.parent;
        }
        hops = "top" + (hops.length ? "." + hops : "");
      } else {
        hops = p.top === window.top ? "top" : "diffwin";
      }
    } catch (e) {}
    return hops;
  };

  const jq = (instance) => {
    if (!instance || !instance.message || !instance.message.length) return;
    instance.message.forEach((e) => {
      const listener = e.handler;
      if (!listener) return;
      m({
        window: window.top === window ? "top" : window.name,
        hops: h(),
        domain: document.domain,
        stack: "jQuery",
        listener: listener.toString(),
      });
    });
  };

  const l = (listener, pattern_before, additional_offset) => {
    const offset = 3 + (additional_offset || 0);
    let stack, fullstack;
    try {
      throw new Error("");
    } catch (error) {
      stack = error.stack || "";
    }
    stack = stack.split("\n").map((line) => line.trim());
    fullstack = stack.slice();
    if (pattern_before) {
      let nextitem = false;
      stack = stack.filter((e) => {
        if (nextitem) {
          nextitem = false;
          return true;
        }
        if (e.match(pattern_before)) nextitem = true;
        return false;
      });
      stack = stack[0];
    } else {
      stack = stack[offset];
    }
    const listener_str =
      listener.__postmessagetrackername__ || listener.toString();
    m({
      window: window.top === window ? "top" : window.name,
      hops: h(),
      domain: document.domain,
      stack,
      fullstack,
      listener: listener_str,
    });
  };

  const jqc = (key) => {
    m({
      log: [
        "Found key",
        key,
        typeof window[key],
        window[key] ? window[key].toString() : window[key],
      ],
    });
    if (
      typeof window[key] === "function" &&
      typeof window[key]._data === "function"
    ) {
      m({ log: ["found jq function", window[key].toString()] });
      const ev = window[key]._data(window, "events");
      jq(ev);
    } else if (window[key] && (expando = window[key].expando)) {
      m({ log: ["Use expando", expando] });
      let i = 1;
      while ((instance = window[expando + i++])) {
        jq(instance.events);
      }
    } else if (window[key]) {
      m({ log: ["Use events directly", window[key].toString()] });
      jq(window[key].events);
    }
  };

  const j = () => {
    m({ log: "Run jquery fetcher" });
    const all = Object.getOwnPropertyNames(window);
    for (const key of all) {
      if (key.includes("jQuery")) {
        jqc(key);
      }
    }
    loaded.value = true;
  };

  History.prototype.pushState = function (state, title, url) {
    m({ pushState: true });
    return pushstate.apply(this, arguments);
  };

  const original_setter = window.__lookupSetter__("onmessage");
  window.__defineSetter__("onmessage", function (listener) {
    if (listener) {
      l(listener.toString());
    }
    original_setter(listener);
  });

  const c = (listener) => {
    const listener_str = originalFunctionToString.apply(listener);
    if (listener_str.match(/\.deep.*apply.*captureException/s)) return "raven";
    else if (
      listener_str.match(/arguments.*(start|typeof).*err.*finally.*end/s) &&
      listener["nr@original"]
    )
      return "newrelic";
    else if (
      listener_str.match(/rollbarContext.*rollbarWrappedError/s) &&
      listener._isWrap
    )
      return "rollbar";
    else if (
      listener_str.match(/autoNotify.*(unhandledException|notifyException)/s) &&
      typeof listener.bugsnag === "function"
    )
      return "bugsnag";
    else if (
      listener_str.match(/call.*arguments.*typeof.*apply/s) &&
      typeof listener.__sentry_original__ === "function"
    )
      return "sentry";
    else if (
      listener_str.match(/function.*function.*\.apply.*arguments/s) &&
      typeof listener.__trace__ === "function"
    )
      return "bugsnag2";
    return false;
  };

  const onmsgport = (e) => {
    const p = e.ports.length ? `%cport${e.ports.length}%c ` : "";
    const msg = `%cport%c→%c${h(e.source)}%c ${p}${
      typeof e.data === "string" ? e.data : "j " + JSON.stringify(e.data)
    }`;
    console.log(msg, "color: blue", "", "color: red", "", "color: blue", "");
  };

  const onmsg = (e) => {
    const p = e.ports.length ? `%cport${e.ports.length}%c ` : "";
    const msg = `%c${h(e.source)}%c→%c${h()}%c ${p}${
      typeof e.data === "string" ? e.data : "j " + JSON.stringify(e.data)
    }`;
    console.log(msg, "color: red", "", "color: green", "", "color: blue", "");
  };

  window.addEventListener("message", onmsg);

  MessagePort.prototype.addEventListener = function (
    type,
    listener,
    useCapture
  ) {
    if (!this.__postmessagetrackername__) {
      this.__postmessagetrackername__ = true;
      this.addEventListener("message", onmsgport);
    }
    return msgporteventlistener.apply(this, arguments);
  };

  Window.prototype.addEventListener = function (type, listener, useCapture) {
    if (type === "message" && typeof listener === "function") {
      let pattern_before = false,
        offset = 0;
      if (listener.toString().includes("event.dispatch.apply")) {
        m({ log: "We got a jquery dispatcher" });
        pattern_before = /init\.on|init\..*on\]/;
        if (loaded.value) setTimeout(j, 100);
      }

      const unwrap = (listener) => {
        const found = c(listener);
        if (found === "raven") {
          let fb = 0,
            ff = 0,
            f = null;
          for (const key in listener) {
            const v = listener[key];
            if (typeof v === "function") {
              ff++;
              f = v;
            }
            if (typeof v === "boolean") fb++;
          }
          if (ff === 1 && fb === 1) {
            m({ log: "We got a raven wrapper" });
            offset++;
            return unwrap(f);
          }
        } else if (found === "newrelic") {
          m({ log: "We got a newrelic wrapper" });
          offset++;
          return unwrap(listener["nr@original"]);
        } else if (found === "sentry") {
          m({ log: "We got a sentry wrapper" });
          offset++;
          return unwrap(listener["__sentry_original__"]);
        } else if (found === "rollbar") {
          m({ log: "We got a rollbar wrapper" });
          offset += 2;
        } else if (found === "bugsnag") {
          offset++;
          let clr = null;
          try {
            clr = arguments.callee.caller.caller.caller;
          } catch (e) {}
          if (clr && !c(clr)) {
            m({ log: "We got a bugsnag wrapper" });
            listener.__postmessagetrackername__ = clr.toString();
          }
        } else if (found === "bugsnag2") {
          offset++;
          let clr = null;
          try {
            clr = arguments.callee.caller.caller.arguments[1];
          } catch (e) {}
          if (clr && !c(clr)) {
            m({ log: "We got a bugsnag2 wrapper" });
            return unwrap(clr);
          }
        }
        if (listener.name.startsWith("bound ")) {
          listener.__postmessagetrackername__ = listener.name;
        }
        return listener;
      };

      l(unwrap(listener), pattern_before, offset);
    }
    return msgeventlistener.apply(this, arguments);
  };

  window.addEventListener("load", j);
  window.addEventListener("postMessageTrackerUpdate", j);

  // Notify content script that injection is complete
  window.postMessage({ type: "postMessageTrackerInit" }, "*");
})(
  History.prototype.pushState,
  Window.prototype.addEventListener,
  MessagePort.prototype.addEventListener
);
