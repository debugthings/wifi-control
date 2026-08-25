import { describe, expect, it, vi } from 'vitest';

/**
 * Mirrors groups route toggle settlement aggregation without Express/Prisma.
 */
async function settleMemberToggles(
  members: { id: string }[],
  toggleFn: (id: string) => Promise<void>
) {
  const results = await Promise.allSettled(
    members.map(async (member) => {
      await toggleFn(member.id);
      return member.id;
    })
  );

  return results.map((result, index) => {
    const networkId = members[index].id;
    if (result.status === 'fulfilled') {
      return { networkId, ok: true as const };
    }
    return {
      networkId,
      ok: false as const,
      error:
        result.reason instanceof Error
          ? result.reason.message
          : 'Toggle failed',
    };
  });
}

describe('group toggle settlement', () => {
  it('reports per-member success and failure', async () => {
    const members = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const toggleFn = vi.fn(async (id: string) => {
      if (id === 'b') throw new Error('AP offline');
    });

    const memberResults = await settleMemberToggles(members, toggleFn);

    expect(memberResults).toEqual([
      { networkId: 'a', ok: true },
      { networkId: 'b', ok: false, error: 'AP offline' },
      { networkId: 'c', ok: true },
    ]);
    expect(toggleFn).toHaveBeenCalledTimes(3);
  });
});
