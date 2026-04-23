// Common
export { paginationSchema, type PaginationInput } from './schemas/common.schema';

// Tickets
export {
  createTicketSchema,
  updateTicketSchema,
  ticketQuerySchema,
  type CreateTicketInput,
  type UpdateTicketInput,
  type TicketQueryInput,
} from './schemas/ticket.schema';

// Comments
export { createCommentSchema, type CreateCommentInput } from './schemas/comment.schema';

// Meeting Notes
export {
  createMeetingNoteSchema,
  updateMeetingNoteSchema,
  type CreateMeetingNoteInput,
  type UpdateMeetingNoteInput,
} from './schemas/meeting-note.schema';

// AI Extraction
export {
  extractedActionItemSchema,
  extractionResultSchema,
  type ExtractedActionItemOutput,
  type ExtractionResultOutput,
} from './schemas/extracted-action-item.schema';

// Extensions
export {
  createExtensionRequestSchema,
  resolveExtensionRequestSchema,
  type CreateExtensionRequestInput,
  type ResolveExtensionRequestInput,
} from './schemas/extension.schema';

// Auth
export {
  telegramLinkRequestSchema,
  telegramLinkRedeemSchema,
  botAuthPayloadSchema,
  type TelegramLinkRequestInput,
  type TelegramLinkRedeemInput,
  type BotAuthPayload,
} from './schemas/auth.schema';

// Organisations (Dernek)
export {
  createOrganisationSchema,
  updateOrganisationSchema,
  addMemberSchema,
  updateMemberRoleSchema,
  type CreateOrganisationInput,
  type UpdateOrganisationInput,
  type AddMemberInput,
  type UpdateMemberRoleInput,
} from './schemas/organisation.schema';

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
