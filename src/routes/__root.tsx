import { createRootRoute } from '@tanstack/react-router';
import { Head, Html, Meta, Scripts, Body, ScrollRestoration } from '@tanstack/react-start';
import AppLayout from '../components/layout/AppLayout';
import styles from '../styles.css?url';

export const Route = createRootRoute({
  meta: () => [
    { charSet: 'utf-8' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    { title: 'Ótica Catelan CRM' },
  ],
  component: RootComponent,
});

function RootComponent() {
  return (
    <Html>
      <Head>
        <Meta />
        <link rel="stylesheet" href={styles} />
      </Head>
      <Body>
        <AppLayout />
        <ScrollRestoration />
        <Scripts />
      </Body>
    </Html>
  );
}

