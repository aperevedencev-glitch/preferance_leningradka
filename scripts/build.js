// Сборка: подставляет движок в шаблоны и пишет самодостаточные страницы в dist/
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const strip = (s) => s.replace(/\nif \(typeof module[^\n]*\n?$/, "\n");
const engine = strip(read("src/engine.js")), cards = strip(read("src/cards.js"));
fs.mkdirSync(path.join(root, "dist"), { recursive: true });
for (const name of ["tracker", "game"]) {
  const body = read(`templates/${name}.html`)
    .replace("/*__ENGINE__*/", () => engine)
    .replace("/*__CARDS__*/", () => cards);
  const html = `<!doctype html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n</head>\n<body>\n${body}\n</body>\n</html>\n`;
  fs.writeFileSync(path.join(root, `dist/${name}.html`), html);
  console.log(`dist/${name}.html`, html.length);
}
