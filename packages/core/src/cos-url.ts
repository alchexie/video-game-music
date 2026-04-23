/** Build a plain COS object URL (no SDK signing) */
export function getCosBaseUrl(bucket: string, region: string, key: string): string {
  return `https://${bucket}.cos.${region}.myqcloud.com/${key}`;
}
