FROM python:3.11-slim

WORKDIR /app

# 安装依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制项目文件
COPY . .

# 给 Linux 引擎执行权限
RUN chmod +x Linux/pikafish-*

EXPOSE 8080

CMD ["sh", "-c", "gunicorn app:app --workers 1 --bind 0.0.0.0:${PORT:-8080} --timeout 120"]
