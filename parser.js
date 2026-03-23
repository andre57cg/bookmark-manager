const bookmarkParser = {
    async parseHTML(file) {
        const text = await file.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');
        
        // Detect browser format
        if (this.isChromeFormat(doc)) {
            return this.parseChrome(doc);
        } else if (this.isFirefoxFormat(doc)) {
            return this.parseFirefox(doc);
        } else if (this.isSafariFormat(doc)) {
            return this.parseSafari(doc);
        } else {
            // Try generic parsing
            return this.parseGeneric(doc);
        }
    },

    isChromeFormat(doc) {
        return doc.querySelector('body') !== null && 
               (doc.querySelector('a') !== null || doc.querySelector('h3') !== null);
    },

    isFirefoxFormat(doc) {
        return doc.querySelector('dl') !== null || 
               doc.querySelector('[标签]') !== null ||
               doc.title.toLowerCase().includes('bookmarks');
    },

    isSafariFormat(doc) {
        return doc.querySelector('doctype')?.name?.toLowerCase() === 'html' &&
               doc.querySelector('a') !== null;
    },

    parseChrome(doc) {
        const bookmarks = [];
        
        // Find all bookmark links in the document
        const links = doc.querySelectorAll('a');
        
        links.forEach(link => {
            const href = link.getAttribute('href');
            const text = link.textContent.trim();
            
            if (href && text && href.startsWith('http')) {
                const parent = link.closest('dl')?.previousElementSibling;
                const folder = parent?.textContent?.trim() || 'Sin Carpeta';
                
                bookmarks.push({
                    url: href,
                    title: text,
                    folder: folder,
                    addDate: link.getAttribute('add_date'),
                    icon: link.getAttribute('icon')
                });
            }
        });
        
        // Also try to find nested folders
        const containers = doc.querySelectorAll('dl');
        containers.forEach(container => {
            const header = container.previousElementSibling;
            const folder = header?.tagName === 'H3' ? header.textContent.trim() : 'Sin Carpeta';
            
            const links = container.querySelectorAll('a[href]');
            links.forEach(link => {
                const href = link.getAttribute('href');
                const text = link.textContent.trim();
                
                if (href && text && href.startsWith('http')) {
                    if (!bookmarks.find(b => b.url === href)) {
                        bookmarks.push({
                            url: href,
                            title: text,
                            folder: folder,
                            addDate: link.getAttribute('add_date'),
                            icon: link.getAttribute('icon')
                        });
                    }
                }
            });
        });
        
        return this.processBookmarks(bookmarks);
    },

    parseFirefox(doc) {
        const bookmarks = [];
        
        // Firefox uses <dt> elements with <a> inside
        const items = doc.querySelectorAll('dt');
        
        items.forEach(item => {
            const link = item.querySelector('a');
            const header = item.querySelector('h3');
            
            if (link) {
                const href = link.getAttribute('href');
                const text = link.textContent.trim();
                
                if (href && text && href.startsWith('http')) {
                    // Find parent folder
                    let folder = 'Sin Carpeta';
                    let sibling = item.previousElementSibling;
                    while (sibling) {
                        if (sibling.tagName === 'DT') {
                            const h3 = sibling.querySelector('h3');
                            if (h3) {
                                folder = h3.textContent.trim();
                                break;
                            }
                        }
                        sibling = sibling.previousElementSibling;
                    }
                    
                    bookmarks.push({
                        url: href,
                        title: text,
                        folder: folder,
                        addDate: link.getAttribute('add_date'),
                        icon: link.getAttribute('icon')
                    });
                }
            }
        });
        
        return this.processBookmarks(bookmarks);
    },

    parseSafari(doc) {
        const bookmarks = [];
        const links = doc.querySelectorAll('a');
        
        links.forEach(link => {
            const href = link.getAttribute('href');
            const text = link.textContent.trim();
            
            if (href && text && (href.startsWith('http') || href.startsWith('https'))) {
                bookmarks.push({
                    url: href,
                    title: text,
                    folder: 'Importado',
                    addDate: null,
                    icon: null
                });
            }
        });
        
        return this.processBookmarks(bookmarks);
    },

    parseGeneric(doc) {
        const bookmarks = [];
        const links = doc.querySelectorAll('a[href]');
        
        links.forEach(link => {
            const href = link.getAttribute('href');
            const text = link.textContent.trim();
            
            if (href && text && href.startsWith('http')) {
                bookmarks.push({
                    url: href,
                    title: text,
                    folder: 'Importado',
                    addDate: null,
                    icon: null
                });
            }
        });
        
        return this.processBookmarks(bookmarks);
    },

    processBookmarks(rawBookmarks) {
        return rawBookmarks.map(raw => {
            const analysis = autoTagger.analyze(raw.title + ' ' + raw.url);
            const type = analysis.type || autoTagger.getTypeFromUrl(raw.url);
            
            return {
                id: bookmarkStore.generateId(),
                url: raw.url,
                title: raw.title,
                description: '',
                favicon: raw.icon || this.getFaviconUrl(raw.url),
                type: type,
                tags: this.extractKeywords(raw.title, raw.url),
                topics: analysis.topics,
                isVanguard: analysis.isVanguard,
                createdAt: raw.addDate ? new Date(parseInt(raw.addDate) * 1000).toISOString() : new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                notes: '',
                relations: [],
                folder: raw.folder
            };
        });
    },

    extractKeywords(title, url) {
        const keywords = [];
        const text = (title + ' ' + url).toLowerCase();
        
        // Common topic keywords
        const topicPatterns = [
            'machine learning', 'deep learning', 'neural network', 'python', 'javascript',
            'react', 'vue', 'angular', 'node', 'database', 'api', 'docker', 'kubernetes',
            'algorithm', 'data structure', 'tutorial', 'guide', 'course', 'documentation',
            'research', 'paper', 'study', 'analysis', 'implementation'
        ];
        
        topicPatterns.forEach(pattern => {
            if (text.includes(pattern)) {
                keywords.push(pattern.replace(/ /g, '-'));
            }
        });
        
        return keywords.slice(0, 5);
    },

    getFaviconUrl(url) {
        try {
            const urlObj = new URL(url);
            return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;
        } catch {
            return null;
        }
    },

    async fetchMetadata(url) {
        try {
            // Use a CORS proxy or fetch directly
            const response = await fetch(url, {
                method: 'HEAD',
                mode: 'no-cors'
            });
            
            // Since we can't get content with no-cors, return basic info
            return {
                title: this.extractTitleFromUrl(url),
                description: '',
                image: this.getFaviconUrl(url)
            };
        } catch (error) {
            return {
                title: this.extractTitleFromUrl(url),
                description: '',
                image: this.getFaviconUrl(url)
            };
        }
    },

    extractTitleFromUrl(url) {
        try {
            const urlObj = new URL(url);
            const path = urlObj.pathname;
            
            // Try to get a meaningful title from URL
            const parts = path.split('/').filter(p => p);
            if (parts.length > 0) {
                const lastPart = parts[parts.length - 1]
                    .replace(/[-_]/g, ' ')
                    .replace(/\.[^/.]+$/, '')
                    .substring(0, 60);
                return lastPart || urlObj.hostname;
            }
            
            return urlObj.hostname.replace('www.', '');
        } catch {
            return url;
        }
    },

    async parseFromJSON(file) {
        const text = await file.text();
        const data = JSON.parse(text);
        
        if (Array.isArray(data)) {
            return data.map(item => ({
                ...item,
                id: item.id || bookmarkStore.generateId(),
                updatedAt: new Date().toISOString()
            }));
        }
        
        if (data.bookmarks) {
            return data.bookmarks.map(item => ({
                ...item,
                id: item.id || bookmarkStore.generateId(),
                updatedAt: new Date().toISOString()
            }));
        }
        
        throw new Error('Formato JSON no válido');
    }
};
