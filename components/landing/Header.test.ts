import { describe, expect, it, vi } from 'vitest';

import { hasAdminAccess } from './adminAccess';
import { productTools } from './tools';

describe('Header admin access', () => {
    it('shows admin access only when the protected endpoint confirms it', async () => {
        const allowed = vi.fn<typeof fetch>().mockResolvedValue(
            new Response(JSON.stringify({ is_admin: true }), { status: 200 }),
        );
        const forbidden = vi.fn<typeof fetch>().mockResolvedValue(
            new Response(JSON.stringify({ detail: 'Admin access required' }), {
                status: 403,
            }),
        );

        await expect(hasAdminAccess('admin-token', allowed)).resolves.toBe(true);
        await expect(hasAdminAccess('user-token', forbidden)).resolves.toBe(false);
        await expect(hasAdminAccess('', allowed)).resolves.toBe(false);
        expect(allowed).toHaveBeenCalledWith(
            expect.stringContaining('/admin/analytics/access'),
            expect.objectContaining({
                headers: { Authorization: 'Bearer admin-token' },
                cache: 'no-store',
            }),
        );
    });
});

describe('Header tools menu', () => {
    it('exposes the supported product tools', () => {
        expect(productTools.map(({ name, href }) => ({ name, href }))).toEqual([
            { name: 'GMTrade', href: '/gmtrade' },
            { name: 'Raydium', href: '/raydium' },
        ]);
    });
});
