# 🎬 CineHome+ — AI-Powered Personal Cinema

**CineHome+** is an intelligent, locally hosted OTT-style web application that transforms your personal video collection into an interactive streaming experience.  
It features **AI-driven recommendations**, **gesture control**, and **chat-based movie assistance** using **Gemini AI** — all built with **Flask, JavaScript, and MediaPipe**.

---

## 🚀 Features

### 🎞️ Video Management
- Upload, stream, and manage videos from your local folder  
- Continue watching with real-time progress tracking  
- Add videos to favorites or watchlists  
- Resume playback with saved timestamps  

### 🧠 AI Movie Assistant (Gemini Integration)
- Built-in chatbot powered by **Google Gemini AI**  
- Provides recommendations, movie trivia, and summaries  
- Context-aware responses (knows what you’re watching)

### ✋ Gesture Recognition
- **One Finger → Brightness Up**  
- **Two Fingers → Brightness Down**  
- **Three Fingers → Volume Up (+5%)**  
- **Four Fingers → Volume Down (-5%)**  
- **Fist → Play**, **Open Hand → Pause**  
- Uses **MediaPipe Hands + OpenCV**

### 💡 Additional Highlights
- Modern **Netflix-like UI**
- Gesture toggle control
- Responsive sidebar navigation
- Persistent user session system
- Local JSON-based user data storage
- CORS-enabled Flask backend with video streaming support

---

## 🧩 Tech Stack

| Layer | Technology |
|-------|-------------|
| **Frontend** | HTML, CSS, JavaScript |
| **Backend** | Flask (Python) |
| **AI Model** | Google Gemini 2.5 Flash |
| **Vision** | MediaPipe, OpenCV |
| **Storage** | Local JSON for user data |
| **Video** | Flask Range-based video streaming |

---

## 🏗️ Project Structure

```
CineHome+/
│
├── app.py                # Flask backend (API, streaming, gesture, chatbot)
├── index.html            # Frontend interface
├── script.js             # Core frontend logic (API client, video logic)
├── styles.css            # UI design and animations
│
├── videos/               # Folder to store uploaded videos
├── user_data/            # Per-user JSON data
└── static/               # Optional static assets (if used)
```

---

## ⚙️ Installation & Setup

### 1️⃣ Clone the Repository
```bash
git clone https://github.com/<your-username>/CineHomePlus.git
cd CineHomePlus
```

### 2️⃣ Install Dependencies
Make sure you have **Python 3.10+** and **pip** installed.

```bash
pip install flask flask-cors opencv-python mediapipe google-generativeai
```

### 3️⃣ Run the Flask Server
```bash
python app.py
```
> Default: runs on `http://localhost:5000`

### 4️⃣ Open the Frontend
Open **`index.html`** in your browser or serve it via a local web server.

---

## 🔐 Environment Variables

You can replace your **Gemini API key** directly in `app.py`:

```python
GEMINI_API_KEY = "your_api_key_here"
```

Alternatively, you can use an environment variable:
```bash
export GEMINI_API_KEY="your_api_key_here"
```

---

## 🧠 Gesture Control Reference

| Gesture | Action | Cooldown |
|----------|---------|----------|
| ☝️ One Finger | Brightness Up | 0.7s |
| ✌️ Two Fingers | Brightness Down | 0.7s |
| 🤟 Three Fingers | Volume Up | 0.7s |
| ✋ Four Fingers | Volume Down | 0.7s |
| 👊 Fist | Play | 0.7s |
| 🖐️ Open Hand | Pause | 0.7s |

---

## 🗂️ API Endpoints (Highlights)

| Method | Endpoint | Description |
|---------|-----------|-------------|
| `POST` | `/api/auth/register` | Register new session |
| `GET` | `/api/videos/list` | List available videos |
| `GET` | `/api/videos/stream/<id>` | Stream video with Range support |
| `POST` | `/api/chat/message` | Chat with Gemini |
| `POST` | `/api/gesture/detect` | Detect hand gesture from frame |
| `POST` | `/api/gesture/process` | Convert gesture → playback action |

---

## 🧪 Demo (Key Components)

### 🎥 Video Streaming
Flask efficiently handles partial requests (`Range` headers) to enable seamless seeking and buffering for local videos.

### 🤖 Chatbot
The Gemini AI responds to user queries contextually, based on the current video and prior conversation history.

### ✋ Gesture Detection
Real-time webcam feed analyzed by MediaPipe for landmark recognition and gesture mapping.

---

## 🛠️ Future Enhancements
- Multi-user authentication  
- Cloud-based video syncing  
- Advanced movie analytics  
- Integration with IMDb or TMDB APIs  
- Speech-based controls  

---

## 👨‍💻 Author

**Sriram Kannan**  
Machine Learning Developer | AI Innovator  
📧 [your-email@example.com]  
🔗 [GitHub Profile](https://github.com/your-username)

---

## 📝 License
This project is licensed under the **MIT License** — feel free to modify and share.
