/**
 * Main Application Coordinator & Queue UI Controller
 */
class App {
  constructor() {
    this.tasks = new Map();
    this.activeTab = 'download';

    this.downloadForm = document.getElementById('download-form');
    this.urlInput = document.getElementById('url-input');
    this.pasteBtn = document.getElementById('paste-btn');
    this.startDownloadBtn = document.getElementById('start-download-btn');
    
    this.queueListContainer = document.getElementById('queue-list-container');
    this.queueEmpty = document.getElementById('queue-empty');
    this.queueBadge = document.getElementById('queue-badge');
    this.clearQueueBtn = document.getElementById('clear-queue-btn');

    this.activePreviewSection = document.getElementById('active-download-preview');
    this.activeCardsContainer = document.getElementById('active-cards-container');
    this.toastContainer = document.getElementById('toast-container');

    // Clipboard Auto-Detector Banner (QoL 1)
    this.clipboardBanner = document.getElementById('clipboard-banner');
    this.clipboardUrlText = document.getElementById('clipboard-url-text');
    this.clipboardAutofillBtn = document.getElementById('btn-clipboard-autofill');
    this.clipboardDismissBtn = document.getElementById('btn-clipboard-dismiss');
    this.lastDetectedClipboard = '';
  }

  init() {
    this.setupTabs();
    this.setupForm();
    this.setupClipboardDetector();
    this.setupSSEListeners();
    
    // Initialize child managers
    window.terminalManager.init();
    window.presetsManager.init();
    window.searchManager.init();
    window.playlistManager.init();
    window.filesManager.init();
    window.settingsManager.init();
    
    // Connect SSE stream
    window.sseManager.connect();
  }

  setupTabs() {
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        this.switchTab(target);
      });
    });
  }

  switchTab(tabId) {
    this.activeTab = tabId;

    document.querySelectorAll('.nav-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tabId);
    });

    document.querySelectorAll('.tab-pane').forEach(p => {
      p.classList.toggle('active', p.id === `pane-${tabId}`);
    });

    if (tabId === 'library') {
      window.filesManager.loadFiles();
    }
  }

  setupClipboardDetector() {
    const checkClipboard = async () => {
      try {
        if (!navigator.clipboard || !navigator.clipboard.readText) return;
        const text = (await navigator.clipboard.readText()).trim();
        
        if (text && text !== this.lastDetectedClipboard && this.isMediaLink(text)) {
          this.lastDetectedClipboard = text;
          if (this.clipboardUrlText && this.clipboardBanner) {
            this.clipboardUrlText.textContent = text;
            this.clipboardBanner.style.display = 'flex';
          }
        }
      } catch (err) {
        // Clipboard read permission might not be granted yet
      }
    };

    window.addEventListener('focus', () => checkClipboard());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkClipboard();
    });

    if (this.clipboardAutofillBtn) {
      this.clipboardAutofillBtn.addEventListener('click', () => {
        if (this.urlInput && this.lastDetectedClipboard) {
          this.urlInput.value = this.lastDetectedClipboard;
          this.clipboardBanner.style.display = 'none';
          this.showToast('URL auto-filled from clipboard!', 'info');
        }
      });
    }

    if (this.clipboardDismissBtn) {
      this.clipboardDismissBtn.addEventListener('click', () => {
        if (this.clipboardBanner) this.clipboardBanner.style.display = 'none';
      });
    }
  }

  isMediaLink(text) {
    if (!text.startsWith('http://') && !text.startsWith('https://')) return false;
    const lower = text.toLowerCase();
    return lower.includes('youtube.com') || lower.includes('youtu.be') ||
           lower.includes('soundcloud.com') || lower.includes('twitter.com') ||
           lower.includes('x.com') || lower.includes('tiktok.com') ||
           lower.includes('vimeo.com') || lower.includes('bilibili.com');
  }

  setupForm() {
    // Clipboard paste button
    if (this.pasteBtn && this.urlInput) {
      this.pasteBtn.addEventListener('click', async () => {
        try {
          const text = await navigator.clipboard.readText();
          if (text) {
            this.urlInput.value = text.trim();
            this.showToast('Pasted from clipboard!', 'info');
          }
        } catch (err) {
          this.showToast('Clipboard access denied. Please paste manually.', 'error');
        }
      });
    }

    // Submit download form
    if (this.downloadForm) {
      this.downloadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const inputVal = this.urlInput.value.trim();
        if (!inputVal) return;

        // If user typed a search phrase instead of URL, trigger search
        if (!window.searchManager.isUrl(inputVal)) {
          window.searchManager.performSearch();
          return;
        }

        // Smart Playlist Interception: if URL contains playlist parameter, prompt choice
        if (window.playlistManager.isPlaylistUrl(inputVal)) {
          window.playlistManager.promptPlaylistChoice(inputVal, (choice, url) => {
            if (choice === 'single') {
              this.executeSingleDownload(url, true);
            }
          });
          return;
        }

        // Standard single download
        this.executeSingleDownload(inputVal, false);
      });
    }

    // Clear finished button
    if (this.clearQueueBtn) {
      this.clearQueueBtn.addEventListener('click', async () => {
        try {
          await fetch('/api/downloads/clear', { method: 'DELETE' });
          for (const [id, t] of this.tasks.entries()) {
            if (['completed', 'failed', 'cancelled'].includes(t.status)) {
              this.tasks.delete(id);
            }
          }
          this.renderQueue();
          this.showToast('Finished tasks cleared', 'info');
        } catch (err) {
          this.showToast('Failed to clear queue', 'error');
        }
      });
    }
  }

  async executeSingleDownload(url, forceNoPlaylist = false) {
    const opts = window.presetsManager.getOptions();
    this.startDownloadBtn.disabled = true;

    try {
      const res = await fetch('/api/downloads/single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url,
          preset_id: opts.preset_id,
          mode: opts.mode,
          audio_format: opts.audio_format,
          audio_bitrate: opts.audio_bitrate,
          subfolder: opts.subfolder,
          noplaylist: forceNoPlaylist,
          embed_subtitles: opts.embed_subtitles,
          start_time: opts.start_time,
          end_time: opts.end_time,
          normalize_audio: opts.normalize_audio,
          sponsorblock: opts.sponsorblock,
          rate_limit: opts.rate_limit,
          custom_format: opts.custom_format
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to start download');
      }

      this.urlInput.value = '';
      this.showToast('Download added to queue!', 'success');
      
      // Switch to queue tab & open live CLI terminal
      this.switchTab('queue');
      window.terminalManager.toggle(true);
    } catch (err) {
      this.showToast(err.message, 'error');
    } finally {
      this.startDownloadBtn.disabled = false;
    }
  }

  setupSSEListeners() {
    window.sseManager.onSnapshot = (taskList) => {
      this.tasks.clear();
      taskList.forEach(t => this.tasks.set(t.id, t));
      this.renderQueue();
    };

    window.sseManager.onTaskUpdated = (task) => {
      this.tasks.set(task.id, task);
      this.renderQueue();
      
      // Auto-refresh file library when a download completes
      if (task.status === 'completed') {
        window.filesManager.loadFiles();
      }
    };
  }

  renderQueue() {
    const taskList = Array.from(this.tasks.values()).reverse();
    const activeTasks = taskList.filter(t => ['queued', 'starting', 'downloading', 'processing'].includes(t.status));

    // Update Queue badge
    if (this.queueBadge) {
      if (activeTasks.length > 0) {
        this.queueBadge.textContent = activeTasks.length;
        this.queueBadge.style.display = 'inline-flex';
      } else {
        this.queueBadge.style.display = 'none';
      }
    }

    // Render Queue Tab
    if (taskList.length === 0) {
      if (this.queueEmpty) this.queueEmpty.style.display = 'flex';
      this.queueListContainer.querySelectorAll('.task-card').forEach(c => c.remove());
    } else {
      if (this.queueEmpty) this.queueEmpty.style.display = 'none';
      
      this.queueListContainer.querySelectorAll('.task-card').forEach(c => c.remove());
      taskList.forEach(task => {
        const card = this.createTaskCard(task);
        this.queueListContainer.appendChild(card);
      });
    }

    // Render Active Card on Download Tab
    if (this.activePreviewSection && this.activeCardsContainer) {
      if (activeTasks.length > 0) {
        this.activePreviewSection.style.display = 'block';
        this.activeCardsContainer.innerHTML = '';
        activeTasks.slice(0, 2).forEach(task => {
          this.activeCardsContainer.appendChild(this.createTaskCard(task));
        });
      } else {
        this.activePreviewSection.style.display = 'none';
      }
    }
  }

  createTaskCard(task) {
    const card = document.createElement('div');
    card.className = 'task-card';
    card.id = `task-card-${task.id}`;

    const isRunning = ['starting', 'downloading', 'processing'].includes(task.status);
    const isProcessing = task.status === 'processing';
    const isCompleted = task.status === 'completed';
    const isFailed = task.status === 'failed';
    const isCancelled = task.status === 'cancelled';

    const thumbSrc = task.thumbnail || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='48' viewBox='0 0 64 48'%3E%3Crect width='64' height='48' fill='%231a2338'/%3E%3C/svg%3E";

    card.innerHTML = `
      <div class="task-header">
        <div class="task-meta">
          <img src="${thumbSrc}" class="task-thumb" alt="Thumbnail" loading="lazy" onerror="this.style.opacity='0.2'">
          <div class="task-info">
            <div class="task-title" title="${task.title}">${task.title}</div>
            <div class="task-sub">
              <span>${task.uploader || 'Extracting...'}</span>
              ${task.duration_str ? `<span>• ${task.duration_str}</span>` : ''}
              <span class="task-status-pill status-${task.status}">${task.status}</span>
            </div>
          </div>
        </div>
        <div class="task-actions">
          ${isRunning || task.status === 'queued' ? `
            <button class="btn-subtle btn-xs cancel-task-btn" title="Cancel Download">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              <span>Cancel</span>
            </button>
          ` : ''}
          ${isCompleted ? `
            <button class="btn-subtle btn-xs view-library-btn" style="color: var(--accent-emerald);">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
              <span>In Library</span>
            </button>
          ` : ''}
        </div>
      </div>

      <div class="progress-track">
        <div class="progress-fill ${isProcessing ? 'processing' : ''}" style="width: ${task.percent || (isCompleted ? 100 : 0)}%;"></div>
      </div>

      <div class="task-footer">
        <div>
          ${isFailed ? `<span style="color: var(--accent-rose);">${task.error || 'Download failed'}</span>` : ''}
          ${isRunning ? `<span>${task.downloaded_str || '0 B'} / ${task.total_str || '0 B'} (${task.percent}%)</span>` : ''}
          ${isCompleted ? `<span style="color: var(--accent-emerald);">Saved (${task.total_str || task.downloaded_str})</span>` : ''}
          ${isCancelled ? `<span style="color: var(--text-dim);">Cancelled</span>` : ''}
          ${task.status === 'queued' ? `<span>Waiting for worker slot...</span>` : ''}
        </div>
        <div>
          ${isRunning && !isProcessing ? `<span>${task.speed_str} • ETA ${task.eta_str}</span>` : ''}
          ${isProcessing ? `<span>Merging video & audio streams...</span>` : ''}
        </div>
      </div>
    `;

    // Cancel Button event
    const cancelBtn = card.querySelector('.cancel-task-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', async () => {
        try {
          await fetch(`/api/downloads/cancel/${task.id}`, { method: 'POST' });
          this.showToast('Cancelled download', 'info');
        } catch (err) {
          this.showToast('Failed to cancel download', 'error');
        }
      });
    }

    // View Library button event
    const libBtn = card.querySelector('.view-library-btn');
    if (libBtn) {
      libBtn.addEventListener('click', () => {
        this.switchTab('library');
      });
    }

    return card;
  }

  showToast(message, type = 'info') {
    if (!this.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const iconSvg = type === 'success'
      ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`
      : (type === 'error'
        ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`
        : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`);

    toast.innerHTML = `${iconSvg}<span>${message}</span>`;
    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(12px)';
      toast.style.transition = 'all 0.2s';
      setTimeout(() => toast.remove(), 200);
    }, 3500);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
  window.app.init();
});
