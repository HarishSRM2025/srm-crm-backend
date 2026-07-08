import { Injectable, NotFoundException } from '@nestjs/common';
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
      data: this.toBookingData(createEventDto),
    });

    return this.toRequest(booking);
  }

  async findAll() {
    const bookings = await this.prisma.eventsBooking.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return bookings.map((booking) => this.toRequest(booking));
  }

  async findOne(id: string) {
    const booking = await this.prisma.eventsBooking.findUnique({
      where: { id: this.parseId(id) },
    });

    if (!booking) {
      throw new NotFoundException(`Event ${id} was not found`);
    }

    return this.toRequest(booking);
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

  private toBookingData(dto: CreateEventDto | UpdateEventDto) {
    const eventDate = this.parseEventDate(dto.event_date);
    const { start, end } = this.resolveTimes(
      eventDate,
      undefined,
      dto.event_start_time,
      dto.event_end_time,
    );

    const bookingData: any = {
      event_applicant_name: dto.event_applicant_name ?? '',
      event_applicant_institution: dto.event_applicant_institution ?? '',
      event_department: dto.event_department ?? '',
      event_designation: dto.event_designation ?? '',
      event_organizer_name: dto.event_organizer_name ?? '',
      event_organizer_phone: dto.event_organizer_phone ?? '',
      event_details: dto.event_details ?? '',
      event_purpose: dto.event_purpose ?? '',
      event_date: eventDate,
      event_start_time: start,
      event_end_time: end,
      event_participant_count: this.toNumber(dto.event_participant_count),
      event_guest_name: dto.event_guest_name ?? '',
      event_presiding_officers: this.toNumber(dto.event_presiding_officers),
      event_micset: this.toBoolean(dto.event_micset),
      event_white_board: this.toBoolean(dto.event_white_board),
    };

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
