chrome.runtime.onInstalled.addListener(function () {
  chrome.storage.local.set({ currentOrganization: 0 });
  chrome.storage.local.set({ algorithmChoice: Math.floor(Math.random() * 5) + 1 });
});

//  Timer state 
// Persisted in chrome.storage.local so it survives service worker sleep:
//   priorify_timer: { taskName, endsAt, pausedAt, secondsLeft, running }
//
// endsAt:      epoch ms when the alarm should fire (set when running)
// pausedAt:    epoch ms when pause was pressed (set when paused, else null)
// secondsLeft: authoritative remaining seconds (updated on pause/stop)

const ALARM_NAME = 'priorify_timer';

function startTimer(taskName, duration) {
  const endsAt = Date.now() + duration * 1000;
  chrome.storage.local.set({
    priorify_timer: { taskName, endsAt, pausedAt: null, secondsLeft: duration, running: true }
  });
  chrome.alarms.create(ALARM_NAME, { when: endsAt });
}

function pauseTimer() {
  chrome.storage.local.get('priorify_timer', function (result) {
    const t = result.priorify_timer;
    if (!t || !t.running) return;

    if (t.pausedAt) {
      // Resume: push endsAt forward by how long we were paused
      const pausedMs = Date.now() - t.pausedAt;
      const newEndsAt = t.endsAt + pausedMs;
      chrome.alarms.create(ALARM_NAME, { when: newEndsAt });
      chrome.storage.local.set({
        priorify_timer: { ...t, endsAt: newEndsAt, pausedAt: null }
      });
    } else {
      // Pause: cancel alarm, snapshot remaining seconds
      chrome.alarms.clear(ALARM_NAME);
      const secondsLeft = Math.max(0, Math.round((t.endsAt - Date.now()) / 1000));
      chrome.storage.local.set({
        priorify_timer: { ...t, pausedAt: Date.now(), secondsLeft }
      });
    }
  });
}

function stopTimer() {
  chrome.alarms.clear(ALARM_NAME);
  chrome.storage.local.set({ priorify_timer: { running: false } });
}

function getState(sendResponse) {
  chrome.storage.local.get('priorify_timer', function (result) {
    const t = result.priorify_timer;
    if (!t || !t.running) {
      sendResponse({ running: false });
      return;
    }

    let secondsLeft;
    if (t.pausedAt) {
      secondsLeft = t.secondsLeft;
    } else {
      secondsLeft = Math.max(0, Math.round((t.endsAt - Date.now()) / 1000));
    }

    sendResponse({
      running: true,
      taskName: t.taskName,
      secondsLeft,
      paused: !!t.pausedAt
    });
  });
}

//  Message handler 
chrome.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
  if (msg.type === 'START_TIMER') startTimer(msg.taskName, msg.duration);
  if (msg.type === 'PAUSE_TIMER') pauseTimer();
  if (msg.type === 'STOP_TIMER')  stopTimer();
  if (msg.type === 'GET_STATE')   { getState(sendResponse); return true; }
});

//  Alarm fired = timer expired 
chrome.alarms.onAlarm.addListener(function (alarm) {
  if (alarm.name !== ALARM_NAME) return;
  chrome.storage.local.set({ priorify_timer: { running: false, expired: true } });
  chrome.notifications.create('priorify_done', {
    type: 'basic',
    iconUrl: '../icons/icon48.png',
    title: 'Time\'s up!',
    message: 'Your Priorify session is complete. Nice work!'
  });
  const isFirefox = navigator.userAgent.includes('Firefox');
  if (isFirefox) {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/popup.html') });
  } else {
    chrome.windows.create({
      url: chrome.runtime.getURL('src/popup.html'),
      type: 'popup',
      width: 400,
      height: 600,
      focused: true
    });
  }
});
