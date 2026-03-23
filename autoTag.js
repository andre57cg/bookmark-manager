const autoTagger = {
    rules: [],

    async loadRules() {
        const savedRules = await bookmarkStore.getAllRules();
        if (savedRules.length > 0) {
            this.rules = savedRules.map(r => ({
                pattern: new RegExp(r.pattern, r.flags || 'i'),
                type: r.type,
                tags: r.tags,
                topics: r.topics,
                isVanguard: r.isVanguard
            }));
        } else {
            this.rules = this.defaultRules.map(r => ({
                pattern: new RegExp(r.pattern.source, 'i'),
                type: r.type,
                tags: r.tags,
                topics: r.topics,
                isVanguard: r.isVanguard
            }));
            for (const rule of this.defaultRules) {
                await bookmarkStore.saveRule({
                    id: 'rule_' + Math.random().toString(36).substr(2, 9),
                    ...rule,
                    flags: 'i'
                });
            }
        }
    },

    analyze(text) {
        const result = {
            type: 'article',
            tags: [],
            topics: [],
            isVanguard: false
        };

        const combinedText = (text || '').toLowerCase();

        for (const rule of this.rules) {
            try {
                if (rule.pattern.test(combinedText)) {
                    if (rule.type && !result.type) {
                        result.type = rule.type;
                    }
                    if (rule.tags) {
                        result.tags = [...new Set([...result.tags, ...rule.tags])];
                    }
                    if (rule.topics) {
                        result.topics = [...new Set([...result.topics, ...rule.topics])];
                    }
                    if (rule.isVanguard) {
                        result.isVanguard = true;
                    }
                }
            } catch (e) {
                console.warn('Rule evaluation error:', e);
            }
        }

        return result;
    },

    getTypeFromUrl(url) {
        const urlLower = url.toLowerCase();
        
        if (/\.(pdf|pdf#|download.*\.pdf)/i.test(urlLower)) return 'pdf';
        if (/youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com/i.test(urlLower)) return 'video';
        if (/medium\.com|dev\.to|article|blog\./i.test(urlLower)) return 'article';
        if (/\.(md|txt|rst|org)$/i.test(urlLower)) return 'tutorial';
        
        return 'article';
    },

    async addRule(rule) {
        const ruleEntity = {
            id: 'rule_' + Date.now(),
            pattern: rule.pattern,
            flags: 'i',
            type: rule.type || null,
            tags: rule.tags || [],
            topics: rule.topics || [],
            isVanguard: rule.isVanguard || false
        };
        
        await bookmarkStore.saveRule(ruleEntity);
        this.rules.push({
            pattern: new RegExp(rule.pattern, 'i'),
            type: ruleEntity.type,
            tags: ruleEntity.tags,
            topics: ruleEntity.topics,
            isVanguard: ruleEntity.isVanguard
        });
        
        return ruleEntity;
    },

    async removeRule(id) {
        await bookmarkStore.deleteRule(id);
        this.rules = this.rules.filter(r => r.id !== id);
    },

    generateTopicsFromBookmarks(bookmarks) {
        const detectedTopics = new Map();
        const topicHierarchy = {
            'Mathematics': ['Analysis', 'Linear Algebra', 'Calculus', 'Abstract Algebra', 'Number Theory', 'Statistics', 'Optimization'],
            'Computer Science': ['Algorithms', 'Data Structures', 'Web Development', 'Backend', 'Databases', 'DevOps', 'Security', 'Networking'],
            'Machine Learning': ['Deep Learning', 'NLP', 'Computer Vision', 'Reinforcement Learning', 'AI Ethics'],
            'Physics': ['Quantum Mechanics', 'Particle Physics', 'Cosmology', 'General Relativity'],
            'Research': ['Papers', 'Methodology'],
            'Education': ['Courses', 'Books', 'Documentation']
        };

        bookmarks.forEach(bookmark => {
            // Usar los topics ya detectados del bookmark
            const topics = bookmark.topics || [];
            
            topics.forEach(topicName => {
                if (!detectedTopics.has(topicName)) {
                    const parent = this.findParent(topicName, topicHierarchy);
                    const color = this.getTopicColor(topicName);
                    
                    detectedTopics.set(topicName, {
                        id: this.slugify(topicName),
                        name: topicName,
                        path: parent ? [parent, topicName] : [topicName],
                        parent: parent ? this.slugify(parent) : null,
                        color: color,
                        count: 0
                    });
                }
                detectedTopics.get(topicName).count++;
            });
        });

        return Array.from(detectedTopics.values()).sort((a, b) => b.count - a.count);
    },

    findParent(topic, hierarchy) {
        for (const [parent, children] of Object.entries(hierarchy)) {
            if (children.includes(topic)) {
                return parent;
            }
        }
        return null;
                    }
                    detectedTopics.get(topicName).count++;
                }
            }

            if (/\b(recent|latest|new|2024|2025|2026|breakthrough|frontier|state-of-the-art|advanced|cutting-edge)\b/i.test(text)) {
                bookmark.isVanguard = true;
            }
        });

        return Array.from(detectedTopics.values())
            .filter(t => t.count >= 1)
            .sort((a, b) => b.count - a.count);
    },

    slugify(text) {
        return text
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim();
    },

    getTopicColor(topicName) {
        const colors = {
            'Mathematics': '#e94560',
            'Computer Science': '#00d9ff',
            'Machine Learning': '#4ecdc4',
            'Deep Learning': '#45b7d1',
            'NLP': '#96ceb4',
            'Physics': '#7b2cbf',
            'Algorithms': '#00d9ff',
            'Data Structures': '#4ecdc4',
            'Web Development': '#00c853',
            'Backend': '#54a0ff',
            'Databases': '#ff9f43',
            'DevOps': '#a29bfe',
            'Security': '#ff6b6b',
            'Networks': '#48dbfb',
            'Quantum Mechanics': '#ff9ff3',
            'Analysis': '#e94560',
            'Linear Algebra': '#ff6b6b',
            'Calculus': '#ff4757',
            'Research': '#00c853',
            'Courses': '#ffc107',
            'Books': '#795548',
            'Documentation': '#78909c',
            'Vanguard': '#c44dff',
            'Papers': '#00c853',
            'Methodology': '#795548'
        };
        return colors[topicName] || '#a29bfe';
    }
};
