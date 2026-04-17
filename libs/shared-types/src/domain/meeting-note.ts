export interface MeetingNoteDto {
  id: string;
  title: string;
  content: string;
  organisationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExtractedActionItemDto {
  id: string;
  meetingNoteId: string;
  content: string;
  assigneeName: string | null;
  ticketId: string | null;
  createdAt: string;
}
