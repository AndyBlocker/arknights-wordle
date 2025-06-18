#!/usr/bin/env bash

# 输出文件名
OUTPUT_FILE="all_code.txt"

# 先清空/新建输出文件
> "$OUTPUT_FILE"

# 使用 find 排除 node_modules 目录，然后查找 .vue 和 .js 文件
find . -path ./node_modules -prune -o \( -name "*.vue" -o -name "*.js" \) -print | while read -r file
do
  # 在输出中添加文件分隔标记，方便 GPT 或其他 LLM 处理
  echo "=== FILE START: $file ===" >> "$OUTPUT_FILE"
  cat "$file" >> "$OUTPUT_FILE"
  echo -e "\n=== FILE END: $file ===\n" >> "$OUTPUT_FILE"
done

echo "代码汇总完成！已输出到 $OUTPUT_FILE"
