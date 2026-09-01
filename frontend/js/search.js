/**
 * Title & Metadata Search Engine + Multi-Select Batching (Feature 1 & Suggestion C)
 */
class SearchManager {
  constructor() {
    this.searchBtn = document.getElementById('search-btn');
    this.urlInput = document.getElementById('url-input');
    this.resultsSection = document.getElementById('search-results-section');
    this.resultsContainer = document.getElementById('search-grid-container');
    this.resultsCountEl = document.getElementById('search-results-count');
    this.selectAllBtn = document.getElementById('search-select-all');
    this.downloadSelectedBtn = document.getElementById('search-download-selected');
    this.downloadLabel = document.getElementById('search-download-label');

    this.results = [];
    this.selectedUrls = new Set();
  }

  init() {
    if (this.searchBtn) {
      this.searchBtn.addEventListener('click', () => this.performSearch());
    }

    if (this.urlInput) {
      this.urlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !this.isUrl(this.urlInput.value.trim())) {
          e.preventDefault();
          this.performSearch();
        }
      });
    }

    if (this.selectAllBtn) {
      this.selectAllBtn.addEventListener('click', () => this.toggleSelectAll());
    }

    if (this.downloadSelectedBtn) {
      this.downloadSelectedBtn.addEventListener('click', () => this.downloadSelected());
    }
  }

  isUrl(text) {
    return text.startsWith('http://') || text.startsWith('https://') || text.startsWith('www.');
  }

  async performSearch() {
    const query = this.urlInput.value.trim();
    if (!query) {
      window.app.showToast('Please enter search keywords', 'error');
      return;
    }

    this.searchBtn.disabled = true;
    this.resultsSection.style.display = 'block';
    this.resultsCountEl.textContent = 'Searching...';
    this.resultsContainer.innerHTML = '<div style="grid-column: 1 / -1; padding: 40px; text-align: center; color: var(--text-muted);">Fetching matching titles from yt-dlp...</div>';
    
    // Smooth scroll to results
    this.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, limit: 12 })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Search failed');
      }

      const data = await res.json();
      this.results = data.results || [];
      this.resultsCountEl.textContent = `${this.results.length} matches for "${query}"`;
      this.selectedUrls.clear();
      this.render();
      this.updateSelectionCounters();
    } catch (err) {
      this.resultsContainer.innerHTML = `<div style="grid-column: 1 / -1; padding: 30px; text-align: center; color: var(--accent-rose);">${err.message}</div>`;
      window.app.showToast(err.message, 'error');
    } finally {
      this.searchBtn.disabled = false;
    }
  }

  render() {
    if (!this.resultsContainer) return;
    this.resultsContainer.innerHTML = '';

    if (this.results.length === 0) {
      this.resultsContainer.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-dim);">
          No video matches found. Try different search terms.
        </div>
      `;
      return;
    }

    this.results.forEach(item => {
      const isSelected = this.selectedUrls.has(item.url);
      const card = document.createElement('div');
      card.className = `search-card ${isSelected ? 'selected' : ''}`;
      
      const thumb = item.thumbnail || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 160 90'%3E%3Crect width='100%25' height='100%25' fill='%231a2338'/%3E%3C/svg%3E";

      card.innerHTML = `
        <div class="search-thumb-wrapper">
          <img src="${thumb}" class="search-thumb" alt="Thumbnail" loading="lazy" onerror="this.style.opacity='0.2'">
          <span class="search-duration-badge">${item.duration_str}</span>
          <input type="checkbox" class="search-card-checkbox" ${isSelected ? 'checked' : ''} title="Select for batch download">
        </div>
        <div class="search-card-body">
          <div class="search-title" title="${item.title}">${item.title}</div>
          <div class="search-meta">
            <span>${item.uploader}</span>
            ${item.views_str ? `<span>• ${item.views_str}</span>` : ''}
          </div>
          <div class="search-actions">
            <button type="button" class="btn-subtle btn-xs btn-quick-download" data-mode="current" title="Download with current settings">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              <span>Download</span>
            </button>
            <button type="button" class="btn-subtle btn-xs btn-quick-audio" data-mode="audio" title="Download as MP3 Audio">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
              <span>Audio</span>
            </button>
          </div>
        </div>
      `;

      // Checkbox event
      const checkbox = card.querySelector('.search-card-checkbox');
      const toggle = (checked) => {
        if (checked) {
          this.selectedUrls.add(item.url);
          card.classList.add('selected');
        } else {
          this.selectedUrls.delete(item.url);
          card.classList.remove('selected');
        }
        checkbox.checked = checked;
        this.updateSelectionCounters();
      };

      checkbox.addEventListener('change', (e) => toggle(e.target.checked));
      
      // Quick download buttons
      const dlBtn = card.querySelector('.btn-quick-download');
      dlBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.downloadSingle(item.url, null);
      });

      const audioBtn = card.querySelector('.btn-quick-audio');
      audioBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.downloadSingle(item.url, 'audio');
      });

      this.resultsContainer.appendChild(card);
    });
  }

  toggleSelectAll() {
    if (this.selectedUrls.size === this.results.length) {
      this.selectedUrls.clear();
    } else {
      this.selectedUrls = new Set(this.results.map(r => r.url));
    }
    this.render();
    this.updateSelectionCounters();
  }

  updateSelectionCounters() {
    const count = this.selectedUrls.size;
    if (this.downloadLabel) this.downloadLabel.textContent = `Download Selected (${count})`;
    if (this.downloadSelectedBtn) this.downloadSelectedBtn.disabled = count === 0;
    if (this.selectAllBtn) {
      this.selectAllBtn.textContent = count === this.results.length && count > 0 ? 'Deselect All' : 'Select All';
    }
  }

  async downloadSingle(url, forceMode = null) {
    const opts = window.presetsManager.getOptions();
    if (forceMode === 'audio') {
      opts.mode = 'audio';
    }

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
          start_time: opts.start_time,
          end_time: opts.end_time,
          normalize_audio: opts.normalize_audio,
          sponsorblock: opts.sponsorblock,
          rate_limit: opts.rate_limit,
          custom_format: opts.custom_format
        })
      });

      if (!res.ok) throw new Error('Failed to start download');
      window.app.showToast('Download started!', 'success');
      window.terminalManager.toggle(true); // Open live CLI drawer
    } catch (err) {
      window.app.showToast(err.message, 'error');
    }
  }

  async downloadSelected() {
    const urls = Array.from(this.selectedUrls);
    if (!urls.length) return;

    const opts = window.presetsManager.getOptions();
    this.downloadSelectedBtn.disabled = true;

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
          start_time: opts.start_time,
          end_time: opts.end_time,
          normalize_audio: opts.normalize_audio,
          sponsorblock: opts.sponsorblock,
          rate_limit: opts.rate_limit,
          custom_format: opts.custom_format
        })
      });

      if (!res.ok) throw new Error('Failed to queue batch download');
      const data = await res.json();

      window.app.showToast(`Queued ${data.count} items for download!`, 'success');
      window.app.switchTab('queue');
      window.terminalManager.toggle(true);
    } catch (err) {
      window.app.showToast(err.message, 'error');
    } finally {
      this.downloadSelectedBtn.disabled = false;
    }
  }
}

window.searchManager = new SearchManager();
