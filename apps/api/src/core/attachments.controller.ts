import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Database } from '../common/database';
import { CurrentUser, Identity } from '../common/http';
import { AttachmentStorage, attachmentSelect } from './attachment-storage';
interface ImageUpload {
  buffer: Buffer;
  size: number;
  mimetype: string;
  originalname: string;
}
@ApiTags('Private feedback attachments')
@Controller('feedback')
export class AttachmentsController {
  constructor(
    @Inject(Database) private readonly db: Database,
    @Inject(AttachmentStorage) private readonly storage: AttachmentStorage,
  ) {}
  @Post(':id/attachments')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 0, parts: 1 },
    }),
  )
  async upload(
    @CurrentUser() user: Identity,
    @Param('id') id: string,
    @UploadedFile() file?: ImageUpload,
  ) {
    const png = file?.buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const jpeg = file?.buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255]));
    if (
      !file ||
      file.size < 12 ||
      !((png && file.mimetype === 'image/png') || (jpeg && file.mimetype === 'image/jpeg'))
    )
      throw new BadRequestException('Choose a PNG or JPEG image up to 2 MB.');
    if (
      !(await this.db.feedback.findFirst({ where: { id, userId: user.id }, select: { id: true } }))
    )
      throw new NotFoundException();
    if ((await this.db.feedbackAttachment.count({ where: { feedbackId: id } })) >= 3)
      throw new BadRequestException('You can attach up to three images to a conversation.');
    return this.db.atomic(user.id, async (tx) => {
      if (!(await tx.feedback.findFirst({ where: { id, userId: user.id }, select: { id: true } })))
        throw new NotFoundException();
      if ((await tx.feedbackAttachment.count({ where: { feedbackId: id } })) >= 3)
        throw new BadRequestException('You can attach up to three images to a conversation.');
      const name =
        file.originalname.replace(/[^\p{L}\p{N}_. -]/gu, '_').slice(0, 120) || 'Screenshot';
      const key = await this.storage.put(file.buffer, tx);
      return tx.feedbackAttachment.create({
        data: {
          feedbackId: id,
          name,
          mimeType: png ? 'image/png' : 'image/jpeg',
          size: file.size,
          storageKey: key,
        },
        select: attachmentSelect,
      });
    });
  }
  @Get(':feedbackId/attachments/:id')
  async download(
    @CurrentUser() user: Identity,
    @Param('feedbackId') feedbackId: string,
    @Param('id') id: string,
    @Res() response: Response,
  ) {
    const staff = ['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'MODERATOR'].includes(user.role);
    const attachment = await this.db.feedbackAttachment.findFirst({
      where: { id, feedbackId, ...(staff ? {} : { feedback: { userId: user.id } }) },
    });
    if (!attachment) throw new NotFoundException();
    let data: Buffer;
    try {
      data = await this.storage.read(attachment.storageKey);
    } catch {
      throw new NotFoundException('This attachment is no longer available.');
    }
    response.setHeader('Content-Type', attachment.mimeType);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="screenshot.${attachment.mimeType === 'image/png' ? 'png' : 'jpg'}"`,
    );
    response.setHeader('Content-Length', data.length);
    response.send(data);
  }
}
