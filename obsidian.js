const obsidianExporter = {
    vaultPath: null,

    async init() {
        this.vaultPath = await bookmarkStore.getSetting('obsidianPath');
    },

    isConfigured() {
        return this.vaultPath !== null && this.vaultPath.trim() !== '';
    },

    async updateConfig(vaultPath) {
        await bookmarkStore.saveSetting('obsidianPath', vaultPath);
        this.vaultPath = vaultPath;
    },

    generateMarkdown(bookmark) {
        const escapeYaml = (str) => str.replace(/[|]/g, '\\$&').replace(/\n/g, '\\n');
        
        // Build frontmatter
        let frontmatter = `---
creation date: ${bookmark.createdAt}
modification date: ${bookmark.updatedAt}
source: ${bookmark.url}
type: ${bookmark.type || 'article'}
tags: [${(bookmark.tags || []).map(t => `"${t}"`).join(', ')}]
topics: [${(bookmark.topics || []).map(t => `"${t}"`).join(', ')}]
vanguard: ${bookmark.isVanguard || false}
---`;

        // Build content
        let content = `# ${bookmark.title}\n\n`;
        
        if (bookmark.description) {
            content += `${bookmark.description}\n\n`;
        }
        
        content += `## Información\n`;
        content += `| Campo | Valor |\n`;
        content += `|-------|-------|\n`;
        content += `| URL | [${bookmark.url}](${bookmark.url}) |\n`;
        content += `| Tipo | ${bookmark.type || 'article'} |\n`;
        content += `| Fecha | ${new Date(bookmark.createdAt).toLocaleDateString()} |\n`;
        
        if (bookmark.topics && bookmark.topics.length > 0) {
            content += `\n## Temas\n`;
            content += `\`\`\`dataview\n`;
            content += `LIST FROM #${bookmark.topics[0].replace(/\s+/g, '-').toLowerCase()}\n`;
            content += `\`\`\`\n`;
        }
        
        if (bookmark.tags && bookmark.tags.length > 0) {
            content += `\n## Tags\n`;
            bookmark.tags.forEach(tag => {
                content += `#${tag.replace(/\s+/g, '-').toLowerCase()} `;
            });
            content += `\n`;
        }
        
        if (bookmark.notes) {
            content += `\n## Notas\n`;
            content += `${bookmark.notes}\n`;
        }
        
        // Related bookmarks section
        if (bookmark.relations && bookmark.relations.length > 0) {
            content += `\n## Relacionado\n`;
            bookmark.relations.forEach(relId => {
                content += `- [[${relId}]]\n`;
            });
        }
        
        return frontmatter + '\n\n' + content;
    },

    getFilename(bookmark) {
        // Create a safe filename from title
        let filename = bookmark.title
            .replace(/[<>:"/\\|?*]/g, '')
            .replace(/\s+/g, '-')
            .substring(0, 100);
        
        // Add ID to ensure uniqueness
        filename += `-${bookmark.id}`;
        
        return filename + '.md';
    },

    getFolderPath(bookmark) {
        // Organize by type
        const typeFolders = {
            'video': 'Recursos/Videos',
            'pdf': 'Recursos/PDFs',
            'article': 'Recursos/Artículos',
            'blog': 'Recursos/Blogs',
            'tutorial': 'Recursos/Tutoriales'
        };
        
        return typeFolders[bookmark.type] || 'Recursos/Misceláneos';
    },

    async exportBookmark(bookmark) {
        const filename = this.getFilename(bookmark);
        const content = this.generateMarkdown(bookmark);
        const folder = this.getFolderPath(bookmark);
        
        // In browser environment, we can only offer download
        if (typeof window !== 'undefined') {
            const fullPath = `${folder}/${filename}`;
            return {
                success: true,
                filename: filename,
                folder: folder,
                content: content,
                download: () => {
                    const blob = new Blob([content], { type: 'text/markdown' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    a.click();
                    URL.revokeObjectURL(url);
                }
            };
        }
        
        return { success: false, error: 'Ambiente no compatible' };
    },

    async exportAll(bookmarks) {
        const results = [];
        
        for (const bookmark of bookmarks) {
            const result = await this.exportBookmark(bookmark);
            results.push({
                bookmark: bookmark.title,
                ...result
            });
        }
        
        return {
            success: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            files: results
        };
    },

    async exportAsVault(bookmarks) {
        // Generate a complete vault structure
        const vaultStructure = {
            'README.md': this.generateReadme(bookmarks),
            'Bookmarks': {}
        };
        
        // Organize by type
        const byType = {};
        bookmarks.forEach(bm => {
            const type = bm.type || 'other';
            if (!byType[type]) byType[type] = [];
            byType[type].push(bm);
        });
        
        for (const [type, items] of Object.entries(byType)) {
            const typeName = type.charAt(0).toUpperCase() + type.slice(1) + 's';
            vaultStructure['Bookmarks'][typeName] = {};
            
            for (const bm of items) {
                const filename = this.getFilename(bm);
                vaultStructure['Bookmarks'][typeName][filename] = this.generateMarkdown(bm);
            }
        }
        
        // Generate index files
        vaultStructure['Bookmarks']['_index.md'] = this.generateIndex(bookmarks, byType);
        
        return vaultStructure;
    },

    generateReadme(bookmarks) {
        const byType = {};
        bookmarks.forEach(bm => {
            const type = bm.type || 'other';
            if (!byType[type]) byType[type] = 0;
            byType[type]++;
        });
        
        return `# Bookmark Vault\n\n
## Resumen\n
- Total de marcadores: ${bookmarks.length}\n
- Videos: ${byType.video || 0}\n
- PDFs: ${byType.pdf || 0}\n
- Artículos: ${byType.article || 0}\n
- Blogs: ${byType.blog || 0}\n
- Tutoriales: ${byType.tutorial || 0}\n\n
## Últimos Marcadores\n\n
${bookmarks.slice(0, 10).map(bm => `- [${bm.title}](Bookmarks/${bm.type}s/${this.getFilename(bm)})`).join('\n')}\n`;
    },

    generateIndex(bookmarks, byType) {
        let content = `# Índice de Marcadores\n\n`;
        
        for (const [type, items] of Object.entries(byType)) {
            const typeName = type.charAt(0).toUpperCase() + type.slice(1) + 's';
            content += `## ${typeName} (${items.length})\n\n`;
            
            items.forEach(bm => {
                content += `- [${bm.title}](./${typeName}/${this.getFilename(bm)})\n`;
            });
            
            content += '\n';
        }
        
        return content;
    },

    downloadVaultZip(bookmarks) {
        // Create a downloadable zip file structure
        const vault = this.exportAsVault(bookmarks);
        
        // For now, create a JSON file with the structure
        const blob = new Blob([JSON.stringify(vault, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'obsidian-vault-structure.json';
        a.click();
        URL.revokeObjectURL(url);
    }
};
