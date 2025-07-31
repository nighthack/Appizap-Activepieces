import { PieceMetadataModel, PieceMetadataModelSummary } from '@activepieces/pieces-framework'
import { AppSystemProp, apVersionUtil } from '@activepieces/server-shared'
import { ListVersionsResponse, PackageType, PieceSyncMode, PieceType } from '@activepieces/shared'
import dayjs from 'dayjs'
import { FastifyBaseLogger } from 'fastify'
import { StatusCodes } from 'http-status-codes'
import { repoFactory } from '../core/db/repo-factory'
import { parseAndVerify } from '../helper/json-validator'
import { system } from '../helper/system/system'
import { systemJobsSchedule } from '../helper/system-jobs'
import { SystemJobName } from '../helper/system-jobs/common'
import { systemJobHandlers } from '../helper/system-jobs/job-handlers'
import { PieceMetadataEntity } from './piece-metadata-entity'
import { pieceMetadataService } from './piece-metadata-service'
import { readFile } from 'fs/promises';
import path from 'path';

const CLOUD_API_URL = 'https://cloud.activepieces.com/api/v1/pieces'
const piecesRepo = repoFactory(PieceMetadataEntity)
const syncMode = system.get<PieceSyncMode>(AppSystemProp.PIECES_SYNC_MODE)

export const pieceSyncService = (log: FastifyBaseLogger) => ({
    async setup(): Promise<void> {
        if (syncMode !== PieceSyncMode.OFFICIAL_AUTO) {
            log.info('Piece sync service is disabled')
            return
        }
        systemJobHandlers.registerJobHandler(SystemJobName.PIECES_SYNC, async function syncPiecesJobHandler(): Promise<void> {
            await pieceSyncService(log).sync()
        })
        await pieceSyncService(log).sync()
        await systemJobsSchedule(log).upsertJob({
            job: {
                name: SystemJobName.PIECES_SYNC,
                data: {},
            },
            schedule: {
                type: 'repeated',
                cron: '0 */1 * * *',
            },
        })
    },
    async sync(): Promise<void> {
        if (syncMode !== PieceSyncMode.OFFICIAL_AUTO) {
            log.info('Piece sync service is disabled')
            return
        }
        try {
            log.info({ time: dayjs().toISOString() }, 'Syncing pieces')
            const pieces = await listPieces()
            const promises: Promise<void>[] = []

            for (const { name, version } of pieces) {
                const alreadySynced = await existsInDatabase({ name, version });
                if (!alreadySynced) {
                    promises.push(syncPiece(name, version, log));
                }
            }
            await Promise.all(promises)
        }
        catch (error) {
            log.error({ error }, 'Error syncing pieces')
        }
    },
})

async function syncPiece(name: string, version: string, log: FastifyBaseLogger): Promise<void> {
    try {
        log.info({ name, version }, 'Syncing piece metadata into database')
        const piece = await getOrThrow({ name, version });
        await pieceMetadataService(log).create({
            pieceMetadata: piece,
            packageType: piece.packageType,
            pieceType: piece.pieceType,
        });
    } catch (error) {
        log.error(error, 'Error syncing piece, please upgrade the activepieces to latest version');
    }

}
async function existsInDatabase({ name, version }: { name: string, version: string }): Promise<boolean> {
    return piecesRepo().existsBy({
        name,
        version,
        pieceType: PieceType.OFFICIAL,
        packageType: PackageType.REGISTRY,
    })
}

async function getVersions({ name }: { name: string }): Promise<ListVersionsResponse> {
    const queryParams = new URLSearchParams()
    queryParams.append('edition', system.getEdition())
    queryParams.append('release', await apVersionUtil.getCurrentRelease())
    queryParams.append('name', name)
    const url = `${CLOUD_API_URL}/versions?${queryParams.toString()}`
    const response = await fetch(url)
    return parseAndVerify<ListVersionsResponse>(ListVersionsResponse, (await response.json()))
}

async function getOrThrow({ name, version }: { name: string, version: string }): Promise<PieceMetadataModel> {
    const response = await fetch(
        `${CLOUD_API_URL}/${name}${version ? '?version=' + version : ''}`,
    )
    return response.json()
}

async function listPieces(): Promise<{ name: string; version: string }[]> {
    const filePath = path.join(__dirname, '../../assets/frozen-piece-versions.json');
    const fileContent = await readFile(filePath, 'utf-8');
    return JSON.parse(fileContent);
}
