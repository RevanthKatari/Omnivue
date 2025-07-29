# 📹 Omnivue - Multi-Camera Recording Studio

A beautiful, mobile-optimized web application for recording multiple camera feeds simultaneously. Built with modern web technologies and optimized for Chrome on Android.

![Omnivue Interface](https://img.shields.io/badge/Status-Ready-brightgreen) ![Mobile Optimized](https://img.shields.io/badge/Mobile-Optimized-blue) ![PWA Ready](https://img.shields.io/badge/PWA-Ready-purple)

## ✨ Features

### 🎥 Multi-Camera Support
- **Device Detection**: Automatically detects all available camera inputs using `navigator.mediaDevices.enumerateDevices()`
- **Individual Control**: Each camera can be controlled independently
- **Live Preview**: Real-time video preview for each camera before recording

### 📱 Mobile Optimized
- **Responsive Design**: Beautiful UI that adapts to all screen sizes
- **Touch-Friendly**: Large buttons optimized for touch interaction
- **Haptic Feedback**: Vibration feedback on supported mobile devices
- **Orientation Support**: Handles device rotation gracefully

### 🎬 Recording Capabilities
- **Individual Recording**: Start and stop recording for each camera separately
- **High Quality**: Records at up to 1280x720 resolution at 30fps
- **Real-time Indicators**: Visual recording indicators with timer
- **WebM Format**: Saves recordings as .webm files with optimal compression

### 🎨 Beautiful Design
- **Modern UI**: Glassmorphism design with beautiful gradients
- **Smooth Animations**: Fluid transitions and hover effects
- **Dark Mode Support**: Automatic dark mode based on system preference
- **Color Palette**: Carefully selected colors for optimal visual appeal

### 🚀 Advanced Features
- **Resource Management**: Automatically pauses streams when tab is not visible
- **Error Handling**: Comprehensive error messages with helpful suggestions
- **PWA Ready**: Can be installed as a Progressive Web App
- **Performance Optimized**: Efficient memory and battery usage

## 🛠️ Setup Instructions

### Prerequisites
- Modern web browser (Chrome, Firefox, Safari, Edge)
- HTTPS connection (required for camera access)
- Camera permissions allowed

### Installation

1. **Clone or Download**
   ```bash
   git clone <repository-url>
   cd omnivue
   ```

2. **Serve the Files**
   Since camera access requires HTTPS, you need to serve the files through a web server:

   **Option A: Using Python (if installed)**
   ```bash
   # Python 3
   python -m http.server 8000
   
   # Python 2
   python -m SimpleHTTPServer 8000
   ```

   **Option B: Using Node.js (if installed)**
   ```bash
   npx http-server -p 8000
   ```

   **Option C: Using PHP (if installed)**
   ```bash
   php -S localhost:8000
   ```

3. **Access the Application**
   Open your browser and navigate to:
   - `http://localhost:8000` (for local testing)
   - For production, ensure you're using HTTPS

### Mobile Setup

1. **Android Chrome**
   - Enable camera permissions in Chrome settings
   - For best experience, add to home screen for PWA functionality

2. **iOS Safari**
   - Allow camera access when prompted
   - Works in both Safari and Chrome on iOS

## 📖 Usage Guide

### Getting Started

1. **Scan for Cameras**
   - Click the "Scan Cameras" button
   - Allow camera permissions when prompted
   - The app will detect all available cameras

2. **Start Preview**
   - Click "Start Preview" on any camera card
   - The live video feed will appear
   - Camera status will change to "Active"

3. **Record Video**
   - With preview active, click "Record"
   - Recording indicator will appear with timer
   - Click "Stop Recording" when finished

4. **Download Recording**
   - After stopping recording, click "Download"
   - Video file will be saved to your device
   - Files are named with camera name and timestamp

### Tips for Best Results

- **Lighting**: Ensure good lighting for better video quality
- **Stability**: Use a tripod or stable surface for steady footage
- **Storage**: Check available storage space before long recordings
- **Battery**: Keep device charged for extended recording sessions

## 🔧 Technical Details

### Browser Compatibility
- **Chrome**: Full support (recommended)
- **Firefox**: Full support
- **Safari**: Full support (iOS 14.3+)
- **Edge**: Full support

### Supported Video Formats
- WebM with VP9 codec (preferred)
- WebM with VP8 codec
- WebM with H.264 codec
- MP4 (fallback)

### Camera Constraints
- **Resolution**: Up to 1280x720 (720p)
- **Frame Rate**: Up to 30fps
- **Bitrate**: 2.5 Mbps for optimal quality

### Performance Considerations
- **Memory Usage**: Automatically manages streams to prevent memory leaks
- **Battery Optimization**: Pauses streams when app is not visible
- **Resource Cleanup**: Properly releases camera resources when not needed

## 🚨 Troubleshooting

### Camera Access Issues
- **Permission Denied**: Check browser permissions and allow camera access
- **No Cameras Found**: Ensure cameras are connected and not in use by other apps
- **HTTPS Required**: Camera access requires HTTPS in production environments

### Recording Problems
- **No Audio**: App records video only (audio recording can be added if needed)
- **Poor Quality**: Check lighting and camera positioning
- **Large File Sizes**: Recordings are compressed but can still be large for long videos

### Mobile-Specific Issues
- **Orientation**: Rotate device and wait a moment for UI to adjust
- **Background Recording**: Keep app in foreground for uninterrupted recording
- **Storage Full**: Free up device storage space

## 🎯 Browser Requirements

### Minimum Requirements
- **Chrome**: Version 61+
- **Firefox**: Version 55+
- **Safari**: Version 11+
- **Edge**: Version 79+

### Required APIs
- `navigator.mediaDevices.getUserMedia()`
- `navigator.mediaDevices.enumerateDevices()`
- `MediaRecorder API`
- `Blob` and `URL.createObjectURL()`

## 🔒 Privacy & Security

- **Local Processing**: All video processing happens locally on your device
- **No Data Upload**: Videos are not uploaded to any server
- **Camera Access**: Only accesses cameras when explicitly requested
- **Permissions**: Respects browser permission settings

## 📱 PWA Features

- **Installable**: Can be installed as a native app
- **Offline Ready**: Core functionality works offline (camera access requires online)
- **App-like Experience**: Full-screen mode and native app feel

## 🤝 Contributing

Feel free to contribute to this project by:
- Reporting bugs
- Suggesting new features
- Submitting pull requests
- Improving documentation

## 📄 License

This project is open source and available under the MIT License.

---

**Omnivue** - Your multi-camera recording solution for the modern web! 🎬✨