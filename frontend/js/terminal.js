/**
 * Live Interactive CLI Terminal Drawer Manager (Feature C)
 */
class TerminalManager {
  constructor() {
    this.drawer = document.getElementById('cli-terminal-drawer');
    this.toggleBtn = document.getElementById('btn-toggle-terminal');
    this.minimizeBtn = document.getElementById('btn-minimize-terminal');
    this.header = document.getElementById('terminal-header');
    this.body = document.getElementById('terminal-body');
    this.countEl = document.getElementById('terminal-line-count');
    this.autoScrollEl = document.getElementById('terminal-autoscroll');
    this.copyBtn = document.getElementById('btn-copy-terminal');
    this.clearBtn = document.getElementById('btn-clear-terminal');
    this.pulseEl = document.getElementById('terminal-pulse');

    this.isOpen = false;
    this.lineCount = 1;
    this.maxLines = 1000;
  }

  init() {
    if (this.toggleBtn) {
      this.toggleBtn.addEventListener('click', () => this.toggle());
    }

    if (this.minimizeBtn) {
      this.minimizeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggle();
      });
    }

    if (this.header) {
      this.header.addEventListener('click', (e) => {
        // Prevent toggle if clicking buttons
        if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT') {
          this.toggle();
        }
      });
    }

    if (this.copyBtn) {
      this.copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.copyLogs();
      });
    }

    if (this.clearBtn) {
      this.clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.clear();
      });
    }
  }

  toggle(forceOpen = null) {
    this.isOpen = forceOpen !== null ? forceOpen : !this.isOpen;
    if (this.drawer) {
      this.drawer.classList.toggle('open', this.isOpen);
    }
    if (this.toggleBtn) {
      this.toggleBtn.classList.toggle('active', this.isOpen);
    }
    if (this.isOpen) {
      this.scrollToBottom();
      if (this.pulseEl) this.pulseEl.style.display = 'none';
    }
  }

  appendLog(line, taskId = null) {
    if (!this.body) return;

    const row = document.createElement('div');
    row.className = 'terminal-line';

    // Parse level tag e.g. [download], [ffmpeg], [error], [info], [debug]
    let tagClass = 'tag-info';
    let tagText = '[info]';
    let content = line;

    if (line.startsWith('[download]')) {
      tagClass = 'tag-download';
      tagText = '[download]';
      content = line.replace('[download]', '').trim();
    } else if (line.startsWith('[ffmpeg]')) {
      tagClass = 'tag-ffmpeg';
      tagText = '[ffmpeg]';
      content = line.replace('[ffmpeg]', '').trim();
    } else if (line.startsWith('[error]') || line.toLowerCase().includes('error:')) {
      tagClass = 'tag-error';
      tagText = '[error]';
      content = line.replace('[error]', '').trim();
    } else if (line.startsWith('[warning]')) {
      tagClass = 'tag-warning';
      tagText = '[warning]';
      content = line.replace('[warning]', '').trim();
    } else if (line.startsWith('[cli]')) {
      tagClass = 'tag-cli';
      tagText = '[cli]';
      content = line.replace('[cli]', '').trim();
    } else if (line.startsWith('[debug]')) {
      tagClass = 'tag-debug';
      tagText = '[debug]';
      content = line.replace('[debug]', '').trim();
    }

    const timeStr = new Date().toLocaleTimeString();
    const taskPrefix = taskId ? `[${taskId}] ` : '';

    row.innerHTML = `
      <span class="log-time">${timeStr}</span>
      <span class="log-tag ${tagClass}">${tagText}</span>
      <span class="log-content">${this.escapeHtml(taskPrefix + content)}</span>
    `;

    this.body.appendChild(row);
    this.lineCount++;

    // Prune old lines if exceeding maximum
    if (this.lineCount > this.maxLines) {
      const first = this.body.querySelector('.terminal-line');
      if (first) first.remove();
      this.lineCount--;
    }

    if (this.countEl) {
      this.countEl.textContent = `${this.lineCount} lines`;
    }

    if (!this.isOpen && this.pulseEl) {
      this.pulseEl.style.display = 'inline-block';
    }

    if (this.autoScrollEl?.checked) {
      this.scrollToBottom();
    }
  }

  scrollToBottom() {
    if (this.body) {
      this.body.scrollTop = this.body.scrollHeight;
    }
  }

  copyLogs() {
    if (!this.body) return;
    const text = Array.from(this.body.querySelectorAll('.terminal-line'))
      .map(el => el.innerText)
      .join('\n');

    navigator.clipboard.writeText(text).then(() => {
      window.app.showToast('Terminal logs copied to clipboard!', 'info');
    });
  }

  clear() {
    if (!this.body) return;
    this.body.innerHTML = '<div class="terminal-line system"><span class="log-tag tag-system">[system]</span> Logs cleared.</div>';
    this.lineCount = 1;
    if (this.countEl) this.countEl.textContent = '1 line';
  }

  escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

window.terminalManager = new TerminalManager();
