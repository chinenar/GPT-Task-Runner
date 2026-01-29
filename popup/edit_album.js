// START OF FILE edit_album.js
document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const albumName = params.get('album');

  if (!albumName) {
    window.location.href = 'albums.html';
    return;
  }

  const albumTitle = document.getElementById('albumTitle');
  const taskListEl = document.getElementById('taskList');
  const taskInputEl = document.getElementById('taskInput');
  const saveChangesBtn = document.getElementById('saveChangesBtn');
  const backToAlbumsBtn = document.getElementById('backToAlbumsBtn');
  
  albumTitle.textContent = `แก้ไข: ${albumName}`;
  let tasks = [];
  let nextId = 1;

  const render = () => {
    taskListEl.innerHTML = '';
    tasks.forEach(task => {
      const li = document.createElement('li');
      li.className = 'task-item';
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.value = task.text;
      inp.oninput = (e) => { task.text = e.target.value; };

      const delBtn = document.createElement('button');
      delBtn.textContent = 'ลบ';
      delBtn.onclick = () => {
        tasks = tasks.filter(t => t.id !== task.id);
        render();
      };
      li.append(inp, delBtn);
      taskListEl.appendChild(li);
    });
  };

  const loadTasks = async () => {
    const { albums = {} } = await chrome.storage.local.get('albums');
    tasks = albums[albumName] || [];
    nextId = tasks.length > 0 ? Math.max(...tasks.map(t => t.id)) + 1 : 1;
    render();
  };

  taskInputEl.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const text = e.target.value.trim();
      if (text) {
        tasks.push({ id: nextId++, text: text, status: 'pending' });
        e.target.value = '';
        render();
      }
    }
  });

  saveChangesBtn.addEventListener('click', async () => {
    const { albums = {} } = await chrome.storage.local.get('albums');
    albums[albumName] = tasks;
    await chrome.storage.local.set({ albums });
    alert('บันทึกการเปลี่ยนแปลงเรียบร้อย');
    window.location.href = 'albums.html';
  });
  
  backToAlbumsBtn.onclick = () => { window.location.href = 'albums.html'; };

  loadTasks();
});