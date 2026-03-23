const bookmarkParser = {
    async parseHTML(file) {
        try {
            const text = await file.text();
            
            if (!text || text.trim().length === 0) {
                throw new Error('El archivo está vacío');
            }
            
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'text/html');
            
            const links = doc.querySelectorAll('a[href]');
            
            if (links.length === 0) {
                throw new Error('No se encontraron marcadores en el archivo');
            }
            
            const bookmarks = [];
            const seenUrls = new Set();
            
            links.forEach(link => {
                const href = link.getAttribute('href');
                const text = link.textContent.trim();
                
                if (href && text && this.isValidUrl(href) && !seenUrls.has(href)) {
                    seenUrls.add(href);
                    
                    bookmarks.push({
                        url: href,
                        title: text,
                        folder: this.extractFolder(link),
                        addDate: link.getAttribute('add_date'),
                        icon: link.getAttribute('icon')
                    });
                }
            });
            
            if (bookmarks.length === 0) {
                throw new Error('No se encontraron URLs válidas en el archivo');
            }
            
            return this.processBookmarks(bookmarks);
            
        } catch (error) {
            console.error('Error parseando HTML:', error);
            throw error;
        }
    },

    isValidUrl(string) {
        if (!string) return false;
        try {
            const url = new URL(string);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch {
            return false;
        }
    },

    extractFolder(link) {
        let folder = 'Sin Carpeta';
        
        let parent = link.parentElement;
        while (parent) {
            const h3 = parent.querySelector(':scope > h3');
            if (h3) {
                folder = h3.textContent.trim();
                break;
            }
            
            const prev = parent.previousElementSibling;
            if (prev && (prev.tagName === 'H3' || prev.tagName === 'DT')) {
                const h = prev.querySelector('h3');
                if (h) {
                    folder = h.textContent.trim();
                    break;
                }
            }
            
            if (parent.tagName === 'BODY') break;
            parent = parent.parentElement;
        }
        
        return folder || 'Sin Carpeta';
    },

    processBookmarks(rawBookmarks) {
        return rawBookmarks.map(raw => {
            // Usar el detector de tipos mejorado
            const type = typeDetector.detectType(raw.url, raw.title);
            
            let createdAt;
            if (raw.addDate) {
                const timestamp = parseInt(raw.addDate);
                if (!isNaN(timestamp)) {
                    createdAt = new Date(timestamp * 1000).toISOString();
                } else {
                    createdAt = new Date().toISOString();
                }
            } else {
                createdAt = new Date().toISOString();
            }
            
            return {
                id: bookmarkStore.generateId(),
                url: raw.url,
                title: raw.title,
                description: '',
                favicon: this.getFaviconUrl(raw.url),
                type: type,
                tags: this.extractKeywords(raw.title, raw.url),
                topics: [],
                isVanguard: false,
                createdAt: createdAt,
                updatedAt: new Date().toISOString(),
                notes: '',
                relations: [],
                folder: raw.folder
            };
        });
    },

    guessTypeFromUrl(url) {
        const urlLower = url.toLowerCase();
        
        // PDFs - extensión .pdf en la URL
        if (/\.pdf(\?.*)?$/i.test(url)) return 'pdf';
        
        // PDFs de Google Scholar y académicas
        if (/scholar\.google|arxiv\.org.*pdf|sciencedirect|springer.*article|ieee.*explore/i.test(urlLower)) return 'pdf';
        
        // PDFs de repositorios académicos
        if (/researchgate\.net|academia\.edu|ssrn\.com|papers\.ssrn/i.test(urlLower)) return 'pdf';
        
        // Videos - plataformas de video
        if (/youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com|twitch\.tv/i.test(urlLower)) return 'video';
        
        // Videos de cursos
        if (/coursera\.org|udemy\.com|edx\.org.*videos/i.test(urlLower)) return 'video';
        
        // Blogs técnicos
        if (/medium\.com|dev\.to|hashnode\.com|substack\.com/i.test(urlLower)) return 'article';
        
        // Blogs personales
        if (/\.blogspot|\.wordpress|\.wix|\.medium\//i.test(urlLower)) return 'blog';
        
        // Tutoriales y documentación
        if (/stackoverflow\.com|stackblitz\.com|codepen\.io/i.test(urlLower)) return 'tutorial';
        if (/docs\.|documentation|wiki|tutorial|guide|how-to/i.test(urlLower)) return 'tutorial';
        
        // Archivos de código/documentation
        if (/\.(md|txt|rst|org)$/i.test(urlLower)) return 'tutorial';
        if (/readme|changelog|contributing/i.test(urlLower)) return 'tutorial';
        
        // Artículos académicos/genéricos
        if (/article|post|blog|news/i.test(urlLower)) return 'article';
        
        return 'article';
    },

    extractKeywords(title, url) {
        const keywords = [];
        const text = (title + ' ' + url).toLowerCase();
        
        const topicPatterns = [
            'machine-learning', 'deep-learning', 'neural-network', 'python', 'javascript',
            'typescript', 'react', 'vue', 'angular', 'node', 'database', 'api',
            'docker', 'kubernetes', 'algorithm', 'data-structure', 'tutorial',
            'guide', 'course', 'documentation', 'research', 'paper', 'study',
            'analysis', 'implementation', 'git', 'github', 'linux', 'windows',
            'security', 'crypto', 'blockchain', 'ai', 'ml', 'dl', 'nlp'
        ];
        
        topicPatterns.forEach(pattern => {
            const regex = new RegExp(pattern.replace(/-/g, '[\\s_-]'), 'i');
            if (regex.test(text)) {
                keywords.push(pattern);
            }
        });
        
        return [...new Set(keywords)].slice(0, 5);
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
            return {
                title: this.extractTitleFromUrl(url),
                description: '',
                image: this.getFaviconUrl(url)
            };
        } catch (error) {
            return {
                title: this.extractTitleFromUrl(url),
                description: '',
                image: null
            };
        }
    },

    extractTitleFromUrl(url) {
        try {
            const urlObj = new URL(url);
            const path = urlObj.pathname;
            
            const parts = path.split('/').filter(p => p);
            if (parts.length > 0) {
                const lastPart = parts[parts.length - 1]
                    .replace(/[-_]/g, ' ')
                    .replace(/\.[^/.]+$/, '')
                    .substring(0, 60);
                return lastPart || urlObj.hostname.replace('www.', '');
            }
            
            return urlObj.hostname.replace('www.', '');
        } catch {
            return url;
        }
    },

    async parseFromJSON(file) {
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            
            let bookmarksArray = [];
            
            if (Array.isArray(data)) {
                bookmarksArray = data;
            } else if (data.bookmarks && Array.isArray(data.bookmarks)) {
                bookmarksArray = data.bookmarks;
            } else if (typeof data === 'object') {
                bookmarksArray = Object.values(data).filter(v => v && typeof v === 'object' && v.url);
            } else {
                throw new Error('Formato JSON no reconocido');
            }
            
            return bookmarksArray.map(item => ({
                id: item.id || bookmarkStore.generateId(),
                url: item.url,
                title: item.title || item.url,
                description: item.description || '',
                favicon: item.favicon || this.getFaviconUrl(item.url),
                type: item.type || this.guessTypeFromUrl(item.url),
                tags: item.tags || [],
                topics: item.topics || [],
                isVanguard: item.isVanguard || false,
                createdAt: item.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                notes: item.notes || '',
                relations: item.relations || [],
                folder: item.folder || 'Importado'
            }));
            
        } catch (error) {
            console.error('Error parseando JSON:', error);
            throw new Error('Error al leer el archivo JSON: ' + error.message);
        }
    },

    parseNetscapeHtml(html) {
        const bookmarks = [];
        const seenUrls = new Set();
        
        const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi;
        let match;
        
        while ((match = linkRegex.exec(html)) !== null) {
            const url = match[1];
            const title = match[2].trim();
            
            if (this.isValidUrl(url) && title && !seenUrls.has(url)) {
                seenUrls.add(url);
                bookmarks.push({
                    url: url,
                    title: title,
                    folder: 'Importado',
                    addDate: null,
                    icon: null
                });
            }
        }
        
        return bookmarks;
    }
};
