const icons = import.meta.glob("../assets/icons/*.svg", {
  eager: true,
  import: "default",
  query: "?url",
});

export function withIconUrls(markup) {
  return markup.replaceAll(/\.\/assets\/icons\/([a-z-]+\.svg)/g, (_, fileName) => icons[`../assets/icons/${fileName}`]);
}
