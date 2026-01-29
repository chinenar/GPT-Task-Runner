// START OF FILE albums.js
document.addEventListener('DOMContentLoaded', async () => {
  const albumList = document.getElementById('albumList');
  const backBtn = document.getElementById('backBtn');
  
  backBtn.onclick = () => {
    window.location.href = 'popup.html';
  };

  const renderAlbums = async () => {
    const { albums = {} } = await chrome.storage.local.get('albums');
    albumList.innerHTML = '';

    if (Object.keys(albums).length === 0) {
      albumList.innerHTML = '<li>ยังไม่มีอัลบั้มที่บันทึกไว้</li>';
      return;
    }

    for (const albumName in albums) {
      const li = document.createElement('li');
      li.className = 'album-item';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'album-name';
      nameSpan.textContent = albumName;
      // เราจะไม่ไปหน้า edit แล้ว แต่จะให้โหลดเลย
      // nameSpan.onclick = () => {
      //   // ส่งชื่ออัลบั้มไปหน้า edit
      //   window.location.href = `edit_album.html?album=${encodeURIComponent(albumName)}`;
      // };
      // ★★★ เมื่อคลิกชื่อ ให้ไปหน้า Edit ★★★
      nameSpan.onclick = () => {
        window.location.href = `edit_album.html?album=${encodeURIComponent(albumName)}`;
      };
      
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'album-actions';
      
      // ปุ่ม Load
      const loadBtn = document.createElement('button');
      loadBtn.textContent = 'Load';
      loadBtn.className = 'load-btn'; // ★★★ เพิ่ม class นี้ ★★★
      loadBtn.onclick = async () => {
        if (confirm(`คุณต้องการโหลด "${albumName}"? Task ปัจจุบันจะถูกเขียนทับ`)) {
          const { albums } = await chrome.storage.local.get('albums');
          const tasksToLoad = albums[albumName];
          await chrome.storage.local.set({ tasks: tasksToLoad });
          window.location.href = 'popup.html';
        }
      };

      // ปุ่ม Delete
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'ลบ';
      deleteBtn.className = 'delete-btn'; // ★★★ เพิ่ม class นี้ ★★★
      deleteBtn.onclick = async () => {
        if (confirm(`คุณแน่ใจหรือไม่ที่จะลบอัลบั้ม "${albumName}"?`)) {
          const { albums } = await chrome.storage.local.get('albums');
          delete albums[albumName];
          await chrome.storage.local.set({ albums });
          renderAlbums(); // Re-render
        }
      };

      actionsDiv.append(loadBtn, deleteBtn);
      li.append(nameSpan, actionsDiv);
      albumList.appendChild(li);
    }
  };

  renderAlbums();
});