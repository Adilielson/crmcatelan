import { createRootRoute, Head } from '@tanstack/react-router';
import AppLayout from '../components/layout/AppLayout';
import styles from '../styles.css?url';

export const Route = createRootRoute({
  component: () => (
    <>
      <Head>
        <link rel="stylesheet" href={styles} />
      </Head>
      <AppLayout />
    </>
  ),
});
