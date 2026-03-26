chrome.runtime.onInstalled.addListener(function () {
    chrome.storage.local.set({ currentOrganization: 0 });
    chrome.storage.local.set({ algorithmChoice: 0 });
});
