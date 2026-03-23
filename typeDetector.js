const typeDetector = {
    // Ponderaciones para cada tipo según el indicador
    weights: {
        pdf: 10,
        video: 8,
        article: 5,
        blog: 4,
        tutorial: 3
    },

    detectType(url, title) {
        const text = (url + ' ' + title).toLowerCase();
        const scores = {
            pdf: 0,
            video: 0,
            article: 0,
            blog: 0,
            tutorial: 0
        };

        // === DETECCIÓN DE PDF (prioridad alta) ===
        
        // Extensión .pdf directa
        if (/\.pdf(\?.*)?(#.*)?$/i.test(url)) {
            scores.pdf += 50;
        }
        
        // Plataformas académicas con PDFs
        if (/arxiv\.org.*\.pdf$/i.test(url)) scores.pdf += 40;
        if (/arxiv\.org\/abs\//i.test(url)) scores.pdf += 35;
        if (/arxiv\.org\/format\//i.test(url)) scores.pdf += 40;
        
        // Google Scholar
        if (/scholar\.google\..*\/scholar.*pdf/i.test(text)) scores.pdf += 40;
        if (/scholar\.google\..*\/scholar.*\?.*pdf/i.test(text)) scores.pdf += 30;
        
        // Otras plataformas académicas
        if (/sciencedirect\.com.*\/science\/article.*pdf/i.test(text)) scores.pdf += 40;
        if (/sciencedirect\.com.*\/pii\/.*pdf/i.test(text)) scores.pdf += 40;
        if (/springer\.com.*\/article.*pdf/i.test(text)) scores.pdf += 40;
        if (/springer\.com.*\/.*\/.*pdf/i.test(text)) scores.pdf += 35;
        if (/ieeexplore\.ieee\.org.*\/stamp\//i.test(text)) scores.pdf += 40;
        if (/ieeexplore\.ieee\.org.*stamp\.jsp/i.test(text)) scores.pdf += 40;
        if (/nature\.com.*\/articles.*pdf/i.test(text)) scores.pdf += 40;
        if (/wiley\.com.*\/doi.*pdf/i.test(text)) scores.pdf += 40;
        if (/tandfonline\.com.*\/pdf/i.test(text)) scores.pdf += 40;
        
        // Repositorios académicos
        if (/researchgate\.net.*\/publication\//i.test(text)) scores.pdf += 35;
        if (/academia\.edu.*\d+\//i.test(text)) scores.pdf += 35;
        if (/ssrn\.com.*\/papers\//i.test(text)) scores.pdf += 35;
        if (/papers\.ssrn\.com/i.test(text)) scores.pdf += 35;
        if (/sci-hub\./i.test(text)) scores.pdf += 30;
        if (/z\-lib\./i.test(text)) scores.pdf += 30;
        
        // Repositorios de código con PDFs
        if (/github\.com.*\/.*\.pdf$/i.test(text)) scores.pdf += 30;
        if (/raw\.githubusercontent.*\.pdf/i.test(text)) scores.pdf += 35;
        if (/raw\.github\.com.*\.pdf/i.test(text)) scores.pdf += 35;
        if (/gist\.github.*\.pdf/i.test(text)) scores.pdf += 25;
        
        // Títulos que indican PDF
        if (/\b(paper|thesis|dissertation|thesis|pdfs?)\b.*\.(pdf|doc)/i.test(text)) scores.pdf += 25;
        if (/^(paper|thesis|dissertation|document|report)/i.test(title)) scores.pdf += 20;
        if (/\b(pdf|aclamación)\b.*\b(paper|article|document)/i.test(text)) scores.pdf += 20;
        
        // Indicadores de artículo académico en URL
        if (/\/article\//i.test(url) && !/medium\.com/i.test(url)) scores.pdf += 15;
        if (/\/paper\//i.test(url)) scores.pdf += 20;
        if (/\/publication\//i.test(url)) scores.pdf += 15;
        if (/\/journal\//i.test(url)) scores.pdf += 15;

        // === DETECCIÓN DE VIDEO ===

        // Plataformas de video conocidas
        if (/youtube\.com/i.test(url)) scores.video += 50;
        if (/youtu\.be/i.test(url)) scores.video += 50;
        if (/vimeo\.com/i.test(url)) scores.video += 50;
        if (/dailymotion\.com/i.test(url)) scores.video += 45;
        if (/twitch\.tv/i.test(url)) scores.video += 45;
        if (/bilibili\.com/i.test(url)) scores.video += 45;
        if (/tiktok\.com/i.test(url)) scores.video += 40;
        if (/facebook\.com.*\/video/i.test(text)) scores.video += 40;
        if (/instagram\.com.*\/reel/i.test(text)) scores.video += 40;
        
        // Plataformas de cursos (con video)
        if (/coursera\.org.*\/lecture\//i.test(text)) scores.video += 45;
        if (/coursera\.org.*\/v\//i.test(text)) scores.video += 45;
        if (/udemy\.com.*\/lecture\//i.test(text)) scores.video += 45;
        if (/udemy\.com.*\/course\//i.test(text)) scores.video += 40;
        if (/edx\.org.*\/courses.*\/j\//i.test(text)) scores.video += 40;
        if (/udacity\.com.*\/learn\//i.test(text)) scores.video += 40;
        if (/pluralsight\.com/i.test(url)) scores.video += 40;
        if (/linkedin\.com\/learning\//i.test(text)) scores.video += 40;
        
        // Indicadores de video en título
        if (/\b(video|lecture|lecture|talk|seminar|webinar|course| tutorial|lesson|codecast)\b/i.test(title)) {
            scores.video += 20;
            scores.tutorial += 15;
        }
        if (/\bwatch|watching|ver|ver|reproducir|play\b/i.test(title)) scores.video += 15;
        if (/\b(demonstration|demo|tutorial|how-to|how to| paso a paso)\b/i.test(text)) {
            scores.video += 10;
            scores.tutorial += 15;
        }
        
        // Vimeo específico
        if (/vimeo\.com\/\d+/i.test(url)) scores.video += 40;
        
        // Archivos de video
        if (/\.(mp4|webm|avi|mov|mkv)(\?.*)?$/i.test(url)) scores.video += 50;
        if (/video\.(mp4|webm|avi)/i.test(url)) scores.video += 45;

        // === DETECCIÓN DE ARTÍCULO ===

        // Plataformas de artículos
        if (/medium\.com/i.test(url)) {
            scores.article += 45;
            if (/\/p\//i.test(url)) scores.article += 20;
        }
        if (/dev\.to/i.test(url)) scores.article += 45;
        if (/hashnode\.com/i.test(url)) scores.article += 40;
        if (/towardsdatascience\.com/i.test(url)) scores.article += 45;
        if (/betterprogramming\.pub/i.test(url)) scores.article += 40;
        if (/javascript\.plainenglish\.io/i.test(url)) scores.article += 40;
        if (/codeburst\.io/i.test(url)) scores.article += 40;
        if (/flaviocopes\.com/i.test(url)) scores.article += 35;
        if (/digitalocean\.com.*\/community\//i.test(text)) scores.article += 40;
        if (/freecodecamp\.org.*\/news\//i.test(text)) scores.article += 40;
        if (/freecodecamp\.org.*\/tutorial\//i.test(text)) {
            scores.article += 30;
            scores.tutorial += 20;
        }
        
        // Blogs de noticias técnicas
        if (/techcrunch\.com/i.test(url)) scores.article += 40;
        if (/theverge\.com/i.test(url)) scores.article += 40;
        if (/arstechnica\.com/i.test(url)) scores.article += 40;
        if (/zdnet\.com/i.test(url)) scores.article += 35;
        if (/wired\.com/i.test(url)) scores.article += 35;
        if (/hackernews\.ycombinator\.com/i.test(url)) scores.article += 35;
        if (/news\.ycombinator\.com/i.test(url)) scores.article += 35;
        
        // Indicadores en título
        if (/\b(article|post|blog post|entry)\b/i.test(title)) scores.article += 20;
        if (/\b(introduction|getting started|overview|beginners? guide)\b/i.test(text)) {
            scores.article += 15;
            scores.tutorial += 10;
        }
        if (/\bhow\b.*\bto\b/i.test(title)) scores.tutorial += 15;
        if (/\bwhat\b.*\bis\b/i.test(title)) scores.article += 10;
        
        // URL con article o post
        if (/\/article\//i.test(url) && !/pdf/i.test(url)) scores.article += 20;
        if (/\/post\//i.test(url)) scores.article += 15;
        if (/\/blog\//i.test(url)) {
            scores.article += 15;
            scores.blog += 10;
        }

        // === DETECCIÓN DE BLOG ===

        // Plataformas de blogs personales
        if (/\.medium\.com/i.test(url)) {
            scores.blog += 35;
            scores.article += 15;
        }
        if (/\.blogspot\.com/i.test(url)) scores.blog += 40;
        if (/\.wordpress\.com/i.test(url)) scores.blog += 40;
        if (/substack\.com/i.test(url)) {
            scores.blog += 40;
            scores.article += 20;
        }
        if (/ghost\.org/i.test(url)) scores.blog += 40;
        if (/hashnode\.dev/i.test(url)) {
            scores.blog += 35;
            scores.article += 15;
        }
        
        // Dominios personales
        if (/\/~[a-z]+\//i.test(url)) scores.blog += 30;
        if (/personales|\.blog$/i.test(url)) scores.blog += 35;
        
        // Títulos de blog
        if (/\b(diary|journal|log|update|notes|thoughts|musings)\b/i.test(title)) scores.blog += 20;

        // === DETECCIÓN DE TUTORIAL ===

        // Plataformas de documentación
        if (/stackoverflow\.com/i.test(url)) {
            scores.tutorial += 50;
            scores.article += 10;
        }
        if (/stackblitz\.com/i.test(url)) scores.tutorial += 45;
        if (/codepen\.io/i.test(url)) scores.tutorial += 45;
        if (/jsfiddle\.net/i.test(url)) scores.tutorial += 45;
        if (/replit\.com/i.test(url)) scores.tutorial += 40;
        if (/codesandbox\.io/i.test(url)) scores.tutorial += 40;
        
        // Documentación oficial
        if (/mozilla\.org.*\/docs\//i.test(text)) scores.tutorial += 40;
        if (/w3schools\.com/i.test(url)) scores.tutorial += 50;
        if (/w3schools\.com.*\/tryit\//i.test(text)) scores.tutorial += 45;
        if (/tutorialspoint\.com/i.test(url)) scores.tutorial += 45;
        if (/geeksforgeeks\.org/i.test(url)) {
            scores.tutorial += 45;
            scores.article += 10;
        }
        if (/programiz\.com/i.test(url)) scores.tutorial += 40;
        if (/learntube\./i.test(url)) scores.tutorial += 40;
        
        // Documentación técnica
        if (/docs\.(nodejs|python|react|vue|angular|docker|kubernetes)\./i.test(text)) scores.tutorial += 40;
        if (/readthedocs\./i.test(url)) scores.tutorial += 40;
        if (/devdocs\.io/i.test(url)) scores.tutorial += 40;
        
        // Indicadores de tutorial
        if (/documentation|docs\b/i.test(url)) scores.tutorial += 30;
        if (/\/wiki\//i.test(url)) scores.tutorial += 25;
        if (/\/guide\//i.test(url)) scores.tutorial += 25;
        if (/\/how-to\//i.test(url)) scores.tutorial += 30;
        if (/\/tutorial\//i.test(url)) scores.tutorial += 30;
        if (/getting-started/i.test(url)) scores.tutorial += 25;
        if (/cheatsheet|cheat-sheet/i.test(url)) scores.tutorial += 35;
        
        // Archivos de documentación
        if (/\.(md|markdown|rst|txt)(\?.*)?$/i.test(url)) {
            scores.tutorial += 25;
            if (/readme/i.test(url)) scores.tutorial += 20;
            if (/changelog/i.test(url)) scores.tutorial += 15;
            if (/contributing/i.test(url)) scores.tutorial += 15;
        }
        
        // Títulos de tutorial
        if (/\b(tutorial|guide|how-to|how to|beginner|introduction|crash course|cheatsheet)\b/i.test(title)) {
            scores.tutorial += 25;
        }
        if (/\b(step by step|step-by-step|paso a paso)\b/i.test(text)) {
            scores.tutorial += 25;
        }
        if (/\b(explained|explain|understanding|learn)\b/i.test(title)) {
            scores.tutorial += 10;
            scores.article += 10;
        }

        // === AJUSTES FINALES ===

        // Si el título dice explícitamente el tipo
        if (/\b(pdf|paper|research)\b/i.test(title) && !/\.pdf/i.test(url)) {
            scores.pdf += 15;
        }
        
        // Arreglar falsos positivos de artículos
        if (/\/article\/.*\.(pdf|PDF)/i.test(url)) {
            scores.pdf += 30;
            scores.article -= 10;
        }
        
        // Si es de GitHub pero no es README ni archivo de código
        if (/github\.com/i.test(url) && !/\.(js|ts|py|java|cpp|c|h|rb|go|rs|php|html|css|json|yaml|yml|md|txt)$/i.test(url)) {
            if (!/readme|changelog|contributing|license/i.test(url)) {
                scores.pdf += 5;
            }
        }

        // Determinar el tipo con mayor puntuación
        let maxType = 'article';
        let maxScore = 0;
        
        for (const [type, score] of Object.entries(scores)) {
            if (score > maxScore) {
                maxScore = score;
                maxType = type;
            }
        }

        // Umbral mínimo para considerar válido
        if (maxScore < 5) {
            return 'article'; // Por defecto
        }

        return maxType;
    }
};
