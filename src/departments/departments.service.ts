import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.department.findMany({
      orderBy: { department_name: 'asc' },
    });
  }

  async create(name: string, instituteId: number) {
    return this.prisma.department.create({
      data: {
        department_name: name,
        instituteId,
      },
    });
  }

  async remove(id: number) {
    return this.prisma.department.delete({
      where: { id },
    });
  }
}
