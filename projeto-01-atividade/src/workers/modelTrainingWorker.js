import 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js';
import { workerEvents } from '../events/constants.js';

console.log('Model training worker initialized');
let _globalCtx = {};
let _model = null;

const NEGATIVE_RATIO = 4; // 1 positivo para 4 negativos

// Normalização range 0-1
const normalize = (value, min, max) => (max === min) ? 0.5 : (value - min) / (max - min);

const oneHot = (index, length) =>
    tf.oneHot(index, length).cast('float32');

/**
 * Busca dados de treinamento do MySQL via API
 */
async function fetchTrainingData() {
    const response = await fetch('http://localhost:3001/api/training-data');
    const data = await response.json();
    if (!data.success) throw new Error('Falha ao buscar dados de treinamento');
    return data;
}

/**
 * Busca compras de um usuário do MySQL via API
 */
async function fetchUserPurchases(userId) {
    const response = await fetch(`http://localhost:3001/api/user-purchases/${userId}`);
    const data = await response.json();
    if (!data.success) throw new Error('Falha ao buscar compras do usuário');
    return data.purchases;
}

/**
 * Constrói o contexto de treinamento a partir dos dados do MySQL
 */
function makeContext(products, users, orders, { minAge, maxAge, minPrice, maxPrice, categories, brands, productAvgAge }) {
    const categoriesIndex = Object.fromEntries(
        categories.map((cat, i) => [cat, i])
    );

    const brandsIndex = Object.fromEntries(
        brands.map((brand, i) => [brand, i])
    );

    // Mapear orders por user_id e product_id
    const userPurchases = {};
    orders.forEach(o => {
        const uid = String(o.user_id);
        if (!userPurchases[uid]) userPurchases[uid] = new Set();
        userPurchases[uid].add(String(o.product_id));
    });

    const midAge = (minAge + maxAge) / 2;
    const productAvgAgeNorm = Object.fromEntries(
        products.map(p => {
            const pid = String(p.id);
            const avg = productAvgAge[pid] !== undefined ? productAvgAge[pid] : midAge;
            return [pid, normalize(avg, minAge, maxAge)];
        })
    );

    // Dimensão: price(1) + age(1) + categories(one-hot) + brands(one-hot)
    const dimensions = 2 + categories.length + brands.length;

    return {
        products,
        users,
        orders,
        userPurchases,
        categoriesIndex,
        brandsIndex,
        minAge,
        maxAge,
        minPrice,
        maxPrice,
        numCategories: categories.length,
        numBrands: brands.length,
        productAvgAgeNorm,
        dimensions,
    };
}

/**
 * Codifica um produto em vetor de features
 * [price_norm, avg_age_norm, category_onehot..., brand_onehot...]
 */
function encodeProduct(product, context) {
    const price = normalize(parseFloat(product.price), context.minPrice, context.maxPrice);
    const avgAge = context.productAvgAgeNorm[String(product.id)] ?? 0.5;

    const categoryIdx = context.categoriesIndex[product.category] ?? 0;
    const categoryVec = oneHot(categoryIdx, context.numCategories);

    const brandIdx = context.brandsIndex[product.brand] ?? 0;
    const brandVec = oneHot(brandIdx, context.numBrands);

    return tf.concat1d([
        tf.tensor1d([price]),
        tf.tensor1d([avgAge]),
        categoryVec,
        brandVec,
    ]);
}

/**
 * Codifica um usuário como média dos vetores dos seus produtos comprados
 */
function encodeUser(userProducts, context) {
    if (userProducts.length) {
        const vectors = userProducts.map(p => encodeProduct(p, context));
        const stacked = tf.stack(vectors);
        const mean = stacked.mean(0).reshape([1, context.dimensions]);
        vectors.forEach(v => v.dispose());
        stacked.dispose();
        return mean;
    }

    return tf.zeros([1, context.dimensions]);
}

function buildSplitData(allData, inputDim) {
    const splitIdx = Math.floor(allData.length * 0.8);
    const trainData = allData.slice(0, splitIdx);
    const testData = allData.slice(splitIdx);
    const positives = allData.filter(item => item.label === 1).length;
    const negatives = allData.length - positives;

    return {
        train: {
            xs: tf.tensor2d(trainData.map(d => d.input)),
            ys: tf.tensor2d(trainData.map(d => [d.label])),
        },
        test: {
            xs: tf.tensor2d(testData.map(d => d.input)),
            ys: tf.tensor2d(testData.map(d => [d.label])),
        },
        inputDim,
        stats: {
            total: allData.length,
            train: trainData.length,
            test: testData.length,
            positives,
            negatives,
        },
    };
}

/**
 * Separa os dados em treinamento e teste mantendo proporcionalidade.
 * Usa negative sampling com proporção 1:NEGATIVE_RATIO.
 */
async function splitTrainingTestData(context) {
    console.log('Separando dados de treinamento e teste com negative sampling...');
    const inputDim = context.dimensions * 2;

    const positives = [];
    const negatives = [];

    // Construir pares positivos e negativos
    context.users.forEach(user => {
        const uid = String(user.id);
        const purchasedIds = context.userPurchases[uid];
        if (!purchasedIds || purchasedIds.size === 0) return;

        const userProducts = context.products.filter(p => purchasedIds.has(String(p.id)));
        const userVec = encodeUser(userProducts, context).dataSync();

        // Positivos: produtos que o user comprou
        userProducts.forEach(product => {
            const prodVec = encodeProduct(product, context).dataSync();
            positives.push({ input: [...userVec, ...prodVec], label: 1 });
        });

        // Negativos: produtos que o user NÃO comprou (amostragem aleatória)
        const notPurchased = context.products.filter(p => !purchasedIds.has(String(p.id)));
        const numNeg = Math.min(purchasedIds.size * NEGATIVE_RATIO, notPurchased.length);

        // Shuffle e pegar numNeg
        const shuffled = notPurchased.sort(() => Math.random() - 0.5).slice(0, numNeg);
        shuffled.forEach(product => {
            const prodVec = encodeProduct(product, context).dataSync();
            negatives.push({ input: [...userVec, ...prodVec], label: 0 });
        });
    });

    console.log(`Positivos: ${positives.length}, Negativos: ${negatives.length}`);

    // Combinar e embaralhar
    const allData = [...positives, ...negatives].sort(() => Math.random() - 0.5);

    return buildSplitData(allData, inputDim);
}

async function configureNeuralNetAndTrain(splitData) {
    console.log('Configurando rede neural e iniciando treinamento...');
    const model = tf.sequential();

    model.add(tf.layers.dense({
        inputShape: [splitData.inputDim],
        units: 8,
        activation: 'relu',
    }));

    model.add(tf.layers.dense({
        inputShape: [splitData.inputDim],
        units: 4,
        activation: 'relu',
    }));

    model.add(tf.layers.dense({
        units: 1,
        activation: 'sigmoid'
    }));

    model.compile({
        optimizer: tf.train.adam(0.01),
        loss: 'binaryCrossentropy',
        metrics: ['accuracy'],
    });

    postMessage({
        type: workerEvents.trainingLog,
        message: `Dados: ${splitData.stats.train} treino, ${splitData.stats.test} teste (${splitData.stats.positives} pos / ${splitData.stats.negatives} neg)`,
    });

    await model.fit(splitData.train.xs, splitData.train.ys, {
        epochs: 10,
        batchSize: 16,
        shuffle: true,
        validationData: [splitData.test.xs, splitData.test.ys],
        callbacks: {
            onEpochEnd: (epoch, logs) => {
                console.log(`Epoch ${epoch + 1}: loss=${logs.loss.toFixed(4)}, acc=${logs.acc.toFixed(4)}, val_loss=${logs.val_loss.toFixed(4)}, val_acc=${logs.val_acc.toFixed(4)}`);
                postMessage({
                    type: workerEvents.trainingLog,
                    epoch,
                    loss: logs.loss,
                    accuracy: logs.acc,
                    val_loss: logs.val_loss,
                    val_accuracy: logs.val_acc,
                });
            }
        }
    });

    // Avaliar no conjunto de teste
    const evalResult = model.evaluate(splitData.test.xs, splitData.test.ys);
    const testLoss = evalResult[0].dataSync()[0];
    const testAcc = evalResult[1].dataSync()[0];
    postMessage({
        type: workerEvents.trainingLog,
        message: `Avaliação no teste: loss=${testLoss.toFixed(4)}, acc=${testAcc.toFixed(4)}`,
    });

    return model;
}

async function buildContext() {
    postMessage({ type: workerEvents.trainingLog, message: 'Buscando dados do MySQL...' });
    const { products, orders, users, stats, categories, brands, productAvgAge } = await fetchTrainingData();

    postMessage({
        type: workerEvents.trainingLog,
        message: `Dados carregados: ${products.length} produtos, ${users.length} usuários, ${orders.length} pedidos`,
    });

    const context = makeContext(products, users, orders, { ...stats, categories, brands, productAvgAge });

    return context;
}

/**
 * Codifica todos os produtos e salva seus embeddings no Neo4j via API
 */
async function saveProductEmbeddings(context) {
    postMessage({ type: workerEvents.trainingLog, message: 'Salvando embeddings dos produtos no Neo4j...' });
    try {
        const productVectors = context.products.map(product => ({
            id: product.id,
            name: product.name,
            vector: Array.from(encodeProduct(product, context).dataSync()),
        }));

        const response = await fetch('http://localhost:3001/api/products/save-vectors', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productVectors }),
        });

        const result = await response.json();
        if (result.success) {
            postMessage({ type: workerEvents.trainingLog, message: `${result.count} embeddings de produtos salvos no Neo4j.` });
        } else {
            postMessage({ type: workerEvents.trainingLog, message: 'Aviso: falha ao salvar embeddings no Neo4j.' });
        }
    } catch (error) {
        postMessage({ type: workerEvents.trainingLog, message: `Erro ao salvar embeddings no Neo4j: ${error.message}` });
    }
}

async function loadModelFromServer() {
    console.log('Carregando modelo salvo do servidor...');
    postMessage({ type: workerEvents.trainingLog, message: 'Carregando modelo salvo...' });
    _model = await tf.loadLayersModel('http://localhost:3001/model/model.json');
    postMessage({ type: workerEvents.trainingLog, message: 'Modelo carregado do arquivo.' });
}

async function saveModelToServer(model) {
    console.log('Salvando modelo treinado no servidor...');
    try {
        await model.save(tf.io.withSaveHandler(async (artifacts) => {
            const weightData = Array.from(new Uint8Array(artifacts.weightData));

            const response = await fetch('http://localhost:3001/api/model/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    modelTopology: artifacts.modelTopology,
                    weightSpecs: artifacts.weightSpecs,
                    weightData,
                }),
            });

            const result = await response.json();
            if (result.success) {
                postMessage({ type: workerEvents.trainingLog, message: 'Modelo salvo em arquivo (model.json + weights.bin).' });
            }

            return { modelArtifactsInfo: { dateSaved: new Date(), modelTopologyType: 'JSON' } };
        }));
    } catch (error) {
        console.error('Erro ao salvar modelo:', error);
        postMessage({ type: workerEvents.trainingLog, message: `Não foi possível salvar o modelo: ${error.message}` });
    }
}

async function loadModelOnStartup() {
    try {
        const { exists } = await fetch('http://localhost:3001/api/model/exists').then(r => r.json());

        if (exists) {
            postMessage({ type: workerEvents.progressUpdate, progress: { progress: 50 } });
            await loadModelFromServer();
            postMessage({ type: workerEvents.progressUpdate, progress: { progress: 100 } });
            postMessage({ type: workerEvents.trainingComplete });
        } else {
            postMessage({
                type: workerEvents.trainingLog,
                message: 'Nenhum modelo encontrado. Clique em Train para treinar.',
            });
        }
    } catch (error) {
        console.error('Erro ao verificar modelo:', error);
        postMessage({ type: workerEvents.trainingLog, message: `Erro ao verificar modelo: ${error.message}` });
    }
}

async function trainModel() {
    try {
        postMessage({ type: workerEvents.progressUpdate, progress: { progress: 10 } });

        _globalCtx = await buildContext();

        await saveProductEmbeddings(_globalCtx);

        postMessage({ type: workerEvents.progressUpdate, progress: { progress: 40 } });

        const splitData = await splitTrainingTestData(_globalCtx);
        postMessage({ type: workerEvents.progressUpdate, progress: { progress: 50 } });

        _model = await configureNeuralNetAndTrain(splitData);
        await saveModelToServer(_model);

        postMessage({ type: workerEvents.progressUpdate, progress: { progress: 100 } });
        postMessage({ type: workerEvents.trainingComplete });
    } catch (error) {
        console.error('Erro ao treinar modelo:', error);
        postMessage({ type: workerEvents.trainingLog, message: `Erro ao treinar modelo: ${error.message}` });
    }
}

async function recommend(user) {
    console.log('will recommend for user:', user);
    if (!_model) {
        postMessage({ type: workerEvents.recommend, error: 'MODEL_NOT_TRAINED' });
        return;
    }

    let ctx = _globalCtx.length ? _globalCtx : (await buildContext());

    // Buscar compras do usuário do MySQL (se for um user do banco)
    let userProducts = [];
    if (user.id && user.id !== 99) {
        try {
            userProducts = await fetchUserPurchases(user.id);
        } catch (e) {
            console.warn('Erro ao buscar compras, usando purchases locais:', e);
            userProducts = user.purchases || [];
        }
    } else {
        userProducts = user.purchases || [];
    }

    const userVector = encodeUser(userProducts, ctx).dataSync();

    // Tenta buscar os produtos mais similares no Neo4j para reduzir o conjunto de candidatos
    let candidateProducts = null;
    try {
        const response = await fetch('http://localhost:3001/api/products/similar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userVector: Array.from(userVector), limit: 10 }),
        });
        const data = await response.json();
        if (data.success && data.products.length > 0) {
            candidateProducts = data.products;
            postMessage({ type: workerEvents.trainingLog, message: `Neo4j: ${candidateProducts.length} produtos similares encontrados para recomendação.` });
        } else {
            postMessage({ type: workerEvents.trainingLog, message: 'Neo4j retornou lista vazia, usando fallback com todos os produtos.' });
        }
    } catch (error) {
        postMessage({ type: workerEvents.trainingLog, message: `Erro ao buscar similares no Neo4j (usando fallback): ${error.message}` });
    }

    const allProducts = candidateProducts ?? ctx.products;
    if (!allProducts?.length) {
        postMessage({ type: workerEvents.recommend, error: 'NO_PRODUCTS' });
        return;
    }

    const inputs = allProducts.map(product => {
        const prodVec = encodeProduct(product, ctx).dataSync();
        return [...userVector, ...prodVec];
    });
    const inputTensor = tf.tensor2d(inputs, [inputs.length, inputs[0].length]);

    const predictions = _model.predict(inputTensor);
    const scores = predictions.dataSync();
    inputTensor.dispose();
    predictions.dispose();

    const recommendations = allProducts.map((product, index) => ({
        ...product,
        score: scores[index],
    }));

    const sortedItems = recommendations.sort((a, b) => b.score - a.score);

    postMessage({
        type: workerEvents.recommend,
        user,
        recommendations: sortedItems,
    });
}

const handlers = {
    [workerEvents.trainModel]: () => trainModel(),
    [workerEvents.loadModel]: () => loadModelOnStartup(),
    [workerEvents.recommend]: (d) => recommend(d.user, _globalCtx),
};

self.onmessage = e => {
    const { action, ...data } = e.data;
    if (handlers[action]) handlers[action](data);
};
