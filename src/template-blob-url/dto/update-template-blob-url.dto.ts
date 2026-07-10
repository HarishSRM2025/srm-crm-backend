import { PartialType } from '@nestjs/mapped-types';
import { CreateTemplateBlobUrlDto } from './create-template-blob-url.dto';

export class UpdateTemplateBlobUrlDto extends PartialType(CreateTemplateBlobUrlDto) {}
