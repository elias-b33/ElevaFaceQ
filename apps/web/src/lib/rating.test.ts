import { describe, expect, it } from "vitest";
import { formatItemScore, formatRange, formatRarity, formatStanding, formatValue } from "./rating";

describe("rating display", () => {
  it("never rounds a value outside its ideal range onto the range's edge", () => {
    expect(formatValue(32.97, "%", [33, 36])).toBe("32.97%");
    expect(formatValue(34.2, "%", [33, 36])).toBe("34.2%");
    expect(formatValue(1.7649, "×", [1.78, 1.95])).toBe("1.76 ×");
    expect(formatValue(1.7799, "×", [1.78, 1.95])).toBe("1.7799 ×");
    expect(formatValue(-0.04, "% FH")).toBe("0.0 % FH");
    expect(formatValue(-1.25, "°")).toBe("−1.3°");
  });
  it("writes ranges once with their unit", () => {
    expect(formatRange([1.78, 1.95], "×")).toBe("1.78–1.95 ×");
    expect(formatRange([4, 8.5], "°")).toBe("4.0–8.5°");
    expect(formatRange([-0.4, 0.6], "% FH")).toBe("−0.4 to 0.6 % FH");
  });
  it("keeps 10.0 for values inside the ideal range", () => {
    expect(formatItemScore(9.97, 35.7, [32, 35.5])).toBe("9.9");
    expect(formatItemScore(10, 34, [32, 35.5])).toBe("10.0");
    expect(formatItemScore(9.97)).toBe("10.0");
  });
  it("describes standing and rarity", () => {
    expect(formatStanding(94.4)).toBe("Top 6%");
    expect(formatStanding(30)).toBe("Bottom 30%");
    expect(formatRarity(17.9)).toBe("1 in 18");
    expect(formatRarity(1234)).toBe("1 in 1,230");
  });
});
