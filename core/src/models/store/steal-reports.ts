export {};

const { getDataFile } = require('../../config/runtime-paths');
const { readJsonFile, writeJsonFileAtomic } = require('../../services/json-db');

const STEAL_REPORTS_FILE: string = getDataFile('steal_reports.json');
const MAX_REPORTS_PER_ACCOUNT = 3000;

type StealReportStatus = 'success' | 'failed';
type StealReportSource = 'manual' | 'auto' | 'radar' | 'unknown';

interface StealReportInput {
    accountId?: string;
    friendGid?: string | number;
    friendName?: string;
    source?: StealReportSource | string;
    opType?: string;
    status?: StealReportStatus | string;
    success?: boolean;
    reason?: string;
    landId?: string | number | null;
    plantId?: string | number | null;
    plantName?: string;
    cropStatus?: string;
    gold?: string | number | null;
    exp?: string | number | null;
    createdAt?: string | number | Date;
}

interface StealReportQuery {
    accountId?: string;
    friendGid?: string | number;
    status?: string;
    source?: string;
    startTime?: string | number;
    endTime?: string | number;
    page?: string | number;
    pageSize?: string | number;
}

function readState(): Record<string, any[]> {
    const data = readJsonFile(STEAL_REPORTS_FILE, () => ({ accounts: {} }));
    if (!data || typeof data !== 'object') return {};
    const accounts = data.accounts && typeof data.accounts === 'object' ? data.accounts : {};
    return accounts;
}

function writeState(accounts: Record<string, any[]>): void {
    writeJsonFileAtomic(STEAL_REPORTS_FILE, {
        version: 1,
        updatedAt: new Date().toISOString(),
        accounts,
    });
}

function toFiniteNumber(value: any, fallback = 0): number {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}

function normalizeDate(value: any): string {
    if (!value) return new Date().toISOString();
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return new Date().toISOString();
    return date.toISOString();
}

function normalizeReport(input: StealReportInput): any {
    const accountId = String(input.accountId || process.env.FARM_ACCOUNT_ID || '').trim();
    const friendGid = String(input.friendGid || '').trim();
    const success = input.success !== undefined ? !!input.success : input.status === 'success';
    const status: StealReportStatus = success ? 'success' : 'failed';
    const createdAt = normalizeDate(input.createdAt);
    const seed = `${accountId}:${friendGid}:${input.landId ?? ''}:${createdAt}:${Math.random().toString(36).slice(2, 8)}`;

    return {
        id: Buffer.from(seed).toString('base64url'),
        accountId,
        friendGid,
        friendName: String(input.friendName || friendGid || '').trim(),
        source: String(input.source || 'unknown').trim(),
        opType: String(input.opType || 'steal').trim(),
        status,
        success,
        reason: String(input.reason || '').trim(),
        landId: input.landId === undefined || input.landId === null ? null : toFiniteNumber(input.landId),
        plantId: input.plantId === undefined || input.plantId === null ? null : toFiniteNumber(input.plantId),
        plantName: String(input.plantName || '').trim(),
        cropStatus: String(input.cropStatus || '').trim(),
        gold: toFiniteNumber(input.gold),
        exp: toFiniteNumber(input.exp),
        createdAt,
    };
}

function addStealReport(input: StealReportInput): any {
    const report = normalizeReport(input);
    if (!report.accountId || !report.friendGid) return report;

    const accounts = readState();
    const list = Array.isArray(accounts[report.accountId]) ? accounts[report.accountId] : [];
    accounts[report.accountId] = [report, ...list].slice(0, MAX_REPORTS_PER_ACCOUNT);
    writeState(accounts);
    return report;
}

function addStealReports(inputs: StealReportInput[]): any[] {
    const normalized = (Array.isArray(inputs) ? inputs : [])
        .map(normalizeReport)
        .filter((item: any) => item.accountId && item.friendGid);
    if (normalized.length === 0) return [];

    const accounts = readState();
    for (const report of normalized) {
        const list = Array.isArray(accounts[report.accountId]) ? accounts[report.accountId] : [];
        accounts[report.accountId] = [report, ...list].slice(0, MAX_REPORTS_PER_ACCOUNT);
    }
    writeState(accounts);
    return normalized;
}

function parseTime(value: any): number | null {
    if (value === undefined || value === null || value === '') return null;
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : null;
}

function getStealReports(query: StealReportQuery = {}): any {
    const accountId = String(query.accountId || '').trim();
    const accounts = readState();
    const source = accountId ? (accounts[accountId] || []) : Object.values(accounts).flat();
    const startTime = parseTime(query.startTime);
    const endTime = parseTime(query.endTime);
    const friendGid = query.friendGid !== undefined && query.friendGid !== null ? String(query.friendGid) : '';
    const status = String(query.status || '').trim();
    const reportSource = String(query.source || '').trim();

    const filtered = source.filter((item: any) => {
        if (friendGid && String(item.friendGid || '') !== friendGid) return false;
        if (status && status !== 'all' && String(item.status || '') !== status) return false;
        if (reportSource && reportSource !== 'all' && String(item.source || '') !== reportSource) return false;
        const itemTime = new Date(item.createdAt || 0).getTime();
        if (startTime !== null && itemTime < startTime) return false;
        if (endTime !== null && itemTime > endTime) return false;
        return true;
    });

    const page = Math.max(1, Math.floor(toFiniteNumber(query.page, 1)));
    const pageSize = Math.max(1, Math.min(200, Math.floor(toFiniteNumber(query.pageSize, 50))));
    const start = (page - 1) * pageSize;
    const rows = filtered.slice(start, start + pageSize);

    return {
        rows,
        total: filtered.length,
        page,
        pageSize,
    };
}

function getFriendValueRanking(query: StealReportQuery = {}): any {
    const days = Math.max(1, Math.min(365, Math.floor(toFiniteNumber((query as any).days, 7))));
    const since = Date.now() - days * 24 * 60 * 60 * 1000;
    const { rows } = getStealReports({ ...query, page: 1, pageSize: MAX_REPORTS_PER_ACCOUNT });
    const map = new Map<string, any>();

    for (const report of rows) {
        const key = String(report.friendGid || '');
        if (!key) continue;
        const item = map.get(key) || {
            friendGid: key,
            friendName: report.friendName || key,
            score: 0,
            successCount: 0,
            successLandCount: 0,
            failedCount: 0,
            gold: 0,
            exp: 0,
            recentSuccessCount: 0,
            matureButFailedCount: 0,
            lastSuccessAt: '',
            recommendation: '可以观察',
        };

        if (report.friendName) item.friendName = report.friendName;
        if (report.success) {
            item.successCount++;
            item.successLandCount += report.landId ? 1 : 0;
            item.gold += toFiniteNumber(report.gold);
            item.exp += toFiniteNumber(report.exp);
            if (!item.lastSuccessAt || new Date(report.createdAt).getTime() > new Date(item.lastSuccessAt).getTime()) {
                item.lastSuccessAt = report.createdAt;
            }
            if (new Date(report.createdAt).getTime() >= since) {
                item.recentSuccessCount++;
            }
        } else {
            item.failedCount++;
            if (String(report.reason || '').includes('不可偷') || String(report.reason || '').includes('已经被偷')) {
                item.matureButFailedCount++;
            }
        }

        map.set(key, item);
    }

    const list = Array.from(map.values()).map((item: any) => {
        const score = item.successCount * 20
            + item.successLandCount * 10
            + item.gold * 0.1
            + item.exp * 0.2
            + item.recentSuccessCount * 30
            - item.failedCount * 8
            - item.matureButFailedCount * 5;
        const recommendation = score >= 120
            ? '优先扫描'
            : item.failedCount > item.successCount
                ? '降低优先级'
                : item.successCount === 0
                    ? '可以跳过'
                    : '可以观察';
        return {
            ...item,
            score: Math.round(score * 10) / 10,
            recommendation,
        };
    }).sort((a: any, b: any) => b.score - a.score);

    const page = Math.max(1, Math.floor(toFiniteNumber(query.page, 1)));
    const pageSize = Math.max(1, Math.min(200, Math.floor(toFiniteNumber(query.pageSize, 50))));
    const start = (page - 1) * pageSize;

    return {
        rows: list.slice(start, start + pageSize),
        total: list.length,
        page,
        pageSize,
        days,
    };
}

module.exports = {
    addStealReport,
    addStealReports,
    getStealReports,
    getFriendValueRanking,
};
