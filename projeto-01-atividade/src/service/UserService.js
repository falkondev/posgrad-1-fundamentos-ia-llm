export class UserService {
    #storageKey = 'ew-academy-users';

    async searchUsers(query, limit = 20) {
        const params = new URLSearchParams({ q: query, limit: String(limit) });
        const response = await fetch(`http://localhost:3001/api/users/search?${params}`);
        const data = await response.json();
        return data.success ? data.users : [];
    }

    async getDefaultUsers() {
        return [];
    }

    async getUsers() {
        return this.#getStorage();
    }

    async getUserById(userId) {
        const users = this.#getStorage();
        const local = users.find(user => String(user.id) === String(userId));
        if (local) return local;

        // Fallback: fetch from API
        try {
            const response = await fetch(`http://localhost:3001/api/user-purchases/${userId}`);
            const data = await response.json();
            if (!data.success) return null;

            const userRes = await fetch(`http://localhost:3001/api/users/search?q=&limit=1`);
            // We don't have a /api/users/:id endpoint, so return a minimal object
            return { id: Number(userId), purchases: data.purchases };
        } catch {
            return null;
        }
    }

    async getUserWithPurchases(userId) {
        const [userRes, purchasesRes] = await Promise.all([
            fetch(`http://localhost:3001/api/users/search?q=&limit=100`),
            fetch(`http://localhost:3001/api/user-purchases/${userId}`),
        ]);
        const userData = await userRes.json();
        const purchasesData = await purchasesRes.json();

        const user = userData.success
            ? userData.users.find(u => String(u.id) === String(userId))
            : null;

        return {
            ...(user ?? { id: Number(userId) }),
            purchases: purchasesData.success ? purchasesData.purchases : [],
        };
    }

    async savePurchase(userId, productId) {
        await fetch('http://localhost:3001/api/user-purchases', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, productId }),
        });
    }

    async removePurchase(userId, productId) {
        await fetch(`http://localhost:3001/api/user-purchases/${userId}/${productId}`, {
            method: 'DELETE',
        });
    }

    async updateUser(user) {
        const users = this.#getStorage();
        const userIndex = users.findIndex(u => String(u.id) === String(user.id));
        if (userIndex !== -1) {
            users[userIndex] = { ...users[userIndex], ...user };
        } else {
            users.push(user);
        }
        this.#setStorage(users);
        return users[userIndex] ?? user;
    }

    async addUser(user) {
        const users = this.#getStorage();
        const exists = users.find(u => String(u.id) === String(user.id));
        if (!exists) {
            this.#setStorage([user, ...users]);
        }
    }

    #getStorage() {
        const data = sessionStorage.getItem(this.#storageKey);
        return data ? JSON.parse(data) : [];
    }

    #setStorage(data) {
        sessionStorage.setItem(this.#storageKey, JSON.stringify(data));
    }
}
