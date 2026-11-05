import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { slugify } from '../../common/utils/strings';
import {
  BODY_TYPES,
  CITIES,
  FEATURES,
  FUEL_TYPES,
  MAKES,
  REGISTRATION_STATES,
  TRANSMISSIONS,
} from './catalog.data';

export interface CatalogModel {
  name: string;
  slug: string;
}

export interface CatalogMake {
  name: string;
  slug: string;
  models: CatalogModel[];
}

export interface Catalog {
  makes: CatalogMake[];
  cities: { name: string; slug: string; state: string }[];
  registrationStates: { code: string; name: string }[];
  features: { slug: string; label: string }[];
  fuelTypes: readonly string[];
  transmissions: readonly string[];
  bodyTypes: readonly string[];
}

@Injectable()
export class CatalogService {
  readonly catalog: Catalog;
  /** Pre-serialised payload + ETag so GET /catalog does no per-request work. */
  readonly json: string;
  readonly etag: string;

  private readonly makesBySlug = new Map<
    string,
    { make: CatalogMake; models: Map<string, CatalogModel> }
  >();
  private readonly featureSlugs: Set<string>;
  private readonly stateCodes: Set<string>;

  constructor() {
    const makes = Object.entries(MAKES)
      .map(([name, models]) => ({
        name,
        slug: slugify(name),
        models: models
          .map((m) => ({ name: m, slug: slugify(m) }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const make of makes) {
      const models = new Map(make.models.map((m) => [m.slug, m]));
      if (this.makesBySlug.has(make.slug) || models.size !== make.models.length) {
        throw new Error(`Catalog has duplicate slugs in make "${make.name}"`);
      }
      this.makesBySlug.set(make.slug, { make, models });
    }

    this.catalog = {
      makes,
      cities: CITIES.map(([name, state]) => ({ name, slug: slugify(name), state })),
      registrationStates: REGISTRATION_STATES.map(([code, name]) => ({ code, name })),
      features: FEATURES.map(([slug, label]) => ({ slug, label })),
      fuelTypes: FUEL_TYPES,
      transmissions: TRANSMISSIONS,
      bodyTypes: BODY_TYPES,
    };
    this.featureSlugs = new Set(FEATURES.map(([slug]) => slug));
    this.stateCodes = new Set(REGISTRATION_STATES.map(([code]) => code));
    this.json = JSON.stringify(this.catalog);
    this.etag = `"${createHash('sha1').update(this.json).digest('base64url')}"`;
  }

  /** Resolves make/model slugs to canonical names, or null if unknown. */
  resolveModel(
    makeSlug: string,
    modelSlug: string,
  ): { make: CatalogMake; model: CatalogModel } | null {
    const entry = this.makesBySlug.get(makeSlug);
    const model = entry?.models.get(modelSlug);
    return entry && model ? { make: entry.make, model } : null;
  }

  isKnownFeature(slug: string): boolean {
    return this.featureSlugs.has(slug);
  }

  isKnownState(code: string): boolean {
    return this.stateCodes.has(code);
  }
}
