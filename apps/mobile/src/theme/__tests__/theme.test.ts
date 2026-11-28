import { colors, fonts, reader, space, type } from '..';

describe('theme tokens', () => {
  it('has the brand gradient', () => {
    expect([...colors.brandGradient]).toEqual(['#FF7A45', '#FF3D7F', '#8B5CF6']);
  });

  it('has a soft success tint matching the success colour', () => {
    expect(colors.successSoft).toBe('rgba(88,195,34,0.18)');
  });

  it('uses multiples of 4 for spacing', () => {
    for (const v of Object.values(space)) expect(v % 4).toBe(0);
  });

  it('defines the reading type 17/27 and reader glow values', () => {
    expect(type.reading.fontSize).toBe(17);
    expect(type.reading.lineHeight).toBe(27);
    expect(reader.glowSize).toBeGreaterThan(0);
    expect(reader.coverRatio).toBeLessThan(1);
  });

  it('defines cardTitle size and tracking', () => {
    expect(type.cardTitle.fontSize).toBe(22);
    expect(type.cardTitle.letterSpacing).toBe(-0.3);
  });

  it('uses Inter families and no fontWeight', () => {
    for (const style of Object.values(type)) {
      expect(Object.values(fonts)).toContain(style.fontFamily);
      expect(style).not.toHaveProperty('fontWeight');
    }
  });
});
