const notionExporter = {
    apiKey: null,
    databaseId: null,

    async init() {
        this.apiKey = await bookmarkStore.getSetting('notionApiKey');
        this.databaseId = await bookmarkStore.getSetting('notionDatabaseId');
    },

    isConfigured() {
        return this.apiKey && this.databaseId;
    },

    async updateConfig(apiKey, databaseId) {
        await bookmarkStore.saveSetting('notionApiKey', apiKey);
        await bookmarkStore.saveSetting('notionDatabaseId', databaseId);
        this.apiKey = apiKey;
        this.databaseId = databaseId;
    },

    async testConnection() {
        if (!this.isConfigured()) {
            return { success: false, message: 'API Key o Database ID no configurados' };
        }

        try {
            const response = await fetch(`https://api.notion.com/v1/databases/${this.databaseId}`, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Notion-Version': '2022-06-28'
                }
            });

            if (response.ok) {
                const data = await response.json();
                return { success: true, message: `Conectado a: ${data.title?.[0]?.plain_text || 'Base de datos'}` };
            } else {
                const error = await response.json();
                return { success: false, message: error.message || 'Error de conexión' };
            }
        } catch (error) {
            return { success: false, message: 'Error de conexión: ' + error.message };
        }
    },

    async createPage(bookmark) {
        if (!this.isConfigured()) {
            throw new Error('Notion no está configurado');
        }

        const tags = bookmark.tags || [];
        const topics = bookmark.topics || [];
        
        const properties = {
            'Name': {
                'title': [
                    {
                        'text': {
                            'content': bookmark.title.substring(0, 2000)
                        }
                    }
                ]
            },
            'URL': {
                'url': bookmark.url
            },
            'Type': {
                'select': {
                    'name': bookmark.type || 'article'
                }
            },
            'Tags': {
                'multi_select': tags.map(tag => ({ name: tag }))
            },
            'Topics': {
                'multi_select': topics.map(topic => ({ name: topic }))
            },
            'Vanguard': {
                'checkbox': bookmark.isVanguard || false
            },
            'Created': {
                'date': {
                    'start': bookmark.createdAt
                }
            }
        };

        if (bookmark.notes) {
            properties['Notes'] = {
                'rich_text': [
                    {
                        'text': {
                            'content': bookmark.notes.substring(0, 2000)
                        }
                    }
                ]
            };
        }

        const response = await fetch('https://api.notion.com/v1/pages', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                parent: { database_id: this.databaseId },
                properties: properties
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Error al crear la página');
        }

        return await response.json();
    },

    async exportBookmark(bookmark) {
        try {
            const page = await this.createPage(bookmark);
            return { success: true, pageId: page.id };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    async exportAll(bookmarks) {
        const results = {
            success: 0,
            failed: 0,
            errors: []
        };

        for (const bookmark of bookmarks) {
            const result = await this.exportBookmark(bookmark);
            if (result.success) {
                results.success++;
            } else {
                results.failed++;
                results.errors.push({ url: bookmark.url, error: result.error });
            }
            
            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        return results;
    },

    async createDatabase() {
        if (!this.apiKey) {
            throw new Error('API Key de Notion no configurada');
        }

        // Note: Creating databases requires the parent page ID
        // This is just a template for the database structure
        const databaseSchema = {
            name: 'Bookmark Manager',
            properties: {
                'Name': { 'title': {} },
                'URL': { 'url': {} },
                'Type': { 
                    'select': { 
                        'options': [
                            { 'name': 'article', 'color': 'blue' },
                            { 'name': 'video', 'color': 'red' },
                            { 'name': 'pdf', 'color': 'yellow' },
                            { 'name': 'blog', 'color': 'green' },
                            { 'name': 'tutorial', 'color': 'purple' }
                        ]
                    } 
                },
                'Tags': { 'multi_select': {} },
                'Topics': { 'multi_select': {} },
                'Vanguard': { 'checkbox': {} },
                'Notes': { 'rich_text': {} },
                'Created': { 'date': {} }
            }
        };

        return databaseSchema;
    }
};
