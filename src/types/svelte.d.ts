declare module "svelte" {
  /** @param component @param options @returns */
  export function mount(
    component: any,
    options: {
      target: HTMLElement | ShadowRoot | DocumentFragment;
      props?: Record<string, any>;
      hydrate?: boolean;
      intro?: boolean;
    }
  ): any;
}
