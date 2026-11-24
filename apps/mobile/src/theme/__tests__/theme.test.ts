import { colors, fonts, type, space } from '..';

describe('theme tokens', () => {
  it('has the brand gradient', () => {
    expect([...colors.brandGradient]).toEqual(['#FF7A45', '#FF3D7F', '#8B5CF6']);
  });

  it('uses multiples of 4 for spacing', () => {
    Object.values(space).forEach((v) => expect(v % 4).toBe(0));
  });

  it('defines cardTitle size and tracking', () => {
    expect(type.cardTitle.fontSize).toBe(22);
    expect(type.cardTitle.letterSpacing).toBe(-0.3);
  });

  it('uses Inter families and no fontWeight', () => {
    Object.values(type).forEach((style) => {
      expect(Object.values(fonts)).toContain(style.fontFamily);
      expect(style).not.toHaveProperty('fontWeight');
    });
  });
});
