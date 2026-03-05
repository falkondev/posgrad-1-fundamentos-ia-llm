import { View } from './View.js';

export class ProductView extends View {
    // DOM elements
    #productList = document.querySelector('#productList');

    #buttons;
    // Templates and callbacks
    #productTemplate;
    #onBuyProduct;

    constructor() {
        super();
        this.init();
    }

    async init() {
        this.#productTemplate = await this.loadTemplate('./src/view/templates/product-card.html');
    }

    onUserSelected(user) {
        // Enable buttons if a user is selected, otherwise disable them
        this.setButtonsState(user.id ? false : true);
    }

    registerBuyProductCallback(callback) {
        this.#onBuyProduct = callback;
    }

    render(products, disableButtons = true) {
        if (!this.#productTemplate) return;
        const html = products.map(product => {
            return this.replaceTemplate(this.#productTemplate, {
                id: product.id,
                name: product.name,
                category: product.category,
                price: product.price,
                color: product.color,
                product: JSON.stringify(product)
            });
        }).join('');

        this.#productList.innerHTML = html;
        this.attachBuyButtonListeners();

        // Disable all buttons by default
        this.setButtonsState(disableButtons);
    }

    setButtonsState(disabled) {
        if (!this.#buttons) {
            this.#buttons = document.querySelectorAll('.buy-now-btn');
        }
        this.#buttons.forEach(button => {
            button.disabled = disabled;
        });
    }

    attachBuyButtonListeners() {
        this.#buttons = document.querySelectorAll('.buy-now-btn');
        this.#buttons.forEach(button => {

            button.addEventListener('click', (event) => {
                const product = JSON.parse(button.dataset.product);
                const originalText = button.innerHTML;

                button.innerHTML = '&#10003; Added';
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
