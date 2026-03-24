export class ProductController {
    #productView;
    #currentUser = null;
    #events;
    #productService;
    #searchInput;
    #searchTimeout = null;
    #showingRecommendations = false;

    constructor({
        productView,
        events,
        productService
    }) {
        this.#productView = productView;
        this.#productService = productService;
        this.#events = events;
        this.init();
    }

    static init(deps) {
        return new ProductController(deps);
    }

    async init() {
        this.setupCallbacks();
        this.setupEventListeners();
        this.setupSearch();

        await this.#productView.loadFilters(this.#productService);
        this.#productView.attachFilterListeners();
        this.#productView.registerFilterChangeCallback(() => this.#handleFilterChange());

        const products = await this.#productService.getProducts();
        this.#productView.render(products, true);
    }

    setupSearch() {
        this.#searchInput = document.querySelector('#productSearch');
        if (!this.#searchInput) return;

        this.#searchInput.addEventListener('input', () => {
            this.#showingRecommendations = false;
            clearTimeout(this.#searchTimeout);
            this.#searchTimeout = setTimeout(() => {
                this.#doSearch();
            }, 300);
        });
    }

    async #doSearch() {
        const query = this.#searchInput?.value.trim() ?? '';
        const category = this.#productView.getSelectedCategory();
        const brand = this.#productView.getSelectedBrand();
        const products = await this.#productService.searchProducts(query, 100, category, brand);
        this.#productView.render(products, !this.#currentUser);
    }

    async #handleFilterChange() {
        this.#showingRecommendations = false;
        await this.#doSearch();
    }

    setupEventListeners() {
        this.#events.onUserSelected((user) => {
            this.#currentUser = user;
            this.#productView.onUserSelected(user);
            // Do NOT auto-dispatch recommend — user must click "Run Recommendation"
        });

        this.#events.onRecommendationsReady(({ recommendations }) => {
            const top10 = recommendations.slice(0, 10).map((r, i) => ({ ...r, rank: i + 1 }));
            this.#showingRecommendations = true;
            this.#productView.render(top10, false);
        });
    }

    setupCallbacks() {
        this.#productView.registerBuyProductCallback(this.handleBuyProduct.bind(this));
    }

    async handleBuyProduct(product) {
        const user = this.#currentUser;
        this.#events.dispatchPurchaseAdded({ user, product });
    }
}
