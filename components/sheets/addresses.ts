export type AuthorizedWallet = {
  id: number;
  address: string;
  network: string;
};

export function parseAuthorizedWallets(payload: unknown): AuthorizedWallet[] {
  if (!Array.isArray(payload)) return [];

  const wallets = payload.flatMap((item): AuthorizedWallet[] => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as {
      id?: unknown;
      address?: unknown;
      network?: unknown;
      can_auth?: unknown;
    };
    if (
      typeof candidate.id !== "number" ||
      typeof candidate.address !== "string" ||
      !/^0x[0-9a-fA-F]{40}$/.test(candidate.address) ||
      typeof candidate.network !== "string" ||
      candidate.can_auth !== true
    ) {
      return [];
    }

    return [
      {
        id: candidate.id,
        address: candidate.address,
        network: candidate.network,
      },
    ];
  });

  return Array.from(
    new Map(
      wallets.map((wallet) => [wallet.address.toLowerCase(), wallet])
    ).values()
  );
}
