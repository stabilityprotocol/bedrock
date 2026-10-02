/**
 * @fileoverview Simplified ABI definitions for Grandfather and Subcontract
 * @description Human-readable ABIs for use with the Stability ZKT API
 *
 * Updated to match contracts/Grandfather.sol (Solidity ^0.8.24)
 */

/**
 * Grandfather Contract ABI
 * Factory and registry contract for Subcontract deployment
 *
 * State Variables (public getters auto-generated):
 * - registry(address) -> bytes32
 * - isAuthorizedChild(address) -> bool
 */
const GrandfatherABI = [
  // View Functions
  'function getCallerAddress() view returns (address)',
  // Public mapping getter for registry(address) -> (bytes32 firstHash, bytes32 finalHash)
  'function registry(address) view returns (bytes32 firstHash, bytes32 finalHash)',
  'function isAuthorizedChild(address) view returns (bool)',
  // Reverse lookup mapping getters
  'function finalHashToSubcontract(bytes32) view returns (address)',
  'function firstHashToSubcontract(bytes32) view returns (address)',
  // Convenience view functions (optional, but present in contract)
  'function getSubcontractByFinalHash(bytes32) view returns (address)',
  'function getSubcontractByFirstHash(bytes32) view returns (address)',

  // Write Functions
  'function createSubcontract() returns (address)',
  'function updateRegistry(bytes32 _firstHash, bytes32 _finalHash)',

  // Events
  'event SubcontractCreated(address indexed subcontractAddress, address indexed owner)',
  'event RegistryUpdated(address indexed subcontract, bytes32 firstHash, bytes32 finalHash)'
];

/**
 * Subcontract ABI
 * Vault and event logger for hash chain management
 *
 * State Variables (public getters auto-generated):
 * - owner() -> address (immutable)
 * - grandfather() -> address (immutable)
 * - deploymentBlock() -> uint256 (immutable)
 * - totalEntries() -> uint256
 * - isFinalized() -> bool
 *
 * Note: currentHash is PRIVATE - no getter exists on-chain.
 * The application must track currentHash locally after each addCumulativeHash call.
 */
const SubcontractABI = [
  // View Functions (auto-generated from public state variables)
  'function owner() view returns (address)',
  'function grandfather() view returns (address)',
  'function deploymentBlock() view returns (uint256)',
  'function totalEntries() view returns (uint256)',
  'function isFinalized() view returns (bool)',
  'function isInitialized() view returns (bool)',

  // Write Functions
  'function addCumulativeHash(bytes32 _hash, bool _isFinal, bool _isFirst) external',

  // Events
  'event HashRecorded(bytes32 indexed previousHash, bytes32 indexed newHash, uint256 indexed sequence)',
  'event Finalized(bytes32 finalHash)',
  'event Initialized(bytes32 firstHash)'
];

export { GrandfatherABI, SubcontractABI };
