export const PORTAL_COLORS: Record<string, string> = {
  linkedin: "bg-[#0a66c2] text-white",
  indeed: "bg-[#2557a7] text-white",
  glassdoor: "bg-[#0caa41] text-white",
  monster: "bg-[#6e45a5] text-white",
  bayt: "bg-[#009688] text-white",
  rozee: "bg-[#e53935] text-white",
  wellfound: "bg-black text-white",
  dice: "bg-[#eb1c26] text-white",
  careerbuilder: "bg-[#00719e] text-white",
};

export function hasValue(val: unknown): boolean {
  if (val === null || val === undefined) return false;
  if (typeof val === "string") return val.trim().length > 0;
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === "number") return val > 0;
  return false;
}
