// Common
export { paginationSchema, type PaginationInput } from './schemas/common.schema';

// Meeting Notes (Toplantı Notları)
export {
  createMeetingNoteSchema,
  updateMeetingNoteSchema,
  listMeetingNotesQuerySchema,
  meetingNoteResponseSchema,
  analyzeMeetingContentSchema,
  preApprovedTaskSchema,
  type CreateMeetingNoteInput,
  type UpdateMeetingNoteInput,
  type ListMeetingNotesQuery,
  type MeetingNoteResponse,
  type AnalyzeMeetingContentInput,
  type PreApprovedTask,
} from './schemas/meeting-note.schema';

// Tasks (Görevler)
export {
  createTaskSchema,
  updateTaskStatusSchema,
  listTasksQuerySchema,
  listMyTasksQuerySchema,
  taskResponseSchema,
  myTaskItemSchema,
  taskActivitySchema,
  taskActivityActionEnum,
  taskStatusEnum,
  taskPriorityEnum,
  reminderFrequencyEnum,
  type CreateTaskInput,
  type UpdateTaskStatusInput,
  type ListTasksQuery,
  type ListMyTasksQuery,
  type TaskResponse,
  type MyTaskItem,
  type TaskActivity,
  type TaskActivityActionValue,
  type TaskStatusValue,
  type TaskPriorityValue,
  type ReminderFrequencyValue,
} from './schemas/task.schema';

// Auth
export {
  telegramLinkRequestSchema,
  telegramLinkRedeemSchema,
  botAuthPayloadSchema,
  requestBranchRegistrationSchema,
  approveBranchRegistrationSchema,
  checkBranchEmailSchema,
  resendInviteForUserSchema,
  type TelegramLinkRequestInput,
  type TelegramLinkRedeemInput,
  type BotAuthPayload,
  type RequestBranchRegistrationInput,
  type ApproveBranchRegistrationInput,
  type CheckBranchEmailInput,
  type ResendInviteForUserInput,
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

// AI extraction (Toplantı notlarından görev üretimi)
export {
  extractedActionItemSchema,
  extractionResultSchema,
  type ExtractedActionItemOutput,
  type ExtractionResultOutput,
} from './schemas/extracted-action-item.schema';

// Events (Etkinlik & Program Yönetimi)
export {
  eventTypeEnum,
  recurrenceTypeEnum,
  createEventSchema,
  updateEventSchema,
  listEventsQuerySchema,
  eventAssignmentInputSchema,
  updateEventAssignmentSchema,
  eventResponseSchema,
  eventAssignmentResponseSchema,
  eventListItemSchema,
  type EventTypeValue,
  type RecurrenceTypeValue,
  type CreateEventInput,
  type UpdateEventInput,
  type ListEventsQuery,
  type EventAssignmentInput,
  type UpdateEventAssignmentInput,
  type EventResponse,
  type EventAssignmentResponse,
  type EventListItem,
} from './schemas/event.schema';

// Event Role Definitions (Dernek bazlı sorumluluk rolleri)
export {
  createEventRoleSchema,
  updateEventRoleSchema,
  listEventRolesQuerySchema,
  eventRoleResponseSchema,
  type CreateEventRoleInput,
  type UpdateEventRoleInput,
  type ListEventRolesQuery,
  type EventRoleResponse,
} from './schemas/event-role.schema';

// Admin (Sistem Yönetimi)
export {
  updateProfileSchema,
  listAdminUsersQuerySchema,
  listAdminAssociationsQuerySchema,
  adminUserResponseSchema,
  adminAssociationResponseSchema,
  adminLinkTokenResponseSchema,
  type UpdateProfileInput,
  type ListAdminUsersQuery,
  type ListAdminAssociationsQuery,
  type AdminUserResponse,
  type AdminAssociationResponse,
  type AdminLinkTokenResponse,
} from './schemas/admin.schema';

// Helpers (pure utilities — usable from apps/api and apps/web)
export {
  parsePhoneE164,
  normalizeTrPhoneInput,
  formatTrPhoneDisplay,
} from './helpers/phone';
export { isValidTaxNumber, TAX_NUMBER_PATTERN } from './helpers/tax-number';
export { slugifyTr } from './helpers/slugify';
