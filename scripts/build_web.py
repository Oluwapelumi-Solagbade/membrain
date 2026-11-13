"""Inline data.js, engine.js and app.js into one self-contained page: web/dist/index.html."""
import pathlib

W = pathlib.Path(__file__).resolve().parents[1] / "web"
html = (W / "index.html").read_text()
for tag, f in (("<!--DATA-->", "data.js"), ("<!--ENGINE-->", "engine.js"), ("<!--APP-->", "app.js")):
    js = (W / f).read_text().replace("</script", "<\\/script")
    html = html.replace(tag, f"<script>\n{js}\n</script>")
(W / "dist").mkdir(exist_ok=True)
(W / "dist" / "index.html").write_text(html)
print("built", len(html) // 1024, "KB")
