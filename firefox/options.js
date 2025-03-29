function save_options() {
  const log_url = document.getElementById("log-url").value;
  chrome.storage.sync.set({ log_url: log_url || "" }, () => {
    if (chrome.runtime.lastError) {
      console.error("Error saving options:", chrome.runtime.lastError);
      return;
    }
    const status = document.getElementById("status");
    status.textContent = "Options saved.";
    setTimeout(() => {
      status.textContent = "";
      window.close();
    }, 750);
  });
}

function restore_options() {
  chrome.storage.sync.get({ log_url: "" }, (items) => {
    if (chrome.runtime.lastError) {
      console.error("Error restoring options:", chrome.runtime.lastError);
      return;
    }
    document.getElementById("log-url").value = items.log_url;
  });
}

document.addEventListener("DOMContentLoaded", () => {
  restore_options();
  document.getElementById("save").addEventListener("click", save_options);
});
