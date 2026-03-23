const app = {
    bookmarks: [],
    topics: [],
    currentFilter: { type: 'all', tag: null, topic: null, search: '', vanguard: false },
    currentView: 'grid',
    selectedBookmark: null,
    editingBookmark: null,

    async init() {
        await bookmarkStore.ensureReady();
        await autoTagger.loadRules();
        await initDefaultTopics();
        await notionExporter.init();
        await obsidianExporter.init();
        
        this.bookmarks = await bookmarkStore.getAllBookmarks();
        this.topics = await bookmarkStore.getAllTopics();
        
        this.setupEventListeners();
        this.render();
        
        console.log('Bookmark Manager initialized');
    },

    setupEventListeners() {
        // Search
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.currentFilter.search = e.target.value.toLowerCase();
            this.renderBookmarks();
        });

        // Header buttons
        document.getElementById('importBtn').addEventListener('click', () => this.showModal('importModal'));
        document.getElementById('emptyImportBtn')?.addEventListener('click', () => this.showModal('importModal'));
        document.getElementById('exportBtn').addEventListener('click', () => this.exportJSON());
        document.getElementById('settingsBtn').addEventListener('click', () => this.showSettings());

        // Sync dropdown
        document.getElementById('notionBtn').addEventListener('click', () => this.syncToNotion());
        document.getElementById('obsidianBtn').addEventListener('click', () => this.syncToObsidian());

        // Import options
        document.getElementById('importFile').addEventListener('click', () => this.showImportArea('file'));
        document.getElementById('importPaste').addEventListener('click', () => this.showImportArea('paste'));
        document.getElementById('importJson').addEventListener('click', () => this.showImportArea('json'));

        // File input and drop zone
        const fileInput = document.getElementById('fileInput');
        const dropZone = document.getElementById('dropZone');

        fileInput.addEventListener('change', (e) => this.handleFileImport(e.target.files[0]));
        dropZone.addEventListener('click', () => fileInput.click());
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file) this.handleFileImport(file);
        });

        // URL paste
        document.getElementById('urlInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addBookmarkFromUrl(e.target.value);
        });

        // View tabs
        document.querySelectorAll('.view-tab').forEach(tab => {
            tab.addEventListener('click', () => this.switchView(tab.dataset.view));
        });

        // Sort
        document.getElementById('sortSelect').addEventListener('change', () => this.renderBookmarks());

        // Type filters
        document.querySelectorAll('#typeFilters .sidebar-item').forEach(item => {
            item.addEventListener('click', () => this.filterByType(item.dataset.type));
        });

        // Modal close buttons
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => this.closeModal(btn.dataset.modal));
        });

        document.querySelectorAll('[data-modal]').forEach(btn => {
            if (!btn.classList.contains('modal-close')) {
                btn.addEventListener('click', () => this.closeModal(btn.dataset.modal));
            }
        });

        // Save bookmark
        document.getElementById('saveBookmark').addEventListener('click', () => this.saveBookmarkForm());

        // Detail panel
        document.getElementById('closeDetail').addEventListener('click', () => this.hideDetailPanel());
        document.getElementById('editBookmark').addEventListener('click', () => this.editSelectedBookmark());
        document.getElementById('deleteBookmark').addEventListener('click', () => this.deleteSelectedBookmark());

        // Notes auto-save
        document.getElementById('detailNotes').addEventListener('blur', () => this.saveNotes());

        // Settings modal
        document.getElementById('testNotion').addEventListener('click', () => this.testNotionConnection());
        document.getElementById('addRule').addEventListener('click', () => this.addRule());
        document.getElementById('addTopic').addEventListener('click', () => this.addTopic());

        // Context menu
        document.addEventListener('click', () => this.hideContextMenu());
        document.querySelectorAll('.context-item').forEach(item => {
            item.addEventListener('click', () => this.handleContextAction(item.dataset.action));
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAllModals();
                this.hideDetailPanel();
                this.hideContextMenu();
            }
            if (e.ctrlKey && e.key === 'f') {
                e.preventDefault();
                document.getElementById('searchInput').focus();
            }
            if (e.ctrlKey && e.key === 'n') {
                e.preventDefault();
                this.showAddModal();
            }
        });
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
            // Type filter
            if (this.currentFilter.type !== 'all' && bm.type !== this.currentFilter.type) {
                return false;
            }
            
            // Tag filter
            if (this.currentFilter.tag && !bm.tags?.includes(this.currentFilter.tag)) {
                return false;
            }
            
            // Topic filter
            if (this.currentFilter.topic && !bm.topics?.some(t => t.includes(this.currentFilter.topic))) {
                return false;
            }
            
            // Vanguard filter
            if (this.currentFilter.vanguard && !bm.isVanguard) {
                return false;
            }
            
            // Search
            if (this.currentFilter.search) {
                const search = this.currentFilter.search;
                const searchable = `${bm.title} ${bm.url} ${bm.tags?.join(' ')} ${bm.topics?.join(' ')}`.toLowerCase();
                if (!searchable.includes(search)) {
                    return false;
                }
            }
            
            return true;
        });
    },

    sortBookmarks(bookmarks) {
        const sortBy = document.getElementById('sortSelect').value;
        
        return [...bookmarks].sort((a, b) => {
            switch (sortBy) {
                case 'oldest':
                    return new Date(a.createdAt) - new Date(b.createdAt);
                case 'alpha':
                    return a.title.localeCompare(b.title);
                case 'recent':
                default:
                    return new Date(b.createdAt) - new Date(a.createdAt);
            }
        });
    },

    renderGridView(bookmarks) {
        const grid = document.getElementById('bookmarksGrid');
        grid.innerHTML = '';
        
        bookmarks.forEach(bm => {
            const card = this.createBookmarkCard(bm);
            grid.appendChild(card);
        });
    },

    renderListView(bookmarks) {
        const list = document.getElementById('bookmarksList');
        list.innerHTML = '';
        
        bookmarks.forEach(bm => {
            const row = this.createBookmarkRow(bm);
            list.appendChild(row);
        });
    },

    createBookmarkCard(bm) {
        const card = document.createElement('div');
        card.className = `bookmark-card ${bm.isVanguard ? 'vanguard' : ''}`;
        card.dataset.id = bm.id;
        
        const typeIcon = this.getTypeIcon(bm.type);
        
        card.innerHTML = `
            <div class="bookmark-card-header">
                <div class="bookmark-type">
                    ${typeIcon} ${bm.type || 'article'}
                </div>
                <div class="bookmark-actions">
                    <button class="bookmark-action-btn" data-action="open" title="Abrir">
                        <span>🔗</span>
                    </button>
                    <button class="bookmark-action-btn" data-action="edit" title="Editar">
                        <span>✏️</span>
                    </button>
                </div>
            </div>
            <div class="bookmark-card-body">
                <h3 class="bookmark-title">${this.escapeHtml(bm.title)}</h3>
                <div class="bookmark-domain">
                    ${bm.favicon ? `<img src="${bm.favicon}" alt="" onerror="this.style.display='none'">` : '🌐'}
                    ${this.getDomain(bm.url)}
                </div>
                ${bm.description ? `<p class="bookmark-description">${this.escapeHtml(bm.description)}</p>` : ''}
                <div class="bookmark-tags">
                    ${(bm.tags || []).slice(0, 4).map(tag => 
                        `<span class="bookmark-tag">#${this.escapeHtml(tag)}</span>`
                    ).join('')}
                </div>
            </div>
            ${bm.isVanguard ? '<div class="bookmark-vanguard-badge">🔬 VANGUARD</div>' : ''}
        `;
        
        card.addEventListener('click', (e) => {
            if (!e.target.closest('.bookmark-action-btn')) {
                this.showBookmarkDetail(bm.id);
            }
        });
        
        card.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showContextMenu(e, bm.id);
        });
        
        card.querySelectorAll('.bookmark-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (btn.dataset.action === 'open') {
                    window.open(bm.url, '_blank');
                } else if (btn.dataset.action === 'edit') {
                    this.editBookmark(bm.id);
                }
            });
        });
        
        return card;
    },

    createBookmarkRow(bm) {
        const row = document.createElement('div');
        row.className = `bookmark-row ${bm.isVanguard ? 'vanguard' : ''}`;
        row.dataset.id = bm.id;
        
        row.innerHTML = `
            <span class="bookmark-row-icon">${this.getTypeIcon(bm.type)}</span>
            <div class="bookmark-row-content">
                <div class="bookmark-row-title">${this.escapeHtml(bm.title)}</div>
                <div class="bookmark-row-url">${this.escapeHtml(bm.url)}</div>
            </div>
            <div class="bookmark-row-tags">
                ${(bm.tags || []).slice(0, 2).map(tag => 
                    `<span class="bookmark-tag">#${this.escapeHtml(tag)}</span>`
                ).join('')}
            </div>
            <div class="bookmark-row-date">
                ${new Date(bm.createdAt).toLocaleDateString()}
            </div>
        `;
        
        row.addEventListener('click', () => this.showBookmarkDetail(bm.id));
        row.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showContextMenu(e, bm.id);
        });
        
        return row;
    },

    renderSidebar() {
        this.renderTags();
        this.renderVanguardList();
    },

    renderTags() {
        const container = document.getElementById('recentTags');
        const tagCounts = {};
        
        this.bookmarks.forEach(bm => {
            (bm.tags || []).forEach(tag => {
                tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            });
        });
        
        const sortedTags = Object.entries(tagCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 12);
        
        container.innerHTML = sortedTags.map(([tag, count]) => `
            <span class="tag-chip" data-tag="${this.escapeHtml(tag)}">
                #${this.escapeHtml(tag)} <span class="tag-count">${count}</span>
            </span>
        `).join('');
        
        container.querySelectorAll('.tag-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                this.filterByTag(chip.dataset.tag);
            });
        });
    },

    renderTopicsTree() {
        const container = document.getElementById('topicsTree');
        
        // Build tree structure
        const rootTopics = this.topics.filter(t => !t.parent);
        
        container.innerHTML = rootTopics.map(topic => this.renderTopicItem(topic)).join('');
        
        container.querySelectorAll('.topic-item').forEach(item => {
            item.addEventListener('click', () => {
                this.filterByTopic(item.dataset.id);
            });
        });
    },

    renderTopicItem(topic) {
        const children = this.topics.filter(t => t.parent === topic.id);
        const hasChildren = children.length > 0;
        const isActive = this.currentFilter.topic === topic.id;
        
        return `
            <div class="topic-item ${isActive ? 'active' : ''}" data-id="${topic.id}" data-name="${topic.name}">
                ${hasChildren ? `<span class="topic-expand">▶</span>` : '<span style="width:16px"></span>'}
                <span>${topic.name}</span>
            </div>
            ${hasChildren ? `<div class="topic-children">${children.map(c => this.renderTopicItem(c)).join('')}</div>` : ''}
        `;
    },

    renderVanguardList() {
        const container = document.getElementById('vanguardList');
        const vanguardBookmarks = this.bookmarks.filter(bm => bm.isVanguard);
        
        container.innerHTML = vanguardBookmarks.slice(0, 5).map(bm => `
            <li class="sidebar-item" data-id="${bm.id}">
                <span>🔬</span> ${this.escapeHtml(bm.title.substring(0, 25))}...
            </li>
        `).join('');
        
        container.querySelectorAll('.sidebar-item').forEach(item => {
            item.addEventListener('click', () => {
                this.showBookmarkDetail(item.dataset.id);
            });
        });
    },

    updateCounts() {
        const counts = {
            all: this.bookmarks.length,
            video: this.bookmarks.filter(b => b.type === 'video').length,
            article: this.bookmarks.filter(b => b.type === 'article').length,
            pdf: this.bookmarks.filter(b => b.type === 'pdf').length,
            blog: this.bookmarks.filter(b => b.type === 'blog').length,
            tutorial: this.bookmarks.filter(b => b.type === 'tutorial').length
        };
        
        Object.entries(counts).forEach(([type, count]) => {
            const el = document.getElementById(`count${type.charAt(0).toUpperCase() + type.slice(1)}`);
            if (el) el.textContent = count;
        });
    },

    checkEmptyState() {
        const emptyState = document.getElementById('emptyState');
        const gridView = document.getElementById('gridView');
        
        if (this.bookmarks.length === 0) {
            emptyState.classList.remove('hidden');
            gridView.classList.add('hidden');
        } else {
            emptyState.classList.add('hidden');
        }
    },

    // Filters
    filterByType(type) {
        this.currentFilter.type = type;
        document.querySelectorAll('#typeFilters .sidebar-item').forEach(item => {
            item.classList.toggle('active', item.dataset.type === type);
        });
        this.renderBookmarks();
    },

    filterByTag(tag) {
        if (this.currentFilter.tag === tag) {
            this.currentFilter.tag = null;
        } else {
            this.currentFilter.tag = tag;
        }
        this.renderBookmarks();
    },

    filterByTopic(topicId) {
        const topic = this.topics.find(t => t.id === topicId);
        if (topic) {
            if (this.currentFilter.topic === topicId) {
                this.currentFilter.topic = null;
            } else {
                this.currentFilter.topic = topicId;
            }
            this.renderTopicsTree();
            this.renderBookmarks();
        }
    },

    // View switching
    switchView(view) {
        this.currentView = view;
        
        document.querySelectorAll('.view-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.view === view);
        });
        
        document.getElementById('gridView').classList.toggle('hidden', view !== 'grid');
        document.getElementById('listView').classList.toggle('hidden', view !== 'list');
        document.getElementById('graphView').classList.toggle('hidden', view !== 'graph');
        
        if (view === 'graph') {
            setTimeout(() => {
                graphVisualizer.init('graphContainer');
                graphVisualizer.render(this.getFilteredBookmarks());
            }, 100);
        }
    },

    // Detail panel
    showBookmarkDetail(id) {
        const bm = this.bookmarks.find(b => b.id === id);
        if (!bm) return;
        
        this.selectedBookmark = bm;
        
        document.getElementById('detailType').textContent = `${this.getTypeIcon(bm.type)} ${bm.type || 'article'}`;
        document.getElementById('detailTitle').textContent = bm.title;
        document.getElementById('detailUrl').href = bm.url;
        document.getElementById('detailUrl').textContent = bm.url;
        document.getElementById('detailNotes').value = bm.notes || '';
        
        // Tags
        const tagsContainer = document.getElementById('detailTags');
        tagsContainer.innerHTML = (bm.tags || []).map(tag => 
            `<span class="tag-chip">#${this.escapeHtml(tag)}</span>`
        ).join('');
        
        // Topics
        const topicsContainer = document.getElementById('detailTopics');
        if (bm.topics && bm.topics.length > 0) {
            topicsContainer.innerHTML = `
                <div class="detail-topics-title">Ruta de Temas:</div>
                <div class="detail-topics-list">
                    ${bm.topics.map(topic => `
                        <div class="topic-path">
                            ${topic.split(' > ').map((t, i, arr) => 
                                `<span>${i < arr.length - 1 ? t + ' ' : ''}</span>${i < arr.length - 1 ? '<span class="topic-separator">›</span>' : ''}`
                            ).join('')}
                        </div>
                    `).join('')}
                </div>
            `;
        } else {
            topicsContainer.innerHTML = '';
        }
        
        // Related bookmarks
        const relatedList = document.getElementById('relatedList');
        const related = this.bookmarks.filter(b => 
            b.id !== bm.id && (
                b.type === bm.type ||
                b.topics?.some(t => bm.topics?.includes(t)) ||
                b.tags?.some(t => bm.tags?.includes(t))
            )
        ).slice(0, 5);
        
        relatedList.innerHTML = related.map(r => `
            <div class="related-item" data-id="${r.id}">
                <span class="related-item-icon">${this.getTypeIcon(r.type)}</span>
                <span class="related-item-title">${this.escapeHtml(r.title)}</span>
            </div>
        `).join('');
        
        relatedList.querySelectorAll('.related-item').forEach(item => {
            item.addEventListener('click', () => this.showBookmarkDetail(item.dataset.id));
        });
        
        document.getElementById('detailPanel').classList.remove('hidden');
    },

    hideDetailPanel() {
        document.getElementById('detailPanel').classList.add('hidden');
        this.selectedBookmark = null;
    },

    async saveNotes() {
        if (!this.selectedBookmark) return;
        
        this.selectedBookmark.notes = document.getElementById('detailNotes').value;
        this.selectedBookmark.updatedAt = new Date().toISOString();
        
        await bookmarkStore.saveBookmark(this.selectedBookmark);
        this.showToast('Notas guardadas', 'success');
    },

    // Modals
    showModal(modalId) {
        document.getElementById('modalOverlay').classList.remove('hidden');
        document.getElementById(modalId).classList.remove('hidden');
    },

    closeModal(modalId) {
        document.getElementById(modalId).classList.add('hidden');
        const anyOpen = document.querySelectorAll('.modal:not(.hidden)').length === 0;
        if (anyOpen) {
            document.getElementById('modalOverlay').classList.add('hidden');
        }
    },

    closeAllModals() {
        document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
        document.getElementById('modalOverlay').classList.add('hidden');
    },

    showImportArea(type) {
        const importArea = document.getElementById('importArea');
        const pasteArea = document.getElementById('pasteArea');
        
        importArea.classList.add('hidden');
        pasteArea.classList.add('hidden');
        
        if (type === 'file' || type === 'json') {
            importArea.classList.remove('hidden');
            document.getElementById('fileInput').accept = type === 'json' ? '.json' : '.html';
        } else if (type === 'paste') {
            pasteArea.classList.remove('hidden');
            document.getElementById('urlInput').focus();
        }
    },

    // Import
    async handleFileImport(file) {
        if (!file) return;
        
        const progress = document.getElementById('importProgress');
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        
        progress.classList.remove('hidden');
        
        try {
            let bookmarks;
            
            if (file.name.endsWith('.json')) {
                bookmarks = await bookmarkParser.parseFromJSON(file);
            } else {
                bookmarks = await bookmarkParser.parseHTML(file);
            }
            
            progressText.textContent = `Analizando ${bookmarks.length} marcadores...`;
            
            let imported = 0;
            for (const bm of bookmarks) {
                await bookmarkStore.saveBookmark(bm);
                imported++;
                progressFill.style.width = `${(imported / bookmarks.length) * 100}%`;
                await new Promise(r => setTimeout(r, 5));
            }
            
            this.bookmarks = await bookmarkStore.getAllBookmarks();
            
            progressText.textContent = 'Generando temas automáticamente...';
            
            await this.generateTopicsFromBookmarks();
            
            this.render();
            
            const topicCount = this.topics.length;
            this.showToast(`Importados ${imported} marcadores y ${topicCount} temas detectados`, 'success');
            this.closeModal('importModal');
        } catch (error) {
            console.error('Import error:', error);
            this.showToast('Error al importar: ' + error.message, 'error');
        } finally {
            progress.classList.add('hidden');
            progressFill.style.width = '0%';
        }
    },

    async generateTopicsFromBookmarks() {
        const generatedTopics = autoTagger.generateTopicsFromBookmarks(this.bookmarks);
        
        for (const topic of generatedTopics) {
            await bookmarkStore.saveTopic(topic);
            
            if (topic.subtopics) {
                for (const subtopic of topic.subtopics) {
                    await bookmarkStore.saveTopic(subtopic);
                }
            }
        }
        
        this.topics = await bookmarkStore.getAllTopics();
    },

    async addBookmarkFromUrl(url) {
        if (!url) return;
        
        const preview = document.getElementById('fetchPreview');
        preview.classList.remove('hidden');
        preview.querySelector('.preview-content').innerHTML = '<p>Cargando...</p>';
        
        try {
            const metadata = await bookmarkParser.fetchMetadata(url);
            const analysis = autoTagger.analyze(metadata.title + ' ' + url);
            
            const bookmark = {
                id: bookmarkStore.generateId(),
                url: url,
                title: metadata.title || url,
                description: metadata.description || '',
                favicon: metadata.image,
                type: analysis.type || 'article',
                tags: analysis.tags,
                topics: analysis.topics,
                isVanguard: analysis.isVanguard,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                notes: '',
                relations: []
            };
            
            preview.querySelector('.preview-content').innerHTML = `
                <p><strong>${this.escapeHtml(bookmark.title)}</strong></p>
                <p>Tipo: ${bookmark.type}</p>
                <p>Tags: ${bookmark.tags.join(', ') || 'Ninguno'}</p>
                ${bookmark.isVanguard ? '<p>🔬 Investigación de Vanguardia</p>' : ''}
            `;
            
            await bookmarkStore.saveBookmark(bookmark);
            this.bookmarks = await bookmarkStore.getAllBookmarks();
            
            await this.generateTopicsFromBookmarks();
            
            this.render();
            
            this.showToast('Marcador añadido', 'success');
            this.closeModal('importModal');
        } catch (error) {
            this.showToast('Error al procesar URL', 'error');
        }
    },

    // Add/Edit bookmarks
    showAddModal(bookmark = null) {
        this.editingBookmark = bookmark;
        
        document.getElementById('modalTitle').textContent = bookmark ? 'Editar Marcador' : 'Añadir Marcador';
        document.getElementById('addUrl').value = bookmark?.url || '';
        document.getElementById('addTitle').value = bookmark?.title || '';
        document.getElementById('addTags').value = bookmark?.tags?.join(', ') || '';
        document.getElementById('addTopics').value = bookmark?.topics?.join(', ') || '';
        document.getElementById('addType').value = bookmark?.type || 'article';
        document.getElementById('addVanguard').checked = bookmark?.isVanguard || false;
        document.getElementById('addNotes').value = bookmark?.notes || '';
        
        this.showModal('addModal');
    },

    editBookmark(id) {
        const bm = this.bookmarks.find(b => b.id === id);
        if (bm) this.showAddModal(bm);
    },

    editSelectedBookmark() {
        if (this.selectedBookmark) {
            this.showAddModal(this.selectedBookmark);
        }
    },

    async saveBookmarkForm() {
        const url = document.getElementById('addUrl').value.trim();
        const title = document.getElementById('addTitle').value.trim();
        const tagsStr = document.getElementById('addTags').value;
        const topicsStr = document.getElementById('addTopics').value;
        const type = document.getElementById('addType').value;
        const isVanguard = document.getElementById('addVanguard').checked;
        const notes = document.getElementById('addNotes').value;
        
        if (!url) {
            this.showToast('La URL es obligatoria', 'error');
            return;
        }
        
        const tags = tagsStr.split(',').map(t => t.trim()).filter(t => t);
        const topics = topicsStr.split(',').map(t => t.trim()).filter(t => t);
        
        const bookmark = this.editingBookmark || {
            id: bookmarkStore.generateId(),
            createdAt: new Date().toISOString()
        };
        
        bookmark.url = url;
        bookmark.title = title || url;
        bookmark.type = type;
        bookmark.tags = tags;
        bookmark.topics = topics;
        bookmark.isVanguard = isVanguard;
        bookmark.notes = notes;
        bookmark.updatedAt = new Date().toISOString();
        
        if (!bookmark.favicon) {
            bookmark.favicon = bookmarkParser.getFaviconUrl(url);
        }
        
        await bookmarkStore.saveBookmark(bookmark);
        this.bookmarks = await bookmarkStore.getAllBookmarks();
        
        if (!this.editingBookmark) {
            await this.generateTopicsFromBookmarks();
        }
        
        this.render();
        
        this.showToast('Marcador guardado', 'success');
        this.closeModal('addModal');
        this.editingBookmark = null;
    },

    async deleteBookmark(id) {
        if (!confirm('¿Eliminar este marcador?')) return;
        
        await bookmarkStore.deleteBookmark(id);
        this.bookmarks = this.bookmarks.filter(b => b.id !== id);
        this.render();
        this.hideDetailPanel();
        
        this.showToast('Marcador eliminado', 'success');
    },

    async deleteSelectedBookmark() {
        if (this.selectedBookmark) {
            await this.deleteBookmark(this.selectedBookmark.id);
        }
    },

    // Export
    async exportJSON() {
        const data = await bookmarkStore.exportAll();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bookmarks-export-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        this.showToast('Exportación completada', 'success');
    },

    // Sync
    async syncToNotion() {
        if (!notionExporter.isConfigured()) {
            this.showToast('Configura Notion en ajustes', 'warning');
            this.showSettings();
            return;
        }
        
        const selected = this.selectedBookmark ? [this.selectedBookmark] : this.bookmarks;
        const result = await notionExporter.exportAll(selected);
        
        this.showToast(
            `Notion: ${result.success} exportados, ${result.failed} errores`,
            result.failed > 0 ? 'warning' : 'success'
        );
    },

    async syncToObsidian() {
        if (!obsidianExporter.isConfigured()) {
            this.showToast('Configura Obsidian en ajustes', 'warning');
            this.showSettings();
            return;
        }
        
        const selected = this.selectedBookmark ? [this.selectedBookmark] : this.bookmarks;
        
        for (const bm of selected) {
            const result = await obsidianExporter.exportBookmark(bm);
            if (result.success && result.download) {
                result.download();
                await new Promise(r => setTimeout(r, 500));
            }
        }
        
        this.showToast(`${selected.length} notas descargadas`, 'success');
    },

    // Settings
    async showSettings() {
        const apiKey = await bookmarkStore.getSetting('notionApiKey') || '';
        const databaseId = await bookmarkStore.getSetting('notionDatabaseId') || '';
        const obsidianPath = await bookmarkStore.getSetting('obsidianPath') || '';
        
        document.getElementById('notionApiKey').value = apiKey;
        document.getElementById('notionDatabaseId').value = databaseId;
        document.getElementById('obsidianPath').value = obsidianPath;
        
        this.renderRulesList();
        this.renderTopicsManager();
        
        this.showModal('settingsModal');
    },

    async saveSettings() {
        const notionApiKey = document.getElementById('notionApiKey').value;
        const notionDatabaseId = document.getElementById('notionDatabaseId').value;
        const obsidianPath = document.getElementById('obsidianPath').value;
        
        await notionExporter.updateConfig(notionApiKey, notionDatabaseId);
        await obsidianExporter.updateConfig(obsidianPath);
        
        this.showToast('Configuración guardada', 'success');
    },

    async testNotionConnection() {
        const apiKey = document.getElementById('notionApiKey').value;
        const databaseId = document.getElementById('notionDatabaseId').value;
        
        await notionExporter.updateConfig(apiKey, databaseId);
        const result = await notionExporter.testConnection();
        
        this.showToast(result.message, result.success ? 'success' : 'error');
    },

    renderRulesList() {
        const container = document.getElementById('rulesList');
        const rules = autoTagger.rules;
        
        container.innerHTML = rules.slice(0, 10).map((rule, i) => `
            <div class="rule-item">
                <input type="text" value="${rule.pattern.source}" readonly>
                <span>${rule.type || '—'}</span>
            </div>
        `).join('');
    },

    async addRule() {
        const pattern = prompt('Patrón (regex):');
        if (!pattern) return;
        
        const type = prompt('Tipo (video, article, pdf, blog, tutorial):');
        const tags = prompt('Tags (separados por coma):');
        
        await autoTagger.addRule({
            pattern,
            type: type || null,
            tags: tags ? tags.split(',').map(t => t.trim()) : []
        });
        
        this.renderRulesList();
        this.showToast('Regla añadida', 'success');
    },

    renderTopicsManager() {
        const container = document.getElementById('topicsManager');
        
        const rootTopics = this.topics.filter(t => !t.parent);
        
        container.innerHTML = rootTopics.map(topic => `
            <div class="topic-item-edit">
                <input type="text" value="${topic.name}" data-id="${topic.id}">
                <button class="btn-danger" data-delete="${topic.id}">🗑️</button>
            </div>
        `).join('');
    },

    async addTopic() {
        const name = prompt('Nombre del tema:');
        if (!name) return;
        
        const newTopic = {
            id: 'topic_' + Date.now(),
            name: name,
            path: [name],
            color: '#a29bfe'
        };
        
        await bookmarkStore.saveTopic(newTopic);
        this.topics = await bookmarkStore.getAllTopics();
        this.renderTopicsTree();
        this.renderTopicsManager();
        
        this.showToast('Tema añadido', 'success');
    },

    // Context menu
    showContextMenu(e, bookmarkId) {
        const menu = document.getElementById('contextMenu');
        menu.classList.remove('hidden');
        menu.style.left = `${e.clientX}px`;
        menu.style.top = `${e.clientY}px`;
        menu.dataset.bookmarkId = bookmarkId;
    },

    hideContextMenu() {
        document.getElementById('contextMenu').classList.add('hidden');
    },

    async handleContextAction(action) {
        const menu = document.getElementById('contextMenu');
        const id = menu.dataset.bookmarkId;
        
        if (!id) return;
        
        const bm = this.bookmarks.find(b => b.id === id);
        if (!bm) return;
        
        switch (action) {
            case 'open':
                window.open(bm.url, '_blank');
                break;
            case 'edit':
                this.editBookmark(id);
                break;
            case 'copy':
                navigator.clipboard.writeText(bm.url);
                this.showToast('URL copiada', 'success');
                break;
            case 'notion':
                this.selectedBookmark = bm;
                await this.syncToNotion();
                break;
            case 'obsidian':
                this.selectedBookmark = bm;
                await this.syncToObsidian();
                break;
            case 'delete':
                await this.deleteBookmark(id);
                break;
        }
        
        this.hideContextMenu();
    },

    // Toast notifications
    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };
        
        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span class="toast-message">${message}</span>
        `;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    // Utilities
    getTypeIcon(type) {
        const icons = {
            video: '🎥',
            article: '📝',
            pdf: '📄',
            blog: '💻',
            tutorial: '📚'
        };
        return icons[type] || '📄';
    },

    getDomain(url) {
        try {
            return new URL(url).hostname.replace('www.', '');
        } catch {
            return url;
        }
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
