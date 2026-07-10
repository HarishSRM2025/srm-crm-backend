import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InstitutesService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    const count = await this.prisma.institute.count();
    if (count === 0) {
      const seedData = [
        {
          name: 'SRM Medical College Hospital & Research Centre',
          departments: [
            'Cardiology',
            'Neurology',
            'Pediatrics',
            'General Medicine',
            'General Surgery',
            'Orthopedics',
            'Dermatology',
            'Radiology',
            'Anesthesiology',
            'Pathology',
            'Ophthalmology',
            'ENT (Otolaryngology)',
            'Obstetrics and Gynecology',
            'Psychiatry',
            'Community Medicine',
          ],
        },
        {
          name: 'SRM College of Pharmacy',
          departments: [
            'Pharmaceutics',
            'Pharmaceutical Chemistry',
            'Pharmacology',
            'Pharmacognosy',
            'Pharmacy Practice',
          ],
        },
        {
          name: 'SRM College of Nursing',
          departments: [
            'Medical Surgical Nursing',
            'Pediatric Nursing',
            'Obstetrics & Gynaecological Nursing',
            'Community Health Nursing',
            'Psychiatric Nursing',
          ],
        },
        {
          name: 'SRM College of Physiotherapy',
          departments: [
            'Orthopedics Physiotherapy',
            'Neurology Physiotherapy',
            'Cardiorespiratory Physiotherapy',
            'Sports Physiotherapy',
          ],
        },
        {
          name: 'SRM College of Occupational Therapy',
          departments: [
            'Pediatrics Occupational Therapy',
            'Neuro-rehabilitation',
            'Orthopedics Occupational Therapy',
          ],
        },
      ];

      for (const item of seedData) {
        await this.prisma.institute.create({
          data: {
            institute_name: item.name,
            departments: {
              create: item.departments.map((deptName) => ({
                department_name: deptName,
              })),
            },
          },
        });
      }
    }
  }

  async findAll() {
    return this.prisma.institute.findMany({
      include: {
        departments: {
          orderBy: { department_name: 'asc' },
        },
      },
      orderBy: { institute_name: 'asc' },
    });
  }

  async create(name: string) {
    return this.prisma.institute.create({
      data: { institute_name: name },
      include: { departments: true },
    });
  }

  async remove(id: number) {
    return this.prisma.institute.delete({
      where: { id },
    });
  }
}
