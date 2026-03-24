import { View } from './View.js';

export class ModelView extends View {
    #trainModelBtn = document.querySelector('#trainModelBtn');
    #runRecommendationBtn = document.querySelector('#runRecommendationBtn');
    #onTrainModel;
    #onRunRecommendation;
    #errorTimeout = null;

    constructor() {
        super();
        this.attachEventListeners();
    }

    registerTrainModelCallback(callback) {
        this.#onTrainModel = callback;
    }
    registerRunRecommendationCallback(callback) {
        this.#onRunRecommendation = callback;
    }

    attachEventListeners() {
        this.#trainModelBtn.addEventListener('click', () => {
            this.#onTrainModel();
        });
        this.#runRecommendationBtn.addEventListener('click', () => {
            this.#onRunRecommendation();
        });
    }

    enableRecommendButton() {
        this.#runRecommendationBtn.disabled = false;
    }

    showError(message) {
        if (this.#errorTimeout) clearTimeout(this.#errorTimeout);

        let banner = document.querySelector('#modelErrorBanner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'modelErrorBanner';
            banner.className = 'mt-3 px-4 py-2 bg-red-100 border border-red-300 text-red-700 text-sm rounded-lg';
            this.#runRecommendationBtn.closest('.flex').after(banner);
        }
        banner.textContent = `❌ ${message}`;
        banner.classList.remove('hidden');

        this.#errorTimeout = setTimeout(() => {
            banner.classList.add('hidden');
        }, 5000);
    }

    updateTrainingProgress(progress) {
        this.#trainModelBtn.disabled = true;
        this.#trainModelBtn.innerHTML = `
            <svg class="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
            Treinando...
        `;

        if (progress.progress === 100) {
            this.#trainModelBtn.disabled = false;
            this.#trainModelBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M15 2v2M9 2v2M2 9h2M2 15h2M22 9h-2M22 15h-2M15 22v-2M9 22v-2"/></svg>
                Treinar Modelo de Recomendação
            `;
        }
    }
}
