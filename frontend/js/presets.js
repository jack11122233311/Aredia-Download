/**
 * Presets, Audio Modes, Subfolders, and Download Configuration Manager
 */
class PresetsManager {
  constructor() {
    this.presets = [];
    this.currentMode = 'video'; // 'video' or 'audio'
    this.selectedPresetId = localStorage.getItem('ytdl_selected_preset') || 'best_video';
    this.selectedAudioFormat = 'mp3';
    this.selectedSubfolder = '';
    
    this.container = document.getElementById('preset-grid');
    this.accordion = document.querySelector('.options-accordion');
    this.accordionHeader = document.getElementById('options-toggle');

    this.videoSection = document.getElementById('video-presets-section');
    this.audioSection = document.getElementById('audio-options-section');
    this.modeVideoBtn = document.getElementById('mode-video-btn');
    this.modeAudioBtn = document.getElementById('mode-audio-btn');
    this.audioBitrateSelect = document.getElementById('audio-bitrate-select');
    this.customSubfolderInput = document.getElementById('custom-subfolder-input');
    this.submitBtnLabel = document.getElementById('submit-btn-label');
  }

  async init() {
    this.setupModeSwitch();
    this.setupAccordion();
    this.setupAudioFormatChips();
    this.setupSubfolderChips();
    await this.loadPresets();
  }

  setupModeSwitch() {
    if (this.modeVideoBtn && this.modeAudioBtn) {
      this.modeVideoBtn.addEventListener('click', () => this.setMode('video'));
      this.modeAudioBtn.addEventListener('click', () => this.setMode('audio'));
    }
  }

  setMode(mode) {
    this.currentMode = mode;
    
    if (this.modeVideoBtn) this.modeVideoBtn.classList.toggle('active', mode === 'video');
    if (this.modeAudioBtn) this.modeAudioBtn.classList.toggle('active', mode === 'audio');

    if (this.videoSection) this.videoSection.style.display = mode === 'video' ? 'flex' : 'none';
    if (this.audioSection) this.audioSection.style.display = mode === 'audio' ? 'flex' : 'none';

    if (this.submitBtnLabel) {
      this.submitBtnLabel.textContent = mode === 'video' ? 'Start Download (Video)' : `Extract Audio (${this.selectedAudioFormat.toUpperCase()})`;
    }
  }

  setupAudioFormatChips() {
    const chips = document.querySelectorAll('.format-chip');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        chips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.selectedAudioFormat = chip.dataset.format;
        
        const bitrateGroup = document.getElementById('bitrate-group');
        if (bitrateGroup) {
          bitrateGroup.style.display = ['flac', 'wav'].includes(this.selectedAudioFormat) ? 'none' : 'flex';
        }

        if (this.submitBtnLabel && this.currentMode === 'audio') {
          this.submitBtnLabel.textContent = `Extract Audio (${this.selectedAudioFormat.toUpperCase()})`;
        }
      });
    });
  }

  setupSubfolderChips() {
    const chips = document.querySelectorAll('.subfolder-chip');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        chips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.selectedSubfolder = chip.dataset.subfolder;
        if (this.customSubfolderInput) {
          this.customSubfolderInput.value = '';
        }
      });
    });

    if (this.customSubfolderInput) {
      this.customSubfolderInput.addEventListener('input', () => {
        if (this.customSubfolderInput.value.trim()) {
          chips.forEach(c => c.classList.remove('active'));
          this.selectedSubfolder = this.customSubfolderInput.value.trim();
        }
      });
    }
  }

  setupAccordion() {
    if (this.accordionHeader && this.accordion) {
      this.accordionHeader.addEventListener('click', () => {
        this.accordion.classList.toggle('open');
      });
    }
  }

  async loadPresets() {
    try {
      const res = await fetch('/api/downloads/presets');
      if (!res.ok) throw new Error('Failed to load presets');
      this.presets = await res.json();
      this.render();
    } catch (err) {
      console.error('Error loading presets:', err);
      this.presets = [
        { id: 'best_video', name: 'Best Quality Video', badge: 'Video Auto', description: 'Highest resolution video + audio automatically merged' },
        { id: 'video_1080p', name: '1080p Full HD', badge: '1080p MP4', description: 'Standard 1080p video, highly compatible' },
        { id: 'video_720p', name: '720p HD (Compact)', badge: '720p MP4', description: 'Quick download, smaller file size' }
      ];
      this.render();
    }
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = '';

    this.presets.filter(p => !p.id.startsWith('audio_')).forEach(preset => {
      const card = document.createElement('div');
      card.className = `preset-card ${preset.id === this.selectedPresetId ? 'selected' : ''}`;
      card.id = `preset-${preset.id}`;
      card.innerHTML = `
        <div>
          <div class="preset-header">
            <span class="preset-title">${preset.name}</span>
            <span class="preset-badge">${preset.badge || 'Preset'}</span>
          </div>
          <p class="preset-desc">${preset.description}</p>
        </div>
      `;

      card.addEventListener('click', () => {
        this.selectPreset(preset.id);
      });

      this.container.appendChild(card);
    });
  }

  selectPreset(presetId) {
    this.selectedPresetId = presetId;
    localStorage.setItem('ytdl_selected_preset', presetId);

    const cards = this.container.querySelectorAll('.preset-card');
    cards.forEach(c => c.classList.remove('selected'));

    const activeCard = document.getElementById(`preset-${presetId}`);
    if (activeCard) activeCard.classList.add('selected');
  }

  getOptions() {
    const sponsorblock = document.getElementById('opt-sponsorblock')?.checked ?? true;
    const embedSubtitles = document.getElementById('opt-subtitles')?.checked ?? false;
    const normalizeAudio = document.getElementById('opt-normalize-audio')?.checked ?? false;
    const rateLimit = document.getElementById('opt-rate-limit')?.value.trim() || null;
    const customFormat = document.getElementById('opt-custom-format')?.value.trim() || null;
    const startTime = document.getElementById('trim-start-time')?.value.trim() || null;
    const endTime = document.getElementById('trim-end-time')?.value.trim() || null;
    const audioBitrate = this.audioBitrateSelect ? this.audioBitrateSelect.value : '320';

    let subfolder = this.selectedSubfolder;
    if (this.customSubfolderInput && this.customSubfolderInput.value.trim()) {
      subfolder = this.customSubfolderInput.value.trim();
    }

    return {
      mode: this.currentMode,
      preset_id: this.selectedPresetId,
      audio_format: this.selectedAudioFormat,
      audio_bitrate: audioBitrate,
      subfolder: subfolder || null,
      embed_subtitles: embedSubtitles,
      start_time: startTime,
      end_time: endTime,
      normalize_audio: normalizeAudio,
      sponsorblock: sponsorblock,
      rate_limit: rateLimit,
      custom_format: customFormat
    };
  }
}

window.presetsManager = new PresetsManager();
