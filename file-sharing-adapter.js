// File Sharing Adapter Module
// This module extends the file-sharing.js with encryption capabilities

import { initFileSharing as originalInitFileSharing } from './file-sharing.js';

// Variables to store encryption manager reference
let encryptionManager = null;
let socket = null;
let currentRoom = null;

/**
 * Initialize file sharing with encryption support
 * @param {Object} config Configuration for file sharing
 * @param {Object} config.encryptionManager The encryption manager instance
 * @param {Object} config.socket The socket.io instance
 * @param {string} config.roomId The current room ID
 */
function initFileSharing(config = {}) {
  // Initialize the original file sharing module
  originalInitFileSharing();
  
  // Store references
  if (config.encryptionManager) {
    encryptionManager = config.encryptionManager;
  }
  
  if (config.socket) {
    socket = config.socket;
  }
  
  if (config.roomId) {
    currentRoom = config.roomId;
  }
  
  // Setup file sharing socket events
  if (socket) {
    setupFileTransferEvents();
  }
  
  console.log("Enhanced file sharing with encryption initialized");
}

/**
 * Setup socket events for encrypted file transfer
 */
function setupFileTransferEvents() {
  // Handle incoming file transfers
  socket.on('file-transfer', async (data) => {
    try {
      if (data.encrypted && encryptionManager && encryptionManager.secureChannelEstablished) {
        // Decrypt file information
        const fileInfo = JSON.parse(await encryptionManager.decryptMessage(data.fileInfo));
        
        // Create a file object from the base64 data
        const byteCharacters = atob(data.fileData);
        const byteArrays = [];
        
        for (let offset = 0; offset < byteCharacters.length; offset += 512) {
          const slice = byteCharacters.slice(offset, offset + 512);
          
          const byteNumbers = new Array(slice.length);
          for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
          }
          
          const byteArray = new Uint8Array(byteNumbers);
          byteArrays.push(byteArray);
        }
        
        // Create encrypted file blob
        const encryptedFile = new File(
          byteArrays,
          fileInfo.name + '.encrypted', 
          { type: 'application/octet-stream' }
        );
        
        // Decrypt the file
        const decryptedFile = await encryptionManager.decryptFile(
          encryptedFile,
          fileInfo.type,
          fileInfo.name
        );
        
        // Add to shared files list
        addReceivedFile(decryptedFile, data.sender);
        
        // Show notification
        showFileNotification(data.sender, fileInfo.name, 'received');
      } else {
        // Handle unencrypted file
        const byteCharacters = atob(data.fileData);
        const byteArrays = [];
        
        for (let offset = 0; offset < byteCharacters.length; offset += 512) {
          const slice = byteCharacters.slice(offset, offset + 512);
          
          const byteNumbers = new Array(slice.length);
          for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
          }
          
          const byteArray = new Uint8Array(byteNumbers);
          byteArrays.push(byteArray);
        }
        
        // Create file blob
        const fileBlob = new Blob(byteArrays, { type: data.fileType });
        const file = new File([fileBlob], data.fileName, { type: data.fileType });
        
        // Add to shared files list
        addReceivedFile(file, data.sender);
        
        // Show notification
        showFileNotification(data.sender, data.fileName, 'received');
      }
    } catch (error) {
      console.error('Error handling file transfer:', error);
      if (window.showToast) {
        window.showToast('Error receiving file: ' + error.message, 'error');
      }
    }
  });
}

/**
 * Send a file with encryption if available
 * @param {File} file The file to send
 * @param {string} recipientId The recipient ID (or null for broadcast)
 */
async function sendFile(file, recipientId = null) {
  if (!socket || !currentRoom) {
    console.error('Socket or room ID not available');
    return false;
  }
  
  try {
    // Check if we can encrypt
    if (encryptionManager && encryptionManager.secureChannelEstablished) {
      // Encrypt the file
      const encryptedFileData = await encryptionManager.encryptFile(file);
      
      // Read encrypted file as base64
      const fileReader = new FileReader();
      const fileDataPromise = new Promise((resolve, reject) => {
        fileReader.onload = () => resolve(fileReader.result);
        fileReader.onerror = reject;
        fileReader.readAsDataURL(encryptedFileData.encryptedFile);
      });
      
      const fileData = await fileDataPromise;
      const base64Data = fileData.split(',')[1]; // Remove data URL prefix
      
      // Encrypt file metadata
      const fileInfo = {
        name: encryptedFileData.originalName,
        type: encryptedFileData.originalType,
        size: file.size
      };
      
      const encryptedFileInfo = await encryptionManager.encryptMessage(JSON.stringify(fileInfo));
      
      // Send encrypted file
      socket.emit('file-transfer', {
        fileData: base64Data,
        fileInfo: encryptedFileInfo,
        encrypted: true,
        roomId: currentRoom,
        target: recipientId
      });
      
      // Show notification
      if (window.showToast) {
        window.showToast('Encrypted file sent', 'success');
      }
    } else {
      // Send unencrypted file
      const fileReader = new FileReader();
      fileReader.onload = () => {
        const fileData = fileReader.result;
        const base64Data = fileData.split(',')[1]; // Remove data URL prefix
        
        socket.emit('file-transfer', {
          fileData: base64Data,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          encrypted: false,
          roomId: currentRoom,
          target: recipientId
        });
      };
      
      fileReader.readAsDataURL(file);
      
      // Show notification
      if (window.showToast) {
        window.showToast('File sent (unencrypted)', 'info');
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error sending file:', error);
    if (window.showToast) {
      window.showToast('Error sending file: ' + error.message, 'error');
    }
    return false;
  }
}

/**
 * Add a received file to the file list
 * @param {File} file The received file
 * @param {string} sender The sender name
 */
function addReceivedFile(file, sender) {
  // Access file list element
  const fileList = document.getElementById('fileList');
  if (!fileList) return;
  
  // Create file item
  const fileItem = document.createElement('div');
  fileItem.className = 'file-item received';
  
  // Get appropriate icon based on file type
  const fileIcon = getFileIcon(file.type);
  
  // Create file preview
  const filePreview = document.createElement('div');
  filePreview.className = 'file-preview';
  
  if (file.type.startsWith('image/')) {
    // Create image preview for images
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    filePreview.appendChild(img);
  } else {
    // Use icon for non-images
    filePreview.innerHTML = fileIcon;
  }
  
  // Create file info
  const fileInfo = document.createElement('div');
  fileInfo.className = 'file-info';
  
  const fileName = document.createElement('div');
  fileName.className = 'file-name';
  fileName.textContent = file.name;
  
  const fileMeta = document.createElement('div');
  fileMeta.className = 'file-meta';
  fileMeta.textContent = `${formatFileSize(file.size)} • From: ${sender}`;
  
  fileInfo.appendChild(fileName);
  fileInfo.appendChild(fileMeta);
  
  // Create file actions
  const fileActions = document.createElement('div');
  fileActions.className = 'file-actions';
  
  const downloadBtn = document.createElement('button');
  downloadBtn.className = 'file-action-btn';
  downloadBtn.innerHTML = `
    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
      <polyline points="7 10 12 15 17 10"></polyline>
      <line x1="12" y1="15" x2="12" y2="3"></line>
    </svg>
  `;
  downloadBtn.title = 'Download';
  downloadBtn.onclick = () => downloadFile(file);
  
  fileActions.appendChild(downloadBtn);
  
  // Assemble file item
  fileItem.appendChild(filePreview);
  fileItem.appendChild(fileInfo);
  fileItem.appendChild(fileActions);
  
  // Add to file list
  fileList.appendChild(fileItem);
  
  // Show notification
  showFileNotification(sender, file.name, 'received');
}

/**
 * Get an icon based on file type
 * @param {string} fileType The MIME type of the file
 * @returns {string} SVG icon markup
 */
function getFileIcon(fileType) {
  if (fileType.startsWith('image/')) {
    return `
      <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <circle cx="8.5" cy="8.5" r="1.5"></circle>
        <polyline points="21 15 16 10 5 21"></polyline>
      </svg>
    `;
  } else if (fileType.startsWith('video/')) {
    return `
      <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
        <line x1="7" y1="2" x2="7" y2="22"></line>
        <line x1="17" y1="2" x2="17" y2="22"></line>
        <line x1="2" y1="12" x2="22" y2="12"></line>
        <line x1="2" y1="7" x2="7" y2="7"></line>
        <line x1="2" y1="17" x2="7" y2="17"></line>
        <line x1="17" y1="17" x2="22" y2="17"></line>
        <line x1="17" y1="7" x2="22" y2="7"></line>
      </svg>
    `;
  } else if (fileType.startsWith('audio/')) {
    return `
      <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path d="M9 18V5l12-2v13"></path>
        <circle cx="6" cy="18" r="3"></circle>
        <circle cx="18" cy="16" r="3"></circle>
      </svg>
    `;
  } else if (fileType === 'application/pdf') {
    return `
      <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
        <polyline points="10 9 9 9 8 9"></polyline>
      </svg>
    `;
  } else {
    return `
      <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
      </svg>
    `;
  }
}

/**
 * Format file size for display
 * @param {number} bytes File size in bytes
 * @returns {string} Formatted file size
 */
function formatFileSize(bytes) {
  if (bytes < 1024) {
    return bytes + ' B';
  } else if (bytes < 1024 * 1024) {
    return (bytes / 1024).toFixed(1) + ' KB';
  } else if (bytes < 1024 * 1024 * 1024) {
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  } else {
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  }
}

/**
 * Download a file
 * @param {File} file The file to download
 */
function downloadFile(file) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Show a notification for file transfer
 * @param {string} user The username
 * @param {string} fileName The file name
 * @param {string} action The action ('sent' or 'received')
 */
function showFileNotification(user, fileName, action) {
  if (window.showToast) {
    const actionText = action === 'sent' ? 'sent to' : 'received from';
    window.showToast(`File ${fileName} ${actionText} ${user}`, 'info');
  }
}

// Export functions
export { 
  initFileSharing,
  sendFile
};
