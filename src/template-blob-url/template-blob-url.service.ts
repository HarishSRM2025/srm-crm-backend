import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { CreateTemplateBlobUrlDto } from './dto/create-template-blob-url.dto';
import { UpdateTemplateBlobUrlDto } from './dto/update-template-blob-url.dto';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';
import * as path from 'path';

@Injectable()
export class TemplateBlobUrlService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createDto: CreateTemplateBlobUrlDto) {
    if (!createDto.template_password || createDto.template_password.trim() === '') {
      throw new BadRequestException('Access password is required');
    }

    // Auto-generate a secure token for the blob link
    const secureToken = crypto.randomUUID();

    return this.prisma.templateBlobUrl.create({
      data: {
        template_blob_url_name: createDto.template_blob_url_name ?? '',
        template_file: createDto.template_file ?? '',
        template_blob_url: secureToken,
        template_blob_url_epires_duriation:
          this.toNumber(createDto.template_blob_url_epires_duriation),
        template_url_status: createDto.template_url_status ?? 'active',
        template_password: createDto.template_password,
      },
    });
  }

  async findAll() {
    return this.prisma.templateBlobUrl.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const record = await this.prisma.templateBlobUrl.findUnique({
      where: { id },
    });

    if (!record) {
      throw new NotFoundException(`TemplateBlobUrl with id ${id} not found`);
    }

    return record;
  }

  async update(id: number, updateDto: UpdateTemplateBlobUrlDto) {
    await this.ensureExists(id);

    if (updateDto.template_password !== undefined && (!updateDto.template_password || updateDto.template_password.trim() === '')) {
      throw new BadRequestException('Access password cannot be empty');
    }

    return this.prisma.templateBlobUrl.update({
      where: { id },
      data: {
        ...(updateDto.template_blob_url_name !== undefined && {
          template_blob_url_name: updateDto.template_blob_url_name,
        }),
        ...(updateDto.template_file !== undefined && {
          template_file: updateDto.template_file,
        }),
        ...(updateDto.template_blob_url !== undefined && {
          template_blob_url: updateDto.template_blob_url,
        }),
        ...(updateDto.template_blob_url_epires_duriation !== undefined && {
          template_blob_url_epires_duriation: this.toNumber(
            updateDto.template_blob_url_epires_duriation,
          ),
        }),
        ...(updateDto.template_url_status !== undefined && {
          template_url_status: updateDto.template_url_status,
        }),
        ...(updateDto.template_password !== undefined && {
          template_password: updateDto.template_password,
        }),
      },
    });
  }

  async remove(id: number) {
    await this.ensureExists(id);
    await this.prisma.templateBlobUrl.delete({ where: { id } });

    return { id, deleted: true };
  }

  async getTemplateFileDetails(filename: string, password?: string) {
    const record = await this.prisma.templateBlobUrl.findFirst({
      where: { template_file: filename },
    });

    if (!record) {
      throw new NotFoundException(`File ${filename} was not found`);
    }

    if (record.template_url_status === 'inactive') {
      throw new ForbiddenException('This link has been deactivated');
    }

    // Access password is mandatory
    if (!password || record.template_password !== password) {
      throw new ForbiddenException('Invalid password for this template');
    }

    // Initialize firstViewedAt if it's the first time accessing
    let firstViewedAt = record.firstViewedAt;
    if (!firstViewedAt) {
      firstViewedAt = new Date();
      await this.prisma.templateBlobUrl.update({
        where: { id: record.id },
        data: { firstViewedAt },
      });
    }

    if (record.template_blob_url_epires_duriation > 0) {
      const expiresAt = new Date(
        firstViewedAt.getTime() +
          record.template_blob_url_epires_duriation * 60 * 1000,
      );
      if (new Date() > expiresAt) {
        throw new ForbiddenException('This secure link has expired');
      }
    }

    return record;
  }

  async getTemplateBySlug(slug: string) {
    const record = await this.prisma.templateBlobUrl.findFirst({
      where: { template_blob_url: slug },
    });

    if (!record) {
      throw new NotFoundException('Template not found or link is invalid');
    }

    // Return template info but NOT the password or internal filename
    return {
      id: record.id,
      template_blob_url_name: record.template_blob_url_name,
      template_blob_url_epires_duriation: record.template_blob_url_epires_duriation,
      template_url_status: record.template_url_status,
      firstViewedAt: record.firstViewedAt,
      createdAt: record.createdAt,
      template_file_ext: path.extname(record.template_file).toLowerCase(),
    };
  }

  async verifyAndGetFileBySlug(slug: string, password: string) {
    const record = await this.prisma.templateBlobUrl.findFirst({
      where: { template_blob_url: slug },
    });

    if (!record) {
      throw new NotFoundException('Template not found or link is invalid');
    }

    if (record.template_url_status === 'inactive') {
      throw new ForbiddenException('This link has been deactivated');
    }

    // Mandatory password check
    if (!password || record.template_password !== password) {
      throw new ForbiddenException('Invalid access password');
    }

    // Set firstViewedAt if it's the first time preview is opened
    let firstViewedAt = record.firstViewedAt;
    if (!firstViewedAt) {
      firstViewedAt = new Date();
      await this.prisma.templateBlobUrl.update({
        where: { id: record.id },
        data: { firstViewedAt },
      });
    }

    // Expiry check based on firstViewedAt
    if (record.template_blob_url_epires_duriation > 0) {
      const expiresAt = new Date(
        firstViewedAt.getTime() +
          record.template_blob_url_epires_duriation * 60 * 1000,
      );
      if (new Date() > expiresAt) {
        throw new ForbiddenException('This secure link has expired');
      }
    }

    return record;
  }

  async reactivate(id: number, newPassword: string, newDuration: number) {
    await this.ensureExists(id);

    if (!newPassword || newPassword.trim() === '') {
      throw new BadRequestException('Access password is required to reactivate');
    }

    // Generate a fresh new secure token
    const newSecureToken = crypto.randomUUID();

    return this.prisma.templateBlobUrl.update({
      where: { id },
      data: {
        template_password: newPassword,
        template_blob_url_epires_duriation: this.toNumber(newDuration),
        template_blob_url: newSecureToken,
        template_url_status: 'active',
        template_activated_count: { increment: 1 },
        template_comment: null,
        firstViewedAt: null, // Reset first viewed timestamp so it starts fresh upon next view
        createdAt: new Date(),
      },
    });
  }

  async addCommentBySlug(slug: string, comment: string) {
    const record = await this.prisma.templateBlobUrl.findFirst({
      where: { template_blob_url: slug },
    });

    if (!record) {
      throw new NotFoundException('Template not found or link is invalid');
    }

    return this.prisma.templateBlobUrl.update({
      where: { id: record.id },
      data: { template_comment: comment },
    });
  }

  private async ensureExists(id: number) {
    await this.findOne(id);
  }

  private toNumber(value?: string | number) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
}