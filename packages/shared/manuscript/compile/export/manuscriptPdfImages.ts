import type { ManuscriptImage } from '../../images/imageInfo';
import { pdfImageFor } from './manuscriptPdfLayout';

/** What the images need of the PDF writer: objects with ascii and binary bodies. */
export interface PdfObjectWriter {
  object(body: (writer: PdfObjectWriter) => void): number;
  ascii(text: string): void;
  raw(bytes: Uint8Array): void;
}

export interface PdfImagePlan {
  /** The `/XObject` resource entries for the pictures one page draws (`/Im1 12 0 R ...`), or empty. */
  resources(imageNumbers: readonly number[]): string;
  /** Writes every picture as an image XObject, each followed by its soft mask when it has one. */
  write(writer: PdfObjectWriter): void;
}

/**
 * Numbers the picture objects before they are written, so the pages (which are written first and
 * point at them) know every id: the first picture takes `firstId`, and a picture with a soft mask
 * is followed by it.
 */
export function planPdfImages(
  images: Record<string, ManuscriptImage> | undefined,
  imageOrder: ReadonlyMap<string, number>,
  firstId: number,
): PdfImagePlan {
  const ordered = [...imageOrder.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([mediaId]) => ({ mediaId, data: pdfImageFor(images ?? {}, mediaId) }));
  const ids: number[] = [];
  let next = firstId;
  for (const entry of ordered) {
    ids.push(next);
    next += entry.data?.softMask ? 2 : 1;
  }
  return {
    resources(imageNumbers) {
      if (imageNumbers.length === 0) return '';
      const entries = imageNumbers.map((number) => `/Im${number} ${ids[number - 1]} 0 R`);
      return ` /XObject << ${entries.join(' ')} >>`;
    },
    write(writer) {
      ordered.forEach(({ data }, index) => {
        if (!data) return;
        const maskId = data.softMask ? ids[index] + 1 : null;
        writer.object((body) => {
          body.ascii(
            `<< /Type /XObject /Subtype /Image /Width ${data.width} /Height ${data.height}` +
              ` /ColorSpace /${data.colorSpace} /BitsPerComponent 8 /Filter /${data.filter}` +
              `${data.decode ? ` /Decode ${data.decode}` : ''}` +
              `${maskId ? ` /SMask ${maskId} 0 R` : ''} /Length ${data.data.length} >>\nstream\n`,
          );
          body.raw(data.data);
          body.ascii('\nendstream\n');
        });
        if (data.softMask) {
          const mask = data.softMask.data;
          writer.object((body) => {
            body.ascii(
              `<< /Type /XObject /Subtype /Image /Width ${data.width} /Height ${data.height}` +
                ` /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode` +
                ` /Length ${mask.length} >>\nstream\n`,
            );
            body.raw(mask);
            body.ascii('\nendstream\n');
          });
        }
      });
    },
  };
}
