export class EventLogView {
    #logContainer = document.querySelector('#eventLog');
    #clearBtn = document.querySelector('#clearLogBtn');
    #toggleBtn = document.querySelector('#toggleLogBtn');
    #minimized = false;

    constructor() {
        this.attachEventListeners();
    }

    attachEventListeners() {
        this.#clearBtn?.addEventListener('click', () => this.clearLog());
        this.#toggleBtn?.addEventListener('click', () => this.#toggleMinimize());
    }

    #toggleMinimize() {
        this.#minimized = !this.#minimized;
        if (this.#logContainer) {
            this.#logContainer.classList.toggle('hidden', this.#minimized);
        }
        if (this.#toggleBtn) {
            this.#toggleBtn.textContent = this.#minimized ? 'Expandir' : 'Minimizar';
        }
    }
    addEntry(type, message, timestamp) {
        if (!this.#logContainer) return;

        const time = new Date(timestamp).toLocaleTimeString('pt-BR', { hour12: false });
        const { level, levelClass, textClass } = this.#getStyle(type);

        const entry = document.createElement('div');
        entry.className = `log-entry flex items-start gap-2 font-mono text-xs leading-relaxed`;
        entry.innerHTML = `
            <span class="text-gray-600 shrink-0 select-none">${time}</span>
            <span class="shrink-0 font-bold px-1 rounded ${levelClass}">${level}</span>
            <span class="${textClass} break-all">${this.#escapeHtml(message ?? '')}</span>
        `;

        this.#logContainer.appendChild(entry);
        this.scrollToBottom();
    }

    addEpochEntry(epoch, loss, acc, valLoss, valAcc) {
        if (!this.#logContainer) return;

        const entry = document.createElement('div');
        entry.className = 'log-entry flex items-center gap-1.5 flex-wrap font-mono text-xs leading-relaxed';
        entry.innerHTML = `
            <span class="text-gray-600 select-none shrink-0">epoch</span>
            <span class="text-cyan-400 font-bold">${String(epoch + 1).padStart(3, '0')}</span>
            <span class="log-badge bg-blue-900 text-blue-300">loss=${loss.toFixed(4)}</span>
            <span class="log-badge bg-emerald-900 text-emerald-300">acc=${acc.toFixed(4)}</span>
            <span class="log-badge bg-orange-900 text-orange-300">val_loss=${valLoss.toFixed(4)}</span>
            <span class="log-badge bg-violet-900 text-violet-300">val_acc=${valAcc.toFixed(4)}</span>
        `;

        this.#logContainer.appendChild(entry);
        this.scrollToBottom();
    }

    clearLog() {
        if (this.#logContainer) this.#logContainer.innerHTML = '';
    }

    scrollToBottom() {
        if (this.#logContainer) {
            this.#logContainer.scrollTop = this.#logContainer.scrollHeight;
        }
    }

    #getStyle(type) {
        const styles = {
            'training:log':      { level: 'INFO',  levelClass: 'bg-blue-900 text-blue-300',    textClass: 'text-gray-300' },
            'progress:update':   { level: 'WAIT',  levelClass: 'bg-yellow-900 text-yellow-300', textClass: 'text-yellow-200' },
            'training:complete': { level: 'DONE',  levelClass: 'bg-emerald-900 text-emerald-300', textClass: 'text-emerald-200' },
            'recommend':         { level: 'DATA',  levelClass: 'bg-violet-900 text-violet-300', textClass: 'text-violet-200' },
            'error':             { level: 'ERROR', levelClass: 'bg-red-900 text-red-300',       textClass: 'text-red-200' },
            'tfvis:data':        { level: 'STAT',  levelClass: 'bg-gray-800 text-gray-400',     textClass: 'text-gray-400' },
            'tfvis:logs':        { level: 'STAT',  levelClass: 'bg-gray-800 text-gray-400',     textClass: 'text-gray-400' },
        };
        return styles[type] ?? { level: 'LOG', levelClass: 'bg-gray-800 text-gray-400', textClass: 'text-gray-300' };
    }

    #escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }
}
