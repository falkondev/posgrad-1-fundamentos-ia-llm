export class UserController {
    #userService;
    #userView;
    #events;
    constructor({
        userView,
        userService,
        events,
    }) {
        this.#userView = userView;
        this.#userService = userService;
        this.#events = events;
    }

    static async init(deps) {
        const controller = new UserController(deps);
        controller.setupCallbacks();
        controller.setupPurchaseObserver();
        controller.#userView.registerSearchCallback(async (query) => {
            const results = await controller.#userService.searchUsers(query, 20);
            controller.#userView.renderSearchResults(results);
        });
        return controller;
    }

    setupCallbacks() {
        this.#userView.registerUserSelectCallback(this.handleUserSelect.bind(this));
        this.#userView.registerPurchaseRemoveCallback(this.handlePurchaseRemove.bind(this));
    }

    setupPurchaseObserver() {
        this.#events.onPurchaseAdded(
            async (...data) => {
                return this.handlePurchaseAdded(...data);
            }
        );
    }

    async handleUserSelect(userId) {
        const user = await this.#userService.getUserWithPurchases(userId);
        if (!user) return;

        await this.#userService.updateUser(user);
        this.#events.dispatchUserSelected(user);
        this.#events.dispatchAutoRecommend(user);
        return this.displayUserDetails(user);
    }

    async handlePurchaseAdded({ user, product }) {
        await this.#userService.savePurchase(user.id, product.id);

        const updatedUser = await this.#userService.getUserWithPurchases(user.id);
        updatedUser.purchases.push({ ...product });

        await this.#userService.updateUser(updatedUser);

        const lastPurchase = updatedUser.purchases[updatedUser.purchases.length - 1];
        this.#userView.addPastPurchase(lastPurchase);
        this.#events.dispatchAutoRecommend(updatedUser);
    }

    async handlePurchaseRemove({ userId, product }) {
        await this.#userService.removePurchase(userId, product.id);

        const user = await this.#userService.getUserWithPurchases(userId);
        const index = user.purchases.findIndex(item => item.id === product.id);

        if (index !== -1) {
            user.purchases.splice(index, 1);
            await this.#userService.updateUser(user);
        }
        this.#events.dispatchAutoRecommend(user);
    }

    async displayUserDetails(user) {
        this.#userView.renderUserDetails(user);
        this.#userView.renderPastPurchases(user.purchases);
    }

    getSelectedUserId() {
        return this.#userView.getSelectedUserId();
    }
}
