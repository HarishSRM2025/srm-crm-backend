import { Controller, Get, Post, Body, Patch, Param, Delete, Headers } from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  create(
    @Body() createEventDto: CreateEventDto,
    @Headers('x-user-id') userIdHeader?: string,
  ) {
    if (userIdHeader && !createEventDto.userId) {
      createEventDto.userId = Number(userIdHeader);
    }
    return this.eventsService.create(createEventDto);
  }

  @Get()
  findAll(
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-role') userRole?: string,
    @Headers('x-user-institution-id') institutionId?: string,
    @Headers('x-user-department-id') departmentId?: string,
  ) {
    return this.eventsService.findAll({
      userId: userId ? Number(userId) : undefined,
      userRole,
      institutionId: institutionId ? Number(institutionId) : undefined,
      departmentId: departmentId ? Number(departmentId) : undefined,
    });
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-role') userRole?: string,
    @Headers('x-user-institution-id') institutionId?: string,
    @Headers('x-user-department-id') departmentId?: string,
  ) {
    return this.eventsService.findOne(id, {
      userId: userId ? Number(userId) : 0,
      userRole: userRole || '',
      institutionId: institutionId ? Number(institutionId) : undefined,
      departmentId: departmentId ? Number(departmentId) : undefined,
    });
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateEventDto: UpdateEventDto) {
    return this.eventsService.update(id, updateEventDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.eventsService.remove(id);
  }
}

