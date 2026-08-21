import { photoSchema } from './photo';
import { seriesSchema } from './series';
import { siteSettingsSchema } from './siteSettings';
import { styleSchema, cameraSchema, lensSchema } from './taxonomies';

export const schemaTypes = [
  photoSchema,
  seriesSchema,
  styleSchema,
  cameraSchema,
  lensSchema,
  siteSettingsSchema,
];
