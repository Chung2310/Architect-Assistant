import sys

with open('src/components/Render.tsx', 'r') as f:
    content = f.read()

target = """          {/* Right Panel: Kết Quả */}
          <div className="flex-1 bg-surface-container-lowest rounded-2xl border border-outline-variant/20 flex flex-col p-6 shadow-sm">"""

replacement = """          {/* Right Panel: Kết Quả */}
          <div className="flex-1 bg-surface-container-lowest rounded-2xl border border-outline-variant/20 flex flex-col p-6 shadow-sm lg:sticky lg:top-4 lg:max-h-[calc(100vh-160px)] overflow-y-auto custom-scrollbar">"""

content = content.replace(target, replacement)

with open('src/components/Render.tsx', 'w') as f:
    f.write(content)
