// Listen for messages from the main world
window.addEventListener("message", (event) => {
  if (event.source !== window) return; // Only handle messages from the same window
  if (event.data.type === "postMessageTracker") {
    chrome.runtime.sendMessage(event.data.detail);
  }
});

// Trigger injection when the page starts
document.addEventListener("DOMContentLoaded", () => {
  if (
    document.contentType === "application/xml" ||
    document.contentType === "application/xhtml+xml"
  )
    return;
  chrome.runtime.sendMessage({ type: "injectScript" });
});

// Handle page unload
window.addEventListener("beforeunload", () => {
  chrome.runtime.sendMessage({ changePage: true });
});
