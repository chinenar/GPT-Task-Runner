// --- START OF FILE background.js (แก้ไข) ---

async function nextTask(tabId) {
  try {
    const { queue = [], running = false, isStopped = false } = await chrome.storage.local.get(['queue', 'running', 'isStopped']);
    if (isStopped) {
      console.log('[bg] Queue ถูกหยุดไว้ (isStopped)');
      return;
    }
    console.log('[bg] Checking state:', { queueLen: queue.length, running });

    if (running || queue.length === 0) {
      return;
    }

    const tab = await chrome.tabs.get(tabId);
    if (!/^https:\/\/(chat\.openai\.com|chatgpt\.com)\//.test(tab.url)) {
      console.warn('[bg] URL not match. Aborting.');
      return;
    }

    const taskIndex = queue.findIndex(t => t.status !== 'done');
    if (taskIndex === -1) {
      console.log('[bg] All tasks are done.');
      await chrome.storage.local.set({ running: false });
      return;
    }
    
    queue[taskIndex].status = 'active';
    const currentTask = queue[taskIndex];

    await chrome.storage.local.set({ queue: queue, running: true });
    
    console.log('[bg] SENDING task to content script:', currentTask.text);
    // ★★★ แก้ไขตรงนี้ ★★★
    // ส่งเฉพาะ currentTask.text ไม่ใช่ currentTask ทั้งก้อน
    chrome.tabs.sendMessage(tabId, { type: 'run', text: currentTask.text });

  } catch (err) {
    console.error('[bg] An error occurred in nextTask:', err);
    await chrome.storage.local.set({ running: false });
  }
}

console.log("[bg] service-worker alive");

chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  console.log('[bg] Received message:', msg.type);

  if (msg.type === 'kick') {
    await nextTask(msg.tabId);
  }

  if (msg.type === 'request-next') {
    (async () => {
      const { queue = [], isStopped = false } = await chrome.storage.local.get(['queue', 'isStopped']);
      if (queue.length === 0) {
        sendResponse({status: "Queue empty"});
        return;
      }

      // 1. หา task ที่ active อยู่ แล้วเปลี่ยนเป็น done
      const activeTaskIndex = queue.findIndex(t => t.status === 'active');
      if (activeTaskIndex !== -1) {
        queue[activeTaskIndex].status = 'done';
      }

      // 2. ตรวจสอบว่ายังมี task เหลือให้ทำอีกหรือไม่
      const nextTaskIndex = queue.findIndex(t => t.status !== 'done');
      
      if (nextTaskIndex === -1) {
        // --- ถ้าไม่เหลือ Task แล้ว ---
        await chrome.storage.local.set({ queue: queue, running: false });
        sendResponse({status: "All tasks done"});
      } else {
        // --- ถ้ายังมี Task เหลือ ---
        await chrome.storage.local.set({ queue: queue, running: false });
        if (!isStopped) {
          await nextTask(sender.tab.id);
          sendResponse({status: "Next task initiated"});
        } else {
          // *** ถ้า isStopped ห้าม nextTask ***
          console.log('[bg] Queue ถูกหยุดไว้ (isStopped) จะไม่ nextTask');
          sendResponse({status: "Stopped"});
        }
      }
    })();
    return true;
  }

  // --- เพิ่มสำหรับ resume ---
  if (msg.type === 'resume') {
    await chrome.storage.local.set({ isStopped: false });
    await nextTask(msg.tabId);
  }

  if (msg.type === 'stop-task') {
    // ส่ง message ไป content script เพื่อหยุด task ปัจจุบัน
    chrome.tabs.sendMessage(msg.tabId, { type: 'cancel-task' });
  }
});