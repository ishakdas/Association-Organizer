// Common
export { paginationSchema, type PaginationInput } from './schemas/common.schema';

// Meeting Notes (placeholder — title/content shape; will be expanded with
// associationId/meetingDate/attendees once meeting-notes module is rebuilt)
export {
  createMeetingNoteSchema,
  updateMeetingNoteSchema,
  type CreateMeetingNoteInput,
  type UpdateMeetingNoteInput,
} from './schemas/meeting-note.schema';

// Auth
export {
  telegramLinkRequestSchema,
  telegramLinkRedeemSchema,
  botAuthPayloadSchema,
  type TelegramLinkRequestInput,
  type TelegramLinkRedeemInput,
  type BotAuthPayload,
} from './schemas/auth.schema';

// Associations (Dernek Sicili)
export {
  createAssociationSchema,
  updateAssociationSchema,
  listAssociationsQuerySchema,
  associationResponseSchema,
  type CreateAssociationInput,
  type UpdateAssociationInput,
  type ListAssociationsQuery,
  type AssociationResponse,
} from './schemas/association.schema';

// Helpers (pure utilities — usable from apps/api and apps/web)
export { parsePhoneE164 } from './helpers/phone';
export { isValidTaxNumber, TAX_NUMBER_PATTERN } from './helpers/tax-number';
