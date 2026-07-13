import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://shakti-gaming.web.app';
  
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/profile', '/tournaments/create'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
