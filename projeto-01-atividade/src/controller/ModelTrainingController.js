export class ModelController {
    #modelView;
    #userService;
    #events;
    #currentUser = null;
    constructor({
        modelView,
        userService,
        events,
    }) {
        this.#modelView = modelView;
        this.#userService = userService;
        this.#events = events;

        this.init();
    }

    static init(deps) {
        return new ModelController(deps);
    }

    async init() {
        this.setupCallbacks();
    }

    setupCallbacks() {
        this.#modelView.registerTrainModelCallback(this.handleTrainModel.bind(this));
        this.#modelView.registerRunRecommendationCallback(this.handleRunRecommendation.bind(this));

        this.#events.onUserSelected((user) => {
            this.#currentUser = user;
            this.#modelView.enableRecommendButton();
        });

        this.#events.onTrainingComplete(() => {
            if (this.#currentUser) {
                this.#modelView.enableRecommendButton();
            }
        });

        this.#events.onProgressUpdate(
            (progress) => {
                this.handleTrainingProgressUpdate(progress);
            }
        );

        this.#events.onModelError(({ message }) => {
            this.#modelView.showError(message);
        });
    }

    async handleTrainModel() {
        this.#events.dispatchTrainModel({});
    }

    handleTrainingProgressUpdate(progress) {
        this.#modelView.updateTrainingProgress(progress);
    }

    async handleRunRecommendation() {
        const currentUser = this.#currentUser;
        const updatedUser = await this.#userService.getUserWithPurchases(currentUser.id);
        this.#events.dispatchRecommend(updatedUser || currentUser);
    }
}
