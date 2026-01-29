// START OF FILE popup.js (ปรับปรุงใหม่ทั้งหมด)

console.log('[popup] script loaded');

let tasks = [];
let nextId = 1;
let isStopped = false;
let exportDirHandle = null;

// --- DOM Elements ---
const taskListEl = document.getElementById('taskList');
const taskInputEl = document.getElementById('taskInput');
const runBtn = document.getElementById('runBtn');
const saveBtn = document.getElementById('saveBtn');
const manageBtn = document.getElementById('manageBtn');
const reloadBtn = document.getElementById('reloadBtn');
const clearBtn = document.getElementById('clearBtn');
const retryBtn = document.getElementById('retryBtn');
const stopContinueBtn = document.getElementById('stopContinueBtn');
const exportBtn = document.getElementById('exportBtn');
const autoExportChk = document.getElementById('autoExportChk');
const speedSlider = document.getElementById('speedSlider');
const speedValue = document.getElementById('speedValue');
const forceStopBtn = document.getElementById('forceStopBtn');

// --- Functions ---
const render = () => {
    taskListEl.innerHTML = '';
    
    // ★★★ ตรรกะใหม่ในการแสดงผล ★★★
    const allTasksDone = tasks.every(t => t.status === 'done');
    let tasksToDisplay = tasks;

    if (!allTasksDone) {
        // ถ้ายังทำไม่เสร็จทั้งหมด: กรองอันที่ done ออกไป ยกเว้นอันล่าสุด
        let lastDoneIndex = -1;
        for (let i = tasks.length - 1; i >= 0; i--) {
            if (tasks[i].status === 'done') {
                lastDoneIndex = i;
                break;
            }
        }
        tasksToDisplay = tasks.filter((task, index) => task.status !== 'done' || index === lastDoneIndex);
    } // ถ้าเสร็จหมดแล้ว (else): ให้แสดงทุกอันที่_done_

    tasksToDisplay.forEach(task => {
        const li = document.createElement('li');
        li.className = 'task-item';
        if (task.status) li.classList.add(task.status);
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.value = task.status === 'done' ? `✓ ${task.text}` : task.text;
        inp.disabled = task.status === 'done';
        inp.oninput = e => { task.text = e.target.value; saveTasksToStorage(); };
        const del = document.createElement('button');
        del.textContent = 'ลบ';
        del.onclick = () => { tasks = tasks.filter(t => t.id !== task.id); saveTasksToStorage(); render(); };
        li.append(inp, del);
        taskListEl.appendChild(li);
    });
};

const saveTasksToStorage = () => {
  chrome.storage.local.set({ tasks: tasks });
};

// --- Event Listeners ---
taskInputEl.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const lines = e.target.value.split('\n').map(l => l.trim()).filter(Boolean);
        const newTasks = lines.map(line => ({ id: nextId++, text: line, status: 'pending' }));
        tasks.push(...newTasks);
        e.target.value = '';
        saveTasksToStorage();
        render();
    }
});

runBtn.addEventListener('click', async () => {
    // --- เช็คสถานะ isStopped ก่อน ---
    const { isStopped } = await chrome.storage.local.get('isStopped');
    if (isStopped) {
        alert('Queue ถูกหยุดไว้ กรุณากด Continue ก่อนจึงจะสามารถ RUN ได้');
        return;
    }
    if (!tasks.length) return;
    tasks.forEach(t => t.status = 'pending');
    await chrome.storage.local.set({ queue: tasks.slice(), running: false, tasks: tasks.slice() });
    chrome.tabs.query({ url: ['*://chat.openai.com/*', '*://chatgpt.com/*'] }, (tabs) => {
        if (!tabs.length) { console.warn('No ChatGPT tab open'); return; }
        chrome.runtime.sendMessage({ type: 'kick', tabId: tabs[0].id });
    });
});

// ★★★ Listener สำหรับปุ่มใหม่ ★★★
saveBtn.addEventListener('click', async () => {
  if (tasks.length === 0) {
    alert('ไม่มี Task ให้บันทึก');
    return;
  }
  const albumName = prompt('ตั้งชื่ออัลบั้ม:', `Album ${new Date().toLocaleString()}`);
  if (albumName) {
    const { albums = {} } = await chrome.storage.local.get('albums');
    albums[albumName] = tasks.map(t => ({...t, status: 'pending'})); // รีเซ็ตสถานะก่อนเซฟ
    await chrome.storage.local.set({ albums });
    alert(`บันทึกอัลบั้ม "${albumName}" เรียบร้อยแล้ว`);
  }
});

manageBtn.addEventListener('click', () => {
  window.location.href = 'albums.html';
});

reloadBtn.addEventListener('click', () => {
  window.location.reload();
});

// ★★★ Listener สำหรับปุ่ม Clear และ Retry ★★★
clearBtn.addEventListener('click', () => {
  if (confirm('คุณต้องการล้าง Task ทั้งหมดในรายการปัจจุบันหรือไม่?')) {
    tasks = [];
    nextId = 1;
    saveTasksToStorage(); // บันทึกสถานะที่ว่างเปล่า
    render();
  }
});

retryBtn.addEventListener('click', () => {
  if (tasks.length === 0) {
    alert('ไม่มี Task ให้ลองใหม่');
    return;
  }
  if (confirm('คุณต้องการเริ่มรัน Task ชุดนี้ใหม่ทั้งหมดหรือไม่?')) {
    // รีเซ็ตสถานะทั้งหมดเป็น pending แล้วกด RUN ให้เลย
    tasks.forEach(t => t.status = 'pending');
    render();
    runBtn.click(); // จำลองการคลิกปุ่ม RUN
  }
});

// Listener สำหรับอัปเดต UI จาก background
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.queue) {
        tasks = changes.queue.newValue || [];
        nextId = tasks.length > 0 ? Math.max(...tasks.map(t => t.id)) + 1 : 1;
        render();
    }
});

// --- Load on Popup Open ---
const initializePopup = async () => {
    const data = await chrome.storage.local.get(['queue', 'running', 'tasks', 'isStopped']);
    tasks = (data.running && data.queue && data.queue.length > 0) ? data.queue : (data.tasks || []);
    nextId = tasks.length > 0 ? Math.max(...tasks.map(t => t.id)) + 1 : 1;
    isStopped = !!data.isStopped;
    console.log('[popup] initializePopup: isStopped =', isStopped);
    updateStopContinueBtn();
    render();
};

// --- ฟังก์ชันอัปเดตปุ่ม ---
function updateStopContinueBtn() {
  stopContinueBtn.textContent = isStopped ? '▶️ Continue' : '⏸️ Stop';
  console.log('[popup] ปุ่ม stop/continue:', isStopped ? 'Continue' : 'Stop');
}

// --- โหลดสถานะ isStopped ---
async function loadStopState() {
  const { isStopped: stopped } = await chrome.storage.local.get('isStopped');
  isStopped = !!stopped;
  console.log('[popup] โหลดสถานะ isStopped:', isStopped);
  updateStopContinueBtn();
}
loadStopState();

// --- Listener ปุ่ม stop/continue ---
stopContinueBtn.addEventListener('click', async () => {
  isStopped = !isStopped;
  await chrome.storage.local.set({ isStopped });
  console.log('[popup] กดปุ่ม stop/continue:', isStopped ? 'Continue' : 'Stop', '| isStopped =', isStopped);
  updateStopContinueBtn();
  if (!isStopped) {
    chrome.tabs.query({ url: ['*://chat.openai.com/*', '*://chatgpt.com/*'] }, (tabs) => {
      if (!tabs.length) {
        showPopupMessage('กรุณาเปิดหน้า ChatGPT ก่อน');
        return;
      }
      chrome.runtime.sendMessage({ type: 'resume', tabId: tabs[0].id }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn('SendMessage error:', chrome.runtime.lastError.message);
        }
      });
    });
  } else {
    // ส่ง stop ไป content script
    chrome.tabs.query({ url: ['*://chat.openai.com/*', '*://chatgpt.com/*'] }, (tabs) => {
      if (!tabs.length) {
        showPopupMessage('กรุณาเปิดหน้า ChatGPT ก่อน');
        return;
      }
      chrome.runtime.sendMessage({ type: 'stop-task', tabId: tabs[0].id }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn('SendMessage error:', chrome.runtime.lastError.message);
        }
      });
    });
  }
});

function showPopupMessage(msg) {
  const div = document.createElement('div');
  div.textContent = msg;
  div.style.position = 'fixed';
  div.style.bottom = '24px';
  div.style.left = '50%';
  div.style.transform = 'translateX(-50%)';
  div.style.background = 'rgba(40,40,40,0.97)';
  div.style.color = '#fff';
  div.style.padding = '14px 28px';
  div.style.borderRadius = '10px';
  div.style.fontSize = '1rem';
  div.style.boxShadow = '0 4px 24px rgba(0,0,0,0.18)';
  div.style.zIndex = 9999;
  div.style.opacity = '0';
  div.style.transition = 'opacity 0.2s';
  document.body.appendChild(div);
  setTimeout(() => { div.style.opacity = '1'; }, 10);
  setTimeout(() => {
    div.style.opacity = '0';
    setTimeout(() => div.remove(), 300);
  }, 2200);
}

exportBtn.addEventListener('click', () => {
  chrome.tabs.query({ url: ['*://chat.openai.com/*', '*://chatgpt.com/*'] }, (tabs) => {
    if (!tabs.length) {
      showPopupMessage('กรุณาเปิดหน้า ChatGPT ก่อน');
      return;
    }
    chrome.tabs.sendMessage(tabs[0].id, { type: 'export-chat-jsonl' }, (response) => {
      if (chrome.runtime.lastError) {
        showPopupMessage('เกิดข้อผิดพลาดในการ export กรุณาเปิดหน้า ChatGPT หรือรีโหลดอีกครั้ง');
      }
    });
  });
});

// โหลดค่าตอนเปิด popup
async function loadExportSettings() {
  const { autoExport = false } = await chrome.storage.local.get(['autoExport']);
  autoExportChk.checked = !!autoExport;
}
loadExportSettings();

autoExportChk.addEventListener('change', async (e) => {
  await chrome.storage.local.set({ autoExport: autoExportChk.checked });
});

if (speedSlider && speedValue) {
  chrome.storage.local.get('typingSpeed', ({ typingSpeed }) => {
    speedSlider.value = typingSpeed || 50;
    speedValue.textContent = speedSlider.value;
  });
  speedSlider.addEventListener('input', () => {
    speedValue.textContent = speedSlider.value;
    chrome.storage.local.set({ typingSpeed: Number(speedSlider.value) });
  });
}

if (forceStopBtn) {
  forceStopBtn.addEventListener('click', async () => {
    chrome.tabs.query({ url: ['*://chat.openai.com/*', '*://chatgpt.com/*'] }, async (tabs) => {
      if (!tabs.length) {
        showPopupMessage('กรุณาเปิดหน้า ChatGPT ก่อน');
        return;
      }
      // ส่ง cancel-task ไปทุก tab ที่ match
      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, { type: 'cancel-task' });
      }
      // รีเซ็ตเฉพาะ queue, running, isStopped ไม่ลบ tasks เดิม
      await chrome.storage.local.set({ running: false, isStopped: false, queue: [] });
      showPopupMessage('หยุด task ทั้งหมดแล้ว');
      render();
    });
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'update-send-delay') {
    const el = document.getElementById('sendDelayCountdown');
    if (el) {
      if (msg.value === null) {
        el.textContent = '';
      } else {
        el.textContent = `⏳ ${msg.value.toFixed(1)}s`;
      }
    }
  }
});

initializePopup();