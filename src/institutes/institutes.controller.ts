import { Controller, Get, Post, Delete, Param, Body, ParseIntPipe } from '@nestjs/common';
import { InstitutesService } from './institutes.service';

@Controller('institutes')
export class InstitutesController {
  constructor(private readonly institutesService: InstitutesService) {}

  @Get()
  findAll() {
    return this.institutesService.findAll();
  }

  @Post()
  create(@Body('institute_name') name: string) {
    return this.institutesService.create(name);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.institutesService.remove(id);
  }
}
