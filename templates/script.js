// FIXED API Client - Replace the CineHomeAPI class in your JavaScript file

class CineHomeAPI {
    constructor(baseURL = 'http://localhost:5000') {
        this.baseURL = baseURL;
        this.userId = this.loadUserId();
    }

    async initializeUser() {
        if (!this.userId) {
            try {
                const response = await this.post('/api/auth/register', {});
                this.userId = response.user_id;
                this.saveUserId();
            } catch (error) {
                console.error('Registration error:', error);
                throw error;
            }
        }
        return this.userId;
    }

    loadUserId() {
        return sessionStorage.getItem('cineHome_userId');
    }

    saveUserId() {
        sessionStorage.setItem('cineHome_userId', this.userId);
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const defaultOptions = { 
            headers: { 'Content-Type': 'application/json' },
            mode: 'cors'
        };
        try {
            const response = await fetch(url, { ...defaultOptions, ...options });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            }
            return response;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    async get(endpoint) { 
        return this.request(endpoint, { method: 'GET' }); 
    }
    
    async post(endpoint, data) { 
        return this.request(endpoint, { 
            method: 'POST', 
            body: JSON.stringify(data),
            headers: { 'Content-Type': 'application/json' }
        }); 
    }
    
    async delete(endpoint, data = {}) { 
        return this.request(endpoint, { 
            method: 'DELETE', 
            body: JSON.stringify(data),
            headers: { 'Content-Type': 'application/json' }
        }); 
    }

    async listVideos() { 
        return this.get('/api/videos/list'); 
    }
    
    // CRITICAL FIX: This must return a STRING, not a Promise!
    getVideoUrl(videoId) {
        const cleanVideoId = encodeURIComponent(videoId);
        return `${this.baseURL}/api/videos/stream/${cleanVideoId}`;
    }
    
    async deleteVideo(videoId) { 
        return this.delete(`/api/videos/delete/${videoId}`); 
    }

    async getFavorites() { 
        const data = await this.get(`/api/user/${this.userId}/favorites`); 
        return data.favorites; 
    }
    
    async addFavorite(videoId) { 
        return this.post(`/api/user/${this.userId}/favorites`, { video_id: videoId }); 
    }
    
    async removeFavorite(videoId) { 
        return this.delete(`/api/user/${this.userId}/favorites`, { video_id: videoId }); 
    }

    async getWatchlist() { 
        const data = await this.get(`/api/user/${this.userId}/watchlist`); 
        return data.watchlist; 
    }
    
    async addToWatchlist(videoId) { 
        return this.post(`/api/user/${this.userId}/watchlist`, { video_id: videoId }); 
    }
    
    async removeFromWatchlist(videoId) { 
        return this.delete(`/api/user/${this.userId}/watchlist`, { video_id: videoId }); 
    }

    async getRecentVideos() { 
        const data = await this.get(`/api/user/${this.userId}/recent`); 
        return data.recentVideos; 
    }
    
    async addToRecent(videoId) { 
        return this.post(`/api/user/${this.userId}/recent`, { video_id: videoId }); 
    }

    async getWatchProgress() { 
        const data = await this.get(`/api/user/${this.userId}/progress`); 
        return data.watchProgress; 
    }
    
    async updateWatchProgress(videoId, progress) { 
        return this.post(`/api/user/${this.userId}/progress`, { video_id: videoId, progress }); 
    }

    async getAllUserData() { 
        return this.get(`/api/user/${this.userId}/data`); 
    }
    
    async syncUserData(data) { 
        return this.post(`/api/user/${this.userId}/data`, data); 
    }

    async getStats() { 
        return this.get(`/api/user/${this.userId}/stats`); 
    }

    async detectGesture(canvas) {
        const blob = await new Promise(resolve => canvas.toBlob(resolve));
        const formData = new FormData();
        formData.append('frame', blob);
        const response = await fetch(`${this.baseURL}/api/gesture/detect`, { 
            method: 'POST', 
            body: formData,
            mode: 'cors'
        });
        return await response.json();
    }

    async processGesture(gesture) {
        return this.post('/api/gesture/process', { gesture });
    }

    async getGestureSettings() { 
        return this.get('/api/gesture/settings'); 
    }
    
    async updateGestureSettings(settings) { 
        return this.post('/api/gesture/settings', settings); 
    }

    async chatWithAI(message, currentVideo = null) {
        return this.post('/api/chat/message', { 
            message, 
            currentVideo,
            user_id: this.userId
        });
    }
}

// Initialize the API
const api = new CineHomeAPI();

console.log('✅ Fixed API Client loaded - Video URLs will now be strings!');

// ==================== Global State ====================
let videoDatabase = [];
let favorites = [];
let recentVideos = [];
let watchProgress = {};
let watchlist = [];
let currentCategory = 'all';
let currentVideoIndex = -1;
let filteredVideos = [];
let gesturesEnabled = false;
let cameraStream = null;
let gestureCanvas = null;
let gestureDetectionActive = false;

// ==================== DOM Elements ====================
const elements = {
    sidebar: document.getElementById('sidebar'),
    toggleSidebar: document.getElementById('toggleSidebar'),
    mainContent: document.getElementById('mainContent'),
    navItems: document.querySelectorAll('.nav-item'),
    searchBar: document.getElementById('searchBar'),
    categoryHeader: document.getElementById('categoryHeader'),
    categoryTitle: document.getElementById('categoryTitle'),
    videoCount: document.getElementById('videoCount'),
    emptyState: document.getElementById('emptyState'),
    videoGrid: document.getElementById('videoGrid'),
    noResults: document.getElementById('noResults'),
    videoModal: document.getElementById('videoModal'),
    videoPlayer: document.getElementById('videoPlayer'),
    videoTitle: document.getElementById('videoTitle'),
    closeModal: document.getElementById('closeModal'),
    favoriteBtn: document.getElementById('favoriteBtn'),
    favoriteIcon: document.getElementById('favoriteIcon'),
    prevVideoBtn: document.getElementById('prevVideoBtn'),
    nextVideoBtn: document.getElementById('nextVideoBtn'),
    chatFloatingBtn: document.getElementById('chatFloatingBtn'),
    chatPanel: document.getElementById('chatPanel'),
    closeChatBtn: document.getElementById('closeChatBtn'),
    chatMessages: document.getElementById('chatMessages'),
    chatInput: document.getElementById('chatInput'),
    sendChatBtn: document.getElementById('sendChatBtn'),
    cameraBtn: document.getElementById('cameraBtn'),
    cameraMiniWindow: document.getElementById('cameraMiniWindow'),
    closeCameraMini: document.getElementById('closeCameraMini'),
    cameraFeed: document.getElementById('cameraFeed'),
    cameraCanvas: document.getElementById('cameraCanvas'),
    gestureToggle: document.getElementById('gestureToggle'),
    gestureDetected: document.getElementById('gestureDetected')
};

// ==================== Initialization ====================
async function init() {
    try {
        showNotification('Connecting to server...');
        await api.initializeUser();
        console.log('✅ User ID:', api.userId);
        
        await loadUserData();
        setupEventListeners();
        await loadVideosFromServer();
        
        console.log('✅ CineHome+ initialized successfully!');
    } catch (error) {
        console.error('❌ Initialization error:', error);
        showNotification('Failed to connect to server. Check if Flask is running on http://localhost:5000', 'error');
    }
}

async function loadUserData() {
    try {
        const data = await api.getAllUserData();
        favorites = data.favorites || [];
        watchlist = data.watchlist || [];
        recentVideos = data.recentVideos || [];
        watchProgress = data.watchProgress || {};
        console.log('✅ User data loaded:', { favorites: favorites.length, watchlist: watchlist.length });
    } catch (error) {
        console.error('❌ Error loading user data:', error);
    }
}

// ==================== Event Listeners ====================
function setupEventListeners() {
    elements.toggleSidebar.addEventListener('click', toggleSidebar);
    
    elements.navItems.forEach(item => {
        item.addEventListener('click', () => {
            elements.navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            currentCategory = item.dataset.category;
            updateVideoGrid();
        });
    });
    
    elements.searchBar.addEventListener('input', debounce(handleSearch, 300));
    
    elements.closeModal.addEventListener('click', closeVideoModal);
    elements.videoModal.addEventListener('click', (e) => {
        if (e.target === elements.videoModal) closeVideoModal();
    });
    
    elements.favoriteBtn.addEventListener('click', toggleFavorite);
    elements.prevVideoBtn.addEventListener('click', playPreviousVideo);
    elements.nextVideoBtn.addEventListener('click', playNextVideo);
    
    elements.videoPlayer.addEventListener('timeupdate', updateWatchProgress);
    elements.videoPlayer.addEventListener('ended', handleVideoEnded);
    
    // FIXED: Enhanced video player error handling
    elements.videoPlayer.addEventListener('error', (e) => {
        console.error('❌ Video player error:', e);
        if (elements.videoPlayer.error) {
            console.error('Error details:', {
                code: elements.videoPlayer.error.code,
                message: elements.videoPlayer.error.message
            });
            
            let errorMsg = 'Video playback error: ';
            switch(elements.videoPlayer.error.code) {
                case 1: errorMsg += 'Video loading aborted'; break;
                case 2: errorMsg += 'Network error'; break;
                case 3: errorMsg += 'Video decode error'; break;
                case 4: errorMsg += 'Video format not supported'; break;
                default: errorMsg += 'Unknown error';
            }
            showNotification(errorMsg, 'error');
        }
    });
    
    elements.videoPlayer.addEventListener('loadstart', () => {
        console.log('📹 Video loading started...');
    });
    
    elements.videoPlayer.addEventListener('loadedmetadata', () => {
        console.log('✅ Video metadata loaded');
    });
    
    elements.videoPlayer.addEventListener('canplay', () => {
        console.log('✅ Video ready to play');
    });
    
    elements.chatFloatingBtn.addEventListener('click', toggleChatPanel);
    elements.closeChatBtn.addEventListener('click', toggleChatPanel);
    elements.sendChatBtn.addEventListener('click', sendChatMessage);
    elements.chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatMessage();
    });
    
    elements.cameraBtn.addEventListener('click', toggleCamera);
    elements.closeCameraMini.addEventListener('click', closeCamera);
    elements.gestureToggle.addEventListener('change', toggleGestures);
    
    document.addEventListener('keydown', handleKeyboardShortcuts);
    document.addEventListener('keydown', handleVolume);
}

// ==================== Sidebar ====================
function toggleSidebar() {
    elements.sidebar.classList.toggle('collapsed');
    elements.mainContent.classList.toggle('expanded');
}

// ==================== Video Loading ====================
async function loadVideosFromServer() {
    try {
        console.log('📥 Loading videos from server...');
        const result = await api.listVideos();
        
        videoDatabase = result.videos.map(video => ({
            ...video,
            url: api.getVideoUrl(video.id)
        }));
        
        console.log(`✅ Loaded ${videoDatabase.length} videos`);
        
        if (videoDatabase.length > 0) {
            elements.emptyState.style.display = 'none';
            console.log('📹 Sample video URL:', videoDatabase[0].url);
        }
        
        updateVideoGrid();
    } catch (error) {
        console.error('❌ Error loading videos:', error);
        showNotification('Error loading videos from server', 'error');
    }
}

// ==================== Video Grid ====================
function updateVideoGrid() {
    filteredVideos = getFilteredVideos();
    
    if (videoDatabase.length === 0) {
        elements.emptyState.style.display = 'flex';
        elements.categoryHeader.style.display = 'none';
        elements.videoGrid.style.display = 'none';
        elements.noResults.style.display = 'none';
        return;
    }
    
    elements.emptyState.style.display = 'none';
    elements.categoryHeader.style.display = 'flex';
    
    if (filteredVideos.length === 0) {
        elements.videoGrid.style.display = 'none';
        elements.noResults.style.display = 'block';
        return;
    }
    
    elements.noResults.style.display = 'none';
    elements.videoGrid.style.display = 'grid';
    
    const categoryNames = {
        all: 'All Videos',
        favorites: 'Favorites',
        recent: 'Recently Watched',
        continue: 'Continue Watching',
        watchlist: 'Watchlist'
    };
    elements.categoryTitle.textContent = categoryNames[currentCategory];
    elements.videoCount.textContent = `${filteredVideos.length} video${filteredVideos.length !== 1 ? 's' : ''}`;
    
    elements.videoGrid.innerHTML = filteredVideos.map((video, index) => createVideoCard(video, index)).join('');
    
    document.querySelectorAll('.video-card').forEach((card, index) => {
        card.addEventListener('click', () => playVideo(index));
    });
    
    document.querySelectorAll('.action-btn.favorite').forEach((btn, index) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleVideoFavorite(filteredVideos[index].id);
        });
    });
}

function getFilteredVideos() {
    let videos = [...videoDatabase];
    const searchTerm = elements.searchBar.value.toLowerCase();
    
    switch (currentCategory) {
        case 'favorites':
            videos = videos.filter(v => favorites.includes(v.id));
            break;
        case 'recent':
            videos = videos.filter(v => recentVideos.includes(v.id))
                .sort((a, b) => recentVideos.indexOf(a.id) - recentVideos.indexOf(b.id));
            break;
        case 'continue':
            videos = videos.filter(v => watchProgress[v.id] && watchProgress[v.id] < 95);
            break;
        case 'watchlist':
            videos = videos.filter(v => watchlist.includes(v.id));
            break;
    }
    
    if (searchTerm) {
        videos = videos.filter(v => v.name.toLowerCase().includes(searchTerm));
    }
    
    return videos;
}

function createVideoCard(video) {
    const isFavorite = favorites.includes(video.id);
    const progress = watchProgress[video.id] || 0;
    const showProgress = progress > 0 && progress < 95;
    
    return `
        <div class="video-card">
            <div class="video-thumbnail">
                <span>🎬</span>
                <div class="play-overlay">
                    <span class="play-icon">▶️</span>
                </div>
            </div>
            <div class="video-details">
                <div class="video-title" title="${video.name}">${getDisplayName(video.name)}</div>
                <div class="video-actions">
                    <button class="action-btn favorite ${isFavorite ? 'active' : ''}" title="${isFavorite ? 'Remove from favorites' : 'Add to favorites'}">
                        ${isFavorite ? '❤️' : '🤍'}
                    </button>
                    <button class="action-btn" title="Play">▶️ Play</button>
                </div>
                ${showProgress ? `<div class="progress-bar"><div class="progress-fill" style="width: ${progress}%"></div></div>` : ''}
            </div>
        </div>
    `;
}

function getDisplayName(filename) {
    return filename.replace(/\.[^/.]+$/, '').replace(/[._-]/g, ' ');
}

// ==================== Video Player (FIXED) ====================
function playVideo(index) {
    if (index < 0 || index >= filteredVideos.length) return;
    
    currentVideoIndex = index;
    const video = filteredVideos[index];
    
    console.log('🎬 Playing video:', {
        name: video.name,
        id: video.id,
        url: video.url
    });
    
    // FIXED: Clear previous source and reset player
    elements.videoPlayer.pause();
    elements.videoPlayer.removeAttribute('src');
    elements.videoPlayer.load();
    
    // Set new source with proper attributes
    elements.videoPlayer.src = video.url;
    elements.videoPlayer.setAttribute('type', 'video/mp4');
    elements.videoTitle.textContent = getDisplayName(video.name);
    elements.videoModal.classList.add('active');
    
    // Attempt to play with promise handling
    const playPromise = elements.videoPlayer.play();
    
    if (playPromise !== undefined) {
        playPromise
            .then(() => {
                console.log('✅ Video playback started successfully');
            })
            .catch(err => {
                console.error('❌ Playback error:', err);
                showNotification('Failed to start playback. Trying again...', 'warning');
                
                // Retry after a short delay
                setTimeout(() => {
                    elements.videoPlayer.play().catch(e => {
                        console.error('❌ Retry failed:', e);
                        showNotification('Video playback failed. Check console for details.', 'error');
                    });
                }, 500);
            });
    }
    
    updateFavoriteButton(video.id);
    addToRecent(video.id);
    
    // Restore watch progress
    if (watchProgress[video.id]) {
        elements.videoPlayer.addEventListener('loadedmetadata', function restoreProgress() {
            const duration = elements.videoPlayer.duration;
            if (duration && !isNaN(duration) && duration > 0) {
                const time = (watchProgress[video.id] / 100) * duration;
                elements.videoPlayer.currentTime = time;
                console.log(`⏩ Restored progress: ${watchProgress[video.id]}% (${time.toFixed(1)}s)`);
            }
            elements.videoPlayer.removeEventListener('loadedmetadata', restoreProgress);
        });
    }
    
    document.body.style.overflow = 'hidden';
}

function closeVideoModal() {
    elements.videoModal.classList.remove('active');
    elements.videoPlayer.pause();
    elements.videoPlayer.removeAttribute('src');
    elements.videoPlayer.load();
    currentVideoIndex = -1;
    closeCamera();
    document.body.style.overflow = 'auto';
    console.log('🔒 Video modal closed');
}

function playNextVideo() {
    if (currentVideoIndex < filteredVideos.length - 1) {
        playVideo(currentVideoIndex + 1);
    } else {
        showNotification('No more videos in queue');
    }
}

function playPreviousVideo() {
    if (currentVideoIndex > 0) {
        playVideo(currentVideoIndex - 1);
    } else {
        showNotification('This is the first video');
    }
}

function handleVideoEnded() {
    console.log('🎬 Video ended');
    if (currentVideoIndex < filteredVideos.length - 1) {
        showNotification('Playing next video in 2 seconds...');
        setTimeout(() => playNextVideo(), 2000);
    } else {
        showNotification('Playlist ended');
    }
}

// ==================== Favorites ====================
async function toggleFavorite() {
    if (currentVideoIndex === -1) return;
    const video = filteredVideos[currentVideoIndex];
    await toggleVideoFavorite(video.id);
}

async function toggleVideoFavorite(videoId) {
    try {
        const index = favorites.indexOf(videoId);
        if (index > -1) {
            favorites.splice(index, 1);
            await api.removeFavorite(videoId);
            showNotification('Removed from favorites');
        } else {
            favorites.push(videoId);
            await api.addFavorite(videoId);
            showNotification('Added to favorites');
        }
        updateFavoriteButton(videoId);
        updateVideoGrid();
    } catch (error) {
        console.error('❌ Error toggling favorite:', error);
        showNotification('Error updating favorite', 'error');
    }
}

function updateFavoriteButton(videoId) {
    const isFavorite = favorites.includes(videoId);
    elements.favoriteIcon.textContent = isFavorite ? '❤️' : '🤍';
    elements.favoriteBtn.classList.toggle('active', isFavorite);
}

// ==================== Watch Progress ====================
async function updateWatchProgress() {
    if (currentVideoIndex === -1) return;
    const video = filteredVideos[currentVideoIndex];
    const progress = (elements.videoPlayer.currentTime / elements.videoPlayer.duration) * 100;
    
    if (!isNaN(progress) && isFinite(progress)) {
        watchProgress[video.id] = Math.round(progress);
        try {
            await api.updateWatchProgress(video.id, Math.round(progress));
        } catch (error) {
            console.error('❌ Error updating progress:', error);
        }
    }
}

async function addToRecent(videoId) {
    try {
        const index = recentVideos.indexOf(videoId);
        if (index > -1) recentVideos.splice(index, 1);
        recentVideos.unshift(videoId);
        recentVideos = recentVideos.slice(0, 20);
        await api.addToRecent(videoId);
    } catch (error) {
        console.error('❌ Error adding to recent:', error);
    }
}

// ==================== Search ====================
function handleSearch() {
    updateVideoGrid();
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ==================== Chatbot ====================
function toggleChatPanel() {
    elements.chatPanel.classList.toggle('active');
    elements.chatFloatingBtn.classList.toggle('active');
    
    if (elements.chatPanel.classList.contains('active')) {
        elements.chatInput.focus();
    }
}

async function sendChatMessage() {
    const message = elements.chatInput.value.trim();
    if (!message) return;
    
    addUserMessage(message);
    elements.chatInput.value = '';
    
    const typingId = addBotMessage('Thinking...');
    
    try {
        let currentVideo = null;
        if (currentVideoIndex !== -1) {
            const video = filteredVideos[currentVideoIndex];
            currentVideo = getDisplayName(video.name);
        }
        
        const response = await api.chatWithAI(message, currentVideo);
        removeBotMessage(typingId);
        addBotMessage(response.message || response.response || 'Sorry, I could not process your request.');
    } catch (error) {
        removeBotMessage(typingId);
        addBotMessage('Sorry, I encountered an error. Please try again later.');
        console.error('❌ Chat API Error:', error);
    }
}

function addUserMessage(message) {
    const messageEl = document.createElement('div');
    messageEl.className = 'chat-message user';
    messageEl.innerHTML = `<div class="message-content">${escapeHtml(message)}</div>`;
    elements.chatMessages.appendChild(messageEl);
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

function addBotMessage(message) {
    const messageEl = document.createElement('div');
    messageEl.className = 'chat-message bot';
    const id = Date.now();
    messageEl.dataset.id = id;
    messageEl.innerHTML = `<div class="message-content">${escapeHtml(message)}</div>`;
    elements.chatMessages.appendChild(messageEl);
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
    return id;
}

function removeBotMessage(id) {
    const messageEl = elements.chatMessages.querySelector(`[data-id="${id}"]`);
    if (messageEl) messageEl.remove();
}

// ==================== Camera & Gesture ====================
async function toggleCamera() {
    if (elements.cameraMiniWindow.classList.contains('active')) {
        closeCamera();
    } else {
        await startCamera();
    }
}

async function startCamera() {
    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        elements.cameraFeed.srcObject = cameraStream;
        elements.cameraMiniWindow.classList.add('active');
        elements.cameraBtn.classList.add('active');
        
        if (gesturesEnabled) {
            gestureCanvas = document.createElement('canvas');
            gestureCanvas.width = elements.cameraFeed.videoWidth || 640;
            gestureCanvas.height = elements.cameraFeed.videoHeight || 480;
            startGestureDetection();
        }
        
        showNotification('Camera started successfully!');
    } catch (error) {
        console.error('❌ Camera error:', error);
        showNotification('Failed to access camera', 'error');
    }
}

function closeCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        elements.cameraFeed.srcObject = null;
    }
    
    gestureDetectionActive = false;
    elements.cameraMiniWindow.classList.remove('active');
    elements.cameraBtn.classList.remove('active');
    elements.gestureDetected.textContent = 'No gesture';
}

function toggleGestures() {
    gesturesEnabled = elements.gestureToggle.checked;
    sessionStorage.setItem('gesturesEnabled', gesturesEnabled);
    
    if (gesturesEnabled && cameraStream) {
        gestureCanvas = document.createElement('canvas');
        startGestureDetection();
    } else {
        gestureDetectionActive = false;
    }
    
    showNotification(gesturesEnabled ? 'Gesture controls enabled' : 'Gesture controls disabled');
}

function startGestureDetection() {
    gestureDetectionActive = true;
    
    const detectFrame = async () => {
        if (!gestureDetectionActive || elements.cameraFeed.readyState !== elements.cameraFeed.HAVE_ENOUGH_DATA) {
            if (gestureDetectionActive) requestAnimationFrame(detectFrame);
            return;
        }
        
        const ctx = gestureCanvas.getContext('2d');
        ctx.drawImage(elements.cameraFeed, 0, 0, gestureCanvas.width, gestureCanvas.height);
        
        try {
            const result = await api.detectGesture(gestureCanvas);
            
            if (result.gesture) {
                elements.gestureDetected.textContent = `Detected: ${result.gesture}`;
                const action = await api.processGesture(result.gesture);
                
                if (action.action) {
                    handleGestureAction(action.action, action.step);
                }
            }
        } catch (error) {
            console.error('❌ Gesture detection error:', error);
        }
        
        if (gestureDetectionActive) requestAnimationFrame(detectFrame);
    };
    
    requestAnimationFrame(detectFrame);
}

function handleGestureAction(action, step) {
    if (!elements.videoModal.classList.contains('active')) return;
    
    switch (action) {
        case 'play':
            elements.videoPlayer.play();
            showNotification('▶️ Playing');
            break;
        case 'pause':
            elements.videoPlayer.pause();
            showNotification('⏸️ Paused');
            break;
        case 'volume_up':
            elements.videoPlayer.volume = Math.min(1, elements.videoPlayer.volume + 0.1);
            showNotification(`🔊 Volume: ${Math.round(elements.videoPlayer.volume * 100)}%`);
            break;
        case 'volume_down':
            elements.videoPlayer.volume = Math.max(0, elements.videoPlayer.volume - 0.1);
            showNotification(`🔉 Volume: ${Math.round(elements.videoPlayer.volume * 100)}%`);
            break;
        case 'next':
            playNextVideo();
            break;
        case 'previous':
            playPreviousVideo();
            break;
    }
}

// ==================== Keyboard Shortcuts ====================
function handleKeyboardShortcuts(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    if (elements.videoModal.classList.contains('active')) {
        switch (e.key) {
            case 'Escape':
                closeVideoModal();
                break;
            case ' ':
                e.preventDefault();
                elements.videoPlayer.paused ? elements.videoPlayer.play() : elements.videoPlayer.pause();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                elements.videoPlayer.currentTime -= 10;
                showNotification('⏪ -10s');
                break;
            case 'ArrowRight':
                e.preventDefault();
                elements.videoPlayer.currentTime += 10;
                showNotification('⏩ +10s');
                break;
            case 'f':
            case 'F':
                toggleFavorite();
                break;
            case 'n':
            case 'N':
                playNextVideo();
                break;
            case 'p':
            case 'P':
                playPreviousVideo();
                break;
            case 'i':
            case 'I':
                togglePictureInPicture();
                break;
            case 'm':
            case 'M':
                elements.videoPlayer.muted = !elements.videoPlayer.muted;
                showNotification(elements.videoPlayer.muted ? '🔇 Muted' : '🔊 Unmuted');
                break;
            case 'c':
            case 'C':
                toggleCamera();
                break;
        }
    }
    
    if (e.key === '/') {
        e.preventDefault();
        elements.searchBar.focus();
    }
}

function handleVolume(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (!elements.videoModal.classList.contains('active')) return;
    
    if (e.key === 'ArrowUp') {
        e.preventDefault();
        elements.videoPlayer.volume = Math.min(1, elements.videoPlayer.volume + 0.1);
        showNotification(`🔊 Volume: ${Math.round(elements.videoPlayer.volume * 100)}%`);
    } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        elements.videoPlayer.volume = Math.max(0, elements.videoPlayer.volume - 0.1);
        showNotification(`🔉 Volume: ${Math.round(elements.videoPlayer.volume * 100)}%`);
    }
}

function togglePictureInPicture() {
    if (document.pictureInPictureElement) {
        document.exitPictureInPicture();
    } else if (document.pictureInPictureEnabled) {
        elements.videoPlayer.requestPictureInPicture()
            .then(() => showNotification('📺 Picture-in-Picture enabled'))
            .catch(err => {
                console.error('❌ PiP error:', err);
                showNotification('Picture-in-Picture not supported', 'error');
            });
    }
}

// ==================== Utility Functions ====================
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showNotification(message, type = 'success') {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 2rem;
        right: 2rem;
        background: ${type === 'error' ? '#dc3545' : type === 'warning' ? '#ffc107' : '#28a745'};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        animation: slideIn 0.3s ease;
        font-family: Arial, sans-serif;
        max-width: 300px;
        word-wrap: break-word;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

async function toggleWatchlist(videoId) {
    try {
        const index = watchlist.indexOf(videoId);
        if (index > -1) {
            watchlist.splice(index, 1);
            await api.removeFromWatchlist(videoId);
            showNotification('Removed from watchlist');
        } else {
            watchlist.push(videoId);
            await api.addToWatchlist(videoId);
            showNotification('Added to watchlist');
        }
        updateVideoGrid();
    } catch (error) {
        console.error('❌ Error toggling watchlist:', error);
        showNotification('Error updating watchlist', 'error');
    }
}

// ==================== Debug Functions ====================
window.debugCineHome = {
    testVideoUrl: async (videoId) => {
        const url = api.getVideoUrl(videoId);
        console.log('🔍 Testing video URL:', url);
        
        try {
            const response = await fetch(url, {
                method: 'HEAD',
                mode: 'cors'
            });
            console.log('✅ Video URL test response:', {
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries())
            });
            return response.ok;
        } catch (error) {
            console.error('❌ Video URL test failed:', error);
            return false;
        }
    },
    
    listAllVideos: () => {
        console.log('📹 All videos in database:', videoDatabase);
        return videoDatabase;
    },
    
    getCurrentVideo: () => {
        if (currentVideoIndex >= 0) {
            const video = filteredVideos[currentVideoIndex];
            console.log('🎬 Current video:', video);
            return video;
        }
        console.log('❌ No video currently playing');
        return null;
    },
    
    testVideoPlayback: async (index = 0) => {
        if (videoDatabase.length === 0) {
            console.error('❌ No videos in database');
            return;
        }
        console.log('🎬 Testing video playback for index:', index);
        playVideo(index);
    },
    
    checkServerConnection: async () => {
        try {
            const response = await fetch('http://localhost:5000/api/videos/list', {
                method: 'GET',
                mode: 'cors'
            });
            console.log('✅ Server connection:', response.ok ? 'SUCCESS' : 'FAILED');
            const data = await response.json();
            console.log('📊 Server response:', data);
            return response.ok;
        } catch (error) {
            console.error('❌ Server connection failed:', error);
            return false;
        }
    },
    
    getUserData: () => {
        console.log('👤 User data:', {
            userId: api.userId,
            favorites: favorites,
            watchlist: watchlist,
            recentVideos: recentVideos,
            watchProgress: watchProgress
        });
        return {
            userId: api.userId,
            favorites,
            watchlist,
            recentVideos,
            watchProgress
        };
    }
};

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

console.log('🎬 CineHome+ Frontend Loaded!');
console.log('📝 Debug commands available via window.debugCineHome');
console.log('');
console.log('⌨️  Keyboard Shortcuts:');
console.log('   Space    : Play/Pause');
console.log('   ←/→      : Seek -10s/+10s');
console.log('   ↑/↓      : Volume Up/Down');
console.log('   F        : Toggle Favorite');
console.log('   N        : Next Video');
console.log('   P        : Previous Video');
console.log('   M        : Mute/Unmute');
console.log('   I        : Picture-in-Picture');
console.log('   C        : Toggle Camera');
console.log('   /        : Search');
console.log('   Esc      : Close Player');
console.log('');
console.log('🔧 Debug Commands:');
console.log('   window.debugCineHome.checkServerConnection()');
console.log('   window.debugCineHome.listAllVideos()');
console.log('   window.debugCineHome.getCurrentVideo()');
console.log('   window.debugCineHome.testVideoPlayback(0)');
console.log('   window.debugCineHome.testVideoUrl("VIDEO_ID")');
console.log('   window.debugCineHome.getUserData()');