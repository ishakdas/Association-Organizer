export interface AssociationDto {
  id: string;
  name: string;
  shortName: string | null;
  taxNumber: string;
  foundedAt: string;
  address: string;
  city: string;
  district: string;
  phone: string;
  email: string;
  website: string | null;
  logoUrl: string | null;
  activityArea: string;
  presidentName: string;
  memberCount: number;
  isActive: boolean;
  notes: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
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
