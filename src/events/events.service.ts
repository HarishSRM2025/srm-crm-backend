import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { PrismaService } from '../prisma/prisma.service';
import type { EventsBooking } from '@prisma/client';

const STATUS = {
  PENDING: 'pending',
};

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createEventDto: CreateEventDto) {
    const booking = await this.prisma.eventsBooking.create({
      data: this.toBookingData(createEventDto, true),
    });

    return this.toRequest(booking);
  }

  async findAll(options?: {
    userId?: number;
    userRole?: string;
    institutionId?: number;
    departmentId?: number;
  }) {
    const bookings = await this.prisma.eventsBooking.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const requests = bookings.map((booking) => this.toRequest(booking));

    if (!options || !options.userRole) {
      return requests;
    }

    const { userId, userRole, institutionId, departmentId } = options;

    // Admin / SuperAdmin can access all requests
    if (userRole === 'Admin' || userRole === 'SuperAdmin') {
      return requests.map((r) => ({ ...r, category: r.userId === userId ? 'own' : 'approval_pending' }));
    }

    // User: can only track their own requests
    if (userRole === 'User' || userRole === 'user') {
      return requests
        .filter((r) => r.userId === userId)
        .map((r) => ({ ...r, category: 'own' }));
    }

    // HOD: returns own requests + approval queue (pending & acted)
    if (userRole === 'HOD') {
      const dept = departmentId
        ? await this.prisma.department.findUnique({
            where: { id: departmentId },
            include: { institute: true },
          })
        : null;

      const results: any[] = [];
      const addedIds = new Set<string>();

      // Own requests
      for (const r of requests) {
        if (r.userId === userId) {
          results.push({ ...r, category: 'own' });
          addedIds.add(r.id);
        }
      }

      // Approval queue (only if dept info is available)
      if (dept) {
        for (const r of requests) {
          if (addedIds.has(r.id)) continue;

          const matchesDept =
            r.form.event_department?.trim().toLowerCase() === dept.department_name.trim().toLowerCase() &&
            r.form.event_applicant_institution?.trim().toLowerCase() === dept.institute.institute_name.trim().toLowerCase();

          if (!matchesDept) continue;

          const hodStatus = r.approvals.hod?.status;
          if (hodStatus === 'pending') {
            results.push({ ...r, category: 'approval_pending' });
          } else if (hodStatus === 'approved' || hodStatus === 'rejected') {
            results.push({ ...r, category: 'approval_acted' });
          }
        }
      }

      return results;
    }

    // HOI: returns own requests + approval queue (pending & acted)
    if (userRole === 'HOI') {
      const inst = institutionId
        ? await this.prisma.institute.findUnique({
            where: { id: institutionId },
          })
        : null;

      const results: any[] = [];
      const addedIds = new Set<string>();

      // Own requests
      for (const r of requests) {
        if (r.userId === userId) {
          results.push({ ...r, category: 'own' });
          addedIds.add(r.id);
        }
      }

      // Approval queue (only if inst info is available)
      if (inst) {
        for (const r of requests) {
          if (addedIds.has(r.id)) continue;

          const matchesInst =
            r.form.event_applicant_institution?.trim().toLowerCase() === inst.institute_name.trim().toLowerCase();

          if (!matchesInst) continue;

          const hodApproved = r.approvals.hod?.status === 'approved';
          const hoiStatus = r.approvals.hoi?.status;

          if (hodApproved && hoiStatus === 'pending') {
            results.push({ ...r, category: 'approval_pending' });
          } else if (hoiStatus === 'approved' || hoiStatus === 'rejected') {
            results.push({ ...r, category: 'approval_acted' });
          }
        }
      }

      return results;
    }

    // Manager: returns own requests + approval queue (pending & acted)
    if (userRole === 'Manager') {
      const results: any[] = [];
      const addedIds = new Set<string>();

      // Own requests
      for (const r of requests) {
        if (r.userId === userId) {
          results.push({ ...r, category: 'own' });
          addedIds.add(r.id);
        }
      }

      // Approval queue
      for (const r of requests) {
        if (addedIds.has(r.id)) continue;

        const hodApproved = r.approvals.hod?.status === 'approved';
        const hoiApproved = r.approvals.hoi?.status === 'approved';
        const managerStatus = r.approvals.manager?.status;

        if (hodApproved && hoiApproved && managerStatus === 'pending') {
          results.push({ ...r, category: 'approval_pending' });
        } else if (managerStatus === 'approved' || managerStatus === 'rejected') {
          results.push({ ...r, category: 'approval_acted' });
        }
      }

      return results;
    }

    return [];
  }

  async findOne(id: string, userOptions?: {
    userId: number;
    userRole: string;
    institutionId?: number;
    departmentId?: number;
  }) {
    const booking = await this.prisma.eventsBooking.findUnique({
      where: { id: this.parseId(id) },
    });

    if (!booking) {
      throw new NotFoundException(`Event ${id} was not found`);
    }

    const request = this.toRequest(booking);

    if (userOptions && userOptions.userRole) {
      const { userId, userRole, institutionId, departmentId } = userOptions;

      if (userRole === 'Admin' || userRole === 'SuperAdmin') {
        return request;
      }

      if (userRole === 'User' || userRole === 'user') {
        if (request.userId !== userId) {
          throw new UnauthorizedException('You do not have permission to view this request.');
        }
        return request;
      }

      if (userRole === 'HOD') {
        if (!departmentId) throw new UnauthorizedException('Access denied.');
        const dept = await this.prisma.department.findUnique({
          where: { id: departmentId },
          include: { institute: true },
        });
        if (!dept) throw new UnauthorizedException('Access denied.');

        const matchesDept =
          request.form.event_department?.trim().toLowerCase() === dept.department_name.trim().toLowerCase() &&
          request.form.event_applicant_institution?.trim().toLowerCase() === dept.institute.institute_name.trim().toLowerCase();

        if (!matchesDept) {
          throw new UnauthorizedException('You can only access requests for your own department.');
        }
        return request;
      }

      if (userRole === 'HOI') {
        if (!institutionId) throw new UnauthorizedException('Access denied.');
        const inst = await this.prisma.institute.findUnique({
          where: { id: institutionId },
        });
        if (!inst) throw new UnauthorizedException('Access denied.');

        const matchesInst =
          request.form.event_applicant_institution?.trim().toLowerCase() === inst.institute_name.trim().toLowerCase();

        if (!matchesInst) {
          throw new UnauthorizedException('You can only access requests for your own institution.');
        }
        return request;
      }
    }

    return request;
  }


  async update(id: string, updateEventDto: UpdateEventDto) {
    await this.ensureExists(id);

    const booking = await this.prisma.eventsBooking.update({
      where: { id: this.parseId(id) },
      data: this.toBookingData(updateEventDto),
    });

    return this.toRequest(booking);
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.prisma.eventsBooking.delete({ where: { id: this.parseId(id) } });

    return { id: this.formatId(this.parseId(id)), deleted: true };
  }

  private async ensureExists(id: string) {
    await this.findOne(id);
  }

  private parseId(id: string) {
    const match = id.match(/\d+$/);
    return match ? Number(match[0]) : Number(id);
  }

  private formatId(id: number) {
    return `EVT-${String(id).padStart(4, '0')}`;
  }

  private toBookingData(dto: CreateEventDto | UpdateEventDto, isCreate = false) {
    const bookingData: any = {};

    if (isCreate) {
      bookingData.event_applicant_name = dto.event_applicant_name ?? '';
      bookingData.event_applicant_institution = dto.event_applicant_institution ?? '';
      bookingData.event_department = dto.event_department ?? '';
      bookingData.event_designation = dto.event_designation ?? '';
      bookingData.event_organizer_name = dto.event_organizer_name ?? '';
      bookingData.event_organizer_phone = dto.event_organizer_phone ?? '';
      bookingData.event_details = dto.event_details ?? '';
      bookingData.event_purpose = dto.event_purpose ?? '';
      bookingData.event_guest_name = dto.event_guest_name ?? '';
      bookingData.event_participant_count = this.toNumber(dto.event_participant_count);
      bookingData.event_presiding_officers = this.toNumber(dto.event_presiding_officers);
      bookingData.event_micset = this.toBoolean(dto.event_micset);
      bookingData.event_white_board = this.toBoolean(dto.event_white_board);

      const eventDate = this.parseEventDate(dto.event_date);
      const { start, end } = this.resolveTimes(
        eventDate,
        undefined,
        dto.event_start_time,
        dto.event_end_time,
      );
      bookingData.event_date = eventDate;
      bookingData.event_start_time = start;
      bookingData.event_end_time = end;
    } else {
      if (dto.event_applicant_name !== undefined) bookingData.event_applicant_name = dto.event_applicant_name;
      if (dto.event_applicant_institution !== undefined) bookingData.event_applicant_institution = dto.event_applicant_institution;
      if (dto.event_department !== undefined) bookingData.event_department = dto.event_department;
      if (dto.event_designation !== undefined) bookingData.event_designation = dto.event_designation;
      if (dto.event_organizer_name !== undefined) bookingData.event_organizer_name = dto.event_organizer_name;
      if (dto.event_organizer_phone !== undefined) bookingData.event_organizer_phone = dto.event_organizer_phone;
      if (dto.event_details !== undefined) bookingData.event_details = dto.event_details;
      if (dto.event_purpose !== undefined) bookingData.event_purpose = dto.event_purpose;

      if (dto.event_date !== undefined) {
        bookingData.event_date = this.parseEventDate(dto.event_date);
      }

      if (dto.event_start_time !== undefined || dto.event_end_time !== undefined) {
        const eventDate = dto.event_date ? this.parseEventDate(dto.event_date) : new Date();
        const { start, end } = this.resolveTimes(
          eventDate,
          undefined,
          dto.event_start_time,
          dto.event_end_time,
        );
        if (dto.event_start_time !== undefined) bookingData.event_start_time = start;
        if (dto.event_end_time !== undefined) bookingData.event_end_time = end;
      }

      if (dto.event_participant_count !== undefined) {
        bookingData.event_participant_count = this.toNumber(dto.event_participant_count);
      }
      if (dto.event_guest_name !== undefined) {
        bookingData.event_guest_name = dto.event_guest_name;
      }
      if (dto.event_presiding_officers !== undefined) {
        bookingData.event_presiding_officers = this.toNumber(dto.event_presiding_officers);
      }
      if (dto.event_micset !== undefined) {
        bookingData.event_micset = this.toBoolean(dto.event_micset);
      }
      if (dto.event_white_board !== undefined) {
        bookingData.event_white_board = this.toBoolean(dto.event_white_board);
      }
    }

    if (dto.userId !== undefined) {
      bookingData.userId = dto.userId;
    }
    if (dto.approvals !== undefined) {
      bookingData.approvals = dto.approvals;
    }
    if (dto.officeUse !== undefined) {
      bookingData.officeUse = dto.officeUse;
    }

    return bookingData;
  }

  private toRequest(booking: EventsBooking) {
    return {
      id: this.formatId(booking.id),
      databaseId: booking.id,
      userId: booking.userId,
      submittedOn: booking.createdAt.toISOString().slice(0, 10),
      form: {
        event_applicant_name: booking.event_applicant_name,
        event_applicant_institution: booking.event_applicant_institution,
        event_department: booking.event_department,
        event_designation: booking.event_designation,
        event_organizer_name: booking.event_organizer_name,
        event_organizer_phone: booking.event_organizer_phone,
        event_details: booking.event_details,
        event_purpose: booking.event_purpose,
        event_date: this.formatDate(booking.event_date),
        event_start_time: this.formatTime(booking.event_start_time),
        event_end_time: this.formatTime(booking.event_end_time),
        event_participant_count: String(booking.event_participant_count),
        event_guest_name: booking.event_guest_name,
        event_presiding_officers: String(booking.event_presiding_officers),
        event_micset: booking.event_micset,
        event_white_board: booking.event_white_board,

        // UI View compatibility keys
        purpose: booking.event_purpose,
        applicantName: booking.event_applicant_name,
        dates: this.formatDate(booking.event_date),
        institution: booking.event_applicant_institution,
        department: booking.event_department,
        designation: booking.event_designation,
        session: this.sessionFromTimes(booking.event_start_time, booking.event_end_time),
      },
      approvals: booking.approvals
        ? (booking.approvals as any)
        : {
            hod: { status: STATUS.PENDING, by: '', date: '', note: '' },
            hoi: { status: STATUS.PENDING, by: '', date: '', note: '' },
            manager: { status: STATUS.PENDING, by: '', date: '', note: '' },
          },
      officeUse: booking.officeUse
        ? (booking.officeUse as any)
        : {
            availability: '',
            allotment: '',
            allotmentItems: [],
            alternateDate: '',
          },
    };
  }

  private parseEventDate(value?: string | Date) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value;
    }

    const raw = String(value ?? '').trim();
    const firstDate = raw.split(/\s+[–-]\s+/)[0];
    const timestamp = Date.parse(firstDate);

    return Number.isNaN(timestamp) ? new Date() : new Date(timestamp);
  }

  private resolveTimes(
    date: Date,
    session?: string,
    rawStart?: string | Date,
    rawEnd?: string | Date,
  ) {
    const start = new Date(date);
    const end = new Date(date);

    if (rawStart) {
      if (typeof rawStart === 'string') {
        const match = rawStart.match(/^(\d{1,2}):(\d{2})/);
        if (match) {
          start.setHours(Number(match[1]), Number(match[2]), 0, 0);
        } else {
          const parsedStart = new Date(rawStart);
          if (!Number.isNaN(parsedStart.getTime())) {
            start.setHours(parsedStart.getHours(), parsedStart.getMinutes(), 0, 0);
          }
        }
      } else if (rawStart instanceof Date && !Number.isNaN(rawStart.getTime())) {
        start.setHours(rawStart.getHours(), rawStart.getMinutes(), 0, 0);
      }
    } else {
      if (session === 'afternoon') {
        start.setHours(13, 0, 0, 0);
      } else {
        start.setHours(8, 0, 0, 0);
      }
    }

    if (rawEnd) {
      if (typeof rawEnd === 'string') {
        const match = rawEnd.match(/^(\d{1,2}):(\d{2})/);
        if (match) {
          end.setHours(Number(match[1]), Number(match[2]), 0, 0);
        } else {
          const parsedEnd = new Date(rawEnd);
          if (!Number.isNaN(parsedEnd.getTime())) {
            end.setHours(parsedEnd.getHours(), parsedEnd.getMinutes(), 0, 0);
          }
        }
      } else if (rawEnd instanceof Date && !Number.isNaN(rawEnd.getTime())) {
        end.setHours(rawEnd.getHours(), rawEnd.getMinutes(), 0, 0);
      }
    } else {
      if (session === 'afternoon') {
        end.setHours(16, 0, 0, 0);
      } else if (session === 'forenoon') {
        end.setHours(12, 0, 0, 0);
      } else {
        end.setHours(16, 0, 0, 0);
      }
    }

    return { start, end };
  }

  private formatTime(date: Date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  private splitOrganizer(value?: string) {
    if (!value) {
      return { name: '', phone: '' };
    }

    const parts = value.split('/').map((part) => part.trim());
    return {
      name: parts[0] ?? value,
      phone: parts[1] ?? value.match(/[+\d][\d\s-]{7,}/)?.[0]?.trim() ?? '',
    };
  }

  private toNumber(value?: string | number) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private toBoolean(value?: string | boolean) {
    if (typeof value === 'boolean') {
      return value;
    }

    return value === 'required' || value === 'true';
  }

  private formatDate(date: Date) {
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }

  private sessionFromTimes(start: Date, end: Date) {
    const startHour = start.getHours();
    const endHour = end.getHours();

    if (startHour <= 8 && endHour >= 16) {
      return 'full-day';
    }

    return startHour >= 12 ? 'afternoon' : 'forenoon';
  }
}
