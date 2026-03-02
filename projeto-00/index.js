import tf, { input, log } from '@tensorflow/tfjs-node';

async function trainModel(inputXs, outputYs) {
    const model = tf.sequential();

    // primeira camada da rede
    model.add(tf.layers.dense({
        inputShape: [7],
        activation: 'relu',
        units: 80
    }));

    // saida: 3 neuronios
    model.add(tf.layers.dense({
        activation: 'softmax',
        units: 3
    }));

    model.compile({
        optimizer: 'adam',
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy']
    });

    // treinando o modelo

    await model.fit(
        inputXs,
        outputYs,
        {
            verbose: 0,
            epochs: 100,
            shuffle: true,
            callbacks: {
                onEpochEnd: async (epoch, logs) => console.log(
                    `Epoch ${epoch + 1}: loss = ${logs.loss}`
                )
            }
        }
    );

    return model;
}

async function predict(model, pessoa) {
    // transformar o array js para o tensor
    const tfInput = tf.tensor2d(pessoa);

    const pred = model.predict(tfInput);
    const predArray = await pred.array();

    return predArray[0].map((prob, index) => ({ prob, index }));
}

/**
 * const pessoas = [
 *  { nome: 'Erick', cor: 'azul', idade: 30, localizacao: 'São Paulo' },
 *  { nome: 'Ana', cor: 'vermelho', idade: 25, localizacao: 'Rio' },
 *  { nome: 'Carlos', cor: 'verde', idade: 40, localizacao: 'Curitiba' }
 * ]
 */
const tensorPessoasNormalizado = [
    [0.33, 1, 0, 0, 1, 0, 0], // Erick
    [0, 0, 1, 0, 0, 1, 0], //Ana
    [1, 0, 0, 1, 0, 0, 1] // Carlos
];

const labelsNomes = ['premium', 'medium', 'basic'];
const tensorLabels = [
    [1, 0, 0], // premium - Erick
    [0, 1, 0], // medium - Ana
    [0, 0, 1] // basic - Carlos
];

const inputXs = tf.tensor2d(tensorPessoasNormalizado);
const outputYs = tf.tensor2d(tensorLabels);

const model = await trainModel(inputXs, outputYs);

const pessoa = {
    nome: "zé",
    cor: 'azul',
    idade: 28,
    localizacao: 'Sao Paulo'
}

// normalizando os dados de entrada
const pessoaTensorNormalizado = [
    [
        0.2, // idade normalizada
        1, // cor azul,
        0, // cor vermelho,
        0, // cor verde,
        1, // localizacao São Paulo,
        0, // localizacao Rio,
        0 // localizacao Curitiba
    ]
];

const predictions = await predict(model, pessoaTensorNormalizado);
const results = predictions
    .sort((a, b) => b.prob - a.prob)
    .map(p => `${labelsNomes[p.index]} (${(p.prob * 100).toFixed(2)}%)`)
    .join('\n');
    
console.log(results)