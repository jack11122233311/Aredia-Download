/**
 * Interactive Playlist Inspector, 50-Item Batch Picker & Interception Dialog
 */
class PlaylistManager {
  constructor() {
    this.dialog = document.getElementById('playlist-dialog');
    this.inspectBtn = document.getElementById('inspect-playlist-btn');
    this.closeBtn = document.getElementById('close-playlist-btn');
    this.cancelBtn = document.getElementById('cancel-playlist-btn');
    this.downloadBtn = document.getElementById('download-selected-playlist-btn');
    
    this.titleEl = document.getElementById('playlist-title');
    this.countBadgeEl = document.getElementById('playlist-count-badge');
    this.selectedCountEl = document.getElementById('playlist-selected-count');
    this.downloadLabelEl = document.getElementById('download-selected-label');
    this.itemsListEl = document.getElementById('playlist-items-list');

    this.selectAllBtn = document.getElementById('playlist-select-all');
    this.deselectAllBtn = document.getElementById('playlist-deselect-all');
    this.invertBtn = document.getElementById('playlist-invert');

    // Playlist Choice Interceptor Dialog
    this.interceptorDialog = document.getElementById('playlist-interceptor-dialog');
    this.closeInterceptorBtn = document.getElementById('close-interceptor-btn');
    this.choiceSingleBtn = document.getElementById('btn-choice-single');
    this.choiceBrowseBtn = document.getElementById('btn-choice-browse');
    this.choiceCardSingle = document.getElementById('choice-single-video');
    this.choiceCardBrowse = document.getElementById('choice-browse-playlist');

    this.pendingUrl = '';
    this.onChoiceCallback = null;

    this.items = [];
    this.selectedUrls = new Set();
  }

  init() {
    if (this.inspectBtn) {
      this.inspectBtn.addEventListener('click', () => this.inspectCurrentUrl());
    }

    if (this.closeBtn) this.closeBtn.addEventListener('click', () => this.dialog.close());
    if (this.cancelBtn) this.cancelBtn.addEventListener('click', () => this.dialog.close());

    if (this.selectAllBtn) this.selectAllBtn.addEventListener('click', () => this.selectAll());
    if (this.deselectAllBtn) this.deselectAllBtn.addEventListener('click', () => this.deselectAll());
    if (this.invertBtn) this.invertBtn.addEventListener('click', () => this.invertSelection());

    if (this.downloadBtn) {
      this.downloadBtn.addEventListener('click', () => this.startBatchDownload());
    }

    // Interceptor choices setup
    if (this.closeInterceptorBtn && this.interceptorDialog) {
      this.closeInterceptorBtn.addEventListener('click', () => this.interceptorDialog.close());
    }

    const selectSingle = () => {
      if (this.interceptorDialog) this.interceptorDialog.close();
      if (this.onChoiceCallback) {
        this.onChoiceCallback('single', this.pendingUrl);
      }
    };

    const selectBrowse = () => {
      if (this.interceptorDialog) this.interceptorDialog.close();
      this.inspectUrl(this.pendingUrl, 50);
    };

    if (this.choiceSingleBtn) this.choiceSingleBtn.addEventListener('click', selectSingle);
    if (this.choiceCardSingle) this.choiceCardSingle.addEventListener('click', selectSingle);

    if (this.choiceBrowseBtn) this.choiceBrowseBtn.addEventListener('click', selectBrowse);
    if (this.choiceCardBrowse) this.choiceCardBrowse.addEventListener('click', selectBrowse);

    // Close dialog on backdrop click
    [this.dialog, this.interceptorDialog].forEach(dlg => {
      if (dlg) {
        dlg.addEventListener('click', (e) => {
          const rect = dlg.getBoundingClientRect();
          if (
            e.clientX < rect.left ||
            e.clientX > rect.right ||
            e.clientY < rect.top ||
            e.clientY > rect.bottom
          ) {
            dlg.close();
          }
        });
      }
    });
  }

  isPlaylistUrl(url) {
    if (!url) return false;
    const clean = url.trim().toLowerCase();
    return clean.includes('list=') || clean.includes('playlist?') || clean.includes('/sets/');
  }

  promptPlaylistChoice(url, onChoice) {
    this.pendingUrl = url;
    this.onChoiceCallback = onChoice;
    if (this.interceptorDialog) {
      this.interceptorDialog.showModal();
    }
  }

  async inspectCurrentUrl() {
    const urlInput = document.getElementById('url-input');
    const url = urlInput ? urlInput.value.trim() : '';
    if (!url) {
      window.app.showToast('Please enter a playlist URL first', 'error');
      return;
    }
    await this.inspectUrl(url, 50);
  }

  async inspectUrl(url, limit = 50) {
    this.titleEl.textContent = 'Inspecting Playlist...';
    this.countBadgeEl.textContent = `Scanning (up to ${limit})`;
    this.itemsListEl.innerHTML = '<div style="padding: 30px; text-align: center; color: var(--text-muted);">Fetching up to 50 tracks from yt-dlp...</div>';
    this.dialog.showModal();

    try {
      const res = await fetch('/api/playlist/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, limit })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to inspect playlist');
      }

      const data = await res.json();
      this.items = data.entries || [];
      this.titleEl.textContent = data.title || 'Playlist Inspection';
      this.countBadgeEl.textContent = `${this.items.length} of ${data.total_available} items`;
      
      // Select all by default
      this.selectedUrls = new Set(this.items.map(item => item.url));
      this.renderItems();
      this.updateCounters();
    } catch (err) {
      this.itemsListEl.innerHTML = `<div style="padding: 20px; color: var(--accent-rose); text-align: center;">${err.message}</div>`;
      window.app.showToast(err.message, 'error');
    }
  }

  renderItems() {
    this.itemsListEl.innerHTML = '';
    this.items.forEach(item => {
      const isSelected = this.selectedUrls.has(item.url);
      const row = document.createElement('div');
      row.className = `playlist-item-row ${isSelected ? 'selected' : ''}`;
      
      const thumbSrc = item.thumbnail || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='36' viewBox='0 0 48 36'%3E%3Crect width='48' height='36' fill='%23222'/%3E%3C/svg%3E";
      
      row.innerHTML = `
        <input type="checkbox" ${isSelected ? 'checked' : ''} style="accent-color: var(--primary); width: 16px; height: 16px; cursor: pointer;">
        <img src="${thumbSrc}" class="playlist-item-thumb" alt="Thumb" loading="lazy" onerror="this.style.opacity='0.2'">
        <div class="playlist-item-title" title="${item.title}">${item.index}. ${item.title}</div>
        <div class="playlist-item-dur">${item.duration_str || '--:--'}</div>
      `;

      const checkbox = row.querySelector('input[type="checkbox"]');
      
      const toggle = (checked) => {
        if (checked) {
          this.selectedUrls.add(item.url);
          row.classList.add('selected');
        } else {
          this.selectedUrls.delete(item.url);
          row.classList.remove('selected');
        }
        checkbox.checked = checked;
        this.updateCounters();
      };

      checkbox.addEventListener('change', (e) => toggle(e.target.checked));
      row.addEventListener('click', (e) => {
        if (e.target !== checkbox) toggle(!checkbox.checked);
      });

      this.itemsListEl.appendChild(row);
    });
  }

  selectAll() {
    this.selectedUrls = new Set(this.items.map(item => item.url));
    this.renderItems();
    this.updateCounters();
  }

  deselectAll() {
    this.selectedUrls.clear();
    this.renderItems();
    this.updateCounters();
  }

  invertSelection() {
    const nextSet = new Set();
    this.items.forEach(item => {
      if (!this.selectedUrls.has(item.url)) {
        nextSet.add(item.url);
      }
    });
    this.selectedUrls = nextSet;
    this.renderItems();
    this.updateCounters();
  }

  updateCounters() {
    const count = this.selectedUrls.size;
    const total = this.items.length;
    if (this.selectedCountEl) this.selectedCountEl.textContent = `${count} of ${total} selected`;
    if (this.downloadLabelEl) this.downloadLabelEl.textContent = `Download Selected (${count})`;
    if (this.downloadBtn) this.downloadBtn.disabled = count === 0;
  }

  async startBatchDownload() {
    const urls = Array.from(this.selectedUrls);
    if (!urls.length) return;

    const opts = window.presetsManager.getOptions();
    this.downloadBtn.disabled = true;

    try {
      const res = await fetch('/api/downloads/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls: urls,
          preset_id: opts.preset_id,
          mode: opts.mode,
          audio_format: opts.audio_format,
          audio_bitrate: opts.audio_bitrate,
          subfolder: opts.subfolder,
          embed_subtitles: opts.embed_subtitles,
          start_time: opts.start_time,
          end_time: opts.end_time,
          normalize_audio: opts.normalize_audio,
          sponsorblock: opts.sponsorblock,
          rate_limit: opts.rate_limit,
          custom_format: opts.custom_format
        })
      });

      if (!res.ok) throw new Error('Failed to queue batch downloads');
      const data = await res.json();

      window.app.showToast(`Queued ${data.count} items for download!`, 'success');
      this.dialog.close();
      window.app.switchTab('queue');
      window.terminalManager.toggle(true);
    } catch (err) {
      window.app.showToast(err.message, 'error');
    } finally {
      this.downloadBtn.disabled = false;
    }
  }
}

window.playlistManager = new PlaylistManager();
