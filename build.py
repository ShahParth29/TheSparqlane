import os
import shutil
import re

base_dir = os.path.dirname(os.path.abspath(__file__))
src_dir = os.path.join(base_dir, "frontend")
dist_dir = os.path.join(base_dir, "dist")

def clean_and_copy():
    if os.path.exists(dist_dir):
        print(f"Cleaning existing dist folder: {dist_dir}")
        shutil.rmtree(dist_dir)
    print(f"Copying assets from {src_dir} to {dist_dir}...")
    shutil.copytree(src_dir, dist_dir, ignore=shutil.ignore_patterns("uploads"))

def minify_css(css_content):
    # Remove CSS comments
    css_content = re.sub(r'/\*.*?\*/', '', css_content, flags=re.DOTALL)
    # Remove spacing around braces and colon
    css_content = re.sub(r'\s*([\{\}:;,])\s*', r'\1', css_content)
    # Collapse multiple spaces
    css_content = re.sub(r'\s+', ' ', css_content)
    return css_content.strip()

def minify_js(js_content):
    # Remove multi-line comments
    js_content = re.sub(r'/\*.*?\*/', '', js_content, flags=re.DOTALL)
    
    # Process line by line for single line comments and whitespace
    lines = js_content.split('\n')
    minified_lines = []
    for line in lines:
        # Strip single-line comments that are NOT part of URLs
        line = re.sub(r'(?<!http:)(?<!https:)//.*$', '', line)
        line = line.strip()
        if line:
            minified_lines.append(line)
            
    # Join lines back. We keep newlines to avoid statement errors where semi-colons are missing
    js_content = '\n'.join(minified_lines)
    # Collapse multiple spaces
    js_content = re.sub(r'[ \t]+', ' ', js_content)
    return js_content.strip()

def minify_html(html_content):
    # Remove HTML comments (excluding IE conditionals)
    html_content = re.sub(r'<!--(?!\[if).*?-->', '', html_content, flags=re.DOTALL)
    # Collapse multiple spaces and tabs
    html_content = re.sub(r'[ \t]+', ' ', html_content)
    # Collapse multiple newlines/spaces around tags
    html_content = re.sub(r'\s*\n\s*', '\n', html_content)
    return html_content.strip()

def run_build():
    clean_and_copy()
    
    html_count = css_count = js_count = 0
    total_saved = 0
    
    for root, _, files in os.walk(dist_dir):
        for file in files:
            ext = os.path.splitext(file)[1].lower()
            if ext not in [".html", ".css", ".js"]:
                continue
                
            fpath = os.path.join(root, file)
            with open(fpath, "r", encoding="utf-8") as f:
                original_content = f.read()
                
            orig_size = len(original_content.encode("utf-8"))
            
            if ext == ".html":
                minified = minify_html(original_content)
                html_count += 1
            elif ext == ".css":
                minified = minify_css(original_content)
                css_count += 1
            elif ext == ".js":
                minified = minify_js(original_content)
                js_count += 1
                
            mini_size = len(minified.encode("utf-8"))
            saved = orig_size - mini_size
            total_saved += saved
            
            # Only write back if it's smaller
            if saved > 0:
                with open(fpath, "w", encoding="utf-8") as f:
                    f.write(minified)
                ratio = (saved / orig_size) * 100
                print(f"Minified {os.path.relpath(fpath, dist_dir)}: {orig_size/1024:.2f} KB -> {mini_size/1024:.2f} KB (-{ratio:.1f}%)")
            else:
                print(f"Skipped {os.path.relpath(fpath, dist_dir)} (already optimized)")

    print("\n" + "="*50)
    print("BUILD SUCCESSFUL!")
    print(f"Minified: {html_count} HTML, {css_count} CSS, {js_count} JS files.")
    print(f"Total space saved: {total_saved / 1024:.2f} KB")
    print("="*50)

if __name__ == "__main__":
    run_build()
