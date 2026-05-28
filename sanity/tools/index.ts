import type { Tool } from 'sanity';
import { HomeIcon } from '@sanity/icons';
import { Dashboard } from './Dashboard';

export const dashboardTool: Tool = {
  name: 'dashboard',
  title: 'Tableau de bord',
  icon: HomeIcon,
  component: Dashboard,
};
