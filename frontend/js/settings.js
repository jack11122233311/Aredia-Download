/**
 * Settings, Cookies, Webhooks & yt-dlp Auto-Updater (Features 3, 7, 8, 9)
 */
class SettingsManager {
  constructor() {
    this.dialog = document.getElementById('settings-dialog');
    this.openBtn = document.getElementById('open-settings-btn');
    this.closeBtn = document.getElementById('close-settings-btn');
    this.saveBtn = document.getElementById('btn-save-all-settings');

    // Updater (Feature 7)
    this.updateYtdlpBtn = document.getElementById('btn-update-ytdlp');
    this.versionDisplay = document.getElementById('ytdlp-version-display');

    // Cookies (Feature 3)
    this.cookieStatusText = document.getElementById('cookie-status-text');
    this.cookieStatusBar = document.getElementById('cookie-status-bar');
    this.cookieFileInput = document.getElementById('cookie-file-input');
    this.cookiePasteArea = document.getElementById('cookie-paste-area');
    this.savePastedCookiesBtn = document.getElementById('btn-save-pasted-cookies');
    this.deleteCookiesBtn = document.getElementById('btn-delete-cookies');

    // Webhooks (Feature 8)
    this.discordUrlInput = document.getElementById('cfg-discord-url');
    this.telegramTokenInput = document.getElementById('cfg-telegram-token');
    this.telegramChatInput = document.getElementById('cfg-telegram-chat');
    this.testDiscordBtn = document.getElementById('btn-test-discord');
    this.testTelegramBtn = document.getElementById('btn-test-telegram');

    // Concurrency & Rate Limit (Feature 9)
    this.maxWorkersInput = document.getElementById('cfg-max-workers');
    this.defaultRateInput = document.getElementById('cfg-default-rate');
  }

  init() {
    if (this.openBtn) {
      this.openBtn.addEventListener('click', () => {
        this.loadSettings();
        this.dialog.showModal();
      });
    }

    if (this.closeBtn) this.closeBtn.addEventListener('click', () => this.dialog.close());

    if (this.dialog) {
      this.dialog.addEventListener('click', (e) => {
        const rect = this.dialog.getBoundingClientRect();
        if (
          e.clientX < rect.left ||
          e.clientX > rect.right ||
          e.clientY < rect.top ||
          e.clientY > rect.bottom
        ) {
          this.dialog.close();
        }
      });
    }

    if (this.updateYtdlpBtn) {
      this.updateYtdlpBtn.addEventListener('click', () => this.triggerYtdlpUpdate());
    }

    if (this.cookieFileInput) {
      this.cookieFileInput.addEventListener('change', (e) => this.uploadCookieFile(e.target.files[0]));
    }

    if (this.savePastedCookiesBtn) {
      this.savePastedCookiesBtn.addEventListener('click', () => this.savePastedCookies());
    }

    if (this.deleteCookiesBtn) {
      this.deleteCookiesBtn.addEventListener('click', () => this.deleteCookies());
    }

    if (this.testDiscordBtn) {
      this.testDiscordBtn.addEventListener('click', () => this.testWebhook('discord'));
    }

    if (this.testTelegramBtn) {
      this.testTelegramBtn.addEventListener('click', () => this.testWebhook('telegram'));
    }

    if (this.saveBtn) {
      this.saveBtn.addEventListener('click', () => this.saveAllSettings());
    }
  }

  async loadSettings() {
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) throw new Error('Failed to load settings');
      const data = await res.json();

      if (this.versionDisplay) {
        this.versionDisplay.textContent = `Installed yt-dlp: v${data.ytdlp_version} (Python ${data.python_version})`;
      }

      // Cookies status
      if (data.has_cookies) {
        this.cookieStatusText.textContent = 'Active cookies.txt file detected';
        this.cookieStatusBar.style.borderColor = 'var(--accent-emerald)';
        if (this.deleteCookiesBtn) this.deleteCookiesBtn.style.display = 'inline-block';
      } else {
        this.cookieStatusText.textContent = 'No cookies loaded (running anonymously)';
        this.cookieStatusBar.style.borderColor = 'var(--border-color)';
        if (this.deleteCookiesBtn) this.deleteCookiesBtn.style.display = 'none';
      }

      // Form values
      const s = data.settings || {};
      if (this.discordUrlInput) this.discordUrlInput.value = s.discord_webhook_url || '';
      if (this.telegramTokenInput) this.telegramTokenInput.value = s.telegram_bot_token || '';
      if (this.telegramChatInput) this.telegramChatInput.value = s.telegram_chat_id || '';
      if (this.maxWorkersInput) this.maxWorkersInput.value = s.max_concurrent_downloads || 2;
      if (this.defaultRateInput) this.defaultRateInput.value = s.default_rate_limit || '';

    } catch (err) {
      console.error('Error loading settings:', err);
    }
  }

  async triggerYtdlpUpdate() {
    this.updateYtdlpBtn.disabled = true;
    this.updateYtdlpBtn.innerHTML = '<span>Updating...</span>';
    
    try {
      const res = await fetch('/api/settings/system/update-ytdlp', { method: 'POST' });
      const data = await res.json();
      
      if (data.status === 'success') {
        window.app.showToast('yt-dlp updated successfully!', 'success');
      } else {
        window.app.showToast(data.message || 'Update completed', 'info');
      }
      await this.loadSettings();
    } catch (err) {
      window.app.showToast(err.message, 'error');
    } finally {
      this.updateYtdlpBtn.disabled = false;
      this.updateYtdlpBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
        <span>Update yt-dlp</span>
      `;
    }
  }

  async uploadCookieFile(file) {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/settings/cookies/upload', {
        method: 'POST',
        body: formData
      });
      if (!res.ok) throw new Error('Failed to upload cookies');
      
      window.app.showToast('Cookies.txt uploaded successfully!', 'success');
      await this.loadSettings();
    } catch (err) {
      window.app.showToast(err.message, 'error');
    }
  }

  async savePastedCookies() {
    const text = this.cookiePasteArea.value.trim();
    if (!text) {
      window.app.showToast('Paste area is empty', 'error');
      return;
    }

    try {
      const res = await fetch('/api/settings/cookies/paste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text })
      });
      if (!res.ok) throw new Error('Failed to save pasted cookies');

      this.cookiePasteArea.value = '';
      window.app.showToast('Cookies saved!', 'success');
      await this.loadSettings();
    } catch (err) {
      window.app.showToast(err.message, 'error');
    }
  }

  async deleteCookies() {
    try {
      await fetch('/api/settings/cookies', { method: 'DELETE' });
      window.app.showToast('Cookies removed', 'info');
      await this.loadSettings();
    } catch (err) {
      window.app.showToast(err.message, 'error');
    }
  }

  async testWebhook(type) {
    const payload = { type };
    if (type === 'discord') {
      payload.webhook_url = this.discordUrlInput.value.trim();
    } else {
      payload.bot_token = this.telegramTokenInput.value.trim();
      payload.chat_id = this.telegramChatInput.value.trim();
    }

    try {
      const res = await fetch('/api/settings/webhooks/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Webhook test failed');

      window.app.showToast(data.message, 'success');
    } catch (err) {
      window.app.showToast(err.message, 'error');
    }
  }

  async saveAllSettings() {
    const payload = {
      max_concurrent_downloads: parseInt(this.maxWorkersInput.value) || 2,
      default_rate_limit: this.defaultRateInput.value.trim(),
      discord_webhook_url: this.discordUrlInput.value.trim(),
      telegram_bot_token: this.telegramTokenInput.value.trim(),
      telegram_chat_id: this.telegramChatInput.value.trim()
    };

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed to save settings');

      window.app.showToast('Settings saved successfully!', 'success');
      this.dialog.close();
    } catch (err) {
      window.app.showToast(err.message, 'error');
    }
  }
}

window.settingsManager = new SettingsManager();
