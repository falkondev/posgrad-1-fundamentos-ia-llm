import { View } from './View.js';

export class ProductView extends View {
    #productList = document.querySelector('#productList');
    #loadMoreContainer = document.querySelector('#loadMoreContainer');
    #categoryFilter = document.querySelector('#categoryFilter');
    #brandFilter = document.querySelector('#brandFilter');

    #productTemplate;
    #onBuyProduct;
    #onFilterChange;

    // Pagination state
    #allProducts = [];
    #displayedCount = 0;
    #pageSize = 50;

    constructor() {
        super();
        this.init();
    }

    async init() {
        this.#productTemplate = await this.loadTemplate('./src/view/templates/product-card.html');
        this.#setupLoadMore();
    }

    onUserSelected(user) {
        this.setButtonsState(user.id ? false : true);
    }

    registerBuyProductCallback(callback) {
        this.#onBuyProduct = callback;
    }

    registerFilterChangeCallback(callback) {
        this.#onFilterChange = callback;
    }

    attachFilterListeners() {
        this.#categoryFilter?.addEventListener('change', () => {
            if (this.#onFilterChange) this.#onFilterChange();
        });
        this.#brandFilter?.addEventListener('change', () => {
            if (this.#onFilterChange) this.#onFilterChange();
        });
    }

    getSelectedCategory() {
        return this.#categoryFilter?.value || null;
    }

    getSelectedBrand() {
        return this.#brandFilter?.value || null;
    }

    async loadFilters(productService) {
        const [categories, brands] = await Promise.all([
            productService.getCategories(),
            productService.getBrands(),
        ]);

        if (this.#categoryFilter) {
            categories.forEach(cat => {
                const opt = document.createElement('option');
                opt.value = cat.id;
                opt.textContent = cat.name;
                this.#categoryFilter.appendChild(opt);
            });
        }

        if (this.#brandFilter) {
            brands.forEach(brand => {
                const opt = document.createElement('option');
                opt.value = brand.id;
                opt.textContent = brand.name;
                this.#brandFilter.appendChild(opt);
            });
        }
    }

    render(products, disableButtons = true) {
        if (!this.#productTemplate) return;
        this.#allProducts = products;
        this.#displayedCount = 0;
        this.#productList.innerHTML = '';
        this.#renderPage(disableButtons);
    }

    #renderPage(disableButtons = false) {
        const nextBatch = this.#allProducts.slice(this.#displayedCount, this.#displayedCount + this.#pageSize);
        const html = nextBatch.map((product) => {
            const rank = product.rank ?? null;
            const rankBadge = rank
                ? `<div class="text-center mb-2"><span class="inline-block bg-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full">#${rank} Recomendado</span></div>`
                : '';
            return this.replaceTemplate(this.#productTemplate, {
                id: product.id,
                name: product.name,
                category: product.category,
                price: product.price,
                brand: product.brand || '',
                product: JSON.stringify(product),
                rankBadge,
            });
        }).join('');

        this.#productList.insertAdjacentHTML('beforeend', html);
        this.#displayedCount += nextBatch.length;
        this.attachBuyButtonListeners();
        this.setButtonsState(disableButtons);

        if (this.#loadMoreContainer) {
            const hasMore = this.#displayedCount < this.#allProducts.length;
            this.#loadMoreContainer.classList.toggle('hidden', !hasMore);
        }
    }

    #setupLoadMore() {
        const btn = document.querySelector('#loadMoreBtn');
        btn?.addEventListener('click', () => {
            this.#renderPage(false);
        });
    }

    setButtonsState(disabled) {
        const buttons = this.#productList.querySelectorAll('.buy-now-btn');
        buttons.forEach(button => {
            button.disabled = disabled;
        });
    }

    attachBuyButtonListeners() {
        const buttons = this.#productList.querySelectorAll('.buy-now-btn:not([data-listener])');
        buttons.forEach(button => {
            button.setAttribute('data-listener', '1');
            button.addEventListener('click', () => {
                const product = JSON.parse(button.dataset.product);
                const originalText = button.innerHTML;

                button.innerHTML = '&#10003; Adicionado';
                button.classList.remove('bg-blue-600', 'hover:bg-blue-700');
                button.classList.add('bg-emerald-600', 'hover:bg-emerald-700');
                setTimeout(() => {
                    button.innerHTML = originalText;
                    button.classList.remove('bg-emerald-600', 'hover:bg-emerald-700');
                    button.classList.add('bg-blue-600', 'hover:bg-blue-700');
                }, 500);
                this.#onBuyProduct(product, button);
            });
        });
    }
}
