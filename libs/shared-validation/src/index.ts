// Common
export { paginationSchema, type PaginationInput } from './schemas/common.schema';

// Meeting Notes (Toplantı Notları)
export {
  createMeetingNoteSchema,
  updateMeetingNoteSchema,
  listMeetingNotesQuerySchema,
  meetingNoteResponseSchema,
  type CreateMeetingNoteInput,
  type UpdateMeetingNoteInput,
  type ListMeetingNotesQuery,
  type MeetingNoteResponse,
} from './schemas/meeting-note.schema';

// Tasks (Görevler)
export {
  createTaskSchema,
  updateTaskStatusSchema,
  listTasksQuerySchema,
  taskResponseSchema,
  taskStatusEnum,
  taskPriorityEnum,
  reminderFrequencyEnum,
  type CreateTaskInput,
  type UpdateTaskStatusInput,
  type ListTasksQuery,
  type TaskResponse,
  type TaskStatusValue,
  type TaskPriorityValue,
  type ReminderFrequencyValue,
} from './schemas/task.schema';

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
  type CreateAssociationManagerInput,
  type UpdateAssociationInput,
  type ListAssociationsQuery,
  type AssociationResponse,
} from './schemas/association.schema';

// Association Memberships (Üyeler)
export {
  addMemberSchema,
  updateMemberSchema,
  listMembersQuerySchema,
  memberResponseSchema,
  type AddMemberInput,
  type UpdateMemberInput,
  type ListMembersQuery,
  type MemberResponse,
  type MembershipRole,
} from './schemas/membership.schema';

// Member Titles (Unvanlar)
export {
  titleResponseSchema,
  createMemberTitleSchema,
  updateMemberTitleSchema,
  listMemberTitlesQuerySchema,
  type TitleResponse,
  type CreateMemberTitleInput,
  type UpdateMemberTitleInput,
  type ListMemberTitlesQuery,
} from './schemas/title.schema';

// Helpers (pure utilities — usable from apps/api and apps/web)
export { parsePhoneE164 } from './helpers/phone';
export { isValidTaxNumber, TAX_NUMBER_PATTERN } from './helpers/tax-number';
export { slugifyTr } from './helpers/slugify';
