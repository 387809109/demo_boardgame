import { describe, it, expect, vi } from 'vitest';
import { WaitingRoom } from './waiting-room.js';

describe('WaitingRoom return-to-room flow', () => {
  it('areAllPlayersReturned should return true outside return phase', () => {
    const ctx = {
      room: {
        returnToRoomPhase: false,
        players: [{ id: 'p1' }, { id: 'p2' }],
        returnStatus: { p1: false, p2: false }
      },
      isReturnToRoomPhase: WaitingRoom.prototype.isReturnToRoomPhase
    };

    const result = WaitingRoom.prototype.areAllPlayersReturned.call(ctx);
    expect(result).toBe(true);
  });

  it('areAllPlayersReturned should check each player during return phase', () => {
    const ctx = {
      room: {
        returnToRoomPhase: true,
        players: [{ id: 'p1' }, { id: 'p2' }],
        returnStatus: { p1: true, p2: false }
      },
      isReturnToRoomPhase: WaitingRoom.prototype.isReturnToRoomPhase
    };

    const result = WaitingRoom.prototype.areAllPlayersReturned.call(ctx);
    expect(result).toBe(false);
  });

  it('getStartHintText should prompt waiting message in return phase', () => {
    const hostCtx = {
      room: { returnToRoomPhase: true },
      isReturnToRoomPhase: WaitingRoom.prototype.isReturnToRoomPhase
    };
    const playerCtx = {
      room: { returnToRoomPhase: true },
      isReturnToRoomPhase: WaitingRoom.prototype.isReturnToRoomPhase
    };

    const hostHint = WaitingRoom.prototype.getStartHintText.call(hostCtx, true, 4, 4, false);
    const playerHint = WaitingRoom.prototype.getStartHintText.call(playerCtx, false, 4, 4, false);

    expect(hostHint).toBe('等待所有玩家返回房间后可开始新一局');
    expect(playerHint).toBe('等待其他玩家返回房间...');
  });

  it('updateReturnStatus should persist status and request re-render', () => {
    const renderSpy = vi.fn();
    const ctx = {
      room: {},
      _render: renderSpy
    };

    WaitingRoom.prototype.updateReturnStatus.call(ctx, { p1: true, p2: false }, false);

    expect(ctx.room.returnToRoomPhase).toBe(true);
    expect(ctx.room.returnStatus).toEqual({ p1: true, p2: false });
    expect(ctx.room.allPlayersReturned).toBe(false);
    expect(renderSpy).toHaveBeenCalledTimes(1);
  });
});
