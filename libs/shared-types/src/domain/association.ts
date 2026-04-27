export interface AssociationDto {
  id: string;
  name: string;
  shortName: string | null;
  taxNumber: string | null;
  foundedAt: string;
  address: string | null;
  city: string;
  district: string;
  phone: string | null;
  email: string;
  website: string | null;
  logoUrl: string | null;
  activityArea: string;
  memberCount: number;
  isActive: boolean;
  notes: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssociationStatsDto {
  totalMembers: number;
  membersByRole: Record<string, number>;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  completionRate: number;
  totalMeetings: number;
}

export interface AssociationListResponse {
  data: AssociationDto[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}
