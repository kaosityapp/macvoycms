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
    </div>
  );
}
