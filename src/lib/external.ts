// Read the data that scripts/fetch-external.ts wrote before the build. Missing or malformed
// data yields empty sections, never a failed build.
import type { ImageMetadata } from 'astro';
import type { ExternalData } from './external-types.ts';
import { sanitizeActivity } from './github.ts';

const dataFiles = import.meta.glob<ExternalData>('/src/generated/external.json', {
  eager: true,
  import: 'default',
});
const imageFiles = import.meta.glob<ImageMetadata>('/src/generated/*.jpg', {
  eager: true,
  import: 'default',
});

const EMPTY: ExternalData = { fetchedAt: '', source: 'off', github: null, youtube: null };

export function getExternalData(): ExternalData {
  const data = dataFiles['/src/generated/external.json'];
  if (!data || typeof data !== 'object') return EMPTY;
  return {
    fetchedAt: typeof data.fetchedAt === 'string' ? data.fetchedAt : '',
    source: data.source,
    github:
      data.github && Array.isArray(data.github.repos)
        ? { activity: sanitizeActivity(data.github.activity), repos: data.github.repos }
        : null,
    youtube: data.youtube?.latest ? data.youtube : null,
  };
}

export function getGeneratedImage(name: string | null): ImageMetadata | null {
  if (!name) return null;
  return imageFiles[`/src/generated/${name}`] ?? null;
}
