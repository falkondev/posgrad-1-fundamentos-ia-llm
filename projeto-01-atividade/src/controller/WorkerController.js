import { workerEvents } from "../events/constants.js";

export class WorkerController {
    #worker;
    #events;
    #isAutoRecommend = false;
    constructor({ worker, events }) {
        this.#worker = worker;
        this.#events = events;
        this.init();
    }

    async init() {
        this.setupCallbacks();
        this.#worker.postMessage({ action: workerEvents.loadModel });
    }

    static init(deps) {
        return new WorkerController(deps);
    }

    setupCallbacks() {
        this.#events.onTrainModel(() => {
            this.triggerTrain();
        });

        this.#events.onRecommend((data) => {
            this.#isAutoRecommend = false;
            this.triggerRecommend(data);
        });

        this.#events.onAutoRecommend((user) => {
            this.#isAutoRecommend = true;
            this.triggerRecommend(user);
        });

        const eventsToIgnoreLogs = [
            workerEvents.progressUpdate,
            workerEvents.trainingLog,
            workerEvents.tfVisData,
            workerEvents.tfVisLogs,
            workerEvents.trainingComplete,
        ]
        this.#worker.onmessage = (event) => {
            if (!eventsToIgnoreLogs.includes(event.data.type))
                console.log(event.data);

            if (event.data.type === workerEvents.progressUpdate) {
                this.#events.dispatchProgressUpdate(event.data.progress);
                this.#events.dispatchWorkerLog({ type: 'progress:update', message: `Progresso: ${event.data.progress?.progress ?? 0}%`, timestamp: Date.now() });
            }

            if (event.data.type === workerEvents.trainingComplete) {
                this.#events.dispatchTrainingComplete(event.data);
                this.#events.dispatchWorkerLog({ type: 'training:complete', message: 'Modelo carregado/completo', timestamp: Date.now() });
            }

            if (event.data.type === workerEvents.tfVisData) {
                this.#events.dispatchTFVisorData(event.data.data);
                this.#events.dispatchWorkerLog({ type: 'tfvis:data', message: 'Dados tfvis recebidos', timestamp: Date.now() });
            }

            if (event.data.type === workerEvents.trainingLog) {
                this.#events.dispatchTFVisLogs(event.data);
                const isEpoch = event.data.epoch !== undefined;
                if (isEpoch) {
                    this.#events.dispatchWorkerLog({
                        type: 'training:log',
                        message: event.data.message,
                        timestamp: Date.now(),
                        epoch: event.data.epoch,
                        loss: event.data.loss,
                        accuracy: event.data.accuracy,
                        val_loss: event.data.val_loss,
                        val_accuracy: event.data.val_accuracy,
                        isEpoch: true,
                    });
                } else {
                    this.#events.dispatchWorkerLog({ type: 'training:log', message: event.data.message, timestamp: Date.now() });
                }
            }

            if (event.data.type === workerEvents.recommend) {
                const wasAuto = this.#isAutoRecommend;
                this.#isAutoRecommend = false;
                if (event.data.error === 'MODEL_NOT_TRAINED') {
                    if (!wasAuto) {
                        this.#events.dispatchModelError({ message: 'Modelo não treinado' });
                    }
                    this.#events.dispatchWorkerLog({ type: 'error', message: 'Erro: modelo não treinado', timestamp: Date.now() });
                    return;
                }
                this.#events.dispatchRecommendationsReady(event.data);
                this.#events.dispatchWorkerLog({ type: 'recommend', message: `Recomendações geradas: ${event.data.recommendations?.length ?? 0} produtos`, timestamp: Date.now() });
            }
        };
    }

    triggerTrain() {
        this.#worker.postMessage({ action: workerEvents.trainModel });
    }

    triggerRecommend(user) {
        this.#worker.postMessage({ action: workerEvents.recommend, user });
    }
}