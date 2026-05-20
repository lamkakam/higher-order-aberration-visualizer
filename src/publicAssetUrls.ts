export function resolvePublicAssetPath(
  assetPath: `/${string}`,
  basePath = import.meta.env.BASE_URL
): string {
  const normalizedBasePath = basePath.endsWith('/') ? basePath : `${basePath}/`;
  const normalizedAssetPath = assetPath.startsWith('/') ? assetPath.slice(1) : assetPath;

  return `${normalizedBasePath}${normalizedAssetPath}`;
}
