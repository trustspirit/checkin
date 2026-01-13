// Firebase Configuration
export {
  getDb,
  isFirebaseConfigured,
  reinitializeFirebase,
  convertTimestamp,
  PARTICIPANTS_COLLECTION,
  GROUPS_COLLECTION,
  ROOMS_COLLECTION
} from './config'
export type { FirebaseConfig } from './config'

// Participant Services
export {
  searchParticipants,
  getParticipantById,
  getAllParticipants,
  getParticipantsPaginated,
  searchParticipantsPaginated,
  addParticipant,
  updateParticipant,
  checkInParticipant,
  checkOutParticipant,
  moveParticipantsToRoom,
  moveParticipantsToGroup,
  removeParticipantFromGroup,
  removeParticipantFromRoom
} from './participants'
export type {
  PaginatedResult,
  ParticipantFilters,
  CreateParticipantData,
  UpdateParticipantData
} from './participants'

// Group Services
export {
  getAllGroups,
  getGroupById,
  createOrGetGroup,
  assignParticipantToGroup,
  updateGroup,
  deleteGroup
} from './groups'

// Room Services
export {
  getAllRooms,
  getRoomById,
  createOrGetRoom,
  assignParticipantToRoom,
  updateRoom,
  deleteRoom
} from './rooms'

// Real-time Subscriptions
export { subscribeToParticipants, subscribeToGroups, subscribeToRooms } from './subscriptions'
export type { DataListener } from './subscriptions'

// CSV Import
export { importParticipantsFromCSV } from './csvImport'
