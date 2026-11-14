"""Inline data.js, engine.js, navigator.js and app.js into one self-contained page: web/dist/index.html."""
import pathlib
import shutil

W = pathlib.Path(__file__).resolve().parents[1] / "web"
html = (W / "index.html").read_text(encoding="utf-8")
for tag, f in (("<!--DATA-->", "data.js"), ("<!--ENGINE-->", "engine.js"), ("<!--NAV-->", "navigator.js"), ("<!--APP-->", "app.js")):
    js = (W / f).read_text(encoding="utf-8").replace("</script", "<\\/script")
    html = html.replace(tag, f"<script>\n{js}\n</script>")
(W / "dist").mkdir(exist_ok=True)
(W / "dist" / "index.html").write_text(html, encoding="utf-8")
shutil.copytree(W / "vendor", W / "dist" / "vendor", dirs_exist_ok=True)
print("built", len(html) // 1024, "KB")
