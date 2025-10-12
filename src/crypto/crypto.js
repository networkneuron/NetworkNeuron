/**
 * NetworkNeuron Cryptographic Module
 * 
 * Handles all cryptographic operations including encryption, decryption,
 * digital signatures, and key management for the NetworkNeuron protocol.
 */

import crypto from 'crypto';
import forge from 'node-forge';
import { NetworkNeuronError, EncryptionError, AuthenticationError } from './types.js';

/**
 * Cryptographic utility class
 */
export class CryptoManager {
  constructor() {
    this.algorithms = {
      encryption: 'chacha20-poly1305',
      hash: 'sha256',
      signature: 'rsa-sha256',
      keyExchange: 'x25519'
    };
    
    this.keySize = 256;
    this.ivSize = 12;
    this.tagSize = 16;
  }

  /**
   * Generate a new key pair for the node
   */
  generateKeyPair() {
    try {
      const keyPair = forge.pki.rsa.generateKeyPair({ bits: 2048 });
      
      return {
        publicKey: forge.pki.publicKeyToPem(keyPair.publicKey),
        privateKey: forge.pki.privateKeyToPem(keyPair.privateKey),
        publicKeyHash: this.hash(forge.pki.publicKeyToPem(keyPair.publicKey))
      };
    } catch (error) {
      throw new EncryptionError(`Failed to generate key pair: ${error.message}`);
    }
  }

  /**
   * Generate a symmetric encryption key
   */
  generateSymmetricKey() {
    return crypto.randomBytes(this.keySize / 8);
  }

  /**
   * Encrypt data using ChaCha20-Poly1305
   */
  encrypt(data, key, iv = null) {
    try {
      if (!iv) {
        iv = crypto.randomBytes(this.ivSize);
      }
      
      const cipher = crypto.createCipher('chacha20-poly1305', key);
      cipher.setAAD(Buffer.from('networkneuron', 'utf8'));
      
      let encrypted = cipher.update(data);
      encrypted = Buffer.concat([encrypted, cipher.final()]);
      
      const tag = cipher.getAuthTag();
      
      return {
        encrypted,
        iv,
        tag
      };
    } catch (error) {
      throw new EncryptionError(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt data using ChaCha20-Poly1305
   */
  decrypt(encryptedData, key, iv, tag) {
    try {
      const decipher = crypto.createDecipher('chacha20-poly1305', key);
      decipher.setAAD(Buffer.from('networkneuron', 'utf8'));
      decipher.setAuthTag(tag);
      
      let decrypted = decipher.update(encryptedData);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      
      return decrypted;
    } catch (error) {
      throw new EncryptionError(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * Sign data with private key
   */
  sign(data, privateKeyPem) {
    try {
      const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
      const md = forge.md.sha256.create();
      md.update(data.toString(), 'utf8');
      
      return forge.util.encode64(privateKey.sign(md));
    } catch (error) {
      throw new AuthenticationError(`Signing failed: ${error.message}`);
    }
  }

  /**
   * Verify signature with public key
   */
  verify(data, signature, publicKeyPem) {
    try {
      const publicKey = forge.pki.publicKeyFromPem(publicKeyPem);
      const md = forge.md.sha256.create();
      md.update(data.toString(), 'utf8');
      
      return publicKey.verify(md.digest().bytes(), forge.util.decode64(signature));
    } catch (error) {
      throw new AuthenticationError(`Signature verification failed: ${error.message}`);
    }
  }

  /**
   * Generate a cryptographic hash
   */
  hash(data) {
    const hash = crypto.createHash(this.algorithms.hash);
    hash.update(data);
    return hash.digest('hex');
  }

  /**
   * Generate a secure random string
   */
  generateRandomString(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Derive key from password using PBKDF2
   */
  deriveKey(password, salt, iterations = 100000) {
    return crypto.pbkdf2Sync(password, salt, iterations, this.keySize / 8, 'sha256');
  }

  /**
   * Generate a secure nonce
   */
  generateNonce() {
    return crypto.randomBytes(16);
  }

  /**
   * Encrypt a message for a specific recipient
   */
  encryptMessage(message, recipientPublicKey, senderPrivateKey) {
    try {
      // Generate ephemeral key for this message
      const ephemeralKey = this.generateSymmetricKey();
      
      // Encrypt the message with ephemeral key
      const encrypted = this.encrypt(Buffer.from(JSON.stringify(message)), ephemeralKey);
      
      // Encrypt the ephemeral key with recipient's public key
      const recipientKey = forge.pki.publicKeyFromPem(recipientPublicKey);
      const encryptedKey = recipientKey.encrypt(ephemeralKey.toString('hex'));
      
      // Sign the encrypted message
      const signature = this.sign(encrypted.encrypted, senderPrivateKey);
      
      return {
        encryptedData: encrypted.encrypted.toString('base64'),
        iv: encrypted.iv.toString('base64'),
        tag: encrypted.tag.toString('base64'),
        encryptedKey: forge.util.encode64(encryptedKey),
        signature
      };
    } catch (error) {
      throw new EncryptionError(`Message encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt a message from a specific sender
   */
  decryptMessage(encryptedMessage, senderPublicKey, recipientPrivateKey) {
    try {
      // Verify signature
      const isValid = this.verify(
        Buffer.from(encryptedMessage.encryptedData, 'base64'),
        encryptedMessage.signature,
        senderPublicKey
      );
      
      if (!isValid) {
        throw new AuthenticationError('Invalid message signature');
      }
      
      // Decrypt the ephemeral key
      const privateKey = forge.pki.privateKeyFromPem(recipientPrivateKey);
      const ephemeralKeyHex = privateKey.decrypt(forge.util.decode64(encryptedMessage.encryptedKey));
      const ephemeralKey = Buffer.from(ephemeralKeyHex, 'hex');
      
      // Decrypt the message
      const decrypted = this.decrypt(
        Buffer.from(encryptedMessage.encryptedData, 'base64'),
        ephemeralKey,
        Buffer.from(encryptedMessage.iv, 'base64'),
        Buffer.from(encryptedMessage.tag, 'base64')
      );
      
      return JSON.parse(decrypted.toString());
    } catch (error) {
      throw new EncryptionError(`Message decryption failed: ${error.message}`);
    }
  }

  /**
   * Create a secure tunnel key for data transmission
   */
  createTunnelKey(nodeAKeys, nodeBKeys) {
    try {
      // Use ECDH key exchange to create shared secret
      const sharedSecret = crypto.diffieHellman({
        privateKey: nodeAKeys.privateKey,
        publicKey: nodeBKeys.publicKey
      });
      
      // Derive tunnel key from shared secret
      const salt = this.generateNonce();
      const tunnelKey = this.deriveKey(sharedSecret, salt);
      
      return {
        key: tunnelKey,
        salt: salt.toString('base64')
      };
    } catch (error) {
      throw new EncryptionError(`Tunnel key creation failed: ${error.message}`);
    }
  }

  /**
   * Validate cryptographic parameters
   */
  validateCryptoParams(params) {
    const required = ['algorithm', 'keySize', 'ivSize'];
    
    for (const param of required) {
      if (!params[param]) {
        throw new EncryptionError(`Missing required crypto parameter: ${param}`);
      }
    }
    
    return true;
  }
}

/**
 * Key management utility
 */
export class KeyManager {
  constructor() {
    this.crypto = new CryptoManager();
    this.keyStore = new Map();
  }

  /**
   * Store a key securely
   */
  storeKey(keyId, keyData, password = null) {
    try {
      let encryptedKey;
      
      if (password) {
        const salt = this.crypto.generateNonce();
        const derivedKey = this.crypto.deriveKey(password, salt);
        encryptedKey = this.crypto.encrypt(keyData, derivedKey);
        encryptedKey.salt = salt;
      } else {
        encryptedKey = keyData;
      }
      
      this.keyStore.set(keyId, {
        data: encryptedKey,
        timestamp: Date.now(),
        encrypted: !!password
      });
      
      return true;
    } catch (error) {
      throw new EncryptionError(`Key storage failed: ${error.message}`);
    }
  }

  /**
   * Retrieve a stored key
   */
  getKey(keyId, password = null) {
    try {
      const keyInfo = this.keyStore.get(keyId);
      
      if (!keyInfo) {
        throw new EncryptionError(`Key not found: ${keyId}`);
      }
      
      if (keyInfo.encrypted && !password) {
        throw new AuthenticationError('Password required for encrypted key');
      }
      
      if (keyInfo.encrypted && password) {
        const derivedKey = this.crypto.deriveKey(password, keyInfo.data.salt);
        return this.crypto.decrypt(
          keyInfo.data.encrypted,
          derivedKey,
          keyInfo.data.iv,
          keyInfo.data.tag
        );
      }
      
      return keyInfo.data;
    } catch (error) {
      throw new EncryptionError(`Key retrieval failed: ${error.message}`);
    }
  }

  /**
   * Delete a stored key
   */
  deleteKey(keyId) {
    return this.keyStore.delete(keyId);
  }

  /**
   * List all stored keys
   */
  listKeys() {
    return Array.from(this.keyStore.keys());
  }
}
