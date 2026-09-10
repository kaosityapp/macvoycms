import type { MetadataRoute } from 'next';

const BASE = 'https://www.macvoyirishdance.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = [
    { path: '/', priority: 1.0, changeFrequency: 'weekly' as const },
    { path: '/classes', priority: 0.9, changeFrequency: 'weekly' as const },
    { path: '/register', priority: 0.9, changeFrequency: 'monthly' as const },
    { path: '/locations', priority: 0.8, changeFrequency: 'monthly' as const },
    { path: '/instructors', priority: 0.7, changeFrequency: 'monthly' as const },
    { path: '/photos', priority: 0.5, changeFrequency: 'monthly' as const },
    { path: '/events', priority: 0.6, changeFrequency: 'weekly' as const },
    { path: '/links', priority: 0.3, changeFrequency: 'yearly' as const },
    { path: '/contact', priority: 0.6, changeFrequency: 'yearly' as const },
  ];

  return pages.map((p) => ({
    url: `${BASE}${p.path}`,
    lastModified: new Date(),
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));
}
