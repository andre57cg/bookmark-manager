const DB_NAME = 'BookmarkManager';
const DB_VERSION = 1;

class BookmarkStore {
    constructor() {
        this.db = null;
        this.ready = this.init();
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                if (!db.objectStoreNames.contains('bookmarks')) {
                    const bookmarksStore = db.createObjectStore('bookmarks', { keyPath: 'id' });
                    bookmarksStore.createIndex('url', 'url', { unique: true });
                    bookmarksStore.createIndex('type', 'type', { unique: false });
                    bookmarksStore.createIndex('createdAt', 'createdAt', { unique: false });
                }

                if (!db.objectStoreNames.contains('tags')) {
                    db.createObjectStore('tags', { keyPath: 'id' });
                }

                if (!db.objectStoreNames.contains('topics')) {
                    const topicsStore = db.createObjectStore('topics', { keyPath: 'id' });
                    topicsStore.createIndex('parent', 'parent', { unique: false });
                }

                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }

                if (!db.objectStoreNames.contains('rules')) {
                    db.createObjectStore('rules', { keyPath: 'id' });
                }
            };
        });
    }

    async ensureReady() {
        await this.ready;
    }

    generateId() {
        return 'bm_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Bookmarks
    async getAllBookmarks() {
        await this.ensureReady();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['bookmarks'], 'readonly');
            const store = transaction.objectStore('bookmarks');
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    async getBookmark(id) {
        await this.ensureReady();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['bookmarks'], 'readonly');
            const store = transaction.objectStore('bookmarks');
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async saveBookmark(bookmark) {
        await this.ensureReady();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['bookmarks'], 'readwrite');
            const store = transaction.objectStore('bookmarks');
            const request = store.put(bookmark);
            request.onsuccess = () => resolve(bookmark);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteBookmark(id) {
        await this.ensureReady();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['bookmarks'], 'readwrite');
            const store = transaction.objectStore('bookmarks');
            const request = store.delete(id);
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    async bulkSaveBookmarks(bookmarks) {
        await this.ensureReady();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['bookmarks'], 'readwrite');
            const store = transaction.objectStore('bookmarks');
            
            bookmarks.forEach(bookmark => store.put(bookmark));
            
            transaction.oncomplete = () => resolve(bookmarks.length);
            transaction.onerror = () => reject(transaction.error);
        });
    }

    // Tags
    async getAllTags() {
        await this.ensureReady();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['tags'], 'readonly');
            const store = transaction.objectStore('tags');
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    async saveTag(tag) {
        await this.ensureReady();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['tags'], 'readwrite');
            const store = transaction.objectStore('tags');
            const request = store.put(tag);
            request.onsuccess = () => resolve(tag);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteTag(id) {
        await this.ensureReady();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['tags'], 'readwrite');
            const store = transaction.objectStore('tags');
            const request = store.delete(id);
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    // Topics
    async getAllTopics() {
        await this.ensureReady();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['topics'], 'readonly');
            const store = transaction.objectStore('topics');
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    async saveTopic(topic) {
        await this.ensureReady();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['topics'], 'readwrite');
            const store = transaction.objectStore('topics');
            const request = store.put(topic);
            request.onsuccess = () => resolve(topic);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteTopic(id) {
        await this.ensureReady();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['topics'], 'readwrite');
            const store = transaction.objectStore('topics');
            const request = store.delete(id);
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    // Settings
    async getSetting(key) {
        await this.ensureReady();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['settings'], 'readonly');
            const store = transaction.objectStore('settings');
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result?.value);
            request.onerror = () => reject(request.error);
        });
    }

    async saveSetting(key, value) {
        await this.ensureReady();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['settings'], 'readwrite');
            const store = transaction.objectStore('settings');
            const request = store.put({ key, value });
            request.onsuccess = () => resolve(value);
            request.onerror = () => reject(request.error);
        });
    }

    // Rules
    async getAllRules() {
        await this.ensureReady();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['rules'], 'readonly');
            const store = transaction.objectStore('rules');
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    async saveRule(rule) {
        await this.ensureReady();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['rules'], 'readwrite');
            const store = transaction.objectStore('rules');
            const request = store.put(rule);
            request.onsuccess = () => resolve(rule);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteRule(id) {
        await this.ensureReady();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['rules'], 'readwrite');
            const store = transaction.objectStore('rules');
            const request = store.delete(id);
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    // Export all data
    async exportAll() {
        await this.ensureReady();
        const bookmarks = await this.getAllBookmarks();
        const tags = await this.getAllTags();
        const topics = await this.getAllTopics();
        const rules = await this.getAllRules();
        
        const settings = {};
        const settingsKeys = ['notionApiKey', 'notionDatabaseId', 'obsidianPath'];
        for (const key of settingsKeys) {
            settings[key] = await this.getSetting(key);
        }

        return {
            version: DB_VERSION,
            exportedAt: new Date().toISOString(),
            bookmarks,
            tags,
            topics,
            rules,
            settings
        };
    }

    // Import all data
    async importAll(data) {
        await this.ensureReady();

        if (data.bookmarks?.length) {
            await this.bulkSaveBookmarks(data.bookmarks);
        }
        if (data.tags?.length) {
            for (const tag of data.tags) {
                await this.saveTag(tag);
            }
        }
        if (data.topics?.length) {
            for (const topic of data.topics) {
                await this.saveTopic(topic);
            }
        }
        if (data.rules?.length) {
            for (const rule of data.rules) {
                await this.saveRule(rule);
            }
        }
        if (data.settings) {
            for (const [key, value] of Object.entries(data.settings)) {
                if (value) await this.saveSetting(key, value);
            }
        }
    }

    // Clear all data
    async clearAll() {
        await this.ensureReady();
        
        const stores = ['bookmarks', 'tags', 'topics', 'rules', 'settings'];
        for (const storeName of stores) {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            store.clear();
        }
    }
}

const bookmarkStore = new BookmarkStore();
