const DatabaseService = require('../services/DatabaseService');

// Create singleton instance
const databaseService = new DatabaseService();

// Export the singleton instance
module.exports = databaseService;
