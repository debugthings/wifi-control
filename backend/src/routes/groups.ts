import express from 'express';
import { prisma } from '../index';
import { requirePin } from '../middleware/pinAuth';
import { paramId } from '../utils/params';
import { getIfaceDisabled, setIfaceEnabled } from '../services/openwrt';
import { toAccessPointConfig } from '../services/accessPointHelpers';
import { slugifyId } from '../services/networkSync';

const router = express.Router();

type AggregateStatus = 'allOn' | 'allOff' | 'mixed' | 'unreachable';

async function buildGroupStatus(groupId: string) {
  const group = await prisma.networkGroup.findUnique({
    where: { id: groupId },
    include: {
      members: {
        include: {
          network: { include: { accessPoint: true } },
        },
      },
    },
  });
  if (!group) return null;

  const memberStates = await Promise.all(
    group.members.map(async (member) => {
      const network = member.network;
      let disabled: boolean | null = null;
      let reachable = false;
      let error: string | undefined;

      if (network.enabled && network.accessPoint.enabled) {
        try {
          disabled = await getIfaceDisabled(
            toAccessPointConfig(network.accessPoint),
            network.uciSection
          );
          reachable = true;
        } catch (err) {
          error = err instanceof Error ? err.message : 'Unreachable';
        }
      }

      return {
        id: network.id,
        label: network.label,
        ssid: network.ssid,
        uciSection: network.uciSection,
        accessPoint: {
          id: network.accessPoint.id,
          name: network.accessPoint.name,
        },
        disabled,
        reachable,
        error,
      };
    })
  );

  const reachable = memberStates.filter((m) => m.reachable && m.disabled !== null);
  let status: AggregateStatus = 'unreachable';
  if (reachable.length > 0) {
    const onCount = reachable.filter((m) => m.disabled === false).length;
    const offCount = reachable.filter((m) => m.disabled === true).length;
    if (onCount === reachable.length) status = 'allOn';
    else if (offCount === reachable.length) status = 'allOff';
    else status = 'mixed';
  }

  return {
    id: group.id,
    name: group.name,
    status,
    members: memberStates,
  };
}

router.get('/', async (_req, res) => {
  try {
    const groups = await prisma.networkGroup.findMany({
      orderBy: { name: 'asc' },
      select: { id: true },
    });
    const detailed = await Promise.all(
      groups.map((g) => buildGroupStatus(g.id))
    );
    res.json({ groups: detailed.filter(Boolean) });
  } catch (error) {
    console.error('List groups error:', error);
    res.status(500).json({ error: 'Failed to list groups' });
  }
});

router.post('/', requirePin, async (req, res) => {
  const { id, name, networkIds } = req.body as {
    id?: string;
    name?: string;
    networkIds?: string[];
  };

  if (!name || !Array.isArray(networkIds) || networkIds.length === 0) {
    return res
      .status(400)
      .json({ error: 'name and at least one networkId are required' });
  }

  const groupId = (id && id.trim()) || slugifyId(name);

  try {
    const networks = await prisma.network.findMany({
      where: { id: { in: networkIds } },
    });
    if (networks.length !== networkIds.length) {
      return res.status(400).json({ error: 'One or more networks not found' });
    }

    await prisma.networkGroup.create({
      data: {
        id: groupId,
        name,
        members: {
          create: networkIds.map((networkId) => ({ networkId })),
        },
      },
    });

    const detailed = await buildGroupStatus(groupId);
    res.status(201).json(detailed);
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

router.put('/:id', requirePin, async (req, res) => {
  const groupId = paramId(req);
  const { name, networkIds } = req.body as {
    name?: string;
    networkIds?: string[];
  };

  try {
    const existing = await prisma.networkGroup.findUnique({
      where: { id: groupId },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (name !== undefined) {
      await prisma.networkGroup.update({
        where: { id: groupId },
        data: { name },
      });
    }

    if (Array.isArray(networkIds)) {
      if (networkIds.length === 0) {
        return res
          .status(400)
          .json({ error: 'networkIds must include at least one network' });
      }
      const networks = await prisma.network.findMany({
        where: { id: { in: networkIds } },
      });
      if (networks.length !== networkIds.length) {
        return res.status(400).json({ error: 'One or more networks not found' });
      }

      await prisma.$transaction([
        prisma.networkGroupMember.deleteMany({ where: { groupId } }),
        prisma.networkGroupMember.createMany({
          data: networkIds.map((networkId) => ({ groupId, networkId })),
        }),
      ]);
    }

    const detailed = await buildGroupStatus(groupId);
    res.json(detailed);
  } catch (error) {
    console.error('Update group error:', error);
    res.status(500).json({ error: 'Failed to update group' });
  }
});

router.delete('/:id', requirePin, async (req, res) => {
  try {
    await prisma.networkGroup.delete({ where: { id: paramId(req) } });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete group error:', error);
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

router.post('/:id/toggle', requirePin, async (req, res) => {
  const { enabled } = req.body as { enabled?: boolean };
  if (enabled === undefined) {
    return res.status(400).json({ error: 'enabled is required' });
  }

  try {
    const group = await prisma.networkGroup.findUnique({
      where: { id: paramId(req) },
      include: {
        members: {
          include: { network: { include: { accessPoint: true } } },
        },
      },
    });
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const results = await Promise.allSettled(
      group.members.map(async (member) => {
        await setIfaceEnabled(
          toAccessPointConfig(member.network.accessPoint),
          member.network.uciSection,
          enabled
        );
        return member.network.id;
      })
    );

    const memberResults = results.map((result, index) => {
      const networkId = group.members[index].network.id;
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

    const detailed = await buildGroupStatus(group.id);
    res.json({ ...detailed, memberResults });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Toggle failed';
    res.status(502).json({ error: message });
  }
});

export default router;
