import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Res,
  Query,
} from '@nestjs/common';
import { TemplateBlobUrlService } from './template-blob-url.service';
import { CreateTemplateBlobUrlDto } from './dto/create-template-blob-url.dto';
import { UpdateTemplateBlobUrlDto } from './dto/update-template-blob-url.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import { Response } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

async function convertPptToPptx(inputFile: string, outputFile: string): Promise<void> {
  const escapedInput = inputFile.replace(/'/g, "''");
  const escapedOutput = outputFile.replace(/'/g, "''");
  const command = `powershell.exe -Command "$pptApp = New-Object -ComObject PowerPoint.Application; try { $presentation = $pptApp.Presentations.Open('${escapedInput}', $true, $true, $false); $presentation.SaveAs('${escapedOutput}', 24); $presentation.Close(); } finally { $pptApp.Quit(); [System.Runtime.InteropServices.Marshal]::ReleaseComObject($pptApp) | Out-Null; [System.GC]::Collect(); [System.GC]::WaitForPendingFinalizers(); }"`;
  await execPromise(command);
}

async function convertDocToDocx(inputFile: string, outputFile: string): Promise<void> {
  const escapedInput = inputFile.replace(/'/g, "''");
  const escapedOutput = outputFile.replace(/'/g, "''");
  const command = `powershell.exe -Command "$wordApp = New-Object -ComObject Word.Application; try { $doc = $wordApp.Documents.Open('${escapedInput}', $true, $true); $doc.SaveAs([ref]'${escapedOutput}', [ref]16); $doc.Close(); } finally { $wordApp.Quit(); [System.Runtime.InteropServices.Marshal]::ReleaseComObject($wordApp) | Out-Null; [System.GC]::Collect(); [System.GC]::WaitForPendingFinalizers(); }"`;
  await execPromise(command);
}

@Controller('template-blob-url')
export class TemplateBlobUrlController {
  constructor(
    private readonly templateBlobUrlService: TemplateBlobUrlService,
  ) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = './uploads';
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = path.extname(file.originalname);
          cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
        },
      }),
    }),
  )
  uploadFile(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return {
      originalname: file.originalname,
      filename: file.filename,
      size: file.size,
      mimetype: file.mimetype,
      url: `/template-blob-url/download/${file.filename}`,
    };
  }

  @Get('download/:filename')
  async downloadFile(
    @Param('filename') filename: string,
    @Res() res: any,
    @Query('password') password?: string,
  ) {
    await this.templateBlobUrlService.getTemplateFileDetails(filename, password);

    const filePath = path.join(process.cwd(), 'uploads', filename);
    if (!fs.existsSync(filePath)) {
      throw new BadRequestException('File does not exist on disk');
    }

    res.setHeader('Content-Disposition', 'inline');
    res.sendFile(filePath);
  }

  @Get('slug/:slug')
  getTemplateBySlug(@Param('slug') slug: string) {
    return this.templateBlobUrlService.getTemplateBySlug(slug);
  }

  @Get('view-file/:slug')
  async viewFileBySlug(
    @Param('slug') slug: string,
    @Res() res: any,
    @Query('password') password?: string,
  ) {
    const record = await this.templateBlobUrlService.verifyAndGetFileBySlug(
      slug,
      password ?? '',
    );

    let filePath = path.join(process.cwd(), 'uploads', record.template_file);
    if (!fs.existsSync(filePath)) {
      throw new BadRequestException('File does not exist on disk');
    }

    let ext = path.extname(record.template_file).toLowerCase();

    if (ext === '.ppt') {
      const pptxFilename = record.template_file.substring(0, record.template_file.length - ext.length) + '.pptx';
      const pptxFilePath = path.join(process.cwd(), 'uploads', pptxFilename);
      if (!fs.existsSync(pptxFilePath)) {
        try {
          await convertPptToPptx(filePath, pptxFilePath);
        } catch (err) {
          console.error('Failed to convert PPT to PPTX:', err);
        }
      }
      if (fs.existsSync(pptxFilePath)) {
        filePath = pptxFilePath;
        ext = '.pptx';
      }
    } else if (ext === '.doc') {
      const docxFilename = record.template_file.substring(0, record.template_file.length - ext.length) + '.docx';
      const docxFilePath = path.join(process.cwd(), 'uploads', docxFilename);
      if (!fs.existsSync(docxFilePath)) {
        try {
          await convertDocToDocx(filePath, docxFilePath);
        } catch (err) {
          console.error('Failed to convert DOC to DOCX:', err);
        }
      }
      if (fs.existsSync(docxFilePath)) {
        filePath = docxFilePath;
        ext = '.docx';
      }
    }

    let contentType = 'application/octet-stream';
    if (ext === '.pdf') {
      contentType = 'application/pdf';
    } else if (ext === '.docx') {
      contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } else if (ext === '.doc') {
      contentType = 'application/msword';
    } else if (ext === '.png') {
      contentType = 'image/png';
    } else if (ext === '.jpg' || ext === '.jpeg') {
      contentType = 'image/jpeg';
    } else if (ext === '.gif') {
      contentType = 'image/gif';
    } else if (ext === '.pptx') {
      contentType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    } else if (ext === '.ppt') {
      contentType = 'application/vnd.ms-powerpoint';
    }

    // Set headers to prevent downloading and set correct Content-Type
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(filePath);
  }

  @Patch('comment/:slug')
  async addCommentBySlug(
    @Param('slug') slug: string,
    @Body() body: { comment: string },
  ) {
    return this.templateBlobUrlService.addCommentBySlug(slug, body.comment);
  }

  @Patch(':id/reactivate')
  reactivate(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { template_password?: string; template_blob_url_epires_duriation?: number },
  ) {
    return this.templateBlobUrlService.reactivate(
      id,
      body.template_password ?? '',
      body.template_blob_url_epires_duriation ?? 0,
    );
  }

  @Post()
  create(@Body() createDto: CreateTemplateBlobUrlDto) {
    return this.templateBlobUrlService.create(createDto);
  }

  @Get()
  findAll() {
    return this.templateBlobUrlService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.templateBlobUrlService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateTemplateBlobUrlDto,
  ) {
    return this.templateBlobUrlService.update(id, updateDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.templateBlobUrlService.remove(id);
  }
}
