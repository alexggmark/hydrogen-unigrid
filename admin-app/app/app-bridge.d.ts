// only the file picker, declared rather than pulling in @shopify/app-bridge-types:
// those types augment the global jsx button element, which breaks radix's Button
// inside @unigrid/editor — a package that must not know app bridge exists.
declare const shopify: {
  intents: {
    invoke(
      intent: 'pick:shopify/File',
      options?: {data?: {mediaTypes?: string[]; multiSelect?: boolean}},
    ): Promise<{complete: Promise<{code?: string; data?: {ids?: string[]}}>}>;
  };
};
