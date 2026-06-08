import { createRootRoute } from '@tanstack/react-router';
import { Meta, Scripts } from '@tanstack/react-start';
import AppLayout from '../components/layout/AppLayout';
import styles from '../styles.css?url';

export const Route = createRootRoute({
  head: () => (
    <>
      <Meta />
      <link rel="stylesheet" href={styles} />
    </>
  ),
  component: () => (
    <>
      <AppLayout />
      <Scripts />
    </>
  ),
});
