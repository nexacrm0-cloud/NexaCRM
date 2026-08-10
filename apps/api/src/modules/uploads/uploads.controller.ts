import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import crypto from 'crypto';
import { UserRole } from '@nexa/shared';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { FileMagicBytesPipe } from '../../common/pipes/file-magic-bytes.pipe';

const ALLOWED_IMAGES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_DOCUMENTS = [...ALLOWED_IMAGES, 'application/pdf'];
const MAX_SIZE = 5 * 1024 * 1024;

// Defense-in-depth: same list keyed by mime -> accepted extension(s). Multer
// already validates the Content-Type header against ALLOWED_* and
// FileMagicBytesPipe validates the actual file header, but we ALSO reject any
// original filename whose extension is not on this list. This blocks the
// classic "PNG header + .html footer served as text/html" polyglot attack.
const EXT_BY_MIME: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'application/pdf': ['.pdf'],
};

function fileFilter(allowed: string[]) {
  return (
    _req: any,
    file: Express.Multer.File,
    cb: (error: Error | null, accept: boolean) => void,
  ) => {
    if (!allowed.includes(file.mimetype)) {
      cb(new BadRequestException(`Tipo de archivo no permitido: ${file.mimetype}`), false);
      return;
    }
    const ext = extname(file.originalname).toLowerCase();
    const ok = (EXT_BY_MIME[file.mimetype] || []).includes(ext);
    if (!ok) {
      cb(
        new BadRequestException('La extensión del archivo no coincide con el tipo declarado'),
        false,
      );
      return;
    }
    cb(null, true);
  };
}

function randomFilename(
  _req: any,
  file: Express.Multer.File,
  cb: (error: Error | null, filename: string) => void,
) {
  // Only trust the extension after whitelist above; never echo originalname.
  const ext = extname(file.originalname).toLowerCase();
  const name = crypto.randomBytes(16).toString('hex');
  cb(null, `${name}${ext}`);
}

@Controller('uploads')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UploadsController {
  @Post('logo')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/logos',
        filename: randomFilename,
      }),
      fileFilter: fileFilter(ALLOWED_IMAGES),
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  uploadLogo(@UploadedFile(new FileMagicBytesPipe(ALLOWED_IMAGES)) file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Archivo requerido');
    return { url: `/uploads/logos/${file.filename}` };
  }

  @Post('document')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MEMBER)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/documents',
        filename: randomFilename,
      }),
      fileFilter: fileFilter(ALLOWED_DOCUMENTS),
      limits: { fileSize: MAX_SIZE },
    }),
  )
  uploadDocument(
    @UploadedFile(new FileMagicBytesPipe(ALLOWED_DOCUMENTS)) file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Archivo requerido');
    return { url: `/uploads/documents/${file.filename}` };
  }
}
