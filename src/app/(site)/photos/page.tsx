import { InstagramEmbed } from '@/components/InstagramEmbed';
import { InstagramIcon } from '@/components/SocialIcons';

export const metadata = { title: 'Photos — MacVoy School of Irish Dance' };

const PHOTOS = [
  'group.jpg',
  '6969714.jpg',
  '9856658.jpg',
  'ajax-recital.jpg',
  '1989555.jpg',
  '3556843.jpg',
  '4943916.jpg',
  '5103469.png',
];

// Recent public posts from @macvoyschoolofirishdance, embedded via
// Instagram's official single-post embed (no API key or connected account
// needed). Update this list periodically with newer post URLs.
const INSTAGRAM_POSTS = [
  'https://www.instagram.com/macvoyschoolofirishdance/p/DbEOTpgGnjo/',
  'https://www.instagram.com/macvoyschoolofirishdance/p/DZ3KxUXMx77/',
  'https://www.instagram.com/macvoyschoolofirishdance/p/DZDrDN7Gg1J/',
  'https://www.instagram.com/macvoyschoolofirishdance/p/DYKopHqkZ6E/',
  'https://www.instagram.com/macvoyschoolofirishdance/reel/C6lzG_sOBq6/',
  'https://www.instagram.com/macvoyschoolofirishdance/reel/CwWNsfNMWHz/',
];

export default function PhotosPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="text-3xl font-bold text-brand-pink">Photos</h1>
      <p className="mt-3 text-brand-ink/70">Moments from classes, recitals, and competitions.</p>

      <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {PHOTOS.map((file) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={file}
            src={`/images/gallery/${file}`}
            alt="MacVoy School of Irish Dance"
            loading="lazy"
            className="aspect-square w-full rounded-lg object-cover shadow-sm"
          />
        ))}
      </div>

      {/* Instagram */}
      <div className="mt-16 flex items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-brand-pink">From Instagram</h2>
        <a
          href="https://www.instagram.com/macvoyschoolofirishdance/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm font-semibold text-brand-pink hover:underline"
        >
          <InstagramIcon className="h-5 w-5" />
          Follow @macvoyschoolofirishdance
        </a>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {INSTAGRAM_POSTS.map((url) => (
          <InstagramEmbed key={url} url={url} />
        ))}
      </div>
    </div>
  );
}
