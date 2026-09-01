/**
 * Real-time SSE Manager for live progress, queue synchronization, and CLI logs.
 */
class SSEManager {
  constructor() {
    this.eventSource = null;
    this.reconnectTimeout = null;
    this.statusEl = document.getElementById('sse-status');
    this.statusTextEl = this.statusEl ? this.statusEl.querySelector('.status-text') : null;
    this.onTaskUpdated = null;
    this.onSnapshot = null;
  }

  connect() {
    if (this.eventSource) {
      this.eventSource.close();
    }

    this.updateStatus('connecting', 'Connecting...');

    this.eventSource = new EventSource('/api/downloads/stream');

    this.eventSource.onopen = () => {
      this.updateStatus('connected', 'Live Sync');
    };

    this.eventSource.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        this.handleEvent(payload);
      } catch (err) {
        console.error('Failed to parse SSE event:', err);
      }
    };

    this.eventSource.onerror = () => {
      this.updateStatus('error', 'Reconnecting...');
      if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = null;
      }
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = setTimeout(() => this.connect(), 3000);
    };
  }

  handleEvent(data) {
    if (!data) return;

    if (data.type === 'snapshot' && this.onSnapshot) {
      this.onSnapshot(data.tasks || []);
    } else if ((data.type === 'task_added' || data.type === 'task_updated' || data.type === 'task_progress') && this.onTaskUpdated) {
      this.onTaskUpdated(data.task);
    } else if (data.type === 'log') {
      // Forward to live CLI terminal
      if (window.terminalManager) {
        window.terminalManager.appendLog(data.line, data.task_id);
      }
    }
  }

  updateStatus(state, text) {
    if (!this.statusEl) return;
    if (this.statusTextEl) this.statusTextEl.textContent = text;
    this.statusEl.className = 'sse-status ' + state;
  }
}

window.sseManager = new SSEManager();
