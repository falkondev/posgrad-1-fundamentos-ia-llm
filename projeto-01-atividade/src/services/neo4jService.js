import neo4j from 'neo4j-driver';

const driver = neo4j.driver(
    process.env.NEO4J_URI || 'bolt://neo4j:7687',
    neo4j.auth.basic(
        process.env.NEO4J_USERNAME || 'neo4j',
        process.env.NEO4J_PASSWORD || 'password'
    ),
    { disableLosslessIntegers: true }
);

export class Neo4jService {
    /**
     * Salva os vetores de produtos no Neo4j
     * Remove todos os produtos antigos e insere novos
     */
    static async saveProductVectors(productVectors) {
        const session = driver.session();
        try {
            // Limpar dados antigos
            await session.run('MATCH (p:Product) DETACH DELETE p');

            // Inserir novos produtos com seus vetores
            for (const product of productVectors) {
                const query = `
                    CREATE (p:Product {
                        name: $name,
                        category: $category,
                        color: $color,
                        price: $price,
                        vector: $vector
                    })
                    RETURN p
                `;

                await session.run(query, {
                    name: product.meta.name,
                    category: product.meta.category,
                    color: product.meta.color,
                    price: product.meta.price,
                    vector: Array.from(product.vector),
                });
            }

            console.log(`✓ ${productVectors.length} produtos salvos no Neo4j`);
            return { success: true, count: productVectors.length };
        } catch (error) {
            console.error('Erro ao salvar vetores no Neo4j:', error);
            throw error;
        } finally {
            await session.close();
        }
    }

    /**
     * Recupera todos os produtos com seus vetores
     */
    static async getProductVectors() {
        const session = driver.session();
        try {
            const result = await session.run('MATCH (p:Product) RETURN p');
            return result.records.map(record => ({
                name: record.get('p').properties.name,
                vector: record.get('p').properties.vector,
                category: record.get('p').properties.category,
                color: record.get('p').properties.color,
                price: record.get('p').properties.price,
            }));
        } catch (error) {
            console.error('Erro ao recuperar vetores do Neo4j:', error);
            throw error;
        } finally {
            await session.close();
        }
    }

    /**
     * Busca os N produtos mais similares a um vetor de entrada (similaridade de cosseno)
     * Cosine similarity = (A . B) / (||A|| * ||B||) — calculado diretamente em Cypher
     */
    static async findSimilarProducts(userVector, limit = 5) {
        const session = driver.session();
        try {
            const vector = userVector.map(v => Number(v));
            const limitInt = neo4j.int(Math.trunc(limit));

            const query = `
                MATCH (p:Product)
                WITH p, vector.similarity.cosine(p.vector, $vector) AS similarity
                RETURN p.name AS name, p.category AS category, p.color AS color,
                       p.price AS price, p.vector AS vector, similarity
                ORDER BY similarity DESC
                LIMIT $limit
            `;

            const result = await session.run(query, { vector, limit: limitInt });

            return result.records.map(record => ({
                name: record.get('name'),
                category: record.get('category'),
                color: record.get('color'),
                price: record.get('price'),
                vector: record.get('vector'),
                similarity: record.get('similarity'),
            }));
        } catch (error) {
            console.error('Erro ao buscar produtos similares no Neo4j:', error);
            throw error;
        } finally {
            await session.close();
        }
    }

    /**
     * Verifica a conexão com o Neo4j
     */
    static async healthCheck() {
        const session = driver.session();
        try {
            await session.run('RETURN 1');
            return { status: 'ok' };
        } catch (error) {
            console.error('Erro na health check do Neo4j:', error);
            throw error;
        } finally {
            await session.close();
        }
    }

    /**
     * Fecha a conexão com o driver
     */
    static async close() {
        await driver.close();
    }
}

export default Neo4jService;
