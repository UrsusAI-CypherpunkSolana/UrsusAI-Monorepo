const { ethers } = require('ethers');
const crypto = require('crypto');

/**
 * Universal Chat Protocol (UCP) Service
 * Implements standardized communication protocol for AI agents
 */
class UCPService {
  constructor() {
    this.protocolVersion = '1.0.0';
    this.supportedMessageTypes = [
      'text',
      'command',
      'query',
      'transaction',
      'system'
    ];
    this.supportedEncodings = ['utf-8', 'base64', 'hex'];
  }

  /**
   * Create a UCP-compliant message
   */
  createMessage(params) {
    const {
      type = 'text',
      content,
      sender,
      recipient,
      metadata = {},
      encoding = 'utf-8'
    } = params;

    // Validate required fields
    if (!content || !sender || !recipient) {
      throw new Error('Missing required fields: content, sender, recipient');
    }

    // Validate message type
    if (!this.supportedMessageTypes.includes(type)) {
      throw new Error(`Unsupported message type: ${type}`);
    }

    // Validate addresses
    if (!ethers.isAddress(sender) || !ethers.isAddress(recipient)) {
      throw new Error('Invalid sender or recipient address');
    }

    const message = {
      // UCP Header
      protocol: 'UCP',
      version: this.protocolVersion,
      messageId: crypto.randomUUID(),
      timestamp: Date.now(),
      
      // Message metadata
      type,
      encoding,
      
      // Participants
      sender: sender.toLowerCase(),
      recipient: recipient.toLowerCase(),
      
      // Content
      content: this.encodeContent(content, encoding),
      contentHash: this.hashContent(content),
      
      // Additional metadata
      metadata: {
        ...metadata,
        contentLength: content.length,
        contentType: typeof content
      },
      
      // Security
      signature: null, // Will be set if signing is required
      nonce: crypto.randomBytes(16).toString('hex')
    };

    return message;
  }

  /**
   * Validate UCP message format
   */
  validateMessage(message) {
    const errors = [];

    // Check required fields
    const requiredFields = [
      'protocol', 'version', 'messageId', 'timestamp',
      'type', 'sender', 'recipient', 'content'
    ];

    for (const field of requiredFields) {
      if (!message[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // Validate protocol
    if (message.protocol !== 'UCP') {
      errors.push('Invalid protocol identifier');
    }

    // Validate version
    if (message.version !== this.protocolVersion) {
      errors.push(`Unsupported protocol version: ${message.version}`);
    }

    // Validate message type
    if (!this.supportedMessageTypes.includes(message.type)) {
      errors.push(`Unsupported message type: ${message.type}`);
    }

    // Validate addresses
    if (!ethers.isAddress(message.sender)) {
      errors.push('Invalid sender address');
    }

    if (!ethers.isAddress(message.recipient)) {
      errors.push('Invalid recipient address');
    }

    // Validate timestamp
    const now = Date.now();
    const messageTime = message.timestamp;
    const timeDiff = Math.abs(now - messageTime);
    
    // Allow 5 minutes tolerance
    if (timeDiff > 5 * 60 * 1000) {
      errors.push('Message timestamp is too old or too far in the future');
    }

    // Validate content hash if present
    if (message.contentHash) {
      const expectedHash = this.hashContent(
        this.decodeContent(message.content, message.encoding || 'utf-8')
      );
      if (message.contentHash !== expectedHash) {
        errors.push('Content hash mismatch');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Process incoming UCP message
   */
  async processMessage(message, context = {}) {
    // Validate message format
    const validation = this.validateMessage(message);
    if (!validation.isValid) {
      throw new Error(`Invalid UCP message: ${validation.errors.join(', ')}`);
    }

    // Decode content
    const decodedContent = this.decodeContent(message.content, message.encoding);

    // Process based on message type
    switch (message.type) {
      case 'text':
        return this.processTextMessage(decodedContent, message, context);
      
      case 'command':
        return this.processCommandMessage(decodedContent, message, context);
      
      case 'query':
        return this.processQueryMessage(decodedContent, message, context);
      
      case 'transaction':
        return this.processTransactionMessage(decodedContent, message, context);
      
      case 'system':
        return this.processSystemMessage(decodedContent, message, context);
      
      default:
        throw new Error(`Unsupported message type: ${message.type}`);
    }
  }

  /**
   * Process text message
   */
  async processTextMessage(content, message, context) {
    return {
      type: 'text_response',
      content: content,
      processed: true,
      processingTime: Date.now() - message.timestamp
    };
  }

  /**
   * Process command message
   */
  async processCommandMessage(content, message, context) {
    try {
      const command = JSON.parse(content);
      
      // Basic command validation
      if (!command.action) {
        throw new Error('Command missing action field');
      }

      return {
        type: 'command_response',
        command: command.action,
        status: 'executed',
        result: await this.executeCommand(command, context),
        processingTime: Date.now() - message.timestamp
      };
    } catch (error) {
      return {
        type: 'command_error',
        error: error.message,
        processingTime: Date.now() - message.timestamp
      };
    }
  }

  /**
   * Process query message
   */
  async processQueryMessage(content, message, context) {
    try {
      const query = JSON.parse(content);
      
      return {
        type: 'query_response',
        query: query,
        result: await this.executeQuery(query, context),
        processingTime: Date.now() - message.timestamp
      };
    } catch (error) {
      return {
        type: 'query_error',
        error: error.message,
        processingTime: Date.now() - message.timestamp
      };
    }
  }

  /**
   * Process transaction message
   */
  async processTransactionMessage(content, message, context) {
    try {
      const transaction = JSON.parse(content);
      
      return {
        type: 'transaction_response',
        transaction: transaction,
        status: 'processed',
        result: await this.processTransaction(transaction, context),
        processingTime: Date.now() - message.timestamp
      };
    } catch (error) {
      return {
        type: 'transaction_error',
        error: error.message,
        processingTime: Date.now() - message.timestamp
      };
    }
  }

  /**
   * Process system message
   */
  async processSystemMessage(content, message, context) {
    return {
      type: 'system_response',
      content: 'System message received',
      processingTime: Date.now() - message.timestamp
    };
  }

  /**
   * Execute command
   */
  async executeCommand(command, context) {
    // Implement command execution logic
    return { status: 'success', message: 'Command executed' };
  }

  /**
   * Execute query
   */
  async executeQuery(query, context) {
    // Implement query execution logic
    return { status: 'success', data: {} };
  }

  /**
   * Process transaction
   */
  async processTransaction(transaction, context) {
    // Implement transaction processing logic
    return { status: 'success', txHash: null };
  }

  /**
   * Encode content based on encoding type
   */
  encodeContent(content, encoding = 'utf-8') {
    switch (encoding) {
      case 'utf-8':
        return content;
      case 'base64':
        return Buffer.from(content, 'utf-8').toString('base64');
      case 'hex':
        return Buffer.from(content, 'utf-8').toString('hex');
      default:
        throw new Error(`Unsupported encoding: ${encoding}`);
    }
  }

  /**
   * Decode content based on encoding type
   */
  decodeContent(content, encoding = 'utf-8') {
    switch (encoding) {
      case 'utf-8':
        return content;
      case 'base64':
        return Buffer.from(content, 'base64').toString('utf-8');
      case 'hex':
        return Buffer.from(content, 'hex').toString('utf-8');
      default:
        throw new Error(`Unsupported encoding: ${encoding}`);
    }
  }

  /**
   * Hash content for integrity verification
   */
  hashContent(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Sign message (placeholder for future implementation)
   */
  signMessage(message, privateKey) {
    // Implement message signing
    return null;
  }

  /**
   * Verify message signature (placeholder for future implementation)
   */
  verifySignature(message, signature, publicKey) {
    // Implement signature verification
    return true;
  }
}

module.exports = UCPService;
