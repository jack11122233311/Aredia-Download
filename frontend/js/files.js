/**
 * In-Browser File Manager & Mini-Player (Feature 6)
 */
class FilesManager {
  constructor() {
    this.container = document.getElementById('files-grid-container');
    this.badgeEl = document.getElementById('files-badge');
    this.refreshBtn = document.getElementById('refresh-files-btn');
    
    this.playerDialog = document.getElementById('player-dialog');
    this.playerTitle = document.getElementById('player-title');
    this.playerContainer = document.getElementById('media-player-container');
    this.closePlayerBtn = document.getElementById('close-player-btn');
    
    this.files = [];
  }

  init() {
    if (this.refreshBtn) {
      this.refreshBtn.addEventListener('click', () => this.loadFiles());
    }

    if (this.closePlayerBtn && this.playerDialog) {
      this.closePlayerBtn.addEventListener('click', () => this.closePlayer());
      this.playerDialog.addEventListener('click', (e) => {
        const rect = this.playerDialog.getBoundingClientRect();
        if (
          e.clientX < rect.left ||
          e.clientX > rect.right ||
          e.clientY < rect.top ||
          e.clientY > rect.bottom
        ) {
          this.closePlayer();
        }
      });
    }

    this.loadFiles();
  }

  async loadFiles() {
    try {
      const res = await fetch('/api/files');
      if (!res.ok) throw new Error('Failed to load files');
      this.files = await res.json();
      this.render();
      if (this.badgeEl) this.badgeEl.textContent = this.files.length;
    } catch (err) {
      console.error('Error fetching files:', err);
    }
  }

  render() {
    if (!this.container) return;

    if (this.files.length === 0) {
      this.container.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
          </div>
          <h3>No Downloads Yet</h3>
          <p>Files downloaded to your persistent storage will appear here.</p>
        </div>
      `;
      return;
    }

    this.container.innerHTML = '';

    this.files.forEach(file => {
      const card = document.createElement('div');
      card.className = 'file-card';
      
      const isVideo = file.media_type === 'video';
      const isAudio = file.media_type === 'audio';

      const iconSvg = isVideo
        ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="2" y1="17" x2="7" y2="17"></line><line x1="17" y1="17" x2="22" y2="17"></line><line x1="17" y1="7" x2="22" y2="7"></line></svg>`
        : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`;

      card.innerHTML = `
        <div class="file-card-top">
          <div class="file-icon ${file.media_type}">${iconSvg}</div>
          <div class="file-details">
            <div class="file-name" title="${file.name}">${file.name}</div>
            <div class="file-meta-row">
              <span>${file.size_str}</span>
              <span>•</span>
              <span style="text-transform: uppercase;">${file.extension}</span>
            </div>
          </div>
        </div>
        <div class="file-actions">
          ${(isVideo || isAudio) ? `
            <button class="btn-subtle btn-sm play-file-btn" style="flex: 1;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
              <span>Play</span>
            </button>
          ` : ''}
          <a href="/api/files/download/${encodeURIComponent(file.relative_path || file.name)}" download class="btn-subtle btn-sm" style="text-decoration: none;" title="Save to local machine">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          </a>
          <button class="btn-subtle btn-sm delete-file-btn" style="color: var(--accent-rose);" title="Delete File">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      `;

      // Play button event
      const playBtn = card.querySelector('.play-file-btn');
      if (playBtn) {
        playBtn.addEventListener('click', () => this.openPlayer(file));
      }

      // Delete button event
      const delBtn = card.querySelector('.delete-file-btn');
      if (delBtn) {
        delBtn.addEventListener('click', () => this.deleteFile(file.relative_path || file.name));
      }

      this.container.appendChild(card);
    });
  }

  openPlayer(file) {
    if (!this.playerDialog) return;
    this.playerTitle.textContent = file.name;
    const streamUrl = `/api/files/stream/${encodeURIComponent(file.relative_path || file.name)}`;

    if (file.media_type === 'video') {
      this.playerContainer.innerHTML = `
        <video controls autoplay style="width: 100%; border-radius: 8px;">
          <source src="${streamUrl}" type="video/${file.extension === 'mkv' ? 'webm' : file.extension}">
          Your browser does not support HTML5 video streaming.
        </video>
      `;
    } else {
      this.playerContainer.innerHTML = `
        <div style="padding: 40px 20px; width: 100%; text-align: center;">
          <audio controls autoplay style="width: 80%;">
            <source src="${streamUrl}">
            Your browser does not support HTML5 audio playback.
          </audio>
        </div>
      `;
    }

    this.playerDialog.showModal();
  }

  closePlayer() {
    if (!this.playerDialog) return;
    this.playerContainer.innerHTML = '';
    this.playerDialog.close();
  }

  async deleteFile(filename) {
    if (!confirm(`Are you sure you want to delete "${filename}"?`)) return;

    try {
      const res = await fetch(`/api/files/${encodeURIComponent(filename)}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete file');
      
      window.app.showToast('File deleted', 'success');
      await this.loadFiles();
    } catch (err) {
      window.app.showToast(err.message, 'error');
    }
  }
}

window.filesManager = new FilesManager();
