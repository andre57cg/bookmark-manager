const app = {
    bookmarks: [],
    topics: [],
    currentFilter: { type: 'all', tag: null, topic: null, search: '', vanguard: false },
    currentView: 'grid',
    selectedBookmark: null,
    editingBookmark: null,

    async init() {
        console.log('APP: Iniciando...');
        try {
            await bookmarkStore.ensureReady();
            console.log('APP: BookmarkStore listo');
            await autoTagger.loadRules();
            console.log('APP: AutoTagger listo');
            await notionExporter.init();
            await obsidianExporter.init();
            
            this.bookmarks = await bookmarkStore.getAllBookmarks();
            this.topics = await bookmarkStore.getAllTopics();
            
            console.log('APP: Configurando eventos...');
            this.setupEventListeners();
            console.log('APP: Eventos configurados');
            this.render();
            console.log('APP: Renderizado completo');
        } catch (error) {
            console.error('APP: Error:', error);
        }
    },

    setupEventListeners() {
        const btn = (id, fn) => {
            const el = document.getElementById(id);
            if (el) {
                el.onclick = fn;
                console.log('APP: Evento configurado en', id);
            } else {
                console.warn('APP: Elemento no encontrado:', id);
            }
        };

        btn('importBtn', () => this.showModal('importModal'));
        btn('emptyImportBtn', () => this.showModal('importModal'));
        btn('exportBtn', () => this.exportJSON());
        btn('settingsBtn', () => this.showSettings());
        btn('notionBtn', () => this.syncToNotion());
        btn('obsidianBtn', () => this.syncToObsidian());
        btn('importFile', () => this.showImportArea('file'));
        btn('importPaste', () => this.showImportArea('paste'));
        btn('importJson', () => this.showImportArea('json'));
        btn('dropZone', () => document.getElementById('fileInput')?.click());
        btn('saveBookmark', () => this.saveBookmarkForm());
        btn('closeDetail', () => this.hideDetailPanel());
        btn('editBookmark', () => this.editSelectedBookmark());
        btn('deleteBookmark', () => this.deleteSelectedBookmark());
        btn('testNotion', () => this.testNotionConnection());
        btn('addRule', () => this.addRule());
        btn('addTopic', () => this.addTopic());

        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.onchange = (e) => {
                if (e.target.files?.[0]) this.handleFileImport(e.target.files[0]);
            };
        }

        document.addEventListener('dragover', (e) => e.preventDefault());
        document.addEventListener('drop', (e) => {
            e.preventDefault();
            if (e.dataTransfer.files?.[0]) this.handleFileImport(e.dataTransfer.files[0]);
        });

        const urlInput = document.getElementById('urlInput');
        if (urlInput) {
            urlInput.onkeypress = (e) => {
                if (e.key === 'Enter') this.addBookmarkFromUrl(e.target.value);
            };
        }

        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.oninput = (e) => {
                this.currentFilter.search = e.target.value.toLowerCase();
                this.renderBookmarks();
            };
        }

        const sortSelect = document.getElementById('sortSelect');
        if (sortSelect) {
            sortSelect.onchange = () => this.renderBookmarks();
        }

        document.querySelectorAll('.view-tab').forEach(tab => {
            tab.onclick = () => {
                if (tab.dataset.view) this.switchView(tab.dataset.view);
            };
        });

        document.querySelectorAll('#typeFilters .sidebar-item').forEach(item => {
            item.onclick = () => {
                if (item.dataset.type) this.filterByType(item.dataset.type);
            };
        });

        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.onclick = () => {
                const modal = btn.closest('.modal');
                if (modal) this.closeModal(modal.id);
            };
        });

        const detailNotes = document.getElementById('detailNotes');
        if (detailNotes) {
            detailNotes.onblur = () => this.saveNotes();
        }

        document.querySelectorAll('.context-item').forEach(item => {
            item.onclick = () => this.handleContextAction(item.dataset.action);
        });

        document.onkeydown = (e) => {
            if (e.key === 'Escape') {
                this.closeAllModals();
                this.hideDetailPanel();
            }
        };

        document.onclick = () => this.hideContextMenu();
    },

        // Search
        document.getElementById('searchInput').oninput = (e) => {
            this.currentFilter.search = e.target.value.toLowerCase();
            this.renderBookmarks();
        };

        // View tabs
        document.querySelectorAll('.view-tab').forEach(tab => {
            tab.onclick = () => tab.dataset.view && this.switchView(tab.dataset.view);
        });

        // Sort
        document.getElementById('sortSelect').onchange = () => this.renderBookmarks();

        // Type filters
        document.querySelectorAll('#typeFilters .sidebar-item').forEach(item => {
            item.onclick = () => item.dataset.type && this.filterByType(item.dataset.type);
        });

        // Modal close buttons
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.onclick = () => {
                const modal = btn.closest('.modal');
                if (modal) this.closeModal(modal.id);
            };
        });

        // Cancel buttons
        document.querySelectorAll('[data-modal]').forEach(btn => {
            btn.onclick = () => btn.dataset.modal && this.closeModal(btn.dataset.modal);
        });

        // Save bookmark
        document.getElementById('saveBookmark').onclick = () => this.saveBookmarkForm();

        // Detail panel
        document.getElementById('closeDetail').onclick = () => this.hideDetailPanel();
        document.getElementById('editBookmark').onclick = () => this.editSelectedBookmark();
        document.getElementById('deleteBookmark').onclick = () => this.deleteSelectedBookmark();
        document.getElementById('detailNotes').onblur = () => this.saveNotes();

        // Settings
        document.getElementById('testNotion').onclick = () => this.testNotionConnection();
        document.getElementById('addRule').onclick = () => this.addRule();
        document.getElementById('addTopic').onclick = () => this.addTopic();

        // Context menu
        document.querySelectorAll('.context-item').forEach(item => {
            item.onclick = () => this.handleContextAction(item.dataset.action);
        });

        // Keyboard
        document.onkeydown = (e) => {
            if (e.key === 'Escape') {
                this.closeAllModals();
                this.hideDetailPanel();
            }
        };
    },

    render() {
        this.renderBookmarks();
        this.renderSidebar();
        this.renderTopicsTree();
        this.updateCounts();
        this.checkEmptyState();
    },

    renderBookmarks() {
        const filtered = this.getFilteredBookmarks();
        const sorted = this.sortBookmarks(filtered);
        this.renderGridView(sorted);
        this.renderListView(sorted);
        if (this.currentView === 'graph') {
            graphVisualizer.init('graphContainer');
            graphVisualizer.render(sorted);
        }
    },

    getFilteredBookmarks() {
        return this.bookmarks.filter(bm => {
            if (this.currentFilter.type !== 'all' && bm.type !== this.currentFilter.type) return false;
            if (this.currentFilter.tag && !bm.tags?.includes(this.currentFilter.tag)) return false;
            if (this.currentFilter.topic && !bm.topics?.some(t => t.includes(this.currentFilter.topic))) return false;
            if (this.currentFilter.vanguard && !bm.isVanguard) return false;
            if (this.currentFilter.search) {
                const s = this.currentFilter.search;
                const text = `${bm.title} ${bm.url} ${bm.tags?.join(' ')} ${bm.topics?.join(' ')}`.toLowerCase();
                if (!text.includes(s)) return false;
            }
            return true;
        });
    },

    sortBookmarks(bookmarks) {
        const sortBy = document.getElementById('sortSelect')?.value || 'recent';
        return [...bookmarks].sort((a, b) => {
            if (sortBy === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
            if (sortBy === 'alpha') return a.title.localeCompare(b.title);
            return new Date(b.createdAt) - new Date(a.createdAt);
        });
    },

    renderGridView(bookmarks) {
        const grid = document.getElementById('bookmarksGrid');
        grid.innerHTML = '';
        bookmarks.forEach(bm => {
            const card = document.createElement('div');
            card.className = `bookmark-card ${bm.isVanguard ? 'vanguard' : ''}`;
            card.dataset.id = bm.id;
            card.innerHTML = `
                <div class="bookmark-card-header">
                    <div class="bookmark-type">${this.getTypeIcon(bm.type)} ${bm.type || 'article'}</div>
                </div>
                <div class="bookmark-card-body">
                    <h3 class="bookmark-title">${this.escapeHtml(bm.title)}</h3>
                    <div class="bookmark-domain">${this.getDomain(bm.url)}</div>
                    <div class="bookmark-tags">${(bm.tags || []).slice(0, 4).map(t => `<span class="bookmark-tag">#${this.escapeHtml(t)}</span>`).join('')}</div>
                </div>
                ${bm.isVanguard ? '<div class="bookmark-vanguard-badge">VANGUARD</div>' : ''}
            `;
            card.onclick = () => this.showBookmarkDetail(bm.id);
            card.oncontextmenu = (e) => { e.preventDefault(); this.showContextMenu(e, bm.id); };
            grid.appendChild(card);
        });
    },

    renderListView(bookmarks) {
        const list = document.getElementById('bookmarksList');
        list.innerHTML = '';
        bookmarks.forEach(bm => {
            const row = document.createElement('div');
            row.className = `bookmark-row ${bm.isVanguard ? 'vanguard' : ''}`;
            row.dataset.id = bm.id;
            row.innerHTML = `
                <span class="bookmark-row-icon">${this.getTypeIcon(bm.type)}</span>
                <div class="bookmark-row-content">
                    <div class="bookmark-row-title">${this.escapeHtml(bm.title)}</div>
                    <div class="bookmark-row-url">${this.escapeHtml(bm.url)}</div>
                </div>
                <div class="bookmark-row-date">${new Date(bm.createdAt).toLocaleDateString()}</div>
            `;
            row.onclick = () => this.showBookmarkDetail(bm.id);
            list.appendChild(row);
        });
    },

    renderSidebar() {
        this.renderTags();
        this.renderVanguardList();
    },

    renderTags() {
        const container = document.getElementById('recentTags');
        const tagCounts = {};
        this.bookmarks.forEach(bm => (bm.tags || []).forEach(t => tagCounts[t] = (tagCounts[t] || 0) + 1));
        const sorted = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 12);
        container.innerHTML = sorted.map(([tag, count]) => 
            `<span class="tag-chip" data-tag="${this.escapeHtml(tag)}">#${this.escapeHtml(tag)} <span class="tag-count">${count}</span></span>`
        ).join('');
        container.querySelectorAll('.tag-chip').forEach(c => c.onclick = () => this.filterByTag(c.dataset.tag));
    },

    renderTopicsTree() {
        const container = document.getElementById('topicsTree');
        const roots = this.topics.filter(t => !t.parent);
        container.innerHTML = roots.map(t => `
            <div class="topic-item" data-id="${t.id}">${t.name}</div>
        `).join('');
        container.querySelectorAll('.topic-item').forEach(i => i.onclick = () => this.filterByTopic(i.dataset.id));
    },

    renderVanguardList() {
        const container = document.getElementById('vanguardList');
        const vanguard = this.bookmarks.filter(b => b.isVanguard).slice(0, 5);
        container.innerHTML = vanguard.map(b => `<li class="sidebar-item" data-id="${b.id}">🔬 ${this.escapeHtml(b.title.substring(0, 25))}...</li>`).join('');
        container.querySelectorAll('.sidebar-item').forEach(i => i.onclick = () => this.showBookmarkDetail(i.dataset.id));
    },

    updateCounts() {
        const counts = { all: this.bookmarks.length, video: 0, article: 0, pdf: 0, blog: 0, tutorial: 0 };
        this.bookmarks.forEach(b => { if (counts[b.type] !== undefined) counts[b.type]++; });
        Object.entries(counts).forEach(([t, c]) => {
            const el = document.getElementById(`count${t.charAt(0).toUpperCase() + t.slice(1)}`);
            if (el) el.textContent = c;
        });
    },

    checkEmptyState() {
        const empty = document.getElementById('emptyState');
        const grid = document.getElementById('gridView');
        if (this.bookmarks.length === 0) {
            empty?.classList.remove('hidden');
            grid?.classList.add('hidden');
        } else {
            empty?.classList.add('hidden');
            grid?.classList.remove('hidden');
        }
    },

    filterByType(type) {
        this.currentFilter.type = type;
        document.querySelectorAll('#typeFilters .sidebar-item').forEach(i => i.classList.toggle('active', i.dataset.type === type));
        this.renderBookmarks();
    },

    filterByTag(tag) {
        this.currentFilter.tag = this.currentFilter.tag === tag ? null : tag;
        this.renderBookmarks();
    },

    filterByTopic(id) {
        const topic = this.topics.find(t => t.id === id);
        if (topic) {
            this.currentFilter.topic = this.currentFilter.topic === id ? null : id;
            this.renderTopicsTree();
            this.renderBookmarks();
        }
    },

    switchView(view) {
        this.currentView = view;
        document.querySelectorAll('.view-tab').forEach(t => t.classList.toggle('active', t.dataset.view === view));
        document.getElementById('gridView').classList.toggle('hidden', view !== 'grid');
        document.getElementById('listView').classList.toggle('hidden', view !== 'list');
        document.getElementById('graphView').classList.toggle('hidden', view !== 'graph');
        if (view === 'graph') setTimeout(() => { graphVisualizer.init('graphContainer'); graphVisualizer.render(this.getFilteredBookmarks()); }, 100);
    },

    showBookmarkDetail(id) {
        const bm = this.bookmarks.find(b => b.id === id);
        if (!bm) return;
        this.selectedBookmark = bm;
        document.getElementById('detailType').textContent = `${this.getTypeIcon(bm.type)} ${bm.type || 'article'}`;
        document.getElementById('detailTitle').textContent = bm.title;
        document.getElementById('detailUrl').href = bm.url;
        document.getElementById('detailUrl').textContent = bm.url;
        document.getElementById('detailNotes').value = bm.notes || '';
        document.getElementById('detailTags').innerHTML = (bm.tags || []).map(t => `<span class="tag-chip">#${this.escapeHtml(t)}</span>`).join('');
        document.getElementById('detailTopics').innerHTML = bm.topics?.length ? `<div class="detail-topics-title">Temas:</div>${bm.topics.map(t => `<div class="topic-path">${t}</div>`).join('')}` : '';
        document.getElementById('detailPanel').classList.remove('hidden');
    },

    hideDetailPanel() { document.getElementById('detailPanel').classList.add('hidden'); this.selectedBookmark = null; },

    async saveNotes() {
        if (!this.selectedBookmark) return;
        this.selectedBookmark.notes = document.getElementById('detailNotes').value;
        this.selectedBookmark.updatedAt = new Date().toISOString();
        await bookmarkStore.saveBookmark(this.selectedBookmark);
    },

    showModal(id) { document.getElementById('modalOverlay').classList.remove('hidden'); document.getElementById(id).classList.remove('hidden'); },
    closeModal(id) { document.getElementById(id).classList.add('hidden'); if (!document.querySelector('.modal:not(.hidden)')) document.getElementById('modalOverlay').classList.add('hidden'); },
    closeAllModals() { document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden')); document.getElementById('modalOverlay').classList.add('hidden'); },

    showImportArea(type) {
        document.getElementById('importArea').classList.toggle('hidden', type === 'paste');
        document.getElementById('pasteArea').classList.toggle('hidden', type !== 'paste');
        if (type !== 'paste') document.getElementById('fileInput').accept = type === 'json' ? '.json' : '.html,.htm';
        if (type === 'paste') document.getElementById('urlInput').focus();
    },

    async handleFileImport(file) {
        if (!file) return;
        const progress = document.getElementById('importProgress');
        const fill = document.getElementById('progressFill');
        const text = document.getElementById('progressText');
        progress.classList.remove('hidden');
        try {
            const bookmarks = file.name.endsWith('.json') ? await bookmarkParser.parseFromJSON(file) : await bookmarkParser.parseHTML(file);
            if (!bookmarks?.length) throw new Error('No se encontraron marcadores');
            text.textContent = `Guardando ${bookmarks.length} marcadores...`;
            for (let i = 0; i < bookmarks.length; i++) {
                await bookmarkStore.saveBookmark(bookmarks[i]);
                fill.style.width = `${Math.round(((i + 1) / bookmarks.length) * 100)}%`;
            }
            this.bookmarks = await bookmarkStore.getAllBookmarks();
            text.textContent = 'Generando temas...';
            await this.generateTopicsFromBookmarks();
            this.render();
            this.showToast(`Importados ${bookmarks.length} marcadores`, 'success');
            this.closeModal('importModal');
        } catch (error) {
            this.showToast('Error: ' + error.message, 'error');
        } finally {
            progress.classList.add('hidden');
            fill.style.width = '0%';
        }
    },

    async generateTopicsFromBookmarks() {
        for (const bm of this.bookmarks) {
            if (!bm.topics?.length) {
                const topics = topicDetector.detectTopics(bm.url, bm.title);
                if (topics.length) {
                    bm.topics = topics;
                    bm.isVanguard = bm.isVanguard || /\b(breakthrough|latest|2024|2025|2026)/i.test(bm.title + ' ' + bm.url);
                    await bookmarkStore.saveBookmark(bm);
                }
            }
        }
        const generated = autoTagger.generateTopicsFromBookmarks(this.bookmarks);
        for (const topic of generated) await bookmarkStore.saveTopic(topic);
        this.topics = await bookmarkStore.getAllTopics();
    },

    async addBookmarkFromUrl(url) {
        if (!url) return;
        try {
            const meta = await bookmarkParser.fetchMetadata(url);
            const type = typeDetector.detectType(url, meta.title);
            const topics = topicDetector.detectTopics(url, meta.title);
            const isVanguard = /\b(breakthrough|latest|2024|2025|2026)/i.test(url + ' ' + meta.title);
            const bm = { id: bookmarkStore.generateId(), url, title: meta.title || url, type, tags: [], topics, isVanguard, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), notes: '', relations: [] };
            await bookmarkStore.saveBookmark(bm);
            this.bookmarks = await bookmarkStore.getAllBookmarks();
            await this.generateTopicsFromBookmarks();
            this.render();
            this.showToast('Marcador añadido', 'success');
            this.closeModal('importModal');
        } catch { this.showToast('Error al procesar URL', 'error'); }
    },

    showAddModal(bm = null) {
        this.editingBookmark = bm;
        document.getElementById('modalTitle').textContent = bm ? 'Editar' : 'Añadir';
        document.getElementById('addUrl').value = bm?.url || '';
        document.getElementById('addTitle').value = bm?.title || '';
        document.getElementById('addTags').value = bm?.tags?.join(', ') || '';
        document.getElementById('addType').value = bm?.type || 'article';
        document.getElementById('addVanguard').checked = bm?.isVanguard || false;
        this.showModal('addModal');
    },

    editBookmark(id) { const bm = this.bookmarks.find(b => b.id === id); if (bm) this.showAddModal(bm); },
    editSelectedBookmark() { if (this.selectedBookmark) this.showAddModal(this.selectedBookmark); },

    async saveBookmarkForm() {
        const url = document.getElementById('addUrl').value.trim();
        if (!url) { this.showToast('URL obligatoria', 'error'); return; }
        const bm = this.editingBookmark || { id: bookmarkStore.generateId(), createdAt: new Date().toISOString() };
        bm.url = url;
        bm.title = document.getElementById('addTitle').value.trim() || url;
        bm.type = document.getElementById('addType').value;
        bm.tags = document.getElementById('addTags').value.split(',').map(t => t.trim()).filter(Boolean);
        bm.isVanguard = document.getElementById('addVanguard').checked;
        bm.updatedAt = new Date().toISOString();
        await bookmarkStore.saveBookmark(bm);
        this.bookmarks = await bookmarkStore.getAllBookmarks();
        if (!this.editingBookmark) await this.generateTopicsFromBookmarks();
        this.render();
        this.showToast('Guardado', 'success');
        this.closeModal('addModal');
        this.editingBookmark = null;
    },

    async deleteBookmark(id) {
        if (!confirm('¿Eliminar?')) return;
        await bookmarkStore.deleteBookmark(id);
        this.bookmarks = this.bookmarks.filter(b => b.id !== id);
        this.render();
        this.hideDetailPanel();
        this.showToast('Eliminado', 'success');
    },
    deleteSelectedBookmark() { if (this.selectedBookmark) this.deleteBookmark(this.selectedBookmark.id); },

    async exportJSON() {
        const data = await bookmarkStore.exportAll();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = `bookmarks-${new Date().toISOString().split('T')[0]}.json`; a.click();
        this.showToast('Exportado', 'success');
    },

    async syncToNotion() {
        if (!notionExporter.isConfigured()) { this.showToast('Configura Notion', 'warning'); this.showSettings(); return; }
        const selected = this.selectedBookmark ? [this.selectedBookmark] : this.bookmarks;
        const result = await notionExporter.exportAll(selected);
        this.showToast(`Notion: ${result.success} exportados`, result.failed ? 'warning' : 'success');
    },

    async syncToObsidian() {
        if (!obsidianExporter.isConfigured()) { this.showToast('Configura Obsidian', 'warning'); this.showSettings(); return; }
        const selected = this.selectedBookmark ? [this.selectedBookmark] : this.bookmarks;
        for (const bm of selected) { const r = await obsidianExporter.exportBookmark(bm); if (r.success && r.download) r.download(); await new Promise(s => setTimeout(s, 300)); }
        this.showToast(`${selected.length} notas descargadas`, 'success');
    },

    async showSettings() {
        document.getElementById('notionApiKey').value = await bookmarkStore.getSetting('notionApiKey') || '';
        document.getElementById('notionDatabaseId').value = await bookmarkStore.getSetting('notionDatabaseId') || '';
        document.getElementById('obsidianPath').value = await bookmarkStore.getSetting('obsidianPath') || '';
        this.showModal('settingsModal');
    },

    async saveSettings() {
        await notionExporter.updateConfig(document.getElementById('notionApiKey').value, document.getElementById('notionDatabaseId').value);
        await obsidianExporter.updateConfig(document.getElementById('obsidianPath').value);
    },

    async testNotionConnection() {
        const result = await notionExporter.testConnection();
        this.showToast(result.message, result.success ? 'success' : 'error');
    },

    async addRule() {
        const pattern = prompt('Patrón regex:');
        if (!pattern) return;
        const type = prompt('Tipo (video, pdf, article, blog, tutorial):');
        const tags = prompt('Tags (coma separated):');
        await autoTagger.addRule({ pattern, type: type || null, tags: tags ? tags.split(',').map(t => t.trim()) : [] });
        this.showToast('Regla añadida', 'success');
    },

    async addTopic() {
        const name = prompt('Nombre del tema:');
        if (!name) return;
        await bookmarkStore.saveTopic({ id: 'topic_' + Date.now(), name, path: [name], color: '#a29bfe' });
        this.topics = await bookmarkStore.getAllTopics();
        this.renderTopicsTree();
        this.showToast('Tema añadido', 'success');
    },

    showContextMenu(e, id) {
        const menu = document.getElementById('contextMenu');
        menu.classList.remove('hidden');
        menu.style.left = e.clientX + 'px';
        menu.style.top = e.clientY + 'px';
        menu.dataset.bookmarkId = id;
        e.stopPropagation();
    },
    hideContextMenu() { document.getElementById('contextMenu').classList.add('hidden'); },

    async handleContextAction(action) {
        const id = document.getElementById('contextMenu').dataset.bookmarkId;
        const bm = this.bookmarks.find(b => b.id === id);
        if (!bm) return;
        switch (action) {
            case 'open': window.open(bm.url, '_blank'); break;
            case 'edit': this.editBookmark(id); break;
            case 'copy': navigator.clipboard.writeText(bm.url); this.showToast('Copiado', 'success'); break;
            case 'delete': await this.deleteBookmark(id); break;
        }
        this.hideContextMenu();
    },

    showToast(msg, type = 'info') {
        const c = document.getElementById('toastContainer');
        const t = document.createElement('div');
        t.className = `toast ${type}`;
        t.innerHTML = `<span class="toast-icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span><span class="toast-message">${msg}</span>`;
        c.appendChild(t);
        setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3000);
    },

    getTypeIcon(type) { return { video: '🎥', article: '📝', pdf: '📄', blog: '💻', tutorial: '📚' }[type] || '📄'; },
    getDomain(url) { try { return new URL(url).hostname.replace('www.', ''); } catch { return url; } },
    escapeHtml(text) { const d = document.createElement('div'); d.textContent = text; return d.innerHTML; }
};

document.addEventListener('DOMContentLoaded', () => app.init());
document.addEventListener('click', () => app.hideContextMenu());
