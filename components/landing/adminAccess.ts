const API_URL =
    process.env.NEXT_PUBLIC_API_URL ?? 'https://hunt.data.lisacorp.com';

export async function hasAdminAccess(
    token: string,
    fetcher: typeof fetch = fetch,
) {
    if (!token) return false;
    try {
        const response = await fetcher(`${API_URL}/admin/analytics/access`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
        });
        if (!response.ok) return false;
        const payload = await response.json() as { is_admin?: unknown };
        return payload.is_admin === true;
    } catch {
        return false;
    }
}
