export function normalizeProductClaimCodeInput(code: string) {
  return code
    .trim()
    .toLowerCase()
    .replace(/[\s-]/g, "");
}

export function formatProductClaimCodeForDisplay(code: string, groupSize = 4) {
  const normalizedCode = normalizeProductClaimCodeInput(code).toUpperCase();
  if (!normalizedCode) return "";

  const normalizedGroupSize =
    Number.isInteger(groupSize) && groupSize > 0 ? groupSize : 4;

  const chunks = normalizedCode.match(
    new RegExp(`.{1,${normalizedGroupSize}}`, "g")
  );
  return chunks?.join("-") ?? normalizedCode;
}
