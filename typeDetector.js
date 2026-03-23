const typeDetector = {
    detectType(url, title) {
        const text = (url + ' ' + title).toLowerCase();
        const scores = { pdf: 0, video: 0, article: 0, blog: 0, tutorial: 0 };

        // === YOUTUBE (prioridad máxima) ===
        if (/youtube\.com/i.test(url) || /youtu\.be/i.test(url)) {
            if (/\/watch\?/i.test(url)) scores.video += 100;
            else if (/\/shorts\//i.test(url)) scores.video += 100;
            else if (/\/live\//i.test(url)) scores.video += 100;
            else if (/\/embed\//i.test(url)) scores.video += 100;
            else if (/\/v\//i.test(url)) scores.video += 100;
            else scores.video += 100;
            
            // Detectar tipo de contenido YouTube
            if (/\b(tutorial|course|lecture|learn|how to|how-to|explico|explicacion|didactic)\b/i.test(title)) {
                scores.tutorial += 30;
            }
            if (/\b(news|review|unboxing|vs |compar|vs\.)\b/i.test(title)) {
                scores.article += 20;
            }
            
            return 'video';
        }

        // === VIDEOS (otras plataformas) ===
        if (/vimeo\.com/i.test(url)) { scores.video += 100; return 'video'; }
        if (/dailymotion\.com/i.test(url)) { scores.video += 90; return 'video'; }
        if (/twitch\.tv/i.test(url)) { scores.video += 90; return 'video'; }
        if (/bilibili\.com/i.test(url)) { scores.video += 85; return 'video'; }
        if (/\.(mp4|webm|avi|mov|mkv)(\?.*)?$/i.test(url)) { scores.video += 100; return 'video'; }

        // Plataformas de cursos con video
        if (/coursera\.org/i.test(url)) {
            if (/\/lecture\//i.test(url) || /\/v\//i.test(url)) {
                scores.video += 80;
                scores.tutorial += 40;
                return 'video';
            }
        }
        if (/udemy\.com/i.test(url)) {
            if (/\/lecture\//i.test(url)) {
                scores.video += 80;
                scores.tutorial += 40;
                return 'video';
            }
        }

        // === PDF ===
        if (/\.pdf(\?.*)?(#.*)?$/i.test(url)) return 'pdf';
        if (/arxiv\.org.*\.pdf$/i.test(url)) return 'pdf';
        if (/arxiv\.org\/abs\//i.test(url)) return 'pdf';
        if (/scholar\.google\..*\/scholar.*pdf/i.test(text)) return 'pdf';
        if (/sciencedirect\.com.*\/science\/article/i.test(text)) return 'pdf';
        if (/springer\.com.*\/article/i.test(text)) return 'pdf';
        if (/ieeexplore\.ieee\.org/i.test(url)) return 'pdf';
        if (/nature\.com.*\/articles/i.test(text)) return 'pdf';
        if (/researchgate\.net/i.test(url)) return 'pdf';
        if (/github\.com.*\.pdf$/i.test(text)) return 'pdf';
        if (/raw\.githubusercontent.*\.pdf/i.test(url)) return 'pdf';
        if (/\/paper\//i.test(url)) return 'pdf';
        if (/\/publication\//i.test(url)) return 'pdf';
        if (/\b(thesis|dissertation|paper)\b.*\.(pdf|doc)/i.test(text)) return 'pdf';

        // === TUTORIALES ===
        if (/stackoverflow\.com/i.test(url)) { scores.tutorial += 50; }
        if (/w3schools\.com/i.test(url)) { scores.tutorial += 50; return 'tutorial'; }
        if (/geeksforgeeks\.org/i.test(url)) { scores.tutorial += 45; return 'tutorial'; }
        if (/tutorialspoint\.com/i.test(url)) { scores.tutorial += 45; return 'tutorial'; }
        if (/programiz\.com/i.test(url)) { scores.tutorial += 40; return 'tutorial'; }
        if (/docs\./i.test(url)) { scores.tutorial += 40; }
        if (/readthedocs\./i.test(url)) { scores.tutorial += 40; }
        if (/\/tutorial\//i.test(url)) scores.tutorial += 30;
        if (/\/guide\//i.test(url)) scores.tutorial += 25;
        if (/\/how-to\//i.test(url)) scores.tutorial += 30;
        if (/getting-started/i.test(url)) scores.tutorial += 25;
        if (/\.md$|\.txt$|\.rst$/i.test(url)) scores.tutorial += 20;
        if (/readme|changelog|contributing/i.test(url)) scores.tutorial += 25;
        if (/\b(tutorial|guide|how to|step by step|beginner|introduction|crash course)\b/i.test(title)) {
            scores.tutorial += 30;
        }

        // === ARTÍCULOS ===
        if (/medium\.com/i.test(url)) { scores.article += 45; return 'article'; }
        if (/dev\.to/i.test(url)) { scores.article += 45; return 'article'; }
        if (/hashnode\.com/i.test(url)) { scores.article += 40; return 'article'; }
        if (/towardsdatascience\.com/i.test(url)) { scores.article += 45; return 'article'; }
        if (/freecodecamp\.org.*\/news\//i.test(text)) { scores.article += 40; return 'article'; }
        if (/techcrunch\.com/i.test(url)) { scores.article += 40; return 'article'; }
        if (/theverge\.com/i.test(url)) { scores.article += 40; return 'article'; }
        if (/hackernews\.ycombinator\.com/i.test(url)) { scores.article += 35; return 'article'; }
        if (/\/article\//i.test(url)) scores.article += 20;
        if (/\/blog\//i.test(url)) scores.article += 15;

        // === BLOGS ===
        if (/\.blogspot\.com/i.test(url)) { scores.blog += 40; return 'blog'; }
        if (/\.wordpress\.com/i.test(url)) { scores.blog += 40; return 'blog'; }
        if (/substack\.com/i.test(url)) { scores.blog += 40; scores.article += 20; return 'blog'; }

        // Determinar tipo con mayor puntuación
        let maxType = 'article';
        let maxScore = 0;
        for (const [type, score] of Object.entries(scores)) {
            if (score > maxScore) {
                maxScore = score;
                maxType = type;
            }
        }

        return maxScore >= 15 ? maxType : 'article';
    }
};

const topicDetector = {
    patterns: {
        // Mathematics
        'Mathematics': /\b(math|mathematics|algebra|geometry|calculus|analysis|topology|number theory|equation|theorem|proof|lemma|integral|derivative|differential|vector|matrix|eigenvalue|hilbert|banach)\b/i,
        'Analysis': /\b(real analysis|complex analysis|functional analysis|measure theory|lebesgue|fourier|series|convergence|limit|continuity|differentiability)\b/i,
        'Linear Algebra': /\b(linear algebra|matrix|vector space|eigenvalue|eigenvector|determinant|trace|rank|transpose|singular value)\b/i,
        'Calculus': /\b(calculus|differential|integral|derivative|limit|gradient|divergence|curl|jacobian|hessian)\b/i,
        'Abstract Algebra': /\b(group|ring|field|homomorphism|isomorphism|lattice|galois|category)\b/i,
        'Number Theory': /\b(number theory|prime|riemann|zeta|diophantine|modular|fermat|euler|gauss|elliptic)\b/i,
        'Statistics': /\b(statistics|statistical|probability|stochastic|random variable|distribution|variance|mean|regression|hypothesis)\b/i,
        'Optimization': /\b(optimization|optimisation|convex|linear programming|integer programming|gradient descent|optimal|lagrange)\b/i,

        // Computer Science
        'Programming': /\b(programming|coding|development|algorithm|software|code|developer|debug|refactor)\b/i,
        'Algorithms': /\b(algorithm|complexity|big-o|big o|sorting|searching|graph algorithm|dp|dynamic programming|greedy|divide and conquer)\b/i,
        'Data Structures': /\b(data structure|tree|graph|hash|heap|stack|queue|linked list|array)\b/i,
        'Web Development': /\b(html|css|javascript|typescript|frontend|backend|fullstack|react|vue|angular|svelte|next\.js|nuxt)\b/i,
        'Backend': /\b(node|express|flask|django|rails|laravel|spring|api|rest|graphql|microservice)\b/i,
        'Databases': /\b(database|sql|mysql|postgresql|mongodb|redis|cassandra|nosql|query|indexing)\b/i,
        'DevOps': /\b(devops|docker|kubernetes|ci\/cd|jenkins|github actions|ansible|terraform|cloud|aws|azure|gcp)\b/i,
        'Security': /\b(security|cybersecurity|cryptography|encryption|authentication|authorization|vulnerability|xss|sql injection)\b/i,
        'Networking': /\b(networking|network|protocol|http|tcp|ip|udp|websocket|rest api|router|bandwidth)\b/i,

        // AI & ML
        'Machine Learning': /\b(machine learning|ml|supervised|unsupervised|semi-supervised|classification|regression|clustering)\b/i,
        'Deep Learning': /\b(deep learning|neural network|backpropagation|convolutional|cnn|recurrent|rnn|lstm|gru|transformer)\b/i,
        'NLP': /\b(nlp|natural language|text processing|tokenization|embedding|bert|gpt|llm|language model|chatbot)\b/i,
        'Computer Vision': /\b(computer vision|image processing|opencv|object detection|yolo|segmentation|feature extraction)\b/i,
        'Reinforcement Learning': /\b(reinforcement learning|policy|reward|agent|environment|q-learning|actor-critic|reward shaping)\b/i,
        'AI Ethics': /\b(ai ethics|fairness|bias|explainability|interpretability|transparency|accountability)\b/i,

        // Physics
        'Physics': /\b(physics|mechanics|thermodynamics|electromagnetism|optics|acoustic)\b/i,
        'Quantum Mechanics': /\b(quantum|quantum mechanics|schrodinger|heisenberg|wave function|uncertainty|entanglement)\b/i,
        'Particle Physics': /\b(particle physics|standard model|quark|lepton|boson|hadron|collider|detector)\b/i,
        'Cosmology': /\b(cosmology|astrophysics|black hole|galaxy|stellar|big bang|expansion|cmb)\b/i,
        'General Relativity': /\b(general relativity|spacetime|curvature|gravity|gravitational|geodesic|black hole)\b/i,

        // Research
        'Research': /\b(research|academic|journal|conference|peer-reviewed|scholar|publication|arxiv| preprint)\b/i,
        'Papers': /\b(paper|article|study|proceedings|symposium|workshop|dissertation|thesis)\b/i,
        'Methodology': /\b(methodology|methods|experiment|simulation|modeling|validation|benchmark|dataset)\b/i,

        // Education
        'Courses': /\b(course|class|lesson|lecture|seminar|workshop|training|bootcamp|certification)\b/i,
        'Books': /\b(book|ebook|textbook|chapter|edition|volume|publication)\b/i,
        'Documentation': /\b(documentation|docs|reference|manual|specification|api reference)\b/i,

        // Vanguard
        'Vanguard': /\b(breakthrough|state-of-the-art|sota|frontier|cutting-edge|latest|recent|new approach|revolutionary|emerging|2024|2025|2026)\b/i,
    },

    detectTopics(url, title) {
        const text = (url + ' ' + title).toLowerCase();
        const detectedTopics = [];

        for (const [topic, pattern] of Object.entries(this.patterns)) {
            if (pattern.test(text)) {
                detectedTopics.push(topic);
            }
        }

        return [...new Set(detectedTopics)];
    }
};
