export class ProductService {
    async searchProducts(query = '', limit = 20, category = null, brand = null) {
        const params = new URLSearchParams({ q: query, limit: String(limit) });
        if (category) params.set('category', category);
        if (brand) params.set('brand', brand);
        const response = await fetch(`http://localhost:3001/api/products/search?${params}`);
        const data = await response.json();
        return data.success ? data.products : [];
    }

    async getProducts() {
        return this.searchProducts('', 20);
    }

    async getProductById(id) {
        const products = await this.searchProducts('', 1000);
        return products.find(product => String(product.id) === String(id));
    }

    async getProductsByIds(ids) {
        const products = await this.searchProducts('', 1000);
        return products.filter(product => ids.includes(product.id));
    }

    async getCategories() {
        const response = await fetch('http://localhost:3001/api/categories');
        const data = await response.json();
        return data.success ? data.categories : [];
    }

    async getBrands() {
        const response = await fetch('http://localhost:3001/api/brands');
        const data = await response.json();
        return data.success ? data.brands : [];
    }
}
