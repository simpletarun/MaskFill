import { faker, allFakers } from '@faker-js/faker';

// default (en) instance + every locale instance, e.g. __FAKERS__['de']
globalThis.__FAKER__ = faker;
globalThis.__FAKERS__ = allFakers;
