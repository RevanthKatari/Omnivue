class OmnivueApp {
    constructor() {
        this.cameras = new Map();
        this.activeStreams = new Map();
        this.mediaRecorders = new Map();
        this.recordedChunks = new Map();
        this.recordingTimers = new Map();
        
        this.elements = {
            scanButton: document.getElementById('scan-cameras'),
            cameraCount: document.getElementById('camera-count'),
            camerasContainer: document.getElementById('cameras-container'),
            noCameras: document.getElementById('no-cameras'),
            loading: document.getElementById('loading'),
            errorModal: document.getElementById('error-modal'),
            errorMessage: document.getElementById('error-message'),
            closeError: document.getElementById('close-error')
        };
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.hideLoading();
        this.checkMediaDevicesSupport();
    }
    
    bindEvents() {
        this.elements.scanButton.addEventListener('click', () => this.scanCameras());
        this.elements.closeError.addEventListener('click', () => this.hideError());
        
        // Close modal when clicking outside
        this.elements.errorModal.addEventListener('click', (e) => {
            if (e.target === this.elements.errorModal) {
                this.hideError();
            }
        });
        
        // Handle page visibility changes to manage resources
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pauseAllStreams();
            } else {
                this.resumeAllStreams();
            }
        });
        
        // Handle orientation changes on mobile
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.handleOrientationChange(), 500);
        });
    }
    
    checkMediaDevicesSupport() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
            this.showError('Your browser does not support camera access. Please use a modern browser like Chrome, Firefox, or Safari.');
            return false;
        }
        
        if (!navigator.mediaDevices.getUserMedia) {
            this.showError('Your browser does not support getUserMedia API. Please update your browser.');
            return false;
        }
        
        if (!window.MediaRecorder) {
            this.showError('Your browser does not support video recording. Please use Chrome, Firefox, or Safari.');
            return false;
        }
        
        return true;
    }
    
    async scanCameras() {
        if (!this.checkMediaDevicesSupport()) return;
        
        this.showLoading();
        this.elements.scanButton.disabled = true;
        
        try {
            // First request permission to access cameras
            await this.requestCameraPermission();
            
            // Get all media devices
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            
            if (videoDevices.length === 0) {
                this.showNoCameras();
                this.updateCameraCount(0);
            } else {
                await this.setupCameras(videoDevices);
                this.updateCameraCount(videoDevices.length);
                this.hideNoCameras();
            }
            
        } catch (error) {
            console.error('Error scanning cameras:', error);
            this.handleCameraError(error);
        } finally {
            this.hideLoading();
            this.elements.scanButton.disabled = false;
        }
    }
    
    async requestCameraPermission() {
        try {
            // Request access to get device labels
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            stream.getTracks().forEach(track => track.stop());
        } catch (error) {
            throw new Error('Camera permission denied or not available');
        }
    }
    
    async setupCameras(videoDevices) {
        // Clear existing cameras
        this.clearCameras();
        
        // Create camera cards for each device
        for (let i = 0; i < videoDevices.length; i++) {
            const device = videoDevices[i];
            const cameraId = device.deviceId || `camera-${i}`;
            
            const cameraData = {
                id: cameraId,
                label: device.label || `Camera ${i + 1}`,
                deviceId: device.deviceId,
                status: 'idle'
            };
            
            this.cameras.set(cameraId, cameraData);
            await this.createCameraCard(cameraData);
        }
    }
    
    async createCameraCard(camera) {
        const card = document.createElement('div');
        card.className = 'camera-card';
        card.setAttribute('data-camera-id', camera.id);
        
        card.innerHTML = `
            <div class="camera-header">
                <h3 class="camera-name">${this.escapeHtml(camera.label)}</h3>
                <span class="camera-status status-idle">Idle</span>
            </div>
            
            <video class="camera-video" playsinline muted autoplay></video>
            
            <div class="camera-controls">
                <button class="control-button start-button" data-action="start">
                    <span>▶️</span> Start Preview
                </button>
                <button class="control-button stop-button" data-action="stop" disabled>
                    <span>⏹️</span> Stop
                </button>
                <button class="control-button start-button" data-action="record" disabled>
                    <span>🔴</span> Record
                </button>
                <button class="control-button stop-button" data-action="stop-record" disabled>
                    <span>⏹️</span> Stop Recording
                </button>
                <button class="control-button download-button" data-action="download" disabled>
                    <span>💾</span> Download
                </button>
            </div>
        `;
        
        this.elements.camerasContainer.appendChild(card);
        
        // Bind events for this camera
        this.bindCameraEvents(camera.id, card);
        
        // Auto-start preview for the first camera on mobile
        if (this.isMobile() && this.cameras.size === 1) {
            setTimeout(() => this.startPreview(camera.id), 500);
        }
    }
    
    bindCameraEvents(cameraId, card) {
        const buttons = card.querySelectorAll('.control-button');
        
        buttons.forEach(button => {
            button.addEventListener('click', async (e) => {
                e.preventDefault();
                const action = button.getAttribute('data-action');
                
                // Add haptic feedback on mobile
                if (this.isMobile() && navigator.vibrate) {
                    navigator.vibrate(50);
                }
                
                switch (action) {
                    case 'start':
                        await this.startPreview(cameraId);
                        break;
                    case 'stop':
                        await this.stopPreview(cameraId);
                        break;
                    case 'record':
                        await this.startRecording(cameraId);
                        break;
                    case 'stop-record':
                        await this.stopRecording(cameraId);
                        break;
                    case 'download':
                        await this.downloadRecording(cameraId);
                        break;
                }
            });
        });
    }
    
    async startPreview(cameraId) {
        try {
            const camera = this.cameras.get(cameraId);
            const card = this.getCameraCard(cameraId);
            const video = card.querySelector('.camera-video');
            
            this.updateCameraStatus(cameraId, 'active');
            
            const constraints = {
                video: {
                    deviceId: camera.deviceId ? { exact: camera.deviceId } : undefined,
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    frameRate: { ideal: 30 }
                }
            };
            
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            video.srcObject = stream;
            
            this.activeStreams.set(cameraId, stream);
            this.updateCameraButtons(cameraId, 'previewing');
            
        } catch (error) {
            console.error('Error starting preview:', error);
            this.handleCameraError(error);
            this.updateCameraStatus(cameraId, 'idle');
        }
    }
    
    async stopPreview(cameraId) {
        const stream = this.activeStreams.get(cameraId);
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            this.activeStreams.delete(cameraId);
        }
        
        const card = this.getCameraCard(cameraId);
        const video = card.querySelector('.camera-video');
        video.srcObject = null;
        
        this.updateCameraStatus(cameraId, 'idle');
        this.updateCameraButtons(cameraId, 'idle');
    }
    
    async startRecording(cameraId) {
        try {
            const stream = this.activeStreams.get(cameraId);
            if (!stream) {
                await this.startPreview(cameraId);
                const newStream = this.activeStreams.get(cameraId);
                if (!newStream) throw new Error('Failed to start camera preview');
            }
            
            const activeStream = this.activeStreams.get(cameraId);
            const options = {
                mimeType: this.getSupportedMimeType(),
                videoBitsPerSecond: 2500000 // 2.5 Mbps for good quality
            };
            
            const mediaRecorder = new MediaRecorder(activeStream, options);
            const chunks = [];
            
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunks.push(event.data);
                }
            };
            
            mediaRecorder.onstop = () => {
                this.recordedChunks.set(cameraId, chunks);
                this.updateCameraButtons(cameraId, 'recorded');
            };
            
            mediaRecorder.start(1000); // Collect data every second
            this.mediaRecorders.set(cameraId, mediaRecorder);
            
            this.updateCameraStatus(cameraId, 'recording');
            this.updateCameraButtons(cameraId, 'recording');
            this.startRecordingTimer(cameraId);
            
        } catch (error) {
            console.error('Error starting recording:', error);
            this.handleCameraError(error);
        }
    }
    
    async stopRecording(cameraId) {
        const mediaRecorder = this.mediaRecorders.get(cameraId);
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
            this.mediaRecorders.delete(cameraId);
        }
        
        this.stopRecordingTimer(cameraId);
        this.updateCameraStatus(cameraId, 'active');
        this.removeRecordingIndicator(cameraId);
    }
    
    async downloadRecording(cameraId) {
        const chunks = this.recordedChunks.get(cameraId);
        if (!chunks || chunks.length === 0) {
            this.showError('No recording available to download');
            return;
        }
        
        const camera = this.cameras.get(cameraId);
        const blob = new Blob(chunks, { type: this.getSupportedMimeType() });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `${camera.label.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
        
        // Show success feedback
        this.showSuccessMessage(`Recording downloaded: ${a.download}`);
    }
    
    getSupportedMimeType() {
        const types = [
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus',
            'video/webm;codecs=h264,opus',
            'video/webm',
            'video/mp4'
        ];
        
        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) {
                return type;
            }
        }
        
        return 'video/webm'; // Fallback
    }
    
    startRecordingTimer(cameraId) {
        const card = this.getCameraCard(cameraId);
        let seconds = 0;
        
        // Add recording indicator
        const indicator = document.createElement('div');
        indicator.className = 'recording-indicator';
        indicator.innerHTML = `
            <div class="recording-dot"></div>
            <span>REC</span>
            <span class="recording-time">00:00</span>
        `;
        
        const video = card.querySelector('.camera-video');
        video.parentNode.insertBefore(indicator, video.nextSibling);
        
        const timer = setInterval(() => {
            seconds++;
            const minutes = Math.floor(seconds / 60);
            const secs = seconds % 60;
            const timeStr = `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            indicator.querySelector('.recording-time').textContent = timeStr;
        }, 1000);
        
        this.recordingTimers.set(cameraId, timer);
    }
    
    stopRecordingTimer(cameraId) {
        const timer = this.recordingTimers.get(cameraId);
        if (timer) {
            clearInterval(timer);
            this.recordingTimers.delete(cameraId);
        }
    }
    
    removeRecordingIndicator(cameraId) {
        const card = this.getCameraCard(cameraId);
        const indicator = card.querySelector('.recording-indicator');
        if (indicator) {
            indicator.remove();
        }
    }
    
    updateCameraStatus(cameraId, status) {
        const camera = this.cameras.get(cameraId);
        if (camera) {
            camera.status = status;
            
            const card = this.getCameraCard(cameraId);
            const statusElement = card.querySelector('.camera-status');
            
            statusElement.className = `camera-status status-${status}`;
            statusElement.textContent = status.charAt(0).toUpperCase() + status.slice(1);
        }
    }
    
    updateCameraButtons(cameraId, state) {
        const card = this.getCameraCard(cameraId);
        const buttons = {
            start: card.querySelector('[data-action="start"]'),
            stop: card.querySelector('[data-action="stop"]'),
            record: card.querySelector('[data-action="record"]'),
            stopRecord: card.querySelector('[data-action="stop-record"]'),
            download: card.querySelector('[data-action="download"]')
        };
        
        // Reset all buttons
        Object.values(buttons).forEach(btn => {
            btn.disabled = true;
        });
        
        switch (state) {
            case 'idle':
                buttons.start.disabled = false;
                break;
            case 'previewing':
                buttons.stop.disabled = false;
                buttons.record.disabled = false;
                break;
            case 'recording':
                buttons.stopRecord.disabled = false;
                break;
            case 'recorded':
                buttons.stop.disabled = false;
                buttons.record.disabled = false;
                buttons.download.disabled = false;
                break;
        }
    }
    
    getCameraCard(cameraId) {
        return document.querySelector(`[data-camera-id="${cameraId}"]`);
    }
    
    updateCameraCount(count) {
        this.elements.cameraCount.textContent = count === 0 
            ? 'No cameras detected' 
            : `${count} camera${count > 1 ? 's' : ''} detected`;
    }
    
    clearCameras() {
        // Stop all active streams
        this.activeStreams.forEach((stream, cameraId) => {
            stream.getTracks().forEach(track => track.stop());
        });
        
        // Clear all timers
        this.recordingTimers.forEach(timer => clearInterval(timer));
        
        // Clear data structures
        this.cameras.clear();
        this.activeStreams.clear();
        this.mediaRecorders.clear();
        this.recordedChunks.clear();
        this.recordingTimers.clear();
        
        // Clear DOM
        this.elements.camerasContainer.innerHTML = '';
    }
    
    pauseAllStreams() {
        this.activeStreams.forEach(stream => {
            stream.getVideoTracks().forEach(track => {
                track.enabled = false;
            });
        });
    }
    
    resumeAllStreams() {
        this.activeStreams.forEach(stream => {
            stream.getVideoTracks().forEach(track => {
                track.enabled = true;
            });
        });
    }
    
    handleOrientationChange() {
        // Refresh video dimensions after orientation change
        this.activeStreams.forEach((stream, cameraId) => {
            const card = this.getCameraCard(cameraId);
            const video = card.querySelector('.camera-video');
            if (video.srcObject) {
                // Force video to recalculate dimensions
                video.style.height = 'auto';
                setTimeout(() => {
                    video.style.height = '';
                }, 100);
            }
        });
    }
    
    handleCameraError(error) {
        let message = 'An error occurred while accessing the camera.';
        
        if (error.name === 'NotAllowedError') {
            message = 'Camera access was denied. Please allow camera permissions and try again.';
        } else if (error.name === 'NotFoundError') {
            message = 'No camera devices were found on this device.';
        } else if (error.name === 'NotSupportedError') {
            message = 'Camera access is not supported in this browser or context.';
        } else if (error.name === 'NotReadableError') {
            message = 'Camera is already in use by another application.';
        } else if (error.message) {
            message = error.message;
        }
        
        this.showError(message);
    }
    
    showError(message) {
        this.elements.errorMessage.textContent = message;
        this.elements.errorModal.classList.remove('hidden');
    }
    
    hideError() {
        this.elements.errorModal.classList.add('hidden');
    }
    
    showLoading() {
        this.elements.loading.classList.remove('hidden');
    }
    
    hideLoading() {
        this.elements.loading.classList.add('hidden');
    }
    
    showNoCameras() {
        this.elements.noCameras.style.display = 'block';
    }
    
    hideNoCameras() {
        this.elements.noCameras.style.display = 'none';
    }
    
    showSuccessMessage(message) {
        // Create a temporary success notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(16, 185, 129, 0.3);
            z-index: 1002;
            font-weight: 500;
            max-width: 300px;
            word-wrap: break-word;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            notification.style.transition = 'all 0.3s ease';
            
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
    
    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               (navigator.maxTouchPoints && navigator.maxTouchPoints > 2);
    }
    
    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.omnivueApp = new OmnivueApp();
});

// Handle PWA installation prompt
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    // Show install button if desired
    console.log('PWA install prompt available');
});

// Service Worker registration for PWA capabilities
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}