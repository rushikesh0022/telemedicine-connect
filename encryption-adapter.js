// Encryption Adapter Module
// This module adapts the encryption.js functions into a proper ES Module

// Helper functions for array buffer conversion
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

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
    this.secureChannelEstablished = false;
    this.peerSessionKey = null;
  }

  // Initialize encryption
  async initialize() {
    try {
      // Generate RSA key pair for key exchange
      const keyPairData = await this._generateKeyPair();
      this.keyPair = keyPairData.keyPair;
      this.publicKeyBase64 = keyPairData.publicKeyBase64;
      
      // Generate AES session key for message encryption
      const aesKeyData = await this._generateAESKey();
      this.aesKey = aesKeyData.key;
      this.aesKeyBuffer = aesKeyData.keyBuffer;
      
      return {
        success: true,
        publicKey: this.publicKeyBase64
      };
    } catch (error) {
      console.error("Failed to initialize encryption:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Generate RSA key pair for asymmetric encryption (used for key exchange)
  async _generateKeyPair() {
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
  async _generateAESKey() {
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

  // Receive and process a peer's public key
  async receivePublicKey(peerPublicKeyBase64) {
    try {
      this.peerPublicKey = await this._importPublicKey(peerPublicKeyBase64);
      return true;
    } catch (error) {
      console.error("Error processing peer's public key:", error);
      return false;
    }
  }

  // Import public key from base64 string
  async _importPublicKey(publicKeyBase64) {
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

  // Encrypt AES key with recipient's public key
  async _encryptAESKey(aesKeyBuffer, recipientPublicKey) {
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
  async _decryptAESKey(encryptedKeyBase64) {
    try {
      const encryptedKeyBuffer = base64ToArrayBuffer(encryptedKeyBase64);
      
      const decryptedKeyBuffer = await window.crypto.subtle.decrypt(
        {
          name: "RSA-OAEP"
        },
        this.keyPair.privateKey,
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

  // Establish a secure channel with the peer
  async establishSecureChannel() {
    if (!this.peerPublicKey) {
      throw new Error("Peer's public key not received. Cannot establish secure channel.");
    }
    
    try {
      // Encrypt our AES key with the peer's public key
      const encryptedSessionKey = await this._encryptAESKey(
        this.aesKeyBuffer,
        this.peerPublicKey
      );
      
      this.secureChannelEstablished = true;
      
      return {
        success: true,
        encryptedSessionKey
      };
    } catch (error) {
      console.error("Failed to establish secure channel:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Process the encrypted session key from the peer
  async receiveEncryptedSessionKey(encryptedSessionKey) {
    try {
      // Decrypt the peer's AES key with our private key
      this.peerSessionKey = await this._decryptAESKey(encryptedSessionKey);
      this.secureChannelEstablished = true;
      
      return {
        success: true
      };
    } catch (error) {
      console.error("Failed to process encrypted session key:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Encrypt a message using AES-GCM
  async encryptMessage(message) {
    if (!this.secureChannelEstablished || !this.peerSessionKey) {
      throw new Error("Secure channel not established. Cannot encrypt message.");
    }
    
    try {
      // Generate random initialization vector
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      
      // Convert message to ArrayBuffer
      const encoder = new TextEncoder();
      const messageBuffer = encoder.encode(message);
      
      // Encrypt the message with peer's session key
      const encryptedBuffer = await window.crypto.subtle.encrypt(
        {
          name: "AES-GCM",
          iv: iv
        },
        this.peerSessionKey,
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
  async decryptMessage(encryptedMessageBase64) {
    if (!this.secureChannelEstablished) {
      throw new Error("Secure channel not established. Cannot decrypt message.");
    }
    
    try {
      const encryptedBuffer = base64ToArrayBuffer(encryptedMessageBase64);
      
      // Extract IV from the beginning of the buffer
      const iv = encryptedBuffer.slice(0, 12);
      
      // Extract encrypted data
      const encryptedData = encryptedBuffer.slice(12);
      
      // Decrypt the message using our AES key
      const decryptedBuffer = await window.crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: new Uint8Array(iv)
        },
        this.aesKey,
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
  async encryptFile(file) {
    if (!this.secureChannelEstablished || !this.peerSessionKey) {
      throw new Error("Secure channel not established. Cannot encrypt file.");
    }
    
    try {
      // Read file as ArrayBuffer
      const fileBuffer = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      });
      
      // Generate random initialization vector
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      
      // Encrypt the file with peer's session key
      const encryptedBuffer = await window.crypto.subtle.encrypt(
        {
          name: "AES-GCM",
          iv: iv
        },
        this.peerSessionKey,
        fileBuffer
      );
      
      // Combine IV and encrypted data
      const combinedBuffer = new Uint8Array(iv.length + encryptedBuffer.byteLength);
      combinedBuffer.set(iv, 0);
      combinedBuffer.set(new Uint8Array(encryptedBuffer), iv.length);
      
      // Create encrypted file blob
      const encryptedFile = new File(
        [combinedBuffer], 
        `${file.name}.encrypted`, 
        { type: 'application/octet-stream' }
      );
      
      return {
        encryptedFile,
        originalType: file.type,
        originalName: file.name
      };
    } catch (error) {
      console.error("Error encrypting file:", error);
      throw new Error("Failed to encrypt file");
    }
  }

  // Decrypt a file using AES-GCM
  async decryptFile(encryptedFile, originalType, originalName) {
    if (!this.secureChannelEstablished) {
      throw new Error("Secure channel not established. Cannot decrypt file.");
    }
    
    try {
      // Read encrypted file as ArrayBuffer
      const encryptedBuffer = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(encryptedFile);
      });
      
      // Extract IV from the beginning of the buffer
      const iv = encryptedBuffer.slice(0, 12);
      
      // Extract encrypted data
      const encryptedData = encryptedBuffer.slice(12);
      
      // Decrypt the file using our AES key
      const decryptedBuffer = await window.crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: new Uint8Array(iv)
        },
        this.aesKey,
        encryptedData
      );
      
      // Create decrypted file blob
      const decryptedFile = new File(
        [decryptedBuffer], 
        originalName || encryptedFile.name.replace('.encrypted', ''), 
        { type: originalType || 'application/octet-stream' }
      );
      
      return decryptedFile;
    } catch (error) {
      console.error("Error decrypting file:", error);
      throw new Error("Failed to decrypt file");
    }
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
