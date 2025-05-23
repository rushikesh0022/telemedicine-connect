// File Sharing Module for Video Call Application

// DOM Elements
let fileSharing;
let fileDropZone;
let fileList;
let fileInput;
let closeSharingBtn;
let toggleFileSharingBtn;
let toast;
let toastContainer;
let participantsPanel;
let toggleParticipantsBtn;
let recordingIndicator;
let startRecordingBtn;
let stopRecordingBtn;
let copyMeetingIdBtn;
let meetingIdValue;
let fab;

// Variables
let isRecording = false;
let mediaRecorder;
let recordedChunks = [];
let sharedFiles = [];
let participants = [];
let recorder;

// Initialize the file sharing module
function initFileSharing() {
  // Create DOM elements if they don't exist
  createUI();
  
  // Set up event listeners
  setupEventListeners();
  
  // Initialize participants
  updateParticipantsList();
  
  console.log("File sharing module initialized");
}

// Create necessary UI elements
function createUI() {
  // File sharing panel
  if (!document.querySelector('.file-sharing')) {
    fileSharing = document.createElement('div');
    fileSharing.className = 'file-sharing';
    fileSharing.innerHTML = `
      <div class="file-header">
        <h4>Share Files</h4>
        <button class="close-btn" id="closeSharingBtn">×</button>
      </div>
      <div class="file-drop" id="fileDropZone">
        <svg width="48" height="48" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="17 8 12 3 7 8"></polyline>
          <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
        <p>Drop files here or click to browse</p>
        <input type="file" id="fileInput" multiple style="display:none">
      </div>
      <div class="file-list" id="fileList"></div>
    `;
    document.body.appendChild(fileSharing);
    
    fileDropZone = document.getElementById('fileDropZone');
    fileList = document.getElementById('fileList');
    fileInput = document.getElementById('fileInput');
    closeSharingBtn = document.getElementById('closeSharingBtn');
  }
  
  // Create toast container if it doesn't exist
  if (!document.querySelector('.toast-container')) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }
  
  // Create participants panel if it doesn't exist
  if (!document.querySelector('.participants-panel')) {
    participantsPanel = document.createElement('div');
    participantsPanel.className = 'participants-panel';
    participantsPanel.innerHTML = `
      <div class="panel-header">
        <h3>Participants (0)</h3>
        <button class="close-btn" id="closeParticipantsBtn">×</button>
      </div>
      <div class="participants-list" id="participantsList"></div>
    `;
    document.body.appendChild(participantsPanel);
  }
  
  // Create recording indicator if it doesn't exist
  if (!document.querySelector('.recording-indicator')) {
    recordingIndicator = document.createElement('div');
    recordingIndicator.className = 'recording-indicator';
    recordingIndicator.style.display = 'none';
    recordingIndicator.innerHTML = `
      <div class="recording-dot"></div>
      <span>Recording</span>
      <span id="recordingTime">00:00</span>
    `;
    document.body.appendChild(recordingIndicator);
  }
  
  // Create meeting info UI
  if (!document.querySelector('.meeting-info') && currentRoom) {
    const meetingInfo = document.createElement('div');
    meetingInfo.className = 'meeting-info';
    meetingInfo.innerHTML = `
      <div class="meeting-id">
        <span class="meeting-id-label">Meeting ID:</span>
        <div class="meeting-id-value" id="meetingIdValue">${currentRoom}
          <span class="copy-btn" id="copyMeetingIdBtn">
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </span>
        </div>
      </div>
      <div class="meeting-duration">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        <span id="meetingDuration">00:00:00</span>
      </div>
    `;
    document.querySelector('.main-content').insertBefore(meetingInfo, document.querySelector('.video-container'));
    
    meetingIdValue = document.getElementById('meetingIdValue');
    copyMeetingIdBtn = document.getElementById('copyMeetingIdBtn');
  }
  
  // Create floating action button
  if (!document.querySelector('.fab')) {
    fab = document.createElement('div');
    fab.className = 'fab';
    fab.innerHTML = `
      <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="1"></circle>
        <circle cx="19" cy="12" r="1"></circle>
        <circle cx="5" cy="12" r="1"></circle>
      </svg>
      <div class="fab-menu">
        <div class="fab-item" id="toggleFileSharingBtn">
          <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
          Share Files
        </div>
        <div class="fab-item" id="toggleParticipantsBtn">
          <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
          Participants
        </div>
        <div class="fab-item" id="startRecordingBtn">
          <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10"></circle>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
          Record Meeting
        </div>
      </div>
    `;
    document.body.appendChild(fab);
    
    toggleFileSharingBtn = document.getElementById('toggleFileSharingBtn');
    toggleParticipantsBtn = document.getElementById('toggleParticipantsBtn');
    startRecordingBtn = document.getElementById('startRecordingBtn');
  }
  
  // Add video overlays to video cards
  document.querySelectorAll('.video-card').forEach(card => {
    if (!card.querySelector('.video-overlay')) {
      const overlay = document.createElement('div');
      overlay.className = 'video-overlay';
      
      const videoInfo = document.createElement('div');
      videoInfo.className = 'video-info';
      videoInfo.innerHTML = card.querySelector('.video-label').textContent;
      
      const videoStatus = document.createElement('div');
      videoStatus.className = 'video-status';
      videoStatus.innerHTML = `
        <div class="mic-status">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
            <line x1="12" y1="19" x2="12" y2="23"></line>
            <line x1="8" y1="23" x2="16" y2="23"></line>
          </svg>
        </div>
        <div class="camera-status">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <polygon points="23 7 16 12 23 17 23 7"></polygon>
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
          </svg>
        </div>
      `;
      
      overlay.appendChild(videoInfo);
      overlay.appendChild(videoStatus);
      
      const avatar = document.createElement('div');
      avatar.className = 'participant-avatar';
      avatar.textContent = card.querySelector('.video-label').textContent.charAt(0).toUpperCase();
      
      card.appendChild(overlay);
      card.appendChild(avatar);
    }
  });
}

// Set up event listeners
function setupEventListeners() {
  // File drop zone events
  fileDropZone.addEventListener('click', () => {
    fileInput.click();
  });
  
  fileDropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    fileDropZone.style.borderColor = 'var(--primary-color)';
    fileDropZone.style.background = 'rgba(255, 255, 255, 0.05)';
  });
  
  fileDropZone.addEventListener('dragleave', () => {
    fileDropZone.style.borderColor = 'var(--glass-border)';
    fileDropZone.style.background = 'transparent';
  });
  
  fileDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    fileDropZone.style.borderColor = 'var(--glass-border)';
    fileDropZone.style.background = 'transparent';
    
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  });
  
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      handleFiles(fileInput.files);
    }
  });
  
  // Close buttons
  closeSharingBtn.addEventListener('click', () => {
    fileSharing.classList.remove('active');
  });
  
  document.getElementById('closeParticipantsBtn').addEventListener('click', () => {
    participantsPanel.classList.remove('active');
  });
  
  // Toggle buttons
  toggleFileSharingBtn.addEventListener('click', () => {
    fileSharing.classList.toggle('active');
    fab.classList.remove('active');
  });
  
  toggleParticipantsBtn.addEventListener('click', () => {
    participantsPanel.classList.toggle('active');
    fab.classList.remove('active');
  });
  
  // FAB button
  fab.addEventListener('click', () => {
    fab.classList.toggle('active');
  });
  
  // Recording buttons
  startRecordingBtn.addEventListener('click', () => {
    if (!isRecording) {
      startRecording();
      fab.classList.remove('active');
    } else {
      stopRecording();
    }
  });
  
  // Copy meeting ID
  copyMeetingIdBtn.addEventListener('click', () => {
    copyToClipboard(currentRoom);
    showToast('Meeting ID copied to clipboard', 'info');
  });
  
  // Add socket event listeners for file sharing
  socket.on('file-shared', (data) => {
    showToast(`${data.userName} shared a file: ${data.fileName}`, 'info');
    addSharedFile(data.fileId, data.fileName, data.fileSize, data.userName, false);
  });
}

// Handle file selection
function handleFiles(files) {
  for (const file of files) {
    // Generate unique file ID
    const fileId = generateUniqueId();
    
    // Add to list
    addSharedFile(fileId, file.name, formatFileSize(file.size), userName, true);
    
    // Store file reference
    sharedFiles.push({
      id: fileId,
      file: file,
      name: file.name,
      size: file.size,
      shared: false
    });
    
    // Notify about new file
    socket.emit('file-shared', {
      roomId: currentRoom,
      fileId: fileId,
      fileName: file.name,
      fileSize: formatFileSize(file.size)
    });
  }
}

// Add file to the shared files list
function addSharedFile(id, name, size, owner, isOwner) {
  const fileItem = document.createElement('div');
  fileItem.className = 'file-item';
  fileItem.dataset.fileId = id;
  
  const fileInfo = document.createElement('div');
  fileInfo.className = 'file-info';
  
  // Determine file icon based on extension
  const extension = name.split('.').pop().toLowerCase();
  let iconSvg = '';
  
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) {
    iconSvg = `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
      <circle cx="8.5" cy="8.5" r="1.5"></circle>
      <polyline points="21 15 16 10 5 21"></polyline>
    </svg>`;
  } else if (['mp4', 'webm', 'avi', 'mov'].includes(extension)) {
    iconSvg = `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
      <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
      <line x1="7" y1="2" x2="7" y2="22"></line>
      <line x1="17" y1="2" x2="17" y2="22"></line>
      <line x1="2" y1="12" x2="22" y2="12"></line>
      <line x1="2" y1="7" x2="7" y2="7"></line>
      <line x1="2" y1="17" x2="7" y2="17"></line>
      <line x1="17" y1="17" x2="22" y2="17"></line>
      <line x1="17" y1="7" x2="22" y2="7"></line>
    </svg>`;
  } else if (['pdf'].includes(extension)) {
    iconSvg = `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
      <line x1="16" y1="13" x2="8" y2="13"></line>
      <line x1="16" y1="17" x2="8" y2="17"></line>
      <polyline points="10 9 9 9 8 9"></polyline>
    </svg>`;
  } else {
    iconSvg = `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
      <polyline points="13 2 13 9 20 9"></polyline>
    </svg>`;
  }
  
  fileInfo.innerHTML = `
    <div class="file-icon">${iconSvg}</div>
    <div>
      <div class="file-name">${name}</div>
      <div class="file-size">${size} • ${isOwner ? 'You' : owner}</div>
    </div>
  `;
  
  const fileActions = document.createElement('div');
  fileActions.className = 'file-actions';
  
  if (isOwner) {
    fileActions.innerHTML = `
      <button class="action-icon share-file-btn" data-file-id="${id}" title="Share File">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <circle cx="18" cy="5" r="3"></circle>
          <circle cx="6" cy="12" r="3"></circle>
          <circle cx="18" cy="19" r="3"></circle>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
        </svg>
      </button>
      <button class="action-icon delete-file-btn" data-file-id="${id}" title="Remove File">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      </button>
    `;
  } else {
    fileActions.innerHTML = `
      <button class="action-icon download-file-btn" data-file-id="${id}" title="Download File">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
      </button>
    `;
  }
  
  fileItem.appendChild(fileInfo);
  fileItem.appendChild(fileActions);
  fileList.appendChild(fileItem);
  
  // Add event listeners for file actions
  if (isOwner) {
    fileItem.querySelector('.share-file-btn').addEventListener('click', () => {
      shareFile(id);
    });
    
    fileItem.querySelector('.delete-file-btn').addEventListener('click', () => {
      removeFile(id);
    });
  } else {
    fileItem.querySelector('.download-file-btn').addEventListener('click', () => {
      downloadFile(id);
    });
  }
}

// Share a file with all participants
function shareFile(fileId) {
  const fileObj = sharedFiles.find(f => f.id === fileId);
  if (!fileObj || fileObj.shared) return;
  
  // Mark as shared
  fileObj.shared = true;
  
  // Update UI to show sharing in progress
  const shareBtn = document.querySelector(`.share-file-btn[data-file-id="${fileId}"]`);
  shareBtn.innerHTML = `<div class="loading"></div>`;
  
  // Simulate file sharing (in a real app, you'd upload to a server or use WebRTC data channels)
  setTimeout(() => {
    // Update UI to show shared
    shareBtn.innerHTML = `
      <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
    `;
    shareBtn.style.background = 'var(--secondary-color)';
    
    // Show toast notification
    showToast('File shared with all participants', 'success');
    
    // Notify server
    socket.emit('file-shared-with-all', {
      roomId: currentRoom,
      fileId: fileId
    });
  }, 2000);
}

// Remove a file from the shared list
function removeFile(fileId) {
  // Remove from UI
  const fileItem = document.querySelector(`.file-item[data-file-id="${fileId}"]`);
  if (fileItem) {
    fileItem.remove();
  }
  
  // Remove from local storage
  sharedFiles = sharedFiles.filter(f => f.id !== fileId);
  
  // Notify others
  socket.emit('file-removed', {
    roomId: currentRoom,
    fileId: fileId
  });
}

// Download a shared file
function downloadFile(fileId) {
  // In a real app, this would fetch the file from the server or via WebRTC
  // Here we just simulate a download with a toast notification
  
  const downloadBtn = document.querySelector(`.download-file-btn[data-file-id="${fileId}"]`);
  downloadBtn.innerHTML = `<div class="loading"></div>`;
  
  setTimeout(() => {
    downloadBtn.innerHTML = `
      <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
    `;
    downloadBtn.style.background = 'var(--secondary-color)';
    
    showToast('File downloaded successfully', 'success');
  }, 2000);
}

// Recording functionality
function startRecording() {
  if (!localStream) {
    showToast('Cannot start recording without camera/microphone access', 'error');
    return;
  }
  
  // Set up MediaRecorder with available streams
  const stream = new MediaStream();
  
  // Add local video and audio tracks
  localStream.getTracks().forEach(track => {
    stream.addTrack(track);
  });
  
  // Add remote video and audio if available
  if (remoteVideo.srcObject) {
    remoteVideo.srcObject.getTracks().forEach(track => {
      stream.addTrack(track);
    });
  }
  
  try {
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };
    
    mediaRecorder.onstop = () => {
      // Create blob from recorded chunks
      const blob = new Blob(recordedChunks, { type: 'video/webm' });
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `recording-${new Date().toISOString()}.webm`;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 100);
      
      recordedChunks = [];
      showToast('Recording saved', 'success');
    };
    
    // Start recording
    mediaRecorder.start(1000); // Collect data every second
    
    // Update UI
    isRecording = true;
    recordingIndicator.style.display = 'flex';
    startRecordingBtn.innerHTML = `
      <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <rect x="6" y="6" width="12" height="12"></rect>
      </svg>
      Stop Recording
    `;
    startRecordingBtn.style.background = 'var(--danger-color)';
    
    // Start recording timer
    startRecordingTimer();
    
    // Notify others
    socket.emit('recording-started', {
      roomId: currentRoom
    });
    
    showToast('Recording started', 'info');
    
  } catch (error) {
    console.error('Error starting recording:', error);
    showToast('Could not start recording: ' + error.message, 'error');
  }
}

// Stop recording
function stopRecording() {
  if (mediaRecorder && isRecording) {
    mediaRecorder.stop();
    
    // Update UI
    isRecording = false;
    recordingIndicator.style.display = 'none';
    startRecordingBtn.innerHTML = `
      <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10"></circle>
        <circle cx="12" cy="12" r="3"></circle>
      </svg>
      Record Meeting
    `;
    startRecordingBtn.style.background = '';
    
    // Stop recording timer
    stopRecordingTimer();
    
    // Notify others
    socket.emit('recording-stopped', {
      roomId: currentRoom
    });
  }
}

// Recording timer
let recordingInterval;
let recordingSeconds = 0;

function startRecordingTimer() {
  const recordingTime = document.getElementById('recordingTime');
  recordingSeconds = 0;
  
  recordingInterval = setInterval(() => {
    recordingSeconds++;
    const minutes = Math.floor(recordingSeconds / 60).toString().padStart(2, '0');
    const seconds = (recordingSeconds % 60).toString().padStart(2, '0');
    recordingTime.textContent = `${minutes}:${seconds}`;
  }, 1000);
}

function stopRecordingTimer() {
  clearInterval(recordingInterval);
  recordingSeconds = 0;
  document.getElementById('recordingTime').textContent = '00:00';
}

// Update participants list
function updateParticipantsList() {
  const participantsList = document.getElementById('participantsList');
  const panelHeader = document.querySelector('.panel-header h3');
  
  // Clear current list
  participantsList.innerHTML = '';
  
  // Add local user
  addParticipantToList({
    id: socket.id,
    name: userName,
    isLocal: true
  });
  
  // Add each participant
  participants.forEach(participant => {
    addParticipantToList({
      id: participant.id,
      name: participant.name,
      isLocal: false
    });
  });
  
  // Update count
  panelHeader.textContent = `Participants (${participants.length + 1})`;
}

// Add a participant to the list
function addParticipantToList(participant) {
  const participantsList = document.getElementById('participantsList');
  
  const participantItem = document.createElement('div');
  participantItem.className = 'participant-item';
  participantItem.dataset.participantId = participant.id;
  
  participantItem.innerHTML = `
    <div class="participant-avatar" style="width:36px;height:36px;font-size:1rem;">
      ${participant.name.charAt(0).toUpperCase()}
    </div>
    <div class="participant-info">
      <div class="participant-name">${participant.name} ${participant.isLocal ? '(You)' : ''}</div>
      <div class="participant-role">${participant.isLocal ? 'Host' : 'Participant'}</div>
    </div>
    <div class="participant-controls">
      <button class="action-icon" title="Mute">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
          <line x1="12" y1="19" x2="12" y2="23"></line>
          <line x1="8" y1="23" x2="16" y2="23"></line>
        </svg>
      </button>
    </div>
  `;
  
  participantsList.appendChild(participantItem);
}

// Meeting duration timer
let meetingInterval;
let meetingSeconds = 0;

function startMeetingTimer() {
  const meetingDuration = document.getElementById('meetingDuration');
  meetingSeconds = 0;
  
  meetingInterval = setInterval(() => {
    meetingSeconds++;
    const hours = Math.floor(meetingSeconds / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((meetingSeconds % 3600) / 60).toString().padStart(2, '0');
    const seconds = (meetingSeconds % 60).toString().padStart(2, '0');
    meetingDuration.textContent = `${hours}:${minutes}:${seconds}`;
  }, 1000);
}

// Show toast notification
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  // Get appropriate icon based on type
  let iconSvg = '';
  switch (type) {
    case 'success':
      iconSvg = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>`;
      break;
    case 'error':
      iconSvg = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>`;
      break;
    case 'warning':
      iconSvg = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
        <line x1="12" y1="9" x2="12" y2="13"></line>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
      </svg>`;
      break;
    default: // info
      iconSvg = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
      </svg>`;
  }
  
  toast.innerHTML = `
    <div class="toast-icon">${iconSvg}</div>
    <div class="toast-content">
      <div class="toast-title">${type.charAt(0).toUpperCase() + type.slice(1)}</div>
      <div class="toast-message">${message}</div>
    </div>
    <div class="toast-close">×</div>
  `;
  
  toastContainer.appendChild(toast);
  
  // Close button functionality
  toast.querySelector('.toast-close').addEventListener('click', () => {
    toast.remove();
  });
  
  // Auto remove after 5 seconds
  setTimeout(() => {
    if (toast.parentNode) {
      toast.remove();
    }
  }, 5000);
}

// Helper Functions
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function generateUniqueId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

function copyToClipboard(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', () => {
  // Wait a bit to make sure socket and other elements are initialized
  setTimeout(() => {
    initFileSharing();
    startMeetingTimer();
    
    // Add some particles to the background for enhanced visual effect
    addBackgroundParticles();
  }, 1000);
});

// Add animated particles to the background
function addBackgroundParticles() {
  const mainContent = document.querySelector('.main-content');
  
  for (let i = 0; i < 10; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    
    // Random size between 10px and 40px
    const size = Math.random() * 30 + 10;
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
    
    // Random position within the container
    particle.style.top = `${Math.random() * 100}%`;
    particle.style.left = `${Math.random() * 100}%`;
    
    // Random delay for animation
    particle.style.animationDelay = `${Math.random() * 5}s`;
    
    // Add particle to the container
    mainContent.appendChild(particle);
  }
}

// Socket event handlers for participant management
socket.on('user-joined', user => {
  // Add to participants array if not already there
  if (!participants.some(p => p.id === user.userId)) {
    participants.push({
      id: user.userId,
      name: user.userName
    });
    
    // Update UI
    updateParticipantsList();
    showToast(`${user.userName} joined the meeting`, 'info');
  }
});

socket.on('user-left', user => {
  // Remove from participants array
  participants = participants.filter(p => p.id !== user.userId);
  
  // Update UI
  updateParticipantsList();
  showToast(`${user.userName} left the meeting`, 'info');
});

// Export functionality for use in main script
export { initFileSharing, startRecording, stopRecording };
