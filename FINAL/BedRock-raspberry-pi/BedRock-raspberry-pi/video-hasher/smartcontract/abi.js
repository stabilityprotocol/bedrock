/**
 * ABI definitions for Grandfather and Subcontract.
 * Identical to backend — must stay in sync with deployed Solidity contracts.
 */

const GrandfatherABI = [
  // View Functions
  'function getCallerAddress() view returns (address)',
  'function registry(address) view returns (bytes32 firstHash, bytes32 finalHash)',
  'function isAuthorizedChild(address) view returns (bool)',
  'function finalHashToSubcontract(bytes32) view returns (address)',
  'function firstHashToSubcontract(bytes32) view returns (address)',
  'function getSubcontractByFinalHash(bytes32) view returns (address)',
  'function getSubcontractByFirstHash(bytes32) view returns (address)',

  // Write Functions
  'function createSubcontract() returns (address)',
  'function updateRegistry(bytes32 _firstHash, bytes32 _finalHash)',

  // Events
  'event SubcontractCreated(address indexed subcontractAddress, address indexed owner)',
  'event RegistryUpdated(address indexed subcontract, bytes32 firstHash, bytes32 finalHash)'
];

const SubcontractABI = [
  // View Functions
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
