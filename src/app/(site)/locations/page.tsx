export const metadata = { title: 'Locations — MacVoy School of Irish Dance' };

const LOCATIONS = [
  {
    name: 'The Irish Club of Mississauga',
    address: '4120 Ridgeway Drive, Unit #39, Mississauga, Ontario',
    schedule: 'Tuesday evenings',
    website: 'http://www.irishclubmississauga.ca/',
    maps: 'https://www.google.com/maps/search/?api=1&query=4120+Ridgeway+Drive+Unit+39+Mississauga+Ontario',
  },
  {
    name: 'The Dance Experience',
    address: '1895 Clements Road, Unit #153, Pickering, Ontario',
    schedule: 'Monday & Thursday evenings',
    website: null,
    maps: 'https://www.google.com/maps/search/?api=1&query=1895+Clements+Road+Unit+153+Pickering+Ontario',
  },
];

export default function LocationsPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-3xl font-bold text-brand-pink">Locations</h1>
      <p className="mt-3 text-brand-ink/70">
        We hold classes at two studios in the Greater Toronto Area.
      </p>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        {LOCATIONS.map((loc) => (
          <div key={loc.name} className="overflow-hidden rounded-lg border border-brand-ink/10 bg-white shadow-sm">
            <iframe
              title={`Map — ${loc.name}`}
              src={`https://www.google.com/maps?q=${encodeURIComponent(loc.address)}&output=embed`}
              className="h-48 w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
            <div className="p-6">
              <h2 className="text-lg font-bold text-brand-ink">{loc.name}</h2>
              <p className="mt-2 text-brand-ink/80">{loc.address}</p>
              <p className="mt-2 text-sm font-semibold text-brand-pink">{loc.schedule}</p>
              <div className="mt-4 flex flex-wrap gap-4 text-sm">
                <a href={loc.maps} target="_blank" rel="noopener noreferrer" className="text-brand-pink hover:underline">
                  View on map
                </a>
                {loc.website && (
                  <a href={loc.website} target="_blank" rel="noopener noreferrer" className="text-brand-pink hover:underline">
                    Venue website
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
