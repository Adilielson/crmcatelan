import { createRootRoute } from '@tanstack/react-router';
import AppLayout from '../components/layout/AppLayout';
import styles from '../styles.css?url';

export const Route = createRootRoute({
  head: () => ({
    links: [{ rel: 'stylesheet', href: styles }],
  }),
  component: AppLayout,
});
