const app = {
    bookmarks: [],
    topics: [],
    currentFilter: { type: 'all', tag: null, topic: null, search: '', vanguard: false },
    currentView: 'grid',
    selectedBookmark: null,
    editingBookmark: null,

    async init() {
        console.log('Iniciando Bookmark Manager...');
        
        try {
            await bookmarkStore.ensureReady();
            await autoTagger.loadRules();
            await notionExporter.init();
            await obsidianExporter.init();
            
            this.bookmarks = await bookmarkStore.getAllBookmarks();
            this.topics = await bookmarkStore.getAllTopics();
            
            this.setupEventListeners();
            this.render();
            
            console.log('Bookmark Manager iniciado correctamente');
        } catch (error) {
            console.error('Error al iniciar:', error);
        }
    },

    setupEventListeners() {
        // Search
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.currentFilter.search = e.target.value.toLowerCase();
                this.renderBookmarks();
            });
        }

        // Header buttons
        const importBtn = document.getElementById('importBtn');
        if (importBtn) {
            importBtn.addEventListener('click', () => this.showModal('importModal'));
        }

        const emptyImportBtn = document.getElementById('emptyImportBtn');
        if (emptyImportBtn) {
            emptyImportBtn.addEventListener('click', () => this.showModal('importModal'));
        }

        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportJSON());
        }

        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.showSettings());
        }

        // Sync dropdown
        const notionBtn = document.getElementById('notionBtn');
        if (notionBtn) {
            notionBtn.addEventListener('click', () => this.syncToNotion());
        }

        const obsidianBtn = document.getElementById('obsidianBtn');
        if (obsidianBtn) {
            obsidianBtn.addEventListener('click', () => this.syncToObsidian());
        }

        // Import options
        const importFile = document.getElementById('importFile');
        if (importFile) {
            importFile.addEventListener('click', () => this.showImportArea('file'));
        }

        const importPaste = document.getElementById('importPaste');
        if (importPaste) {
            importPaste.addEventListener('click', () => this.showImportArea('paste'));
        }

        const importJson = document.getElementById('importJson');
        if (importJson) {
            importJson.addEventListener('click', () => this.showImportArea('json'));
        }

        // File input
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files?.[0];
                if (file) {
                    this.handleFileImport(file);
                }
            });
        }

        // Drop zone click - trigger file input
        const dropZone = document.getElementById('dropZone');
        if (dropZone) {
            dropZone.style.cursor = 'pointer';
            dropZone.addEventListener('click', (e) => {
                e.preventDefault();
                const fi = document.getElementById('fileInput');
                if (fi) {
                    fi.click();
                }
            });
        }

        // Global drag and drop on document
        document.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        document.addEventListener('drop', (e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (file) {
                this.handleFileImport(file);
            }
        });

        // URL paste
        const urlInput = document.getElementById('urlInput');
        if (urlInput) {
            urlInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.addBookmarkFromUrl(e.target.value);
                }
            });
        }

        // View tabs
        document.querySelectorAll('.view-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                if (tab.dataset.view) {
                    this.switchView(tab.dataset.view);
                }
            });
        });

        // Sort
        const sortSelect = document.getElementById('sortSelect');
        if (sortSelect) {
            sortSelect.addEventListener('change', () => this.renderBookmarks());
        }

        // Type filters in sidebar
        document.querySelectorAll('#typeFilters .sidebar-item').forEach(item => {
            item.addEventListener('click', () => {
                if (item.dataset.type) {
                    this.filterByType(item.dataset.type);
                }
            });
        });

        // Modal close buttons
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                const modal = btn.closest('.modal');
                if (modal) {
                    this.closeModal(modal.id);
                }
            });
        });

        // Cancel buttons in modals
        document.querySelectorAll('[data-modal]').forEach(btn => {
            btn.addEventListener('click', () => {
                const modalId = btn.dataset.modal;
                if (modalId) {
                    this.closeModal(modalId);
                }
            });
        });

        // Save bookmark button
        const saveBookmark = document.getElementById('saveBookmark');
        if (saveBookmark) {
            saveBookmark.addEventListener('click', () => this.saveBookmarkForm());
        }

        // Detail panel
        const closeDetail = document.getElementById('closeDetail');
        if (closeDetail) {
            closeDetail.addEventListener('click', () => this.hideDetailPanel());
        }

        const editBookmark = document.getElementById('editBookmark');
        if (editBookmark) {
            editBookmark.addEventListener('click', () => this.editSelectedBookmark());
        }

        const deleteBookmark = document.getElementById('deleteBookmark');
        if (deleteBookmark) {
            deleteBookmark.addEventListener('click', () => this.deleteSelectedBookmark());
        }

        // Notes auto-save
        const detailNotes = document.getElementById('detailNotes');
        if (detailNotes) {
            detailNotes.addEventListener('blur', () => this.saveNotes());
        }

        // Settings
        const testNotion = document.getElementById('testNotion');
        if (testNotion) {
            testNotion.addEventListener('click', () => this.testNotionConnection());
        }

        const addRule = document.getElementById('addRule');
        if (addRule) {
            addRule.addEventListener('click', () => this.addRule());
        }

        const addTopic = document.getElementById('addTopic');
        if (addTopic) {
            addTopic.addEventListener('click', () => this.addTopic());
        }

        // Save settings when closing settings modal
        const settingsModal = document.getElementById('settingsModal');
        if (settingsModal) {
            const observer = new MutationObserver(() => {
                if (settingsModal.classList.contains('hidden')) {
                    this.saveSettings();
                }
            });
            observer.observe(settingsModal, { attributes: true, attributeFilter: ['class'] });
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAllModals();
                this.hideDetailPanel();
                this.hideContextMenu();
            }
            if (e.ctrlKey && e.key === 'f') {
                e.preventDefault();
                const si = document.getElementById('searchInput');
                if (si) si.focus();
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
            if (this.currentFilter.type !== 'all' && bm.type !== this.currentFilter.type) {
                return false;
            }
            
            if (this.currentFilter.tag && !bm.tags?.includes(this.currentFilter.tag)) {
                return false;
            }
            
            if (this.currentFilter.topic && !bm.topics?.some(t => t.includes(this.currentFilter.topic))) {
                return false;
            }
            
            if (this.currentFilter.vanguard && !bm.isVanguard) {
                return false;
            }
            
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
        const sortBy = document.getElementById('sortSelect')?.value || 'recent';
        
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
        if (!grid) return;
        grid.innerHTML = '';
        
        bookmarks.forEach(bm => {
            const card = this.createBookmarkCard(bm);
            grid.appendChild(card);
        });
    },

    renderListView(bookmarks) {
        const list = document.getElementById('bookmarksList');
        if (!list) return;
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
        
        card.innerHTML = `
            <div class="bookmark-card-header">
                <div class="bookmark-type">${this.getTypeIcon(bm.type)} ${bm.type || 'article'}</div>
                <div class="bookmark-actions">
                    <button class="bookmark-action-btn" data-action="open" title="Abrir">🔗</button>
                    <button class="bookmark-action-btn" data-action="edit" title="Editar">✏️</button>
                </div>
            </div>
            <div class="bookmark-card-body">
                <h3 class="bookmark-title">${this.escapeHtml(bm.title)}</h3>
                <div class="bookmark-domain">${this.getDomain(bm.url)}</div>
                ${bm.description ? `<p class="bookmark-description">${this.escapeHtml(bm.description)}</p>` : ''}
                <div class="bookmark-tags">
                    ${(bm.tags || []).slice(0, 4).map(tag => 
                        `<span class="bookmark-tag">#${this.escapeHtml(tag)}</span>`
                    ).join('')}
                </div>
            </div>
            ${bm.isVanguard ? '<div class="bookmark-vanguard-badge">VANGUARD</div>' : ''}
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
            <div class="bookmark-row-date">${new Date(bm.createdAt).toLocaleDateString()}</div>
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
        if (!container) return;
        
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
        if (!container) return;
        
        const rootTopics = this.topics.filter(t => !t.parent);
        
        container.innerHTML = rootTopics.map(topic => this.renderTopicItem(topic)).join('');
        
        container.querySelectorAll('.topic-item').forEach(item => {
            item.addEventListener('click', () => {
                if (item.dataset.id) {
                    this.filterByTopic(item.dataset.id);
                }
            });
        });
    },

    renderTopicItem(topic) {
        const children = this.topics.filter(t => t.parent === topic.id);
        const hasChildren = children.length > 0;
        const isActive = this.currentFilter.topic === topic.id;
        
        return `
            <div class="topic-item ${isActive ? 'active' : ''}" data-id="${topic.id}" data-name="${topic.name}">
                ${hasChildren ? '<span class="topic-expand">▶</span>' : '<span style="width:14px"></span>'}
                <span>${topic.name}</span>
            </div>
            ${hasChildren ? `<div class="topic-children">${children.map(c => this.renderTopicItem(c)).join('')}</div>` : ''}
        `;
    },

    renderVanguardList() {
        const container = document.getElementById('vanguardList');
        if (!container) return;
        
        const vanguardBookmarks = this.bookmarks.filter(bm => bm.isVanguard);
        
        container.innerHTML = vanguardBookmarks.slice(0, 5).map(bm => `
            <li class="sidebar-item" data-id="${bm.id}">
                <span>🔬</span> ${this.escapeHtml(bm.title.substring(0, 25))}...
            </li>
        `).join('');
        
        container.querySelectorAll('.sidebar-item').forEach(item => {
            item.addEventListener('click', () => {
                if (item.dataset.id) {
                    this.showBookmarkDetail(item.dataset.id);
                }
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
        
        if (emptyState && gridView) {
            if (this.bookmarks.length === 0) {
                emptyState.classList.remove('hidden');
                gridView.classList.add('hidden');
            } else {
                emptyState.classList.add('hidden');
                gridView.classList.remove('hidden');
            }
        }
    },

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

    switchView(view) {
        this.currentView = view;
        
        document.querySelectorAll('.view-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.view === view);
        });
        
        const gridView = document.getElementById('gridView');
        const listView = document.getElementById('listView');
        const graphView = document.getElementById('graphView');
        
        if (gridView) gridView.classList.toggle('hidden', view !== 'grid');
        if (listView) listView.classList.toggle('hidden', view !== 'list');
        if (graphView) graphView.classList.toggle('hidden', view !== 'graph');
        
        if (view === 'graph') {
            setTimeout(() => {
                graphVisualizer.init('graphContainer');
                graphVisualizer.render(this.getFilteredBookmarks());
            }, 100);
        }
    },

    showBookmarkDetail(id) {
        const bm = this.bookmarks.find(b => b.id === id);
        if (!bm) return;
        
        this.selectedBookmark = bm;
        
        const detailType = document.getElementById('detailType');
        const detailTitle = document.getElementById('detailTitle');
        const detailUrl = document.getElementById('detailUrl');
        const detailNotes = document.getElementById('detailNotes');
        const detailTags = document.getElementById('detailTags');
        const detailTopics = document.getElementById('detailTopics');
        
        if (detailType) detailType.textContent = `${this.getTypeIcon(bm.type)} ${bm.type || 'article'}`;
        if (detailTitle) detailTitle.textContent = bm.title;
        if (detailUrl) {
            detailUrl.href = bm.url;
            detailUrl.textContent = bm.url;
        }
        if (detailNotes) detailNotes.value = bm.notes || '';
        
        if (detailTags) {
            detailTags.innerHTML = (bm.tags || []).map(tag => 
                `<span class="tag-chip">#${this.escapeHtml(tag)}</span>`
            ).join('');
        }
        
        if (detailTopics) {
            if (bm.topics && bm.topics.length > 0) {
                detailTopics.innerHTML = `
                    <div class="detail-topics-title">Ruta de Temas:</div>
                    <div class="detail-topics-list">
                        ${bm.topics.map(topic => `
                            <div class="topic-path">${topic}</div>
                        `).join('')}
                    </div>
                `;
            } else {
                detailTopics.innerHTML = '';
            }
        }
        
        const relatedList = document.getElementById('relatedList');
        if (relatedList) {
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
                item.addEventListener('click', () => {
                    if (item.dataset.id) {
                        this.showBookmarkDetail(item.dataset.id);
                    }
                });
            });
        }
        
        const detailPanel = document.getElementById('detailPanel');
        if (detailPanel) detailPanel.classList.remove('hidden');
    },

    hideDetailPanel() {
        const detailPanel = document.getElementById('detailPanel');
        if (detailPanel) detailPanel.classList.add('hidden');
        this.selectedBookmark = null;
    },

    async saveNotes() {
        if (!this.selectedBookmark) return;
        
        const detailNotes = document.getElementById('detailNotes');
        if (detailNotes) {
            this.selectedBookmark.notes = detailNotes.value;
        }
        this.selectedBookmark.updatedAt = new Date().toISOString();
        
        await bookmarkStore.saveBookmark(this.selectedBookmark);
        this.showToast('Notas guardadas', 'success');
    },

    showModal(modalId) {
        const overlay = document.getElementById('modalOverlay');
        const modal = document.getElementById(modalId);
        
        if (overlay) overlay.classList.remove('hidden');
        if (modal) modal.classList.remove('hidden');
    },

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        const overlay = document.getElementById('modalOverlay');
        
        if (modal) modal.classList.add('hidden');
        
        const anyOpen = document.querySelectorAll('.modal:not(.hidden)').length === 0;
        if (overlay && anyOpen) {
            overlay.classList.add('hidden');
        }
    },

    closeAllModals() {
        document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
        const overlay = document.getElementById('modalOverlay');
        if (overlay) overlay.classList.add('hidden');
    },

    showImportArea(type) {
        const importArea = document.getElementById('importArea');
        const pasteArea = document.getElementById('pasteArea');
        
        if (importArea) importArea.classList.add('hidden');
        if (pasteArea) pasteArea.classList.add('hidden');
        
        if (type === 'file' || type === 'json') {
            if (importArea) importArea.classList.remove('hidden');
            const fileInput = document.getElementById('fileInput');
            if (fileInput) fileInput.accept = type === 'json' ? '.json' : '.html';
        } else if (type === 'paste') {
            if (pasteArea) pasteArea.classList.remove('hidden');
            const urlInput = document.getElementById('urlInput');
            if (urlInput) urlInput.focus();
        }
    },

    async handleFileImport(file) {
        if (!file) {
            this.showToast('Selecciona un archivo', 'error');
            return;
        }
        
        const progress = document.getElementById('importProgress');
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        
        if (progress) progress.classList.remove('hidden');
        if (progressText) progressText.textContent = 'Leyendo archivo...';
        if (progressFill) progressFill.style.width = '0%';
        
        try {
            let bookmarks;
            const isJson = file.name.toLowerCase().endsWith('.json');
            
            if (progressText) progressText.textContent = isJson ? 'Procesando JSON...' : 'Procesando HTML...';
            
            if (isJson) {
                bookmarks = await bookmarkParser.parseFromJSON(file);
            } else {
                bookmarks = await bookmarkParser.parseHTML(file);
            }
            
            if (!bookmarks || bookmarks.length === 0) {
                throw new Error('No se encontraron marcadores en el archivo');
            }
            
            if (progressText) progressText.textContent = `Guardando ${bookmarks.length} marcadores...`;
            
            let imported = 0;
            for (const bm of bookmarks) {
                try {
                    await bookmarkStore.saveBookmark(bm);
                    imported++;
                } catch (e) {
                    console.warn('Error guardando bookmark:', e);
                }
                if (progressFill) {
                    progressFill.style.width = `${Math.round((imported / bookmarks.length) * 100)}%`;
                }
            }
            
            this.bookmarks = await bookmarkStore.getAllBookmarks();
            
            if (progressText) progressText.textContent = 'Generando temas automáticamente...';
            
            await this.generateTopicsFromBookmarks();
            
            this.render();
            
            const topicCount = this.topics.length;
            this.showToast(`Importados ${imported} marcadores${topicCount > 0 ? ` y ${topicCount} temas` : ''}`, 'success');
            this.closeModal('importModal');
            
        } catch (error) {
            console.error('Import error:', error);
            this.showToast('Error: ' + (error.message || 'No se pudo importar'), 'error');
        } finally {
            if (progress) progress.classList.add('hidden');
            if (progressFill) progressFill.style.width = '0%';
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

    showAddModal(bookmark = null) {
        this.editingBookmark = bookmark;
        
        const modalTitle = document.getElementById('modalTitle');
        const addUrl = document.getElementById('addUrl');
        const addTitle = document.getElementById('addTitle');
        const addTags = document.getElementById('addTags');
        const addTopics = document.getElementById('addTopics');
        const addType = document.getElementById('addType');
        const addVanguard = document.getElementById('addVanguard');
        const addNotes = document.getElementById('addNotes');
        
        if (modalTitle) modalTitle.textContent = bookmark ? 'Editar Marcador' : 'Añadir Marcador';
        if (addUrl) addUrl.value = bookmark?.url || '';
        if (addTitle) addTitle.value = bookmark?.title || '';
        if (addTags) addTags.value = bookmark?.tags?.join(', ') || '';
        if (addTopics) addTopics.value = bookmark?.topics?.join(', ') || '';
        if (addType) addType.value = bookmark?.type || 'article';
        if (addVanguard) addVanguard.checked = bookmark?.isVanguard || false;
        if (addNotes) addNotes.value = bookmark?.notes || '';
        
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
        const addUrl = document.getElementById('addUrl');
        const addTitle = document.getElementById('addTitle');
        const addTags = document.getElementById('addTags');
        const addTopics = document.getElementById('addTopics');
        const addType = document.getElementById('addType');
        const addVanguard = document.getElementById('addVanguard');
        const addNotes = document.getElementById('addNotes');
        
        const url = addUrl?.value.trim();
        const title = addTitle?.value.trim();
        const tagsStr = addTags?.value || '';
        const topicsStr = addTopics?.value || '';
        const type = addType?.value || 'article';
        const isVanguard = addVanguard?.checked || false;
        const notes = addNotes?.value || '';
        
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

    async showSettings() {
        const notionApiKey = await bookmarkStore.getSetting('notionApiKey') || '';
        const notionDatabaseId = await bookmarkStore.getSetting('notionDatabaseId') || '';
        const obsidianPath = await bookmarkStore.getSetting('obsidianPath') || '';
        
        const nApiKey = document.getElementById('notionApiKey');
        const nDatabaseId = document.getElementById('notionDatabaseId');
        const oPath = document.getElementById('obsidianPath');
        
        if (nApiKey) nApiKey.value = notionApiKey;
        if (nDatabaseId) nDatabaseId.value = notionDatabaseId;
        if (oPath) oPath.value = obsidianPath;
        
        this.renderRulesList();
        this.renderTopicsManager();
        
        this.showModal('settingsModal');
    },

    async saveSettings() {
        const notionApiKey = document.getElementById('notionApiKey')?.value;
        const notionDatabaseId = document.getElementById('notionDatabaseId')?.value;
        const obsidianPath = document.getElementById('obsidianPath')?.value;
        
        await notionExporter.updateConfig(notionApiKey, notionDatabaseId);
        await obsidianExporter.updateConfig(obsidianPath);
    },

    async testNotionConnection() {
        const apiKey = document.getElementById('notionApiKey')?.value;
        const databaseId = document.getElementById('notionDatabaseId')?.value;
        
        await notionExporter.updateConfig(apiKey, databaseId);
        const result = await notionExporter.testConnection();
        
        this.showToast(result.message, result.success ? 'success' : 'error');
    },

    renderRulesList() {
        const container = document.getElementById('rulesList');
        if (!container) return;
        
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
        if (!container) return;
        
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

    showContextMenu(e, bookmarkId) {
        const menu = document.getElementById('contextMenu');
        if (!menu) return;
        
        menu.classList.remove('hidden');
        menu.style.left = `${e.clientX}px`;
        menu.style.top = `${e.clientY}px`;
        menu.dataset.bookmarkId = bookmarkId;
        
        e.stopPropagation();
    },

    hideContextMenu() {
        const menu = document.getElementById('contextMenu');
        if (menu) menu.classList.add('hidden');
    },

    async handleContextAction(action) {
        const menu = document.getElementById('contextMenu');
        const id = menu?.dataset.bookmarkId;
        
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

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        
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

document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
