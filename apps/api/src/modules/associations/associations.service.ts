import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  CreateAssociationInput,
  ListAssociationsQuery,
} from '@ticketbot/shared-validation';
import { AssociationsRepository } from './associations.repository';

@Injectable()
export class AssociationsService {
  constructor(private readonly repository: AssociationsRepository) {}

  async create(input: CreateAssociationInput, createdById: string) {
    const exists = await this.repository.existsByTaxNumber(input.taxNumber);
    if (exists) {
      throw new ConflictException(
        'Bu vergi numarasıyla kayıtlı bir dernek zaten mevcut',
      );
    }

    return this.repository.create({
      ...input,
      foundedAt: new Date(input.foundedAt),
      createdById,
    });
  }

  async findOne(id: string) {
    const association = await this.repository.findById(id);
    if (!association) throw new NotFoundException('Dernek bulunamadı');
    return association;
  }

  async list(query: ListAssociationsQuery) {
    const { data, total } = await this.repository.findMany(query);
    const { page, pageSize } = query;
    return {
      data,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }
}
