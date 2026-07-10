import { Injectable, StreamableFile, NotFoundException } from '@nestjs/common';
import { createReadStream, existsSync } from 'fs';
import { join } from 'path';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  getPptPreview(): StreamableFile {
    // In a real application, you would fetch the file path from a database
    // or based on some identifier.
    // For this example, ensure a file exists at 'uploads/presentation.ppt'.
    const filePath = join(process.cwd(), 'uploads/presentation.ppt');

    if (!existsSync(filePath)) {
      throw new NotFoundException(`File not found at path: ${filePath}`);
    }

    const file = createReadStream(filePath);
    return new StreamableFile(file);
  }
}
