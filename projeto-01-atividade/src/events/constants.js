export const events = {
    userSelected: 'user:selected',
    usersUpdated: 'users:updated',
    purchaseAdded: 'purchase:added',
    purchaseRemoved: 'purchase:remove',
    modelTrain: 'training:train',
    trainingComplete: 'training:complete',

    modelProgressUpdate: 'model:progress-update',
    recommendationsReady: 'recommendations:ready',
    recommend: 'recommend',
    autoRecommend: 'auto:recommend',
    modelError: 'model:error',
    workerLog: 'worker:log',
}

export const workerEvents = {
    trainingComplete: 'training:complete',
    trainModel: 'train:model',
    loadModel: 'load:model',
    recommend: 'recommend',
    trainingLog: 'training:log',
    progressUpdate: 'progress:update',
    tfVisData: 'tfvis:data',
    tfVisLogs: 'tfvis:logs',
}