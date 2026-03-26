chrome.storage.local.set({ tasks: [...] });
chrome.storage.local.get(["tasks"], (result) => {
  console.log(result.tasks);
});