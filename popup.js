document.addEventListener("DOMContentLoaded", function () {
  const apiStatus = document.getElementById("api-status");
  const optionsButton = document.getElementById("options-button");

  // Check if API key is set
  chrome.storage.sync.get(["openai_api_key"], function (result) {
    if (result.openai_api_key) {
      apiStatus.innerHTML =
        '<span class="status-icon success"></span> Configured';
    } else {
      apiStatus.innerHTML =
        '<span class="status-icon error"></span> Not configured';
    }
  });

  // Open options page when button is clicked
  optionsButton.addEventListener("click", function () {
    chrome.runtime.openOptionsPage();
  });
});
