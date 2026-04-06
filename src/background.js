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

const CHECKIN_WIN_KEY = 'priorify_checkin_win';

function openOrFocusCheckinWindow(url) {
  chrome.storage.local.get(CHECKIN_WIN_KEY, function (stored) {
    const existing = stored[CHECKIN_WIN_KEY];
    if (existing) {
      if (existing.type === 'window') {
        chrome.windows.get(existing.id, function (win) {
          if (chrome.runtime.lastError || !win) {
            chrome.storage.local.remove(CHECKIN_WIN_KEY);
            createCheckinWindow(url);
          } else {
            chrome.windows.update(existing.id, { focused: true });
          }
        });
      } else {
        chrome.tabs.get(existing.id, function (tab) {
          if (chrome.runtime.lastError || !tab) {
            chrome.storage.local.remove(CHECKIN_WIN_KEY);
            createCheckinWindow(url);
          } else {
            chrome.tabs.update(existing.id, { active: true });
          }
        });
      }
    } else {
      createCheckinWindow(url);
    }
  });
}

function createCheckinWindow(url) {
  const isFirefox = navigator.userAgent.includes('Firefox');
  if (isFirefox) {
    chrome.tabs.create({ url }, function (tab) {
      chrome.storage.local.set({ [CHECKIN_WIN_KEY]: { type: 'tab', id: tab.id } });
    });
  } else {
    chrome.windows.create({ url, type: 'popup', width: 400, height: 600, focused: true }, function (win) {
      chrome.storage.local.set({ [CHECKIN_WIN_KEY]: { type: 'window', id: win.id } });
    });
  }
}

// Clean up stored ID when the window/tab is closed
chrome.windows.onRemoved.addListener(function (windowId) {
  chrome.storage.local.get(CHECKIN_WIN_KEY, function (result) {
    const existing = result[CHECKIN_WIN_KEY];
    if (existing && existing.type === 'window' && existing.id === windowId) {
      chrome.storage.local.remove(CHECKIN_WIN_KEY);
    }
  });
});

chrome.tabs.onRemoved.addListener(function (tabId) {
  chrome.storage.local.get(CHECKIN_WIN_KEY, function (result) {
    const existing = result[CHECKIN_WIN_KEY];
    if (existing && existing.type === 'tab' && existing.id === tabId) {
      chrome.storage.local.remove(CHECKIN_WIN_KEY);
    }
  });
});

//  Alarm fired = timer expired
chrome.alarms.onAlarm.addListener(function (alarm) {
  if (alarm.name !== ALARM_NAME) return;
  chrome.storage.local.get('priorify_timer', function (result) {
    const taskName = (result.priorify_timer || {}).taskName || '';
    chrome.storage.local.set({ priorify_timer: { running: false, expired: true, taskName } }, function () {
      chrome.notifications.create('priorify_done', {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon48.png'),
        title: 'Time\'s up!',
        message: 'Your Priorify session is complete. Nice work!'
      });
      const base = chrome.runtime.getURL('src/popup.html');
      const url = base + '?checkin=' + encodeURIComponent(taskName);
      openOrFocusCheckinWindow(url);
    });
  });
});
