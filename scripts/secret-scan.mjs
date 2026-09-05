const secretPatterns = [
  /SUPABASE_SERVICE_ROLE_KEY\s*=\s*['"][^'"\s]+['"]?/,
  /['"]eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+['"]/,
];

export function findPotentialSecrets(files) {
  const findings = [];
  for (const [file, content] of Object.entries(files)) {
    for (const [index, line] of content.split(/\r?\n/).entries()) {
      if (secretPatterns.some((pattern) => pattern.test(line))) {
        findings.push({ file, line: index + 1 });
      }
    }
  }
  return findings;
}
