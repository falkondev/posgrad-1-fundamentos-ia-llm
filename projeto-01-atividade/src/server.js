import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Neo4jService } from './services/neo4jService.js';
import { MysqlService } from './services/mysqlService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODEL_DIR = path.join(__dirname, '..', 'model');

const PORT = process.env.API_PORT || 3001;

const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Health check
    if (req.url === '/health' && req.method === 'GET') {
        try {
            await Neo4jService.healthCheck();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok', neo4j: 'connected' }));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'error', message: error.message }));
        }
        return;
    }

    // Save product vectors
    if (req.url === '/api/products/save-vectors' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { productVectors } = JSON.parse(body);
                const result = await Neo4jService.saveProductVectors(productVectors);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            } catch (error) {
                console.error('Error saving vectors:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
        return;
    }

    // Check if saved model exists
    if (req.url === '/api/model/exists' && req.method === 'GET') {
        const exists = fs.existsSync(path.join(MODEL_DIR, 'model.json'));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ exists }));
        return;
    }

    // Save model files (topology, weights, context)
    if (req.url === '/api/model/save' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { modelTopology, weightSpecs, weightData } = JSON.parse(body);

                fs.mkdirSync(MODEL_DIR, { recursive: true });

                // Save model.json in standard TF.js format
                const modelJson = {
                    modelTopology,
                    weightsManifest: [{ paths: ['weights.bin'], weights: weightSpecs }],
                };
                fs.writeFileSync(path.join(MODEL_DIR, 'model.json'), JSON.stringify(modelJson));

                // Save weights.bin as binary
                const weightsBuf = Buffer.from(weightData);
                fs.writeFileSync(path.join(MODEL_DIR, 'weights.bin'), weightsBuf);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (error) {
                console.error('Error saving model:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
        return;
    }

    // Serve model static files (model.json, weights.bin, context.json)
    if (req.url.startsWith('/model/') && req.method === 'GET') {
        const filename = req.url.slice('/model/'.length);
        const filePath = path.join(MODEL_DIR, filename);
        if (!filePath.startsWith(MODEL_DIR) || !fs.existsSync(filePath)) {
            res.writeHead(404);
            res.end();
            return;
        }
        const contentType = filename.endsWith('.json') ? 'application/json' : 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        fs.createReadStream(filePath).pipe(res);
        return;
    }

    // MySQL: training data (products + orders + users + categories + brands)
    if (req.url === '/api/training-data' && req.method === 'GET') {
        try {
            const products = await MysqlService.query(`
                SELECT p.id, p.name, p.price, c.name AS category, b.name AS brand
                FROM products p
                JOIN categories c ON p.category_id = c.id
                JOIN brands b ON p.brand_id = b.id
                LIMIT 1000
            `);

            const productIds = products.map(p => p.id);
            if (!productIds.length) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, products: [], orders: [], users: [], stats: {}, categories: [], brands: [], productAvgAge: {} }));
                return;
            }

            const placeholders = productIds.map(() => '?').join(',');

            const [
                orders,
                users,
                ageStats,
                priceStats,
                categoryRows,
                brandRows,
                productAvgAgeRows,
            ] = await Promise.all([
                MysqlService.query(`
                    SELECT o.user_id, o.product_id
                    FROM orders o
                    WHERE o.product_id IN (${placeholders})
                    LIMIT 1000
                `, productIds),
                MysqlService.query(`
                    SELECT DISTINCT u.id, u.name, u.age
                    FROM users u
                    INNER JOIN orders o ON u.id = o.user_id
                    WHERE o.product_id IN (${placeholders})
                    LIMIT 1000
                `, productIds),
                MysqlService.query(`SELECT MIN(age) AS minAge, MAX(age) AS maxAge FROM users`),
                MysqlService.query(`SELECT MIN(price) AS minPrice, MAX(price) AS maxPrice FROM products`),
                MysqlService.query(`SELECT DISTINCT name FROM categories`),
                MysqlService.query(`SELECT DISTINCT name FROM brands`),
                MysqlService.query(`
                    SELECT o.product_id, AVG(u.age) AS avg_age
                    FROM orders o
                    JOIN users u ON o.user_id = u.id
                    WHERE o.product_id IN (${placeholders})
                    GROUP BY o.product_id
                `, productIds),
            ]);

            const stats = {
                minAge:   parseFloat(ageStats[0].minAge),
                maxAge:   parseFloat(ageStats[0].maxAge),
                minPrice: parseFloat(priceStats[0].minPrice),
                maxPrice: parseFloat(priceStats[0].maxPrice),
            };

            const productAvgAge = Object.fromEntries(
                productAvgAgeRows.map(r => [String(r.product_id), parseFloat(r.avg_age)])
            );

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                products,
                orders,
                users,
                stats,
                categories: categoryRows.map(c => c.name),
                brands:     brandRows.map(b => b.name),
                productAvgAge,
            }));
        } catch (error) {
            console.error('Error fetching training data:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: error.message }));
        }
        return;
    }

    // MySQL: save a new purchase (order)
    if (req.url === '/api/user-purchases' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { userId, productId } = JSON.parse(body);
                if (!userId || !productId) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'userId and productId are required' }));
                    return;
                }
                await MysqlService.query(
                    `INSERT INTO orders (user_id, product_id) VALUES (?, ?)`,
                    [userId, productId]
                );
                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (error) {
                console.error('Error saving purchase:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
        return;
    }

    // MySQL: remove a purchase (order)
    if (req.url.startsWith('/api/user-purchases/') && req.method === 'DELETE') {
        try {
            const parts = req.url.split('/api/user-purchases/')[1].split('/');
            const userId = parts[0];
            const productId = parts[1];
            if (!userId || !productId) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'userId and productId are required' }));
                return;
            }

            console.log(productId, userId);
            await MysqlService.query(
                `DELETE FROM orders WHERE user_id = ? AND product_id = ? LIMIT 1`,
                [userId, productId]
            );
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
        } catch (error) {
            console.error('Error removing purchase:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: error.message }));
        }
        return;
    }

    // MySQL: user purchases for recommendation context
    if (req.url.startsWith('/api/user-purchases/') && req.method === 'GET') {
        try {
            const userId = req.url.split('/api/user-purchases/')[1];
            const purchases = await MysqlService.query(`
                SELECT p.id, p.name, p.price, c.name AS category, b.name AS brand
                FROM orders o
                JOIN products p ON o.product_id = p.id
                JOIN categories c ON p.category_id = c.id
                JOIN brands b ON p.brand_id = b.id
                WHERE o.user_id = ?
            `, [userId]);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, purchases }));
        } catch (error) {
            console.error('Error fetching user purchases:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: error.message }));
        }
        return;
    }

    // MySQL: search products by name
    if (req.url.startsWith('/api/products/search') && req.method === 'GET') {
        try {
            const urlObj = new URL(req.url, `http://${req.headers.host}`);
            const q = urlObj.searchParams.get('q') || '';
            const limit = parseInt(urlObj.searchParams.get('limit') || '20');
            const category = urlObj.searchParams.get('category') || null;
            const brand = urlObj.searchParams.get('brand') || null;

            const safeLimit = Math.max(1, Math.min(1000, limit));

            let whereClauses = ['p.name LIKE ?'];
            let params = [`%${q}%`];

            if (category) {
                whereClauses.push('p.category_id = ?');
                params.push(category);
            }
            if (brand) {
                whereClauses.push('p.brand_id = ?');
                params.push(brand);
            }

            const products = await MysqlService.query(`
                SELECT p.id, p.name, p.price, c.name AS category, b.name AS brand,
                       p.category_id, p.brand_id
                FROM products p
                JOIN categories c ON p.category_id = c.id
                JOIN brands b ON p.brand_id = b.id
                WHERE ${whereClauses.join(' AND ')}
                LIMIT ${safeLimit}
            `, params);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, products }));
        } catch (error) {
            console.error('Error searching products:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: error.message }));
        }
        return;
    }

    // MySQL: list users
    if (req.url === '/api/users' && req.method === 'GET') {
        try {
            const users = await MysqlService.query(`SELECT id, name, age FROM users LIMIT 100`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, users }));
        } catch (error) {
            console.error('Error fetching users:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: error.message }));
        }
        return;
    }

    // MySQL: search users by name
    if (req.url.startsWith('/api/users/search') && req.method === 'GET') {
        try {
            const urlObj = new URL(req.url, `http://${req.headers.host}`);
            const q = urlObj.searchParams.get('q') || '';
            const limit = Math.min(50, parseInt(urlObj.searchParams.get('limit') || '20'));

            const users = await MysqlService.query(
                `SELECT id, name, age FROM users WHERE name LIKE ? LIMIT ${limit}`,
                [`%${q}%`]
            );
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, users }));
        } catch (error) {
            console.error('Error searching users:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: error.message }));
        }
        return;
    }

    // MySQL: list categories
    if (req.url === '/api/categories' && req.method === 'GET') {
        try {
            const categories = await MysqlService.query(`SELECT MIN(id) as id, name FROM categories GROUP BY name ORDER BY name`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, categories }));
        } catch (error) {
            console.error('Error fetching categories:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: error.message }));
        }
        return;
    }

    // MySQL: list brands
    if (req.url === '/api/brands' && req.method === 'GET') {
        try {
            const brands = await MysqlService.query(`SELECT MIN(id) as id, name FROM brands GROUP BY name ORDER BY name`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, brands }));
        } catch (error) {
            console.error('Error fetching brands:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: error.message }));
        }
        return;
    }

    // Neo4j: find similar products for a given user vector
    if (req.url === '/api/products/similar' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { userVector, limit = 10 } = JSON.parse(body);
                const similar = await Neo4jService.findSimilarProducts(userVector, limit);

                const ids = similar.map(s => s.id).filter(Boolean);
                if (!ids.length) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, products: [] }));
                    return;
                }

                const placeholders = ids.map(() => '?').join(',');
                const products = await MysqlService.query(`
                    SELECT p.id, p.name, p.price, c.name AS category, b.name AS brand
                    FROM products p
                    JOIN categories c ON p.category_id = c.id
                    JOIN brands b ON p.brand_id = b.id
                    WHERE p.id IN (${placeholders})
                `, ids);

                const scoreMap = Object.fromEntries(
                    similar.map(s => [String(s.id), s.similarity])
                );
                const sorted = products.sort(
                    (a, b) => (scoreMap[String(b.id)] ?? 0) - (scoreMap[String(a.id)] ?? 0)
                );

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, products: sorted }));
            } catch (error) {
                console.error('Error finding similar products:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
        return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
    console.log(`🚀 API Server running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down...');
    await Neo4jService.close();
    await MysqlService.close();
    process.exit(0);
});
