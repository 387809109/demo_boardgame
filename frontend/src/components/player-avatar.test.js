import { describe, it, expect } from 'vitest';
import { calculateAvatarNameMarginTop } from './player-avatar.js';

describe('PlayerAvatar layout helpers', () => {
  it('should keep zero extra margin when there are no badges', () => {
    expect(calculateAvatarNameMarginTop(0)).toBe(0);
  });

  it('should add extra margin when there is one badge', () => {
    expect(calculateAvatarNameMarginTop(1)).toBe(2);
  });

  it('should increase margin as badge count grows', () => {
    expect(calculateAvatarNameMarginTop(2)).toBe(22);
    expect(calculateAvatarNameMarginTop(3)).toBe(42);
  });

  it('should handle invalid badge counts safely', () => {
    expect(calculateAvatarNameMarginTop(-1)).toBe(0);
    expect(calculateAvatarNameMarginTop(Number.NaN)).toBe(0);
  });
});
