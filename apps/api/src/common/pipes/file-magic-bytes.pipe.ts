import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { readFileSync } from 'fs';

const MAGIC_BYTES: Record<string, { bytes: number[]; offset: number }> = {
  'image/jpeg': { bytes: [0xff, 0xd8, 0xff], offset: 0 },
  'image/png': { bytes: [0x89, 0x50, 0x4e, 0x47], offset: 0 },
  'image/gif': { bytes: [0x47, 0x49, 0x46], offset: 0 },
  'image/webp': { bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 },
  'application/pdf': { bytes: [0x25, 0x50, 0x44, 0x46], offset: 0 },
};

const WEBP_CHUNK = { bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 };

@Injectable()
export class FileMagicBytesPipe implements PipeTransform {
  private readonly allowedMimes: string[];

  constructor(allowedMimes: string[]) {
    this.allowedMimes = allowedMimes;
  }

  transform(file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Archivo requerido');
    if (!this.allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException(`Tipo de archivo no permitido: ${file.mimetype}`);
    }

    const magic = MAGIC_BYTES[file.mimetype];
    if (!magic) {
      throw new BadRequestException(`Tipo de archivo no soportado: ${file.mimetype}`);
    }

    try {
      const fd = readFileSync(file.path);
      for (let i = 0; i < magic.bytes.length; i++) {
        if (fd[magic.offset + i] !== magic.bytes[i]) {
          throw new BadRequestException(
            'El contenido del archivo no coincide con el tipo declarado',
          );
        }
      }
      if (file.mimetype === 'image/webp') {
        for (let i = 0; i < WEBP_CHUNK.bytes.length; i++) {
          if (fd[WEBP_CHUNK.offset + i] !== WEBP_CHUNK.bytes[i]) {
            throw new BadRequestException(
              'El contenido del archivo no coincide con el tipo declarado',
            );
          }
        }
      }
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException('Error al validar el archivo');
    }

    return file;
  }
}
