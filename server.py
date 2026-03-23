from flask import Flask, request, jsonify, send_from_directory
import json
import os
import uuid
from datetime import datetime
from html.parser import HTMLParser

app = Flask(__name__)
DATA_FILE = 'bookmarks.json'

def load_bookmarks():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []

def save_bookmarks(bookmarks):
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(bookmarks, f, ensure_ascii=False, indent=2)

def generate_id():
    return f"bm_{datetime.now().timestamp()}_{uuid.uuid4().hex[:8]}"

def detect_type(url, title=''):
    url_lower = url.lower()
    title_lower = title.lower()
    text = url_lower + ' ' + title_lower
    
    if 'youtube.com' in url_lower or 'youtu.be' in url_lower:
        return 'video'
    if 'vimeo.com' in url_lower:
        return 'video'
    if '.pdf' in url_lower or url_lower.endswith('.pdf'):
        return 'pdf'
    if 'arxiv.org' in url_lower:
        return 'pdf'
    if 'scholar.google' in url_lower or 'sciencedirect' in url_lower or 'springer' in url_lower:
        return 'pdf'
    if 'ieee' in url_lower:
        return 'pdf'
    if 'researchgate' in url_lower:
        return 'pdf'
    if 'medium.com' in url_lower or 'dev.to' in url_lower:
        return 'article'
    if 'stackoverflow' in url_lower or 'w3schools' in url_lower or 'geeksforgeeks' in url_lower:
        return 'tutorial'
    if 'blogspot' in url_lower or 'wordpress' in url_lower:
        return 'blog'
    
    return 'article'

def detect_topics(url, title=''):
    url_lower = url.lower()
    title_lower = title.lower()
    text = url_lower + ' ' + title_lower
    topics = []
    
    math_words = ['math', 'algebra', 'calculus', 'analysis', 'topology', 'geometry', 'equation', 'theorem', 'proof', 'derivative', 'integral']
    if any(w in text for w in math_words):
        topics.append('Mathematics')
    
    ml_words = ['machine learning', 'deep learning', 'neural network', 'artificial intelligence', ' ai ', ' ai,', ' ml ', 'ml,', 'tensorflow', 'pytorch']
    if any(w in text for w in ml_words):
        topics.append('Machine Learning')
    
    physics_words = ['quantum', 'physics', 'relativity', 'mechanics', 'thermodynamics', 'particle']
    if any(w in text for w in physics_words):
        topics.append('Physics')
    
    prog_words = ['programming', 'algorithm', 'software', 'code', 'developer', 'coding', 'python', 'javascript', 'java']
    if any(w in text for w in prog_words):
        topics.append('Programming')
    
    web_words = ['web', 'html', 'css', 'javascript', 'react', 'vue', 'angular', 'frontend', 'backend', 'api']
    if any(w in text for w in web_words):
        topics.append('Web Development')
    
    db_words = ['database', 'sql', 'mongodb', 'postgresql', 'mysql', 'redis', 'nosql']
    if any(w in text for w in db_words):
        topics.append('Databases')
    
    security_words = ['security', 'cryptography', 'encryption', 'vulnerability', 'cybersecurity']
    if any(w in text for w in security_words):
        topics.append('Security')
    
    research_words = ['research', 'paper', 'academic', 'arxiv', 'journal', 'publication']
    if any(w in text for w in research_words):
        topics.append('Research')
    
    course_words = ['course', 'tutorial', 'lesson', 'lecture', 'learn', 'training']
    if any(w in text for w in course_words):
        topics.append('Courses')
    
    return topics

class BookmarkParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.bookmarks = []
        self.in_anchor = False
        self.current_href = ''
        self.current_text = ''
        self.seen_urls = set()
    
    def handle_starttag(self, tag, attrs):
        if tag == 'a':
            self.in_anchor = True
            self.current_href = ''
            self.current_text = ''
            for attr, value in attrs:
                if attr == 'href':
                    self.current_href = value
    
    def handle_data(self, data):
        if self.in_anchor:
            self.current_text += data
    
    def handle_endtag(self, tag):
        if tag == 'a' and self.in_anchor:
            if self.current_href and self.current_text.strip():
                url = self.current_href.strip()
                title = self.current_text.strip()
                if url.startswith('http') and url not in self.seen_urls:
                    self.seen_urls.add(url)
                    self.bookmarks.append({
                        'url': url,
                        'title': title,
                        'type': detect_type(url, title),
                        'topics': detect_topics(url, title),
                        'tags': []
                    })
            self.in_anchor = False

@app.route('/')
def index():
    return send_from_directory('templates', 'index.html')

@app.route('/api/bookmarks', methods=['GET'])
def get_bookmarks():
    return jsonify(load_bookmarks())

@app.route('/api/bookmarks', methods=['POST'])
def create_bookmark():
    data = request.json
    url = data.get('url', '')
    
    if not url:
        return jsonify({'error': 'URL required'}), 400
    
    bookmark = {
        'id': generate_id(),
        'url': url,
        'title': data.get('title') or url,
        'type': data.get('type') or detect_type(url, data.get('title', '')),
        'topics': data.get('topics') or detect_topics(url, data.get('title', '')),
        'tags': data.get('tags', []),
        'notes': data.get('notes', ''),
        'createdAt': datetime.now().isoformat()
    }
    
    bookmarks = load_bookmarks()
    bookmarks.append(bookmark)
    save_bookmarks(bookmarks)
    
    return jsonify(bookmark)

@app.route('/api/bookmarks/<bookmark_id>', methods=['PUT'])
def update_bookmark(bookmark_id):
    data = request.json
    bookmarks = load_bookmarks()
    
    for i, bm in enumerate(bookmarks):
        if bm['id'] == bookmark_id:
            bookmarks[i].update(data)
            save_bookmarks(bookmarks)
            return jsonify(bookmarks[i])
    
    return jsonify({'error': 'Not found'}), 404

@app.route('/api/bookmarks/<bookmark_id>', methods=['DELETE'])
def delete_bookmark(bookmark_id):
    bookmarks = load_bookmarks()
    bookmarks = [bm for bm in bookmarks if bm['id'] != bookmark_id]
    save_bookmarks(bookmarks)
    return jsonify({'success': True})

@app.route('/api/bookmarks/import', methods=['POST'])
def import_bookmarks():
    data = request.json
    bookmarks = load_bookmarks()
    items = data.get('bookmarks', [])
    
    for item in items:
        bookmark = {
            'id': generate_id(),
            'url': item.get('url', ''),
            'title': item.get('title') or item.get('url', ''),
            'type': item.get('type') or detect_type(item.get('url', ''), item.get('title', '')),
            'topics': item.get('topics') or detect_topics(item.get('url', ''), item.get('title', '')),
            'tags': item.get('tags', []),
            'notes': item.get('notes', ''),
            'createdAt': datetime.now().isoformat()
        }
        if bookmark['url']:
            bookmarks.append(bookmark)
    
    save_bookmarks(bookmarks)
    return jsonify({'imported': len(items), 'total': len(bookmarks)})

@app.route('/api/export', methods=['GET'])
def export_bookmarks():
    return jsonify(load_bookmarks())

@app.route('/api/parse/html', methods=['POST'])
def parse_html():
    if 'file' not in request.files:
        return jsonify({'error': 'No file'}), 400
    
    file = request.files['file']
    content = file.read().decode('utf-8', errors='ignore')
    
    parser = BookmarkParser()
    try:
        parser.feed(content)
        return jsonify(parser.bookmarks)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print('🚀 Bookmark Manager running at http://localhost:5000')
    app.run(debug=True, port=5000)
