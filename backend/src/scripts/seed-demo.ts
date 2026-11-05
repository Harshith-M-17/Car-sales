/**
 * Seeds demo sellers, a buyer and listings (with generated photos) for local
 * development and demos. Goes through the real services so data is valid.
 *
 *   npm run seed:demo              # 150 listings
 *   npm run seed:demo -- 500       # custom count
 *
 * Refuses to run when NODE_ENV=production.
 */
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Role } from '../common/types/auth';
import { mapWithConcurrency } from '../common/utils/concurrency';
import { AuthService } from '../modules/auth/auth.service';
import { BodyType, FuelType, Transmission } from '../modules/catalog/catalog.data';
import { ListingsService } from '../modules/listings/listings.service';
import { Listing } from '../modules/listings/schemas/listing.schema';
import { MediaService } from '../modules/media/media.service';
import { DealerBranch } from '../modules/users/schemas/user.schema';
import { UsersService } from '../modules/users/users.service';
import { renderDemoCar } from './demo-car-image';
import { loadDemoPhotos } from './demo-photos';
import { runScript } from './script-context';

const DEMO_PASSWORD = 'Demo@12345';

// [makeSlug, modelSlug, bodyType, new-car price (₹), fuels]
const MODELS: [string, string, BodyType, number, FuelType[]][] = [
  ['maruti-suzuki', 'swift', 'hatchback', 750_000, ['petrol', 'cng']],
  ['maruti-suzuki', 'baleno', 'hatchback', 800_000, ['petrol', 'cng']],
  ['maruti-suzuki', 'dzire', 'sedan', 800_000, ['petrol', 'cng']],
  ['maruti-suzuki', 'brezza', 'suv', 1_100_000, ['petrol', 'cng']],
  ['maruti-suzuki', 'ertiga', 'muv', 1_100_000, ['petrol', 'cng']],
  ['maruti-suzuki', 'wagon-r', 'hatchback', 600_000, ['petrol', 'cng']],
  ['hyundai', 'creta', 'suv', 1_500_000, ['petrol', 'diesel']],
  ['hyundai', 'venue', 'suv', 1_100_000, ['petrol', 'diesel']],
  ['hyundai', 'i20', 'hatchback', 900_000, ['petrol']],
  ['hyundai', 'verna', 'sedan', 1_400_000, ['petrol', 'diesel']],
  ['hyundai', 'grand-i10-nios', 'hatchback', 700_000, ['petrol', 'cng']],
  ['hyundai', 'aura', 'sedan', 800_000, ['petrol', 'cng']],
  ['tata', 'nexon', 'suv', 1_100_000, ['petrol', 'diesel']],
  ['tata', 'nexon-ev', 'suv', 1_500_000, ['electric']],
  ['tata', 'punch', 'suv', 800_000, ['petrol']],
  ['tata', 'tiago', 'hatchback', 600_000, ['petrol', 'cng']],
  ['mahindra', 'xuv700', 'suv', 2_200_000, ['petrol', 'diesel']],
  ['mahindra', 'thar', 'suv', 1_600_000, ['petrol', 'diesel']],
  ['mahindra', 'scorpio', 'suv', 1_400_000, ['diesel']],
  ['mahindra', 'bolero', 'suv', 1_000_000, ['diesel']],
  ['honda', 'city', 'sedan', 1_300_000, ['petrol', 'hybrid']],
  ['honda', 'amaze', 'sedan', 850_000, ['petrol']],
  ['toyota', 'innova-crysta', 'muv', 2_200_000, ['diesel']],
  ['toyota', 'fortuner', 'suv', 4_000_000, ['diesel']],
  ['toyota', 'glanza', 'hatchback', 800_000, ['petrol']],
  ['kia', 'seltos', 'suv', 1_500_000, ['petrol', 'diesel']],
  ['kia', 'sonet', 'suv', 1_100_000, ['petrol', 'diesel']],
  ['mg', 'hector', 'suv', 1_800_000, ['petrol', 'diesel']],
  ['skoda', 'slavia', 'sedan', 1_400_000, ['petrol']],
  ['volkswagen', 'virtus', 'sedan', 1_400_000, ['petrol']],
  ['renault', 'kwid', 'hatchback', 500_000, ['petrol']],
  ['bmw', '3-series', 'sedan', 5_000_000, ['petrol', 'diesel']],
  ['mercedes-benz', 'c-class', 'sedan', 5_500_000, ['petrol', 'diesel']],
  ['audi', 'q3', 'suv', 4_500_000, ['petrol']],
];

// [city, state, lat, lng, two areas as [locality, pincode]]
const CITIES: [string, string, number, number, [string, string][]][] = [
  [
    'Bengaluru',
    'Karnataka',
    12.9716,
    77.5946,
    [
      ['Indiranagar', '560038'],
      ['Whitefield', '560066'],
    ],
  ],
  [
    'Mumbai',
    'Maharashtra',
    19.076,
    72.8777,
    [
      ['Andheri West', '400053'],
      ['Powai', '400076'],
    ],
  ],
  [
    'Delhi',
    'Delhi',
    28.6139,
    77.209,
    [
      ['Karol Bagh', '110005'],
      ['Dwarka', '110075'],
    ],
  ],
  [
    'Pune',
    'Maharashtra',
    18.5204,
    73.8567,
    [
      ['Kothrud', '411038'],
      ['Hadapsar', '411028'],
    ],
  ],
  [
    'Hyderabad',
    'Telangana',
    17.385,
    78.4867,
    [
      ['Madhapur', '500081'],
      ['Kukatpally', '500072'],
    ],
  ],
  [
    'Chennai',
    'Tamil Nadu',
    13.0827,
    80.2707,
    [
      ['T. Nagar', '600017'],
      ['Velachery', '600042'],
    ],
  ],
  [
    'Ahmedabad',
    'Gujarat',
    23.0225,
    72.5714,
    [
      ['Navrangpura', '380009'],
      ['Satellite', '380015'],
    ],
  ],
  [
    'Kolkata',
    'West Bengal',
    22.5726,
    88.3639,
    [
      ['Salt Lake', '700091'],
      ['Ballygunge', '700019'],
    ],
  ],
];
const STATE_CODES: Record<string, string> = {
  Karnataka: 'KA',
  Maharashtra: 'MH',
  Delhi: 'DL',
  Telangana: 'TS',
  'Tamil Nadu': 'TN',
  Gujarat: 'GJ',
  'West Bengal': 'WB',
};
const COLORS: [string, string][] = [
  ['Pearl White', '#eef0f3'],
  ['Midnight Black', '#23262c'],
  ['Fiery Red', '#b8312f'],
  ['Silky Silver', '#b9c0c9'],
  ['Ocean Blue', '#1f5aa6'],
  ['Granite Grey', '#545b66'],
  ['Copper Bronze', '#9a5b34'],
];
const FEATURES = [
  'abs',
  'airbags',
  'reverse-camera',
  'parking-sensors',
  'touchscreen',
  'android-auto',
  'apple-carplay',
  'sunroof',
  'cruise-control',
  'keyless-entry',
  'push-button-start',
  'climate-control',
  'alloy-wheels',
  'led-headlamps',
];
/** Trim names actually used by each brand, so titles read like real listings. */
const VARIANTS: Record<string, string[]> = {
  'maruti-suzuki': ['LXi', 'VXi', 'ZXi', 'ZXi+'],
  hyundai: ['E', 'S', 'SX', 'SX(O)'],
  tata: ['XE', 'XM', 'XZ', 'XZ+'],
  mahindra: ['AX3', 'AX5', 'AX7', 'LX'],
  honda: ['V', 'VX', 'ZX'],
  toyota: ['G', 'V', 'VX', 'ZX'],
  kia: ['HTK', 'HTK+', 'HTX', 'GTX+'],
  mg: ['Style', 'Super', 'Smart', 'Sharp'],
  skoda: ['Active', 'Ambition', 'Style'],
  volkswagen: ['Comfortline', 'Highline', 'Topline', 'GT'],
  renault: ['RXE', 'RXL', 'RXT', 'Climber'],
  bmw: ['320d Luxury Line', '330i M Sport', '330Li'],
  'mercedes-benz': ['C 200', 'C 220d', 'C 300 AMG Line'],
  audi: ['35 TFSI Premium Plus', '40 TFSI Technology'],
};
/** First model year in India, so no listing predates its model (e.g. no 2017 XUV700). */
const LAUNCHED: Record<string, number> = {
  'hyundai/venue': 2019,
  'hyundai/grand-i10-nios': 2019,
  'hyundai/aura': 2020,
  'hyundai/creta': 2015,
  'maruti-suzuki/brezza': 2016,
  'maruti-suzuki/baleno': 2015,
  'toyota/glanza': 2019,
  'toyota/innova-crysta': 2016,
  'tata/nexon': 2017,
  'tata/nexon-ev': 2020,
  'tata/punch': 2021,
  'tata/tiago': 2016,
  'mahindra/xuv700': 2021,
  'mahindra/thar': 2020,
  'kia/seltos': 2019,
  'kia/sonet': 2020,
  'mg/hector': 2019,
  'skoda/slavia': 2022,
  'volkswagen/virtus': 2022,
  'renault/kwid': 2015,
  'honda/amaze': 2018,
  'audi/q3': 2019,
  'mercedes-benz/c-class': 2022,
  'bmw/3-series': 2019,
};

/** These brands don't sell manual cars in India. */
const AUTOMATIC_ONLY = new Set(['bmw', 'mercedes-benz', 'audi']);

/** Deterministic PRNG so repeated seeds produce the same data. */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

void runScript('seed-demo', async (app) => {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Refusing to seed demo data in production');
  const count = Math.max(1, Math.min(5000, Number(process.argv[2] ?? 150) || 150));
  const rand = rng(42);
  const pick = <T>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];

  const users = app.get(UsersService);
  const auth = app.get(AuthService);
  const listings = app.get(ListingsService);
  const media = app.get(MediaService);
  const listingModel = app.get<Model<Listing>>(getModelToken(Listing.name));
  const passwordHash = await auth.hashPassword(DEMO_PASSWORD);

  // Dealers (idempotent by email). Every third one has a second showroom.
  const dealers: { id: Types.ObjectId; branches: DealerBranch[] }[] = [];
  for (let i = 0; i < 12; i++) {
    const email = `demo-seller-${i + 1}@carsales.local`;
    const [city, state, lat, lng, areas] = CITIES[i % CITIES.length];
    const address = ([locality, pincode]: [string, string]) => ({
      addressLine: `${12 + i}, Auto Market Road`,
      locality,
      city,
      state,
      pincode,
    });
    const businessName = `${city} Auto Hub ${i + 1}`;
    let id = (await users.findCredentialsByEmail(email))?._id;
    if (!id) {
      const created = await users.create({
        name: businessName,
        email,
        phone: `98${String(10000000 + i * 7919).padStart(8, '0')}`,
        passwordHash,
        role: Role.Seller,
        sellerProfile: { businessName, address: address(areas[0]) },
      });
      id = new Types.ObjectId(created.id);
      await users.updateBranch(id, new Types.ObjectId(created.sellerProfile!.branches[0].id), {
        name: created.sellerProfile!.branches[0].name,
        ...address(areas[0]),
        lat,
        lng,
      });
      if (i % 3 === 0) {
        await users.addBranch(id, {
          name: `${areas[1][0]} showroom`,
          ...address(areas[1]),
          lat: lat + 0.05,
          lng: lng + 0.05,
        });
      }
    }
    const source = await users.findSnapshotSource(id);
    dealers.push({ id, branches: source!.sellerProfile!.branches });
  }
  if (!(await users.findCredentialsByEmail('demo-buyer@carsales.local'))) {
    await users.create({
      name: 'Demo Buyer',
      email: 'demo-buyer@carsales.local',
      phone: '9899999999',
      passwordHash,
      role: Role.Buyer,
    });
  }

  // Real photos (Wikimedia Commons) where curated; rendered placeholders for the rest.
  const photos = await loadDemoPhotos((msg) => console.log(msg));
  const photoTurn = new Map<string, number>();
  console.log(`Real photos available for ${photos.size}/${MODELS.length} models`);

  const now = Date.now();
  const currentYear = new Date().getFullYear();
  let done = 0;
  const created = await mapWithConcurrency(Array.from({ length: count }), 4, async () => {
    const [makeSlug, modelSlug, bodyType, newPrice, fuels] = pick(MODELS);
    const dealer = pick(dealers);
    const branch = pick(dealer.branches);
    // Rotate through each model's photos so neighbouring listings don't share one.
    const modelKey = `${makeSlug}/${modelSlug}`;
    const modelPhotos = photos.get(modelKey);
    const turn = photoTurn.get(modelKey) ?? 0;
    photoTurn.set(modelKey, turn + 1);
    const real = modelPhotos?.length ? modelPhotos[turn % modelPhotos.length] : undefined;

    // Match the listing to what the photo shows (generation and paint).
    const earliest = LAUNCHED[modelKey] ?? currentYear - 9;
    const year = real?.year
      ? Math.min(currentYear - 1, Math.max(earliest, real.year + Math.floor(rand() * 2)))
      : Math.max(earliest, currentYear - 1 - Math.floor(rand() * 9));
    const age = currentYear - year;
    const kmDriven = Math.round((age * (6000 + rand() * 9000)) / 500) * 500;
    const price = Math.max(
      150_000,
      Math.round(
        (newPrice * Math.pow(0.87, age) * (1 - Math.min(kmDriven, 150_000) / 600_000)) / 5000,
      ) * 5000,
    );
    const [randomColor, paint] = pick(COLORS);
    const colorName = real?.color ?? randomColor;
    const variant = pick(VARIANTS[makeSlug] ?? ['Base']);
    const fuelType = pick(fuels);
    const transmission: Transmission =
      fuelType === 'electric' || AUTOMATIC_ONLY.has(makeSlug) || rand() < 0.35
        ? 'automatic'
        : 'manual';

    const sellerId = dealer.id;
    const photo = real?.buffer ?? (await renderDemoCar(bodyType, paint, Math.floor(rand() * 3)));
    const [image] = await media.uploadImages(sellerId, [{ buffer: photo } as Express.Multer.File]);
    const listing = await listings.create(sellerId, {
      makeSlug,
      modelSlug,
      variant,
      year,
      kmDriven,
      fuelType,
      transmission,
      bodyType,
      ownerCount: 1 + Math.floor(rand() * rand() * 3),
      color: colorName,
      price,
      negotiable: rand() < 0.8,
      registrationState: STATE_CODES[branch.state],
      description:
        `Well maintained ${colorName.toLowerCase()} ${variant} with full service history. Single-hand driven, no accidents. Available for inspection in ${branch.city}.` +
        (real
          ? `\n\nDemo listing. Photo: ${real.author}, ${real.license}, via Wikimedia Commons (${real.source}).`
          : ''),
      features: FEATURES.filter(() => rand() < 0.45),
      branchId: branch._id.toString(),
      imageIds: [image.id],
    });
    if (++done % 25 === 0) console.log(`  ${done}/${count} listings`);
    return { id: listing.id, publishedAt: new Date(now - Math.floor(rand() * 40 * 86_400_000)) };
  });

  // Spread publish dates so "newest" ordering looks realistic.
  await listingModel.bulkWrite(
    created.map((c) => ({
      updateOne: {
        filter: { _id: new Types.ObjectId(c.id) },
        update: { $set: { publishedAt: c.publishedAt } },
      },
    })),
  );
  console.log(`Seeded ${created.length} listings for ${dealers.length} dealers.`);
  console.log(
    `Log in as demo-seller-1@carsales.local or demo-buyer@carsales.local with password ${DEMO_PASSWORD}`,
  );
});
