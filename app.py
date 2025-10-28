from flask import Flask, request, jsonify, send_file, Response, render_template, make_response
from flask_cors import CORS
from werkzeug.utils import secure_filename
import os
import json
from datetime import datetime
from pathlib import Path
import uuid
import cv2
import mediapipe as mp
import numpy as np
import time
import mimetypes
import google.generativeai as genai

app = Flask(__name__)

# FIXED: Enhanced CORS configuration with explicit headers
CORS(app, resources={
    r"/api/*": {
        "origins": "*",
        "methods": ["GET", "POST", "DELETE", "OPTIONS", "HEAD"],
        "allow_headers": ["Content-Type", "Range", "Accept"],
        "expose_headers": ["Content-Range", "Accept-Ranges", "Content-Length", "Content-Type"],
        "max_age": 3600
    }
})

# Configuration
UPLOAD_FOLDER = 'videos'
DATA_FOLDER = 'user_data'
ALLOWED_EXTENSIONS = {'mp4', 'avi', 'mkv', 'mov', 'webm', 'flv', 'wmv', 'm4v'}

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(DATA_FOLDER, exist_ok=True)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 5000 * 1024 * 1024  # 5GB max

# Gemini API Configuration
GEMINI_API_KEY = "YOUR_API_KEY"
genai.configure(api_key=GEMINI_API_KEY)
gemini_model = genai.GenerativeModel('gemini-2.5-flash')

# In-memory storage
user_sessions = {}

# MediaPipe setup
mp_hands = mp.solutions.hands
hands = mp_hands.Hands(
    max_num_hands=1,
    min_detection_confidence=0.7,
    min_tracking_confidence=0.7
)
mp_draw = mp.solutions.drawing_utils

# Gesture detection settings
gesture_settings = {
    'cooldown': 0.7,
    'volume_step': 5,
    'brightness_step': 10,
    'enabled': True
}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_user_data_path(user_id):
    return os.path.join(DATA_FOLDER, f'{user_id}.json')

def load_user_data(user_id):
    path = get_user_data_path(user_id)
    if os.path.exists(path):
        with open(path, 'r') as f:
            return json.load(f)
    return {
        'favorites': [],
        'watchlist': [],
        'recentVideos': [],
        'watchProgress': {},
        'chatHistory': []
    }

def save_user_data(user_id, data):
    path = get_user_data_path(user_id)
    with open(path, 'w') as f:
        json.dump(data, f, indent=2)

# FIXED: Enhanced MIME type detection with proper video formats
def get_video_mimetype(filename):
    """Get proper MIME type for video file"""
    ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
    mime_types = {
        'mp4': 'video/mp4',
        'avi': 'video/x-msvideo',
        'mkv': 'video/x-matroska',
        'mov': 'video/quicktime',
        'webm': 'video/webm',
        'flv': 'video/x-flv',
        'wmv': 'video/x-ms-wmv',
        'm4v': 'video/x-m4v'
    }
    mime = mime_types.get(ext, 'video/mp4')
    print(f"File: {filename}, Extension: {ext}, MIME: {mime}")
    return mime

# ==================== Gesture Recognition Model ====================
class GestureDetector:
    """Hand gesture detection using MediaPipe"""
    
    def __init__(self):
        self.last_action_time = {
            "brightness": 0,
            "volume": 0,
            "playpause": 0
        }
        self.cooldown = gesture_settings['cooldown']
    
    def fingers_up(self, hand_landmarks):
        """Determine which fingers are up"""
        tips = [4, 8, 12, 16, 20]
        fingers = []
        
        # Thumb
        fingers.append(1 if hand_landmarks.landmark[tips[0]].x < 
                       hand_landmarks.landmark[tips[0]-1].x else 0)
        
        # Other four fingers
        for i in range(1, 5):
            fingers.append(1 if hand_landmarks.landmark[tips[i]].y < 
                          hand_landmarks.landmark[tips[i]-2].y else 0)
        return fingers
    
    def detect_gesture(self, hand_landmarks):
        """Detect gesture from hand landmarks"""
        fingers = self.fingers_up(hand_landmarks)
        total_fingers = sum(fingers)
        
        gesture_map = {
            0: 'FIST',
            1: 'ONE_FINGER',
            2: 'TWO_FINGERS',
            3: 'THREE_FINGERS',
            4: 'FOUR_FINGERS',
            5: 'OPEN_HAND'
        }
        
        return gesture_map.get(total_fingers, None)
    
    def can_perform_action(self, action):
        """Check if enough time has passed since last action"""
        now = time.time()
        if now - self.last_action_time[action] > self.cooldown:
            self.last_action_time[action] = now
            return True
        return False
    
    def process_frame(self, frame):
        """Process a frame and detect gestures"""
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        result = hands.process(rgb_frame)
        
        detected_gesture = None
        landmark_data = None
        
        if result.multi_hand_landmarks:
            hand = result.multi_hand_landmarks[0]
            detected_gesture = self.detect_gesture(hand)
            
            landmark_data = [
                {'x': lm.x, 'y': lm.y, 'z': lm.z}
                for lm in hand.landmark
            ]
        
        return {
            'gesture': detected_gesture,
            'landmarks': landmark_data,
            'hand_detected': result.multi_hand_landmarks is not None
        }

gesture_detector = GestureDetector()

# ==================== Authentication ====================
@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.json or {}
    user_id = str(uuid.uuid4())
    user_sessions[user_id] = {
        'created_at': datetime.now().isoformat(),
        'last_active': datetime.now().isoformat()
    }
    save_user_data(user_id, {
        'favorites': [],
        'watchlist': [],
        'recentVideos': [],
        'watchProgress': {},
        'chatHistory': []
    })
    return jsonify({'user_id': user_id, 'status': 'success'}), 201

@app.route('/api/auth/session/<user_id>', methods=['GET'])
def check_session(user_id):
    if user_id in user_sessions:
        user_sessions[user_id]['last_active'] = datetime.now().isoformat()
        return jsonify({'valid': True}), 200
    return jsonify({'valid': False}), 401

# ==================== Chatbot API ====================
@app.route('/api/chat/message', methods=['POST', 'OPTIONS'])
def chat_message():
    """Handle chat messages with Gemini AI"""
    if request.method == 'OPTIONS':
        return '', 200
    
    try:
        data = request.json or {}
        message = data.get('message', '')
        current_video = data.get('currentVideo')
        user_id = data.get('user_id')
        
        if not message:
            return jsonify({'error': 'Message is required'}), 400
        
        # Build context for AI
        context = "You are a helpful movie assistant. "
        if current_video:
            context += f"The user is currently watching: {current_video}. "
        context += "Provide helpful, friendly responses about movies, recommendations, and film information."
        
        # Create prompt with context
        full_prompt = f"{context}\n\nUser: {message}\n\nAssistant:"
        
        # Generate response using Gemini
        response = gemini_model.generate_content(full_prompt)
        ai_response = response.text
        
        # Save to chat history if user_id provided
        if user_id:
            user_data = load_user_data(user_id)
            if 'chatHistory' not in user_data:
                user_data['chatHistory'] = []
            
            user_data['chatHistory'].append({
                'timestamp': datetime.now().isoformat(),
                'user_message': message,
                'ai_response': ai_response,
                'current_video': current_video
            })
            
            # Keep only last 50 messages
            user_data['chatHistory'] = user_data['chatHistory'][-50:]
            save_user_data(user_id, user_data)
        
        return jsonify({
            'status': 'success',
            'message': ai_response,
            'timestamp': datetime.now().isoformat()
        }), 200
        
    except Exception as e:
        print(f"Chat error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': 'Sorry, I encountered an error. Please try again.',
            'error': str(e)
        }), 500

@app.route('/api/chat/history/<user_id>', methods=['GET', 'OPTIONS'])
def get_chat_history(user_id):
    """Get chat history for a user"""
    if request.method == 'OPTIONS':
        return '', 200
    
    try:
        user_data = load_user_data(user_id)
        return jsonify({
            'status': 'success',
            'history': user_data.get('chatHistory', [])
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==================== Gesture Recognition API ====================
@app.route('/api/gesture/detect', methods=['POST'])
def detect_gesture():
    """Process frame and detect gesture"""
    try:
        if 'frame' not in request.files:
            return jsonify({'error': 'No frame provided'}), 400
        
        file = request.files['frame']
        file_data = np.frombuffer(file.read(), np.uint8)
        frame = cv2.imdecode(file_data, cv2.IMREAD_COLOR)
        
        if frame is None:
            return jsonify({'error': 'Invalid frame'}), 400
        
        result = gesture_detector.process_frame(frame)
        
        return jsonify({
            'status': 'success',
            'gesture': result['gesture'],
            'hand_detected': result['hand_detected'],
            'landmarks': result['landmarks']
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/gesture/settings', methods=['GET', 'POST', 'OPTIONS'])
def gesture_settings_endpoint():
    """Get or update gesture settings"""
    global gesture_settings, gesture_detector
    
    if request.method == 'OPTIONS':
        return '', 200
    
    if request.method == 'GET':
        return jsonify(gesture_settings), 200
    
    elif request.method == 'POST':
        data = request.json or {}
        
        if 'cooldown' in data:
            gesture_settings['cooldown'] = data['cooldown']
            gesture_detector.cooldown = data['cooldown']
        
        if 'volume_step' in data:
            gesture_settings['volume_step'] = data['volume_step']
        
        if 'brightness_step' in data:
            gesture_settings['brightness_step'] = data['brightness_step']
        
        if 'enabled' in data:
            gesture_settings['enabled'] = data['enabled']
        
        return jsonify({
            'status': 'updated',
            'settings': gesture_settings
        }), 201

@app.route('/api/gesture/process', methods=['POST', 'OPTIONS'])
def process_gesture_action():
    """Process detected gesture and return action"""
    if request.method == 'OPTIONS':
        return '', 200
    
    data = request.json or {}
    gesture = data.get('gesture')
    
    if not gesture_settings['enabled']:
        return jsonify({'action': None}), 200
    
    action_map = {
        'ONE_FINGER': {
            'action': 'brightness_up',
            'step': gesture_settings['brightness_step'],
            'cooldown_key': 'brightness'
        },
        'TWO_FINGERS': {
            'action': 'brightness_down',
            'step': gesture_settings['brightness_step'],
            'cooldown_key': 'brightness'
        },
        'THREE_FINGERS': {
            'action': 'volume_up',
            'step': gesture_settings['volume_step'],
            'cooldown_key': 'volume'
        },
        'FOUR_FINGERS': {
            'action': 'volume_down',
            'step': gesture_settings['volume_step'],
            'cooldown_key': 'volume'
        },
        'OPEN_HAND': {
            'action': 'pause',
            'cooldown_key': 'playpause'
        },
        'FIST': {
            'action': 'play',
            'cooldown_key': 'playpause'
        }
    }
    
    if gesture not in action_map:
        return jsonify({'action': None}), 200
    
    action_info = action_map[gesture]
    cooldown_key = action_info['cooldown_key']
    
    if not gesture_detector.can_perform_action(cooldown_key):
        return jsonify({'action': None, 'reason': 'cooldown'}), 200
    
    return jsonify({
        'action': action_info.get('action'),
        'step': action_info.get('step'),
        'status': 'success'
    }), 200

# ==================== Video Management ====================
@app.route('/api/videos/upload', methods=['POST', 'OPTIONS'])
def upload_videos():
    if request.method == 'OPTIONS':
        return '', 200
    
    user_id = request.form.get('user_id')
    if not user_id:
        return jsonify({'error': 'user_id required'}), 400

    uploaded_files = []
    if 'files' not in request.files:
        return jsonify({'error': 'No files provided'}), 400

    for file in request.files.getlist('files'):
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            video_id = str(uuid.uuid4())
            ext = filename.rsplit('.', 1)[1].lower()
            new_filename = f'{video_id}.{ext}'
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], new_filename)
            
            file.save(filepath)
            uploaded_files.append({
                'id': video_id,
                'name': filename,
                'filename': new_filename,
                'size': os.path.getsize(filepath),
                'uploaded_at': datetime.now().isoformat()
            })

    return jsonify({
        'status': 'success',
        'uploaded': uploaded_files,
        'count': len(uploaded_files)
    }), 201

@app.route('/api/videos/list', methods=['GET', 'OPTIONS'])
def list_videos():
    if request.method == 'OPTIONS':
        return '', 200
    
    videos = []
    if os.path.exists(app.config['UPLOAD_FOLDER']):
        for filename in os.listdir(app.config['UPLOAD_FOLDER']):
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            if os.path.isfile(filepath) and allowed_file(filename):
                video_id = filename.rsplit('.', 1)[0]
                videos.append({
                    'id': video_id,
                    'name': filename,
                    'size': os.path.getsize(filepath),
                    'created_at': datetime.fromtimestamp(os.path.getctime(filepath)).isoformat()
                })
    
    return jsonify({'videos': videos}), 200

# FIXED: Complete video streaming with proper CORS, Range support, and MIME types
@app.route('/api/videos/stream/<video_id>', methods=['GET', 'HEAD', 'OPTIONS'])
def stream_video(video_id):
    """Stream video with range request support and proper CORS headers"""
    # Handle OPTIONS preflight
    if request.method == 'OPTIONS':
        response = make_response('', 200)
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'GET, HEAD, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Range, Content-Type, Accept'
        response.headers['Access-Control-Expose-Headers'] = 'Content-Range, Accept-Ranges, Content-Length'
        return response
    
    # Find the video file
    video_path = None
    video_filename = None
    
    print(f"Looking for video ID: {video_id}")
    
    if os.path.exists(app.config['UPLOAD_FOLDER']):
        for filename in os.listdir(app.config['UPLOAD_FOLDER']):
            if filename.startswith(video_id):
                video_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                video_filename = filename
                print(f"Found video: {video_filename} at {video_path}")
                break
    
    if not video_path or not os.path.exists(video_path):
        print(f"Video not found for ID: {video_id}")
        return jsonify({'error': 'Video not found'}), 404
    
    # Get file size
    file_size = os.path.getsize(video_path)
    print(f"Video size: {file_size} bytes")
    
    # Get MIME type
    mime_type = get_video_mimetype(video_filename)
    
    # Handle HEAD request
    if request.method == 'HEAD':
        response = make_response('', 200)
        response.headers['Content-Type'] = mime_type
        response.headers['Content-Length'] = file_size
        response.headers['Accept-Ranges'] = 'bytes'
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Expose-Headers'] = 'Content-Length, Accept-Ranges, Content-Type'
        return response
    
    # Get range from request headers
    range_header = request.headers.get('Range', None)
    print(f"Range header: {range_header}")
    
    if not range_header:
        # No range requested, send entire file (for small files or initial request)
        print("No range header, sending entire file")
        
        def generate():
            with open(video_path, 'rb') as f:
                while True:
                    chunk = f.read(1024 * 1024)  # 1MB chunks
                    if not chunk:
                        break
                    yield chunk
        
        response = Response(generate(), 
                          status=200,
                          mimetype=mime_type,
                          direct_passthrough=False)
        response.headers['Content-Length'] = file_size
        response.headers['Accept-Ranges'] = 'bytes'
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Expose-Headers'] = 'Content-Length, Accept-Ranges'
        response.headers['Cache-Control'] = 'public, max-age=3600'
        return response
    
    # Parse range header
    byte_start = 0
    byte_end = file_size - 1
    
    try:
        range_match = range_header.replace('bytes=', '').split('-')
        if range_match[0]:
            byte_start = int(range_match[0])
        if range_match[1]:
            byte_end = min(int(range_match[1]), file_size - 1)
    except Exception as e:
        print(f"Error parsing range header: {e}")
        return jsonify({'error': 'Invalid range header'}), 416
    
    # Ensure valid range
    if byte_start > byte_end or byte_start < 0 or byte_end >= file_size:
        print(f"Invalid range: {byte_start}-{byte_end}/{file_size}")
        response = make_response('Range Not Satisfiable', 416)
        response.headers['Content-Range'] = f'bytes */{file_size}'
        response.headers['Access-Control-Allow-Origin'] = '*'
        return response
    
    length = byte_end - byte_start + 1
    print(f"Serving range: {byte_start}-{byte_end}/{file_size} ({length} bytes)")
    
    # Read and return the requested range
    def generate():
        with open(video_path, 'rb') as f:
            f.seek(byte_start)
            remaining = length
            while remaining > 0:
                chunk_size = min(1024 * 1024, remaining)  # 1MB chunks
                chunk = f.read(chunk_size)
                if not chunk:
                    break
                remaining -= len(chunk)
                yield chunk
    
    response = Response(generate(),
                       status=206,
                       mimetype=mime_type,
                       direct_passthrough=False)
    
    response.headers['Content-Range'] = f'bytes {byte_start}-{byte_end}/{file_size}'
    response.headers['Accept-Ranges'] = 'bytes'
    response.headers['Content-Length'] = str(length)
    response.headers['Content-Type'] = mime_type
    response.headers['Cache-Control'] = 'public, max-age=3600'
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Expose-Headers'] = 'Content-Range, Accept-Ranges, Content-Length, Content-Type'
    
    return response

@app.route('/api/videos/delete/<video_id>', methods=['DELETE', 'OPTIONS'])
def delete_video(video_id):
    if request.method == 'OPTIONS':
        return '', 200
    
    if os.path.exists(app.config['UPLOAD_FOLDER']):
        for filename in os.listdir(app.config['UPLOAD_FOLDER']):
            if filename.startswith(video_id):
                filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                os.remove(filepath)
                return jsonify({'status': 'success', 'deleted': filename}), 200
    
    return jsonify({'error': 'Video not found'}), 404

# ==================== User Data Management ====================
@app.route('/api/user/<user_id>/favorites', methods=['GET', 'POST', 'DELETE', 'OPTIONS'])
def manage_favorites(user_id):
    if request.method == 'OPTIONS':
        return '', 200
    
    user_data = load_user_data(user_id)
    
    if request.method == 'GET':
        return jsonify({'favorites': user_data['favorites']}), 200
    
    elif request.method == 'POST':
        data = request.json or {}
        video_id = data.get('video_id')
        if video_id not in user_data['favorites']:
            user_data['favorites'].append(video_id)
            save_user_data(user_id, user_data)
        return jsonify({'status': 'added', 'favorites': user_data['favorites']}), 201
    
    elif request.method == 'DELETE':
        data = request.json or {}
        video_id = data.get('video_id')
        if video_id in user_data['favorites']:
            user_data['favorites'].remove(video_id)
            save_user_data(user_id, user_data)
        return jsonify({'status': 'removed', 'favorites': user_data['favorites']}), 200

@app.route('/api/user/<user_id>/watchlist', methods=['GET', 'POST', 'DELETE', 'OPTIONS'])
def manage_watchlist(user_id):
    if request.method == 'OPTIONS':
        return '', 200
    
    user_data = load_user_data(user_id)
    
    if request.method == 'GET':
        return jsonify({'watchlist': user_data['watchlist']}), 200
    
    elif request.method == 'POST':
        data = request.json or {}
        video_id = data.get('video_id')
        if video_id not in user_data['watchlist']:
            user_data['watchlist'].append(video_id)
            save_user_data(user_id, user_data)
        return jsonify({'status': 'added', 'watchlist': user_data['watchlist']}), 201
    
    elif request.method == 'DELETE':
        data = request.json or {}
        video_id = data.get('video_id')
        if video_id in user_data['watchlist']:
            user_data['watchlist'].remove(video_id)
            save_user_data(user_id, user_data)
        return jsonify({'status': 'removed', 'watchlist': user_data['watchlist']}), 200

@app.route('/api/user/<user_id>/recent', methods=['GET', 'POST', 'OPTIONS'])
def manage_recent(user_id):
    if request.method == 'OPTIONS':
        return '', 200
    
    user_data = load_user_data(user_id)
    
    if request.method == 'GET':
        return jsonify({'recentVideos': user_data['recentVideos']}), 200
    
    elif request.method == 'POST':
        data = request.json or {}
        video_id = data.get('video_id')
        if video_id in user_data['recentVideos']:
            user_data['recentVideos'].remove(video_id)
        user_data['recentVideos'].insert(0, video_id)
        user_data['recentVideos'] = user_data['recentVideos'][:20]
        save_user_data(user_id, user_data)
        return jsonify({'status': 'added', 'recentVideos': user_data['recentVideos']}), 201

@app.route('/api/user/<user_id>/progress', methods=['GET', 'POST', 'OPTIONS'])
def manage_progress(user_id):
    if request.method == 'OPTIONS':
        return '', 200
    
    user_data = load_user_data(user_id)
    
    if request.method == 'GET':
        return jsonify({'watchProgress': user_data['watchProgress']}), 200
    
    elif request.method == 'POST':
        data = request.json or {}
        video_id = data.get('video_id')
        progress = data.get('progress')
        user_data['watchProgress'][video_id] = progress
        save_user_data(user_id, user_data)
        return jsonify({'status': 'updated', 'progress': progress}), 201

@app.route('/api/user/<user_id>/data', methods=['GET', 'POST', 'OPTIONS'])
def manage_user_data(user_id):
    if request.method == 'OPTIONS':
        return '', 200
    
    if request.method == 'GET':
        user_data = load_user_data(user_id)
        return jsonify(user_data), 200
    
    elif request.method == 'POST':
        new_data = request.json or {}
        current_data = load_user_data(user_id)
        current_data.update(new_data)
        save_user_data(user_id, current_data)
        return jsonify({'status': 'saved', 'data': current_data}), 201

# ==================== Statistics ====================
@app.route('/api/user/<user_id>/stats', methods=['GET', 'OPTIONS'])
def get_stats(user_id):
    if request.method == 'OPTIONS':
        return '', 200
    
    user_data = load_user_data(user_id)
    videos = 0
    if os.path.exists(app.config['UPLOAD_FOLDER']):
        videos = len([f for f in os.listdir(app.config['UPLOAD_FOLDER']) 
                     if os.path.isfile(os.path.join(app.config['UPLOAD_FOLDER'], f))])
    watched = len(user_data['watchProgress'])
    
    stats = {
        'totalVideos': videos,
        'totalWatched': watched,
        'totalFavorites': len(user_data['favorites']),
        'watchlistSize': len(user_data['watchlist']),
        'percentageWatched': round((watched / videos * 100) if videos > 0 else 0, 2)
    }
    
    return jsonify(stats), 200

# ==================== Main Route ====================
@app.route('/')
def index():
    return render_template('index.html')

# ==================== Error Handling ====================
@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def server_error(error):
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    print("=" * 60)
    print("CineHome+ Server Starting...")
    print("=" * 60)
    print(f"Upload Folder: {os.path.abspath(UPLOAD_FOLDER)}")
    print(f"Data Folder: {os.path.abspath(DATA_FOLDER)}")
    print("Server running on: http://localhost:5000")
    print("CORS enabled for video streaming")
    print("=" * 60)
    app.run(debug=True, host='0.0.0.0', port=5000, threaded=True)
