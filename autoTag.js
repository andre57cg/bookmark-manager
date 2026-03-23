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
        const topicPatterns = {
            'Mathematics': /\b(math|mathematics|algebra|geometry|calculus|analysis|topology|number theory|equation|theorem|proof|theorem|lemma|integral|derivative|differential)\b/i,
            'Computer Science': /\b(computer science|programming|software|developer|code|coding|algorithm|data structure|computational|computing)\b/i,
            'Machine Learning': /\b(machine learning|deep learning|neural network|artificial intelligence|AI|ML|DL|training|model|tensor|gradient|backpropagation)\b/i,
            'Physics': /\b(physics|quantum|relativity|mechanics|thermodynamics|particle|electron|proton|photon|wave|energy|momentum)\b/i,
            'Quantum Computing': /\b(quantum|qubit|cryptography|entanglement|superposition|quantum gate|decoherence)\b/i,
            'Data Science': /\b(data science|data analysis|statistics|regression|classification|clustering|visualization|pandas|numpy|jupyter)\b/i,
            'Web Development': /\b(html|css|javascript|frontend|backend|react|vue|angular|node|api|web app|website)\b/i,
            'Databases': /\b(database|sql|mongodb|postgresql|mysql|redis|cassandra|nosql|query|index)\b/i,
            'Cloud': /\b(aws|azure|gcp|cloud|serverless|lambda|docker|kubernetes|container|deployment|devops)\b/i,
            'Security': /\b(security|cybersecurity|cryptography|encryption|vulnerability|penetration|malware|firewall|authentication)\b/i,
            'Networks': /\b(network|protocol|http|tcp|ip|router|bandwidth|latency|websocket|server|client)\b/i,
            'Mobile': /\b(mobile|ios|android|swift|kotlin|react native|flutter|app|smartphone)\b/i,
            'Blockchain': /\b(blockchain|crypto|bitcoin|ethereum|nft|smart contract|web3|defi|solidity)\b/i,
            'Biology': /\b(biology|bioinformatics|genomics|protein|DNA|RNA|cell|molecular|gene|evolution)\b/i,
            'Chemistry': /\b(chemistry|chemical|molecule|reaction|organic|inorganic|periodic|catalyst)\b/i,
            'Economics': /\b(economics|market|trade|finance|currency|inflation|stock|bond|investment)\b/i,
            'Psychology': /\b(psychology|cognitive|behavior|mental|brain|neuroscience|therapy|counseling)\b/i,
            'Philosophy': /\b(philosophy|ethics|metaphysics|epistemology|logic|reasoning|consciousness)\b/i,
            'Linguistics': /\b(linguistics|language|grammar|syntax|semantics|phonology|morphology|nlp|translation)\b/i,
            'Engineering': /\b(engineering|mechanical|electrical|civil|aerospace|robotics|automation)\b/i,
            'Research': /\b(research|study|paper|arxiv|scholar|journal|conference|peer-reviewed|academic)\b/i,
            'Education': /\b(education|learning|teaching|course|tutorial|workshop|seminar|lecture|training)\b/i,
            'Business': /\b(business|management|strategy|marketing|startup|entrepreneurship|productivity)\b/i,
            'Design': /\b(design|UX|UI|graphic|visual|interface|user experience|prototyping|wireframe)\b/i,
            'Vanguard': /\b(breakthrough|state-of-the-art|frontier|cutting-edge|latest|2024|2025|2026|new approach|revolutionary|emerging)\b/i
        };

        const detectedTopics = new Map();

        bookmarks.forEach(bookmark => {
            const text = `${bookmark.title} ${bookmark.url} ${bookmark.description || ''}`.toLowerCase();

            for (const [topicName, pattern] of Object.entries(topicPatterns)) {
                if (pattern.test(text)) {
                    if (!detectedTopics.has(topicName)) {
                        detectedTopics.set(topicName, {
                            id: this.slugify(topicName),
                            name: topicName,
                            path: [topicName],
                            color: this.getTopicColor(topicName),
                            count: 0,
                            relatedTopics: []
                        });
                    }
                    detectedTopics.get(topicName).count++;
                }
            }

            if (/\b(recent|latest|new|2024|2025|2026|breakthrough|frontier|state-of-the-art|advanced|cutting-edge)\b/i.test(text)) {
                bookmark.isVanguard = true;
            }
        });

        const topics = Array.from(detectedTopics.values())
            .filter(t => t.count >= 1)
            .sort((a, b) => b.count - a.count);

        this.assignSubtopics(topics, bookmarks);

        return topics;
    },

    assignSubtopics(topics, bookmarks) {
        const subtopicPatterns = {
            'Mathematics': [
                { name: 'Analysis', patterns: [/\b(analysis|real analysis|complex analysis|functional analysis)\b/i] },
                { name: 'Algebra', patterns: [/\b(algebra|linear algebra|abstract algebra|group theory)\b/i] },
                { name: 'Geometry', patterns: [/\b(geometry|differential geometry|euclidean|manifold)\b/i] },
                { name: 'Calculus', patterns: [/\b(calculus|differential|integral|derivative|limit)\b/i] },
                { name: 'Statistics', patterns: [/\b(statistics|probabilidad|probability|stochastic)\b/i] },
                { name: 'Number Theory', patterns: [/\b(number theory|prime|riemann|zeta|diophantine)\b/i] }
            ],
            'Machine Learning': [
                { name: 'Deep Learning', patterns: [/\b(deep learning|neural network|cnn|convolutional|recurrent)\b/i] },
                { name: 'NLP', patterns: [/\b(nlp|natural language|transformer|attention|gpt|bert|llm)\b/i] },
                { name: 'Computer Vision', patterns: [/\b(computer vision|image|object detection|yolo|segmentation)\b/i] },
                { name: 'Reinforcement Learning', patterns: [/\b(reinforcement|policy|reward|agent|environment)\b/i] }
            ],
            'Physics': [
                { name: 'Quantum Mechanics', patterns: [/\b(quantum|schrodinger|heisenberg|wave function)\b/i] },
                { name: 'Particle Physics', patterns: [/\b(particle|quark|lepton|boson|standard model)\b/i] },
                { name: 'Cosmology', patterns: [/\b(cosmology|astrophysics|black hole|galaxy|big bang)\b/i] },
                { name: 'General Relativity', patterns: [/\b(general relativity|spacetime|curvature|gravity)\b/i] }
            ],
            'Computer Science': [
                { name: 'Algorithms', patterns: [/\b(algorithm|complexity|big-o|sorting|searching|graph)\b/i] },
                { name: 'Software Engineering', patterns: [/\b(software engineering|architecture|microservices|design pattern)\b/i] },
                { name: 'Operating Systems', patterns: [/\b(operating system|linux|kernel|process|thread|scheduling)\b/i] }
            ]
        };

        topics.forEach(topic => {
            const patterns = subtopicPatterns[topic.name];
            if (!patterns) return;

            const subtopics = [];

            patterns.forEach(sub => {
                let count = 0;
                bookmarks.forEach(bm => {
                    const text = `${bm.title} ${bm.url}`.toLowerCase();
                    if (sub.patterns.some(p => p.test(text))) count++;
                });

                if (count > 0) {
                    const subtopic = {
                        id: this.slugify(topic.name) + '-' + this.slugify(sub.name),
                        name: sub.name,
                        path: [topic.name, sub.name],
                        parent: topic.id,
                        color: topic.color,
                        count: count
                    };
                    subtopics.push(subtopic);
                }
            });

            topic.subtopics = subtopics;
        });
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
            'Physics': '#7b2cbf',
            'Quantum Computing': '#ff6b6b',
            'Data Science': '#ffe66d',
            'Web Development': '#00c853',
            'Databases': '#ff9f43',
            'Cloud': '#54a0ff',
            'Security': '#5f27cd',
            'Networks': '#48dbfb',
            'Mobile': '#ff9ff3',
            'Blockchain': '#feca57',
            'Biology': '#26de81',
            'Chemistry': '#fd9644',
            'Economics': '#2bcbba',
            'Psychology': '#eb3b5a',
            'Philosophy': '#4b6584',
            'Linguistics': '#778beb',
            'Engineering': '#f7b731',
            'Research': '#00c853',
            'Education': '#a55eea',
            'Business': '#f8a5c2',
            'Design': '#ecf0f1',
            'Vanguard': '#c44dff'
        };
        return colors[topicName] || '#a29bfe';
    }
};

const defaultRules = [
    { pattern: /youtube\.com|youtu\.be|vimeo\.com/i, type: 'video' },
    { pattern: /\.pdf$/i, type: 'pdf' },
    { pattern: /medium\.com|dev\.to/i, type: 'article' },
    { pattern: /github\.io|gitlab\.io/i, type: 'blog' },
    { pattern: /arxiv\.org/i, type: 'pdf', tags: ['research', 'academic'] },
    { pattern: /breakthrough|state-of-the-art|frontier|latest|2024|2025|2026/i, isVanguard: true }
];
