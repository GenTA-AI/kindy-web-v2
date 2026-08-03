import type { MetadataRoute } from 'next';
import {
  PRESALE_ROBOTS_ALLOW,
  isProductionLaunchEnvironment,
} from '@/lib/launch-surface';

export default function robots(): MetadataRoute.Robots {
  if (!isProductionLaunchEnvironment(process.env)) {
    return {
      rules: {
        userAgent: '*',
        disallow: '/',
      },
    };
  }

  return {
    rules: {
      userAgent: '*',
      allow: [...PRESALE_ROBOTS_ALLOW],
      disallow: '/',
    },
  };
}
