// ★★★ ฟังก์ชัน Helper ใหม่สำหรับ Retry ★★★
async function retry(fn, delay = 1000, fnName = 'Unnamed') {
  let attempt = 1; // ตัวแปรสำหรับนับจำนวนครั้งที่ลอง (เพื่อแสดงใน log)
  
  // ★★★ เปลี่ยนมาใช้ while(true) loop ★★★
  while (true) {
    if (shouldCancel) throw new Error('cancel-task');
    try {
      console.log(`[content] Attempt #${attempt} for ${fnName}...`);
      // ถ้า fn() ทำงานสำเร็จ จะ return ค่าออกไปและจบ loop ทันที
      return await fn(); 
    } catch (error) {
      // ถ้า fn() ล้มเหลว (throw error) โค้ดจะทำงานใน catch block นี้
      if (shouldCancel || error.message === 'cancel-task') throw error;
      console.warn(`[content] Attempt #${attempt} for ${fnName} failed:`, error.message);
      
      // รอตามเวลา delay ที่กำหนด ก่อนจะเริ่ม loop รอบใหม่
      await new Promise(resolve => setTimeout(resolve, delay));
      
      attempt++; // เพิ่มจำนวนครั้งที่ลอง
    }
  }
}

// --- ฟังก์ชัน setNativeValue สำหรับ React-controlled textarea (robust) ---
function setNativeValue(element, value) {
  if (!element || element.tagName !== 'TEXTAREA') {
    console.error('[content] setNativeValue: element is not a textarea', element);
    throw new Error('setNativeValue: element is not a textarea');
  }
  let prototype = element;
  let valueSetter;
  while (prototype && !valueSetter) {
    valueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    prototype = Object.getPrototypeOf(prototype);
  }
  if (!valueSetter) {
    console.error('[content] setNativeValue: value setter not found for element', element);
    throw new Error('setNativeValue: value setter not found');
  }
  valueSetter.call(element, value);
}

// --- ฟังก์ชันพิมพ์ทีละตัวเหมือนมนุษย์ (แบบ React รับรู้) ---
async function typeTextLikeHuman(text, speed = 50) {
  const textarea = document.getElementById('prompt-textarea');
  if (!textarea || textarea.tagName !== 'TEXTAREA') {
    console.error('[content] ไม่พบ textarea หรือ element ไม่ใช่ textarea', textarea);
    throw new Error('ไม่พบ textarea หรือ element ไม่ใช่ textarea');
  }
  textarea.focus();
  setNativeValue(textarea, ''); // ล้างก่อน
  textarea.dispatchEvent(new Event('input', { bubbles: true }));

  let current = '';
  for (let i = 0; i < text.length; i++) {
    if (shouldCancel) throw new Error('cancel-task');
    current += text[i];
    setNativeValue(textarea, current);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, speed));
  }
}

// ฟังก์ชันพิมพ์ข้อความทีละตัวตามความเร็วที่ตั้งไว้
async function typeTextWithSpeed(text) {
  const { typingSpeed = 50 } = await chrome.storage.local.get('typingSpeed');
  const textarea = document.getElementById('prompt-textarea');
  if (!textarea) throw new Error('ไม่พบ textarea');
  textarea.focus();
  textarea.value = '';
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  let current = '';
  for (let i = 0; i < text.length; i++) {
    if (shouldCancel) throw new Error('cancel-task');
    current += text[i];
    textarea.value = current;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, typingSpeed));
  }
}

// ฟังก์ชันส่ง prompt ที่ใช้เทคนิค 'insertText' (ย้อนกลับไปแบบเดิม)
async function sendPrompt(text) {
  const textarea = document.getElementById('prompt-textarea');
  if (!textarea) {
    throw new Error('ไม่พบ textarea');
  }

  // 1. โฟกัสและใส่ข้อความ
  textarea.focus();
  textarea.value = '';
  document.execCommand('insertText', false, text);

  // 2. ★ ใช้ retry ห่อการรอปุ่ม Send
  const sendButton = await retry(
    () => waitForElement('button[data-testid="send-button"]:not(:disabled)'),
    1000, // ห่างกันครั้งละ 1 วินาที
    'waitForSendButton'
  );

  // --- เพิ่ม: รอจนกว่าจะ continue ก่อนคลิกปุ่ม send ---
  while (true) {
    if (shouldCancel) throw new Error('cancel-task');
    const { isStopped } = await chrome.storage.local.get('isStopped');
    if (!isStopped) break;
    console.log('[content] รอ continue ก่อนคลิกปุ่ม Send...');
    await new Promise(r => setTimeout(r, 500));
  }

  // --- สุ่ม delay ก่อนคลิกปุ่ม send ---
  let randomDelay;
  if (Math.random() < 0.05) {
    // โอกาสน้อยมาก (5%) จะ delay 6000-15000ms
    randomDelay = Math.floor(Math.random() * (15000 - 6000 + 1)) + 6000;
  } else {
    // ปกติ delay 1000-5000ms
    randomDelay = Math.floor(Math.random() * (5000 - 1000 + 1)) + 1000;
  }
  console.log(`[content] รอสุ่ม delay ${randomDelay}ms ก่อนคลิกปุ่ม Send...`);
  showSendDelayCountdown(randomDelay);
  console.debug(`[content] รอก่อนส่ง ${(randomDelay/1000).toFixed(3)} วินาที`);
  await new Promise(r => setTimeout(r, randomDelay));

  console.log('[content] พบปุ่ม Send ที่พร้อมใช้งานแล้ว! กำลังคลิก...');
  sendButton.click();
}

// --- ฟังก์ชัน Helper: รอจนกว่า Element จะปรากฏ (เช็ค shouldCancel ด้วย) ---
function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (shouldCancel) {
        reject(new Error('cancel-task'));
        return true;
      }
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return true;
      }
      if (Date.now() - start > timeout) {
        reject(new Error(`Element "${selector}" not found within ${timeout}ms`));
        return true;
      }
      return false;
    };
    if (check()) return;
    const observer = new MutationObserver(() => { if (check()) observer.disconnect(); });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      observer.disconnect();
      if (!shouldCancel) reject(new Error(`Element "${selector}" not found within ${timeout}ms`));
    }, timeout);
  });
}

// ฟังก์ชันรอคำตอบ
async function waitUntilDone() {
  console.log('[content] กำลังรอให้การสร้างคำตอบเสร็จสิ้น...');

  // 1. รอให้ปุ่ม Stop ปรากฏขึ้นก่อน (แสดงว่าเริ่มตอบแล้ว)
  try {
     await waitForElement('[data-testid="stop-generating-button"]', 10000); // รอ 10 วิ
     console.log('[content] เริ่มสร้างคำตอบแล้ว (พบปุ่ม Stop)');
  } catch (e) {
     console.warn('[content] ไม่พบปุ่ม Stop, อาจจะตอบเสร็จเร็วมาก หรือมีปัญหา. จะทำงานต่อไป...');
     return; // ถ้าไม่เจอปุ่ม Stop ใน 10 วิ ก็ถือว่าน่าจะจบแล้ว ให้ไปต่อเลย
  }
  
  // 2. รอจนกว่าปุ่ม Stop จะหายไป (อาจใช้เวลานานมาก)
  await new Promise(resolve => {
    const observer = new MutationObserver(() => {
      if (!document.querySelector('[data-testid="stop-generating-button"]')) {
        observer.disconnect();
        resolve();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    // ไม่มี timeout ที่นี่ เพราะเราจะรอไปเรื่อยๆ จนกว่าจะตอบเสร็จ
  });
  console.log('[content] การสร้างคำตอบเสร็จสิ้น (ปุ่ม Stop หายไป)');
}

let shouldCancel = false;

// --- เพิ่มฟังก์ชันรอจนกว่าจะ continue ---
async function waitUntilContinue() {
  while (true) {
    const { isStopped } = await chrome.storage.local.get('isStopped');
    if (!isStopped) break;
    console.log('[content] กดปุ่มหยุดอยู่ (pause)...');
    console.log('[content] โดนดักตีจุด 1', isStopped);
    await new Promise(r => setTimeout(r, 500));
  }
  console.log('[content] resume ทำงานต่อ');
}

// --- เก็บ session messages ---
let sessionMessages = [];

function removeStrikethrough(text) {
  return text.replace(/\u0336/g, '');
}

function getLatestUserAssistantPairs() {
  // หา user
  const userNodes = Array.from(document.querySelectorAll('.text-base .whitespace-pre-wrap'));
  // หา assistant
  const assistantNodes = Array.from(document.querySelectorAll('[data-message-author-role="assistant"] .prose'));
  const pairs = [];
  const len = Math.min(userNodes.length, assistantNodes.length);
  for (let i = 0; i < len; i++) {
    const userText = removeStrikethrough(userNodes[i].innerText.trim());
    const assistantText = removeStrikethrough(assistantNodes[i].innerText.trim());
    if (userText && assistantText) {
      pairs.push([
        { role: 'user', content: userText },
        { role: 'assistant', content: assistantText }
      ]);
    }
  }
  return pairs;
}

// --- Helper: export jsonl ---
async function exportSessionJsonl(pairs) {
  const lines = pairs.map(pair => JSON.stringify({ messages: pair }));
  const blob = new Blob([lines.join('\n')], { type: 'application/jsonl' });
  const filename = `chat_export_${new Date().toISOString().replace(/[:.]/g,'-')}.jsonl`;
  // download ปกติ (save as)
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// --- Main Listener ---
console.log('[content] script injected (v9 - Retry)');
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'cancel-task') {
    shouldCancel = true;
    console.log('[content] ได้รับคำสั่ง cancel-task');
  }
  if (msg.type !== 'run') return true;

  console.log(`[content] ได้รับ prompt ⇒ ${msg.text}`);
  
  (async () => {
    try {
      if (shouldCancel) {
        shouldCancel = false;
        await waitUntilContinue();
        // ทำงานต่อ
      }
      await retry(
        () => sendPrompt(msg.text),
        2, // ลองส่ง prompt ทั้งหมด 2 ครั้ง
        2000,
        'sendPromptProcess'
      );
      if (shouldCancel) {
        shouldCancel = false;
        await waitUntilContinue();
        // ทำงานต่อ
      }
      await waitUntilDone();
      if (shouldCancel) {
        shouldCancel = false;
        await waitUntilContinue();
        // ทำงานต่อ
      }
      await new Promise(r => setTimeout(r, 500));
      if (shouldCancel) {
        shouldCancel = false;
        await waitUntilContinue();
        // ทำงานต่อ
      }
      // --- เก็บคู่ user/assistant หลังแต่ละ task ---
      sessionMessages = getLatestUserAssistantPairs();
      // --- เช็คว่าเป็น task สุดท้ายหรือไม่ ---
      const { queue = [] } = await chrome.storage.local.get('queue');
      const pending = queue.filter(t => t.status !== 'done');
      if (pending.length <= 1) { // task สุดท้าย
        // --- เช็ค autoExport ---
        const { autoExport } = await chrome.storage.local.get(['autoExport']);
        if (autoExport) {
          await exportSessionJsonl(sessionMessages);
        }
      }
      // --- เพิ่ม: รอจนกว่าจะ continue ---
      const { isStopped } = await chrome.storage.local.get('isStopped');
      console.log('[content] เตรียมติด loop =', isStopped);
      while (true) {
        const { isStopped } = await chrome.storage.local.get('isStopped');
        console.log('[content] loop wait: isStopped =', isStopped);
        if (!isStopped) break;
        console.log('[content] กดปุ่มหยุดอยู่');
        console.log('[content] รอให้ continue ก่อนจะ request-next...');
        await new Promise(r => setTimeout(r, 500));
      }
      console.log('[content] ไม่ได้กดปุ่มหยุดไว้');
      chrome.runtime.sendMessage({ type: 'request-next' });

    } catch (e) {
      if (e.message === 'cancel-task') {
        shouldCancel = false;
        console.warn('[content] Task ถูกยกเลิก');
      } else {
        console.error('[content] ไม่สามารถส่ง prompt ได้หลังจากลองใหม่หลายครั้ง:', e.message);
      }
    }
  })();
  
  return true; 
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'export-chat-jsonl') {
    // หา user
    const userNodes = Array.from(document.querySelectorAll('.text-base .whitespace-pre-wrap'));
    // หา assistant
    const assistantNodes = Array.from(document.querySelectorAll('[data-message-author-role="assistant"] .prose'));
    const lines = [];
    const len = Math.min(userNodes.length, assistantNodes.length);
    for (let i = 0; i < len; i++) {
      const userText = removeStrikethrough(userNodes[i].innerText.trim());
      const assistantText = removeStrikethrough(assistantNodes[i].innerText.trim());
      if (userText && assistantText) {
        lines.push(JSON.stringify({ messages: [
          { role: 'user', content: userText },
          { role: 'assistant', content: assistantText }
        ] }));
      }
    }
    const blob = new Blob([lines.join('\n')], { type: 'application/jsonl' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chat_export.jsonl';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
});

// ฟังก์ชันแสดงเวลานับถอยหลัง delay ที่เหลือใน popup
function showSendDelayCountdown(ms) {
  const interval = 50;
  let remaining = ms;
  function update() {
    chrome.runtime.sendMessage({ type: 'update-send-delay', value: Math.ceil(remaining / 100) / 10 });
    remaining -= interval;
    if (remaining > 0) {
      setTimeout(update, interval);
    } else {
      chrome.runtime.sendMessage({ type: 'update-send-delay', value: null });
    }
  }
  update();
}