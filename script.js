class OmnivueApp {
    constructor() {
        this.cameras = new Map();
        this.activeStreams = new Map();
        this.mediaRecorders = new Map();
        this.recordedChunks = new Map();
        this.recordingTimers = new Map();
        this.cameraRetryAttempts = new Map(); // Track retry attempts per camera
        this.forceAccessMode = false; // Global force access mode
        
        this.elements = {
            scanButton: document.getElementById('scan-cameras'),
            startAllButton: document.getElementById('start-all-cameras'),
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
        this.elements.startAllButton.addEventListener('click', () => this.startAllCameras());
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
                this.elements.startAllButton.disabled = false;
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
    
    async startPreview(cameraId, forceRetry = false) {
        try {
            const camera = this.cameras.get(cameraId);
            const card = this.getCameraCard(cameraId);
            const video = card.querySelector('.camera-video');
            
            this.updateCameraStatus(cameraId, 'active');
            
            // Try multiple constraint configurations for better compatibility
            const constraintSets = this.getConstraintSets(camera.deviceId, forceRetry);
            
            let stream = null;
            let lastError = null;
            
            for (const constraints of constraintSets) {
                try {
                    stream = await navigator.mediaDevices.getUserMedia(constraints);
                    break; // Success, exit loop
                } catch (error) {
                    lastError = error;
                    console.warn(`Failed with constraints:`, constraints, error);
                    
                    // If camera is in use, try force access techniques
                    if (error.name === 'NotReadableError' && !forceRetry) {
                        await this.attemptForceAccess(cameraId);
                        continue;
                    }
                }
            }
            
            if (!stream) {
                throw lastError || new Error('Failed to access camera with all constraint sets');
            }
            
            video.srcObject = stream;
            this.activeStreams.set(cameraId, stream);
            this.updateCameraButtons(cameraId, 'previewing');
            this.cameraRetryAttempts.delete(cameraId); // Reset retry count on success
            
        } catch (error) {
            console.error('Error starting preview:', error);
            await this.handleCameraAccessError(cameraId, error);
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
            case 'retrying':
                // All buttons disabled during retry
                break;
            case 'error':
                buttons.start.disabled = false; // Allow retry
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
        
        // Disable start all button
        this.elements.startAllButton.disabled = true;
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

    getConstraintSets(deviceId, forceRetry = false) {
        const baseConstraints = [
            // High quality constraints
            {
                video: {
                    deviceId: deviceId ? { exact: deviceId } : undefined,
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    frameRate: { ideal: 30 }
                }
            },
            // Medium quality constraints
            {
                video: {
                    deviceId: deviceId ? { ideal: deviceId } : undefined,
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    frameRate: { ideal: 15 }
                }
            },
            // Basic constraints
            {
                video: {
                    deviceId: deviceId ? { ideal: deviceId } : undefined,
                    width: { min: 320 },
                    height: { min: 240 }
                }
            }
        ];

        if (forceRetry || this.forceAccessMode) {
            // Add more aggressive constraints for force access
            baseConstraints.push(
                // Try without specific device ID
                {
                    video: {
                        width: { ideal: 640 },
                        height: { ideal: 480 }
                    }
                },
                // Minimal constraints
                {
                    video: true
                }
            );
        }

        return baseConstraints;
    }

    async attemptForceAccess(cameraId) {
        try {
            // First, try to stop any existing streams that might be blocking
            await this.releaseAllCameraResources();
            
            // Wait a moment for resources to be released
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Try to enumerate devices again to refresh state
            await navigator.mediaDevices.enumerateDevices();
            
            console.log(`Attempting force access for camera ${cameraId}`);
            
        } catch (error) {
            console.warn('Force access preparation failed:', error);
        }
    }

    async releaseAllCameraResources() {
        // Stop all active streams
        this.activeStreams.forEach((stream, cameraId) => {
            stream.getTracks().forEach(track => {
                track.stop();
                console.log(`Stopped track for camera ${cameraId}`);
            });
        });
        
        // Stop all recordings
        this.mediaRecorders.forEach((recorder, cameraId) => {
            if (recorder.state === 'recording') {
                recorder.stop();
                console.log(`Stopped recording for camera ${cameraId}`);
            }
        });
        
        // Clear all data structures
        this.activeStreams.clear();
        this.mediaRecorders.clear();
        
        // Update UI
        this.cameras.forEach((camera, cameraId) => {
            this.updateCameraStatus(cameraId, 'idle');
            this.updateCameraButtons(cameraId, 'idle');
            const card = this.getCameraCard(cameraId);
            if (card) {
                const video = card.querySelector('.camera-video');
                video.srcObject = null;
            }
        });
    }

    async handleCameraAccessError(cameraId, error) {
        const retryAttempts = this.cameraRetryAttempts.get(cameraId) || 0;
        const maxRetries = 3;
        
        if (error.name === 'NotReadableError' && retryAttempts < maxRetries) {
            // Camera is in use - try retry with force access
            this.cameraRetryAttempts.set(cameraId, retryAttempts + 1);
            
            console.log(`Camera ${cameraId} in use, attempting retry ${retryAttempts + 1}/${maxRetries}`);
            
            // Show retry status
            this.updateCameraStatus(cameraId, 'retrying');
            
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Try again with force retry
            await this.startPreview(cameraId, true);
            return;
        }
        
        // If all retries failed or different error, show error and update UI
        this.handleCameraError(error, cameraId);
        this.updateCameraStatus(cameraId, 'error');
        this.updateCameraButtons(cameraId, 'error');
    }
    
    handleCameraError(error, cameraId = null) {
        let message = 'An error occurred while accessing the camera.';
        let showForceOption = false;
        
        if (error.name === 'NotAllowedError') {
            message = 'Camera access was denied. Please allow camera permissions and try again.';
        } else if (error.name === 'NotFoundError') {
            message = 'No camera devices were found on this device.';
        } else if (error.name === 'NotSupportedError') {
            message = 'Camera access is not supported in this browser or context.';
        } else if (error.name === 'NotReadableError') {
            message = `Camera ${cameraId ? `"${this.cameras.get(cameraId)?.label || cameraId}"` : ''} is currently in use by another application. You can try force access mode to override this.`;
            showForceOption = true;
        } else if (error.message) {
            message = error.message;
        }
        
        this.showError(message, showForceOption, cameraId);
    }
    
    showError(message, showForceOption = false, cameraId = null) {
        this.elements.errorMessage.textContent = message;
        
        // Remove any existing force access controls
        const existingForceControls = this.elements.errorModal.querySelector('.force-access-controls');
        if (existingForceControls) {
            existingForceControls.remove();
        }
        
        if (showForceOption) {
            const forceControls = document.createElement('div');
            forceControls.className = 'force-access-controls';
            forceControls.innerHTML = `
                <div class="force-access-section">
                    <h4>🔧 Force Access Options</h4>
                    <p>Try these advanced options to override camera locks:</p>
                    <div class="force-buttons">
                        <button class="force-button" data-action="force-single" ${cameraId ? `data-camera-id="${cameraId}"` : ''}>
                            🎯 Force Access This Camera
                        </button>
                        <button class="force-button" data-action="force-all">
                            🔄 Release All & Retry
                        </button>
                        <button class="force-button" data-action="toggle-force-mode">
                            ${this.forceAccessMode ? '🔒 Disable' : '🔓 Enable'} Force Mode
                        </button>
                    </div>
                </div>
            `;
            
            // Insert before error suggestions
            const errorSuggestions = this.elements.errorModal.querySelector('.error-suggestions');
            if (errorSuggestions) {
                errorSuggestions.parentNode.insertBefore(forceControls, errorSuggestions);
            } else {
                this.elements.errorModal.querySelector('.modal-body').appendChild(forceControls);
            }
            
            // Bind force button events
            this.bindForceAccessEvents(forceControls);
        }
        
        this.elements.errorModal.classList.remove('hidden');
    }
    
    bindForceAccessEvents(forceControls) {
        const buttons = forceControls.querySelectorAll('.force-button');
        
        buttons.forEach(button => {
            button.addEventListener('click', async (e) => {
                e.preventDefault();
                const action = button.getAttribute('data-action');
                const cameraId = button.getAttribute('data-camera-id');
                
                // Add loading state
                button.disabled = true;
                button.style.opacity = '0.6';
                
                try {
                    switch (action) {
                        case 'force-single':
                            if (cameraId) {
                                await this.forceSingleCameraAccess(cameraId);
                            }
                            break;
                        case 'force-all':
                            await this.forceAllCamerasAccess();
                            break;
                        case 'toggle-force-mode':
                            this.toggleForceAccessMode();
                            break;
                    }
                    
                    // Close error modal on success
                    this.hideError();
                    
                } catch (error) {
                    console.error('Force access failed:', error);
                    this.showSuccessMessage('Force access attempt completed. Check camera status.');
                } finally {
                    button.disabled = false;
                    button.style.opacity = '1';
                }
            });
        });
    }

    async forceSingleCameraAccess(cameraId) {
        console.log(`Force accessing camera: ${cameraId}`);
        this.cameraRetryAttempts.delete(cameraId); // Reset retry count
        await this.attemptForceAccess(cameraId);
        await this.startPreview(cameraId, true);
    }

    async forceAllCamerasAccess() {
        console.log('Force accessing all cameras');
        await this.releaseAllCameraResources();
        
        // Clear all retry attempts
        this.cameraRetryAttempts.clear();
        
        // Wait a moment
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Try to start all cameras with force mode
        const promises = Array.from(this.cameras.keys()).map(cameraId => 
            this.startPreview(cameraId, true).catch(error => {
                console.warn(`Failed to force access camera ${cameraId}:`, error);
            })
        );
        
        await Promise.allSettled(promises);
        this.showSuccessMessage('Force access completed for all cameras');
    }

    toggleForceAccessMode() {
        this.forceAccessMode = !this.forceAccessMode;
        const message = this.forceAccessMode 
            ? 'Force Access Mode ENABLED - Cameras will use aggressive access methods'
            : 'Force Access Mode DISABLED - Cameras will use standard access methods';
        
        this.showSuccessMessage(message);
        console.log(message);
    }

    async startAllCameras() {
        if (this.cameras.size === 0) {
            this.showError('No cameras available. Please scan for cameras first.');
            return;
        }

        this.elements.startAllButton.disabled = true;
        this.elements.startAllButton.innerHTML = `
            <span class="button-icon">⏳</span>
            Starting All Cameras...
        `;

        const promises = Array.from(this.cameras.keys()).map(async (cameraId) => {
            // Skip if already active
            const camera = this.cameras.get(cameraId);
            if (camera.status === 'active' || camera.status === 'recording') {
                return;
            }

            try {
                await this.startPreview(cameraId, this.forceAccessMode);
            } catch (error) {
                console.warn(`Failed to start camera ${cameraId}:`, error);
            }
        });

        await Promise.allSettled(promises);

        // Reset button
        this.elements.startAllButton.innerHTML = `
            <span class="button-icon">📹</span>
            Start All Cameras
        `;
        this.elements.startAllButton.disabled = false;

        // Show completion message
        const activeCameras = Array.from(this.cameras.values()).filter(c => c.status === 'active').length;
        this.showSuccessMessage(`Started ${activeCameras} out of ${this.cameras.size} cameras`);
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