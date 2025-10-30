const { Connection, PublicKey, clusterApiUrl, LAMPORTS_PER_SOL, Keypair, SystemProgram, SYSVAR_RENT_PUBKEY } = require('@solana/web3.js');
const { Program, AnchorProvider, web3, BN, Wallet } = require('@coral-xyz/anchor');
const { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, ASSOCIATED_TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction } = require('@solana/spl-token');
const fs = require('fs');
const path = require('path');

/**
 * Solana Blockchain Service
 * Replaces Core DAO/EVM blockchain service with Solana integration
 */
class SolanaBlockchainService {
  constructor() {
    // Initialize Solana connection
    const cluster = process.env.SOLANA_NETWORK || 'devnet';
    const rpcUrl = process.env.SOLANA_RPC_URL || clusterApiUrl(cluster);

    this.connection = new Connection(rpcUrl, 'confirmed');
    this.cluster = cluster;

    // Program ID
    this.programId = new PublicKey(
      process.env.AGENT_FACTORY_PROGRAM_ID || 'GXMVNLiogZ2vinezusVGDkdDcSk1hJKHtj616iWq3345'
    );

    // Load wallet from private key
    this.wallet = null;
    this.loadWallet();

    // Factory PDA
    this.factoryPda = null;
    this.platformTreasury = null;
    this.initializeFactoryPda();

    // Event listener reference
    this.eventListener = null;

    // Program instance (will be initialized with IDL)
    this.program = null;
    this.initializeProgram();

    console.log('🔗 Solana Blockchain Service initialized');
    console.log(`📡 Cluster: ${this.cluster}`);
    console.log(`🔗 RPC URL: ${rpcUrl}`);
    console.log(`📋 Program ID: ${this.programId.toString()}`);
    if (this.wallet) {
      console.log(`💼 Wallet: ${this.wallet.publicKey.toString()}`);
    }
  }

  /**
   * Load wallet from environment variable
   */
  loadWallet() {
    try {
      const privateKeyStr = process.env.SOLANA_WALLET_PRIVATE_KEY;
      if (!privateKeyStr) {
        console.warn('⚠️ No wallet private key found in environment');
        return;
      }

      // Parse private key array
      const privateKeyArray = JSON.parse(privateKeyStr);
      const secretKey = Uint8Array.from(privateKeyArray);
      this.wallet = Keypair.fromSecretKey(secretKey);

      console.log('✅ Wallet loaded successfully');
    } catch (error) {
      console.error('❌ Error loading wallet:', error.message);
    }
  }

  /**
   * Initialize Anchor Program
   */
  initializeProgram() {
    try {
      // Load IDL
      const idlPath = path.join(__dirname, '../idl/agent_factory.json');
      if (!fs.existsSync(idlPath)) {
        console.warn('⚠️ IDL file not found, program methods will not be available');
        return;
      }

      const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));

      // Create provider
      if (!this.wallet) {
        console.warn('⚠️ No wallet available, program will be read-only');
        return;
      }

      const wallet = new Wallet(this.wallet);
      const provider = new AnchorProvider(
        this.connection,
        wallet,
        { commitment: 'confirmed' }
      );

      // Initialize program
      this.program = new Program(idl, this.programId, provider);

      console.log('✅ Anchor Program initialized');
    } catch (error) {
      console.error('❌ Error initializing program:', error.message);
    }
  }

  /**
   * Initialize Factory PDA (synchronous)
   */
  initializeFactoryPda() {
    try {
      // Derive PDA synchronously
      const [factoryPda, bump] = PublicKey.findProgramAddressSync(
        [Buffer.from('factory')],
        this.programId
      );
      this.factoryPda = factoryPda;
      this.factoryBump = bump;

      // Platform treasury (for now, use wallet address)
      if (this.wallet) {
        this.platformTreasury = this.wallet.publicKey;
      }

      console.log(`🏭 Factory PDA: ${factoryPda.toString()}`);
    } catch (error) {
      console.error('❌ Error initializing Factory PDA:', error);
    }
  }

  /**
   * Set event listener reference
   */
  setEventListener(eventListener) {
    this.eventListener = eventListener;
  }

  /**
   * Get network status
   */
  async getNetworkStatus() {
    try {
      console.log('🔍 Fetching Solana network status...');

      const [slot, version, blockTime] = await Promise.all([
        this.connection.getSlot(),
        this.connection.getVersion(),
        this.connection.getBlockTime(await this.connection.getSlot())
      ]);

      const epochInfo = await this.connection.getEpochInfo();
      
      return {
        slot,
        blockTime,
        version: version['solana-core'],
        cluster: this.cluster,
        epochInfo: {
          epoch: epochInfo.epoch,
          slotIndex: epochInfo.slotIndex,
          slotsInEpoch: epochInfo.slotsInEpoch,
        },
        isHealthy: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Error fetching network status:', error);
      throw new Error(`Network status fetch failed: ${error.message}`);
    }
  }

  /**
   * Get factory account info
   */
  async getFactoryInfo() {
    try {
      if (!this.factoryPda) {
        await this.initializeFactoryPda();
      }

      const accountInfo = await this.connection.getAccountInfo(this.factoryPda);
      
      if (!accountInfo) {
        return {
          exists: false,
          message: 'Factory not initialized yet'
        };
      }

      // Parse account data (simplified - would use Anchor IDL in production)
      return {
        exists: true,
        address: this.factoryPda.toString(),
        lamports: accountInfo.lamports,
        owner: accountInfo.owner.toString(),
      };
    } catch (error) {
      console.error('❌ Error fetching factory info:', error);
      throw error;
    }
  }

  /**
   * Get all agents
   */
  async getAllAgents(offset = 0, limit = 20) {
    try {
      // Get all agents using getProgramAccounts
      const factoryInfo = await this.getFactoryInfo();
      
      if (!factoryInfo.exists) {
        return {
          agents: [],
          total: 0,
          offset,
          limit
        };
      }

      // TODO: Implement actual agent fetching using getProgramAccounts
      // const accounts = await this.connection.getProgramAccounts(this.programId, {
      //   filters: [
      //     { dataSize: AGENT_ACCOUNT_SIZE },
      //     { memcmp: { offset: 0, bytes: 'agent' } }
      //   ]
      // });

      return {
        agents: [],
        total: 0,
        offset,
        limit
      };
    } catch (error) {
      console.error('❌ Error fetching agents:', error);
      throw error;
    }
  }

  /**
   * Get agent info by public key
   */
  async getAgentInfo(agentPubkey) {
    try {
      const pubkey = new PublicKey(agentPubkey);
      const accountInfo = await this.connection.getAccountInfo(pubkey);
      
      if (!accountInfo) {
        throw new Error('Agent not found');
      }

      // TODO: Parse account data using Anchor IDL
      // const agentData = this.program.coder.accounts.decode('Agent', accountInfo.data);

      return {
        address: agentPubkey,
        lamports: accountInfo.lamports,
        owner: accountInfo.owner.toString(),
        // ...agentData
      };
    } catch (error) {
      console.error('❌ Error fetching agent info:', error);
      throw error;
    }
  }

  /**
   * Calculate purchase return using bonding curve
   * Pump.fun style: constant product AMM
   */
  calculatePurchaseReturn(solAmount, bondingCurve) {
    try {
      const {
        virtualSolReserves,
        virtualTokenReserves
      } = bondingCurve;

      // New SOL reserves after purchase
      const newSolReserves = virtualSolReserves + solAmount;

      // Constant product: k = virtualSolReserves * virtualTokenReserves
      const k = virtualSolReserves * virtualTokenReserves;

      // New token reserves: k / newSolReserves
      const newTokenReserves = k / newSolReserves;

      // Tokens out: difference in token reserves
      const tokensOut = virtualTokenReserves - newTokenReserves;

      return Math.floor(tokensOut);
    } catch (error) {
      console.error('❌ Error calculating purchase return:', error);
      throw error;
    }
  }

  /**
   * Calculate sale return using bonding curve
   */
  calculateSaleReturn(tokenAmount, bondingCurve) {
    try {
      const {
        virtualSolReserves,
        virtualTokenReserves
      } = bondingCurve;

      // New token reserves after sale
      const newTokenReserves = virtualTokenReserves + tokenAmount;

      // Constant product: k = virtualSolReserves * virtualTokenReserves
      const k = virtualSolReserves * virtualTokenReserves;

      // New SOL reserves: k / newTokenReserves
      const newSolReserves = k / newTokenReserves;

      // SOL out: difference in SOL reserves
      const solOut = virtualSolReserves - newSolReserves;

      return Math.floor(solOut);
    } catch (error) {
      console.error('❌ Error calculating sale return:', error);
      throw error;
    }
  }

  /**
   * Get current price (SOL per token)
   */
  getCurrentPrice(bondingCurve) {
    const { virtualSolReserves, virtualTokenReserves } = bondingCurve;
    
    if (virtualTokenReserves === 0) return 0;
    
    return virtualSolReserves / virtualTokenReserves;
  }

  /**
   * Get market cap in SOL
   */
  getMarketCap(bondingCurve) {
    const price = this.getCurrentPrice(bondingCurve);
    const circulatingSupply = bondingCurve.bondingCurveSupply - bondingCurve.realTokenReserves;
    
    return price * circulatingSupply;
  }

  /**
   * Subscribe to program logs for real-time events
   */
  subscribeToProgramLogs(callback) {
    try {
      const subscriptionId = this.connection.onLogs(
        this.programId,
        (logs) => {
          this.handleProgramLogs(logs, callback);
        },
        'confirmed'
      );

      console.log(`📡 Subscribed to program logs: ${subscriptionId}`);
      return subscriptionId;
    } catch (error) {
      console.error('❌ Error subscribing to program logs:', error);
      throw error;
    }
  }

  /**
   * Handle program logs
   */
  handleProgramLogs(logs, callback) {
    try {
      // Parse logs for events
      const logMessages = logs.logs;
      
      // Look for specific event patterns
      logMessages.forEach(log => {
        if (log.includes('Agent created successfully!')) {
          callback({
            type: 'AgentCreated',
            signature: logs.signature,
            logs: logMessages
          });
        } else if (log.includes('Tokens purchased successfully!')) {
          callback({
            type: 'TokensPurchased',
            signature: logs.signature,
            logs: logMessages
          });
        } else if (log.includes('Tokens sold successfully!')) {
          callback({
            type: 'TokensSold',
            signature: logs.signature,
            logs: logMessages
          });
        } else if (log.includes('Agent graduated to DEX!')) {
          callback({
            type: 'AgentGraduated',
            signature: logs.signature,
            logs: logMessages
          });
        }
      });
    } catch (error) {
      console.error('❌ Error handling program logs:', error);
    }
  }

  /**
   * Unsubscribe from program logs
   */
  async unsubscribeFromLogs(subscriptionId) {
    try {
      await this.connection.removeOnLogsListener(subscriptionId);
      console.log(`📡 Unsubscribed from program logs: ${subscriptionId}`);
    } catch (error) {
      console.error('❌ Error unsubscribing from logs:', error);
    }
  }

  /**
   * Get transaction details
   */
  async getTransaction(signature) {
    try {
      const tx = await this.connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0
      });

      return tx;
    } catch (error) {
      console.error('❌ Error fetching transaction:', error);
      throw error;
    }
  }

  /**
   * Get SOL balance
   */
  async getBalance(publicKey) {
    try {
      const pubkey = new PublicKey(publicKey);
      const balance = await this.connection.getBalance(pubkey);
      
      return {
        lamports: balance,
        sol: balance / LAMPORTS_PER_SOL
      };
    } catch (error) {
      console.error('❌ Error fetching balance:', error);
      throw error;
    }
  }

  /**
   * Get token balance
   */
  async getTokenBalance(walletAddress, mintAddress) {
    try {
      const walletPubkey = new PublicKey(walletAddress);
      const mintPubkey = new PublicKey(mintAddress);

      const tokenAccount = await getAssociatedTokenAddress(
        mintPubkey,
        walletPubkey
      );

      const balance = await this.connection.getTokenAccountBalance(tokenAccount);

      return {
        address: tokenAccount.toString(),
        amount: balance.value.amount,
        decimals: balance.value.decimals,
        uiAmount: balance.value.uiAmount
      };
    } catch (error) {
      console.error('❌ Error fetching token balance:', error);
      return {
        amount: '0',
        decimals: 9,
        uiAmount: 0
      };
    }
  }

  /**
   * Initialize the Agent Factory (one-time operation)
   */
  async initializeFactory() {
    try {
      if (!this.program || !this.wallet) {
        throw new Error('Program or wallet not initialized');
      }

      // Ensure Factory PDA is initialized
      if (!this.factoryPda) {
        console.log('⚠️ Factory PDA not initialized, initializing now...');
        this.initializeFactoryPda();
      }

      console.log('🔍 Debug - Factory PDA:', this.factoryPda?.toString());
      console.log('🔍 Debug - Authority:', this.wallet.publicKey.toString());
      console.log('🔍 Debug - Platform Treasury:', this.platformTreasury?.toString());

      // Check if factory is already initialized
      try {
        const factoryAccount = await this.program.account.agentFactory.fetch(this.factoryPda);
        console.log('✅ Factory already initialized');
        return {
          success: true,
          alreadyInitialized: true,
          factoryPda: this.factoryPda.toString(),
          totalAgents: factoryAccount.totalAgents.toString()
        };
      } catch (error) {
        // Factory not initialized yet, continue with initialization
        console.log('🏭 Factory not initialized, initializing now...');
      }

      // Initialize factory (creation_fee parameter required)
      const creationFee = new BN(1000000); // 0.001 SOL creation fee
      const tx = await this.program.methods
        .initialize(creationFee)
        .accounts({
          factory: this.factoryPda,
          authority: this.wallet.publicKey,
          platformTreasury: this.platformTreasury,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log('✅ Factory initialized! Transaction:', tx);

      // Wait for confirmation
      await this.connection.confirmTransaction(tx, 'confirmed');

      // Fetch factory data
      const factoryData = await this.program.account.agentFactory.fetch(this.factoryPda);

      return {
        success: true,
        signature: tx,
        factoryPda: this.factoryPda.toString(),
        authority: factoryData.authority.toString(),
        platformTreasury: factoryData.platformTreasury.toString(),
        totalAgents: factoryData.totalAgents.toString(),
        platformFee: factoryData.platformFee,
        creatorFee: factoryData.creatorFee
      };
    } catch (error) {
      console.error('❌ Error initializing factory:', error);
      throw error;
    }
  }

  /**
   * Create a new AI Agent with bonding curve
   */
  async createAgent(params) {
    try {
      if (!this.program || !this.wallet) {
        throw new Error('Program or wallet not initialized');
      }

      const { name, symbol, description, instructions, model, category } = params;

      // Validate inputs
      if (!name || name.length === 0 || name.length > 32) {
        throw new Error('Invalid agent name (must be 1-32 characters)');
      }
      if (!symbol || symbol.length === 0 || symbol.length > 10) {
        throw new Error('Invalid symbol (must be 1-10 characters)');
      }
      if (description && description.length > 200) {
        throw new Error('Description too long (max 200 characters)');
      }
      if (instructions && instructions.length > 500) {
        throw new Error('Instructions too long (max 500 characters)');
      }

      // Get factory info to determine agent ID
      const factoryAccount = await this.program.account.agentFactory.fetch(this.factoryPda);
      const agentId = factoryAccount.totalAgents;

      console.log('🔍 DEBUG - Factory total_agents:', agentId.toString());
      console.log('🔍 DEBUG - agentId type:', typeof agentId, agentId.constructor.name);

      // Convert agentId (BN) to little-endian 8-byte buffer
      const agentIdBuffer = Buffer.alloc(8);
      agentId.toArrayLike(Buffer, 'le', 8).copy(agentIdBuffer);

      console.log('🔍 DEBUG - agentIdBuffer (hex):', agentIdBuffer.toString('hex'));
      console.log('🔍 DEBUG - agentIdBuffer (array):', Array.from(agentIdBuffer));

      // Derive PDAs
      const [agentPda] = await PublicKey.findProgramAddress(
        [Buffer.from('agent'), agentIdBuffer],
        this.programId
      );

      const [mintPda] = await PublicKey.findProgramAddress(
        [Buffer.from('mint'), agentPda.toBuffer()],
        this.programId
      );

      console.log('🎨 Creating agent:', { name, symbol, agentId: agentId.toString() });
      console.log('📍 Agent PDA:', agentPda.toString());
      console.log('🪙 Mint PDA:', mintPda.toString());

      // Create agent transaction
      let tx;
      try {
        tx = await this.program.methods
          .createAgent(
            name,
            symbol,
            description || '',
            instructions || '',
            model || 'gpt-4',
            category || 'general'
          )
          .accounts({
            factory: this.factoryPda,
            agent: agentPda,
            mint: mintPda,
            creator: this.wallet.publicKey,
            platformTreasury: this.platformTreasury,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .rpc();

        console.log('✅ Agent created! Transaction:', tx);

        // Wait for confirmation
        await this.connection.confirmTransaction(tx, 'confirmed');

        // Wait a bit for account to propagate
        console.log('⏳ Waiting for account to propagate...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Fetch agent data with retry
        let agentData;
        let retries = 3;
        while (retries > 0) {
          try {
            agentData = await this.program.account.agent.fetch(agentPda);
            break;
          } catch (err) {
            retries--;
            if (retries === 0) {
              // Account fetch failed, but transaction succeeded
              console.warn('⚠️ Account fetch failed, but transaction succeeded. Returning basic info.');
              return {
                success: true,
                signature: tx,
                agentAddress: agentPda.toString(),
                mintAddress: mintPda.toString(),
                agentId: agentId.toString(),
                name: name,
                symbol: symbol,
                creator: this.wallet.publicKey.toString(),
                bondingCurve: {
                  virtualSolReserves: '30000000000', // 30 SOL in lamports
                  virtualTokenReserves: '1073000000000000', // 1.073B tokens
                  realSolReserves: '0',
                  realTokenReserves: '0',
                }
              };
            }
            console.log(`⏳ Retrying account fetch... (${3 - retries}/3)`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        return {
          success: true,
          signature: tx,
          agentAddress: agentPda.toString(),
          mintAddress: mintPda.toString(),
          agentId: agentData.agentId.toString(),
          name: agentData.name,
          symbol: agentData.symbol,
          creator: agentData.creator.toString(),
          bondingCurve: {
            virtualSolReserves: agentData.bondingCurve.virtualSolReserves.toString(),
            virtualTokenReserves: agentData.bondingCurve.virtualTokenReserves.toString(),
            realSolReserves: agentData.bondingCurve.realSolReserves.toString(),
            realTokenReserves: agentData.bondingCurve.realTokenReserves.toString(),
          }
        };
      } catch (txError) {
        // Transaction failed
        console.error('❌ Transaction failed:', txError);
        throw txError;
      }
    } catch (error) {
      console.error('❌ Error creating agent:', error);
      throw error;
    }
  }

  /**
   * Buy agent tokens using bonding curve
   */
  async buyTokens(params) {
    try {
      if (!this.program || !this.wallet) {
        throw new Error('Program or wallet not initialized');
      }

      const { agentAddress, solAmount, minTokensOut, buyerPublicKey } = params;

      const agentPda = new PublicKey(agentAddress);
      const buyer = buyerPublicKey ? new PublicKey(buyerPublicKey) : this.wallet.publicKey;

      // Fetch agent data
      const agentData = await this.program.account.agent.fetch(agentPda);
      const mintPda = agentData.mint;

      // Get or create buyer's token account
      const buyerTokenAccount = await getAssociatedTokenAddress(
        mintPda,
        buyer
      );

      // Check if token account exists, if not create it
      const accountInfo = await this.connection.getAccountInfo(buyerTokenAccount);
      const instructions = [];

      if (!accountInfo) {
        console.log('📝 Creating associated token account for buyer...');
        instructions.push(
          createAssociatedTokenAccountInstruction(
            buyer, // payer
            buyerTokenAccount, // ata
            buyer, // owner
            mintPda, // mint
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
        );
      }

      // Convert SOL to lamports
      const solAmountFloat = parseFloat(solAmount);
      const lamports = Math.floor(solAmountFloat * LAMPORTS_PER_SOL);
      const minTokensBN = minTokensOut ? new BN(minTokensOut.toString()) : new BN(0);

      console.log('💰 Buying tokens:', {
        agent: agentAddress,
        solAmount: solAmountFloat,
        lamports,
        buyer: buyer.toString(),
        buyerTokenAccount: buyerTokenAccount.toString()
      });

      // Buy tokens transaction
      const buyTx = await this.program.methods
        .buyTokens(
          new BN(lamports),
          minTokensBN
        )
        .accounts({
          agent: agentPda,
          mint: mintPda,
          buyerTokenAccount,
          buyer,
          creator: agentData.creator,
          platformTreasury: this.platformTreasury,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .preInstructions(instructions)
        .rpc();

      const tx = buyTx;

      console.log('✅ Tokens purchased! Transaction:', tx);

      await this.connection.confirmTransaction(tx, 'confirmed');

      return {
        success: true,
        signature: tx,
        agentAddress: agentPda.toString(),
        buyer: buyer.toString(),
        solAmount,
      };
    } catch (error) {
      console.error('❌ Error buying tokens:', error);
      throw error;
    }
  }

  /**
   * Sell agent tokens using bonding curve
   */
  async sellTokens(params) {
    try {
      if (!this.program || !this.wallet) {
        throw new Error('Program or wallet not initialized');
      }

      const { agentAddress, tokenAmount, minSolOut, sellerPublicKey } = params;

      const agentPda = new PublicKey(agentAddress);
      const seller = sellerPublicKey ? new PublicKey(sellerPublicKey) : this.wallet.publicKey;

      // Fetch agent data
      const agentData = await this.program.account.agent.fetch(agentPda);
      const mintPda = agentData.mint;

      // Get seller's token account
      const sellerTokenAccount = await getAssociatedTokenAddress(
        mintPda,
        seller
      );

      // Convert token amount to proper format (with decimals)
      const tokenAmountFloat = parseFloat(tokenAmount);
      const tokenAmountWithDecimals = Math.floor(tokenAmountFloat * 1e9); // 9 decimals for SPL tokens
      const minSolBN = minSolOut ? new BN(minSolOut.toString()) : new BN(0);

      console.log('💸 Selling tokens:', {
        agent: agentAddress,
        tokenAmount: tokenAmountFloat,
        tokenAmountWithDecimals,
        seller: seller.toString()
      });

      // Sell tokens transaction
      const tx = await this.program.methods
        .sellTokens(
          new BN(tokenAmountWithDecimals),
          minSolBN
        )
        .accounts({
          agent: agentPda,
          mint: mintPda,
          sellerTokenAccount,
          seller,
          creator: agentData.creator,
          platformTreasury: this.platformTreasury,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log('✅ Tokens sold! Transaction:', tx);

      await this.connection.confirmTransaction(tx, 'confirmed');

      return {
        success: true,
        signature: tx,
        agentAddress: agentPda.toString(),
        seller: seller.toString(),
        tokenAmount,
      };
    } catch (error) {
      console.error('❌ Error selling tokens:', error);
      throw error;
    }
  }

  /**
   * Get all agents from the program
   */
  async getAllAgentsFromChain() {
    try {
      if (!this.program) {
        throw new Error('Program not initialized');
      }

      // Fetch all agent accounts
      const agents = await this.program.account.agent.all();

      return agents.map(({ publicKey, account }) => ({
        address: publicKey.toString(),
        agentId: account.agentId.toString(),
        mint: account.mint.toString(),
        creator: account.creator.toString(),
        name: account.name,
        symbol: account.symbol,
        description: account.description,
        instructions: account.instructions,
        model: account.model,
        category: account.category,
        createdAt: account.createdAt.toString(),
        isGraduated: account.isGraduated,
        bondingCurve: {
          virtualSolReserves: account.bondingCurve.virtualSolReserves.toString(),
          virtualTokenReserves: account.bondingCurve.virtualTokenReserves.toString(),
          realSolReserves: account.bondingCurve.realSolReserves.toString(),
          realTokenReserves: account.bondingCurve.realTokenReserves.toString(),
          graduationThreshold: account.bondingCurve.graduationThreshold.toString(),
          bondingCurveSupply: account.bondingCurve.bondingCurveSupply.toString(),
          totalSupply: account.bondingCurve.totalSupply.toString(),
        }
      }));
    } catch (error) {
      console.error('❌ Error fetching agents from chain:', error);
      return [];
    }
  }

  /**
   * Get agent by address
   */
  async getAgentByAddress(agentAddress) {
    try {
      if (!this.program) {
        throw new Error('Program not initialized');
      }

      const agentPda = new PublicKey(agentAddress);
      const account = await this.program.account.agent.fetch(agentPda);

      return {
        address: agentAddress,
        agentId: account.agentId.toString(),
        mint: account.mint.toString(),
        creator: account.creator.toString(),
        name: account.name,
        symbol: account.symbol,
        description: account.description,
        instructions: account.instructions,
        model: account.model,
        category: account.category,
        createdAt: account.createdAt.toString(),
        isGraduated: account.isGraduated,
        bondingCurve: {
          virtualSolReserves: account.bondingCurve.virtualSolReserves.toString(),
          virtualTokenReserves: account.bondingCurve.virtualTokenReserves.toString(),
          realSolReserves: account.bondingCurve.realSolReserves.toString(),
          realTokenReserves: account.bondingCurve.realTokenReserves.toString(),
          graduationThreshold: account.bondingCurve.graduationThreshold.toString(),
          bondingCurveSupply: account.bondingCurve.bondingCurveSupply.toString(),
          totalSupply: account.bondingCurve.totalSupply.toString(),
        }
      };
    } catch (error) {
      console.error('❌ Error fetching agent:', error);
      throw error;
    }
  }
}

module.exports = SolanaBlockchainService;

