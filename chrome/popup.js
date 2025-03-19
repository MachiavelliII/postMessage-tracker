// Establish a connection to the background service worker
const port = chrome.runtime.connect({ name: "Sample Communication" });

// Load listener data and update UI
function loaded() {
  port.postMessage("get-stuff");

  port.onMessage.addListener((msg) => {
    console.log("Message received:", msg);
    if (!msg || !msg.listeners) {
      document.getElementById("h").innerText = "No data available";
      return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0) {
        document.getElementById("h").innerText = "No active tab found";
        return;
      }
      const selectedId = tabs[0].id;
      listListeners(msg.listeners[selectedId] || []);
    });
  });

  // Handle disconnection if the service worker terminates
  port.onDisconnect.addListener(() => {
    console.error("Disconnected from background script");
    document.getElementById("h").innerText =
      "Connection lost. Please try again.";
  });
}

// Display listeners in the popup
function listListeners(listeners) {
  const x = document.getElementById("x");
  x.parentElement.removeChild(x);
  const newX = document.createElement("ol");
  newX.id = "x";

  document.getElementById("h").innerText = listeners.length
    ? listeners[0].parent_url
    : "";

  for (const listener of listeners) {
    const el = document.createElement("li");

    const bel = document.createElement("b");
    bel.innerText = listener.domain + " ";
    const win = document.createElement("code");
    win.innerText = " " + (listener.window || "") + " " + (listener.hops || "");
    el.appendChild(bel);
    el.appendChild(win);

    const sel = document.createElement("span");
    if (listener.fullstack)
      sel.setAttribute("title", listener.fullstack.join("\n\n"));
    sel.appendChild(document.createTextNode(listener.stack));
    el.appendChild(sel);

    const pel = document.createElement("pre");
    pel.innerText = listener.listener;
    el.appendChild(pel);

    newX.appendChild(el);
  }
  document.getElementById("content").appendChild(newX);
}

// Load when DOM is ready
document.addEventListener("DOMContentLoaded", loaded);
