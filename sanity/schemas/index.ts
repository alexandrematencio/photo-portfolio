import { photoSchema } from './photo';
import { seriesSchema } from './series';
import { siteSettingsSchema } from './siteSettings';
import { funnelCurationSchema } from './funnelCuration';
import { pageSchemas } from './pages';
import { styleSchema, cameraSchema, lensSchema } from './taxonomies';

export const schemaTypes = [
  photoSchema,
  seriesSchema,
  styleSchema,
  cameraSchema,
  lensSchema,
  siteSettingsSchema,
  funnelCurationSchema,
  ...pageSchemas,
];
