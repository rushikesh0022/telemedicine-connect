// End-to-End Encryption Module for Video Call Application

/**
 * This module provides end-to-end encryption capabilities for the video call application
 * using the Web Crypto API. It handles key generation, encryption/decryption of messages,
 * and secure key exchange using RSA-OAEP and AES-GCM.
 */

// Generate RSA key pair for asymmetric encryption (used for key exchange)
async function generateKeyPair() {
  try {
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: "RSA-OAEP",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["encrypt", "decrypt"]
    );
    
    // Export public key for sharing
    const publicKeyExported = await window.crypto.subtle.exportKey(
      "spki",
      keyPair.publicKey
    );
    
    // Convert to base64 for transmission
    const publicKeyBase64 = arrayBufferToBase64(publicKeyExported);
    
    return {
      keyPair,
      publicKeyBase64
    };
  } catch (error) {
    console.error("Error generating key pair:", error);
    throw new Error("Failed to generate encryption keys");
  }
}

// Generate AES key for symmetric encryption (used for message encryption)
async function generateAESKey() {
  try {
    const key = await window.crypto.subtle.generateKey(
      {
        name: "AES-GCM",
        length: 256,
      },
      true,
      ["encrypt", "decrypt"]
    );
    
    // Export key for sharing
    const keyExported = await window.crypto.subtle.exportKey("raw", key);
    
    return {
      key,
      keyBuffer: keyExported
    };
  } catch (error) {
    console.error("Error generating AES key:", error);
    throw new Error("Failed to generate encryption key");
  }
}

// Encrypt AES key with recipient's public key
async function encryptAESKey(aesKeyBuffer, recipientPublicKey) {
  try {
    const encryptedKey = await window.crypto.subtle.encrypt(
      {
        name: "RSA-OAEP"
      },
      recipientPublicKey,
      aesKeyBuffer
    );
    
    return arrayBufferToBase64(encryptedKey);
  } catch (error) {
    console.error("Error encrypting AES key:", error);
    throw new Error("Failed to encrypt key");
  }
}

// Decrypt AES key with own private key
async function decryptAESKey(encryptedKeyBase64, privateKey) {
  try {
    const encryptedKeyBuffer = base64ToArrayBuffer(encryptedKeyBase64);
    
    const decryptedKeyBuffer = await window.crypto.subtle.decrypt(
      {
        name: "RSA-OAEP"
      },
      privateKey,
      encryptedKeyBuffer
    );
    
    // Import the decrypted AES key
    const aesKey = await window.crypto.subtle.importKey(
      "raw",
      decryptedKeyBuffer,
      {
        name: "AES-GCM",
        length: 256
      },
      true,
      ["encrypt", "decrypt"]
    );
    
    return aesKey;
  } catch (error) {
    console.error("Error decrypting AES key:", error);
    throw new Error("Failed to decrypt key");
  }
}

// Import public key from base64 string
async function importPublicKey(publicKeyBase64) {
  try {
    const publicKeyBuffer = base64ToArrayBuffer(publicKeyBase64);
    
    const publicKey = await window.crypto.subtle.importKey(
      "spki",
      publicKeyBuffer,
      {
        name: "RSA-OAEP",
        hash: "SHA-256"
      },
      true,
      ["encrypt"]
    );
    
    return publicKey;
  } catch (error) {
    console.error("Error importing public key:", error);
    throw new Error("Failed to import encryption key");
  }
}

// Encrypt a message using AES-GCM
async function encryptMessage(message, aesKey) {
  try {
    // Generate random initialization vector
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    
    // Convert message to ArrayBuffer
    const encoder = new TextEncoder();
    const messageBuffer = encoder.encode(message);
    
    // Encrypt the message
    const encryptedBuffer = await window.crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv
      },
      aesKey,
      messageBuffer
    );
    
    // Combine IV and encrypted data for transmission
    const combinedBuffer = new Uint8Array(iv.length + encryptedBuffer.byteLength);
    combinedBuffer.set(iv, 0);
    combinedBuffer.set(new Uint8Array(encryptedBuffer), iv.length);
    
    return arrayBufferToBase64(combinedBuffer);
  } catch (error) {
    console.error("Error encrypting message:", error);
    throw new Error("Failed to encrypt message");
  }
}

// Decrypt a message using AES-GCM
async function decryptMessage(encryptedMessageBase64, aesKey) {
  try {
    const encryptedBuffer = base64ToArrayBuffer(encryptedMessageBase64);
    
    // Extract IV from the beginning of the buffer
    const iv = encryptedBuffer.slice(0, 12);
    
    // Extract encrypted data
    const encryptedData = encryptedBuffer.slice(12);
    
    // Decrypt the message
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv
      },
      aesKey,
      encryptedData
    );
    
    // Convert back to string
    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (error) {
    console.error("Error decrypting message:", error);
    throw new Error("Failed to decrypt message");
  }
}

// Encrypt a file using AES-GCM
async function encryptFile(file, aesKey) {
  try {
    // Generate random initialization vector
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    
    // Read file as ArrayBuffer
    const fileBuffer = await readFileAsArrayBuffer(file);
    
    // Encrypt the file data
    const encryptedBuffer = await window.crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv
      },
      aesKey,
      fileBuffer
    );
    
    // Combine IV and encrypted data
    const combinedBuffer = new Uint8Array(iv.length + encryptedBuffer.byteLength);
    combinedBuffer.set(iv, 0);
    combinedBuffer.set(new Uint8Array(encryptedBuffer), iv.length);
    
    // Create new encrypted file
    const encryptedFile = new File(
      [combinedBuffer],
      `${file.name}.encrypted`,
      { type: 'application/octet-stream' }
    );
    
    return {
      file: encryptedFile,
      iv: arrayBufferToBase64(iv)
    };
  } catch (error) {
    console.error("Error encrypting file:", error);
    throw new Error("Failed to encrypt file");
  }
}

// Decrypt a file using AES-GCM
async function decryptFile(encryptedFile, aesKey, originalFileName, originalType) {
  try {
    // Read encrypted file as ArrayBuffer
    const encryptedBuffer = await readFileAsArrayBuffer(encryptedFile);
    
    // Extract IV from the beginning of the buffer
    const iv = encryptedBuffer.slice(0, 12);
    
    // Extract encrypted data
    const encryptedData = encryptedBuffer.slice(12);
    
    // Decrypt the file data
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv
      },
      aesKey,
      encryptedData
    );
    
    // Create new decrypted file with original name and type
    const decryptedFile = new File(
      [decryptedBuffer],
      originalFileName || encryptedFile.name.replace('.encrypted', ''),
      { type: originalType || 'application/octet-stream' }
    );
    
    return decryptedFile;
  } catch (error) {
    console.error("Error decrypting file:", error);
    throw new Error("Failed to decrypt file");
  }
}

// Helper function to read a file as ArrayBuffer
function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}

// Helper function to convert ArrayBuffer to Base64 string
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper function to convert Base64 string to ArrayBuffer
function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// E2E Encryption Manager Class
class E2EEncryptionManager {
  constructor() {
    this.keyPair = null;
    this.publicKeyBase64 = null;
    this.aesKey = null;
    this.peerPublicKey = null;
    this.sharedKey = null;
    this.isInitialized = false;
    this.isSecureChannelEstablished = false;
  }
  
  // Initialize encryption system
  async initialize() {
    try {
      // Generate RSA key pair
      const { keyPair, publicKeyBase64 } = await generateKeyPair();
      this.keyPair = keyPair;
      this.publicKeyBase64 = publicKeyBase64;
      
      // Generate AES key for symmetric encryption
      const { key } = await generateAESKey();
      this.aesKey = key;
      
      this.isInitialized = true;
      return this.publicKeyBase64;
    } catch (error) {
      console.error("Error initializing encryption:", error);
      throw new Error("Failed to initialize encryption");
    }
  }
  
  // Set peer's public key
  async setPeerPublicKey(peerPublicKeyBase64) {
    try {
      this.peerPublicKey = await importPublicKey(peerPublicKeyBase64);
      return true;
    } catch (error) {
      console.error("Error setting peer public key:", error);
      return false;
    }
  }
  
  // Establish secure channel with peer
  async establishSecureChannel() {
    try {
      if (!this.isInitialized || !this.peerPublicKey) {
        throw new Error("Encryption not initialized or peer public key not set");
      }
      
      // Generate shared AES key
      const { key, keyBuffer } = await generateAESKey();
      this.sharedKey = key;
      
      // Encrypt shared key with peer's public key
      const encryptedKeyBase64 = await encryptAESKey(keyBuffer, this.peerPublicKey);
      
      this.isSecureChannelEstablished = true;
      return encryptedKeyBase64;
    } catch (error) {
      console.error("Error establishing secure channel:", error);
      throw new Error("Failed to establish secure connection");
    }
  }
  
  // Receive and import shared key from peer
  async receiveSecureChannel(encryptedKeyBase64) {
    try {
      if (!this.isInitialized) {
        throw new Error("Encryption not initialized");
      }
      
      // Decrypt shared key with private key
      this.sharedKey = await decryptAESKey(
        encryptedKeyBase64,
        this.keyPair.privateKey
      );
      
      this.isSecureChannelEstablished = true;
      return true;
    } catch (error) {
      console.error("Error receiving secure channel:", error);
      return false;
    }
  }
  
  // Encrypt a message using shared key
  async encryptMessage(message) {
    if (!this.isSecureChannelEstablished) {
      throw new Error("Secure channel not established");
    }
    
    return encryptMessage(message, this.sharedKey);
  }
  
  // Decrypt a message using shared key
  async decryptMessage(encryptedMessageBase64) {
    if (!this.isSecureChannelEstablished) {
      throw new Error("Secure channel not established");
    }
    
    return decryptMessage(encryptedMessageBase64, this.sharedKey);
  }
  
  // Encrypt a file using shared key
  async encryptFile(file) {
    if (!this.isSecureChannelEstablished) {
      throw new Error("Secure channel not established");
    }
    
    return encryptFile(file, this.sharedKey);
  }
  
  // Decrypt a file using shared key
  async decryptFile(encryptedFile, originalFileName, originalType) {
    if (!this.isSecureChannelEstablished) {
      throw new Error("Secure channel not established");
    }
    
    return decryptFile(encryptedFile, this.sharedKey, originalFileName, originalType);
  }
  
  // Check if encryption is supported in this browser
  static isSupported() {
    return (
      window.crypto &&
      window.crypto.subtle &&
      window.TextEncoder &&
      window.TextDecoder
    );
  }
}

// Export the encryption manager
export { E2EEncryptionManager };
