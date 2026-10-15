import type { ServerSelect } from '@/src/db/schema';
import {
  buildExportFileName,
  deliverFile,
  type ExportDeliveryResult,
} from '@/src/utils/io/storyTransfer';
import { userApiService } from '@/src/services/api/UserApiService';

/**
 * "Request my data": asks the server for everything it holds about this account (`GET /user/data`) and hands the
 * answer to the person as a `.json` file, through the same delivery as a story export. The server keeps no copy;
 * nothing is kept here either. Stories are not in it - they live on this device and export on their own.
 */
export async function exportAccountData(
  server: ServerSelect,
  now: Date = new Date(),
): Promise<ExportDeliveryResult> {
  const data = await userApiService.getOwnData(server);
  return deliverFile(
    JSON.stringify(data, null, 2),
    buildExportFileName(`${server.name} my data`, now),
    'application/json',
    'public.json',
  );
}
