import devStyles from '@unigrid/blocks/dev.css?url';

// a side-effect css import in a component never reaches the route's <link> tags
export const gridDevLinks = () =>
  import.meta.env.DEV ? [{rel: 'stylesheet' as const, href: devStyles}] : [];

export const DEV = import.meta.env.DEV;
