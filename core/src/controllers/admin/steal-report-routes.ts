export {};
import type { Application, Request, Response } from 'express';
import type { AdminContext } from './context';

const store = require('../../models/store');

const {
    getAccId,
    checkAccountAccess,
    handleApiError,
} = require('./middleware');

function mountStealReportRoutes(app: Application, ctx: AdminContext): void {
    app.get('/api/steal-reports', async (req: Request, res: Response) => {
        const id = getAccId(ctx, req);
        if (!id) return res.status(400).json({ ok: false, error: 'Missing x-account-id' });

        if (!checkAccountAccess(ctx, req as any, id)) {
            return res.status(403).json({ ok: false, error: 'Access denied' });
        }

        try {
            const data = store.getStealReports({
                ...req.query,
                accountId: id,
            });
            res.json({ ok: true, data });
        } catch (e: any) {
            handleApiError(res, e);
        }
    });

    app.get('/api/friend-value-ranking', async (req: Request, res: Response) => {
        const id = getAccId(ctx, req);
        if (!id) return res.status(400).json({ ok: false, error: 'Missing x-account-id' });

        if (!checkAccountAccess(ctx, req as any, id)) {
            return res.status(403).json({ ok: false, error: 'Access denied' });
        }

        try {
            const data = store.getFriendValueRanking({
                ...req.query,
                accountId: id,
            });
            res.json({ ok: true, data });
        } catch (e: any) {
            handleApiError(res, e);
        }
    });
}

module.exports = { mountStealReportRoutes };
