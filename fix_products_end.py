with open('src/services/products.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    new_lines.append(line)

new_lines.extend([
    "        } : {})\n",
    "      }))\n",
    "    })\n",
    "  };\n",
    "  return payload;\n",
    "}\n"
])

with open('src/services/products.js', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
