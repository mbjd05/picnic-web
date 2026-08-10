export type PicnicLinkKind = "product" | "recipe";

export type ShareInfo = {
  text: string;
  url: string | null;
};

export type PicnicLinkResolveResponse = {
  kind: PicnicLinkKind;
  id: string;
  sourceUrl: string;
};
