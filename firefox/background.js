let tab_listeners = {};
let tab_push = {};
let tab_lasturl = {};
let selectedId = -1;

// Load state on service worker startup
async function loadState() {
  const result = await chrome.storage.local.get([
    "tab_listeners",
    "tab_push",
    "tab_lasturl",
    "selectedId",
  ]);
  tab_listeners = result.tab_listeners || {};
  tab_push = result.tab_push || {};
  tab_lasturl = result.tab_lasturl || {};
  selectedId = result.selectedId || -1;
}

// Save state after changes
async function saveState() {
  await chrome.storage.local.set({
    tab_listeners,
    tab_push,
    tab_lasturl,
    selectedId,
  });
}

// Initialize state
loadState().then(() => console.log("State loaded"));

function refreshCount() {
  const txt = tab_listeners[selectedId] ? tab_listeners[selectedId].length : 0;
  chrome.tabs.get(selectedId, (tab) => {
    if (!chrome.runtime.lastError && tab) {
      chrome.action.setBadgeText({ text: txt.toString(), tabId: selectedId });
      chrome.action.setBadgeBackgroundColor({
        color: txt > 0 ? [255, 0, 0, 255] : [0, 0, 255, 0],
        tabId: selectedId,
      });
    }
  });
}

function logListener(data) {
  chrome.storage.sync.get({ log_url: "" }, (items) => {
    const log_url = items.log_url;
    if (!log_url) return;
    fetch(log_url, {
      method: "POST",
      headers: { "Content-type": "application/json; charset=UTF-8" },
      body: JSON.stringify(data),
    }).catch((e) => console.error("Log fetch failed:", e));
  });
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  const tabId = sender.tab.id;
  console.log("Message from content script:", msg);

  if (msg.type === "injectScript") {
    chrome.scripting
      .executeScript({
        target: { tabId: tabId, allFrames: true },
        files: ["injected.js"],
        world: "MAIN",
      })
      .catch((e) => console.error("Script injection failed:", e));
    return;
  }

  if (msg.listener) {
    if (msg.listener === "function () { [native code] }") return;
    msg.parent_url = sender.tab.url;
    tab_listeners[tabId] = tab_listeners[tabId] || [];
    tab_listeners[tabId].push(msg);
    logListener(msg);
    saveState();
  }
  if (msg.pushState) {
    tab_push[tabId] = true;
    saveState();
  }
  if (msg.changePage) {
    delete tab_lasturl[tabId];
    saveState();
  }
  if (msg.log) {
    console.log(msg.log);
  } else {
    refreshCount();
  }
});

chrome.tabs.onUpdated.addListener((tabId, props) => {
  console.log("Tab updated:", props);
  if (props.status === "complete") {
    if (tabId === selectedId) refreshCount();
  } else if (props.status) {
    if (tab_push[tabId]) {
      delete tab_push[tabId];
    } else if (!tab_lasturl[tabId]) {
      tab_listeners[tabId] = [];
    }
  }
  if (props.status === "loading") {
    tab_lasturl[tabId] = true;
  }
  saveState();
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  selectedId = activeInfo.tabId;
  refreshCount();
  saveState();
});

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs && tabs.length > 0) {
    selectedId = tabs[0].id;
    refreshCount();
    saveState();
  }
});

chrome.runtime.onConnect.addListener((port) => {
  port.onMessage.addListener((msg) => {
    port.postMessage({ listeners: tab_listeners });
  });
});
