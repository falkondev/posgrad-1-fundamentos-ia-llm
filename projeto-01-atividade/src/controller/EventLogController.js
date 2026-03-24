export class EventLogController {
    #eventLogView;
    #events;

    constructor({ eventLogView, events }) {
        this.#eventLogView = eventLogView;
        this.#events = events;
        this.setupCallbacks();
    }

    static init(deps) {
        return new EventLogController(deps);
    }

    setupCallbacks() {
        this.#events.onTrainModel(() => {
            this.#eventLogView.clearLog();
        });

        this.#events.onWorkerLog((data) => {
            const { type, message, timestamp, isEpoch, epoch, loss, accuracy, val_loss, val_accuracy } = data;

            if (isEpoch) {
                this.#eventLogView.addEpochEntry(epoch, loss, accuracy, val_loss, val_accuracy);
            } else if (message) {
                this.#eventLogView.addEntry(type, message, timestamp);
            }
        });

        this.#events.onModelError(({ message }) => {
            this.#eventLogView.addEntry('error', message, Date.now());
        });
    }
}
