// Recording Adapter Module
// This module adapts the recording.js class into a proper ES Module

class RecordingManager {
  constructor() {
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.isRecording = false;
    this.recordingStream = null;
    this.recordingStartTime = null;
    this.recordingTimerInterval = null;
    this.recordingTimerCallback = null;
    this.recordingTimerElement = null;
    this.recordingOptions = {
      mimeType: 'video/webm;codecs=vp9,opus',
      audioBitsPerSecond: 128000,
      videoBitsPerSecond: 2500000
    };
    this.audioContext = null;
    this.audioDestination = null;
    this.localAudioSource = null;
    this.remoteAudioSource = null;
    this.videoCanvas = null;
    this.canvasContext = null;
    this.canvasStream = null;
    this.localVideoElement = null;
    this.remoteVideoElement = null;
    this.recordingIndicator = null;
    this.onRecordingStart = null;
    this.onRecordingStop = null;
    this.onRecordingData = null;
    this.onRecordingError = null;
  }

  /**
   * Initialize the recording manager
   * @param {Object} config Configuration object
   * @param {HTMLElement} config.localVideo Local video element
   * @param {HTMLElement} config.remoteVideo Remote video element
   * @param {HTMLElement} config.recordingIndicator Recording indicator element
   * @param {HTMLElement} config.recordingTimer Recording timer element
   * @param {Function} config.onRecordingStart Callback when recording starts
   * @param {Function} config.onRecordingStop Callback when recording stops
   * @param {Function} config.onRecordingData Callback with recording data
   * @param {Function} config.onRecordingError Callback when error occurs
   */
  initialize(config) {
    this.localVideoElement = config.localVideo;
    this.remoteVideoElement = config.remoteVideo;
    this.recordingIndicator = config.recordingIndicator;
    this.recordingTimerElement = config.recordingTimer;
    this.onRecordingStart = config.onRecordingStart || (() => {});
    this.onRecordingStop = config.onRecordingStop || (() => {});
    this.onRecordingData = config.onRecordingData || (() => {});
    this.onRecordingError = config.onRecordingError || ((error) => console.error(error));
    
    // Check if recording is supported
    if (!this.isRecordingSupported()) {
      this.onRecordingError(new Error("Recording is not supported in this browser"));
      return false;
    }
    
    return true;
  }
  
  /**
   * Check if recording is supported in the current browser
   * @returns {boolean} Whether recording is supported
   */
  isRecordingSupported() {
    return (
      typeof MediaRecorder !== 'undefined' &&
      window.AudioContext !== undefined &&
      !!document.createElement('canvas').captureStream
    );
  }
  
  /**
   * Get the best supported MIME type for recording
   * @returns {string} The supported MIME type or null if none
   */
  getSupportedMimeType() {
    const types = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=h264,opus',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm'
    ];
    
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    
    return null;
  }
  
  /**
   * Set up a canvas to combine local and remote video streams
   * @returns {MediaStream} The combined canvas stream
   */
  setupCombinedCanvas() {
    try {
      // Create a canvas element
      this.videoCanvas = document.createElement('canvas');
      this.videoCanvas.width = 1280; // HD width
      this.videoCanvas.height = 720; // HD height
      this.canvasContext = this.videoCanvas.getContext('2d');
      
      // Set up canvas stream
      this.canvasStream = this.videoCanvas.captureStream(30); // 30 FPS
      
      // Start drawing frames
      this.startCombinedVideoRendering();
      
      return this.canvasStream;
    } catch (error) {
      this.onRecordingError(new Error(`Error setting up canvas: ${error.message}`));
      return null;
    }
  }
  
  /**
   * Continuously render both videos to the canvas
   */
  startCombinedVideoRendering() {
    const renderFrame = () => {
      if (!this.isRecording) return;
      
      // Clear canvas
      this.canvasContext.fillStyle = '#000000';
      this.canvasContext.fillRect(0, 0, this.videoCanvas.width, this.videoCanvas.height);
      
      // Calculate dimensions
      const width = this.videoCanvas.width / 2;
      const height = this.videoCanvas.height;
      
      // Draw local video on left side
      if (this.localVideoElement && this.localVideoElement.srcObject) {
        this.canvasContext.drawImage(
          this.localVideoElement, 
          0, 0, width, height
        );
      }
      
      // Draw remote video on right side
      if (this.remoteVideoElement && this.remoteVideoElement.srcObject) {
        this.canvasContext.drawImage(
          this.remoteVideoElement, 
          width, 0, width, height
        );
      }
      
      // Continue rendering
      if (this.isRecording) {
        requestAnimationFrame(renderFrame);
      }
    };
    
    requestAnimationFrame(renderFrame);
  }
  
  /**
   * Set up audio mixing for local and remote audio
   * @param {MediaStream} localStream Local media stream
   * @param {MediaStream} remoteStream Remote media stream
   * @returns {MediaStreamTrack} The mixed audio track
   */
  setupAudioMixing(localStream, remoteStream) {
    try {
      // Create audio context
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.audioDestination = this.audioContext.createMediaStreamDestination();
      
      // Connect local audio if available
      if (localStream && localStream.getAudioTracks().length > 0) {
        this.localAudioSource = this.audioContext.createMediaStreamSource(localStream);
        this.localAudioSource.connect(this.audioDestination);
      }
      
      // Connect remote audio if available
      if (remoteStream && remoteStream.getAudioTracks().length > 0) {
        this.remoteAudioSource = this.audioContext.createMediaStreamSource(remoteStream);
        this.remoteAudioSource.connect(this.audioDestination);
      }
      
      return this.audioDestination.stream.getAudioTracks()[0];
    } catch (error) {
      this.onRecordingError(new Error(`Error setting up audio mixing: ${error.message}`));
      return null;
    }
  }
  
  /**
   * Start recording the video call
   * @param {MediaStream} localStream Local media stream
   * @param {MediaStream} remoteStream Remote media stream
   * @returns {Promise<boolean>} Whether recording started successfully
   */
  async startRecording(localStream, remoteStream) {
    if (this.isRecording) {
      console.warn("Recording already in progress");
      return false;
    }
    
    try {
      // Set up video canvas for combined video
      const videoStream = this.setupCombinedCanvas();
      if (!videoStream) return false;
      
      // Set up audio mixing
      const audioTrack = this.setupAudioMixing(localStream, remoteStream);
      if (!audioTrack) return false;
      
      // Add audio track to video stream
      videoStream.addTrack(audioTrack);
      
      // Get best supported MIME type
      const mimeType = this.getSupportedMimeType();
      if (!mimeType) {
        this.onRecordingError(new Error("No supported recording format found"));
        return false;
      }
      
      // Create options with supported MIME type
      const options = {
        ...this.recordingOptions,
        mimeType
      };
      
      // Create media recorder
      this.recordingStream = videoStream;
      this.mediaRecorder = new MediaRecorder(videoStream, options);
      this.recordedChunks = [];
      
      // Set up event listeners
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };
      
      this.mediaRecorder.onstop = async () => {
        // Create blob from recorded chunks
        const blob = new Blob(this.recordedChunks, { type: mimeType });
        
        // Create thumbnail from last frame
        const thumbnail = await this.generateThumbnail();
        
        // Reset recording state
        this.isRecording = false;
        this.stopRecordingTimer();
        this.recordingStream = null;
        
        // Call stop callback with recording data
        this.onRecordingStop({
          blob,
          type: mimeType,
          size: blob.size,
          duration: Date.now() - this.recordingStartTime,
          thumbnail
        });
        
        // Update UI
        if (this.recordingIndicator) {
          this.recordingIndicator.style.display = 'none';
        }
      };
      
      // Start recording
      this.mediaRecorder.start(1000); // Capture chunks every second
      this.isRecording = true;
      this.recordingStartTime = Date.now();
      
      // Start recording timer
      this.startRecordingTimer();
      
      // Update UI
      if (this.recordingIndicator) {
        this.recordingIndicator.style.display = 'flex';
      }
      
      // Call start callback
      this.onRecordingStart();
      
      return true;
    } catch (error) {
      this.onRecordingError(new Error(`Failed to start recording: ${error.message}`));
      return false;
    }
  }
  
  /**
   * Stop recording
   * @returns {boolean} Whether recording was stopped successfully
   */
  stopRecording() {
    if (!this.isRecording || !this.mediaRecorder) {
      console.warn("No recording in progress");
      return false;
    }
    
    try {
      // Stop media recorder
      this.mediaRecorder.stop();
      
      // Stop all tracks in recording stream
      if (this.recordingStream) {
        this.recordingStream.getTracks().forEach(track => track.stop());
      }
      
      return true;
    } catch (error) {
      this.onRecordingError(new Error(`Failed to stop recording: ${error.message}`));
      return false;
    }
  }
  
  /**
   * Start the recording timer
   */
  startRecordingTimer() {
    if (!this.recordingTimerElement) return;
    
    this.recordingTimerInterval = setInterval(() => {
      const elapsed = Date.now() - this.recordingStartTime;
      const seconds = Math.floor((elapsed / 1000) % 60).toString().padStart(2, '0');
      const minutes = Math.floor((elapsed / (1000 * 60)) % 60).toString().padStart(2, '0');
      const hours = Math.floor(elapsed / (1000 * 60 * 60)).toString().padStart(2, '0');
      
      this.recordingTimerElement.textContent = `${hours}:${minutes}:${seconds}`;
      
      if (this.recordingTimerCallback) {
        this.recordingTimerCallback(elapsed);
      }
    }, 1000);
  }
  
  /**
   * Stop the recording timer
   */
  stopRecordingTimer() {
    if (this.recordingTimerInterval) {
      clearInterval(this.recordingTimerInterval);
      this.recordingTimerInterval = null;
    }
    
    if (this.recordingTimerElement) {
      this.recordingTimerElement.textContent = "00:00:00";
    }
  }
  
  /**
   * Generate a thumbnail from the current video frame
   * @returns {Promise<string>} Data URL of the thumbnail
   */
  async generateThumbnail() {
    if (!this.videoCanvas) return null;
    
    try {
      return this.videoCanvas.toDataURL('image/jpeg', 0.7);
    } catch (error) {
      console.error("Failed to generate thumbnail:", error);
      return null;
    }
  }
  
  /**
   * Upload the recording to the server
   * @param {Blob} blob The recording blob
   * @param {Object} metadata Metadata about the recording
   * @returns {Promise<Object>} The server response
   */
  async uploadRecording(blob, metadata = {}) {
    try {
      // Create form data
      const formData = new FormData();
      formData.append('file', blob, `recording_${Date.now()}.webm`);
      
      // Add metadata
      Object.entries(metadata).forEach(([key, value]) => {
        formData.append(key, value);
      });
      
      // Upload to server
      const response = await fetch('/api/upload-recording', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      this.onRecordingError(new Error(`Failed to upload recording: ${error.message}`));
      throw error;
    }
  }
  
  /**
   * Request transcription for a recording
   * @param {string} recordingId The ID of the uploaded recording
   * @returns {Promise<Object>} The server response
   */
  async requestTranscription(recordingId) {
    try {
      const response = await fetch(`/api/transcribe-recording?id=${recordingId}`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      this.onRecordingError(new Error(`Failed to request transcription: ${error.message}`));
      throw error;
    }
  }
  
  /**
   * Download the recording to the user's device
   * @param {Blob} blob The recording blob
   * @param {string} filename The filename to use
   */
  downloadRecording(blob, filename = `recording_${Date.now()}.webm`) {
    try {
      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      
      // Trigger download
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    } catch (error) {
      this.onRecordingError(new Error(`Failed to download recording: ${error.message}`));
    }
  }
  
  /**
   * Check if recording is currently in progress
   * @returns {boolean} Whether recording is in progress
   */
  isRecordingInProgress() {
    return this.isRecording;
  }
  
  /**
   * Get the current recording duration in milliseconds
   * @returns {number} The recording duration
   */
  getRecordingDuration() {
    if (!this.isRecording || !this.recordingStartTime) {
      return 0;
    }
    
    return Date.now() - this.recordingStartTime;
  }
  
  /**
   * Clean up resources when the recording manager is no longer needed
   */
  cleanup() {
    // Stop recording if in progress
    if (this.isRecording) {
      this.stopRecording();
    }
    
    // Clear timer
    this.stopRecordingTimer();
    
    // Close audio context
    if (this.audioContext) {
      this.audioContext.close().catch(console.error);
    }
  }
}

// Export the recording manager
export { RecordingManager };
