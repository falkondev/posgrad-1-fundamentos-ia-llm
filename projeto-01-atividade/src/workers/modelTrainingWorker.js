import 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js';
import { workerEvents } from '../events/constants.js';

console.log('Model training worker initialized');
let _globalCtx = {};
let _model = null;

const WEIGHTS = {
    category: 0.4,
    color: 0.3,
    price: 0.2,
    age: 0.1,
};

// Normalização range 0-1
const normalize = (value, min, max) => (value - min) / (max - min) || 1;

function makeContext(products, users) {
    const ages = users.map(u => u.age);
    const prices = products.map(p => p.price);

    const minAge = Math.min(...ages);
    const maxAge = Math.max(...ages);

    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    const colors = [...new Set(products.map(p => p.color))];
    const categories = [...new Set(products.map(p => p.category))];

    const colorsIndex = Object.fromEntries(
        colors.map((color, index) => {
            return [color, index];
        })
    )

    const categoriesIndex = Object.fromEntries(
        categories.map((category, index) => {
            return [category, index];
        })
    )

    // computar a média de idade dos compradores por produto
    const midAge = (minAge + maxAge) / 2;
    const ageSums = {};
    const ageCounts = {};

    users.forEach(user => {
        user.purchases.forEach(p => {
            ageSums[p.name] = (ageSums[p.name] || 0) + user.age;
            ageCounts[p.name] = (ageCounts[p.name] || 0) + 1;
        })
    });

    const productAvgAgeNorm = Object.fromEntries(
        products.map(product => {
            const avg = ageCounts[product.name] ?
                ageSums[product.name] / ageCounts[product.name] :
                midAge;

            return [product.name, normalize(avg, minAge, maxAge)];
        })
    )

    return {
        products,
        users,
        colorsIndex,
        categoriesIndex,
        minAge,
        maxAge,
        minPrice,
        maxPrice,
        numCategories: categories.length,
        numColors: colors.length,
        productAvgAgeNorm,

        // Price + age + colors + categories
        dimentions: 2 + categories.length + colors.length,
    }
}

const oneHotWeighted = (index, length, weight) =>
    tf.oneHot(index, length).cast('float32').mul(weight);

function encodeProduct(product, context) {
    const price = tf.tensor1d([
        normalize(product.price, context.minPrice, context.maxPrice) * WEIGHTS.price,
    ]);

    const age = tf.tensor1d([
        (context.productAvgAgeNorm[product.name] ?? 0.5) * WEIGHTS.age,
    ]);

    const category = oneHotWeighted(
        context.categoriesIndex[product.category],
        context.numCategories,
        WEIGHTS.category
    );

    const color = oneHotWeighted(
        context.colorsIndex[product.color],
        context.numColors,
        WEIGHTS.color
    );

    return tf.concat1d([price, age, category, color]);
}

function encodeUser(user, context) {
    if (user.purchases.length) {
        return tf.stack(
            user.purchases.map(p => encodeProduct(p, context))
        )
            .mean(0)
            .reshape([1, context.dimentions]);
    }

    return tf.concat1d([
        tf.zeros([1]), // preço ignorado
        tf.tensor1d([
            normalize(user.age, context.minAge, context.maxAge) * WEIGHTS.age,
        ]),
        tf.zeros([context.numCategories]), // categoria ignorada
        tf.zeros([context.numColors]), // cor ignorada
    ]).reshape([1, context.dimentions]);
}

function createTrainingData(context) {
    const inputs = [];
    const labels = [];

    context.users
        .filter(u => u.purchases.length)
        .forEach(user => {
            const userVector = encodeUser(user, context).dataSync();
            context.products.forEach(product => {
                const productVector = encodeProduct(product, context).dataSync();

                const label = user.purchases.some(
                    purchase => purchase.name === product.name ? 1 : 0
                );

                // combinar usuário + product
                inputs.push([...userVector, ...productVector]);
                labels.push(label);
            })
        })

    return {
        xs: tf.tensor2d(inputs),
        ys: tf.tensor2d(labels, [labels.length, 1]),
        inputDimention: context.dimentions * 2,
    }
}

async function configureNeuralNetAndTrain(trainData) {
    const model = tf.sequential();

    model.add(tf.layers.dense({
        inputShape: [trainData.inputDimention],
        units: 128,
        activation: 'relu',
    }));

    model.add(tf.layers.dense({
        units: 64,
        activation: 'relu',
    }));

    model.add(tf.layers.dense({
        units: 32,
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

    await model.fit(trainData.xs, trainData.ys, {
        epochs: 100,
        batchSize: 32,
        shuffle: true,
        callbacks: {
            onEpochEnd: (epoch, logs) => {
                postMessage({
                    type: workerEvents.trainingLog,
                    epoch: epoch,
                    loss: logs.loss,
                    accuracy: logs.acc
                });
            }
        }
    });

    return model;
}

/**
 * Salva os vetores de produtos no Neo4j via API backend
 * Limpa dados antigos a cada execução (truncate + insert)
 */
async function saveProductVectorsToNeo4j(productVectors) {
    try {
        const apiUrl = 'http://localhost:3001/api/products/save-vectors';

        // Converter Float32Array para Array para serialização JSON
        const serializedVectors = productVectors.map(pv => ({
            name: pv.name,
            meta: pv.meta,
            vector: Array.from(pv.vector),
        }));

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productVectors: serializedVectors }),
        });

        const result = await response.json();
        if (result.success) {
            console.log(`✓ ${result.count} vetores de produtos salvos no Neo4j`);
            postMessage({
                type: workerEvents.trainingLog,
                message: `✓ Vetores salvos no Neo4j: ${result.count} produtos`,
            });
        } else {
            console.error('Erro ao salvar vetores:', result.error);
        }
    } catch (error) {
        console.error('Erro na comunicação com API de Neo4j:', error);
        postMessage({
            type: workerEvents.trainingLog,
            message: `⚠️ Aviso: Não foi possível salvar vetores no Neo4j (${error.message})`,
        });
    }
}

async function trainModel({ users }) {
    console.log('Training model with users:', users)

    postMessage({ type: workerEvents.progressUpdate, progress: { progress: 50 } });

    const products = await (await fetch('/data/products.json')).json();
    const context = makeContext(products, users);

    context.productVectors = products.map(product => {
        return {
            name: product.name,
            meta: { ...product },
            vector: encodeProduct(product, context).dataSync(),
        }
    });

    _globalCtx = context;

    // Salvar vetores no Neo4j
    await saveProductVectorsToNeo4j(context.productVectors);

    const trainData = createTrainingData(context);
    _model = await configureNeuralNetAndTrain(trainData);

    postMessage({ type: workerEvents.progressUpdate, progress: { progress: 100 } });
    postMessage({ type: workerEvents.trainingComplete });
}
async function recommend(user, ctx) {
    console.log('will recommend for user:', user)
    if (!_model) return;

    const context = _globalCtx;
    const userVector = encodeUser(user, _globalCtx).dataSync();

    // Buscar os 5 produtos mais similares no Neo4j
    let nearestProducts = [];
    try {
        const response = await fetch('http://localhost:3001/api/products/similar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userVector: Array.from(userVector),
                limit: 5,
            }),
        });

        const result = await response.json();
        if (result.success) {
            nearestProducts = result.products;
            console.log(`📍 ${nearestProducts.length} produtos similares encontrados no Neo4j`);
        }
    } catch (error) {
        console.warn('Erro ao buscar similares no Neo4j, usando todos os produtos:', error);
        nearestProducts = context.productVectors.map((item) => ({
            name: item.name,
            ...item.meta,
            vector: item.vector,
            similarity: 1,
        }));
    }

    // Preparar inputs apenas com os produtos similares
    const inputs = nearestProducts.map(product => {
        return [...userVector, ...product.vector];
    });
    const inputTensor = tf.tensor2d(inputs);

    // Fazer a predição
    const predictions = _model.predict(inputTensor);
    const scores = predictions.dataSync();

    // Mapear resultados
    const recommendations = nearestProducts.map((product, index) => {
        return {
            ...product,
            score: scores[index], // previsão do modelo para o produto
        }
    });

    const sortedItems = recommendations.sort((a, b) => b.score - a.score);

    postMessage({
        type: workerEvents.recommend,
        user,
        recommendations: sortedItems
    });
}


const handlers = {
    [workerEvents.trainModel]: trainModel,
    [workerEvents.recommend]: (d) => recommend(d.user, _globalCtx),
};

self.onmessage = e => {
    const { action, ...data } = e.data;
    if (handlers[action]) handlers[action](data);
};
