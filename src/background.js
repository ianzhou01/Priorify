chrome.runtime.onInstalled.addListener(function () {
    chrome.storage.local.set({ currentOrganization: 0 });
    chrome.storage.local.set({ algorithmChoice: Math.floor(Math.random() * 5) + 1 });;
});
