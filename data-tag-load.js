/**
 * This snippet is to be used as content of a custom javascript tag, triggered on initialization.
 * It defines a function that the Data Tag can use to load its data tag script
 * so users of the Data Tag can change the source of the data tag script to
 * their own domain without having to touch the Data Tag template
 */

/**
 * The URL pattern where the data tag script can be loaded from
 * TODO: Replace the value with YOUR URL pattern
 */
var DATA_TAG_SCRIPT_URL_PATTERN = "https://cdn.stape.io/dtag/${data-script-version}.js";

/**
 * Function to load the data tag script
 * @param version The version of the script to load (defined by the Data Tag).
 * @param successCallback A callback to be run after the script loaded succeeded and with every call of this function afterwards.
 * @param errorCallback A callback to be run if the script fails to load. It will be called with an error as parameter.
 */
function loadDataTagScript(version, successCallback, errorCallback) {
  try {
    var dataTagScriptId = "dataTagScript-version-".concat(version);
    var existingScriptElement = document.getElementById(dataTagScriptId);
    var scriptFinishedLoading = existingScriptElement && existingScriptElement.hasAttribute("data-finishedLoading");
    var scriptLoadedSuccessfully = existingScriptElement && scriptFinishedLoading && typeof window.dataTagSendData !== "undefined";

    if (scriptLoadedSuccessfully) {
      if (successCallback) {
        successCallback();
      }
      return;
    } else if (existingScriptElement && scriptFinishedLoading) {
      if (errorCallback) {
        errorCallback(new Error("Failed to load/execute data tag script with version: ".concat(version)));
      }
      return;
    }

    deferCallbacks();

    if (existingScriptElement && !scriptFinishedLoading) {
      return;
    }

    var script = document.createElement("script");
    script.id = dataTagScriptId;
    var source = DATA_TAG_SCRIPT_URL_PATTERN.replace("${data-script-version}", version);
    script.src = source;

    script.onload = function() {
      script.setAttribute("data-finishedLoading", true);
      callDeferredCallbacks();
    };
    script.onerror = function() {
      script.setAttribute("data-finishedLoading", true);
      callDeferredCallbacks(new Error("Failed to load data tag script with version: ".concat(version)));
    };
    document.head.appendChild(script);
  } catch (error) {
    console.error("Error in myFunction:", error.message);
  }
  function deferCallbacks() {
    window.dataTagScriptCallbacks = window.dataTagScriptCallbacks || {};
    window.dataTagScriptCallbacks[version] = window.dataTagScriptCallbacks[version] || [];
    window.dataTagScriptCallbacks[version].push({ successCallback: successCallback, errorCallback: errorCallback });
  }
  function callDeferredCallbacks(error) {
    window.dataTagScriptCallbacks[version].forEach(function(callbackEntry) {
      if (error) {
        if (callbackEntry.errorCallback)
          callbackEntry.errorCallback(error);
      } else {
        if (callbackEntry.successCallback)
          callbackEntry.successCallback();
      }
    });
    window.dataTagScriptCallbacks[version] = [];
  }
}

