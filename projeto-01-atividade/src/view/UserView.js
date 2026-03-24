import { View } from './View.js';

export class UserView extends View {
    #userSearch = document.querySelector('#userSearch');
    #userSearchResults = document.querySelector('#userSearchResults');
    #selectedUserId = document.querySelector('#selectedUserId');
    #userAge = document.querySelector('#userAge');
    #pastPurchasesList = document.querySelector('#pastPurchasesList');

    #purchaseTemplate;
    #onUserSelect;
    #onPurchaseRemove;
    #searchTimeout = null;
    #onSearch;

    constructor() {
        super();
        this.init();
    }

    async init() {
        this.#purchaseTemplate = await this.loadTemplate('./src/view/templates/past-purchase.html');
        this.attachSearchListener();
    }

    registerUserSelectCallback(callback) {
        this.#onUserSelect = callback;
    }

    registerPurchaseRemoveCallback(callback) {
        this.#onPurchaseRemove = callback;
    }

    registerSearchCallback(callback) {
        this.#onSearch = callback;
    }

    attachSearchListener() {
        this.#userSearch?.addEventListener('input', () => {
            clearTimeout(this.#searchTimeout);
            const query = this.#userSearch.value.trim();

            if (!query) {
                this.#hideResults();
                return;
            }

            this.#searchTimeout = setTimeout(() => {
                if (this.#onSearch) this.#onSearch(query);
            }, 300);
        });

        document.addEventListener('click', (e) => {
            if (!this.#userSearch?.contains(e.target) && !this.#userSearchResults?.contains(e.target)) {
                this.#hideResults();
            }
        });
    }

    renderSearchResults(users) {
        if (!this.#userSearchResults) return;

        if (!users.length) {
            this.#userSearchResults.innerHTML = '<div class="px-3 py-2 text-sm text-gray-400">Nenhum usuário encontrado</div>';
        } else {
            this.#userSearchResults.innerHTML = users.map(user => `
                <div class="user-result px-3 py-2 text-sm text-gray-800 cursor-pointer hover:bg-blue-50 transition-colors"
                     data-user='${JSON.stringify(user)}'>
                    <span class="font-medium">${user.name}</span>
                    <span class="text-gray-400 text-xs ml-1">· Age ${user.age}</span>
                </div>
            `).join('');

            this.#userSearchResults.querySelectorAll('.user-result').forEach(el => {
                el.addEventListener('click', () => {
                    const user = JSON.parse(el.dataset.user);
                    this.selectUser(user);
                });
            });
        }

        this.#userSearchResults.classList.remove('hidden');
    }

    selectUser(user) {
        if (this.#userSearch) this.#userSearch.value = user.name;
        if (this.#selectedUserId) this.#selectedUserId.value = user.id;
        this.#hideResults();

        if (this.#onUserSelect) this.#onUserSelect(user.id);
    }

    clearSelection() {
        if (this.#userSearch) this.#userSearch.value = '';
        if (this.#selectedUserId) this.#selectedUserId.value = '';
        if (this.#userAge) this.#userAge.value = '';
        if (this.#pastPurchasesList) this.#pastPurchasesList.innerHTML = '';
    }

    #hideResults() {
        this.#userSearchResults?.classList.add('hidden');
    }

    renderUserDetails(user) {
        if (this.#userAge) this.#userAge.value = user.age;
    }

    renderPastPurchases(pastPurchases) {
        if (!this.#purchaseTemplate) return;

        if (!pastPurchases || pastPurchases.length === 0) {
            this.#pastPurchasesList.innerHTML = '<p>No past purchases found.</p>';
            return;
        }

        const html = pastPurchases.map(product => {
            return this.replaceTemplate(this.#purchaseTemplate, {
                ...product,
                product: JSON.stringify(product)
            });
        }).join('');

        this.#pastPurchasesList.innerHTML = html;
        this.attachPurchaseClickHandlers();
    }

    addPastPurchase(product) {
        if (this.#pastPurchasesList.innerHTML.includes('No past purchases found')) {
            this.#pastPurchasesList.innerHTML = '';
        }

        const purchaseHtml = this.replaceTemplate(this.#purchaseTemplate, {
            ...product,
            product: JSON.stringify(product)
        });

        this.#pastPurchasesList.insertAdjacentHTML('afterbegin', purchaseHtml);

        const newPurchase = this.#pastPurchasesList.firstElementChild.querySelector('.past-purchase');
        newPurchase.classList.add('past-purchase-highlight');

        setTimeout(() => {
            newPurchase.classList.remove('past-purchase-highlight');
        }, 1000);

        this.attachPurchaseClickHandlers();
    }

    attachPurchaseClickHandlers() {
        const purchaseElements = document.querySelectorAll('.past-purchase');

        purchaseElements.forEach(purchaseElement => {
            purchaseElement.onclick = (event) => {
                const product = JSON.parse(purchaseElement.dataset.product);
                const userId = this.getSelectedUserId();
                const element = purchaseElement.closest('.purchase-item');

                this.#onPurchaseRemove({ element, userId, product });

                element.style.transition = 'opacity 0.5s ease';
                element.style.opacity = '0';

                setTimeout(() => {
                    element.remove();
                    if (document.querySelectorAll('.past-purchase').length === 0) {
                        this.renderPastPurchases([]);
                    }
                }, 500);
            };
        });
    }

    getSelectedUserId() {
        return this.#selectedUserId?.value ? Number(this.#selectedUserId.value) : null;
    }
}
