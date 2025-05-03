document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("settings-form");
  const apiKeyInput = document.getElementById("api-key");
  const statusDiv = document.getElementById("status");

  // Load saved API key
  chrome.storage.sync.get(["openai_api_key"], function (result) {
    if (result.openai_api_key) {
      apiKeyInput.value = result.openai_api_key;
    }
  });

  // Save API key when form is submitted
  form.addEventListener("submit", function (e) {
    e.preventDefault();

    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
      showStatus("Please enter a valid API key", false);
      return;
    }

    if (!apiKey.startsWith("sk-")) {
      showStatus('API key should start with "sk-"', false);
      return;
    }

    // Save to chrome.storage
    chrome.storage.sync.set(
      {
        openai_api_key: apiKey,
      },
      function () {
        showStatus("API key saved successfully!", true);
      }
    );
  });

  function showStatus(message, isSuccess) {
    statusDiv.textContent = message;
    statusDiv.className = "status " + (isSuccess ? "success" : "error");

    setTimeout(function () {
      statusDiv.textContent = "";
      statusDiv.className = "status";
    }, 3000);
  }
});
