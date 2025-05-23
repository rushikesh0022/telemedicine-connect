// Advanced Recording Module for Video Call Application

/**
 * This module provides recording capabilities for the video call application
 * including combined local and remote video/audio recording, cloud storage,
 * and transcription features.
 */

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
   * Start recording
   * @returns {Promise<boolean>} Whether recording was started successfully
   */
  async startRecording() {
    try {
      if (this.isRecording) {
        return true; // Already recording
      }
      
      // Reset recording state
      this.recordedChunks = [];
      
      // Set up combined video canvas
      const videoStream = this.setupCombinedCanvas();
      if (!videoStream) {
        throw new Error("Failed to set up video recording");
      }
      
      // Set up audio mixing
      const mixedAudioTrack = this.setupAudioMixing(
        this.localVideoElement.srcObject,
        this.remoteVideoElement.srcObject
      );
      
      if (!mixedAudioTrack) {
        throw new Error("Failed to set up audio recording");
      }
      
      // Create a new stream with video and mixed audio
      this.recordingStream = new MediaStream([
        videoStream.getVideoTracks()[0],
        mixedAudioTrack
      ]);
      
      // Get supported MIME type
      const mimeType = this.getSupportedMimeType();
      if (!mimeType) {
        throw new Error("No supported recording format found");
      }
      
      // Update recording options with supported MIME type
      this.recordingOptions.mimeType = mimeType;
      
      // Create MediaRecorder
      this.mediaRecorder = new MediaRecorder(
        this.recordingStream,
        this.recordingOptions
      );
      
      // Set up event handlers
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };
      
      this.mediaRecorder.onstop = () => {
        this.stopRecordingTimer();
        this.cleanupRecording();
        
        // Create blob from recorded chunks
        const blob = new Blob(this.recordedChunks, { type: this.recordingOptions.mimeType });
        
        // Call the callback with the recording data
        this.onRecordingData(blob);
        this.onRecordingStop();
      };
      
      this.mediaRecorder.onerror = (event) => {
        this.onRecordingError(new Error(`MediaRecorder error: ${event.error.name}`));
        this.stopRecording();
      };
      
      // Start recording
      this.mediaRecorder.start(1000); // Collect data every second
      this.isRecording = true;
      
      // Show recording indicator
      if (this.recordingIndicator) {
        this.recordingIndicator.style.display = 'flex';
      }
      
      // Start recording timer
      this.startRecordingTimer();
      
      // Call the callback
      this.onRecordingStart();
      
      return true;
    } catch (error) {
      this.onRecordingError(new Error(`Failed to start recording: ${error.message}`));
      this.cleanupRecording();
      return false;
    }
  }
  
  /**
   * Stop recording
   * @returns {Promise<boolean>} Whether recording was stopped successfully
   */
  async stopRecording() {
    try {
      if (!this.isRecording || !this.mediaRecorder) {
        return false;
      }
      
      // Stop MediaRecorder if it's recording
      if (this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }
      
      // Update state
      this.isRecording = false;
      
      // Hide recording indicator
      if (this.recordingIndicator) {
        this.recordingIndicator.style.display = 'none';
      }
      
      return true;
    } catch (error) {
      this.onRecordingError(new Error(`Failed to stop recording: ${error.message}`));
      this.cleanupRecording();
      return false;
    }
  }
  
  /**
   * Clean up recording resources
   */
  cleanupRecording() {
    // Stop all tracks in the recording stream
    if (this.recordingStream) {
      this.recordingStream.getTracks().forEach(track => track.stop());
      this.recordingStream = null;
    }
    
    // Close audio context
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
    
    // Reset canvas
    if (this.canvasStream) {
      this.canvasStream.getTracks().forEach(track => track.stop());
      this.canvasStream = null;
    }
    
    this.audioContext = null;
    this.audioDestination = null;
    this.localAudioSource = null;
    this.remoteAudioSource = null;
    this.mediaRecorder = null;
    this.isRecording = false;
  }
  
  /**
   * Start the recording timer
   */
  startRecordingTimer() {
    this.recordingStartTime = Date.now();
    
    if (this.recordingTimerElement) {
      // Update timer every second
      this.recordingTimerInterval = setInterval(() => {
        const elapsedTime = Date.now() - this.recordingStartTime;
        const formattedTime = this.formatTime(elapsedTime);
        this.recordingTimerElement.textContent = formattedTime;
      }, 1000);
      
      // Initialize timer display
      this.recordingTimerElement.textContent = "00:00";
    }
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
      this.recordingTimerElement.textContent = "00:00";
    }
  }
  
  /**
   * Format milliseconds as MM:SS
   * @param {number} milliseconds Time in milliseconds
   * @returns {string} Formatted time string
   */
  formatTime(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  
  /**
   * Save the recording locally
   * @param {Blob} blob Recording data blob
   * @param {string} filename Optional filename
   */
  saveRecording(blob, filename = null) {
    if (!blob) return;
    
    // Generate filename if not provided
    const defaultFilename = `recording-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
    const downloadFilename = filename || defaultFilename;
    
    // Create download link
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = downloadFilename;
    
    // Trigger download
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }
  
  /**
   * Generate a thumbnail from the recording
   * @param {Blob} recordingBlob Recording data blob
   * @returns {Promise<string>} Data URL for the thumbnail
   */
  async generateThumbnail(recordingBlob) {
    return new Promise((resolve, reject) => {
      try {
        // Create a video element to load the recording
        const video = document.createElement('video');
        video.style.display = 'none';
        video.muted = true;
        video.autoplay = false;
        
        // Set up event handlers
        video.onloadeddata = () => {
          // Create canvas for the thumbnail
          const canvas = document.createElement('canvas');
          canvas.width = 320;  // Thumbnail width
          canvas.height = 180; // Thumbnail height (16:9 ratio)
          
          // Seek to the 2-second mark (or video duration if shorter)
          video.currentTime = Math.min(2, video.duration / 2);
        };
        
        video.onseeked = () => {
          // Draw the current frame to the canvas
          const canvas = document.createElement('canvas');
          canvas.width = 320;
          canvas.height = 180;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          // Convert to data URL
          const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.7);
          
          // Clean up
          video.remove();
          
          resolve(thumbnailUrl);
        };
        
        video.onerror = () => {
          reject(new Error("Failed to load video for thumbnail generation"));
        };
        
        // Set the source and load the video
        video.src = URL.createObjectURL(recordingBlob);
        document.body.appendChild(video);
      } catch (error) {
        reject(error);
      }
    });
  }
  
  /**
   * Upload recording to the server
   * @param {Blob} blob Recording data blob
   * @param {Object} metadata Recording metadata
   * @returns {Promise<Object>} Upload result
   */
  async uploadRecording(blob, metadata = {}) {
    try {
      if (!blob) {
        throw new Error("No recording data to upload");
      }
      
      // Create FormData for the upload
      const formData = new FormData();
      formData.append('recording', blob, `recording-${Date.now()}.webm`);
      
      // Add metadata
      Object.keys(metadata).forEach(key => {
        formData.append(key, metadata[key]);
      });
      
      // Upload to server
      const response = await fetch('/api/recordings/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      this.onRecordingError(new Error(`Failed to upload recording: ${error.message}`));
      throw error;
    }
  }
  
  /**
   * Request transcription for a recording
   * @param {string} recordingId ID of the recording to transcribe
   * @returns {Promise<Object>} Transcription result
   */
  async requestTranscription(recordingId) {
    try {
      if (!recordingId) {
        throw new Error("Recording ID is required for transcription");
      }
      
      // Request transcription from server
      const response = await fetch(`/api/recordings/${recordingId}/transcribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ recordingId }),
      });
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      this.onRecordingError(new Error(`Failed to request transcription: ${error.message}`));
      throw error;
    }
  }
}

// Export the recording manager
export { RecordingManager };
