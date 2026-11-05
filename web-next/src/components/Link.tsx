import NextLink from 'next/link';
import type { ComponentProps } from 'react';

/**
 * Next prefetches every link on screen by default, which here meant 36 background requests on
 * the home page and one API call per car on the dealer dashboard. Pages load fast without it.
 */
export default function Link(props: ComponentProps<typeof NextLink>) {
  return <NextLink prefetch={false} {...props} />;
}
