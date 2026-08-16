import os
import re

templates_dir = r"c:\Users\nadhi\Desktop\Focus You Final\AI (2)\AI\templates"
static_dir = r"c:\Users\nadhi\Desktop\Focus You Final\AI (2)\AI\static"

for filename in os.listdir(templates_dir):
    if not filename.endswith(".html"): continue
    
    filepath = os.path.join(templates_dir, filename)
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    basename = filename.replace('.html', '')

    # --- JS Extraction ---
    script_pattern = re.compile(r'<script(?![^>]*src=)[^>]*>(.*?)</script>', re.DOTALL)
    
    js_blocks = []
    def script_repl(match):
        text = match.group(1)
        if "{{ user }}" in text or "{{user}}" in text:
            return match.group(0) # Do not extract jinja variables
        
        js_blocks.append(text.strip())
        return ""
        
    new_content = script_pattern.sub(script_repl, content)
    
    if js_blocks:
        js_text = "\n\n".join(js_blocks)
        js_filepath = os.path.join(static_dir, f"{basename}.js")
        
        if os.path.exists(js_filepath):
            js_filepath = os.path.join(static_dir, f"{basename}_scripts.js")
            
        with open(js_filepath, "w", encoding='utf-8') as f:
            f.write(js_text)
            
        src_tag = f"<script src=\"{{{{ url_for('static', filename='{os.path.basename(js_filepath)}') }}}}\"></script>"
        if src_tag not in new_content:
            new_content = new_content.replace('</body>', f'{src_tag}\n</body>')

    # --- CSS Extraction ---
    styles_pattern = re.compile(r'<style[^>]*>(.*?)</style>', re.DOTALL)
    css_blocks = []
    def style_repl(match):
        css_blocks.append(match.group(1).strip())
        return ""
        
    new_content = styles_pattern.sub(style_repl, new_content)
    
    if css_blocks:
        css_text = "\n\n".join(css_blocks)
        css_filepath = os.path.join(static_dir, f"{basename}.css")
        
        if os.path.exists(css_filepath):
            css_filepath = os.path.join(static_dir, f"{basename}_styles.css")
            
        with open(css_filepath, "w", encoding='utf-8') as f:
            f.write(css_text)
            
        link_tag = f'<link rel="stylesheet" href="{{{{ url_for(\'static\', filename=\'{os.path.basename(css_filepath)}\') }}}}">'
        if link_tag not in new_content:
            new_content = new_content.replace('</head>', f'{link_tag}\n</head>')

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)

print("Extraction script completed.")
